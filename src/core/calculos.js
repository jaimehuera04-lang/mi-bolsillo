/* ============================================================
   src/core/calculos.js
   El motor. Funciones PURAS: reciben el estado, devuelven numeros.
   No tocan el DOM, no leen localStorage, no guardan nada.
   Por eso se pueden probar en Node sin abrir un navegador.

   Dos reglas que se respetan en todo este archivo:
     - Las transferencias NO son ingresos ni gastos. Mover plata
       entre dos cuentas tuyas no te hace mas rico ni mas pobre,
       asi que no aparece en ningun total ni en ningun grafico.
     - Un gasto con tarjeta se cuenta al comprar. Pagar despues la
       tarjeta es una transferencia, no un segundo gasto.
   ============================================================ */

const Calculos = (() => {

  const esIngreso = m => m.tipo === 'ingreso';
  const esGasto   = m => m.tipo === 'gasto';

  /** Movimientos de un mes, del mas nuevo al mas viejo. mes va de 0 a 11. */
  function movimientosDelMes(estado, anio, mes) {
    const clave = Fechas.claveMes(anio, mes);
    return estado.movimientos
      .filter(m => m.fecha.slice(0, 7) === clave)
      .sort((a, b) => (a.fecha < b.fecha ? 1
                     : a.fecha > b.fecha ? -1
                     : (b.creado || '').localeCompare(a.creado || '')));
  }

  /** Totales del mes: ingresos, gastos, saldo y tasa de ahorro. */
  function resumenDelMes(estado, anio, mes) {
    const movs = movimientosDelMes(estado, anio, mes);
    let ingresos = 0, gastos = 0;
    for (const m of movs) {
      if (esIngreso(m)) ingresos += m.monto;
      else if (esGasto(m)) gastos += m.monto;   // las transferencias quedan fuera
    }
    const saldo = ingresos - gastos;
    // Tasa de ahorro = que porcentaje de lo que entro NO se gasto
    const tasaAhorro = ingresos > 0 ? Math.round((saldo / ingresos) * 100) : 0;
    return { ingresos, gastos, saldo, tasaAhorro, cantidad: movs.length };
  }

  /** Gastos agrupados por categoria, de mayor a menor. */
  function gastosPorCategoria(estado, anio, mes) {
    const movs = movimientosDelMes(estado, anio, mes).filter(esGasto);
    const mapa = new Map();
    for (const m of movs) mapa.set(m.categoria, (mapa.get(m.categoria) || 0) + m.monto);

    const total = [...mapa.values()].reduce((a, b) => a + b, 0);
    return [...mapa.entries()]
      .map(([id, monto]) => {
        const cat = Categorias.porId(id);
        return {
          id, monto, nombre: cat.nombre, emoji: cat.emoji, color: cat.color,
          porcentaje: total > 0 ? (monto / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.monto - a.monto);
  }

  /** Ingresos vs gastos de los ultimos N meses (grafico de barras). */
  function historialMeses(estado, anio, mes, cantidad = 6) {
    const salida = [];
    for (let i = cantidad - 1; i >= 0; i--) {
      const { anio: a, mes: m } = Fechas.sumarMeses(anio, mes, -i);
      salida.push({
        etiqueta: Fechas.NOMBRES_MES[m].slice(0, 3),
        anio: a, mes: m,
        ...resumenDelMes(estado, a, m),
      });
    }
    return salida;
  }

  /** Saldo acumulado dia a dia dentro del mes (grafico de linea). */
  function saldoDiario(estado, anio, mes) {
    const dias = Fechas.diasDelMes(anio, mes);
    const porDia = new Array(dias + 1).fill(0);
    for (const m of movimientosDelMes(estado, anio, mes)) {
      if (!esIngreso(m) && !esGasto(m)) continue;      // fuera transferencias
      const dia = Number(m.fecha.slice(8, 10));
      porDia[dia] += esIngreso(m) ? m.monto : -m.monto;
    }

    const hoy = new Date();
    const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();
    const hasta = esMesActual ? hoy.getDate() : dias;

    const puntos = [];
    let acumulado = 0;
    for (let d = 1; d <= hasta; d++) {
      acumulado += porDia[d];
      puntos.push({ dia: d, valor: acumulado });
    }
    return puntos;
  }

  /** Reparto 50/30/20: necesidades, deseos y ahorro. */
  function reparto503020(estado, anio, mes) {
    const movs = movimientosDelMes(estado, anio, mes).filter(esGasto);
    const grupos = { necesidad: 0, deseo: 0, ahorro: 0 };
    for (const m of movs) {
      const cat = Categorias.porId(m.categoria);
      grupos[cat.tipo || 'deseo'] += m.monto;
    }
    // el dinero que quedo sin gastar tambien cuenta como ahorro
    const { ingresos, saldo } = resumenDelMes(estado, anio, mes);
    if (saldo > 0) grupos.ahorro += saldo;

    const base = ingresos > 0 ? ingresos
               : (grupos.necesidad + grupos.deseo + grupos.ahorro) || 1;
    return {
      ingresos,
      necesidades: { monto: grupos.necesidad, pct: (grupos.necesidad / base) * 100, ideal: 50 },
      deseos:      { monto: grupos.deseo,     pct: (grupos.deseo / base) * 100,     ideal: 30 },
      ahorro:      { monto: grupos.ahorro,    pct: (grupos.ahorro / base) * 100,    ideal: 20 },
    };
  }

  /** Estado de cada tope configurado. */
  function estadoPresupuestos(estado, anio, mes) {
    const mapaGasto = new Map(gastosPorCategoria(estado, anio, mes).map(g => [g.id, g.monto]));
    return Object.entries(estado.presupuestos)
      .map(([id, tope]) => {
        const cat = Categorias.porId(id);
        const usado = mapaGasto.get(id) || 0;
        return {
          id, tope, usado, nombre: cat.nombre, emoji: cat.emoji, color: cat.color,
          pct: Math.min(100, (usado / tope) * 100),
          excedido: usado > tope,
        };
      })
      .sort((a, b) => (b.usado / b.tope) - (a.usado / a.tope));
  }

  /** "Gastos hormiga": compras chicas y repetidas que juntas suman mucho. */
  function gastosHormiga(estado, anio, mes) {
    const movs = movimientosDelMes(estado, anio, mes).filter(esGasto);
    if (movs.length < 4) return null;

    const montos = movs.map(m => m.monto).sort((a, b) => a - b);
    const mediana = montos[Math.floor(montos.length / 2)];
    const umbral = Math.max(mediana * 0.6, 1);
    const chicos = movs.filter(m => m.monto <= umbral);
    if (chicos.length < 4) return null;

    const total = chicos.reduce((a, m) => a + m.monto, 0);
    return { cantidad: chicos.length, total, promedio: Math.round(total / chicos.length) };
  }

  /* ---------- Cuentas ----------
     El saldo NO se guarda: se calcula sumando los movimientos sobre el
     saldo inicial. Un saldo guardado se desincroniza apenas borras un
     movimiento viejo; uno calculado no puede mentir.                   */

  /** Saldo actual de una cuenta, a una fecha tope opcional ('AAAA-MM-DD'). */
  function saldoDeCuenta(estado, cuentaId, hasta) {
    const cuenta = estado.cuentas.find(c => c.id === cuentaId);
    if (!cuenta) return 0;

    let saldo = cuenta.saldoInicial || 0;
    for (const m of estado.movimientos) {
      if (hasta && m.fecha > hasta) continue;
      if (m.cuentaDestino === cuentaId) saldo += m.monto;   // ingreso o transferencia recibida
      if (m.cuentaOrigen  === cuentaId) saldo -= m.monto;   // gasto o transferencia enviada
    }
    return saldo;
  }

  /** Todas las cuentas activas con su saldo calculado. */
  function saldosDeCuentas(estado, hasta) {
    return estado.cuentas
      .filter(c => c.activa !== false)
      .map(c => ({ ...c, saldo: saldoDeCuenta(estado, c.id, hasta) }));
  }

  /** Patrimonio = lo que tienes menos lo que debes. Una transferencia no lo mueve. */
  function patrimonio(estado, hasta) {
    return saldosDeCuentas(estado, hasta).reduce((a, c) => a + c.saldo, 0);
  }

  return {
    movimientosDelMes, resumenDelMes, gastosPorCategoria, historialMeses,
    saldoDiario, reparto503020, estadoPresupuestos, gastosHormiga,
    saldoDeCuenta, saldosDeCuentas, patrimonio,
  };
})();
