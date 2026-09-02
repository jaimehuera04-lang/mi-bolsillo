/* ============================================================
   src/datos.js
   La puerta de entrada. Es lo único que la interfaz conoce.

   Aquí NO hay cuentas matemáticas (esas viven en /src/core) ni
   código de localStorage (ese vive en /src/storage). Este archivo
   solo ordena: válida lo que llega, llama a quien corresponde y
   guarda.
   ============================================================ */

const Datos = (() => {

  const estado = () => Almacenamiento.obtener();

  /* ---------- Arranque ---------- */
  function cargar() {
    const r = Almacenamiento.cargar();
    // La nube se entera de que existimos y le dejamos una forma de
    // pedirnos el objeto completo cuando le toque subir.
    if (typeof Nube !== 'undefined') Nube.iniciar(() => estado());
    // Barrido de respaldos huérfanos: los que quedaron de un formulario
    // que se cerró sin guardar, o de un movimiento borrado en otro
    // aparato. Va sin await, en segundo plano, porque no bloquea nada.
    if (typeof Adjuntos !== 'undefined') Adjuntos.limpiar(idsDeAdjuntosVivos());
    return r;
  }

  /**
   * Guarda en el teléfono y, si hay cuenta, le avisa a la nube.
   * El orden importa: primero el teléfono, que es el que manda para
   * lo inmediato; la nube va después y sin bloquear nada.
   */
  function guardar() {
    const ok = Almacenamiento.guardar();
    if (typeof Nube !== 'undefined') Nube.anotarCambio();
    return ok;
  }
  const obtener = () => estado();
  const arranque = () => Almacenamiento.estadoDelArranque();
  const puedeGuardar = () => Almacenamiento.puedeGuardar();

  /* ---------- Cuentas ---------- */
  function agregarCuenta({ nombre, tipo, saldoInicial, icono }) {
    const limpio = String(nombre || '').trim();
    if (!limpio) throw new Error('Ponle un nombre a la cuenta.');

    const cuenta = {
      id: Esquema.nuevoId(),
      nombre: limpio,
      tipo: tipo || 'cuenta_rut',
      saldoInicial: Dinero.conSigno(saldoInicial),
      icono: icono || Categorias.tipoCuenta(tipo).emoji,
      activa: true,
      fechaCreacion: Fechas.hoyISO(),
    };
    estado().cuentas.push(cuenta);
    guardar();
    return cuenta;
  }

  function editarCuenta(id, { nombre, tipo, saldoInicial, icono }) {
    const c = cuentaPorId(id);
    if (!c) return null;
    if (nombre !== undefined) {
      const limpio = String(nombre).trim();
      if (!limpio) throw new Error('Ponle un nombre a la cuenta.');
      c.nombre = limpio;
    }
    if (tipo !== undefined) c.tipo = tipo;
    if (saldoInicial !== undefined) c.saldoInicial = Dinero.conSigno(saldoInicial);
    if (icono !== undefined) c.icono = icono;
    guardar();
    return c;
  }

  const cuentaPorId = id => estado().cuentas.find(c => c.id === id) || null;
  const cuentasActivas = () => estado().cuentas.filter(c => c.activa !== false);

  /** Cuantos movimientos tocan esta cuenta. Sirve para avisar antes de borrar. */
  const movimientosDeCuenta = id =>
    estado().movimientos.filter(m => m.cuentaOrigen === id || m.cuentaDestino === id).length;

  /** Guardar una cuenta que ya no usas sin borrar su historia. */
  function archivarCuenta(id) {
    const c = cuentaPorId(id);
    if (!c) return null;
    if (cuentasActivas().length <= 1) {
      throw new Error('Necesitas al menos una cuenta activa para poder anotar movimientos.');
    }
    c.activa = false;
    guardar();
    return c;
  }

  function reactivarCuenta(id) {
    const c = cuentaPorId(id);
    if (!c) return null;
    c.activa = true;
    guardar();
    return c;
  }

  /** Solo se puede borrar de verdad una cuenta sin movimientos. */
  function borrarCuenta(id) {
    const usados = movimientosDeCuenta(id);
    if (usados > 0) {
      throw new Error(
        `Esta cuenta tiene ${usados} ${usados === 1 ? 'movimiento' : 'movimientos'} anotados. `
        + 'Si la borraras, esa plata desaparecería de tu historial. Puedes archivarla: deja de aparecer '
        + 'al anotar, pero tus números pasados quedan intactos.'
      );
    }
    if (cuentasActivas().length <= 1) {
      throw new Error('Necesitas al menos una cuenta para poder anotar movimientos.');
    }
    estado().cuentas = estado().cuentas.filter(c => c.id !== id);
    guardar();
  }

  const saldosDeCuentas = () => Calculos.saldosDeCuentas(estado());
  const saldoDeCuenta   = id => Calculos.saldoDeCuenta(estado(), id);
  const patrimonio      = () => Calculos.patrimonio(estado());

  /* ---------- Movimientos ----------
     Un movimiento tiene tres formas posibles:
       ingreso       -> entra plata a cuentaDestino
       gasto         -> sale plata de cuentaOrigen
       transferencia -> sale de una y entra a otra. No es ingreso ni
                        gasto: tu patrimonio queda igual.            */
  function agregarMovimiento({ tipo, monto, categoria, nota, descripcion, fecha,
                               cuentaOrigen, cuentaDestino, compromisoId, adjuntos }) {
    if (!['ingreso', 'gasto', 'transferencia'].includes(tipo)) {
      throw new Error('Tipo de movimiento desconocido.');
    }
    const valor = Dinero.entero(monto);
    if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');

    if (tipo === 'transferencia') {
      if (!cuentaOrigen || !cuentaDestino) {
        throw new Error('Una transferencia necesita una cuenta de origen y una de destino.');
      }
      if (cuentaOrigen === cuentaDestino) {
        throw new Error('El origen y el destino tienen que ser cuentas distintas.');
      }
    } else if (tipo === 'gasto' && !cuentaOrigen) {
      throw new Error('Elige de qué cuenta salió esta plata.');
    } else if (tipo === 'ingreso' && !cuentaDestino) {
      throw new Error('Elige a qué cuenta entró esta plata.');
    }

    const mov = {
      id: Esquema.nuevoId(),
      tipo,
      monto: valor,
      fecha: fecha || Fechas.hoyISO(),
      categoria: tipo === 'transferencia' ? null : categoria,
      subcategoria: null,
      cuentaOrigen:  tipo === 'ingreso' ? null : cuentaOrigen,
      cuentaDestino: tipo === 'gasto'   ? null : cuentaDestino,
      descripcion: (descripcion || '').trim(),
      nota: (nota || '').trim(),
      etiquetas: [],
      compromisoId: compromisoId || null,
      // Solo las fichas: { id, nombre, tipo, tamano }. El archivo mismo
      // ya quedó en IndexedDB antes de llegar acá.
      adjuntos: Array.isArray(adjuntos) ? adjuntos : [],
      creado: new Date().toISOString(),
    };
    estado().movimientos.push(mov);
    guardar();

    // Los archivos se guardaron sueltos mientras la persona llenaba el
    // formulario, sin dueño. Recién ahora sabemos a qué movimiento
    // pertenecen, y sin eso "borrar el movimiento" no sabría qué borrar.
    if (typeof Adjuntos !== 'undefined') {
      for (const a of mov.adjuntos) Adjuntos.asignarMovimiento(a.id, mov.id);
    }
    return mov;
  }

  /**
   * Anota varios de una vez (la cartola del banco).
   * Devuelve { anotados, errores } en vez de tirar el error: si la
   * línea 12 de 40 viene mala, las otras 39 tienen que entrar igual.
   */
  function agregarVarios(lista) {
    const anotados = [];
    const errores = [];
    for (const entrada of (lista || [])) {
      try {
        anotados.push(agregarMovimiento(entrada));
      } catch (e) {
        errores.push({ entrada, mensaje: e.message });
      }
    }
    return { anotados, errores };
  }

  /**
   * ¿Ya está anotado algo así? Mismo día, mismo monto y mismo tipo.
   * Sirve para no duplicar cuando importas la cartola de un mes que ya
   * habías anotado a mano. No es infalible a propósito: dos cafés de
   * $2.500 el mismo día son dos movimientos de verdad, así que esto
   * avisa y deja decidir, nunca descarta solo.
   */
  function movimientoParecido({ tipo, monto, fecha }) {
    const valor = Dinero.entero(monto);
    return estado().movimientos.find(m =>
      m.tipo === tipo && m.monto === valor && m.fecha === fecha) || null;
  }

  function borrarMovimiento(id) {
    const mov = estado().movimientos.find(m => m.id === id);
    estado().movimientos = estado().movimientos.filter(m => m.id !== id);
    guardar();
    // Los respaldos de un movimiento borrado no le sirven a nadie, y una
    // foto olvidada en la bodega ocupa espacio para siempre.
    if (mov && typeof Adjuntos !== 'undefined') Adjuntos.borrarDeMovimiento(id);
  }

  /** Los ids de respaldo que todavía figuran en algún movimiento. */
  function idsDeAdjuntosVivos() {
    const vivos = new Set();
    for (const m of estado().movimientos) {
      for (const a of (m.adjuntos || [])) if (a && a.id) vivos.add(a.id);
    }
    return vivos;
  }

  /** Le cuelga una ficha de respaldo a un movimiento que ya existe. */
  function adjuntarAMovimiento(movimientoId, fichas) {
    const mov = estado().movimientos.find(m => m.id === movimientoId);
    if (!mov) return null;
    if (!Array.isArray(mov.adjuntos)) mov.adjuntos = [];
    mov.adjuntos.push(...fichas);
    guardar();
    if (typeof Adjuntos !== 'undefined') {
      for (const f of fichas) Adjuntos.asignarMovimiento(f.id, movimientoId);
    }
    return mov;
  }

  /** Le quita un respaldo a un movimiento y lo borra de la bodega. */
  function quitarAdjunto(movimientoId, adjuntoId) {
    const mov = estado().movimientos.find(m => m.id === movimientoId);
    if (!mov) return null;
    mov.adjuntos = (mov.adjuntos || []).filter(a => a.id !== adjuntoId);
    guardar();
    if (typeof Adjuntos !== 'undefined') Adjuntos.borrar(adjuntoId);
    return mov;
  }

  /* ---------- Metas de ahorro ---------- */
  function agregarMeta({ nombre, montoObjetivo, emoji, fechaObjetivo, cuenta }) {
    const limpio = String(nombre || '').trim();
    if (!limpio) throw new Error('Ponle un nombre a la meta.');
    const objetivo = Dinero.entero(montoObjetivo);
    if (objetivo <= 0) throw new Error('El monto de la meta tiene que ser mayor que cero.');

    const meta = {
      id: Esquema.nuevoId(),
      nombre: limpio,
      montoObjetivo: objetivo,
      montoActual: 0,
      fechaObjetivo: fechaObjetivo || '',
      aporteMensual: 0,
      cuenta: cuenta || (cuentasActivas()[0] || {}).id || null,
      emoji: emoji || '🎯',
      creada: Fechas.hoyISO(),
    };
    estado().metas.push(meta);
    guardar();
    return meta;
  }

  function abonarMeta(id, monto) {
    const meta = estado().metas.find(m => m.id === id);
    if (!meta) return null;
    meta.montoActual = Math.max(0, meta.montoActual + Dinero.conSigno(monto));
    guardar();
    return meta;
  }

  function borrarMeta(id) {
    estado().metas = estado().metas.filter(m => m.id !== id);
    guardar();
  }

  /* ---------- Topes por categoría ---------- */
  function fijarPresupuesto(categoria, monto) {
    const n = Dinero.entero(monto);
    if (!n) delete estado().presupuestos[categoria];
    else estado().presupuestos[categoria] = n;
    guardar();
  }

  function guardarAjustes(parciales) {
    Object.assign(estado().ajustes, parciales);
    guardar();
  }

  /* ---------- Registro ----------
     Aclaración honesta: esto NO es una cuenta. No hay servidor, ni
     contraseña, ni sincronización. El correo se guarda en este
     dispositivo igual que el resto de los datos.                  */
  const correoValido = correo => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(correo).trim());

  /** De "jaime.huera04@gmail.com" saca "Jaime", para poder saludar. */
  function nombreDesdeCorreo(correo) {
    const usuario = String(correo).split('@')[0] || '';
    const limpio = usuario.split(/[._\-+0-9]+/).filter(Boolean)[0] || '';
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase() : '';
  }

  function registrar(correo) {
    const limpio = String(correo).trim().toLowerCase();
    if (!correoValido(limpio)) throw new Error('correo invalido');
    const a = estado().ajustes;
    a.correo = limpio;
    a.registrado = true;
    a.tutorialVisto = true;          // quien se registra entra directo
    if (!a.nombre) a.nombre = nombreDesdeCorreo(limpio);
    guardar();
    return a;
  }

  const estaRegistrado = () => Boolean(estado().ajustes.registrado && estado().ajustes.correo);

  /* ---------- Consultas (delegan en el motor) ---------- */
  const movimientosDelMes   = (a, m)    => Calculos.movimientosDelMes(estado(), a, m);
  const resumenDelMes       = (a, m)    => Calculos.resumenDelMes(estado(), a, m);
  const gastosPorCategoria  = (a, m)    => Calculos.gastosPorCategoria(estado(), a, m);
  const historialMeses      = (a, m, c) => Calculos.historialMeses(estado(), a, m, c);
  const saldoDiario         = (a, m)    => Calculos.saldoDiario(estado(), a, m);
  const reparto503020       = (a, m)    => Calculos.reparto503020(estado(), a, m);
  const estadoPresupuestos  = (a, m)    => Calculos.estadoPresupuestos(estado(), a, m);
  const gastosHormiga       = (a, m)    => Calculos.gastosHormiga(estado(), a, m);
  const sugerir             = (a, m)    => Sugerencias.sugerir(estado(), a, m);

  /* ---------- Copia de seguridad ---------- */
  const exportar = () => Almacenamiento.exportar();
  const importar = texto => Almacenamiento.importar(texto);
  const marcarRespaldo = () => Almacenamiento.marcarRespaldo();
  const respaldoPrevio = () => Almacenamiento.respaldoPrevio();

  /** Borrar todo es borrar todo: también las fotos de la bodega. */
  function borrarTodo() {
    if (typeof Adjuntos !== 'undefined') Adjuntos.borrarTodo();
    return Almacenamiento.borrarTodo();
  }

  /* ---------- Datos de ejemplo ----------
     Muestran a propósito los dos casos que más se confunden:
     una compra con tarjeta (gasto) y el pago de esa tarjeta
     (transferencia, no un segundo gasto).                      */
  function cargarEjemplo() {
    const e = estado();
    const hoy = new Date();
    const maxDia = Math.min(hoy.getDate(), 28);
    const dia = n => Fechas.aISO(hoy.getFullYear(), hoy.getMonth(), Math.max(1, Math.min(maxDia, n)));

    const rut = agregarCuenta({ nombre: 'Cuenta RUT', tipo: 'cuenta_rut', saldoInicial: 120000 });
    const cmr = agregarCuenta({ nombre: 'Tarjeta CMR', tipo: 'credito', saldoInicial: 0 });

    const ejemplos = [
      { tipo: 'ingreso', monto: 750000, categoria: 'sueldo',      nota: 'Sueldo del mes', fecha: dia(1),  cuentaDestino: rut.id },
      { tipo: 'gasto',   monto: 320000, categoria: 'vivienda',    nota: 'Arriendo',       fecha: dia(2),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 48000,  categoria: 'servicios',   nota: 'Luz y agua',     fecha: dia(3),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 92000,  categoria: 'comida',      nota: 'Feria y super',  fecha: dia(4),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 12000,  categoria: 'transporte',  nota: 'Bip',            fecha: dia(5),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 8900,   categoria: 'restaurante', nota: 'Almuerzo',       fecha: dia(6),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 6500,   categoria: 'restaurante', nota: 'Cafe',           fecha: dia(7),  cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 9990,   categoria: 'suscripcion', nota: 'Streaming',      fecha: dia(8),  cuentaOrigen: rut.id },
      // Compra con la tarjeta: el gasto se cuenta HOY, aunque la plata salga después
      { tipo: 'gasto',   monto: 78000,  categoria: 'ropa',        nota: 'Zapatillas',     fecha: dia(9),  cuentaOrigen: cmr.id },
      { tipo: 'gasto',   monto: 34000,  categoria: 'ocio',        nota: 'Salida',         fecha: dia(10), cuentaOrigen: rut.id },
      { tipo: 'gasto',   monto: 7200,   categoria: 'restaurante', nota: 'Delivery',       fecha: dia(12), cuentaOrigen: rut.id },
      { tipo: 'ingreso', monto: 60000,  categoria: 'extra',       nota: 'Pololito',       fecha: dia(14), cuentaDestino: rut.id },
      // Pagar la tarjeta NO es un gasto nuevo: es mover plata de una cuenta tuya a otra
      { tipo: 'transferencia', monto: 78000, nota: 'Pago tarjeta CMR', fecha: dia(15), cuentaOrigen: rut.id, cuentaDestino: cmr.id },
    ];

    e.movimientos = [];
    for (const m of ejemplos) agregarMovimiento(m);

    // La cuenta vacía con que venía la app estorba en el ejemplo: se va,
    // pero solo si no tiene ni un movimiento anotado.
    e.cuentas = e.cuentas.filter(c =>
      c.id === rut.id || c.id === cmr.id || movimientosDeCuenta(c.id) > 0);

    e.presupuestos = { comida: 130000, restaurante: 40000, ocio: 50000 };
    if (!e.metas.length) {
      const meta = agregarMeta({ nombre: 'Fondo de emergencia', montoObjetivo: 900000, emoji: '🛟' });
      abonarMeta(meta.id, 180000);
    }
    e.ajustes.ingresoEsperado = 750000;
    guardar();
  }

  return {
    // datos fijos
    CATEGORIAS_GASTO: Categorias.GASTO,
    CATEGORIAS_INGRESO: Categorias.INGRESO,
    TIPOS_CUENTA: Categorias.TIPOS_CUENTA,
    NOMBRES_MES: Fechas.NOMBRES_MES,
    TECNICAS: Tecnicas.TECNICAS,

    // arranque
    cargar, guardar, obtener, arranque, puedeGuardar,

    // cuentas
    agregarCuenta, editarCuenta, cuentaPorId, cuentasActivas, movimientosDeCuenta,
    archivarCuenta, reactivarCuenta, borrarCuenta,
    saldosDeCuentas, saldoDeCuenta, patrimonio,
    tipoCuenta: Categorias.tipoCuenta,

    // movimientos, metas, topes
    agregarMovimiento, agregarVarios, borrarMovimiento, movimientoParecido,
    adjuntarAMovimiento, quitarAdjunto, idsDeAdjuntosVivos,
    agregarMeta, abonarMeta, borrarMeta,
    fijarPresupuesto, guardarAjustes,

    // registro
    registrar, estaRegistrado, correoValido, nombreDesdeCorreo,

    // formato
    hoyISO: Fechas.hoyISO,
    nombreMes: Fechas.nombreMes,
    fechaLegible: Fechas.fechaLegible,
    formatearDinero: Dinero.formatear,
    categoriaPorId: Categorias.porId,

    // consultas
    movimientosDelMes, resumenDelMes, gastosPorCategoria, historialMeses,
    saldoDiario, reparto503020, estadoPresupuestos, gastosHormiga, sugerir,
    pildoraDelDia: Tecnicas.pildoraDelDia,

    // respaldo
    exportar, importar, borrarTodo, cargarEjemplo, marcarRespaldo, respaldoPrevio,
  };
})();
