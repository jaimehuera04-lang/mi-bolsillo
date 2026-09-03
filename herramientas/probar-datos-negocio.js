/* ============================================================
   herramientas/probar-datos-negocio.js

   Prueba la puerta de datos del negocio de punta a punta, con el
   almacenamiento de verdad (un localStorage de mentira en memoria)
   y con datos.js al lado, porque lo que más importa revisar acá es
   EL PUENTE: que un retiro cree su ingreso personal, y que borrarlo
   se lleve los dos.

   Uso:
     node herramientas/probar-datos-negocio.js

   Termina con error si alguna prueba no calza.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* Un localStorage en memoria: lo mismo que hace el navegador, sin navegador. */
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

const ARCHIVOS = [
  'src/data/categorias.js',
  'src/data/tecnicas.js',
  'src/core/fechas.js',
  'src/core/dinero.js',
  'src/core/calculos.js',
  'src/core/sugerencias.js',
  'src/core/negocio.js',
  'src/storage/esquema.js',
  'src/storage/migraciones.js',
  'src/storage/almacenamiento.js',
  'src/datos.js',
  'src/datos-negocio.js',
];
for (const archivo of ARCHIVOS) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { Datos, DatosNegocio, Negocio } =
  vm.runInContext('({ Datos, DatosNegocio, Negocio })', contexto);

/* ------------------------------------------------------------ */

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

/** Revisa que algo REVIENTE, y que reviente con un mensaje entendible. */
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

console.log('\nEncender el negocio');

revisar('Nace apagado', DatosNegocio.estaActivo(), false);
revisarQueSeQueje('Sin nombre no se enciende', () => DatosNegocio.encender({ nombre: '  ' }));
DatosNegocio.encender({ nombre: 'Almacén Doña Rosa', rubro: 'Almacén de barrio' });
revisar('Se encendió', DatosNegocio.estaActivo(), true);
revisar('Y guardó el nombre', DatosNegocio.perfil().nombre, 'Almacén Doña Rosa');

console.log('\nProductos y variantes');

const bebida = DatosNegocio.agregarProducto({
  nombre: 'Bebida 1,5 L', precio: 1990, costo: 1200, stockInicial: 24, stockMinimo: 6,
});
revisar('El stock inicial entró al libro, no a un campo suelto',
  DatosNegocio.stockDe(bebida.id, null), 24);
revisar('Y el libro tiene una sola entrada', DatosNegocio.todo().stock.length, 1);

const polera = DatosNegocio.agregarProducto({
  nombre: 'Polera', precio: 8990, costo: 4000, stockMinimo: 3,
});
const talla_s = DatosNegocio.agregarVariante(polera.id, { nombre: 'S', stockInicial: 5 });
const talla_m = DatosNegocio.agregarVariante(polera.id, { nombre: 'M', stockInicial: 2 });
revisar('Una variante hereda el precio del producto', talla_s.precio, 8990);
revisar('El stock del producto con tallas es la suma',
  DatosNegocio.stockTotalDe(DatosNegocio.productoPorId(polera.id)), 7);

const gas = DatosNegocio.agregarProducto({
  nombre: 'Recarga de gas', precio: 24000, costo: 19000, controlaStock: false,
});
revisarQueSeQueje('Un servicio no acepta movimientos de stock',
  () => DatosNegocio.moverStock({ productoId: gas.id, cantidad: 5 }));

console.log('\nEl inventario que uno cuenta a mano');

DatosNegocio.fijarStock({ productoId: bebida.id, hay: 22 });
revisar('Contar y encontrar 22 deja 22', DatosNegocio.stockDe(bebida.id, null), 22);
revisar('Y anotó la diferencia, no el número final',
  DatosNegocio.todo().stock.filter(m => m.motivo === 'conteo')[0].cantidad, -2);

console.log('\nUna venta');

const cliente = DatosNegocio.agregarFicha('clientes', { nombre: 'Doña Marta', telefono: '+56912345678' }, 'al cliente');
const camila  = DatosNegocio.agregarFicha('empleados', { nombre: 'Camila', rol: 'Vendedora' }, 'a la persona');

