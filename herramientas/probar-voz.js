/* ============================================================
   herramientas/probar-voz.js

   Le pasa a core/voz.js frases dichas como las dice una persona
   en Chile y revisa que entienda lo mismo que entendería otra
   persona escuchando.

   Corre en Node, sin navegador y sin micrófono: lo que se prueba
   acá no es el dictado (eso lo hace el teléfono) sino lo difícil,
   que es entender "cinco lucas", "medio palo" y la diferencia
   entre "gané" y "gasté".

   Uso:
     node herramientas/probar-voz.js
     node herramientas/probar-voz.js "gaste 5 lucas en comida"
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const contexto = vm.createContext({ console, Math, JSON, Number, RegExp, Object, Array, String, Boolean, Date });
for (const archivo of ['src/data/pistas.js', 'src/core/voz.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { Voz } = vm.runInContext('({ Voz })', contexto);

const HOY = '2026-09-03';        // un jueves

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

/** Prueba una frase entera de una vez. */
function frase(dicho, esperado) {
  const r = Voz.entender(dicho, { hoy: HOY });
  console.log(`\n  "${dicho}"`);
  for (const [campo, valor] of Object.entries(esperado)) {
    revisar(`    ${campo}`, r[campo], valor);
  }
  return r;
}

/* ============================================================ */
console.log('\n=== LOS MONTOS, QUE ES LO DIFÍCIL ===');

const monto = d => { const m = Voz.montosDe(d); return m.length ? m[0].valor : null; };

console.log('\nEn dígitos, como los escribe el dictado');
revisar('50000',            monto('gane 50000'), 50000);
revisar('50.000 con punto', monto('gane 50.000'), 50000);
revisar('$5.000',           monto('gaste $5.000'), 5000);
revisar('50 mil',           monto('gane 50 mil'), 50000);
revisar('2 millones',       monto('gane 2 millones'), 2000000);

console.log('\nEn palabras');
revisar('cinco mil',                    monto('gaste cinco mil'), 5000);
revisar('cincuenta mil',                monto('gane cincuenta mil'), 50000);
revisar('mil quinientos',               monto('gaste mil quinientos'), 1500);
revisar('ciento veinte mil',            monto('gaste ciento veinte mil'), 120000);
revisar('doscientos cincuenta mil',     monto('gane doscientos cincuenta mil'), 250000);
revisar('treinta y cinco mil',          monto('gaste treinta y cinco mil'), 35000);
revisar('un millon',                    monto('gane un millon'), 1000000);
revisar('novecientos noventa y nueve',  monto('gaste novecientos noventa y nueve'), 999);

console.log('\nEn chileno, que es como se habla de verdad');
revisar('5 lucas',        monto('gaste 5 lucas'), 5000);
revisar('cinco lucas',    monto('gaste cinco lucas'), 5000);
revisar('veinte lucas',   monto('gaste veinte lucas'), 20000);
revisar('una luca',       monto('gaste una luca'), 1000);
revisar('luca sola',      monto('gaste una luca en el pan'), 1000);
revisar('un palo',        monto('gane un palo'), 1000000);
revisar('dos palos',      monto('gane dos palos'), 2000000);
revisar('medio palo',     monto('me pagaron medio palo'), 500000);
revisar('media luca',     monto('gaste media luca'), 500);
revisar('una gamba',      monto('gaste una gamba'), 100);
revisar('quinientas lucas', monto('gane quinientas lucas'), 500000);

console.log('\nDe varios montos se queda con el mayor');
revisar('2 kilos a 3 lucas, 6 lucas en total',
  Voz.entender('compre 2 kilos a 3 lucas, 6 lucas en total', { hoy: HOY }).monto, 6000);

/* ============================================================ */
console.log('\n\n=== ¿ENTRÓ O SALIÓ? ===');

