/* ============================================================
   herramientas/probar-lector.js

   Le pasa al lector comprobantes y cartolas chilenas de verdad y
   revisa que saque lo que corresponde. Corre en Node, sin
   navegador, porque /src/core son funciones puras.

   Uso:
     node herramientas/probar-lector.js
        -> corre las pruebas de siempre

     node herramientas/probar-lector.js comprobante.txt
        -> te muestra qué entendió de TU archivo (solo lo lee)

   Termina con error si alguna prueba no calza.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

const contexto = vm.createContext({ console, Intl, Date, Math, JSON, Number, RegExp });
for (const archivo of ['src/data/pistas.js', 'src/core/lector.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { Lector } = vm.runInContext('({ Lector, Pistas })', contexto);

const HOY = '2026-09-01';

/* ------------------------------------------------------------
   Los papeles con los que se topa alguien en Chile.
   ------------------------------------------------------------ */

const COMPROBANTE_BANCOESTADO = `
BancoEstado
Comprobante de Transferencia
Transferencia enviada exitosamente

Fecha: 28/08/2026 14:32
N° de operacion: 184920355

Destinatario: Comercial Los Aromos SpA
RUT: 76.543.210-8
Banco: Banco de Chile
Cuenta N°: 001234567890

Monto transferido: $45.990

Comentario: pago arriendo bodega
`;

const BOLETA_LIDER = `
LIDER EXPRESS PROVIDENCIA
Av. Providencia 2124, Santiago
R.U.T.: 96.439.000-2
BOLETA ELECTRONICA N° 0034521

12/07/2026

3 x PAN MARRAQUETA          2.970
1 x LECHE ENTERA 1L         1.190
2 x DETERGENTE 3KG         11.980
1 x POLLO ENTERO            7.450

SUBTOTAL                   23.590
TOTAL A PAGAR             $23.590

Timbre electronico SII
Res. 80 de 2014
`;

const LIQUIDACION = `
LIQUIDACION DE SUELDO
Periodo: agosto 2026
Trabajador: Jaime Huera
RUT 18.765.432-1

HABERES
Sueldo base                 780.000
Gratificacion                65.000
Total haberes               845.000

DESCUENTOS
AFP Habitat                  84.500
Fonasa                       59.150
Total descuentos            143.650

LIQUIDO A PAGAR            $701.350
Fecha de pago: 30/08/2026
`;

const TRANSFERENCIA_RECIBIDA = `
Mi Banco
Transferencia recibida

Te transfirieron $120.000
De: Sofia Contreras
Fecha 15/08/2026
`;

const CARTOLA_CSV = `Cartola Cuenta Corriente
Titular;Jaime Huera;RUT;18.765.432-1

Fecha;Descripcion;Cargo;Abono;Saldo
02/08/2026;COMPRA JUMBO KENNEDY;68.450;;431.550
05/08/2026;PAGO PAT ENEL DISTRIBUCION;38.900;;392.650
05/08/2026;SPOTIFY AB;5.990;;386.660
10/08/2026;TRANSFERENCIA DE SOFIA CONTRERAS;;120.000;506.660
14/08/2026;UBER TRIP;7.320;;499.340
28/08/2026;ABONO REMUNERACION EMPRESA XYZ;;701.350;1.200.690
`;

const CARTOLA_PEGADA = `
02/08/2026  COMPRA CRUZ VERDE MAIPU        -12.490
04/08/2026  PEDIDOSYA                       -9.800
09/08/2026  TRANSFERENCIA RECIBIDA JUAN     50.000
20/08/2026  CARGO NETFLIX.COM               -9.700
`;

/* ------------------------------------------------------------
   Las pruebas
   ------------------------------------------------------------ */

let fallos = 0;
let hechas = 0;

