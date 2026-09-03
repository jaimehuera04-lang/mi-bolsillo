/* ============================================================
   herramientas/probar-ocr.js

   Prueba el COSIDO DE FILAS: lo que hace que de un pantallazo del
   banco salgan ocho movimientos y no uno.

   El OCR mismo no se puede probar en Node (necesita el navegador
   para dibujar la imagen), pero lo que de verdad se puede romper
   es esto: cómo se vuelven a pegar las líneas que la app del
   banco apila. Acá va el texto tal cual lo devolvió Tesseract
   con pantallazos de verdad.

   Uso:
     node herramientas/probar-ocr.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const contexto = vm.createContext({ console, Math, JSON, Number, RegExp, Object, Array, String, Boolean, Date, Intl });
for (const archivo of ['src/data/pistas.js', 'src/core/lector.js', 'src/ui/ocr.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { UiOcr, Lector } = vm.runInContext('({ UiOcr, Lector })', contexto);

const HOY = '2026-09-03';

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

/* ------------------------------------------------------------
   Lo que Tesseract devolvió de verdad con un pantallazo de la
   app de BancoEstado: la fecha en su propia línea, y debajo la
   glosa con el monto.
   ------------------------------------------------------------ */

const PANTALLAZO_BANCOESTADO = `BancoEstado
Cuenta RUT ****4321
Ultimos movimientos
02/09/2026
COMPRA LIDER EXPRESS PROVIDENCIA $ -38.500
02/09/2026
COMPRA COPEC LOS LEONES $ -25.000
01/09/2026
TRANSFERENCIA RECIBIDA J PEREZ $ +120.000
31/08/2026
PAGO CUENTA ENEL DISTRIBUCION $ -42.310
30/08/2026
ABONO REMUNERACION $ +750.000
29/08/2026
COMPRA FARMACIA CRUZ VERDE $ -12.990
28/08/2026
COMPRA UBER EATS $ -9.450
27/08/2026
GIRO CAJERO AUTOMATICO $ -40.000`;

console.log('\nEl pantallazo de la app del banco');

const cosido = UiOcr.ordenar(PANTALLAZO_BANCOESTADO);
const lineas = cosido.split('\n');

revisar('La fecha se pega a su glosa',
  lineas.includes('02/09/2026 COMPRA LIDER EXPRESS PROVIDENCIA $ -38.500'), true);
revisar('Y no queda ninguna línea que sea solo una fecha',
  lineas.some(l => /^\d{2}\/\d{2}\/\d{4}$/.test(l)), false);
revisar('El encabezado del banco se conserva', lineas[0], 'BancoEstado');

const cartola = Lector.leerCartola(cosido, { hoy: HOY });
revisar('Ahora sí salen los OCHO movimientos', cartola.filas.length, 8);
revisar('El primero es el del Lider', cartola.filas[0].monto, 38500);
revisar('Y va como gasto', cartola.filas[0].tipo, 'gasto');
revisar('Con su fecha', cartola.filas[0].fecha, '2026-09-02');
revisar('La remuneración va como ingreso',
  cartola.filas.find(f => f.monto === 750000).tipo, 'ingreso');
revisar('La transferencia recibida también',
  cartola.filas.find(f => f.monto === 120000).tipo, 'ingreso');
revisar('El Lider quedó como supermercado', cartola.filas[0].categoria, 'comida');
revisar('Y la bencina como transporte',
  cartola.filas.find(f => f.monto === 25000).categoria, 'transporte');

/* ------------------------------------------------------------ */
console.log('\nSin coser, el lector no encontraría nada');

const sinCoser = Lector.leerCartola(PANTALLAZO_BANCOESTADO, { hoy: HOY });
revisar('Cero filas: por esto existe el cosido', sinCoser.filas.length, 0);

/* ------------------------------------------------------------ */
console.log('\nEl caso del monto en su propia línea');

// Algunas apps dejan la columna del monto tan a la derecha que el OCR
// la manda a una línea aparte.
// Fechas pasadas a propósito: el lector descarta las filas con fecha de
// mañana, y con razón. Ver 'futuras' en core/lector.js.
const MONTO_SUELTO = `02/09/2026
COMPRA JUMBO COSTANERA
-52.400
01/09/2026
PAGO SUSCRIPCION NETFLIX
-9.900`;

const cosido2 = UiOcr.ordenar(MONTO_SUELTO).split('\n');
revisar('La fecha, la glosa y el monto quedan en una sola línea',
  cosido2[0], '02/09/2026 COMPRA JUMBO COSTANERA -52.400');
revisar('Son dos líneas y no seis', cosido2.length, 2);
const cartola2 = Lector.leerCartola(UiOcr.ordenar(MONTO_SUELTO), { hoy: HOY });
revisar('Y el lector encuentra los dos movimientos', cartola2.filas.length, 2);

/* ------------------------------------------------------------ */
console.log('\nUna cartola que YA venía bien no se debe romper');

const YA_BIEN = `02/09/2026 COMPRA LIDER $ -38.500
01/09/2026 ABONO SUELDO $ +750.000
31/08/2026 PAGO ENEL $ -42.310`;
const cosido3 = UiOcr.ordenar(YA_BIEN).split('\n');
revisar('Sigue teniendo tres líneas', cosido3.length, 3);
revisar('Y ninguna se pegó con la de abajo', cosido3[0], '02/09/2026 COMPRA LIDER $ -38.500');
revisar('El lector la lee igual que antes',
  Lector.leerCartola(YA_BIEN, { hoy: HOY }).filas.length, 3);

/* ------------------------------------------------------------ */
console.log('\nLa basura que mete cualquier OCR');

const CON_RUIDO = `|
BancoEstado
o
02/09/2026
COMPRA LIDER $ -38.500
=`;
const cosido4 = UiOcr.ordenar(CON_RUIDO).split('\n');
revisar('Las líneas de un solo carácter se van',
  cosido4.some(l => l.length <= 1), false);
revisar('Y el movimiento sobrevive',
  cosido4.includes('02/09/2026 COMPRA LIDER $ -38.500'), true);

/* ------------------------------------------------------------ */
console.log('\nDos fechas seguidas no se pegan entre sí');

const DOS_FECHAS = `02/09/2026
03/09/2026
COMPRA ALGO $ -1.000`;
const cosido5 = UiOcr.ordenar(DOS_FECHAS).split('\n');
revisar('La primera fecha queda sola y la segunda toma la glosa',
  cosido5[1], '03/09/2026 COMPRA ALGO $ -1.000');

/* ------------------------------------------------------------ */
console.log('\nUn comprobante suelto, no una cartola');

const COMPROBANTE = `BancoEstado
Comprobante de Transferencia
Fecha: 28/08/2026
Monto transferido: $45.990
Destinatario: Comercial Los Aromos`;
const p = Lector.leerComprobante(UiOcr.ordenar(COMPROBANTE), { hoy: HOY });
revisar('Saca el monto', p.monto, 45990);
revisar('Y la fecha', p.fecha, '2026-08-28');
revisar('Y no lo confunde con una cartola',
  Lector.leerCartola(UiOcr.ordenar(COMPROBANTE), { hoy: HOY }).filas.length < 3, true);

/* ------------------------------------------------------------ */
console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: el pantallazo del banco se convierte en movimientos.`);
