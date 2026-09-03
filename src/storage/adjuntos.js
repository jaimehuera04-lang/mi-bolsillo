/* ============================================================
   src/storage/adjuntos.js
   Donde viven las fotos y los archivos que respaldan un movimiento.

   Por qué NO van en localStorage, que es donde vive todo lo demás:
   localStorage guarda texto y suele topar en 5 MB. Una sola foto de
   celular pesa 3 MB. Con dos boletas la app se queda sin espacio y
   deja de poder guardar TUS MOVIMIENTOS, que es lo que de verdad
   importa. Así que los archivos van en IndexedDB, que es la bodega
   grande del navegador, y el estado solo guarda una ficha:
   { id, nombre, tipo, tamano }.

   Por qué tampoco van a la nube: el estado que sube a Supabase es un
   JSON. Meter fotos ahí lo haría enorme y, sobre todo, mandaría el
   nombre del comercio, tu tarjeta y la hora de cada compra a un
   servidor. La decisión de ARQUITECTURA.md es que eso no sale del
   teléfono. Consecuencia honesta y hay que decirla en pantalla: los
   respaldos se quedan en el aparato donde los sacaste.

   Todo lo de acá devuelve promesas y NUNCA tira un error hacia
   arriba: si el navegador no deja abrir la bodega (modo incógnito de
   Safari, por ejemplo), la app tiene que seguir funcionando sin
   respaldos, no caerse.
   ============================================================ */

