/* ============================================================
   src/ui/ocr.js
   Leer el texto de una imagen: el pantallazo de los movimientos
   del banco, la foto de una boleta.

   Hasta ahora, de una foto la app sacaba la fecha del EXIF y el
   QR donde el teléfono supiera leerlo; el texto lo tenía que
   pegar la persona. Esto lo cierra.

   POR QUÉ HAY UNA LIBRERÍA ACÁ, siendo que el proyecto no usa
   ninguna: leer letras de una imagen no se puede improvisar. Las
   tres salidas eran una librería en el teléfono, un modelo en un
   servidor, o seguir pegando el texto a mano. Se eligió la
   primera y es una excepción consciente a la regla de "sin
   librerías", documentada en ARQUITECTURA.md, porque es la única
   que funciona en iPhone y en Android, gratis, y sin que el
   pantallazo del banco salga del aparato.

   Lo que NO cambia:
     - El OCR solo entrega TEXTO. Quien entiende ese texto sigue
       siendo core/lector.js, que es determinístico y está
       probado. No hay ningún modelo interpretando nada.
     - Nada se anota solo. Sale la pantalla de revisar, línea por
       línea, igual que con una cartola en Excel. Regla 12.
     - La imagen no sale del teléfono. Lo único que se baja de
       internet es el programa que lee, una sola vez.
   ============================================================ */

