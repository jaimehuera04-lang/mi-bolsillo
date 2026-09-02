/* ============================================================
   src/ui/archivos.js
   Convierte el archivo que eligió la persona en algo que el lector
   pueda entender: texto plano.

   Es el traductor entre el mundo de afuera (un PDF, una foto, un
   CSV) y /src/core/lector.js, que solo sabe de texto y no toca el
   navegador. Acá SÍ se usan las herramientas del navegador
   (FileReader, canvas, DecompressionStream), pero no se calcula ni
   se decide nada: eso es del motor.

   Qué sabe leer, y qué no. Vale la pena decirlo claro porque acá
   está el límite honesto de la función:

     .csv .txt .html   texto directo. Sale entero.
     .pdf              se descomprime y se sacan las letras. Funciona
                       con los comprobantes del banco y las boletas
                       electrónicas, que traen texto de verdad
                       adentro. NO funciona con un PDF que por dentro
                       es una foto escaneada: ahí no hay letras que
                       sacar, hay píxeles.
     .jpg .png .heic   una foto son píxeles. Sin OCR no se puede
                       leer, y OCR es la Fase 7. Lo que SÍ sacamos:
                       la fecha en que se tomó (va escrita en el
                       archivo, en los datos EXIF) y el código QR si
                       la boleta trae uno y el teléfono sabe leerlo.
                       El monto lo escribe la persona.

   Nada de esto sale del teléfono. No hay ninguna llamada a internet
   en este archivo, y esa es justamente la gracia.
   ============================================================ */