const tipo = d => { const t = Voz.tipoDe(d); return t ? t.tipo : null; };
revisar('gane',            tipo('gane 50 lucas'), 'ingreso');
revisar('me pagaron',      tipo('me pagaron 50 lucas'), 'ingreso');
revisar('recibi',          tipo('recibi 20 mil'), 'ingreso');
revisar('vendi',           tipo('vendi una bici en 80 lucas'), 'ingreso');
revisar('me depositaron',  tipo('me depositaron el sueldo'), 'ingreso');
revisar('gaste',           tipo('gaste 5 lucas'), 'gasto');
revisar('pague',           tipo('pague la luz'), 'gasto');
revisar('compre',          tipo('compre pan'), 'gasto');
revisar('me costo',        tipo('me costo 30 lucas'), 'gasto');
revisar('sin verbo, no inventa nada', Voz.tipoDe('5 lucas comida'), null);
revisar('manda el que se dice primero',
  tipo('gaste 5 lucas en el regalo que me pagaron despues'), 'gasto');

/* ============================================================ */
console.log('\n\n=== CUÁNDO ===');

const fecha = d => { const f = Voz.fechaDe(d, HOY); return f ? f.fecha : null; };
revisar('hoy',            fecha('gaste 5 lucas hoy'), '2026-09-03');
revisar('ayer',           fecha('gaste 5 lucas ayer'), '2026-09-02');
revisar('antes de ayer',  fecha('gaste 5 lucas antes de ayer'), '2026-09-01');
revisar('anteayer',       fecha('gaste 5 lucas anteayer'), '2026-09-01');
revisar('el lunes',       fecha('el lunes gaste 5 lucas'), '2026-08-31');
revisar('el martes',      fecha('el martes pague la luz'), '2026-09-01');
// Hoy es jueves: "el jueves" es el jueves pasado, no hoy.
revisar('el jueves dicho un jueves es el anterior', fecha('el jueves compre pan'), '2026-08-27');
revisar('sin fecha dicha, null', Voz.fechaDe('gaste 5 lucas en pan', HOY), null);

/* ============================================================ */
console.log('\n\n=== LAS FRASES QUE ME DIJO JAIME ===');

frase('gane 50.000 por un trabajo que hice', {
  tipo: 'ingreso', monto: 50000, categoria: 'extra', fecha: HOY,
});

frase('gaste 5.000 en comida', {
  tipo: 'gasto', monto: 5000, categoria: 'comida', fecha: HOY,
});

/* ============================================================ */
console.log('\n\n=== COMO SE HABLA DE VERDAD ===');

frase('gaste veinte lucas en bencina ayer', {
  tipo: 'gasto', monto: 20000, categoria: 'transporte', fecha: '2026-09-02',
});

frase('me depositaron el sueldo, 750 mil', {
  tipo: 'ingreso', monto: 750000, categoria: 'sueldo',
});

frase('pague 42 mil de la cuenta de la luz', {
  tipo: 'gasto', monto: 42000, categoria: 'servicios',
});

frase('compre zapatillas en 45 lucas', {
  tipo: 'gasto', monto: 45000, categoria: 'ropa',
});

frase('me pagaron medio palo por la pega', {
  tipo: 'ingreso', monto: 500000, categoria: 'extra',
});

frase('gaste tres lucas en la micro', {
  tipo: 'gasto', monto: 3000, categoria: 'transporte',
});

frase('vendi el notebook en 200 lucas', {
  tipo: 'ingreso', monto: 200000, categoria: 'venta',
});

frase('pague la farmacia, 12.990', {
  tipo: 'gasto', monto: 12990, categoria: 'salud',
});

/* ============================================================ */
console.log('\n\n=== LA NOTA QUE QUEDA ===');

revisar('de "gane 50.000 por un trabajo que hice"',
  Voz.entender('gane 50.000 por un trabajo que hice', { hoy: HOY }).nota, 'Trabajo');