function revisar(titulo, obtenido, esperado) {
  hechas++;
  const iguales = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!iguales) {
    fallos++;
    console.log(`  ✗ ${titulo}`);
    console.log(`      esperaba: ${JSON.stringify(esperado)}`);
    console.log(`      obtuvo:   ${JSON.stringify(obtenido)}`);
  } else {
    console.log(`  ✓ ${titulo}`);
  }
}

function probarComprobante(nombre, texto, esperado) {
  console.log(`\n${nombre}`);
  const r = Lector.leerComprobante(texto, { hoy: HOY });
  for (const [campo, valor] of Object.entries(esperado)) {
    revisar(campo, r[campo], valor);
  }
  return r;
}

console.log('======================================');
console.log('  Lector de comprobantes y cartolas');
console.log('======================================');

probarComprobante('Transferencia enviada (BancoEstado)', COMPROBANTE_BANCOESTADO, {
  tipo: 'gasto',
  monto: 45990,
  fecha: '2026-08-28',
});

probarComprobante('Boleta de supermercado (Lider)', BOLETA_LIDER, {
  tipo: 'gasto',
  monto: 23590,
  fecha: '2026-07-12',
  categoria: 'comida',
});

probarComprobante('Liquidacion de sueldo', LIQUIDACION, {
  tipo: 'ingreso',
  monto: 701350,
  categoria: 'sueldo',
});

probarComprobante('Transferencia recibida', TRANSFERENCIA_RECIBIDA, {
  tipo: 'ingreso',
  tipoDetectado: true,
  monto: 120000,
  fecha: '2026-08-15',
});

/* Una foto no trae ni una palabra que leer. El lector no puede aprovechar
   eso para dar vuelta lo que la persona ya había elegido en pantalla. */
console.log('\nUna foto, que no trae texto');
const soloFecha = Lector.leerComprobante('', { hoy: HOY, fechaAlternativa: '2026-07-15' });
revisar('no se inventa el tipo', soloFecha.tipoDetectado, false);
revisar('no se inventa el monto', soloFecha.monto, null);
revisar('si usa la fecha en que se tomo', soloFecha.fecha, '2026-07-15');

/* ------------------------------------------------------------
   El texto que copia el iPhone de una CAPTURA DE PANTALLA.

   Es el caso mas comun de todos y el mas desordenado: los rotulos
   quedan en una linea y los valores en la siguiente, viene la hora
   del telefono arriba, la tarjeta enmascarada y el numero de
   comprobante. Nada de eso puede confundirse con el monto.
   ------------------------------------------------------------ */
const CAPTURA_DEL_BANCO = `9:41
Banco de Chile
Transferencia enviada
Monto
$45.990
Destinatario
SUPERMERCADO LIDER PROVIDENCIA
Cuenta corriente ****4821
Fecha
28/08/2026
Comprobante N 184920355
Listo`;

probarComprobante('Captura de pantalla de la app del banco', CAPTURA_DEL_BANCO, {
  tipo: 'gasto',
  monto: 45990,
  fecha: '2026-08-28',
  categoria: 'comida',
});

console.log('\nLo que no puede colarse desde una captura');
revisar('la hora del telefono no es un monto',
  (Lector.montoDe('9:41') || {}).valor, undefined);
revisar('la tarjeta enmascarada tampoco',
  (Lector.montoDe('Cuenta corriente ****4821') || {}).valor, undefined);
revisar('el numero de comprobante tampoco',
  (Lector.montoDe('Comprobante N 184920355') || {}).valor, undefined);

/* ---- Que NO se lleve el RUT ni el folio como monto ---- */
console.log('\nNumeros que no son plata');
revisar('el RUT del comercio no es un monto',
  Lector.montoDe('RUT: 76.543.210-8') === null, true);
revisar('el folio no es un monto',
  (Lector.montoDe('N° de operacion: 184920355') || {}).valor, undefined);
revisar('un ano suelto no es un monto',
  Lector.montoDe('Res. 80 de 2014') === null, true);

