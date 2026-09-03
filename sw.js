/* ============================================================
   sw.js - "Service Worker"
   Es un ayudante que corre en segundo plano y guarda una copia
   de la app en el celular. Gracias a el, Mi Bolsillo abre aunque
   estes sin internet.

   IMPORTANTE: cuando cambies archivos, sube el número de VERSIÓN.
   Así el celular sabe que tiene que bajar la versión nueva.
   ============================================================ */

const VERSION = 'mi-bolsillo-v23';

const ARCHIVOS = [
  './',
  './index.html',
  './src/ui/estilos.css',
  './src/ui/sueldo.css',
  './src/ui/negocio.css',
  './src/config-nube.js',
  './src/data/categorias.js',
  './src/data/tecnicas.js',
  './src/data/pistas.js',
  './src/data/estacionales.js',
  './src/core/fechas.js',
  './src/core/dinero.js',
  './src/core/calculos.js',
  './src/core/sugerencias.js',
  './src/core/lector.js',
  './src/core/sueldo.js',
  './src/core/negocio.js',
  './src/storage/esquema.js',
  './src/storage/migraciones.js',
  './src/storage/almacenamiento.js',
  './src/storage/adjuntos.js',
  './src/storage/nube.js',
  './src/datos.js',
  './src/datos-negocio.js',
  './src/ui/dialogos.js',
  './src/ui/archivos.js',
  './src/ui/excel.js',
  './src/ui/graficos.js',
  './src/ui/ocr.js',
  './src/ui/sueldo.js',
  './src/ui/fotos.js',
  './src/ui/catalogo.js',
  './src/ui/reportes.js',
  './src/ui/negocio.js',
  './src/ui/app.js',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

// 1. Al instalar: guardamos una copia de todo
//
// El "cache: 'reload'" de acá abajo no es un adorno, y costó encontrarlo:
// cache.addAll() pide los archivos pasando por la caché normal del
// navegador, y GitHub Pages los manda con "max-age=600". O sea que
// durante diez minutos después de publicar, el ayudante guarda la
// versión NUEVA bajo el nombre nuevo... con el contenido VIEJO adentro.
// Subir la VERSIÓN de arriba no sirve de nada si pasa eso: el celular
// se queda con el diseño anterior y no hay forma de darse cuenta.
// Con 'reload' cada archivo se pide de nuevo al servidor, sin atajos.
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(ARCHIVOS.map(archivo =>
        fetch(new Request(archivo, { cache: 'reload' }))
          .then(respuesta => {
            // una respuesta con error no se guarda: mejor no tener copia
            // que tener guardada una página de error
            if (respuesta && respuesta.ok) return cache.put(archivo, respuesta);
          })
          // que falte uno no puede impedir que la app se instale
          .catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

// 2. Al activarse: borramos las copias viejas
//
// Menos la del lector de texto. Ese pesa varios megas, no cambia entre
// versiones de la app y la persona ya lo bajó una vez: borrarlo cada
// vez que publicamos un arreglo de una línea sería hacerle gastar
// cinco megas de datos por nada.
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(
        nombres
          .filter(n => n !== VERSION && n !== CACHE_LECTOR)
          .map(n => caches.delete(n))
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

  // ÚNICA excepción a la regla de arriba, y es deliberada: el lector de
  // texto (Tesseract) vive en un CDN y pesa varios megas. Sin guardarlo,
  // cada pantallazo del banco volvería a bajarlo.
  //
  // Es seguro porque son SOLO archivos de programa, iguales para todo
  // el mundo, que nunca llevan datos de nadie. Lo que esta guarda
  // protege —que las consultas a la nube NO se respondan con copias
  // viejas— sigue intacto: cualquier otro origen pasa derecho.
  if (url.origin !== self.location.origin) {
    if (esDelLectorDeTexto(url)) return evento.respondWith(deLaCopiaPrimero(evento.request));
    return;
  }

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

/* ============================================================
   El lector de texto (OCR)

   Vive en un CDN y pesa varios megas entre el motor y el idioma.
   Se guarda con nombre propio y NO se borra al cambiar de versión
   de la app: subir la VERSION de arriba no tiene por qué obligar
   a la persona a bajar cinco megas de nuevo.

   Solo se aceptan estos dos dominios y nada más. Si mañana el
   lector cambia de casa, hay que tocar esta lista a mano, a
   propósito: una lista abierta acá sería una puerta abierta.
   ============================================================ */

const CACHE_LECTOR = 'mi-bolsillo-lector-v1';

const CASAS_DEL_LECTOR = [
  'cdn.jsdelivr.net',            // la librería y su motor
  'tessdata.projectnaptha.com',  // los idiomas
];

function esDelLectorDeTexto(url) {
  if (!CASAS_DEL_LECTOR.includes(url.hostname)) return false;
  // Y dentro de esos dominios, solo lo del lector.
  return /tesseract|tessdata/i.test(url.pathname);
}

/**
 * Primero la copia guardada; si no está, se baja y se guarda.
 * Al revés del resto de la app, que va primero a la red: estos
 * archivos no cambian nunca dentro de una misma versión, así que
 * preguntarle a internet cada vez solo haría esperar a la persona.
 */
function deLaCopiaPrimero(peticion) {
  return caches.open(CACHE_LECTOR).then(cache =>
    cache.match(peticion).then(copia => {
      if (copia) return copia;
      return fetch(peticion).then(respuesta => {
        // 'opaque' es lo que devuelve un CDN sin CORS: se puede
        // guardar y servir, aunque no se pueda mirar por dentro.
        if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) {
          cache.put(peticion, respuesta.clone());
        }
        return respuesta;
      });
    })
  );
}
