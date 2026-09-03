/* ============================================================
   herramientas/probar-sueldo.js

   El sueldo libre, las cuotas, la fecha de liberación, el
   simulador y el Modo Marzo. Corre en Node, sin navegador,
   porque /src/core son funciones puras.

   Uso:
     node herramientas/probar-sueldo.js

   Termina con error si alguna prueba no calza.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const contexto = vm.createContext({ console, Intl, Date, Math, JSON, Number, RegExp, Object, Array, String, Set });
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'src/core/sueldo.js'), 'utf8'), contexto, { filename: 'sueldo.js' });
const { Sueldo } = vm.runInContext('({ Sueldo })', contexto);

const HOY = '2026-09-15';

/* ------------------------------------------------------------
   Una persona real: sueldo de 750.000, dividendo, isapre, plan
   de celular, el CAE, un refrigerador en 12 cuotas, marzo con
   la matrícula del colegio y el permiso de circulación, y una
   meta de ahorro.
   ------------------------------------------------------------ */

function cuotasDelRefri() {
  // 12 cuotas de 39.990 partiendo en junio de 2026
  return Sueldo.cuotasDe({ monto: 479880, cuotas: 12, desde: '2026-06', diaDelMes: 5 })
    .map((c, i) => ({
      id: 'refri-' + (i + 1),
      compraId: 'refri',
      tipo: 'cuota',
      nombre: `Refrigerador ${c.numero}/12`,
      monto: c.monto,
      fecha: c.fecha,
      categoria: 'deuda',
      estado: c.fecha < HOY ? 'pagado' : 'pendiente',
      activo: true,
    }));
}

function personaDePrueba() {
  return {
    meta: { schemaVersion: 5 },
    cuentas: [{ id: 'c1', nombre: 'Cuenta RUT', tipo: 'cuenta_rut', saldoInicial: 0, activa: true }],
    movimientos: [],

    ingresosPrevistos: [
      { id: 'i1', nombre: 'Sueldo', monto: 750000, frecuencia: 'mensual', diaDelMes: 30, activo: true },
    ],

    compromisos: [
      { id: 'f1', tipo: 'fijo', nombre: 'Dividendo', monto: 320000, frecuencia: 'mensual',
        diaDelMes: 5, categoria: 'vivienda', activo: true },
      { id: 'f2', tipo: 'fijo', nombre: 'Isapre', monto: 95000, frecuencia: 'mensual',
        diaDelMes: 10, categoria: 'salud', activo: true },
      { id: 'f3', tipo: 'fijo', nombre: 'Plan de celular', monto: 18990, frecuencia: 'mensual',
        diaDelMes: 15, categoria: 'suscripcion', activo: true },
      // El CAE se termina en diciembre de 2026: después de eso no debe aparecer.
      { id: 'f4', tipo: 'fijo', nombre: 'CAE', monto: 62000, frecuencia: 'mensual',
        diaDelMes: 20, categoria: 'educacion', hasta: '2026-12', activo: true },
      ...cuotasDelRefri(),
    ],

    estacionales: [
      { id: 'e1', nombre: 'Matrícula y útiles', monto: 380000, mes: 2, dia: 1, activo: true },
      { id: 'e2', nombre: 'Permiso de circulación', monto: 145000, mes: 2, dia: 31, activo: true },
      { id: 'e3', nombre: 'Fiestas patrias', monto: 120000, mes: 8, dia: 17, activo: true },
      // Contribuciones: 4 veces al año. Acá solo la de abril.
      { id: 'e4', nombre: 'Contribuciones', monto: 68000, mes: 3, dia: 30, activo: true },
    ],

    metas: [
      { id: 'g1', nombre: 'Fondo de emergencia', montoObjetivo: 1500000, montoActual: 300000,
        aporteMensual: 50000, emoji: '🛟' },
    ],
  };
}

/* ------------------------------------------------------------ */

let fallos = 0, hechas = 0;

function revisar(titulo, obtenido, esperado) {
  hechas++;
  if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
    fallos++;
    console.log(`  ✗ ${titulo}`);
    console.log(`      esperaba: ${JSON.stringify(esperado)}`);
    console.log(`      obtuvo:   ${JSON.stringify(obtenido)}`);
  } else {
    console.log(`  ✓ ${titulo}`);
  }
}

const p = personaDePrueba();

/* ---------------- Las cuotas ---------------- */
console.log('\nRepartir una compra en cuotas');

const doce = Sueldo.cuotasDe({ monto: 479880, cuotas: 12, desde: '2026-06', diaDelMes: 5 });
revisar('Son doce', doce.length, 12);
revisar('La suma da exactamente el total', doce.reduce((t, c) => t + c.monto, 0), 479880);
revisar('La primera cae en junio', doce[0].fecha, '2026-06-05');
revisar('La última cae en mayo del año siguiente', doce[11].fecha, '2027-05-05');

