/* ============================================================
   src/ui/fotos.js
   Dejar presentable la foto de un producto, en el propio
   teléfono, sin mandarla a ninguna parte.

   Por qué existe: la foto de producto que uno saca con el
   celular sale torcida de encuadre, pesada (3 o 4 MB) y con la
   luz de la pieza. Puesta en un catálogo se ve mal y, sobre
   todo, no cabe: una tienda con cincuenta productos serían
   ciento cincuenta megas guardados en el teléfono.

   Lo que hace, en este orden:
     1. respeta la orientación con que se sacó (si no, las fotos
        verticales del iPhone salen acostadas);
     2. recorta al cuadrado por el centro, que es como se ven
        todos los catálogos;
     3. la achica a 900 px de lado, suficiente para una tienda;
     4. le empareja la luz: estira el histograma para que el
        blanco sea blanco y el negro sea negro;
     5. la guarda en JPEG.

   Lo que NO hace, y es a propósito: no borra el fondo ni
   inventa píxeles. Eso necesita un modelo, y un modelo necesita
   un servidor y plata al mes. Esto es lo honesto que se puede
   hacer gratis y sin que la foto salga del aparato.
   ============================================================ */

const UiFotos = (() => {
  'use strict';

  const LADO = 900;          // píxeles del cuadrado final
  const CALIDAD = 0.82;      // JPEG: por arriba de esto solo sube el peso

  /**
   * Toma el archivo que eligió la persona y devuelve
   * { blob, nombre, antes, despues } con la foto ya lista.
   * Si algo falla (un formato que el navegador no dibuja, por
   * ejemplo), devuelve el archivo original sin tocar: mejor una
   * foto pesada que ninguna foto.
   */
  async function mejorar(archivo, opciones) {
    const config = { emparejarLuz: true, cuadrada: true, ...(opciones || {}) };
    const nombre = renombrar(archivo.name);

    try {
      const imagen = await cargar(archivo);
      const lienzo = document.createElement('canvas');
      const pincel = lienzo.getContext('2d');

      const { ancho, alto, sx, sy, sw, sh } = encuadre(imagen, config.cuadrada);
      lienzo.width = ancho;
      lienzo.height = alto;
      // El fondo blanco importa: si la foto viene en PNG con
      // transparencia, al pasarla a JPEG lo transparente sale negro.
      pincel.fillStyle = '#ffffff';
      pincel.fillRect(0, 0, ancho, alto);
      pincel.drawImage(imagen, sx, sy, sw, sh, 0, 0, ancho, alto);

      if (config.emparejarLuz) emparejarLuz(pincel, ancho, alto);

      const blob = await aBlob(lienzo);
      const anchoOriginal = imagen.width || imagen.naturalWidth;
      const altoOriginal = imagen.height || imagen.naturalHeight;
      if (imagen.close) imagen.close();

      // Si la foto salió del mismo porte que entró, no la recortamos ni la
      // achicamos: solo le tocamos la luz. En ese caso, si además quedó más
      // pesada, no vale la pena y devolvemos el original.
      //
      // Pero si SÍ cambió de porte, nos quedamos con la nueva aunque pese
      // más: el punto de esto no son los bytes, es que la foto de 4000×3000
      // del celular no entre a un catálogo con ese tamaño. Antes acá había
      // una sola comparación de peso y se comía el recorte entero.
      const mismoPorte = ancho === anchoOriginal && alto === altoOriginal;
      if (mismoPorte && blob.size >= archivo.size && archivo.type === 'image/jpeg') {
        return { blob: archivo, nombre: archivo.name, antes: archivo.size, despues: archivo.size };
      }
      return { blob, nombre, antes: archivo.size, despues: blob.size };
    } catch (e) {
      return { blob: archivo, nombre: archivo.name, antes: archivo.size, despues: archivo.size };
    }
  }

  const renombrar = nombre =>
    String(nombre || 'foto').replace(/\.[^.]+$/, '') + '.jpg';

  /**
   * Carga la imagen respetando su orientación.
   * createImageBitmap con imageOrientation: 'from-image' es la forma
   * corta; donde no exista, el <img> del navegador ya la rota solo
   * desde hace años.
   */
  async function cargar(archivo) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
      } catch (e) { /* seguimos por el camino largo */ }
    }
    return new Promise((resolver, rechazar) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No pudimos abrir esa imagen.')); };
      img.src = url;
    });
  }

  /** De dónde recortar y de qué tamaño queda. */
  function encuadre(imagen, cuadrada) {
    const w = imagen.width || imagen.naturalWidth;
    const h = imagen.height || imagen.naturalHeight;

    if (cuadrada) {
      const lado = Math.min(w, h);
      return {
        ancho: Math.min(LADO, lado), alto: Math.min(LADO, lado),
        sx: Math.round((w - lado) / 2), sy: Math.round((h - lado) / 2),
        sw: lado, sh: lado,
      };
    }
    const escala = Math.min(1, LADO / Math.max(w, h));
    return {
      ancho: Math.round(w * escala), alto: Math.round(h * escala),
      sx: 0, sy: 0, sw: w, sh: h,
    };
  }

  /**
   * Empareja la luz estirando el histograma.
   *
   * En castellano: busca cuál es el punto más oscuro y cuál el más
   * claro de la foto (descartando el 0,5% de cada punta, que suele ser
   * un reflejo o una sombra suelta) y reparte todo el rango entre esos
   * dos. Una foto sacada en una pieza con luz amarilla queda con los
   * blancos blancos.
   *
   * Se hace sobre el brillo y se aplica igual a los tres colores, para
   * no cambiarle el color a la mercadería: si una polera es roja tiene
   * que seguir siendo del mismo rojo, solo mejor iluminada.
   */
  function emparejarLuz(pincel, ancho, alto) {
    const imagen = pincel.getImageData(0, 0, ancho, alto);
    const px = imagen.data;

    const cuenta = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const brillo = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0;
      cuenta[brillo]++;
    }

    const total = ancho * alto;
    const recorte = Math.max(1, Math.round(total * 0.005));

    let bajo = 0, acumulado = 0;
    for (; bajo < 255; bajo++) { acumulado += cuenta[bajo]; if (acumulado > recorte) break; }
    let alto_ = 255; acumulado = 0;
    for (; alto_ > 0; alto_--) { acumulado += cuenta[alto_]; if (acumulado > recorte) break; }

    // Si la foto ya usa casi todo el rango, no hay nada que estirar.
    // Forzarlo solo la dejaría dura y con los colores quemados.
    if (alto_ - bajo < 40 || (bajo < 12 && alto_ > 243)) return;

    const rango = alto_ - bajo;
    const tabla = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      tabla[v] = Math.max(0, Math.min(255, Math.round(((v - bajo) / rango) * 255)));
    }
    for (let i = 0; i < px.length; i += 4) {
      px[i]     = tabla[px[i]];
      px[i + 1] = tabla[px[i + 1]];
      px[i + 2] = tabla[px[i + 2]];
    }
    pincel.putImageData(imagen, 0, 0);
  }

  const aBlob = lienzo => new Promise(resolver => {
    if (lienzo.toBlob) lienzo.toBlob(b => resolver(b), 'image/jpeg', CALIDAD);
    else resolver(desdeDataUrl(lienzo.toDataURL('image/jpeg', CALIDAD)));
  });

  /** Para navegadores viejos sin toBlob. */
  function desdeDataUrl(url) {
    const [cabecera, datos] = url.split(',');
    const tipo = cabecera.match(/:(.*?);/)[1];
    const crudo = atob(datos);
    const bytes = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  /** Cuánto pesa algo, en palabras. */
  const peso = bytes => bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return { mejorar, peso, LADO };
})();
