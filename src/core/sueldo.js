/* ============================================================
   src/core/sueldo.js
   EL SUELDO LIBRE. La razón de existir de esta app.

   Todas las apps de finanzas muestran lo que gastaste. Esta
   muestra lo que ya PROMETISTE: la plata que todavía está en tu
   cuenta pero que ya no es tuya.

       Sueldo libre de un mes =
           ingreso previsto
         − cuotas que caen ese mes
         − compromisos fijos (dividendo, isapre, internet…)
         − estacionales (marzo, permiso de circulación…)
         − lo que le prometiste a tus metas

   Funciones puras, como todo /src/core: entra el estado, sale un
   número. La fecha de hoy entra como argumento, nunca se lee
   adentro, para poder probar "cómo se ve marzo desde octubre".

   Regla 1 de CLAUDE.md: acá NO hay IA. Todo esto es aritmética
   que se puede desglosar línea por línea, y la pantalla muestra
   ese desglose. Si un número no se puede explicar, no se muestra.
   ============================================================ */

const Sueldo = (() => {

  const entero = v => Math.round(Number(v) || 0);
  const dosDigitos = n => String(n).padStart(2, '0');
  const claveMes = (anio, mes) => `${anio}-${dosDigitos(mes + 1)}`;

  /** El día que corresponde, sin desbordar a otro mes: 31 de febrero → 28. */
  function diaSeguro(anio, mes, dia) {
    const ultimo = new Date(anio, mes + 1, 0).getDate();
    return Math.min(Math.max(1, entero(dia) || 1), ultimo);
  }

  const fechaEn = (anio, mes, dia) =>
    `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(diaSeguro(anio, mes, dia))}`;

  /** ¿Está vigente esa regla en este mes? 'desde' y 'hasta' son 'AAAA-MM'. */
  function vigenteEn(regla, anio, mes) {
    if (regla.activo === false) return false;
    const clave = claveMes(anio, mes);
    if (regla.desde && clave < regla.desde) return false;
    if (regla.hasta && clave > regla.hasta) return false;
    return true;
  }

  /* ============================================================
     1. LO QUE ENTRA
     ============================================================ */

  /**
   * El ingreso que esperas ese mes.
   *
   * Ojo con la diferencia, que es la que hace útil a toda la app:
   * esto es lo PREVISTO, no lo que efectivamente entró. El sueldo
   * libre de noviembre se calcula en septiembre, cuando todavía no
   * ha entrado un peso.
   */
  function ingresoPrevisto(estado, anio, mes) {
    const lista = (estado.ingresosPrevistos || [])
      .filter(i => vigenteEn(i, anio, mes))
      .filter(i => i.frecuencia !== 'unico' || String(i.fecha || '').slice(0, 7) === claveMes(anio, mes));

    const detalle = lista.map(i => ({
      id: i.id,
      nombre: i.nombre || 'Ingreso',
      monto: entero(i.monto),
      fecha: i.frecuencia === 'unico' ? i.fecha : fechaEn(anio, mes, i.diaDelMes),
    }));

    return { total: detalle.reduce((t, d) => t + d.monto, 0), detalle };
  }

  /* ============================================================
     2. LO QUE YA PROMETISTE
     ============================================================ */

  /**
   * Los compromisos que caen en un mes.
   *
   * Hay dos formas distintas y no se pueden mezclar:
   *
   *   - Los FIJOS son una regla: "el dividendo, todos los 5, hasta
   *     2038". No se guardan 200 filas; se guarda la regla y acá se
   *     pregunta si toca este mes. Si se guardaran las filas, cambiar
   *     el monto del arriendo obligaría a editar 200 cosas.
   *
   *   - Las CUOTAS son filas de verdad: "cuota 3 de 12, el 5 de
   *     noviembre, $24.990". Cada una tiene fecha y monto propios
   *     porque la primera cuota suele traer el interés y las demás no.
   *     Y una se puede pagar antes sin tocar las otras.
   */
  function compromisosDelMes(estado, anio, mes) {
    const clave = claveMes(anio, mes);
    const lista = [];

    for (const c of (estado.compromisos || [])) {
      if (c.activo === false) continue;

      if (c.tipo === 'cuota' || c.frecuencia === 'unico') {
        // Una fila concreta: entra si su fecha cae en este mes.
        if (String(c.fecha || '').slice(0, 7) !== clave) continue;
        lista.push({ ...c, montoDelMes: entero(c.monto), fechaDelMes: c.fecha });
        continue;
      }

      if (!vigenteEn(c, anio, mes)) continue;

      if (c.frecuencia === 'anual') {
        // Una vez al año, en el mes que diga.
        if (entero(c.mesDelAnio) !== mes) continue;
        lista.push({ ...c, montoDelMes: entero(c.monto), fechaDelMes: fechaEn(anio, mes, c.diaDelMes) });
        continue;
      }

      // mensual: el caso normal
      lista.push({ ...c, montoDelMes: entero(c.monto), fechaDelMes: fechaEn(anio, mes, c.diaDelMes) });
    }

    return lista.sort((a, b) => (a.fechaDelMes < b.fechaDelMes ? -1 : 1));
  }

  /**
   * Los gastos estacionales chilenos: marzo, el permiso de
   * circulación, las contribuciones, septiembre, diciembre.
   *
   * Van aparte de los compromisos fijos a propósito. No son una
   * deuda que firmaste: son gastos que SABES que vienen, y el valor
   * de la app es avisarte con meses de anticipación, no cuando ya
   * llegaron. Ver Modo Marzo.
   */
  function estacionalesDelMes(estado, anio, mes) {
    return (estado.estacionales || [])
      .filter(e => e.activo !== false)
      .filter(e => entero(e.mes) === mes)
      .filter(e => {
        // "cada cuántos años": las contribuciones son 4 veces al año,
        // el permiso 1, y algunas cosas 1 vez cada 2 años.
        const cada = Math.max(1, entero(e.cadaAnios) || 1);
        if (cada === 1) return true;
        const base = entero(e.anioBase) || anio;
        return (anio - base) % cada === 0;
      })
      .map(e => ({
        ...e,
        montoDelMes: entero(e.monto),
        fechaDelMes: fechaEn(anio, mes, e.dia || 1),
      }))
      .sort((a, b) => (a.fechaDelMes < b.fechaDelMes ? -1 : 1));
  }

  /**
   * Lo que le prometiste a tus metas este mes.
   *
   * Una meta con aporte mensual ES un compromiso, aunque sea contigo
   * mismo. Si no se descontara, el sueldo libre diría que tienes plata
   * que en realidad ya destinaste a juntar para el viaje.
   *
   * Una meta ya cumplida deja de pedir aporte: seguir descontando
   * plata para algo que ya juntaste es mentirle a la persona.
   */
  function aportesAMetas(estado, anio, mes) {
    const detalle = (estado.metas || [])
      .filter(m => entero(m.aporteMensual) > 0)
      .filter(m => entero(m.montoActual) < entero(m.montoObjetivo))
      .filter(m => !m.fechaObjetivo || m.fechaObjetivo.slice(0, 7) >= claveMes(anio, mes))
      .map(m => {
        // No pedimos más de lo que falta: el último mes aporta el resto.
        const falta = entero(m.montoObjetivo) - entero(m.montoActual);
        return {
          id: m.id,
          nombre: m.nombre,
          emoji: m.emoji || '🎯',
          monto: Math.min(entero(m.aporteMensual), falta),
        };
      })
      .filter(m => m.monto > 0);

    return { total: detalle.reduce((t, d) => t + d.monto, 0), detalle };
  }

  /* ============================================================
     3. EL NÚMERO
     ============================================================ */

  /**
   * El sueldo libre de un mes, con todo su desglose.
   *
   * Devuelve SIEMPRE el detalle además del total. Un número sin
   * desglose es un número en el que nadie confía, y esta app se
   * juega entera en que la persona le crea a esta cifra.
   */
  function sueldoLibreDe(estado, anio, mes) {
    const ingreso = ingresoPrevisto(estado, anio, mes);
    const compromisos = compromisosDelMes(estado, anio, mes);
    const estacionales = estacionalesDelMes(estado, anio, mes);
    const metas = aportesAMetas(estado, anio, mes);

    const cuotas = compromisos.filter(c => c.tipo === 'cuota');
    const fijos  = compromisos.filter(c => c.tipo !== 'cuota');

    const suma = lista => lista.reduce((t, c) => t + c.montoDelMes, 0);
    const totalCuotas = suma(cuotas);
    const totalFijos = suma(fijos);
    const totalEstacionales = suma(estacionales);

    const comprometido = totalCuotas + totalFijos + totalEstacionales + metas.total;
    const libre = ingreso.total - comprometido;

    return {
      anio, mes,
      clave: claveMes(anio, mes),
      ingreso: ingreso.total,
      cuotas: totalCuotas,
      fijos: totalFijos,
      estacionales: totalEstacionales,
      metas: metas.total,
      comprometido,
      libre,
      // Qué porcentaje de lo que entra ya está prometido.
      porcentajeComprometido: ingreso.total > 0
        ? Math.round((comprometido / ingreso.total) * 100) : 0,
      detalle: {
        ingresos: ingreso.detalle,
        cuotas, fijos, estacionales,
        metas: metas.detalle,
      },
    };
  }

  /** Los próximos N meses, empezando por el que se le pida. */
  function proyeccion(estado, anio, mes, cuantos) {
    const meses = [];
    for (let i = 0; i < (cuantos || 12); i++) {
      const f = new Date(anio, mes + i, 1);
      meses.push(sueldoLibreDe(estado, f.getFullYear(), f.getMonth()));
    }
    return meses;
  }

  /** El mes donde más aprieta: el de menos sueldo libre. */
  function mesMasApretado(meses) {
    if (!meses || !meses.length) return null;
    return meses.reduce((peor, m) => (m.libre < peor.libre ? m : peor), meses[0]);
  }

  /* ============================================================
     4. FECHA DE LIBERACIÓN
     ============================================================ */

  /**
   * El día exacto en que terminas de pagar todo lo que debes HOY.
   *
   * Cuenta solo las cuotas: son las que tienen final. El dividendo
   * y la isapre no se "terminan de pagar" —son gastos de vivir—, y
   * meterlos correría la fecha al infinito y la volvería inútil.
   *
   * Es el dato que ninguna app entrega y el que más motiva: no es
   * un gráfico, es una fecha en el calendario.
   */
  function fechaDeLiberacion(estado, hoyISO) {
    const cuotas = (estado.compromisos || [])
      .filter(c => c.activo !== false && c.tipo === 'cuota')
      .filter(c => c.estado !== 'pagado')
      .filter(c => !hoyISO || c.fecha >= hoyISO);

    if (!cuotas.length) return null;

    const ultima = cuotas.reduce((max, c) => (c.fecha > max ? c.fecha : max), cuotas[0].fecha);
    const total = cuotas.reduce((t, c) => t + entero(c.monto), 0);

    // Cuántos meses faltan, contados por mes calendario y no por días:
    // "en 8 meses" se entiende y "en 243 días" no.
    const [a1, m1] = String(hoyISO || '').split('-').map(Number);
    const [a2, m2] = ultima.split('-').map(Number);
    const mesesQueFaltan = hoyISO ? (a2 - a1) * 12 + (m2 - m1) : null;

    return {
      fecha: ultima,
      cuantasCuotas: cuotas.length,
      totalQueFalta: total,
      mesesQueFaltan,
      // Con cuántas compras distintas estás comprometido.
      compras: new Set(cuotas.map(c => c.compraId || c.id)).size,
    };
  }

  /* ============================================================
     5. ¿Y SI LO PAGO EN CUOTAS?
     ============================================================ */

  /**
   * Arma las N cuotas de una compra sin guardarlas todavía.
   *
   * El interés se reparte parejo y el redondeo sobrante se le suma a
   * la PRIMERA cuota, no a la última. Es lo que hacen las casas
   * comerciales, y además así la suma de las cuotas da exactamente el
   * total: si el resto se dejara para el final, la última cuota
   * saldría distinta y la persona creería que le cobraron de más.
   */
  function cuotasDe({ monto, cuotas, desde, diaDelMes, interesTotal }) {
    const n = Math.max(1, entero(cuotas));
    const total = entero(monto) + entero(interesTotal);
    const base = Math.floor(total / n);
    const sobra = total - base * n;

    const [anio, mes] = String(desde).split('-').map(Number);
    const dia = entero(diaDelMes) || 5;

    const lista = [];
    for (let i = 0; i < n; i++) {
      const f = new Date(anio, (mes - 1) + i, 1);
      lista.push({
        numero: i + 1,
        de: n,
        monto: base + (i === 0 ? sobra : 0),
        fecha: fechaEn(f.getFullYear(), f.getMonth(), dia),
      });
    }
    return lista;
  }

  /**
   * La función estrella: ¿qué le pasa a mis próximos 12 meses si
   * compro esto en N cuotas?
   *
   * No responde sí o no. Dibuja los doce meses con la compra adentro,
   * marca el mes donde aprieta y propone alternativas concretas. La
   * decisión es de la persona; el trabajo de la app es que la tome
   * con los números a la vista.
   */
  function simular(estado, { monto, cuotas, desde, diaDelMes, interesTotal, anio, mes }) {
    const nuevas = cuotasDe({ monto, cuotas, desde, diaDelMes, interesTotal });

    // El estado "con la compra dentro" es una copia: no tocamos nada.
    const conLaCompra = {
      ...estado,
      compromisos: [
        ...(estado.compromisos || []),
        ...nuevas.map(c => ({
          id: 'sim-' + c.numero, tipo: 'cuota', nombre: 'La compra que estás pensando',
          monto: c.monto, fecha: c.fecha, activo: true, estado: 'pendiente',
        })),
      ],
    };

    const antes = proyeccion(estado, anio, mes, 12);
    const despues = proyeccion(conLaCompra, anio, mes, 12);

    const apretadoAntes = mesMasApretado(antes);
    const apretadoDespues = mesMasApretado(despues);
    const mesesEnRojo = despues.filter(m => m.libre < 0).length;
    const mesesEnRojoAntes = antes.filter(m => m.libre < 0).length;

    // Cuánto sueldo libre te saca en el peor mes de LOS QUE TOCA la
    // compra. Es distinto de 'golpe': si tu peor mes es marzo y las
    // cuotas terminan en febrero, el golpe al peor mes es cero, pero
    // igual hay meses donde vas a sentirla. Los dos números importan y
    // decir solo uno engaña.
    const tocados = despues
      .map((m, i) => ({ m, antes: antes[i] }))
      .filter(({ m, antes: a }) => m.libre !== a.libre);
    const peorTocado = tocados.length
      ? tocados.reduce((peor, x) => (x.m.libre < peor.m.libre ? x : peor), tocados[0])
      : null;

    return {
      cuotas: nuevas,
      valorCuota: nuevas[0] ? nuevas[0].monto : 0,
      totalAPagar: nuevas.reduce((t, c) => t + c.monto, 0),
      antes, despues,
      apretadoAntes, apretadoDespues,
      mesesEnRojo, mesesEnRojoAntes,
      // Cuánto empeora tu PEOR mes. Puede ser 0 y estar bien: significa
      // que las cuotas no llegan hasta ahí.
      golpe: apretadoAntes.libre - apretadoDespues.libre,
      // Y el peor de los meses que la compra sí toca, con lo que le saca.
      peorMesTocado: peorTocado ? peorTocado.m : null,
      leSaca: peorTocado ? (peorTocado.antes.libre - peorTocado.m.libre) : 0,
      // "¿Me alcanza?" es una pregunta con una sola respuesta honesta:
      // que ningún mes quede en rojo. Definirla como "no empeoró" haría
      // que a alguien que ya está en rojo la app le dijera que sí a todo.
      alcanza: mesesEnRojo === 0,
      // Y aparte, si esta compra mete meses en rojo que antes no lo
      // estaban. Con los dos números la pantalla puede distinguir
      // "marzo ya te quedaba en rojo" de "esta compra te lo puso así".
      metesMesesEnRojo: mesesEnRojo - mesesEnRojoAntes,
      yaEstabasEnRojo: mesesEnRojoAntes > 0,
      alternativas: alternativas(estado, { monto, cuotas, desde, diaDelMes, interesTotal, anio, mes }),
    };
  }

  /**
   * Al menos una alternativa que efectivamente mejore el mes apretado.
   *
   * No son consejos genéricos: cada una se calcula de verdad y se
   * queda solo si mejora el número. Proponer "compra en más cuotas"
   * sin comprobar que ayuda es exactamente lo que hace inútil a una
   * app de finanzas.
   */
  function alternativas(estado, compra) {
    const base = mesMasApretado(proyeccion(estado, compra.anio, compra.mes, 12));
    const conEstaCompra = plan => {
      const c = cuotasDe(plan);
      const copia = {
        ...estado,
        compromisos: [
          ...(estado.compromisos || []),
          ...c.map((x, i) => ({ id: 'alt-' + i, tipo: 'cuota', monto: x.monto,
                                fecha: x.fecha, activo: true, estado: 'pendiente' })),
        ],
      };
      return mesMasApretado(proyeccion(copia, compra.anio, compra.mes, 12));
    };

    const actual = conEstaCompra(compra);
    const opciones = [];

    // 1. En más cuotas
    const masCuotas = entero(compra.cuotas) * 2;
    if (masCuotas <= 48) {
      const r = conEstaCompra({ ...compra, cuotas: masCuotas });
      if (r.libre > actual.libre) {
        const c = cuotasDe({ ...compra, cuotas: masCuotas });
        opciones.push({
          tipo: 'mas-cuotas',
          titulo: `En ${masCuotas} cuotas en vez de ${compra.cuotas}`,
          detalle: `La cuota baja a ${c[0].monto}. Tu mes más apretado mejora.`,
          libreDespues: r.libre,
          mejora: r.libre - actual.libre,
        });
      }
    }

    // 2. Esperar un mes: sirve cuando el apretón es por un estacional
    const enUnMes = new Date(compra.anio, compra.mes + 1, 1);
    const desdeUnMes = `${enUnMes.getFullYear()}-${dosDigitos(enUnMes.getMonth() + 1)}`;
    const r2 = conEstaCompra({ ...compra, desde: desdeUnMes });
    if (r2.libre > actual.libre) {
      opciones.push({
        tipo: 'esperar',
        titulo: 'Empezar a pagarla el mes siguiente',
        detalle: 'Corre las cuotas un mes y el apretón se reparte distinto.',
        libreDespues: r2.libre,
        mejora: r2.libre - actual.libre,
      });
    }

    // 3. Poner un pie: bajar el monto a financiar a la mitad
    const mitad = Math.round(entero(compra.monto) / 2);
    const r3 = conEstaCompra({ ...compra, monto: mitad, interesTotal: Math.round(entero(compra.interesTotal) / 2) });
    if (r3.libre > actual.libre) {
      opciones.push({
        tipo: 'pie',
        titulo: `Dar un pie de ${mitad}`,
        detalle: 'Financias la mitad y las cuotas pesan la mitad.',
        libreDespues: r3.libre,
        mejora: r3.libre - actual.libre,
      });
    }

    return opciones
      .sort((a, b) => b.mejora - a.mejora)
      .map(o => ({ ...o, mesApretado: base.clave }));
  }

  /* ============================================================
     6. MODO MARZO — avisar antes, no cuando ya llegó
     ============================================================ */

  /**
   * Los meses complicados que vienen, con cuánta anticipación
   * conviene empezar a guardar.
   *
   * Un mes es complicado si el sueldo libre queda negativo, o si cae
   * por debajo de un tercio de lo normal. Lo segundo importa: un mes
   * que no queda en rojo pero te deja con la mitad de lo de siempre
   * igual te va a doler, y avisarlo recién cuando llega no sirve.
   */
  function mesesQueVienenApretados(estado, anio, mes, cuantos) {
    const meses = proyeccion(estado, anio, mes, cuantos || 12);
    if (meses.length < 2) return [];

    // La referencia es la MEDIANA y no el promedio: un solo marzo muy
    // malo arrastra el promedio hacia abajo y después ningún mes
    // parece anormal, que es justo lo contrario de lo que queremos.
    const ordenados = meses.map(m => m.libre).sort((a, b) => a - b);
    const mediana = ordenados[Math.floor(ordenados.length / 2)];
    const umbral = mediana > 0 ? mediana / 3 : 0;

    return meses
      .map((m, i) => ({ ...m, mesesDeAviso: i }))
      .filter((m, i) => i > 0 && (m.libre < 0 || m.libre < umbral))
      .map(m => {
        const falta = Math.max(0, umbral - m.libre);
        return {
          ...m,
          // Cuánto habría que guardar CADA MES desde ahora para llegar
          // preparado. Es el consejo accionable, no "ojo con marzo".
          guardarPorMes: m.mesesDeAviso > 0 ? Math.ceil(falta / m.mesesDeAviso) : falta,
          faltan: falta,
        };
      });
  }

  /* ============================================================
     7. LO QUE YA SE PAGÓ
     ============================================================ */

  /**
   * Marca como pagados los compromisos que ya tienen un movimiento
   * que los calce. No los toca: devuelve una lista para que la capa
   * de datos decida. Acá no se guarda nada (Regla 5).
   */
  function compromisosCumplidos(estado, hoyISO) {
    const pagados = new Set(
      (estado.movimientos || []).map(m => m.compromisoId).filter(Boolean));
    return (estado.compromisos || [])
      .filter(c => c.tipo === 'cuota' && c.estado !== 'pagado')
      .filter(c => pagados.has(c.id) || (hoyISO && c.fecha < hoyISO && c.pagoAutomatico))
      .map(c => c.id);
  }

  return {
    diaSeguro, fechaEn, vigenteEn, claveMes,
    ingresoPrevisto, compromisosDelMes, estacionalesDelMes, aportesAMetas,
    sueldoLibreDe, proyeccion, mesMasApretado,
    fechaDeLiberacion, cuotasDe, simular, alternativas,
    mesesQueVienenApretados, compromisosCumplidos,
  };
})();

/* Para poder probarlo en Node sin navegador. */
if (typeof module !== 'undefined' && module.exports) module.exports = Sueldo;
