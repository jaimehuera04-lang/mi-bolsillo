/* ============================================================
   herramientas/probar-migracion.js

   Corre la migración del esquema 1 al 2 y revisa que NO se haya
   perdido ni movido un peso. Se ejecuta en Node, sin navegador,
   porque el motor de /src/core son funciones puras.

   Uso:
     node herramientas/probar-migracion.js
        -> prueba con datos de ejemplo

     node herramientas/probar-migracion.js mi-bolsillo-2026-08-24.json
        -> prueba con TU respaldo de verdad (el que descargas
           desde Ajustes). No lo modifica: solo lo lee.

   Si algo no calza, lo dice y termina con error.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* Cargamos los archivos del navegador en un contexto compartido,
   en el mismo orden que index.html. */
const contexto = vm.createContext({ console, Intl, Date, Math, JSON });
for (const archivo of [
  'src/data/categorias.js',
  'src/core/fechas.js',
  'src/core/dinero.js',
  'src/core/calculos.js',
  'src/storage/esquema.js',
  'src/storage/migraciones.js',
]) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
// Los archivos declaran sus modulos con const, así que no quedan colgando del
// objeto global: hay que pedirlos con una expresion dentro del mismo contexto.
const { Migraciones, Calculos } =
  vm.runInContext('({ Migraciones, Calculos, Esquema })', contexto);

/* ------------------------------------------------------------
   Un estado del esquema 1, como el que hay hoy en el celular.
   ------------------------------------------------------------ */
function datosDeEjemploV1() {
  return {
    version: 1,
    movimientos: [
      { id: 'a1', tipo: 'ingreso', monto: 750000, categoria: 'sueldo',      nota: 'Sueldo',    fecha: '2026-08-01', creado: '2026-08-01T12:00:00.000Z' },
      { id: 'a2', tipo: 'gasto',   monto: 320000, categoria: 'vivienda',    nota: 'Arriendo',  fecha: '2026-08-02', creado: '2026-08-02T12:00:00.000Z' },
      { id: 'a3', tipo: 'gasto',   monto: 92000,  categoria: 'comida',      nota: 'Feria',     fecha: '2026-08-04', creado: '2026-08-04T12:00:00.000Z' },
      { id: 'a4', tipo: 'gasto',   monto: 8900,   categoria: 'restaurante', nota: 'Almuerzo',  fecha: '2026-08-06', creado: '2026-08-06T12:00:00.000Z' },
      { id: 'a5', tipo: 'gasto',   monto: 6500,   categoria: 'restaurante', nota: 'Cafe',      fecha: '2026-08-07', creado: '2026-08-07T12:00:00.000Z' },
      { id: 'a6', tipo: 'ingreso', monto: 60000,  categoria: 'extra',       nota: 'Pololito',  fecha: '2026-08-14', creado: '2026-08-14T12:00:00.000Z' },
      { id: 'a7', tipo: 'gasto',   monto: 45000,  categoria: 'deuda',       nota: 'Cuota CMR', fecha: '2026-07-20', creado: '2026-07-20T12:00:00.000Z' },
      { id: 'a8', tipo: 'gasto',   monto: 12000,  categoria: 'transporte',  nota: 'Bip',       fecha: '2026-07-05', creado: '2026-07-05T12:00:00.000Z' },
    ],
    metas: [
      { id: 'm1', nombre: 'Fondo de emergencia', objetivo: 900000, ahorrado: 180000, emoji: '🛟', fechaLimite: '2027-03-01', creada: '2026-08-01' },
    ],
    presupuestos: { comida: 130000, restaurante: 40000 },
    ajustes: {
      correo: 'alguien@ejemplo.com', registrado: true, nombre: 'Alguien',
      moneda: 'CLP', ingresoEsperado: 750000, tutorialVisto: true,
    },
  };
}

/* ------------------------------------------------------------
   Totales calculados A MANO sobre el esquema 1, para tener con
   que comparar sin usar el mismo código que estamos probando.
   ------------------------------------------------------------ */
