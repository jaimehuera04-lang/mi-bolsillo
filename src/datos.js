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

  /**
   * Los ids de respaldo que todavía figuran en algún lado.
   * Lo que no esté en esta lista se borra de IndexedDB al arrancar,
   * así que acá tiene que estar TODO: si se olvida un cajón, esas
   * fotos desaparecen solas al abrir la app la próxima vez.
   */
  function idsDeAdjuntosVivos() {
    const vivos = new Set();
    for (const m of estado().movimientos) {
      for (const a of (m.adjuntos || [])) if (a && a.id) vivos.add(a.id);
    }
    // Las boletas de las ventas, las facturas de las compras y las
    // fotos de los productos también son respaldos vivos.
    if (typeof DatosNegocio !== 'undefined') {
      for (const id of DatosNegocio.idsDeAdjuntosVivos()) vivos.add(id);
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

  /* ============================================================
     COMPROMISOS — la entidad de primera clase de esta app

     Todo lo de acá abajo alimenta el sueldo libre. Las cuentas
     mismas están en core/sueldo.js; este bloque solo valida lo
     que llega, lo ordena y lo guarda.
     ============================================================ */

  const texto = v => String(v === undefined || v === null ? '' : v).trim();

  /* ---------- Ingresos previstos ---------- */

  /**
   * Lo que ESPERAS que entre. Sin al menos uno, el sueldo libre no
   * tiene contra qué restar y la app no puede hacer su trabajo.
   */
  function agregarIngresoPrevisto({ nombre, monto, frecuencia, diaDelMes, fecha, desde, hasta }) {
    const limpio = texto(nombre);
    if (!limpio) throw new Error('¿Cómo se llama ese ingreso? Por ejemplo: Sueldo.');
    const valor = Dinero.entero(monto);
    if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');

    const ingreso = {
      id: Esquema.nuevoId(),
      nombre: limpio,
      monto: valor,
      frecuencia: frecuencia === 'unico' ? 'unico' : 'mensual',
      diaDelMes: Math.min(31, Math.max(1, Dinero.entero(diaDelMes) || 30)),
      fecha: fecha || '',
      desde: desde || '',
      hasta: hasta || '',
      activo: true,
      creado: Fechas.hoyISO(),
    };
    estado().ingresosPrevistos.push(ingreso);
    guardar();
    return ingreso;
  }

  function editarIngresoPrevisto(id, datos) {
    const i = estado().ingresosPrevistos.find(x => x.id === id);
    if (!i) return null;
    if (datos.nombre !== undefined) {
      const limpio = texto(datos.nombre);
      if (!limpio) throw new Error('El nombre no puede quedar vacío.');
      i.nombre = limpio;
    }
    if (datos.monto !== undefined) {
      const valor = Dinero.entero(datos.monto);
      if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');
      i.monto = valor;
    }
    if (datos.diaDelMes !== undefined) i.diaDelMes = Math.min(31, Math.max(1, Dinero.entero(datos.diaDelMes) || 30));
    if (datos.frecuencia !== undefined) i.frecuencia = datos.frecuencia === 'unico' ? 'unico' : 'mensual';
    ['fecha', 'desde', 'hasta'].forEach(c => { if (datos[c] !== undefined) i[c] = datos[c] || ''; });
    if (datos.activo !== undefined) i.activo = Boolean(datos.activo);
    guardar();
    return i;
  }

  function borrarIngresoPrevisto(id) {
    estado().ingresosPrevistos = estado().ingresosPrevistos.filter(x => x.id !== id);
    guardar();
  }

  /* ---------- Compromisos fijos ---------- */

  /**
   * El dividendo, la isapre, el CAE, el plan de celular.
   * Se guarda la REGLA, no doscientas filas: cambiar el monto del
   * arriendo tiene que ser un solo cambio, no doscientos.
   */
  function agregarCompromisoFijo({ nombre, monto, frecuencia, diaDelMes, mesDelAnio,
                                   categoria, cuenta, desde, hasta }) {
    const limpio = texto(nombre);
    if (!limpio) throw new Error('¿Qué es lo que pagas? Por ejemplo: Dividendo.');
    const valor = Dinero.entero(monto);
    if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');

    const c = {
      id: Esquema.nuevoId(),
      tipo: 'fijo',
      nombre: limpio,
      monto: valor,
      frecuencia: frecuencia === 'anual' ? 'anual' : 'mensual',
      diaDelMes: Math.min(31, Math.max(1, Dinero.entero(diaDelMes) || 1)),
      mesDelAnio: Math.min(11, Math.max(0, Dinero.entero(mesDelAnio))),
      categoria: categoria || 'servicios',
      cuenta: cuenta || null,
      desde: desde || '',
      hasta: hasta || '',
      estado: 'pendiente',
      movimientoId: null,
      activo: true,
      creado: Fechas.hoyISO(),
    };
    estado().compromisos.push(c);
    guardar();
    return c;
  }

  function editarCompromiso(id, datos) {
    const c = compromisoPorId(id);
    if (!c) return null;
    if (datos.nombre !== undefined) {
      const limpio = texto(datos.nombre);
      if (!limpio) throw new Error('El nombre no puede quedar vacío.');
      c.nombre = limpio;
    }
    if (datos.monto !== undefined) {
      const valor = Dinero.entero(datos.monto);
      if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');
      c.monto = valor;
    }
    if (datos.diaDelMes !== undefined) c.diaDelMes = Math.min(31, Math.max(1, Dinero.entero(datos.diaDelMes) || 1));
    if (datos.mesDelAnio !== undefined) c.mesDelAnio = Math.min(11, Math.max(0, Dinero.entero(datos.mesDelAnio)));
    if (datos.frecuencia !== undefined) c.frecuencia = datos.frecuencia === 'anual' ? 'anual' : 'mensual';
    ['categoria', 'cuenta', 'desde', 'hasta', 'fecha'].forEach(x => {
      if (datos[x] !== undefined) c[x] = datos[x] || (x === 'cuenta' ? null : '');
    });
    if (datos.activo !== undefined) c.activo = Boolean(datos.activo);
    guardar();
    return c;
  }

  const compromisoPorId = id => estado().compromisos.find(c => c.id === id) || null;

  /**
   * Termina un compromiso fijo sin borrar su historia.
   * "Ya no pago el CAE" no significa que nunca lo pagué: se le pone
   * fecha de término y los meses anteriores siguen cuadrando.
   */
  function terminarCompromiso(id, hastaMes) {
    const c = compromisoPorId(id);
    if (!c) return null;
    c.hasta = hastaMes || Fechas.claveMes(new Date().getFullYear(), new Date().getMonth());
    guardar();
    return c;
  }

  function borrarCompromiso(id) {
    const c = compromisoPorId(id);
    if (!c) return;
    // Si es una cuota, se van TODAS las de esa compra: media compra
    // en cuotas no significa nada y dejaría la fecha de liberación mintiendo.
    estado().compromisos = c.compraId
      ? estado().compromisos.filter(x => x.compraId !== c.compraId)
      : estado().compromisos.filter(x => x.id !== id);
    guardar();
  }

  /* ---------- Compras en cuotas ---------- */

  /**
   * Regla 2: una compra en cuotas genera UN GASTO de hoy y
   * N COMPROMISOS futuros con fecha propia.
   *
   * El gasto es opcional a propósito. Si la compra ya está anotada
   * (por ejemplo, la leyó el lector de la boleta), anotarla otra vez
   * sería contar dos veces el mismo peso, que es la Regla 8.
   */
  function comprarEnCuotas({ nombre, monto, cuotas, primeraFecha, diaDelMes, interesTotal,
                             categoria, cuenta, anotarElGasto, fechaCompra }) {
    const limpio = texto(nombre);
    if (!limpio) throw new Error('¿Qué compraste?');
    const valor = Dinero.entero(monto);
    if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');
    const n = Dinero.entero(cuotas);
    if (n < 1 || n > 60) throw new Error('Las cuotas tienen que ser entre 1 y 60.');

    const hoy = fechaCompra || Fechas.hoyISO();
    const desde = (primeraFecha || hoy).slice(0, 7);
    const dia = Dinero.entero(diaDelMes) || Number((primeraFecha || hoy).slice(8, 10)) || 5;

    const compraId = Esquema.nuevoId();
    const partes = Sueldo.cuotasDe({
      monto: valor, cuotas: n, desde, diaDelMes: dia, interesTotal,
    });

    const nuevos = partes.map(p => ({
      id: Esquema.nuevoId(),
      tipo: 'cuota',
      compraId,
      nombre: `${limpio} ${p.numero}/${p.de}`,
      numero: p.numero,
      de: p.de,
      monto: p.monto,
      fecha: p.fecha,
      frecuencia: 'unico',
      categoria: categoria || 'deuda',
      cuenta: cuenta || null,
      estado: 'pendiente',
      movimientoId: null,
      activo: true,
      creado: Fechas.hoyISO(),
    }));
    estado().compromisos.push(...nuevos);

    let gasto = null;
    if (anotarElGasto) {
      gasto = agregarMovimiento({
        tipo: 'gasto',
        monto: valor,
        categoria: categoria || 'deuda',
        fecha: hoy,
        cuentaOrigen: cuenta || (cuentasActivas()[0] || {}).id,
        descripcion: limpio,
        nota: `Comprado en ${n} cuotas`,
      });
    }

    guardar();
    return { compraId, cuotas: nuevos, gasto };
  }

  /** Todas las cuotas de una misma compra, en orden. */
  const cuotasDeLaCompra = compraId => estado().compromisos
    .filter(c => c.compraId === compraId)
    .sort((a, b) => (a.numero || 0) - (b.numero || 0));

  /**
   * Marca una cuota como pagada y, si se pide, anota el movimiento.
   * El pago de una cuota de tarjeta es una TRANSFERENCIA hacia la
   * tarjeta, no un gasto nuevo: el gasto se contó al comprar
   * (Regla 8). Por eso 'comoTransferencia' existe.
   */
  function pagarCompromiso(id, { fecha, cuentaOrigen, cuentaDestino, comoTransferencia } = {}) {
    const c = compromisoPorId(id);
    if (!c) return null;

    let mov = null;
    if (cuentaOrigen) {
      mov = agregarMovimiento({
        tipo: comoTransferencia ? 'transferencia' : 'gasto',
        monto: c.monto,
        categoria: comoTransferencia ? null : (c.categoria || 'deuda'),
        fecha: fecha || Fechas.hoyISO(),
        cuentaOrigen,
        cuentaDestino: comoTransferencia ? cuentaDestino : null,
        descripcion: c.nombre,
        compromisoId: c.id,
      });
    }
    c.estado = 'pagado';
    c.movimientoId = mov ? mov.id : null;
    c.fechaPago = fecha || Fechas.hoyISO();
    guardar();
    return { compromiso: c, movimiento: mov };
  }

  /** Deshace el pago, y se lleva el movimiento que había creado. */
  function despagarCompromiso(id) {
    const c = compromisoPorId(id);
    if (!c) return null;
    if (c.movimientoId) borrarMovimiento(c.movimientoId);
    c.estado = 'pendiente';
    c.movimientoId = null;
    c.fechaPago = '';
    guardar();
    return c;
  }

  /* ---------- Estacionales ---------- */

  function agregarEstacional({ nombre, monto, mes, dia, cadaAnios, anioBase, categoria, emoji }) {
    const limpio = texto(nombre);
    if (!limpio) throw new Error('¿Qué gasto es? Por ejemplo: Matrícula.');
    const valor = Dinero.entero(monto);
    if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');

    const e = {
      id: Esquema.nuevoId(),
      nombre: limpio,
      monto: valor,
      mes: Math.min(11, Math.max(0, Dinero.entero(mes))),
      dia: Math.min(31, Math.max(1, Dinero.entero(dia) || 1)),
      cadaAnios: Math.max(1, Dinero.entero(cadaAnios) || 1),
      anioBase: Dinero.entero(anioBase) || new Date().getFullYear(),
      categoria: categoria || 'otro',
      emoji: emoji || '📅',
      activo: true,
      creado: Fechas.hoyISO(),
    };
    estado().estacionales.push(e);
    guardar();
    return e;
  }

  function editarEstacional(id, datos) {
    const e = estado().estacionales.find(x => x.id === id);
    if (!e) return null;
    if (datos.nombre !== undefined) {
      const limpio = texto(datos.nombre);
      if (!limpio) throw new Error('El nombre no puede quedar vacío.');
      e.nombre = limpio;
    }
    if (datos.monto !== undefined) {
      const valor = Dinero.entero(datos.monto);
      if (valor <= 0) throw new Error('El monto tiene que ser mayor que cero.');
      e.monto = valor;
    }
    if (datos.mes !== undefined) e.mes = Math.min(11, Math.max(0, Dinero.entero(datos.mes)));
    if (datos.dia !== undefined) e.dia = Math.min(31, Math.max(1, Dinero.entero(datos.dia) || 1));
    if (datos.cadaAnios !== undefined) e.cadaAnios = Math.max(1, Dinero.entero(datos.cadaAnios) || 1);
    if (datos.categoria !== undefined) e.categoria = datos.categoria;
    if (datos.activo !== undefined) e.activo = Boolean(datos.activo);
    guardar();
    return e;
  }

  function borrarEstacional(id) {
    estado().estacionales = estado().estacionales.filter(x => x.id !== id);
    guardar();
  }

  /** Agrega uno desde el calendario chileno, con su monto sugerido. */
  function agregarEstacionalDePlantilla(plantillaId, monto) {
    const p = Estacionales.porId(plantillaId);
    if (!p) throw new Error('Ese gasto no está en la lista.');
    return agregarEstacional({
      nombre: p.nombre,
      monto: monto === undefined ? p.monto : monto,
      mes: p.mes, dia: p.dia, categoria: p.categoria, emoji: p.emoji,
    });
  }

  /* ---------- Simulaciones guardadas ---------- */

  function guardarSimulacion({ nombre, monto, cuotas, desde, diaDelMes, interesTotal }) {
    const s = {
      id: Esquema.nuevoId(),
      nombre: texto(nombre) || 'Una compra',
      monto: Dinero.entero(monto),
      cuotas: Dinero.entero(cuotas),
      desde: desde || Fechas.hoyISO().slice(0, 7),
      diaDelMes: Dinero.entero(diaDelMes) || 5,
      interesTotal: Dinero.entero(interesTotal),
      creada: Fechas.hoyISO(),
    };
    estado().simulaciones.push(s);
    guardar();
    return s;
  }

  function borrarSimulacion(id) {
    estado().simulaciones = estado().simulaciones.filter(s => s.id !== id);
    guardar();
  }

  /* ---------- Consultas del sueldo libre ----------
     Son core/sueldo.js con el estado ya puesto, para que la
     pantalla no tenga que ir a buscarlo cada vez.              */

  const sueldoLibre     = (anio, mes)   => Sueldo.sueldoLibreDe(estado(), anio, mes);
  const proyeccion      = (anio, mes, n) => Sueldo.proyeccion(estado(), anio, mes, n || 12);
  const mesMasApretado  = (anio, mes, n) => Sueldo.mesMasApretado(proyeccion(anio, mes, n));
  const fechaLiberacion = ()            => Sueldo.fechaDeLiberacion(estado(), Fechas.hoyISO());
  const mesesApretados  = (anio, mes, n) => Sueldo.mesesQueVienenApretados(estado(), anio, mes, n || 12);
  const simularCuotas   = datos         => Sueldo.simular(estado(), datos);
  const compromisosDelMes  = (anio, mes) => Sueldo.compromisosDelMes(estado(), anio, mes);
  const estacionalesDelMes = (anio, mes) => Sueldo.estacionalesDelMes(estado(), anio, mes);

  /** Las cuotas que vienen, agrupadas por compra. */
  function comprasEnCuotas() {
    const mapa = new Map();
    for (const c of estado().compromisos) {
      if (c.tipo !== 'cuota' || !c.compraId) continue;
      if (!mapa.has(c.compraId)) mapa.set(c.compraId, []);
      mapa.get(c.compraId).push(c);
    }
    return [...mapa.entries()].map(([compraId, cuotas]) => {
      cuotas.sort((a, b) => (a.numero || 0) - (b.numero || 0));
      const pendientes = cuotas.filter(c => c.estado !== 'pagado');
      return {
        compraId,
        // El nombre sin el "3/12" del final, que cambia en cada cuota.
        nombre: String(cuotas[0].nombre || '').replace(/\s+\d+\/\d+$/, ''),
        cuotas,
        cuantas: cuotas.length,
        pagadas: cuotas.length - pendientes.length,
        total: cuotas.reduce((t, c) => t + c.monto, 0),
        falta: pendientes.reduce((t, c) => t + c.monto, 0),
        ultima: cuotas[cuotas.length - 1].fecha,
        siguiente: pendientes.length ? pendientes[0] : null,
      };
    }).sort((a, b) => (a.ultima < b.ultima ? -1 : 1));
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

    // el sueldo libre: compromisos, ingresos previstos y estacionales
    agregarIngresoPrevisto, editarIngresoPrevisto, borrarIngresoPrevisto,
    ingresosPrevistos: () => estado().ingresosPrevistos,
    agregarCompromisoFijo, editarCompromiso, compromisoPorId,
    terminarCompromiso, borrarCompromiso,
    compromisos: () => estado().compromisos,
    comprarEnCuotas, cuotasDeLaCompra, comprasEnCuotas,
    pagarCompromiso, despagarCompromiso,
    agregarEstacional, editarEstacional, borrarEstacional, agregarEstacionalDePlantilla,
    estacionales: () => estado().estacionales,
    PLANTILLAS_ESTACIONALES: Estacionales.PLANTILLAS,
    porQueApretaElMes: Estacionales.porQueApreta,
    guardarSimulacion, borrarSimulacion,
    simulaciones: () => estado().simulaciones,

    // las cuentas del sueldo libre
    sueldoLibre, proyeccion, mesMasApretado, fechaLiberacion, mesesApretados,
    simularCuotas, compromisosDelMes, estacionalesDelMes,

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
