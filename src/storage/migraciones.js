/* ============================================================
   src/storage/migraciones.js
   Como pasan los datos de un esquema al siguiente sin perder nada.

   Reglas de la casa:
     - Cada salto es una función explícita migrate_N_a_N+1.
     - Se aplican en cadena: del 1 al 2, del 2 al 3, etc.
     - NUNCA se borra información. Si un campo cambia de nombre,
       se copia al nuevo; si algo sobra, se deja quieto.
     - Antes de correr la cadena, quien llama tiene que haber
       guardado un respaldo (de eso se encarga almacenamiento.js).
   ============================================================ */

const Migraciones = (() => {

  /* ------------------------------------------------------------
     Esquema 1 -> 2  (agosto 2026)

     Que cambia:
       - Aparecen las CUENTAS. Todo movimiento viejo queda apuntando
         a una cuenta única llamada "Mi cuenta", así ningún peso
         queda huérfano.
       - Los movimientos ganan cuentaOrigen / cuentaDestino,
         descripción, etiquetas, subcategoría y compromisoId.
       - Las metas renombran objetivo -> montoObjetivo y
         ahorrado -> montoActual.
       - Se abren los cajones vacíos de compromisos, ingresos
         previstos, estacionales y simulaciones (Fase 2).
       - El ingreso esperado de ajustes se convierte en el primer
         ingreso previsto, para que el sueldo libre tenga con que
         calcular desde el día uno.
       - Se va la moneda: Mi Bolsillo es solo CLP.
     ------------------------------------------------------------ */
  function migrate_1_a_2(viejo) {
    const nuevo = Esquema.estadoNuevo();
    const cuenta = Esquema.cuentaPorDefecto();
    nuevo.cuentas = [cuenta];

    // --- Movimientos: se conservan tal cual y se les asigna la cuenta ---
    nuevo.movimientos = (viejo.movimientos || []).map(m => ({
      id: m.id || Esquema.nuevoId(),
      tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',   // en el esquema 1 no había transferencias
      monto: Dinero.entero(m.monto),
      fecha: m.fecha,
      categoria: m.categoria,
      subcategoria: null,
      cuentaOrigen:  m.tipo === 'ingreso' ? null : cuenta.id,
      cuentaDestino: m.tipo === 'ingreso' ? cuenta.id : null,
      descripcion: '',
      nota: m.nota || '',
      etiquetas: [],
      compromisoId: null,
      creado: m.creado || new Date().toISOString(),
    }));

    // --- Metas: mismos números, nombres nuevos ---
    nuevo.metas = (viejo.metas || []).map(m => ({
      id: m.id || Esquema.nuevoId(),
      nombre: m.nombre,
      montoObjetivo: Dinero.entero(m.objetivo ?? m.montoObjetivo),
      montoActual:   Dinero.entero(m.ahorrado ?? m.montoActual),
      fechaObjetivo: m.fechaLimite || m.fechaObjetivo || '',
      aporteMensual: 0,
      cuenta: cuenta.id,
      emoji: m.emoji || '🎯',
      creada: m.creada || Fechas.hoyISO(),
    }));

    // --- Topes y ajustes: pasan igual ---
    nuevo.presupuestos = { ...(viejo.presupuestos || {}) };
    const a = viejo.ajustes || {};
    nuevo.ajustes = {
      ...nuevo.ajustes,
      correo: a.correo || '',
      registrado: Boolean(a.registrado),
      nombre: a.nombre || '',
      ingresoEsperado: Dinero.entero(a.ingresoEsperado),
      tutorialVisto: Boolean(a.tutorialVisto),
    };

    // --- El ingreso esperado se vuelve el primer ingreso previsto ---
    if (nuevo.ajustes.ingresoEsperado > 0) {
      nuevo.ingresosPrevistos = [{
        id: Esquema.nuevoId(),
        nombre: 'Sueldo',
        monto: nuevo.ajustes.ingresoEsperado,
        frecuencia: 'mensual',
        diaDelMes: 1,
        activo: true,
      }];
    }

    nuevo.meta.creado = (viejo.meta && viejo.meta.creado) || Fechas.hoyISO();
    nuevo.meta.schemaVersion = 2;
    return nuevo;
  }

  /* La cadena. Para agregar el esquema 3, se suma una línea aquí. */
  const CADENA = {
    1: migrate_1_a_2,
  };

  /** Que versión tiene este objeto. El esquema 1 usaba 'versión' suelto. */
  function versionDe(estado) {
    if (estado && estado.meta && Number(estado.meta.schemaVersion)) {
      return Number(estado.meta.schemaVersion);
    }
    return Number((estado && estado.version) || 1);
  }

  /**
   * Lleva cualquier estado hasta la versión actual.
   * Devuelve { estado, desde, hasta, migro } para que quien llama
   * sepa si hubo cambios y pueda avisarle al usuario.
   */
  function aplicar(estado) {
    let actual = estado;
    const desde = versionDe(actual);
    let v = desde;

    while (v < Esquema.VERSION_ESQUEMA) {
      const paso = CADENA[v];
      if (!paso) {
        throw new Error(`No se como pasar del esquema ${v} al ${v + 1}.`);
      }
      actual = paso(actual);
      v++;
    }

    // Un archivo de una versión MAS nueva que esta app: no se toca.
    if (desde > Esquema.VERSION_ESQUEMA) {
      throw new Error(
        'Ese respaldo viene de una versión mas nueva de Mi Bolsillo. Actualiza la app antes de restaurarlo.'
      );
    }

    return { estado: actual, desde, hasta: v, migro: desde !== v };
  }

  return { aplicar, versionDe, migrate_1_a_2 };
})();