const Adjuntos = (() => {

  const BASE = 'mi-bolsillo-adjuntos';
  const VERSION = 1;
  const BODEGA = 'archivos';

  /* 8 MB por archivo. Una foto ya comprimida por archivos.js pesa
     entre 100 y 400 KB; este tope es para el PDF gigante que alguien
     va a intentar subir alguna vez. */
  const MAXIMO_POR_ARCHIVO = 8 * 1024 * 1024;

  let promesaBase = null;
  let sirve = true;

  function abrir() {
    if (promesaBase) return promesaBase;

    promesaBase = new Promise(resolver => {
      if (typeof indexedDB === 'undefined') { sirve = false; return resolver(null); }
      let peticion;
      try {
        peticion = indexedDB.open(BASE, VERSION);
      } catch (e) {
        sirve = false;
        return resolver(null);
      }

      peticion.onupgradeneeded = () => {
        const base = peticion.result;
        if (!base.objectStoreNames.contains(BODEGA)) {
          const bodega = base.createObjectStore(BODEGA, { keyPath: 'id' });
          // para poder pedir "todos los adjuntos de este movimiento"
          bodega.createIndex('movimientoId', 'movimientoId', { unique: false });
        }
      };
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => { sirve = false; resolver(null); };

      // 'blocked' pasa cuando otra pestaña tiene la base abierta y algo
      // pide borrarla o cambiarle la versión: la nuestra queda esperando
      // a que la otra la suelte, y puede no soltarla nunca.
      peticion.onblocked = () => { sirve = false; resolver(null); };

      // Y el caso feo: ni onsuccess, ni onerror, ni onblocked. La bodega
      // simplemente no contesta. Sin este tope, promesaBase queda colgada
      // para siempre y CADA intento posterior se queda esperándola.
      setTimeout(() => { sirve = false; resolver(null); }, 12000);
      peticion.onblocked = () => { sirve = false; resolver(null); };
    });

    return promesaBase;
  }

  /** Corre una operación dentro de una transacción. Devuelve porDefecto si algo falla. */
  /* Cuánto esperamos a la bodega antes de rendirnos, en milisegundos.
     IndexedDB normalmente responde en milisegundos, pero puede quedarse
     callada para siempre: basta que otra pestaña tenga la base abierta
     mientras algo intenta borrarla, y entonces ni responde ni falla.
     Sin este tope, la pantalla se quedaba con el botón en "Leyendo…"
     y no había forma de salir más que cerrar la app. Es mejor decir
     "no pudimos guardar el respaldo" que dejar a alguien esperando. */
  const PACIENCIA = 12000;

  function conPaciencia(promesa, porDefecto) {
    return Promise.race([
      promesa,
      new Promise(resolver => setTimeout(() => resolver(porDefecto), PACIENCIA)),
    ]);
  }

  function conBodega(modo, trabajo, porDefecto) {
    return conPaciencia(hacerEnBodega(modo, trabajo, porDefecto), porDefecto);
  }

  function hacerEnBodega(modo, trabajo, porDefecto) {
    return abrir().then(base => {
      if (!base) return porDefecto;
      return new Promise(resolver => {
        let transaccion;
        try {
          transaccion = base.transaction(BODEGA, modo);
        } catch (e) {
          return resolver(porDefecto);
        }
        const bodega = transaccion.objectStore(BODEGA);
        let resultado = porDefecto;
        try {
          trabajo(bodega, valor => { resultado = valor; });
        } catch (e) {
          return resolver(porDefecto);
        }
        transaccion.oncomplete = () => resolver(resultado);
        transaccion.onerror = () => resolver(porDefecto);
        transaccion.onabort = () => resolver(porDefecto);
      });
    }).catch(() => porDefecto);
  }

  /** false cuando el navegador no nos deja guardar archivos. */
  const disponible = () => sirve;

  /** La ficha que sí va al estado guardado: liviana y sin el archivo. */
  const ficha = r => ({ id: r.id, nombre: r.nombre, tipo: r.tipo, tamano: r.tamano });

  /**
   * Guarda un archivo y devuelve su ficha, o null si no se pudo.
   * @param {{id, movimientoId, nombre, tipo, blob}} registro
   */
  function guardar({ id, movimientoId, nombre, tipo, blob }) {
    if (!blob || blob.size > MAXIMO_POR_ARCHIVO) return Promise.resolve(null);
    const registro = {
      id,
      movimientoId: movimientoId || '',
      nombre: String(nombre || 'archivo'),
      tipo: tipo || blob.type || 'application/octet-stream',
      tamano: blob.size,
      creado: new Date().toISOString(),
      blob,
    };
    return conBodega('readwrite', bodega => { bodega.put(registro); }, null)
      .then(() => ficha(registro));
  }

  /** El archivo completo, con su blob, o null si acá no está. */
  function obtener(id) {
    return conBodega('readonly', (bodega, devolver) => {
      const p = bodega.get(id);
      p.onsuccess = () => devolver(p.result || null);
    }, null);
  }

  /** Le pone (o le cambia) el movimiento dueño a un archivo ya guardado. */
  function asignarMovimiento(id, movimientoId) {
    return conBodega('readwrite', bodega => {
      const p = bodega.get(id);
      p.onsuccess = () => {
        const r = p.result;
        if (!r) return;
        r.movimientoId = movimientoId;
        bodega.put(r);
      };
    }, false).then(() => true);
  }

  function borrar(id) {
    return conBodega('readwrite', bodega => { bodega.delete(id); }, false).then(() => true);
  }

  function borrarDeMovimiento(movimientoId) {
    return conBodega('readwrite', bodega => {
      const indice = bodega.index('movimientoId');
      const p = indice.openKeyCursor(IDBKeyRange.only(movimientoId));
      p.onsuccess = () => {
        const cursor = p.result;
        if (!cursor) return;
        bodega.delete(cursor.primaryKey);
        cursor.continue();
      };
    }, false).then(() => true);
  }

  /**
   * De una lista de ids, cuáles están de verdad en ESTE aparato.
   * Lo usa la pantalla para no mostrar una foto rota cuando el
   * movimiento llegó por la nube desde otro teléfono.
   */
  function cuales(ids) {
    const pedidos = (ids || []).filter(Boolean);
    if (!pedidos.length) return Promise.resolve(new Set());
    return conBodega('readonly', (bodega, devolver) => {
      const encontrados = new Set();
      let faltan = pedidos.length;
      for (const id of pedidos) {
        const p = bodega.getKey(id);
        p.onsuccess = () => {
          if (p.result !== undefined) encontrados.add(id);
          if (--faltan === 0) devolver(encontrados);
        };
      }
    }, new Set());
  }

  /** Cuánto ocupan los respaldos en este aparato. Se muestra en Ajustes. */
  function peso() {
    return conBodega('readonly', (bodega, devolver) => {
      let cantidad = 0;
      let bytes = 0;
      const p = bodega.openCursor();
      p.onsuccess = () => {
        const cursor = p.result;
        if (!cursor) return devolver({ cantidad, bytes });
        cantidad++;
        bytes += Number(cursor.value.tamano) || 0;
        cursor.continue();
      };
    }, { cantidad: 0, bytes: 0 });
  }

  /**
   * Borra los archivos que ya no le pertenecen a ningún movimiento.
   * Pasa cuando borras un movimiento sin internet, o cuando adjuntas
   * algo y después cierras la ventana sin guardar.
   * @param {Set<string>} idsVivos los ids que todavía figuran en el estado
   */
  function limpiar(idsVivos) {
    const vivos = idsVivos instanceof Set ? idsVivos : new Set(idsVivos || []);
    return conBodega('readwrite', (bodega, devolver) => {
      let borrados = 0;
      const p = bodega.openCursor();
      p.onsuccess = () => {
        const cursor = p.result;
        if (!cursor) return devolver(borrados);
        if (!vivos.has(cursor.value.id)) { bodega.delete(cursor.primaryKey); borrados++; }
        cursor.continue();
      };
    }, 0);
  }

  /** Se lleva todo. La usa "Borrar todos mis datos" de Ajustes. */
  function borrarTodo() {
    return conBodega('readwrite', bodega => { bodega.clear(); }, false).then(() => true);
  }

  return {
    MAXIMO_POR_ARCHIVO,
    disponible, guardar, obtener, asignarMovimiento,
    borrar, borrarDeMovimiento, cuales, peso, limpiar, borrarTodo,
  };
})();
