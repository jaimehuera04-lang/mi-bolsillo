/**
 * Genera los iconos PNG de la app sin depender de librerias externas.
 * Uso:  node herramientas/generar-iconos.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SALIDA = path.join(__dirname, '..', 'iconos');

function crc32(buf) {
  let c, tabla = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = tabla[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, pixeles /* Uint8Array RGBA */) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8;   // bits por canal
  cabecera[9] = 6;   // RGBA
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0; // filtro "none"
    pixeles.copy
      ? pixeles.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4)
      : Buffer.from(pixeles.slice(y * ancho * 4, (y + 1) * ancho * 4)).copy(filas, y * (ancho * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', cabecera),
    chunk('IDAT', zlib.deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dibujo: monedita/billetera sobre degradado verde ---
function dibujar(tam, margenSeguro) {
  const buf = Buffer.alloc(tam * tam * 4);
  const escala = tam / 512;
  // el area útil se encoge cuando el icono es "maskable" (Android recorta los bordes)
  const k = margenSeguro ? 0.72 : 1;
  const cx = tam / 2, cy = tam / 2;

  const dentroRect = (x, y, rx, ry, w, h, r) => {
    if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
    const dx = Math.min(x - rx, rx + w - x);
    const dy = Math.min(y - ry, ry + h - y);
    if (dx > r || dy > r) return true;
    return (r - dx) ** 2 + (r - dy) ** 2 <= r * r;
  };

  // geometria de la billetera (en coords de 512, luego escalada)
  const bw = 300 * escala * k, bh = 216 * escala * k;
  const bx = cx - bw / 2, by = cy - bh / 2 + 8 * escala * k;
  const radio = 46 * escala * k;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const i = (y * tam + x) * 4;
      // fondo degradado diagonal
      const t = (x / tam + y / tam) / 2;
      let r = Math.round(16 + t * 6);
      let g = Math.round(160 - t * 42);
      let b = Math.round(114 - t * 20);
      let a = 255;

      if (!margenSeguro) {
        // esquinas redondeadas para el icono normal
        if (!dentroRect(x, y, 0, 0, tam - 1, tam - 1, tam * 0.22)) a = 0;
      }

      // cuerpo blanco de la billetera
      if (dentroRect(x, y, bx, by, bw, bh, radio)) {
        r = 255; g = 255; b = 255;
        // solapa superior más clara
        if (y < by + 60 * escala * k) { r = 236; g = 253; b = 245; }
        // broche circular
        const dcx = bx + bw - 62 * escala * k, dcy = by + bh / 2;
        const dist = Math.hypot(x - dcx, y - dcy);
        if (dist < 30 * escala * k) { r = 16; g = 160; b = 114; }
        if (dist < 13 * escala * k) { r = 255; g = 255; b = 255; }
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return png(tam, tam, buf);
}

fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, 'icono-192.png'), dibujar(192, false));
fs.writeFileSync(path.join(SALIDA, 'icono-512.png'), dibujar(512, false));
fs.writeFileSync(path.join(SALIDA, 'icono-maskable-512.png'), dibujar(512, true));
console.log('Iconos generados en /iconos');
