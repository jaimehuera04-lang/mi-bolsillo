/* ============================================================
   src/core/sugerencias.js
   Mira tus numeros ya calculados y decide que vale la pena decir.
   Funcion pura: recibe el estado, devuelve textos. No dibuja.

   Los textos de aqui tienen que cumplir VOZ.md:
   consecuencias en vez de juicios, y ninguna advertencia sin
   al menos una salida concreta.
   ============================================================ */

const Sugerencias = (() => {

  /* ------------------------------------------------------------
     SUGERENCIAS AUTOMATICAS
     Miran tus numeros reales del mes y devuelven un mensaje.
     Se ordenan por prioridad: primero lo mas urgente.
     ------------------------------------------------------------ */
  function sugerir(estado, anio, mes) {
    const r       = Calculos.resumenDelMes(estado, anio, mes);
    const cats    = Calculos.gastosPorCategoria(estado, anio, mes);
    const presu   = Calculos.estadoPresupuestos(estado, anio, mes);
    const hormiga = Calculos.gastosHormiga(estado, anio, mes);
    const reparto = Calculos.reparto503020(estado, anio, mes);
    const $ = Dinero.formatear;
    const lista = [];

    if (r.cantidad === 0) {
      return [{
        tipo: 'info',
        titulo: 'Partamos por lo mas simple',
        texto: 'Toca el boton + y anota un gasto de hoy, aunque sea chico. No necesitas anotar todo el mes de una: con anotar lo del dia basta para que en una semana ya veas patrones.',
      }];
    }

    // 1. Saldo en rojo
    if (r.saldo < 0) {
      lista.push({
        tipo: 'alerta',
        titulo: 'Este mes vas gastando mas de lo que entro',
        texto: `Vas ${$(Math.abs(r.saldo))} por debajo. No es para asustarse, es para actuar: mira las dos categorias mas altas de tu grafico y recorta ahi. Recortar donde mas gastas rinde mucho mas que recortar en lo chico.`,
      });
    }

    // 2. Presupuestos excedidos
    const pasados = presu.filter(p => p.excedido);
    if (pasados.length) {
      const p = pasados[0];
      lista.push({
        tipo: 'alerta',
        titulo: `Te pasaste del tope en ${p.nombre}`,
        texto: `Pusiste un tope de ${$(p.tope)} y vas en ${$(p.usado)}. Dos salidas: bajar el ritmo lo que queda de mes, o reconocer que el tope era poco realista y subirlo. Un tope que se rompe siempre no sirve de nada.`,
      });
    }

    // 3. Una categoria concentra demasiado
    if (cats.length > 2 && cats[0].porcentaje > 40) {
      lista.push({
        tipo: 'info',
        titulo: `${cats[0].emoji} ${cats[0].nombre} se lleva el ${Math.round(cats[0].porcentaje)}% de tus gastos`,
        texto: `Son ${$(cats[0].monto)}. Si es un gasto fijo (arriendo, cuentas) esto es normal. Si es variable, ahi tienes la palanca mas grande que tienes para mover.`,
      });
    }

    // 4. Gastos hormiga
    if (hormiga && hormiga.total > 0) {
      lista.push({
        tipo: 'info',
        titulo: '🐜 Encontre gastos hormiga',
        texto: `Llevas ${hormiga.cantidad} compras chicas (promedio ${$(hormiga.promedio)}) que juntas suman ${$(hormiga.total)}. No hay que eliminarlas todas: elige cuales de verdad valen la pena y deja ir el resto.`,
      });
    }

    // 5. Necesidades muy altas
    if (reparto.ingresos > 0 && reparto.necesidades.pct > 60) {
      lista.push({
        tipo: 'alerta',
        titulo: 'Tus gastos fijos estan apretados',
        texto: `Las necesidades se llevan el ${Math.round(reparto.necesidades.pct)}% (lo sano ronda el 50%). Cuando esto pasa, apretar los gustos casi no alcanza. Lo que mueve la aguja es renegociar algo grande: arriendo, plan de celular, seguros, una deuda cara.`,
      });
    }

    // 6. Buena tasa de ahorro
    if (r.tasaAhorro >= 20) {
      lista.push({
        tipo: 'bien',
        titulo: `Vas ahorrando el ${r.tasaAhorro}% de lo que entro`,
        texto: 'Estas sobre lo que recomienda la regla 50/30/20. Si todavia no tienes fondo de emergencia, ese es el mejor destino para esa plata antes de pensar en cualquier otra cosa.',
      });
    } else if (r.tasaAhorro > 0 && r.tasaAhorro < 10 && r.ingresos > 0) {
      lista.push({
        tipo: 'info',
        titulo: `Estas ahorrando ${r.tasaAhorro}% este mes`,
        texto: 'Es un comienzo real. Prueba esto: el dia que te paguen, aparta primero un 5% y vive con el resto. Ahorrar lo que sobra casi nunca funciona, porque casi nunca sobra.',
      });
    }

    // 7. Sin metas
    if (!estado.metas.length) {
      lista.push({
        tipo: 'info',
        titulo: 'Ponle nombre a tu ahorro',
        texto: 'Ahorrar "porque si" cuesta mucho mas que ahorrar para algo. Crea una meta en la pestana Metas, aunque sea chica. Ver la barra avanzar hace mas por tu constancia que cualquier planilla.',
      });
    }

    return lista.slice(0, 3);
  }

  return { sugerir };
})();
