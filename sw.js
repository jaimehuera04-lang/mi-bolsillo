/* ============================================================
   sw.js - "Service Worker"
   Es un ayudante que corre en segundo plano y guarda una copia
   de la app en el celular. Gracias a el, Mi Bolsillo abre aunque
   estes sin internet.

   IMPORTANTE: cuando cambies archivos, sube el número de VERSIÓN.
   Así el celular sabe que tiene que bajar la versión nueva.
   ============================================================ */

const VERSION = 'mi-bolsillo-v10';

const ARCHIVOS = [
  './',
  './index.html',
  './src/ui/estilos.css',
  './src/config-nube.js',
  './src/data/categorias.js',
  './src/data/tecnicas.js',
  './src/core/fechas.js',
  './src/core/dinero.js',
  './src/core/calculos.js',
  './src/core/sugerencias.js',
  './src/storage/esquema.js',
  './src/storage/migraciones.js',
  './src/storage/almacenamiento.js',
  './src/storage/nube.js',
  './src/datos.js',
  './src/ui/dialogos.js',
  './src/ui/excel.js',
  './src/ui/graficos.js',
  './src/ui/app.js',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

// 1. Al instalar: guardamos una copia de todo
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

// 2. Al activarse: borramos las copias viejas
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(
        nombres.filter(n => n !== VERSION).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. Al pedir un archivo: primero intentamos la red (así ves los
//    cambios al tiro cuando estás desarrollando) y si no hay
//    internet, servimos la copia guardada.
self.addEventListener('fetch', evento => {
  if (evento.request.method !== 'GET') return;

  // SOLO nos hacemos cargo de los archivos de la app.
  //
  // Esto no es un detalle: cuando este ayudante atendía TODO, también
  // atendía las consultas a la nube y las respondía con una copia
  // guardada. La app entonces creía que la nube estaba vacía y le
  // pasaba por encima con los datos de este teléfono. Todo lo que no
  // sea de nuestro propio sitio pasa derecho al navegador.
  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(evento.request)
      .then(respuesta => {
        // una respuesta con error no merece quedar guardada
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then(cache => cache.put(evento.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(evento.request).then(r => r || caches.match('./index.html')))
  );
});
