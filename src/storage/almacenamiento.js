/* ============================================================
   src/storage/almacenamiento.js
   Leer y escribir en el dispositivo. Nada mas.
   No calcula (eso es /src/core) y no dibuja (eso es /src/ui).

   Lo delicado de este archivo es el arranque, porque es el único
   momento en que se pueden perder datos. El orden es siempre:
     1. leer lo que hay
     2. si esta viejo, GUARDAR UN RESPALDO
     3. migrar en memoria
     4. escribir el resultado de una sola vez
   Si el paso 4 falla, lo viejo sigue intacto donde estaba.
   ============================================================ */

const Almacenamiento = (() => {

  let estado = null;
  let hayEspacio = true;          // false si el navegador nos bloqueo la escritura

  /* Que paso en el último arranque. La interfaz lo usa para avisar. */
  const arranque = {
    migro: false,
    desde: null,
    hasta: null,
    respaldoGuardado: false,
    error: '',
  };

  /* ---------- Lectura y escritura crudas ---------- */
  function leerCrudo(llave) {
    try {
      return localStorage.getItem(llave);
    } catch (e) {
      return null;
    }
  }

  function escribirCrudo(llave, texto) {
    try {
      localStorage.setItem(llave, texto);
      return true;
    } catch (e) {
      hayEspacio = false;
      console.error('No se pudo escribir en este dispositivo.', e);
      return false;
    }
  }

  /* ---------- Guardar ---------- */
  function guardar() {
    const ok = escribirCrudo(Esquema.LLAVE, JSON.stringify(estado));
    if (!ok) {
      arranque.error = 'No pudimos guardar en este dispositivo. '
        + 'Suele pasar en modo incognito o cuando la memoria del navegador esta llena. '
        + 'Descarga una copia de seguridad antes de cerrar.';
    }
    return ok;
  }

  const obtener = () => estado;
  const puedeGuardar = () => hayEspacio;
  const estadoDelArranque = () => ({ ...arranque });

  /* ---------- Arranque ---------- */
  function cargar() {
    // 1. Buscamos primero la llave actual; si no esta, la del esquema 1.
    let crudo = leerCrudo(Esquema.LLAVE);
    let veniaDeLlaveVieja = false;

    if (!crudo) {
      crudo = leerCrudo(Esquema.LLAVE_VIEJA);
      veniaDeLlaveVieja = Boolean(crudo);
    }

    // 2. Instalación nueva: estado limpio con su cuenta por defecto.
    if (!crudo) {
      estado = Esquema.estadoNuevo();
      estado.cuentas = [Esquema.cuentaPorDefecto()];
      guardar();
      return estado;
    }

    // 3. Leemos. Si el JSON esta roto NO borramos nada: dejamos el texto
    //    donde esta para poder rescatarlo a mano y partimos de cero.
    let guardado;
    try {
      guardado = JSON.parse(crudo);
    } catch (e) {
      console.error('Los datos guardados no se pudieron leer.', e);
      arranque.error = 'No pudimos leer tus datos guardados. '
        + 'No los borramos: siguen en este dispositivo. Escríbenos antes de anotar cosas nuevas.';
      estado = Esquema.estadoNuevo();
      estado.cuentas = [Esquema.cuentaPorDefecto()];
      return estado;
    }

    // 4. Si hay que migrar, primero el respaldo. Siempre, sin excepción.
    const version = Migraciones.versionDe(guardado);
    if (version !== Esquema.VERSION_ESQUEMA) {
      arranque.respaldoGuardado = escribirCrudo(Esquema.LLAVE_RESPALDO, crudo);

      if (!arranque.respaldoGuardado) {
        // Sin respaldo no migramos. Preferimos una app que no arranca
        // a una app que arranca habiendo perdido los datos de alguien.
        arranque.error = 'No pudimos guardar una copia de seguridad antes de actualizar tus datos, '
          + 'así que no los tocamos. Libera espacio en el navegador y vuelve a abrir la app.';
        estado = normalizar(guardado);
        return estado;
      }

      try {
        const r = Migraciones.aplicar(guardado);
        estado = normalizar(r.estado);
        arranque.migro = r.migro;
        arranque.desde = r.desde;
        arranque.hasta = r.hasta;
        guardar();                       // se escribe entero, de una sola vez
        if (veniaDeLlaveVieja) {
          // La llave antigua se deja donde esta hasta la próxima apertura:
          // si algo salio mal, todavía se puede recuperar a mano.
        }
      } catch (e) {
        console.error('Fallo la migración.', e);
        arranque.error = e.message || 'No pudimos actualizar el formato de tus datos.';
        estado = normalizar(guardado);
      }
      return estado;
    }

    estado = normalizar(guardado);
    return estado;
  }

  /**
   * Rellena las llaves que falten sin pisar las que vienen.
   * Es un cinturón de seguridad, no un reemplazo de las migraciones:
   * aquí solo se agregan cajones vacíos, nunca se transforma nada.
   */
  function normalizar(entrante) {
    const base = Esquema.estadoNuevo();
    const salida = {
      ...base,
      ...entrante,
      meta:    { ...base.meta,    ...(entrante.meta || {}) },
      ajustes: { ...base.ajustes, ...(entrante.ajustes || {}) },
      presupuestos: { ...(entrante.presupuestos || {}) },
    };
    for (const lista of ['cuentas', 'movimientos', 'compromisos',
                         'ingresosPrevistos', 'estacionales', 'simulaciones', 'metas']) {
      if (!Array.isArray(salida[lista])) salida[lista] = [];
    }
    // Nadie puede quedarse sin ninguna cuenta: los movimientos quedarían sueltos.
    if (!salida.cuentas.length) salida.cuentas = [Esquema.cuentaPorDefecto()];
    return salida;
  }

  /* ---------- Copia de seguridad ---------- */
  function exportar() {
    return JSON.stringify(estado, null, 2);
  }

  /** El respaldo automático que se guardo antes de migrar, o null. */
  const respaldoPrevio = () => leerCrudo(Esquema.LLAVE_RESPALDO);

  /**
   * Restaura un archivo. Valida antes de tocar nada y lo pasa por la
   * misma cadena de migraciones que los datos locales, para que un
   * respaldo de hace seis meses entre igual de bien que uno de ayer.
   */
  function importar(textoJson) {
    let entrante;
    try {
      entrante = JSON.parse(textoJson);
    } catch (e) {
      throw new Error('Ese archivo no es un respaldo de Mi Bolsillo.');
    }
    if (!entrante || typeof entrante !== 'object' || Array.isArray(entrante)) {
      throw new Error('Ese archivo no es un respaldo de Mi Bolsillo.');
    }
    if (!Array.isArray(entrante.movimientos)) {
      throw new Error('Ese archivo no tiene la lista de movimientos, así que no es un respaldo valido.');
    }

    const r = Migraciones.aplicar(entrante);   // tira error si viene del futuro
    estado = normalizar(r.estado);
    guardar();
    return { estado, migro: r.migro, desde: r.desde };
  }

  function borrarTodo() {
    estado = Esquema.estadoNuevo();
    estado.cuentas = [Esquema.cuentaPorDefecto()];
    guardar();
    try {
      localStorage.removeItem(Esquema.LLAVE_VIEJA);
      localStorage.removeItem(Esquema.LLAVE_RESPALDO);
    } catch (e) { /* si no se puede, tampoco es grave */ }
    return estado;
  }

  /** Deja constancia de que el usuario descargo una copia. */
  function marcarRespaldo() {
    estado.meta.ultimoRespaldo = Fechas.hoyISO();
    guardar();
  }

  return {
    cargar, guardar, obtener, puedeGuardar, estadoDelArranque,
    exportar, importar, borrarTodo, respaldoPrevio, marcarRespaldo,
  };
})();