/* ---- Cartola con encabezados ---- */
console.log('\nCartola CSV del banco');
const cartola = Lector.leerCartola(CARTOLA_CSV, { hoy: HOY });
revisar('la reconoce como tabla', cartola.conEncabezado, true);
revisar('encuentra las 6 lineas', cartola.filas.length, 6);
revisar('el cargo del Jumbo es gasto',
  { t: cartola.filas[0].tipo, m: cartola.filas[0].monto, c: cartola.filas[0].categoria },
  { t: 'gasto', m: 68450, c: 'comida' });
revisar('el abono de Sofia es ingreso',
  { t: cartola.filas[3].tipo, m: cartola.filas[3].monto },
  { t: 'ingreso', m: 120000 });
revisar('la remuneracion queda como sueldo',
  { t: cartola.filas[5].tipo, m: cartola.filas[5].monto, c: cartola.filas[5].categoria },
  { t: 'ingreso', m: 701350, c: 'sueldo' });
revisar('el saldo no se cuela como monto',
  cartola.filas.every(f => f.monto !== 431550 && f.monto !== 1200690), true);

/* ---- Cartola pegada a mano ---- */
console.log('\nCartola pegada desde la pantalla del banco');
const pegada = Lector.leerCartola(CARTOLA_PEGADA, { hoy: HOY });
revisar('encuentra las 4 lineas', pegada.filas.length, 4);
revisar('el signo menos manda',
  { t: pegada.filas[0].tipo, m: pegada.filas[0].monto, c: pegada.filas[0].categoria },
  { t: 'gasto', m: 12490, c: 'salud' });
revisar('lo que llega sin signo es ingreso',
  { t: pegada.filas[2].tipo, m: pegada.filas[2].monto },
  { t: 'ingreso', m: 50000 });
revisar('Netflix cae en suscripciones', pegada.filas[3].categoria, 'suscripcion');

/* ---- Lo que viene con fecha de manana ---- */
console.log('\nUna cartola adelantada');
const adelantada = Lector.leerCartola(
  `Fecha;Descripcion;Cargo;Abono;Saldo
02/08/2026;COMPRA JUMBO;68.450;;431.550
15/12/2026;CUOTA QUE VIENE;45.000;;386.550
20/12/2026;OTRA CUOTA QUE VIENE;45.000;;341.550
`, { hoy: HOY });
revisar('solo anota lo que ya paso', adelantada.filas.length, 1);
revisar('cuenta las que dejo fuera', adelantada.futuras, 2);

/* ---- Fechas ---- */
console.log('\nFechas');
revisar('dd/mm/aaaa se lee a la chilena',
  (Lector.fechasDe('Fecha: 03/04/2026')[0] || {}).iso, '2026-04-03');
revisar('el formato ISO tambien',
  (Lector.fechasDe('2026-04-03')[0] || {}).iso, '2026-04-03');
revisar('"12 de marzo de 2026" tambien',
  (Lector.fechasDe('12 de marzo de 2026')[0] || {}).iso, '2026-03-12');
revisar('el 31 de febrero no existe', Lector.fechasDe('31/02/2026').length, 0);

/* ------------------------------------------------------------
   Modo "muestrame lo que entendiste de MI archivo"
   ------------------------------------------------------------ */
const propio = process.argv[2];
if (propio) {
  console.log(`\n======================================`);
  console.log(`  Tu archivo: ${propio}`);
  console.log(`======================================`);
  const texto = fs.readFileSync(propio, 'utf8');
  const cartolaPropia = Lector.leerCartola(texto, { hoy: HOY });
  if (cartolaPropia.filas.length > 1) {
    console.log(`Parece una cartola con ${cartolaPropia.filas.length} movimientos:`);
    for (const f of cartolaPropia.filas) {
      console.log(`  ${f.fecha}  ${f.tipo === 'gasto' ? '-' : '+'}${f.monto}  ${f.categoria || '?'}  ${f.nota}`);
    }
  } else {
    console.log(JSON.stringify(Lector.leerComprobante(texto, { hoy: HOY }), null, 2));
  }
}

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron.`);