const UiOcr = (() => {
  'use strict';

  /* La versión va fija a propósito: si el CDN publica una nueva y acá
     dijera "latest", la app podría cambiar de comportamiento un día
     cualquiera sin que nadie tocara este repositorio. */
  const VERSION = '5.1.1';
  const CDN = `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/tesseract.min.js`;

  /** Cuánto pesa la primera bajada, para poder decirlo antes de hacerla. */
  const PESO_APROXIMADO = '5 MB';

  let cargando = null;      // la promesa de la carga, para no bajarla dos veces
  let trabajador = null;    // el worker de Tesseract, que se reusa

  const yaEstaListo = () => Boolean(trabajador);

  /** ¿Ya se bajó alguna vez en este aparato? */
  const yaSeBajo = () => {
    try { return localStorage.getItem('mi-bolsillo:ocr') === 'listo'; }
    catch (e) { return false; }
  };

  const marcarBajado = () => {
    try { localStorage.setItem('mi-bolsillo:ocr', 'listo'); } catch (e) {}
  };

  /* ---------------- Cargar el lector ---------------- */

  function cargarLibreria() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (cargando) return cargando;

    cargando = new Promise((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = () => window.Tesseract
        ? resolver(window.Tesseract)
        : rechazar(new Error('El lector de texto se bajó a medias. Prueba de nuevo.'));
      s.onerror = () => {
        cargando = null;
        rechazar(new Error('No pudimos bajar el lector de texto. ¿Tienes internet?'));
      };
      document.head.appendChild(s);
    });
    return cargando;
  }

  /**
   * Prepara el worker. Es lo que más demora la primera vez, porque
   * baja el motor y el idioma; después queda en la caché del navegador
   * y del ayudante (ver sw.js) y arranca en un segundo.
   */
  async function prepararTrabajador(alProgresar) {
    if (trabajador) return trabajador;
    const T = await cargarLibreria();

    trabajador = await T.createWorker('spa', 1, {
      logger: m => {
        if (!alProgresar) return;
        // Tesseract avisa de dos fases: bajando y reconociendo.
        const pct = Math.round((m.progress || 0) * 100);
        if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata'
            || m.status === 'initializing tesseract' || m.status === 'initializing api') {
          alProgresar({ fase: 'preparando', pct });
        } else if (m.status === 'recognizing text') {
          alProgresar({ fase: 'leyendo', pct });
        }
      },
    });

    // Un pantallazo de banco es una columna de líneas, no un párrafo ni
    // una página con columnas. Decírselo mejora bastante el resultado:
    // sin esto, junta la fecha de una fila con el monto de la siguiente.
    await trabajador.setParameters({ tessedit_pageseg_mode: '4' });

    marcarBajado();
    return trabajador;
  }

  /* ---------------- Preparar la imagen ----------------

     El OCR mejora mucho con la imagen limpia. Tres cosas, en este
     orden, y ninguna inventa píxeles:

       1. Agrandar si viene chica. Tesseract lee mal texto de menos
          de unos 20 píxeles de alto, y un pantallazo recortado en
          el celular llega justo en ese borde.
       2. Pasar a gris. El color no aporta nada y confunde.
       3. Subir el contraste. Un pantallazo en modo oscuro tiene el
          texto claro sobre fondo casi negro y sale mejor invertido.
     ------------------------------------------------------------ */

  const ANCHO_IDEAL = 1600;

  async function prepararImagen(blob) {
    const imagen = await cargarImagen(blob);
    const w = imagen.width || imagen.naturalWidth;
    const h = imagen.height || imagen.naturalHeight;

    const escala = Math.min(3, Math.max(1, ANCHO_IDEAL / Math.max(1, w)));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(w * escala);
    lienzo.height = Math.round(h * escala);

    const pincel = lienzo.getContext('2d', { willReadFrequently: true });
    pincel.imageSmoothingQuality = 'high';
    pincel.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    if (imagen.close) imagen.close();

    const datos = pincel.getImageData(0, 0, lienzo.width, lienzo.height);
    const px = datos.data;

    // Gris + medir si la imagen es mayoritariamente oscura
    let suma = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      px[i] = px[i + 1] = px[i + 2] = g;
      suma += g;
    }
    const promedio = suma / (px.length / 4);
    const esOscura = promedio < 110;

    // Contraste, e inversión si venía en modo oscuro. Tesseract espera
    // letras negras sobre fondo blanco; al revés acierta bastante menos.
    for (let i = 0; i < px.length; i += 4) {
      let v = px[i];
      if (esOscura) v = 255 - v;
      v = v < 128 ? Math.max(0, (v - 40) * 1.5) : Math.min(255, 255 - (255 - v) * 0.6);
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    pincel.putImageData(datos, 0, 0);

    return new Promise(r => lienzo.toBlob(b => r(b), 'image/png'));
  }

  function cargarImagen(blob) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob, { imageOrientation: 'from-image' })
        .catch(() => porEtiqueta(blob));
    }
    return porEtiqueta(blob);
  }

  const porEtiqueta = blob => new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No pudimos abrir esa imagen.')); };
    img.src = url;
  });

  /* ---------------- Leer ---------------- */

  /**
   * Devuelve el texto que se pudo sacar de la imagen.
   * 'alProgresar' recibe { fase, pct } para poder mostrar en qué va:
   * la primera vez esto demora, y una pantalla quieta parece colgada.
   */
  async function leer(blob, alProgresar) {
    const listo = await prepararTrabajador(alProgresar);
    const limpia = await prepararImagen(blob);
    const r = await listo.recognize(limpia);
    return ordenar((r && r.data && r.data.text) || '');
  }

  /**
   * Deja el texto en la forma que espera core/lector.js: una línea por
   * movimiento, sin líneas vacías ni basura de un solo carácter.
   *
   * Lo importante acá es NO juntar líneas. El lector de cartolas
   * trabaja línea por línea, y un OCR que devuelve todo pegado le
   * haría creer que hay un solo movimiento gigante.
   */
  function ordenar(texto) {
    const lineas = String(texto)
      .split('\n')
      .map(l => l.replace(/[ \t]+/g, ' ').trim())
      // Una línea de un solo carácter casi siempre es ruido: el borde
      // de una tarjeta, un ícono que el OCR creyó letra.
      .filter(l => l.length > 1);
    return coserFilas(lineas).join('\n');
  }

  /* ---------------- Coser las filas ----------------

     Esta es la diferencia entre leer OCHO movimientos y leer uno, y
     costó descubrirla probando con un pantallazo de verdad.

     Una cartola en Excel trae un movimiento por línea. La app del
     banco, en cambio, apila: la fecha arriba, y abajo la glosa con el
     monto a la derecha. El OCR respeta ese apilado, así que devuelve

         02/09/2026
         COMPRA LIDER EXPRESS $ -38.500

     y el lector de cartolas, que trabaja línea por línea, no encuentra
     ninguna fila con fecha Y monto juntos: devolvía cero movimientos y
     la app terminaba anotando uno solo.

     Acá se vuelven a pegar. Es una regla de FORMA, sobre cómo una
     imagen se convierte en texto, así que vive en este archivo y no en
     core/lector.js, que se ocupa de entender el texto ya armado.
     ------------------------------------------------------------ */

  // '02/09/2026', '2-9-26', '02/09' y también '2 de septiembre'
  const FECHA = '(\\d{1,2}[\\/\\-.]\\d{1,2}([\\/\\-.]\\d{2,4})?|\\d{1,2} de [a-záéíóúñ]+( de \\d{4})?)';
  const SOLO_FECHA      = new RegExp(`^[+\\-]?\\s*${FECHA}\\s*$`, 'i');
  const FECHA_AL_INICIO = new RegExp(`^[+\\-]?\\s*${FECHA}\\s*`, 'i');

  // '$ -38.500', '-38.500', '38.500', '$1.990'
  const SOLO_MONTO = /^[+\-]?\s*\$?\s*\d[\d.,]*\s*$/;

  /**
   * ¿Esta línea ya trae el monto?
   *
   * Ojo con la fecha: hay que sacarla ANTES de mirar. El año de
   * "05/09/2026" parece perfectamente un monto de cuatro dígitos, y
   * por eso la línea "05/09/2026 COMPRA JUMBO" se daba por completa y
   * dejaba su monto tirado en la línea de abajo.
   */
  function traeMonto(linea) {
    const resto = linea.replace(FECHA_AL_INICIO, '');
    // Un peso, o un número con separador de miles, o cuatro cifras juntas.
    return /\$/.test(resto) || /\d[\d.]*[.,]\d{3}/.test(resto) || /\b\d{4,}\b/.test(resto);
  }

  function coserFilas(lineas) {
    const salida = [];
    for (let i = 0; i < lineas.length; i++) {
      let linea = lineas[i];

      // 1. Una fecha sola se pega a la línea de abajo, que es su glosa.
      if (SOLO_FECHA.test(linea) && i + 1 < lineas.length && !SOLO_FECHA.test(lineas[i + 1])) {
        linea = `${linea} ${lineas[i + 1]}`;
        i++;
      }

      // 2. Y si el monto quedó solo en la línea siguiente —pasa cuando
      //    la columna de la derecha queda muy separada—, también.
      if (i + 1 < lineas.length && SOLO_MONTO.test(lineas[i + 1]) && !traeMonto(linea)) {
        linea = `${linea} ${lineas[i + 1]}`;
        i++;
      }

      salida.push(linea);
    }
    return salida;
  }

  /** Suelta el worker. Ocupa memoria y en un teléfono eso se nota. */
  async function soltar() {
    if (!trabajador) return;
    try { await trabajador.terminate(); } catch (e) {}
    trabajador = null;
  }

  return { leer, soltar, yaEstaListo, yaSeBajo, ordenar, coserFilas,
           PESO_APROXIMADO, VERSION, CDN };
})();

/* Para poder probar el cosido de filas en Node, sin navegador. */
if (typeof module !== 'undefined' && module.exports) module.exports = UiOcr;
