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
     .xlsx             es un ZIP con XML adentro, igual que el que
                       arma excel.js para exportar. Se desarma a mano.
                       Es el formato en que los bancos chilenos dan la
                       cartola, así que sin esto la función queda coja.
                       El .xls antiguo NO: ese es otro formato entero y
                       la app le dice a la persona cómo convertirlo.
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
    if (/\.xlsx?$/.test(nombre) || tipo.includes('spreadsheet') || tipo.includes('ms-excel')) return 'hoja';
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
     3. Cartolas en Excel

     Los bancos chilenos casi nunca dan la cartola en .csv: la dan en
     .xlsx. Y un .xlsx es un ZIP con XML adentro, que es exactamente
     lo que /src/ui/excel.js arma al revés para exportar. Acá lo
     desarmamos, con el mismo criterio: sin librerías.

     Del archivo solo nos interesan tres piezas:
       xl/sharedStrings.xml   el texto, guardado una sola vez y
                              referenciado por número desde las celdas
       xl/worksheets/sheet1.xml  las filas y columnas
       xl/styles.xml          para saber qué celdas son FECHAS, porque
                              Excel las guarda como el número 46235 y
                              sin esto la fecha llegaría ilegible
     ============================================================ */

  /** Abre un ZIP en memoria. Devuelve un mapa nombre -> bytes. */
  async function abrirZip(bytes) {
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const archivos = new Map();

    // El índice del ZIP va al FINAL, no al principio: hay que buscar
    // su marca de atrás hacia adelante.
    let fin = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
      if (vista.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin === -1) return archivos;

    const cuantos = vista.getUint16(fin + 10, true);
    let puntero = vista.getUint32(fin + 16, true);

    for (let n = 0; n < cuantos; n++) {
      if (puntero + 46 > bytes.length || vista.getUint32(puntero, true) !== 0x02014b50) break;

      const metodo    = vista.getUint16(puntero + 10, true);
      const comprimido = vista.getUint32(puntero + 20, true);
      const largoNombre = vista.getUint16(puntero + 28, true);
      const largoExtra  = vista.getUint16(puntero + 30, true);
      const largoNota   = vista.getUint16(puntero + 32, true);
      const dondeEmpieza = vista.getUint32(puntero + 42, true);

      const nombre = new TextDecoder()
        .decode(bytes.subarray(puntero + 46, puntero + 46 + largoNombre));

      // La cabecera local repite el nombre y los extras, y su largo puede
      // no coincidir con el del índice: hay que leerlo de nuevo ahí.
      const nombreLocal = vista.getUint16(dondeEmpieza + 26, true);
      const extraLocal  = vista.getUint16(dondeEmpieza + 28, true);
      const datos = dondeEmpieza + 30 + nombreLocal + extraLocal;
      const crudo = bytes.subarray(datos, datos + comprimido);

      if (metodo === 0) {
        archivos.set(nombre, crudo);
      } else if (metodo === 8) {
        const abierto = await inflarCrudo(crudo);
        if (abierto) archivos.set(nombre, abierto);
      }
      // cualquier otro método de compresión no lo tocamos

      puntero += 46 + largoNombre + largoExtra + largoNota;
    }
    return archivos;
  }

  /** Dentro de un ZIP el deflate va sin cabecera zlib. */
  async function inflarCrudo(bytes) {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(flujo).arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  const textoDeBytes = bytes => new TextDecoder().decode(bytes);

  const desescaparXml = t => String(t)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

  /** El texto compartido: cada <si> puede venir partido en varios <t>. */
  function textosCompartidos(xml) {
    if (!xml) return [];
    return (xml.match(/<si\b[\s\S]*?<\/si>|<si\s*\/>/g) || []).map(si =>
      desescaparXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, '')).join('')));
  }

  /* Los formatos de fecha que Excel trae de fábrica. Del 14 al 22 son
     fechas y horas; del 45 al 47, duraciones. */
  const FORMATOS_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

  /**
   * Qué estilos son fechas. Excel guarda "2 de agosto de 2026" como el
   * número 46235, y lo único que lo distingue de un monto es el formato
   * que tiene aplicado. Sin esto, la columna Fecha llega como 46235 y el
   * lector no encuentra una sola fecha en toda la cartola.
   */
  function estilosDeFecha(xml) {
    const esFecha = new Set();
    if (!xml) return esFecha;

    // los formatos que el propio archivo define (dd/mm/yyyy y compañía)
    const propios = new Set();
    for (const m of xml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
      // si el formato menciona días, meses o años, es una fecha
      if (/[dmyDMY]/.test(m[2].replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''))) {
        propios.add(Number(m[1]));
      }
    }

    const bloque = (xml.match(/<cellXfs[\s\S]*?<\/cellXfs>/) || [''])[0];
    let indice = 0;
    for (const m of bloque.matchAll(/<xf\b[^>]*>/g)) {
      const id = Number((m[0].match(/numFmtId="(\d+)"/) || [])[1] || 0);
      if (FORMATOS_FECHA.has(id) || propios.has(id)) esFecha.add(indice);
      indice++;
    }
    return esFecha;
  }

  /**
   * El número de serie de Excel a 'dd/mm/aaaa'.
   * El día 0 es el 30 de diciembre de 1899 por el famoso error de Excel,
   * que cree que 1900 fue bisiesto. Se respeta el error a propósito: es
   * lo que hace que las fechas calcen con lo que muestra Excel.
   */
  function fechaDeSerie(serie) {
    const n = Number(serie);
    if (!Number.isFinite(n) || n < 1 || n > 80000) return '';
    const f = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    const dd = String(f.getUTCDate()).padStart(2, '0');
    const mm = String(f.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${f.getUTCFullYear()}`;
  }

  /** La letra de la columna de una celda: de "BC12" saca 54. */
  function numeroDeColumna(referencia) {
    const letras = String(referencia || '').match(/^[A-Z]+/);
    if (!letras) return -1;
    let n = 0;
    for (const c of letras[0]) n = n * 26 + (c.charCodeAt(0) - 64);
    return n - 1;
  }

  /** Una hoja de cálculo a texto separado por tabulaciones. */
  function textoDeHoja(xml, compartidos, esFecha) {
    const lineas = [];

    for (const fila of (xml.match(/<row\b[\s\S]*?<\/row>/g) || [])) {
      const celdas = [];
      for (const m of fila.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const atributos = m[1] || '';
        const cuerpo = m[2] || '';
        const donde = numeroDeColumna((atributos.match(/r="([A-Z]+\d+)"/) || [])[1]);
        const tipo = (atributos.match(/t="([^"]+)"/) || [])[1] || 'n';
        const estilo = Number((atributos.match(/s="(\d+)"/) || [])[1] || -1);
        const valor = (cuerpo.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];

        let texto = '';
        if (tipo === 's') {
          texto = compartidos[Number(valor)] || '';
        } else if (tipo === 'inlineStr') {
          texto = desescaparXml((cuerpo.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
            .map(t => t.replace(/<[^>]+>/g, '')).join(''));
        } else if (tipo === 'str') {
          texto = desescaparXml(valor || '');
        } else if (valor !== undefined) {
          texto = esFecha.has(estilo) ? (fechaDeSerie(valor) || valor) : valor;
        }

        if (donde >= 0) celdas[donde] = texto;
        else celdas.push(texto);
      }
      // el tabulador es el separador: ninguna glosa de banco lo trae adentro
      lineas.push([...celdas].map(c => (c === undefined ? '' : c)).join('\t'));
    }
    return lineas.join('\n');
  }

  async function leerHojaDeCalculo(archivo) {
    const bytes = new Uint8Array(await archivo.arrayBuffer());

    // Un .xls de los antiguos no es un ZIP: empieza con la firma de los
    // documentos compuestos de Office. No lo sabemos leer y hay que
    // decirlo con la salida concreta, no con un "formato no soportado".
    if (bytes[0] === 0xD0 && bytes[1] === 0xCF) {
      return {
        texto: '',
        aviso: 'Ese es un Excel de los antiguos (.xls). Ábrelo en Excel y usa '
             + 'Guardar como → .xlsx o .csv, y ahí sí lo leemos.',
      };
    }

    const zip = await abrirZip(bytes);
    if (!zip.size) {
      return { texto: '', aviso: 'Ese archivo de Excel viene dañado o con clave.' };
    }

    const compartidos = textosCompartidos(
      zip.has('xl/sharedStrings.xml') ? textoDeBytes(zip.get('xl/sharedStrings.xml')) : '');
    const esFecha = estilosDeFecha(
      zip.has('xl/styles.xml') ? textoDeBytes(zip.get('xl/styles.xml')) : '');

    // Las hojas en orden: sheet1, sheet2… Leemos todas y las pegamos,
    // porque hay bancos que parten la cartola en dos.
    const hojas = [...zip.keys()]
      .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

    const texto = hojas
      .map(n => textoDeHoja(textoDeBytes(zip.get(n)), compartidos, esFecha))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return texto
      ? { texto, aviso: '' }
      : { texto: '', aviso: 'Esa planilla vino vacía.' };
  }

  /* ============================================================
     4. Fotos
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

    if (clase === 'hoja') {
      const r = await leerHojaDeCalculo(archivo);
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

  return { leer, claseDe, pesoLegible, sacarEtiquetas, textoDeFlujo, pareceTexto,
           abrirZip, textoDeHoja, textosCompartidos, estilosDeFecha, fechaDeSerie };
})();