function totalesV1(viejo) {
  const porMes = {};
  for (const m of viejo.movimientos || []) {
    const mes = m.fecha.slice(0, 7);
    porMes[mes] = porMes[mes] || { ingresos: 0, gastos: 0, cantidad: 0 };
    if (m.tipo === 'ingreso') porMes[mes].ingresos += Math.round(m.monto);
    else porMes[mes].gastos += Math.round(m.monto);
    porMes[mes].cantidad++;
  }
  return porMes;
}

/* ------------------------------------------------------------ */
let fallas = 0;
function revisar(titulo, condicion, detalle) {
  const marca = condicion ? '  OK  ' : ' FALLA';
  console.log(`${marca}  ${titulo}${detalle ? `  (${detalle})` : ''}`);
  if (!condicion) fallas++;
}

function main() {
  const archivo = process.argv[2];
  const viejo = archivo
    ? JSON.parse(fs.readFileSync(archivo, 'utf8'))
    : datosDeEjemploV1();

  console.log(archivo
    ? `\nProbando la migración con tu respaldo: ${archivo}\n`
    : '\nProbando la migración con datos de ejemplo\n');

  const antes = totalesV1(viejo);
  const r = Migraciones.aplicar(viejo);
  const nuevo = r.estado;

  console.log(`Esquema ${r.desde} -> ${r.hasta}\n`);

  /* --- 1. Nada se perdio --- */
  revisar('Todos los movimientos siguen ahí',
    nuevo.movimientos.length === (viejo.movimientos || []).length,
    `${(viejo.movimientos || []).length} antes, ${nuevo.movimientos.length} después`);

  revisar('Todas las metas siguen ahí',
    nuevo.metas.length === (viejo.metas || []).length,
    `${(viejo.metas || []).length} antes, ${nuevo.metas.length} después`);

  revisar('Los topes siguen iguales',
    JSON.stringify(nuevo.presupuestos) === JSON.stringify(viejo.presupuestos || {}));

  /* --- 2. Los números de cada mes no se movieron --- */
  let mesesOk = true;
  const detalles = [];
  for (const [mes, t] of Object.entries(antes)) {
    const [anio, m] = mes.split('-').map(Number);
    const rr = Calculos.resumenDelMes(nuevo, anio, m - 1);
    if (rr.ingresos !== t.ingresos || rr.gastos !== t.gastos || rr.cantidad !== t.cantidad) {
      mesesOk = false;
      detalles.push(`${mes}: antes ${t.ingresos}/${t.gastos}, ahora ${rr.ingresos}/${rr.gastos}`);
    }
  }
  revisar('Ingresos y gastos de cada mes dan lo mismo', mesesOk,
    detalles.join(' | ') || `${Object.keys(antes).length} meses revisados`);

  /* --- 3. Ningún movimiento quedo sin cuenta --- */
  const huerfanos = nuevo.movimientos.filter(m =>
    (m.tipo === 'gasto'   && !m.cuentaOrigen) ||
    (m.tipo === 'ingreso' && !m.cuentaDestino));
  revisar('Cada movimiento quedo apuntando a una cuenta',
    huerfanos.length === 0, `${huerfanos.length} sueltos`);

  /* --- 4. Las metas conservan sus montos --- */
  const metasOk = (viejo.metas || []).every((vieja, i) => {
    const n = nuevo.metas[i];
    return n && n.montoObjetivo === Math.round(vieja.objetivo)
             && n.montoActual === Math.round(vieja.ahorrado);
  });
  revisar('Las metas conservan objetivo y ahorrado', metasOk);

  /* --- 5. El esquema quedo marcado --- */
  revisar('El objeto quedo marcado como esquema 2',
    nuevo.meta.schemaVersion === 2, `es ${nuevo.meta.schemaVersion}`);

  /* --- 6. El registro y el nombre siguen ahí --- */
  const a = (viejo.ajustes || {});
  revisar('El correo y el nombre se conservan',
    nuevo.ajustes.correo === (a.correo || '') && nuevo.ajustes.nombre === (a.nombre || ''));

  /* --- 7. Regla 7: una transferencia no mueve el patrimonio --- */
  const cuentaA = nuevo.cuentas[0];
  const cuentaB = {
    id: 'cuenta-prueba', nombre: 'Efectivo', tipo: 'efectivo',
    saldoInicial: 50000, icono: '💵', activa: true, fechaCreacion: '2026-08-01',
  };
  const conDosCuentas = { ...nuevo, cuentas: [...nuevo.cuentas, cuentaB] };

  const patrimonioAntes = Calculos.patrimonio(conDosCuentas);
  const agosto = Calculos.resumenDelMes(conDosCuentas, 2026, 7);

  const conTransferencia = {
    ...conDosCuentas,
    movimientos: [...conDosCuentas.movimientos, {
      id: 'transfer-prueba', tipo: 'transferencia', monto: 30000, fecha: '2026-08-20',
      categoria: null, cuentaOrigen: cuentaA.id, cuentaDestino: cuentaB.id,
      nota: 'Saque plata del cajero', creado: '2026-08-20T12:00:00.000Z',
    }],
  };
  const patrimonioDespues = Calculos.patrimonio(conTransferencia);
  const agostoDespues = Calculos.resumenDelMes(conTransferencia, 2026, 7);

  revisar('Una transferencia deja el patrimonio igual',
    patrimonioAntes === patrimonioDespues,
    `${patrimonioAntes} vs ${patrimonioDespues}`);

  revisar('Una transferencia no aparece como ingreso ni como gasto',
    agosto.ingresos === agostoDespues.ingresos && agosto.gastos === agostoDespues.gastos,
    `${agostoDespues.ingresos} / ${agostoDespues.gastos}`);

  revisar('La plata si se movio de una cuenta a la otra',
    Calculos.saldoDeCuenta(conTransferencia, cuentaB.id)
      - Calculos.saldoDeCuenta(conDosCuentas, cuentaB.id) === 30000);

  /* --- 8. Regla 8: comprar con tarjeta y pagar la tarjeta no se cuenta dos veces --- */
  const tarjeta = {
    id: 'tarjeta-prueba', nombre: 'CMR', tipo: 'credito',
    saldoInicial: 0, icono: '💳', activa: true, fechaCreacion: '2026-08-01',
  };
  const conTarjeta = {
    ...conDosCuentas,
    cuentas: [...conDosCuentas.cuentas, tarjeta],
    movimientos: [...conDosCuentas.movimientos,
      { id: 'compra', tipo: 'gasto', monto: 78000, fecha: '2026-08-09', categoria: 'ropa',
        cuentaOrigen: tarjeta.id, cuentaDestino: null, nota: 'Zapatillas', creado: '2026-08-09T12:00:00.000Z' },
      { id: 'pago', tipo: 'transferencia', monto: 78000, fecha: '2026-08-15', categoria: null,
        cuentaOrigen: cuentaA.id, cuentaDestino: tarjeta.id, nota: 'Pago CMR', creado: '2026-08-15T12:00:00.000Z' },
    ],
  };
  const conTarjetaAgosto = Calculos.resumenDelMes(conTarjeta, 2026, 7);
  revisar('Comprar con tarjeta y pagarla suma el gasto una sola vez',
    conTarjetaAgosto.gastos === agosto.gastos + 78000,
    `${agosto.gastos} + 78000 = ${conTarjetaAgosto.gastos}`);
  revisar('La tarjeta queda saldada después de pagarla',
    Calculos.saldoDeCuenta(conTarjeta, tarjeta.id) === 0);

  /* ------------------------------------------------------------ */
  console.log('');
  if (fallas) {
    console.log(`${fallas} ${fallas === 1 ? 'revision fallo' : 'revisiones fallaron'}. NO migres con estos datos.\n`);
    process.exit(1);
  }
  console.log('Todo cuadra: la migración no perdio ni movio un peso.\n');
}

main();