const Archivos = (() => {

  /* Foto: la achicamos antes de guardarla. Una foto de iPhone son 4 MB
     y a 1600 píxeles de lado se lee perfecto una boleta pesando 250 KB. */
  const LADO_MAXIMO = 1600;
  const CALIDAD = 0.72;

  const EXTENSIONES_TEXTO = ['.txt', '.csv', '.tsv', '.htm', '.html', '.json', '.eml', '.md'];

  const nombreEnMinusculas = archivo => String(archivo.name || '').toLowerCase();

  /** En qué familia cae el archivo. Manda el tipo declarado y, si viene vacío, la extensión. */
  function claseDe(archivo) {
    const tipo = String(archivo.type || '').toLowerCase();
    const nombre = nombreEnMinusculas(archivo);
    if (tipo.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/.test(nombre)) return 'imagen';
    if (tipo === 'application/pdf' || nombre.endsWith('.pdf')) return 'pdf';
    if (tipo.startsWith('text/') || EXTENSIONES_TEXTO.some(e => nombre.endsWith(e))) return 'texto';
    return 'desconocido';
  }

  /* ============================================================
     1. Texto plano
     ============================================================ */

  function leerComoTexto(archivo) {
    return new Promise(resolver => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result || ''));
      lector.onerror = () => resolver('');
      // Los bancos chilenos todavía mandan CSV en Latin-1. Probamos UTF-8
      // primero y, si aparecen los rombos de reemplazo, repetimos.
      lector.readAsText(archivo, 'utf-8');
    }).then(texto => {
      if (!texto.includes('�')) return texto;
      return new Promise(resolver => {
        const lector = new FileReader();
        lector.onload = () => resolver(String(lector.result || ''));
        lector.onerror = () => resolver(texto);
        lector.readAsText(archivo, 'windows-1252');
      });
    });
  }

  /** Un correo del banco guardado como .html trae el detalle entre etiquetas. */
  function sacarEtiquetas(html) {
    return html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<td[^>]*>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  /* ============================================================
     2. PDF

     Un PDF es una bolsa de "objetos". Los que nos interesan son los
     flujos (stream) que llevan las instrucciones de dibujo, porque
     ahí están los textos entre paréntesis. Casi siempre vienen
     comprimidos con Flate, que es el mismo zip de toda la vida, y
     el navegador sabe descomprimirlo solo con DecompressionStream.
     Ni una librería de por medio.
     ============================================================ */

  /** Los bytes del PDF vistos como texto Latin-1, para poder buscarlos con expresiones. */
  function comoLatin1(bytes) {
    let salida = '';
    const trozo = 0x8000;   // de a 32 KB, o el navegador se queja del largo
    for (let i = 0; i < bytes.length; i += trozo) {
      salida += String.fromCharCode.apply(null, bytes.subarray(i, i + trozo));
    }
    return salida;
  }

  async function inflar(bytes) {
    if (typeof DecompressionStream === 'undefined') return null;
    // 'deflate' trae la cabecera zlib, que es lo normal en un PDF.
    // 'deflate-raw' es el mismo dato sin cabecera; algunos generadores lo usan.
    for (const formato of ['deflate', 'deflate-raw']) {
      try {
        const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(formato));
        const entero = await new Response(flujo).arrayBuffer();
        return new Uint8Array(entero);
      } catch (e) { /* probamos el siguiente */ }
    }
    return null;
  }

  /**
   * Saca las letras de un flujo de contenido de PDF.
   * Las instrucciones que nos importan son cuatro:
   *   (texto) Tj        escribe ese texto
   *   [(a) -300 (b)] TJ escribe los pedazos, y un número muy negativo
   *                     entre ellos es un espacio
   *   Td / TD / T*      baja de línea
   *   <48656C6C6F> Tj   lo mismo pero escrito en hexadecimal
   */
  function textoDeFlujo(contenido) {
    let salida = '';
    let i = 0;
    let pendiente = '';

    const soltar = () => { salida += pendiente; pendiente = ''; };

    while (i < contenido.length) {
      const c = contenido[i];

      if (c === '(') {
        // cadena literal, con paréntesis anidados y barras de escape
        let profundidad = 1;
        let texto = '';
        i++;
        while (i < contenido.length && profundidad > 0) {
          const d = contenido[i];
          if (d === '\\') {
            const siguiente = contenido[i + 1];
            const octal = contenido.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
            if (octal) {
              texto += String.fromCharCode(parseInt(octal[0], 8));
              i += 1 + octal[0].length;
              continue;
            }
            texto += ({ n: '\n', r: '\n', t: ' ', b: '', f: '' })[siguiente] ?? siguiente;
            i += 2;
            continue;
          }
          if (d === '(') profundidad++;
          else if (d === ')') { profundidad--; if (!profundidad) { i++; break; } }
          texto += d;
          i++;
        }
        pendiente += texto;
        continue;
      }

      if (c === '<' && contenido[i + 1] !== '<') {
        const fin = contenido.indexOf('>', i);
        if (fin === -1) break;
        const hex = contenido.slice(i + 1, fin).replace(/[^0-9a-fA-F]/g, '');
        for (let h = 0; h + 1 < hex.length; h += 2) {
          const codigo = parseInt(hex.slice(h, h + 2), 16);
          if (codigo >= 32 || codigo === 10) pendiente += String.fromCharCode(codigo);
        }
        i = fin + 1;
        continue;
      }

      // Un salto grande dentro de un TJ es un espacio de verdad.
      const separacion = contenido.slice(i).match(/^-\d{3,}/);
      if (separacion) {
        if (pendiente && !pendiente.endsWith(' ')) pendiente += ' ';
        i += separacion[0].length;
        continue;
      }

      const operador = contenido.slice(i, i + 3);
      if (/^(Td|TD|T\*|ET)/.test(operador)) {
        soltar();
        if (!salida.endsWith('\n')) salida += '\n';
        i += 2;
        continue;
      }
      if (/^(Tj|TJ)/.test(operador)) { soltar(); i += 2; continue; }

      i++;
    }
    soltar();
    return salida;
  }

  /** true si lo que sacamos parece castellano y no basura binaria. */
  function pareceTexto(texto) {
    if (texto.replace(/\s/g, '').length < 12) return false;
    const legibles = (texto.match(/[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ .,:;$()\-\/\n]/g) || []).length;
    return legibles / texto.length > 0.75;
  }

  async function leerPdf(archivo) {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const crudo = comoLatin1(bytes);

    if (/\/Encrypt\b/.test(crudo)) {
      return { texto: '', aviso: 'Ese PDF viene con clave, así que no podemos abrirlo.' };
    }

    let junto = '';
    const marca = /stream\r?\n?/g;
    let m;

    while ((m = marca.exec(crudo)) !== null) {
      const inicio = m.index + m[0].length;
      const fin = crudo.indexOf('endstream', inicio);
      if (fin === -1) break;
      marca.lastIndex = fin;

      // el diccionario del objeto va justo antes y dice si viene comprimido
      const cabecera = crudo.slice(Math.max(0, m.index - 400), m.index);
      if (/\/Image\b|\/DCTDecode\b|\/JPXDecode\b/.test(cabecera)) continue;

      const bruto = bytes.subarray(inicio, fin);
      let contenido;
      if (/\/FlateDecode\b/.test(cabecera)) {
        const inflado = await inflar(bruto);
        if (!inflado) continue;
        contenido = comoLatin1(inflado);
      } else if (/\/Filter\b/.test(cabecera)) {
        continue;                      // LZW, RunLength y compañía: no los tocamos
      } else {
        contenido = comoLatin1(bruto);
      }

      if (!/\b(Tj|TJ)\b/.test(contenido)) continue;   // no es un flujo con texto
      junto += textoDeFlujo(contenido) + '\n';
    }

    const limpio = junto.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    if (!pareceTexto(limpio)) {
      return {
        texto: '',
        aviso: 'Ese PDF por dentro es una imagen escaneada, no texto, así que no hay letras '
             + 'que leer. Queda guardado igual como respaldo y los datos los escribes tú.',
      };
    }
    return { texto: limpio, aviso: '' };
  }

  /* ============================================================
     3. Fotos
     ============================================================ */

  /**
   * La fecha en que se tomó la foto, escrita dentro del propio
   * archivo (los datos EXIF). Es lo único de una foto que se puede
   * leer sin OCR, y sirve: casi siempre es el día del gasto.
   * Devuelve 'AAAA-MM-DD' o ''.
   */
  async function fechaDeLaFoto(archivo) {
    try {
      const bytes = new Uint8Array(await archivo.slice(0, 256 * 1024).arrayBuffer());
      if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return '';   // no es un JPEG

      let i = 2;
      while (i + 4 < bytes.length) {
        if (bytes[i] !== 0xFF) { i++; continue; }
        const marcador = bytes[i + 1];
        const largo = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marcador === 0xE1) {
          const cabecera = String.fromCharCode.apply(null, bytes.subarray(i + 4, i + 10));
          if (cabecera.startsWith('Exif')) {
            return fechaDeExif(bytes, i + 10) || '';
          }
        }
        if (marcador === 0xDA) break;    // acá empieza la imagen misma
        if (largo <= 0) break;
        i += 2 + largo;
      }
    } catch (e) { /* una foto sin EXIF no es un problema */ }
    return '';
  }

  /** Recorre las tablas TIFF del EXIF buscando la fecha original. */
  function fechaDeExif(bytes, base) {
    const vista = new DataView(bytes.buffer, bytes.byteOffset);
    const orden = String.fromCharCode(bytes[base], bytes[base + 1]);
    if (orden !== 'II' && orden !== 'MM') return '';
    const chico = orden === 'II';                 // II = el byte chico primero

    const leer16 = p => vista.getUint16(p, chico);
    const leer32 = p => vista.getUint32(p, chico);

    if (leer16(base + 2) !== 42) return '';
    let tabla = base + leer32(base + 4);

    const TAGS_FECHA = [0x9003, 0x9004, 0x0132];  // original, digitalizada, modificada
    let punteroExif = 0;

    for (let vuelta = 0; vuelta < 2; vuelta++) {
      if (tabla <= base || tabla + 2 > bytes.length) break;
      const cuantas = leer16(tabla);
      for (let e = 0; e < cuantas; e++) {
        const entrada = tabla + 2 + e * 12;
        if (entrada + 12 > bytes.length) break;
        const tag = leer16(entrada);
        if (tag === 0x8769) punteroExif = base + leer32(entrada + 8);
        if (TAGS_FECHA.includes(tag)) {
          const cantidad = leer32(entrada + 4);
          const donde = cantidad > 4 ? base + leer32(entrada + 8) : entrada + 8;
          const texto = String.fromCharCode
            .apply(null, bytes.subarray(donde, donde + Math.min(cantidad, 20)));
          // el EXIF la escribe como '2026:08:28 14:32:11'
          const m = texto.match(/^(\d{4}):(\d{2}):(\d{2})/);
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        }
      }
      if (!punteroExif) break;
      tabla = punteroExif;
      punteroExif = 0;
    }
    return '';
  }

  /**
   * Achica la foto para que quepa sin llenar el teléfono.
   * Si el navegador no sabe abrir el formato (le pasa con algunos HEIC
   * de iPhone), devolvemos la original: mejor pesada que perdida.
   */
  async function achicar(archivo) {
    try {
      if (typeof createImageBitmap === 'undefined') return archivo;
      const imagen = await createImageBitmap(archivo);
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
      const ancho = Math.round(imagen.width * escala);
      const alto = Math.round(imagen.height * escala);

      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      lienzo.getContext('2d').drawImage(imagen, 0, 0, ancho, alto);
      imagen.close && imagen.close();

      const achicada = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', CALIDAD));
      // si el "achicado" quedó más pesado que el original, nos quedamos con el original
      if (!achicada || achicada.size >= archivo.size) return archivo;
      return achicada;
    } catch (e) {
      return archivo;
    }
  }

  /**
   * El código QR o de barras de la boleta, si lo hay.
   * BarcodeDetector viene de fábrica en Android y en Chrome; en iPhone
   * todavía no existe, así que esto simplemente no aporta nada ahí y
   * no se le promete al usuario.
   */
  async function codigoDe(blob) {
    try {
      if (typeof BarcodeDetector === 'undefined') return '';
      const detector = new BarcodeDetector();
      const imagen = await createImageBitmap(blob);
      const encontrados = await detector.detect(imagen);
      imagen.close && imagen.close();
      return encontrados.map(c => c.rawValue).filter(Boolean).join('\n');
    } catch (e) {
      return '';
    }
  }

  /* ============================================================
     4. La puerta de entrada
     ============================================================ */

  /**
   * Lee un archivo elegido por la persona.
   * @returns {{clase, nombre, tipo, blob, texto, fechaFoto, aviso}}
   *   blob      lo que hay que guardar (la foto ya achicada)
   *   texto     lo que va a leer el motor; '' si no había nada que leer
   *   fechaFoto 'AAAA-MM-DD' del día en que se tomó, o ''
   *   aviso     explicación honesta cuando no se pudo leer
   */
  async function leer(archivo) {
    const clase = claseDe(archivo);
    const base = { clase, nombre: archivo.name || 'archivo', tipo: archivo.type || '',
                   blob: archivo, texto: '', fechaFoto: '', aviso: '' };

    if (clase === 'texto') {
      const crudo = await leerComoTexto(archivo);
      const nombre = nombreEnMinusculas(archivo);
      const esHtml = /\.(html?|eml)$/.test(nombre) || /<\/?(html|body|table|div)\b/i.test(crudo);
      return { ...base, texto: esHtml ? sacarEtiquetas(crudo) : crudo };
    }

    if (clase === 'pdf') {
      const r = await leerPdf(archivo);
      return { ...base, texto: r.texto, aviso: r.aviso };
    }

    if (clase === 'imagen') {
      const [fechaFoto, codigo, blob] = await Promise.all([
        fechaDeLaFoto(archivo), codigoDe(archivo), achicar(archivo),
      ]);
      return {
        ...base,
        blob,
        tipo: blob.type || archivo.type || 'image/jpeg',
        texto: codigo,
        fechaFoto,
        aviso: codigo
          ? ''
          : 'De una foto no se puede leer el monto sin OCR, así que ese lo escribes tú. '
            + (fechaFoto ? 'La fecha sí la sacamos del día en que la tomaste.' : ''),
      };
    }

    return {
      ...base,
      aviso: 'No sabemos leer ese tipo de archivo, pero queda guardado igual como respaldo.',
    };
  }

  /** "245 KB", para mostrarle a la persona cuánto pesa su respaldo. */
  function pesoLegible(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return { leer, claseDe, pesoLegible, sacarEtiquetas, textoDeFlujo, pareceTexto };
})();
