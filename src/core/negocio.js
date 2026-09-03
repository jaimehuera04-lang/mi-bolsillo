/* ============================================================
   src/core/negocio.js
   Las cuentas del negocio. Funciones puras: entra un objeto
   'negocio', sale un número o una lista. Sin DOM, sin
   localStorage, y sin fechas de "ahora" escondidas (la fecha de
   hoy siempre entra como argumento).

   Por qué está separado de la interfaz: así se puede probar sin
   navegador con `node herramientas/probar-negocio.js`, y así el
   día que la pantalla cambie, los números no.

   Regla de la casa que acá importa mucho: los montos son pesos
   enteros. La CANTIDAD sí puede tener decimales (vendes 1,5 kg
   de queso), pero el total de esa línea se redondea a peso al
   tiro. Un peso de diferencia por línea es prolijo; arrastrar
   decimales por toda la app termina en un total que no cuadra
   con la suma de sus partes.
   ============================================================ */

const Negocio = (() => {

  const entero = v => Math.round(Number(v) || 0);

  /** Las cantidades admiten hasta tres decimales (gramos, litros). */
  const cantidadDe = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
  };

  /** La llave con que se identifica una existencia concreta. */
  const llaveDeStock = (productoId, varianteId) =>
    `${productoId}::${varianteId || ''}`;

  /* ---------------- Líneas, ventas y cotizaciones ---------------- */

  /** Lo que vale una línea: cantidad por precio, redondeado a peso. */
  const totalDeLinea = linea =>
    Math.round(cantidadDe(linea && linea.cantidad) * entero(linea && linea.precio));

  /** Lo que costó una línea (para saber cuánto ganaste, no cuánto vendiste). */
  const costoDeLinea = linea =>
    Math.round(cantidadDe(linea && linea.cantidad) * entero(linea && linea.costo));

  const sumaDeLineas = lineas =>
    (lineas || []).reduce((t, l) => t + totalDeLinea(l), 0);

  const sumaDeCostos = lineas =>
    (lineas || []).reduce((t, l) => t + costoDeLinea(l), 0);

  /**
   * El total de una venta o de una cotización.
   * El descuento va en pesos, no en porcentaje: es lo que la gente
   * dice de verdad ("te lo dejo en mil menos") y no arrastra
   * decimales. Nunca baja de cero, porque una venta negativa no
   * existe; si querías devolver plata, eso es otra cosa.
   */
  function totalDe(documento) {
    const bruto = sumaDeLineas(documento && documento.lineas);
    const descuento = Math.min(entero(documento && documento.descuento), bruto);
    return Math.max(0, bruto - descuento);
  }

  /** Cuánto te queda de esa venta después de pagar lo que vendiste. */
  function gananciaDe(venta) {
    return totalDe(venta) - sumaDeCostos(venta && venta.lineas);
  }

  /** Una venta anulada no vendió nada: no suma, no descuenta stock, no existe. */
  const ventaCuenta = v => Boolean(v) && v.estado !== 'anulada';

  /** Lo que todavía te deben de una venta fiada. */
  function saldoPendienteDe(venta) {
    if (!ventaCuenta(venta)) return 0;
    return Math.max(0, totalDe(venta) - entero(venta.pagado));
  }

  /* ---------------- Existencias ---------------- */

  /**
   * El stock de hoy NO se guarda: se calcula sumando el libro de
   * movimientos de existencias. Así cualquier número que muestre la
   * app se puede explicar hacia atrás, línea por línea, y no hay
   * forma de que quede descuadrado por un guardado a medias.
   *
   * Devuelve un objeto { 'productoId::varianteId': cantidad }.
   */
  function existencias(negocio) {
    const mapa = {};
    ((negocio && negocio.stock) || []).forEach(m => {
      const llave = llaveDeStock(m.productoId, m.varianteId);
      mapa[llave] = cantidadDe((mapa[llave] || 0) + cantidadDe(m.cantidad));
    });
    return mapa;
  }

  /** Cuánto hay de un producto (o de una de sus variantes). */
  function stockDe(negocio, productoId, varianteId) {
    return cantidadDe(existencias(negocio)[llaveDeStock(productoId, varianteId)] || 0);
  }

  /**
   * El stock de un producto entero: si tiene variantes, es la suma de
   * todas ellas; si no, el suyo propio. Un producto con variantes no
   * lleva existencias por su cuenta, porque entonces habría dos
   * números para lo mismo y algún día no calzarían.
   */
  function stockTotalDe(negocio, producto) {
    if (!producto) return 0;
    if (producto.variantes && producto.variantes.length) {
      return cantidadDe(producto.variantes
        .reduce((t, v) => t + stockDe(negocio, producto.id, v.id), 0));
    }
    return stockDe(negocio, producto.id, null);
  }

  /** Lo que vale tu bodega, valorada a lo que TE costó (no a lo que la vendes). */
  function valorInventario(negocio) {
    return ((negocio && negocio.productos) || [])
      .filter(p => p.controlaStock !== false && p.activo !== false)
      .reduce((total, p) => {
        if (p.variantes && p.variantes.length) {
          return total + p.variantes.reduce((t, v) =>
            t + Math.round(stockDe(negocio, p.id, v.id) *
                           entero(v.costo === undefined || v.costo === null ? p.costo : v.costo)), 0);
        }
        return total + Math.round(stockTotalDe(negocio, p) * entero(p.costo));
      }, 0);
  }

  /** Los que están en el mínimo o por debajo. Para avisar antes de quedar sin nada. */
  function bajoMinimo(negocio) {
    return ((negocio && negocio.productos) || [])
      .filter(p => p.activo !== false && p.controlaStock !== false)
      .map(p => ({ producto: p, hay: stockTotalDe(negocio, p), minimo: cantidadDe(p.stockMinimo) }))
      .filter(f => f.minimo > 0 && f.hay <= f.minimo)
      .sort((a, b) => (a.hay - a.minimo) - (b.hay - b.minimo));
  }

  /* ---------------- El mes ---------------- */

  const esDelMes = (iso, anio, mes) =>
    String(iso || '').slice(0, 7) === `${anio}-${String(mes + 1).padStart(2, '0')}`;

  /**
   * El resumen de un mes del negocio.
   *
   * 'caja' no es lo mismo que 'vendido': lo fiado se vendió pero
   * todavía no entró. Confundir esos dos números es la forma más
   * común de creer que te fue bien un mes que en realidad te dejó
   * sin plata para reponer.
   */
  function resumenDelMes(negocio, anio, mes) {
    const ventas = ((negocio && negocio.ventas) || [])
      .filter(v => ventaCuenta(v) && esDelMes(v.fecha, anio, mes));
    const compras = ((negocio && negocio.compras) || [])
      .filter(c => esDelMes(c.fecha, anio, mes));
    const retiros = ((negocio && negocio.retiros) || [])
      .filter(r => esDelMes(r.fecha, anio, mes));

    const vendido      = ventas.reduce((t, v) => t + totalDe(v), 0);
    const costoVendido = ventas.reduce((t, v) => t + sumaDeCostos(v.lineas), 0);
    const cobrado      = ventas.reduce((t, v) => t + Math.min(totalDe(v), entero(v.pagado)), 0);
    const porCobrar    = ventas.reduce((t, v) => t + saldoPendienteDe(v), 0);
    const gastado      = compras.reduce((t, c) => t + entero(c.monto), 0);
    const retirado     = retiros.reduce((t, r) => t + entero(r.monto), 0);

    return {
      anio, mes,
      cuantasVentas: ventas.length,
      vendido,                          // lo que facturaste
      costoVendido,                     // lo que te costó eso que vendiste
      margen: vendido - costoVendido,   // lo que ganaste con la venta misma
      gastado,                          // compras y gastos del negocio
      utilidad: vendido - costoVendido - gastado,
      cobrado,                          // lo que efectivamente entró
      porCobrar,                        // lo fiado que sigue afuera
      retirado,                         // lo que te pasaste a ti mismo
      caja: cobrado - gastado - retirado,
      ticketPromedio: ventas.length ? Math.round(vendido / ventas.length) : 0,
    };
  }

  /** Los últimos N meses hacia atrás, del más viejo al más nuevo. */
  function historialDeMeses(negocio, anio, mes, cuantos) {
    const lista = [];
    for (let i = cuantos - 1; i >= 0; i--) {
      const f = new Date(anio, mes - i, 1);
      lista.push(resumenDelMes(negocio, f.getFullYear(), f.getMonth()));
    }
    return lista;
  }

  /* ---------------- Rankings ---------------- */

  /** Qué se vende más, entre dos fechas ISO (las dos incluidas). */
  function masVendidos(negocio, desde, hasta, cuantos) {
    const cuenta = {};
    ((negocio && negocio.ventas) || [])
      .filter(v => ventaCuenta(v) && v.fecha >= desde && v.fecha <= hasta)
      .forEach(v => (v.lineas || []).forEach(l => {
        const llave = llaveDeStock(l.productoId, l.varianteId);
        if (!cuenta[llave]) cuenta[llave] = { nombre: l.nombre, unidades: 0, vendido: 0 };
        cuenta[llave].unidades = cantidadDe(cuenta[llave].unidades + cantidadDe(l.cantidad));
        cuenta[llave].vendido += totalDeLinea(l);
      }));
    return Object.values(cuenta)
      .sort((a, b) => b.vendido - a.vendido)
      .slice(0, cuantos || 5);
  }

  /** Agrupa las ventas por una propiedad suya: clienteId, empleadoId, medioPago. */
  function ventasAgrupadas(negocio, campo, desde, hasta) {
    const cuenta = {};
    ((negocio && negocio.ventas) || [])
      .filter(v => ventaCuenta(v) && v.fecha >= desde && v.fecha <= hasta)
      .forEach(v => {
        const llave = v[campo] || '';
        if (!cuenta[llave]) cuenta[llave] = { llave, cuantas: 0, vendido: 0 };
        cuenta[llave].cuantas++;
        cuenta[llave].vendido += totalDe(v);
      });
    return Object.values(cuenta).sort((a, b) => b.vendido - a.vendido);
  }

  /* ---------------- Cotizaciones ---------------- */

  /** Una cotización aceptada o rechazada ya no vence: cerró. */
  function estadoDeCotizacion(cotizacion, hoyISO) {
    if (!cotizacion) return 'borrador';
    if (cotizacion.estado === 'aceptada' || cotizacion.estado === 'rechazada') {
      return cotizacion.estado;
    }
    if (cotizacion.validaHasta && cotizacion.validaHasta < hoyISO) return 'vencida';
    return cotizacion.estado || 'borrador';
  }

  /* ---------------- Lo que hay que mirar hoy ---------------- */

  /**
   * Las alertas del negocio, en orden de urgencia.
   * Igual que en el resto de la app, esto lo calcula el motor y NO
   * lo inventa nadie: cada alerta sale de un número concreto que se
   * puede ir a revisar.
   */
  function alertas(negocio, hoyISO) {
    const avisos = [];
    if (!negocio) return avisos;

    if (!negocio.ajustes || negocio.ajustes.avisarStockBajo !== false) {
      const faltantes = bajoMinimo(negocio);
      const sinNada = faltantes.filter(f => f.hay <= 0);
      if (sinNada.length) {
        avisos.push({
          nivel: 'alto',
          icono: '📦',
          titulo: sinNada.length === 1
            ? `Te quedaste sin ${sinNada[0].producto.nombre}`
            : `Te quedaste sin ${sinNada.length} productos`,
          detalle: 'No los puedes vender hasta que repongas.',
        });
      }
      const porAcabarse = faltantes.filter(f => f.hay > 0);
      if (porAcabarse.length) {
        avisos.push({
          nivel: 'medio',
          icono: '⚠️',
          titulo: porAcabarse.length === 1
            ? `Queda poco ${porAcabarse[0].producto.nombre}`
            : `A ${porAcabarse.length} productos les queda poco`,
          detalle: 'Están en su mínimo o por debajo.',
        });
      }
    }

    const fiados = (negocio.ventas || []).filter(v => saldoPendienteDe(v) > 0);
    if (fiados.length) {
      const total = fiados.reduce((t, v) => t + saldoPendienteDe(v), 0);
      avisos.push({
        nivel: fiados.length > 4 ? 'alto' : 'medio',
        icono: '🧾',
        titulo: `Te deben $${total.toLocaleString('es-CL')}`,
        detalle: `${fiados.length} ${fiados.length === 1 ? 'venta fiada' : 'ventas fiadas'} sin cobrar.`,
      });
    }

    const esperando = (negocio.cotizaciones || [])
      .filter(c => estadoDeCotizacion(c, hoyISO) === 'enviada');
    if (esperando.length) {
      avisos.push({
        nivel: 'bajo',
        icono: '📄',
        titulo: `${esperando.length} ${esperando.length === 1 ? 'cotización esperando' : 'cotizaciones esperando'} respuesta`,
        detalle: 'Un recordatorio a tiempo cierra más de lo que uno cree.',
      });
    }

    return avisos;
  }

  return {
    llaveDeStock, totalDeLinea, costoDeLinea, sumaDeLineas, sumaDeCostos,
    totalDe, gananciaDe, ventaCuenta, saldoPendienteDe,
    existencias, stockDe, stockTotalDe, valorInventario, bajoMinimo,
    resumenDelMes, historialDeMeses, masVendidos, ventasAgrupadas,
    estadoDeCotizacion, alertas,
  };
})();

/* Para poder probarlo en Node sin navegador. En el navegador esta
   línea no hace nada, porque allá no existe 'module'. */
if (typeof module !== 'undefined' && module.exports) module.exports = Negocio;