const venta = DatosNegocio.registrarVenta({
  clienteId: cliente.id,
  empleadoId: camila.id,
  lineas: [{ productoId: bebida.id, cantidad: 3 }],
  medioPago: 'efectivo',
  estado: 'pagada',
});
revisar('El folio parte en 1', venta.folio, 1);
revisar('El precio lo saca del producto', venta.lineas[0].precio, 1990);
revisar('El total cuadra', DatosNegocio.totalDe(venta), 5970);
revisar('Una venta pagada queda pagada completa', venta.pagado, 5970);
revisar('Y descontó de la bodega', DatosNegocio.stockDe(bebida.id, null), 19);

const conDescuento = DatosNegocio.registrarVenta({
  lineas: [{ productoId: gas.id, cantidad: 1 }],
  descuento: 1000, estado: 'fiada', pagado: 5000,
});
revisar('El folio siguió al 2', conDescuento.folio, 2);
revisar('El descuento se resta', DatosNegocio.totalDe(conDescuento), 23000);
revisar('Y queda debiendo la diferencia', DatosNegocio.saldoPendienteDe(conDescuento), 18000);

revisarQueSeQueje('Una venta sin productos no se registra',
  () => DatosNegocio.registrarVenta({ lineas: [] }));

console.log('\nEl precio de ayer no cambia si subo el de hoy');

DatosNegocio.editarProducto(bebida.id, { precio: 2490 });
revisar('La venta de ayer conserva su precio', DatosNegocio.ventaPorId(venta.id).lineas[0].precio, 1990);
revisar('Y su total tampoco se mueve', DatosNegocio.totalDe(DatosNegocio.ventaPorId(venta.id)), 5970);

console.log('\nAbonar y anular');

DatosNegocio.abonarAVenta(conDescuento.id, 10000);
revisar('El abono baja la deuda', DatosNegocio.saldoPendienteDe(DatosNegocio.ventaPorId(conDescuento.id)), 8000);
DatosNegocio.abonarAVenta(conDescuento.id, 99999);
revisar('Pagar de más no deja saldo negativo', DatosNegocio.ventaPorId(conDescuento.id).pagado, 23000);
revisar('Y la deja pagada', DatosNegocio.ventaPorId(conDescuento.id).estado, 'pagada');

DatosNegocio.anularVenta(venta.id);
revisar('Anular devuelve la mercadería a la bodega', DatosNegocio.stockDe(bebida.id, null), 22);
revisar('La venta anulada sigue a la vista', DatosNegocio.ventaPorId(venta.id).estado, 'anulada');
revisar('Pero ya no suma al mes', DatosNegocio.resumenDelMes(
  new Date().getFullYear(), new Date().getMonth()).cuantasVentas, 1);

console.log('\nReponer con una compra');

const prov = DatosNegocio.agregarFicha('proveedores', { nombre: 'Distribuidora Sur' }, 'al proveedor');
const compra = DatosNegocio.registrarCompra({
  proveedorId: prov.id,
  descripcion: 'Pedido semanal',
  lineas: [{ productoId: bebida.id, cantidad: 12, costo: 1300 }],
});
revisar('La compra entró a la bodega', DatosNegocio.stockDe(bebida.id, null), 34);
revisar('El monto salió de las líneas', compra.monto, 12 * 1300);
revisar('Y el costo de hoy se actualizó', DatosNegocio.productoPorId(bebida.id).costo, 1300);

DatosNegocio.borrarCompra(compra.id);
revisar('Borrar la compra devuelve lo que había entrado', DatosNegocio.stockDe(bebida.id, null), 22);

console.log('\nCotizaciones');

const q = DatosNegocio.guardarCotizacion({
  clienteId: cliente.id,
  lineas: [{ productoId: polera.id, varianteId: talla_m.id, cantidad: 10 }],
  estado: 'enviada',
});
revisar('Se totaliza igual que una venta', DatosNegocio.totalDe(q), 89900);
revisar('Cotizar NO descuenta stock', DatosNegocio.stockDe(polera.id, talla_m.id), 2);
revisar('Trae fecha de vencimiento sola', Boolean(q.validaHasta), true);

const ventaDeQ = DatosNegocio.convertirEnVenta(q.id);
revisar('Aceptarla la convierte en venta', ventaDeQ.folio, 3);
// Vender más de lo que tienes está PERMITIDO a propósito: en un
// negocio de verdad primero se vende y después se cuadra la bodega.
// Bloquearlo obligaría a mentirle a la app justo cuando hay un cliente
// esperando. Lo que sí hace la app es avisarte (ver alertas y la
// pantalla de vender).
revisar('Ahí sí descuenta stock, y deja el negativo a la vista',
  DatosNegocio.stockDe(polera.id, talla_m.id), -8);
