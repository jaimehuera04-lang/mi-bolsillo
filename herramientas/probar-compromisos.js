/* ============================================================
   herramientas/probar-compromisos.js

   La puerta de datos de los compromisos, de punta a punta, con
   el almacenamiento de verdad (un localStorage en memoria).

   Lo que más importa revisar acá: que una compra en cuotas genere
   UN gasto y N compromisos, que pagar una cuota de tarjeta no
   cuente el gasto dos veces (Regla 8), y que el sueldo libre se
   mueva cuando corresponde y solo cuando corresponde.

   Uso:
     node herramientas/probar-compromisos.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

const memoria = {};
const localStorage = {
  getItem: k => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => { memoria[k] = String(v); },
  removeItem: k => { delete memoria[k]; },
};

const contexto = vm.createContext({
  console, Intl, Date, Math, JSON, Number, RegExp, Object, Array, String, Boolean,
  Set, Map, isNaN, parseInt, parseFloat, localStorage,
});

for (const archivo of [
  'src/data/categorias.js', 'src/data/tecnicas.js', 'src/data/estacionales.js',
  'src/core/fechas.js', 'src/core/dinero.js', 'src/core/calculos.js',
  'src/core/sugerencias.js', 'src/core/negocio.js', 'src/core/sueldo.js',
  'src/storage/esquema.js', 'src/storage/migraciones.js', 'src/storage/almacenamiento.js',
  'src/datos.js', 'src/datos-negocio.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { Datos, Sueldo, Esquema } = vm.runInContext('({ Datos, Sueldo, Esquema })', contexto);

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

function revisarQueSeQueje(titulo, fn) {
  hechas++;
  try {
    fn();
    fallos++;
    console.log(`  ✗ ${titulo}`);
    console.log('      esperaba un error y no hubo ninguno');
  } catch (e) {
    console.log(`  ✓ ${titulo}  ("${e.message}")`);
  }
}

/* ------------------------------------------------------------ */

Datos.cargar();
const hoy = new Date();
const ANIO = hoy.getFullYear();
const MES = hoy.getMonth();
const claveMes = (a, m) => `${a}-${String(m + 1).padStart(2, '0')}`;

console.log('\nUn recién llegado');

revisar('Su sueldo libre es cero, no un error', Datos.sueldoLibre(ANIO, MES).libre, 0);
revisar('No tiene fecha de liberación', Datos.fechaLiberacion(), null);
revisar('Ni meses apretados que avisar', Datos.mesesApretados(ANIO, MES).length, 0);

console.log('\nEl ingreso previsto');

revisarQueSeQueje('Sin nombre no se puede guardar',
  () => Datos.agregarIngresoPrevisto({ nombre: '  ', monto: 750000 }));
revisarQueSeQueje('Ni con monto cero',
  () => Datos.agregarIngresoPrevisto({ nombre: 'Sueldo', monto: 0 }));

Datos.agregarIngresoPrevisto({ nombre: 'Sueldo', monto: 750000, diaDelMes: 30 });
revisar('Con un sueldo previsto, todo es libre todavía', Datos.sueldoLibre(ANIO, MES).libre, 750000);
revisar('Y no hay nada comprometido', Datos.sueldoLibre(ANIO, MES).porcentajeComprometido, 0);

console.log('\nLos compromisos fijos');

const div = Datos.agregarCompromisoFijo({ nombre: 'Dividendo', monto: 320000, diaDelMes: 5, categoria: 'vivienda' });
Datos.agregarCompromisoFijo({ nombre: 'Isapre', monto: 95000, diaDelMes: 10, categoria: 'salud' });
revisar('Bajan el sueldo libre', Datos.sueldoLibre(ANIO, MES).libre, 750000 - 415000);
revisar('Y aparecen en el desglose', Datos.sueldoLibre(ANIO, MES).detalle.fijos.length, 2);
revisar('El mes que viene siguen ahí',
  Datos.sueldoLibre(ANIO, MES + 1 > 11 ? ANIO + 1 : ANIO, (MES + 1) % 12).fijos, 415000);

