/* ============================================================
   datos.js - El "cerebro" de la app.
   Aqui vive todo lo que tiene que ver con GUARDAR y CALCULAR.
   No dibuja nada en pantalla (de eso se encargan app.js y
   graficos.js). Separarlo asi hace que sea facil de arreglar.
   ============================================================ */

const Datos = (() => {
  const LLAVE = 'mi-bolsillo-v1';   // nombre del cajon donde guardamos todo

  /* ---------- Categorias ----------
     Cada categoria tiene: emoji, nombre, color y "necesidad".
     La necesidad sirve para la regla 50/30/20:
       'necesidad' = techo, comida, transporte, salud...
       'deseo'     = salidas, ropa, antojos...
       'ahorro'    = ahorro, inversion, pago de deudas.               */
  const CATEGORIAS_GASTO = [
    { id: 'comida',      emoji: '🛒', nombre: 'Supermercado', color: '#e8a33d', tipo: 'necesidad' },
    { id: 'restaurante', emoji: '🍔', nombre: 'Comer fuera',  color: '#ef7f4e', tipo: 'deseo' },
    { id: 'transporte',  emoji: '🚌', nombre: 'Transporte',   color: '#3b7dd8', tipo: 'necesidad' },
    { id: 'vivienda',    emoji: '🏠', nombre: 'Arriendo/Casa',color: '#5b6b7c', tipo: 'necesidad' },
    { id: 'servicios',   emoji: '💡', nombre: 'Cuentas',      color: '#38a3c9', tipo: 'necesidad' },
    { id: 'salud',       emoji: '💊', nombre: 'Salud',        color: '#43b5a0', tipo: 'necesidad' },
    { id: 'educacion',   emoji: '📚', nombre: 'Educacion',    color: '#7c5cd6', tipo: 'necesidad' },
    { id: 'ocio',        emoji: '🎬', nombre: 'Entretencion', color: '#c455a5', tipo: 'deseo' },
    { id: 'ropa',        emoji: '👕', nombre: 'Ropa',         color: '#d96a8a', tipo: 'deseo' },
    { id: 'suscripcion', emoji: '📱', nombre: 'Suscripciones',color: '#6f7fd6', tipo: 'deseo' },
    { id: 'deuda',       emoji: '🏦', nombre: 'Deudas',       color: '#96502f', tipo: 'ahorro' },
    { id: 'ahorro',      emoji: '🐷', nombre: 'Ahorro',       color: '#10a072', tipo: 'ahorro' },
    { id: 'mascota',     emoji: '🐶', nombre: 'Mascota',      color: '#a8894a', tipo: 'deseo' },
    { id: 'regalo',      emoji: '🎁', nombre: 'Regalos',      color: '#e2564d', tipo: 'deseo' },
    { id: 'otro',        emoji: '📦', nombre: 'Otro',         color: '#8c99a6', tipo: 'deseo' },
  ];

  const CATEGORIAS_INGRESO = [
    { id: 'sueldo',    emoji: '💼', nombre: 'Sueldo',      color: '#10a072' },
    { id: 'extra',     emoji: '🧾', nombre: 'Trabajo extra',color: '#3b7dd8' },
    { id: 'venta',     emoji: '🏷️', nombre: 'Venta',       color: '#e8a33d' },
    { id: 'regalo-in', emoji: '🎉', nombre: 'Regalo',      color: '#c455a5' },
    { id: 'interes',   emoji: '📈', nombre: 'Intereses',   color: '#7c5cd6' },
    { id: 'otro-in',   emoji: '➕', nombre: 'Otro',        color: '#8c99a6' },
  ];

  /* ---------- Estado inicial (lo que ve alguien que recien instala) ---------- */
  function estadoNuevo() {
    return {
      version: 1,
      movimientos: [],
      metas: [],
      presupuestos: {},          // { comida: 150000, ocio: 40000, ... }
      ajustes: {
        correo: '',              // se pide una sola vez al abrir la app
        registrado: false,       // true cuando ya dejo su correo
        nombre: '',
        moneda: 'CLP',
        ingresoEsperado: 0,
        tutorialVisto: false,
      },
    };
  }

  let estado = estadoNuevo();

  /* ---------- Guardar y cargar ---------- */
  function cargar() {
    try {
      const crudo = localStorage.getItem(LLAVE);
      if (crudo) {
        const guardado = JSON.parse(crudo);
        // mezclamos con el estado nuevo para que no falte ninguna llave
        estado = Object.assign(estadoNuevo(), guardado);
        estado.ajustes = Object.assign(estadoNuevo().ajustes, guardado.ajustes || {});
      }
    } catch (e) {
      console.warn('No se pudo leer lo guardado, empezamos de cero.', e);
      estado = estadoNuevo();
    }
    return estado;
  }

  function guardar() {
    try {
      localStorage.setItem(LLAVE, JSON.stringify(estado));
    } catch (e) {
      console.error('No se pudo guardar', e);
    }
  }

  const obtener = () => estado;

  /* ---------- Movimientos ---------- */
  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function agregarMovimiento({ tipo, monto, categoria, nota, fecha }) {
    const mov = {
      id: nuevoId(),
      tipo,                                   // 'ingreso' o 'gasto'
      monto: Math.round(Math.abs(Number(monto))),
      categoria,
      nota: (nota || '').trim(),
      fecha: fecha || hoyISO(),               // 'AAAA-MM-DD'
      creado: new Date().toISOString(),
    };
    estado.movimientos.push(mov);
    guardar();
    return mov;
  }

  function borrarMovimiento(id) {
    estado.movimientos = estado.movimientos.filter(m => m.id !== id);
    guardar();
  }

  /* ---------- Metas de ahorro ---------- */
  function agregarMeta({ nombre, objetivo, emoji, fechaLimite }) {
    const meta = {
      id: nuevoId(),
      nombre: nombre.trim(),
      objetivo: Math.round(Number(objetivo)),
      ahorrado: 0,
      emoji: emoji || '🎯',
      fechaLimite: fechaLimite || '',
      creada: hoyISO(),
    };
    estado.metas.push(meta);
    guardar();
    return meta;
  }

  function abonarMeta(id, monto) {
    const meta = estado.metas.find(m => m.id === id);
    if (!meta) return null;
    meta.ahorrado = Math.max(0, meta.ahorrado + Math.round(Number(monto)));
    guardar();
    return meta;
  }

  function borrarMeta(id) {
    estado.metas = estado.metas.filter(m => m.id !== id);
    guardar();
  }

  /* ---------- Presupuestos por categoria ---------- */
  function fijarPresupuesto(categoria, monto) {
    const n = Math.round(Number(monto));
    if (!n || n <= 0) delete estado.presupuestos[categoria];
    else estado.presupuestos[categoria] = n;
    guardar();
  }

  function guardarAjustes(parciales) {
    Object.assign(estado.ajustes, parciales);
    guardar();
  }

  /* ---------- Registro ----------
     Aclaracion honesta: esto NO es una cuenta. No hay servidor, ni
     contrasena, ni sincronizacion. El correo se guarda en este
     dispositivo igual que el resto de los datos, y sirve para
     personalizar la app e identificar tus copias de seguridad.   */

  /** Revisa que el correo tenga forma de correo (algo@algo.algo). */
  function correoValido(correo) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(correo).trim());
  }

  /** De "jaime.huera04@gmail.com" saca "Jaime", para poder saludar. */
  function nombreDesdeCorreo(correo) {
    const usuario = String(correo).split('@')[0] || '';
    const limpio = usuario.split(/[._\-+0-9]+/).filter(Boolean)[0] || '';
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase() : '';
  }

  function registrar(correo) {
    const limpio = String(correo).trim().toLowerCase();
    if (!correoValido(limpio)) throw new Error('correo invalido');
    estado.ajustes.correo = limpio;
    estado.ajustes.registrado = true;
    // al registrarse ya no se muestran las instrucciones
    estado.ajustes.tutorialVisto = true;
    if (!estado.ajustes.nombre) estado.ajustes.nombre = nombreDesdeCorreo(limpio);
    guardar();
    return estado.ajustes;
  }

  const estaRegistrado = () => Boolean(estado.ajustes.registrado && estado.ajustes.correo);

  /* ---------- Fechas ---------- */
  function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  }
  const dosDigitos = n => String(n).padStart(2, '0');
  const claveMes = (anio, mes) => `${anio}-${dosDigitos(mes + 1)}`; // mes 0-11

  const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function nombreMes(anio, mes) {
    return `${NOMBRES_MES[mes]} ${anio}`;
  }

  /** Convierte '2026-08-20' en un objeto Date sin sustos de zona horaria. */
  function aFecha(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function fechaLegible(iso) {
    const f = aFecha(iso);
    const hoy = aFecha(hoyISO());
    const dias = Math.round((hoy - f) / 86400000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return `${f.getDate()} de ${NOMBRES_MES[f.getMonth()]}`;
  }

  /* ---------- Dinero ---------- */
  function formatearDinero(monto, moneda) {
    const cod = moneda || estado.ajustes.moneda || 'CLP';
    const sinDecimales = ['CLP', 'COP', 'PYG', 'JPY', 'KRW'].includes(cod);
    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: cod,
        minimumFractionDigits: sinDecimales ? 0 : 2,
        maximumFractionDigits: sinDecimales ? 0 : 2,
      }).format(monto);
    } catch (e) {
      return `$${Math.round(monto).toLocaleString('es-CL')}`;
    }
  }

  /* ---------- Consultas y calculos ---------- */

  /** Movimientos de un mes concreto (mes va de 0 a 11). */
  function movimientosDelMes(anio, mes) {
    const clave = claveMes(anio, mes);
    return estado.movimientos
      .filter(m => m.fecha.slice(0, 7) === clave)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.creado || '').localeCompare(a.creado || '')));
  }

  /** Totales del mes: ingresos, gastos, saldo y tasa de ahorro. */
  function resumenDelMes(anio, mes) {
    const movs = movimientosDelMes(anio, mes);
    let ingresos = 0, gastos = 0;
    for (const m of movs) {
      if (m.tipo === 'ingreso') ingresos += m.monto;
      else gastos += m.monto;
    }
    const saldo = ingresos - gastos;
    // Tasa de ahorro = que porcentaje de lo que entro NO se gasto
    const tasaAhorro = ingresos > 0 ? Math.round((saldo / ingresos) * 100) : 0;
    return { ingresos, gastos, saldo, tasaAhorro, cantidad: movs.length };
  }

  /** Gastos agrupados por categoria, de mayor a menor. */
  function gastosPorCategoria(anio, mes) {
    const movs = movimientosDelMes(anio, mes).filter(m => m.tipo === 'gasto');
    const mapa = new Map();
    for (const m of movs) {
      mapa.set(m.categoria, (mapa.get(m.categoria) || 0) + m.monto);
    }
    const total = [...mapa.values()].reduce((a, b) => a + b, 0);
    return [...mapa.entries()]
      .map(([id, monto]) => {
        const cat = categoriaPorId(id);
        return {
          id, monto, nombre: cat.nombre, emoji: cat.emoji, color: cat.color,
          porcentaje: total > 0 ? (monto / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.monto - a.monto);
  }

  /** Ingresos vs gastos de los ultimos N meses (para el grafico de barras). */
  function historialMeses(anio, mes, cantidad = 6) {
    const salida = [];
    for (let i = cantidad - 1; i >= 0; i--) {
      const f = new Date(anio, mes - i, 1);
      const r = resumenDelMes(f.getFullYear(), f.getMonth());
      salida.push({
        etiqueta: NOMBRES_MES[f.getMonth()].slice(0, 3),
        anio: f.getFullYear(),
        mes: f.getMonth(),
        ...r,
      });
    }
    return salida;
  }

  /** Saldo acumulado dia a dia dentro del mes (para el grafico de linea). */
  function saldoDiario(anio, mes) {
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();
    const porDia = new Array(diasDelMes + 1).fill(0);
    for (const m of movimientosDelMes(anio, mes)) {
      const dia = Number(m.fecha.slice(8, 10));
      porDia[dia] += m.tipo === 'ingreso' ? m.monto : -m.monto;
    }
    const puntos = [];
    let acumulado = 0;
    const esMesActual = anio === new Date().getFullYear() && mes === new Date().getMonth();
    const hasta = esMesActual ? new Date().getDate() : diasDelMes;
    for (let d = 1; d <= hasta; d++) {
      acumulado += porDia[d];
      puntos.push({ dia: d, valor: acumulado });
    }
    return puntos;
  }

  /** Reparto 50/30/20: necesidades, deseos y ahorro. */
  function reparto503020(anio, mes) {
    const movs = movimientosDelMes(anio, mes).filter(m => m.tipo === 'gasto');
    const grupos = { necesidad: 0, deseo: 0, ahorro: 0 };
    for (const m of movs) {
      const cat = categoriaPorId(m.categoria);
      grupos[cat.tipo || 'deseo'] += m.monto;
    }
    // el dinero que quedo sin gastar tambien cuenta como ahorro
    const { ingresos, saldo } = resumenDelMes(anio, mes);
    if (saldo > 0) grupos.ahorro += saldo;
    const base = ingresos > 0 ? ingresos : (grupos.necesidad + grupos.deseo + grupos.ahorro) || 1;
    return {
      ingresos,
      necesidades: { monto: grupos.necesidad, pct: (grupos.necesidad / base) * 100, ideal: 50 },
      deseos:      { monto: grupos.deseo,     pct: (grupos.deseo / base) * 100,     ideal: 30 },
      ahorro:      { monto: grupos.ahorro,    pct: (grupos.ahorro / base) * 100,    ideal: 20 },
    };
  }

  /** Estado de cada presupuesto configurado. */
  function estadoPresupuestos(anio, mes) {
    const gastos = gastosPorCategoria(anio, mes);
    const mapaGasto = new Map(gastos.map(g => [g.id, g.monto]));
    return Object.entries(estado.presupuestos).map(([id, tope]) => {
      const cat = categoriaPorId(id);
      const usado = mapaGasto.get(id) || 0;
      return {
        id, tope, usado, nombre: cat.nombre, emoji: cat.emoji, color: cat.color,
        pct: Math.min(100, (usado / tope) * 100),
        excedido: usado > tope,
      };
    }).sort((a, b) => (b.usado / b.tope) - (a.usado / a.tope));
  }

  /** "Gastos hormiga": compras chicas y repetidas que suman mucho. */
  function gastosHormiga(anio, mes) {
    const movs = movimientosDelMes(anio, mes).filter(m => m.tipo === 'gasto');
    if (movs.length < 4) return null;
    const montos = movs.map(m => m.monto).sort((a, b) => a - b);
    const mediana = montos[Math.floor(montos.length / 2)];
    const umbral = Math.max(mediana * 0.6, 1);
    const chicos = movs.filter(m => m.monto <= umbral);
    if (chicos.length < 4) return null;
    const total = chicos.reduce((a, m) => a + m.monto, 0);
    return { cantidad: chicos.length, total, promedio: Math.round(total / chicos.length) };
  }

  function categoriaPorId(id) {
    return CATEGORIAS_GASTO.find(c => c.id === id)
      || CATEGORIAS_INGRESO.find(c => c.id === id)
      || { id, emoji: '📦', nombre: 'Otro', color: '#8c99a6', tipo: 'deseo' };
  }

  /* ---------- Copia de seguridad ---------- */
  function exportar() {
    return JSON.stringify(estado, null, 2);
  }

  function importar(textoJson) {
    const entrante = JSON.parse(textoJson);
    if (!entrante || !Array.isArray(entrante.movimientos)) {
      throw new Error('El archivo no tiene el formato de Mi Bolsillo.');
    }
    estado = Object.assign(estadoNuevo(), entrante);
    estado.ajustes = Object.assign(estadoNuevo().ajustes, entrante.ajustes || {});
    guardar();
    return estado;
  }

  function borrarTodo() {
    estado = estadoNuevo();
    guardar();
  }

  /** Datos de ejemplo, para que la app no se vea vacia al probarla. */
  function cargarEjemplo() {
    const hoy = new Date();
    const dia = d => {
      const f = new Date(hoy.getFullYear(), hoy.getMonth(), d);
      return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
    };
    const maxDia = Math.min(hoy.getDate(), 28);
    const r = n => Math.max(1, Math.min(maxDia, n));
    estado.movimientos = [
      { tipo: 'ingreso', monto: 750000, categoria: 'sueldo',      nota: 'Sueldo del mes', fecha: dia(r(1)) },
      { tipo: 'gasto',   monto: 320000, categoria: 'vivienda',    nota: 'Arriendo',       fecha: dia(r(2)) },
      { tipo: 'gasto',   monto: 48000,  categoria: 'servicios',   nota: 'Luz y agua',     fecha: dia(r(3)) },
      { tipo: 'gasto',   monto: 92000,  categoria: 'comida',      nota: 'Feria y super',  fecha: dia(r(4)) },
      { tipo: 'gasto',   monto: 12000,  categoria: 'transporte',  nota: 'Bip',            fecha: dia(r(5)) },
      { tipo: 'gasto',   monto: 8900,   categoria: 'restaurante', nota: 'Almuerzo',       fecha: dia(r(6)) },
      { tipo: 'gasto',   monto: 6500,   categoria: 'restaurante', nota: 'Cafe',           fecha: dia(r(7)) },
      { tipo: 'gasto',   monto: 9990,   categoria: 'suscripcion', nota: 'Streaming',      fecha: dia(r(8)) },
      { tipo: 'gasto',   monto: 34000,  categoria: 'ocio',        nota: 'Salida',         fecha: dia(r(10)) },
      { tipo: 'gasto',   monto: 7200,   categoria: 'restaurante', nota: 'Delivery',       fecha: dia(r(12)) },
      { tipo: 'ingreso', monto: 60000,  categoria: 'extra',       nota: 'Pololito',       fecha: dia(r(14)) },
      { tipo: 'gasto',   monto: 50000,  categoria: 'ahorro',      nota: 'A mi meta',      fecha: dia(r(15)) },
    ].map(m => ({ ...m, id: nuevoId(), creado: new Date().toISOString() }));
    estado.presupuestos = { comida: 130000, restaurante: 40000, ocio: 50000 };
    if (!estado.metas.length) {
      agregarMeta({ nombre: 'Fondo de emergencia', objetivo: 900000, emoji: '🛟' });
      abonarMeta(estado.metas[0].id, 180000);
    }
    estado.ajustes.ingresoEsperado = 750000;
    guardar();
  }

  return {
    CATEGORIAS_GASTO, CATEGORIAS_INGRESO, NOMBRES_MES,
    cargar, guardar, obtener,
    agregarMovimiento, borrarMovimiento,
    agregarMeta, abonarMeta, borrarMeta,
    fijarPresupuesto, guardarAjustes,
    registrar, estaRegistrado, correoValido, nombreDesdeCorreo,
    hoyISO, nombreMes, fechaLegible, formatearDinero, categoriaPorId,
    movimientosDelMes, resumenDelMes, gastosPorCategoria, historialMeses,
    saldoDiario, reparto503020, estadoPresupuestos, gastosHormiga,
    exportar, importar, borrarTodo, cargarEjemplo,
  };
})();