revisar('de "gaste 5.000 en comida"',
  Voz.entender('gaste 5.000 en comida', { hoy: HOY }).nota, 'Comida');
revisar('de "compre pan y leche en el almacen de la esquina"',
  Voz.entender('compre pan y leche en el almacen de la esquina', { hoy: HOY }).nota.length > 3, true);

/* ============================================================ */
console.log('\n\n=== LA EVIDENCIA: de dónde sacó cada cosa ===');

const conEvidencia = Voz.entender('gaste veinte lucas en bencina ayer', { hoy: HOY });
revisar('dice de dónde salió el monto',
  conEvidencia.evidencia.find(e => e.campo === 'monto').dicho, 'veinte lucas');
revisar('y de dónde el tipo',
  conEvidencia.evidencia.find(e => e.campo === 'tipo').dicho, 'gaste');
revisar('y la fecha',
  conEvidencia.evidencia.find(e => e.campo === 'fecha').dicho, 'ayer');
revisar('y la categoría',
  conEvidencia.evidencia.find(e => e.campo === 'categoria').dicho, 'bencina');
revisar('encontró las tres cosas que importan', conEvidencia.encontrados, 3);

/* ============================================================ */
console.log('\n\n=== VARIAS COSAS EN UNA FRASE ===');

const dos = Voz.entenderVarios('gaste 5 lucas en comida y 20 mil en bencina', { hoy: HOY });
revisar('salen dos movimientos', dos.length, 2);
revisar('el primero', [dos[0].monto, dos[0].categoria], [5000, 'comida']);
revisar('el segundo', [dos[1].monto, dos[1].categoria], [20000, 'transporte']);
revisar('el segundo hereda que era un gasto', dos[1].tipo, 'gasto');
revisar('y lo dice, no lo esconde', dos[1].tipoHeredado, true);

const conFecha = Voz.entenderVarios('ayer gaste 5 lucas en comida y 20 mil en bencina', { hoy: HOY });
revisar('la fecha dicha una vez vale para los dos',
  [conFecha[0].fecha, conFecha[1].fecha], ['2026-09-02', '2026-09-02']);

const unaSola = Voz.entenderVarios('gane 50 lucas por un trabajo que hice', { hoy: HOY });
revisar('una frase con "y" adentro pero un solo monto no se parte', unaSola.length, 1);

const conY = Voz.entenderVarios('compre pan y leche por 3 lucas', { hoy: HOY });
revisar('tampoco esta', conY.length, 1);
revisar('y conserva su monto', conY[0].monto, 3000);

/* ============================================================ */
console.log('\n\n=== LO QUE NO SE ENTIENDE ===');

const vacia = Voz.entender('', { hoy: HOY });
revisar('una frase vacía no revienta', vacia.monto, null);
revisar('y no encontró nada', vacia.encontrados, 0);

const sinMonto = Voz.entender('compre pan en el almacen', { hoy: HOY });
revisar('sin monto, lo dice', sinMonto.monto, null);
revisar('pero igual saca la categoría', sinMonto.categoria, 'comida');
revisar('y sabe que fue un gasto', sinMonto.tipo, 'gasto');

const puraCharla = Voz.entender('hola como estas', { hoy: HOY });
revisar('una frase que no es un movimiento no encuentra nada', puraCharla.encontrados, 0);
revisar('y no inventa un monto', puraCharla.monto, null);
revisar('marca gasto por defecto pero avisa que no lo dijo', puraCharla.tipoDetectado, false);

/* ------------------------------------------------------------
   Modo "dime qué entendiste de MI frase"
   ------------------------------------------------------------ */
const mia = process.argv[2];
if (mia) {
  console.log(`\n======================================`);
  console.log(`  "${mia}"`);
  console.log(`======================================`);
  console.log(JSON.stringify(Voz.entenderVarios(mia, { hoy: HOY }), null, 2));
}

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: la app entiende chileno hablado.`);