const cae = Datos.agregarCompromisoFijo({ nombre: 'CAE', monto: 62000, diaDelMes: 20, categoria: 'educacion' });
Datos.terminarCompromiso(cae.id, claveMes(ANIO, MES));
revisar('Un compromiso terminado este mes todavía cuenta este mes',
  Datos.sueldoLibre(ANIO, MES).fijos, 415000 + 62000);
const sig = new Date(ANIO, MES + 1, 1);
revisar('Pero ya no el mes siguiente',
  Datos.sueldoLibre(sig.getFullYear(), sig.getMonth()).fijos, 415000);
revisar('Y no se borró: sigue en la lista con su historia',
  Datos.compromisos().some(c => c.id === cae.id), true);

console.log('\nUna compra en cuotas (Regla 2)');

const movsAntes = Datos.obtener().movimientos.length;
const compra = Datos.comprarEnCuotas({
  nombre: 'Refrigerador', monto: 479880, cuotas: 12,
  primeraFecha: `${claveMes(ANIO, MES)}-05`, categoria: 'deuda',
  cuenta: Datos.cuentasActivas()[0].id, anotarElGasto: true,
});

revisar('Generó doce compromisos', compra.cuotas.length, 12);
revisar('Y UN solo gasto de hoy', Datos.obtener().movimientos.length, movsAntes + 1);
revisar('La suma de las cuotas es el total', compra.cuotas.reduce((t, c) => t + c.monto, 0), 479880);
revisar('Todas comparten la misma compra', new Set(compra.cuotas.map(c => c.compraId)).size, 1);
revisar('La primera se llama "1/12"', compra.cuotas[0].nombre, 'Refrigerador 1/12');
revisar('La cuota de este mes baja el sueldo libre', Datos.sueldoLibre(ANIO, MES).cuotas, 39990);

const agrupadas = Datos.comprasEnCuotas();
revisar('Se agrupan por compra', agrupadas.length, 1);
revisar('Con el nombre sin el "1/12" pegado', agrupadas[0].nombre, 'Refrigerador');
revisar('Doce cuotas, ninguna pagada', [agrupadas[0].cuantas, agrupadas[0].pagadas], [12, 0]);

revisarQueSeQueje('Sesenta y una cuotas no se aceptan',
  () => Datos.comprarEnCuotas({ nombre: 'Algo', monto: 1000, cuotas: 61 }));

console.log('\nPagar una cuota de tarjeta NO cuenta el gasto dos veces (Regla 8)');

const gastosAntes = Datos.resumenDelMes(ANIO, MES).gastos;
const tarjeta = Datos.agregarCuenta({ nombre: 'CMR', tipo: 'credito', saldoInicial: -479880 });
const pago = Datos.pagarCompromiso(compra.cuotas[0].id, {
  cuentaOrigen: Datos.cuentasActivas()[0].id,
  cuentaDestino: tarjeta.id,
  comoTransferencia: true,
});
revisar('El pago quedó como transferencia', pago.movimiento.tipo, 'transferencia');
revisar('Y los gastos del mes NO subieron', Datos.resumenDelMes(ANIO, MES).gastos, gastosAntes);
revisar('La cuota quedó pagada', Datos.compromisoPorId(compra.cuotas[0].id).estado, 'pagado');
revisar('La tarjeta bajó su deuda', Datos.saldoDeCuenta(tarjeta.id), -479880 + 39990);

Datos.despagarCompromiso(compra.cuotas[0].id);
revisar('Deshacer el pago se lleva el movimiento', Datos.obtener().movimientos.length, movsAntes + 1);
revisar('Y la deja pendiente otra vez', Datos.compromisoPorId(compra.cuotas[0].id).estado, 'pendiente');

console.log('\nLa fecha de liberación');

const lib = Datos.fechaLiberacion();
revisar('Sale de las cuotas y no de los fijos', lib.cuantasCuotas, 12);
revisar('Es la fecha de la última cuota', lib.fecha, compra.cuotas[11].fecha);
revisar('De una sola compra', lib.compras, 1);

console.log('\nLos estacionales chilenos');

