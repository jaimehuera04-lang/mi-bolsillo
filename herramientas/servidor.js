/* ============================================================
   servidor.js - Servidor local para probar la app.
   No necesita instalar nada: solo Node.
   Uso:  node herramientas/servidor.js
   Luego abre http://localhost:5173 en el navegador.
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = process.env.PUERTO || 5173;
const RAIZ = path.join(__dirname, '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer((peticion, respuesta) => {
  let ruta = decodeURIComponent(peticion.url.split('?')[0]);
  if (ruta === '/') ruta = '/index.html';

  const archivo = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));

  // no dejamos salir de la carpeta del proyecto
  if (!archivo.startsWith(RAIZ)) {
    respuesta.writeHead(403).end('Prohibido');
    return;
  }

  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      respuesta.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      respuesta.end('<h1>404</h1><p>No encontre ese archivo.</p>');
      return;
    }
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    respuesta.end(contenido);
  });
}).listen(PUERTO, () => {
  console.log(`Mi Bolsillo corriendo en http://localhost:${PUERTO}`);
});