// 100.000 en 3: 33.333,33 -> el peso sobrante va a la PRIMERA
const tres = Sueldo.cuotasDe({ monto: 100000, cuotas: 3, desde: '2026-09', diaDelMes: 5 });
revisar('El redondeo sobrante va a la primera cuota', tres.map(c => c.monto), [33334, 33333, 33333]);
revisar('Y la suma sigue dando el total', tres.reduce((t, c) => t + c.monto, 0), 100000);

const conInteres = Sueldo.cuotasDe({ monto: 100000, cuotas: 4, desde: '2026-09', diaDelMes: 5, interesTotal: 20000 });
revisar('El interés se reparte entre las cuotas', conInteres.reduce((t, c) => t + c.monto, 0), 120000);

const finDeMes = Sueldo.cuotasDe({ monto: 90000, cuotas: 3, desde: '2026-01', diaDelMes: 31 });
revisar('El 31 en febrero no se pasa a marzo', finDeMes[1].fecha, '2026-02-28');

/* ---------------- El sueldo libre ---------------- */
console.log('\nEl sueldo libre de un mes normal');

// Octubre 2026: sueldo 750.000. Fijos: 320+95+18,99+62 = 495.990.
// Cuota del refri: 39.990. Metas: 50.000. Sin estacionales.
const oct = Sueldo.sueldoLibreDe(p, 2026, 9);
revisar('El ingreso previsto', oct.ingreso, 750000);
revisar('Los compromisos fijos', oct.fijos, 320000 + 95000 + 18990 + 62000);
revisar('La cuota del refrigerador', oct.cuotas, 39990);
revisar('El aporte a la meta', oct.metas, 50000);
revisar('Sin estacionales en octubre', oct.estacionales, 0);
revisar('Total comprometido', oct.comprometido, 495990 + 39990 + 50000);
revisar('SUELDO LIBRE de octubre', oct.libre, 750000 - 585980);
revisar('Y qué porcentaje ya está prometido', oct.porcentajeComprometido, 78);

console.log('\nEl desglose se puede explicar entero');
revisar('Cada peso comprometido tiene una línea',
  oct.detalle.fijos.length + oct.detalle.cuotas.length +
  oct.detalle.estacionales.length + oct.detalle.metas.length, 4 + 1 + 0 + 1);
revisar('Y las líneas suman lo mismo que el total',
  oct.detalle.fijos.reduce((t, c) => t + c.montoDelMes, 0) +
  oct.detalle.cuotas.reduce((t, c) => t + c.montoDelMes, 0) +
  oct.detalle.metas.reduce((t, c) => t + c.monto, 0), oct.comprometido);

/* ---------------- Marzo ---------------- */
console.log('\nMarzo, que es de lo que se trata todo esto');

const marzo = Sueldo.sueldoLibreDe(p, 2027, 2);
revisar('En marzo caen la matrícula y el permiso', marzo.estacionales, 380000 + 145000);
revisar('El CAE ya no está: se terminó en diciembre',
  marzo.detalle.fijos.some(f => f.nombre === 'CAE'), false);
revisar('Los fijos bajan a los tres que quedan', marzo.fijos, 320000 + 95000 + 18990);
revisar('Y marzo queda EN ROJO', marzo.libre < 0, true);
revisar('Concretamente', marzo.libre, 750000 - (433990 + 39990 + 525000 + 50000));

/* ---------------- La proyección ---------------- */
console.log('\nLos próximos doce meses');

const doceMeses = Sueldo.proyeccion(p, 2026, 8, 12);
revisar('Son doce meses', doceMeses.length, 12);
revisar('Empieza en septiembre 2026', doceMeses[0].clave, '2026-09');
revisar('Y termina en agosto 2027', doceMeses[11].clave, '2027-08');
revisar('Septiembre trae las fiestas patrias', doceMeses[0].estacionales, 120000);

const apretado = Sueldo.mesMasApretado(doceMeses);
revisar('El mes más apretado es marzo', apretado.clave, '2027-03');

revisar('En junio 2027 ya no hay cuota del refri: terminó en mayo',
  Sueldo.sueldoLibreDe(p, 2027, 5).cuotas, 0);

/* ---------------- Fecha de liberación ---------------- */
console.log('\nLa fecha de liberación');

const libre = Sueldo.fechaDeLiberacion(p, HOY);
revisar('Terminas de deber el 5 de mayo de 2027', libre.fecha, '2027-05-05');
revisar('Faltan 8 meses', libre.mesesQueFaltan, 8);
revisar('Quedan 8 cuotas por pagar', libre.cuantasCuotas, 8);
revisar('De una sola compra', libre.compras, 1);
revisar('Y falta esta plata', libre.totalQueFalta, 39990 * 8);