revisar('Hay plantillas para partir', Datos.PLANTILLAS_ESTACIONALES.length > 8, true);
const matricula = Datos.agregarEstacionalDePlantilla('matricula', 380000);
revisar('La matrícula cae en marzo', matricula.mes, 2);
revisar('Con el monto que le puse', matricula.monto, 380000);
const marzoQueViene = ANIO + (MES > 2 ? 1 : 0);
revisar('Y aparece en el marzo que corresponde',
  Datos.sueldoLibre(marzoQueViene, 2).estacionales, 380000);
revisar('Marzo explica por qué aprieta',
  Datos.porQueApretaElMes(2).toLowerCase().includes('matrícula'), true);

console.log('\nBorrar una compra se lleva TODAS sus cuotas');

const otra = Datos.comprarEnCuotas({ nombre: 'Notebook', monto: 600000, cuotas: 6,
  primeraFecha: `${claveMes(ANIO, MES)}-05` });
revisar('Ahora hay dos compras', Datos.comprasEnCuotas().length, 2);
Datos.borrarCompromiso(otra.cuotas[3].id);   // borro UNA cuota del medio
revisar('Borrar una se lleva las seis', Datos.comprasEnCuotas().length, 1);
revisar('Y las del refrigerador siguen enteras', Datos.comprasEnCuotas()[0].cuantas, 12);

console.log('\nEl simulador');

const sim = Datos.simularCuotas({ monto: 300000, cuotas: 6,
  desde: claveMes(ANIO, MES), diaDelMes: 5, anio: ANIO, mes: MES });
revisar('La cuota sale en 50.000', sim.valorCuota, 50000);
revisar('Compara doce meses antes y doce después', [sim.antes.length, sim.despues.length], [12, 12]);
// Estas seis cuotas NO llegan hasta marzo, así que no empeoran el peor
// mes: golpe 0 es la respuesta correcta y es información útil.
revisar('No empeora el peor mes, porque no llega hasta allá', sim.golpe, 0);
revisar('Pero sí dice cuál de los meses que toca queda peor',
  Boolean(sim.peorMesTocado), true);
revisar('Y cuánto le saca a ese mes', sim.leSaca, 50000);
revisar('Y que no mete ningún mes nuevo en rojo', sim.metesMesesEnRojo, 0);

// Una compra larga que SÍ cruza marzo: ahí el golpe tiene que aparecer
const largo = Datos.simularCuotas({ monto: 1200000, cuotas: 24,
  desde: claveMes(ANIO, MES), diaDelMes: 5, anio: ANIO, mes: MES });
revisar('Una compra que cruza marzo sí empeora el peor mes', largo.golpe > 0, true);
revisar('Y avisa que ya no alcanza', largo.alcanza, false);
revisar('Simular NO guardó nada', Datos.comprasEnCuotas().length, 1);
revisar('Ni tocó los compromisos de verdad',
  Datos.compromisos().some(c => String(c.id).startsWith('sim-')), false);

const guardada = Datos.guardarSimulacion({ nombre: 'TV', monto: 300000, cuotas: 6 });
revisar('Una simulación sí se puede guardar para volver a verla', Datos.simulaciones().length, 1);
Datos.borrarSimulacion(guardada.id);
revisar('Y borrar', Datos.simulaciones().length, 0);

console.log('\nTodo sobrevive a cerrar y abrir la app');

const antesDeRecargar = Datos.sueldoLibre(ANIO, MES).libre;
Datos.cargar();
revisar('El sueldo libre es el mismo', Datos.sueldoLibre(ANIO, MES).libre, antesDeRecargar);
revisar('Los compromisos siguen ahí', Datos.compromisos().length > 0, true);
// Contra el esquema ACTUAL y no contra un número escrito a mano: lo que
// importa acá es que guardar y recargar no lo deje a medio migrar, no
// cuál es el número de hoy. Con el número fijo, cada migración nueva
// rompía esta prueba sin que nada estuviera mal.
revisar('Y el esquema quedó al día',
  Datos.obtener().meta.schemaVersion, Esquema.VERSION_ESQUEMA);

/* ------------------------------------------------------------ */

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: los compromisos guardan bien y el sueldo libre cuadra.`);