revisar('Y la cotización queda aceptada', DatosNegocio.cotizacionPorId(q.id).estado, 'aceptada');
revisarQueSeQueje('No se puede convertir dos veces', () => DatosNegocio.convertirEnVenta(q.id));

console.log('\nEL PUENTE: pagarme a mí mismo');

const cuenta = Datos.cuentasActivas()[0];
const movimientosAntes = Datos.obtener().movimientos.length;
const sueldoLibreAntes = Datos.resumenDelMes(new Date().getFullYear(), new Date().getMonth()).ingresos;

revisarQueSeQueje('Un retiro sin cuenta de destino no pasa',
  () => DatosNegocio.registrarRetiro({ monto: 30000 }));

const retiro = DatosNegocio.registrarRetiro({
  monto: 30000, concepto: 'Mi sueldo de este mes', cuentaDestino: cuenta.id,
});
revisar('El retiro creó UN movimiento personal',
  Datos.obtener().movimientos.length, movimientosAntes + 1);

const ingreso = Datos.obtener().movimientos.find(m => m.id === retiro.movimientoId);
revisar('Que es un ingreso', ingreso.tipo, 'ingreso');
revisar('De categoría negocio', ingreso.categoria, 'negocio');
revisar('Por el mismo monto', ingreso.monto, 30000);
revisar('A la cuenta que elegí', ingreso.cuentaDestino, cuenta.id);
revisar('Y recién ahí sube mi ingreso personal del mes',
  Datos.resumenDelMes(new Date().getFullYear(), new Date().getMonth()).ingresos,
  sueldoLibreAntes + 30000);

revisar('La venta del negocio NO entró a mis movimientos personales',
  Datos.obtener().movimientos.filter(m => m.monto === 5970).length, 0);

DatosNegocio.borrarRetiro(retiro.id);
revisar('Borrar el retiro se lleva su ingreso personal',
  Datos.obtener().movimientos.length, movimientosAntes);
revisar('Sin dejar un ingreso huérfano inflando el mes',
  Datos.resumenDelMes(new Date().getFullYear(), new Date().getMonth()).ingresos,
  sueldoLibreAntes);

console.log('\nBorrar sin romper la historia');

revisarQueSeQueje('Un producto ya vendido no se borra',
  () => DatosNegocio.borrarProducto(bebida.id));
DatosNegocio.archivarProducto(bebida.id);
revisar('Archivado desaparece de la lista', DatosNegocio.productos().some(p => p.id === bebida.id), false);
revisar('Pero sigue estando para las ventas viejas', Boolean(DatosNegocio.productoPorId(bebida.id)), true);

const sinVender = DatosNegocio.agregarProducto({ nombre: 'Prueba', precio: 100, costo: 50 });
DatosNegocio.borrarProducto(sinVender.id);
revisar('Uno que nunca se vendió sí se borra', DatosNegocio.productoPorId(sinVender.id), null);

const ventasDelCliente = DatosNegocio.todo().ventas.filter(v => v.clienteId === cliente.id).length;
DatosNegocio.borrarFicha('clientes', cliente.id);
revisar('Borrar un cliente no borra sus ventas',
  DatosNegocio.todo().ventas.length >= ventasDelCliente, true);
revisar('Solo las suelta', DatosNegocio.todo().ventas.every(v => v.clienteId !== cliente.id), true);

console.log('\nApagar no es borrar');

const cuantosProductos = DatosNegocio.productos(true).length;
DatosNegocio.apagar();
revisar('Queda apagado', DatosNegocio.estaActivo(), false);
revisar('Y no perdió ni un producto', DatosNegocio.productos(true).length, cuantosProductos);

console.log('\nLos respaldos del negocio no son huérfanos');

DatosNegocio.encender({ nombre: 'Almacén Doña Rosa' });
const conFoto = DatosNegocio.agregarProducto({
  nombre: 'Con foto', precio: 100, costo: 50,
  fotos: [{ id: 'foto-1', nombre: 'polera.jpg', tipo: 'image/jpeg', tamano: 1234 }],
});
revisar('La foto de un producto cuenta como respaldo vivo',
  Datos.idsDeAdjuntosVivos().has('foto-1'), true);

/* ------------------------------------------------------------ */

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: el negocio guarda bien y el puente aguanta.`);