const sinDeudas = { ...p, compromisos: p.compromisos.filter(c => c.tipo !== 'cuota') };
revisar('Sin cuotas no hay fecha que dar', Sueldo.fechaDeLiberacion(sinDeudas, HOY), null);

/* ---------------- ¿Y si lo pago en cuotas? ---------------- */
console.log('\n¿Y si lo pago en cuotas?');

// Un notebook de 600.000 en 12 cuotas, empezando en octubre
const sim = Sueldo.simular(p, {
  monto: 600000, cuotas: 12, desde: '2026-10', diaDelMes: 5, anio: 2026, mes: 8,
});
revisar('La cuota sale en 50.000', sim.valorCuota, 50000);
revisar('El total a pagar es el mismo', sim.totalAPagar, 600000);
revisar('Los doce meses de antes', sim.antes.length, 12);
revisar('Y los doce de después', sim.despues.length, 12);
revisar('El mes más apretado sigue siendo marzo', sim.apretadoDespues.clave, '2027-03');
revisar('Y le saca 50.000 de sueldo libre', sim.golpe, 50000);
revisar('Marzo ya estaba en rojo, así que no alcanza', sim.alcanza, false);
revisar('Da al menos una alternativa', sim.alternativas.length > 0, true);
revisar('La primera alternativa MEJORA de verdad el mes apretado',
  sim.alternativas[0].mejora > 0, true);

// Una compra chica que sí cabe
const chica = Sueldo.simular({ ...p, estacionales: [] }, {
  monto: 120000, cuotas: 6, desde: '2026-10', diaDelMes: 5, anio: 2026, mes: 8,
});
revisar('Sin estacionales de por medio, una compra chica cabe', chica.alcanza, true);
revisar('Y no deja ningún mes en rojo', chica.mesesEnRojo, 0);

/* ---------------- Modo Marzo ---------------- */
console.log('\nModo Marzo: avisar en octubre, no en marzo');

const avisos = Sueldo.mesesQueVienenApretados(p, 2026, 9, 12);   // parados en octubre
revisar('Avisa de al menos un mes', avisos.length > 0, true);
const avisoMarzo = avisos.find(a => a.clave === '2027-03');
revisar('Y marzo está entre ellos', Boolean(avisoMarzo), true);
revisar('Con cinco meses de anticipación', avisoMarzo.mesesDeAviso, 5);
revisar('Y dice cuánto guardar cada mes desde ahora', avisoMarzo.guardarPorMes > 0, true);
revisar('Guardar eso durante esos meses cubre el hoyo',
  avisoMarzo.guardarPorMes * avisoMarzo.mesesDeAviso >= avisoMarzo.faltan, true);

/* ---------------- Los bordes ---------------- */
console.log('\nLos casos que rompen las apps');

const vacio = { meta:{}, cuentas:[], movimientos:[], compromisos:[], ingresosPrevistos:[],
                estacionales:[], metas:[] };
revisar('Alguien recién llegado no revienta nada', Sueldo.sueldoLibreDe(vacio, 2026, 8).libre, 0);
revisar('Y su porcentaje comprometido es 0, no infinito',
  Sueldo.sueldoLibreDe(vacio, 2026, 8).porcentajeComprometido, 0);
revisar('Sin cuotas no hay fecha de liberación', Sueldo.fechaDeLiberacion(vacio, HOY), null);
revisar('Y no hay meses apretados que avisar', Sueldo.mesesQueVienenApretados(vacio, 2026, 8, 12).length, 0);

const metaCumplida = { ...vacio, metas: [
  { id:'g', nombre:'Listo', montoObjetivo: 100000, montoActual: 100000, aporteMensual: 50000 }] };
revisar('Una meta ya cumplida deja de pedir aporte',
  Sueldo.sueldoLibreDe(metaCumplida, 2026, 8).metas, 0);

const casiCumplida = { ...vacio, metas: [
  { id:'g', nombre:'Casi', montoObjetivo: 100000, montoActual: 80000, aporteMensual: 50000 }] };
revisar('Y la última cuota de una meta pide solo lo que falta',
  Sueldo.sueldoLibreDe(casiCumplida, 2026, 8).metas, 20000);

const soloIngreso = { ...vacio, ingresosPrevistos: [
  { id:'i', nombre:'Sueldo', monto: 500000, frecuencia:'mensual', diaDelMes: 30, activo: true }] };
revisar('Sin nada comprometido, el sueldo libre es todo el sueldo',
  Sueldo.sueldoLibreDe(soloIngreso, 2026, 8).libre, 500000);

/* ------------------------------------------------------------ */

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: el sueldo libre cuadra y se puede explicar.`);
