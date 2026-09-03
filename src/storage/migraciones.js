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

  /* ------------------------------------------------------------
     Esquema 2 -> 3  (septiembre 2026)

     Que cambia:
       - Cada movimiento gana 'adjuntos': la lista de respaldos
         (la foto de la boleta, el PDF del comprobante).

     Es el salto más chico que hemos hecho, y aun así lleva
     migración propia: un movimiento viejo sin la llave 'adjuntos'
     obligaría a preguntar "¿y si no existe?" en cada línea de la
     pantalla. Mejor que todos tengan la lista, aunque venga vacía.

     Ojo con lo que NO se toca: los archivos mismos viven en
     IndexedDB, no en el estado. Acá no hay nada que mover, solo la
     lista de fichas, que para los movimientos viejos está vacía
     porque cuando se anotaron no existían los respaldos.
     ------------------------------------------------------------ */
  function migrate_2_a_3(viejo) {
    const nuevo = { ...viejo };
    nuevo.movimientos = (viejo.movimientos || []).map(m => ({
      ...m,
      adjuntos: Array.isArray(m.adjuntos) ? m.adjuntos : [],
    }));
    nuevo.meta = { ...(viejo.meta || {}), schemaVersion: 3 };
    return nuevo;
  }

  /* ------------------------------------------------------------
     Esquema 3 -> 4  (septiembre 2026)

     Que cambia:
       - Aparece el cajón 'negocio' completo, con su perfil, sus
         productos, clientes, proveedores, empleados, ventas,
         compras, cotizaciones, libro de stock y retiros.

     Nace APAGADO (negocio.activo = false). Quien solo lleva sus
     finanzas personales no ve absolutamente ningún cambio: la
     pestaña Negocio no aparece hasta que la enciende en Ajustes.

     Lo que NO se toca, y es a propósito: ni un movimiento, ni una
     cuenta, ni una meta. La plata del negocio es un mundo aparte
     del sueldo libre; lo único que los une es el retiro, y ese lo
     crea la persona cuando se paga a sí misma.

     Se copia campo por campo en vez de hacer { ...nuevo, ...viejo }
     para que un negocio a medio llenar de una versión anterior no
     entre sin las llaves que se agregaron después.
     ------------------------------------------------------------ */
  function migrate_3_a_4(viejo) {
    const nuevo = { ...viejo };
    const base = Esquema.negocioNuevo();
    const previo = viejo.negocio || {};

    nuevo.negocio = {
      ...base,
      ...previo,
      perfil:  { ...base.perfil,  ...(previo.perfil  || {}) },
      ajustes: {
        ...base.ajustes,
        ...(previo.ajustes || {}),
        catalogo: { ...base.ajustes.catalogo, ...((previo.ajustes || {}).catalogo || {}) },
      },
    };
    // Las listas: si venían de otra parte se respetan, si no, vacías.
    ['productos', 'clientes', 'proveedores', 'empleados',
     'ventas', 'compras', 'cotizaciones', 'stock', 'retiros'].forEach(lista => {
      nuevo.negocio[lista] = Array.isArray(previo[lista]) ? previo[lista] : [];
    });

    nuevo.meta = { ...(viejo.meta || {}), schemaVersion: 4 };
    return nuevo;
  }

  /* La cadena. Para agregar el esquema 5, se suma una línea aquí. */
  const CADENA = {
    1: migrate_1_a_2,
    2: migrate_2_a_3,
    3: migrate_3_a_4,
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
        throw new Error(`No sé cómo pasar del esquema ${v} al ${v + 1}.`);
      }
      actual = paso(actual);
      v++;
    }

    // Un archivo de una versión MÁS nueva que esta app: no se toca.
    if (desde > Esquema.VERSION_ESQUEMA) {
      throw new Error(
        'Ese respaldo viene de una versión más nueva de Mi Bolsillo. Actualiza la app antes de restaurarlo.'
      );
    }

    return { estado: actual, desde, hasta: v, migro: desde !== v };
  }

  return { aplicar, versionDe, migrate_1_a_2, migrate_2_a_3, migrate_3_a_4 };
})();
