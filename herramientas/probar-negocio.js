/* ============================================================
   herramientas/probar-negocio.js

   Revisa las cuentas del negocio: existencias, totales de venta,
   fiados, margen, caja, rankings y alertas. Corre en Node, sin
   navegador, porque /src/core son funciones puras.

   Uso:
     node herramientas/probar-negocio.js

   Termina con error si alguna prueba no calza.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

const contexto = vm.createContext({ console, Intl, Date, Math, JSON, Number, RegExp, Object });
for (const archivo of ['src/core/negocio.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), contexto, { filename: archivo });
}
const { Negocio } = vm.runInContext('({ Negocio })', contexto);

const HOY = '2026-09-02';

/* ------------------------------------------------------------
   Un almacén de barrio de mentira, pero con los casos que de
   verdad pasan: una venta fiada, una anulada, un producto con
   tallas, otro sin control de stock (un servicio) y uno que se
   acabó.
   ------------------------------------------------------------ */

function almacenDePrueba() {
  return {
    activo: true,
    perfil: { nombre: 'Almacén Doña Rosa' },
    productos: [
      { id: 'p1', nombre: 'Bebida 1,5 L', precio: 1990, costo: 1200,
        controlaStock: true, stockMinimo: 6, activo: true, variantes: [] },
      { id: 'p2', nombre: 'Pan amasado (kg)', precio: 2500, costo: 1500,
        controlaStock: true, stockMinimo: 2, activo: true, variantes: [] },
      { id: 'p3', nombre: 'Polera', precio: 8990, costo: 4000,
        controlaStock: true, stockMinimo: 3, activo: true,
        variantes: [
          { id: 'v-s', nombre: 'S', costo: 4000 },
          { id: 'v-m', nombre: 'M', costo: 4000 },
        ] },
      { id: 'p4', nombre: 'Recarga de gas', precio: 24000, costo: 19000,
        controlaStock: false, stockMinimo: 0, activo: true, variantes: [] },
    ],
    clientes:    [{ id: 'c1', nombre: 'Doña Marta' }],
    proveedores: [{ id: 'pr1', nombre: 'Distribuidora Sur' }],
    empleados:   [{ id: 'e1', nombre: 'Camila', activo: true }],

    stock: [
      { id: 's1', fecha: '2026-09-01', productoId: 'p1', varianteId: null, cantidad:  24, motivo: 'compra' },
      { id: 's2', fecha: '2026-09-01', productoId: 'p2', varianteId: null, cantidad:  10, motivo: 'compra' },
      { id: 's3', fecha: '2026-09-01', productoId: 'p3', varianteId: 'v-s', cantidad:  5, motivo: 'compra' },
      { id: 's4', fecha: '2026-09-01', productoId: 'p3', varianteId: 'v-m', cantidad:  2, motivo: 'compra' },
      // La venta v1 se llevó 3 bebidas y 1,5 kg de pan
      { id: 's5', fecha: '2026-09-02', productoId: 'p1', varianteId: null, cantidad:  -3, motivo: 'venta', referencia: 'v1' },
      { id: 's6', fecha: '2026-09-02', productoId: 'p2', varianteId: null, cantidad: -1.5, motivo: 'venta', referencia: 'v1' },
      // Y una merma: dos bebidas que se rompieron
      { id: 's7', fecha: '2026-09-02', productoId: 'p1', varianteId: null, cantidad:  -2, motivo: 'merma' },
    ],

    ventas: [
      // Pagada al contado
      { id: 'v1', folio: 1, fecha: '2026-09-02', clienteId: 'c1', empleadoId: 'e1',
        estado: 'pagada', medioPago: 'efectivo', descuento: 0, pagado: 9720,
        lineas: [
          { productoId: 'p1', varianteId: null, nombre: 'Bebida 1,5 L',    cantidad: 3,   precio: 1990, costo: 1200 },
          { productoId: 'p2', varianteId: null, nombre: 'Pan amasado (kg)', cantidad: 1.5, precio: 2500, costo: 1500 },
        ] },
      // Fiada: se vendió, pero solo se abonó una parte
      { id: 'v2', folio: 2, fecha: '2026-09-02', clienteId: 'c1', empleadoId: 'e1',
        estado: 'fiada', medioPago: 'fiado', descuento: 1000, pagado: 5000,
        lineas: [
          { productoId: 'p4', varianteId: null, nombre: 'Recarga de gas', cantidad: 1, precio: 24000, costo: 19000 },
        ] },
      // Anulada: no existe para ningún número
      { id: 'v3', folio: 3, fecha: '2026-09-02', clienteId: null, empleadoId: 'e1',
        estado: 'anulada', medioPago: 'efectivo', descuento: 0, pagado: 0,
        lineas: [
          { productoId: 'p1', varianteId: null, nombre: 'Bebida 1,5 L', cantidad: 50, precio: 1990, costo: 1200 },
        ] },
    ],

    compras: [
      { id: 'co1', folio: 1, fecha: '2026-09-01', proveedorId: 'pr1',
        descripcion: 'Pedido semanal', monto: 60000, categoria: 'mercaderia' },
    ],

    cotizaciones: [
      { id: 'q1', folio: 1, fecha: '2026-08-20', validaHasta: '2026-09-04',
        clienteId: 'c1', estado: 'enviada', descuento: 0,
        lineas: [{ productoId: 'p3', varianteId: 'v-m', nombre: 'Polera M', cantidad: 10, precio: 8990, costo: 4000 }] },
      { id: 'q2', folio: 2, fecha: '2026-08-01', validaHasta: '2026-08-15',
        clienteId: 'c1', estado: 'enviada', descuento: 0, lineas: [] },
      { id: 'q3', folio: 3, fecha: '2026-08-01', validaHasta: '2026-08-15',
        clienteId: 'c1', estado: 'aceptada', descuento: 0, lineas: [] },
    ],

    retiros: [
      { id: 'r1', fecha: '2026-09-02', monto: 30000, concepto: 'Mi sueldo', movimientoId: 'mov-1' },
    ],

    ajustes: { folioVenta: 4, folioCotizacion: 4, folioCompra: 2,
               diasCotizacion: 15, avisarStockBajo: true,
               catalogo: { whatsapp: '', mostrarPrecios: true, mostrarStock: false },
               iaActivada: false },
  };
}

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

const n = almacenDePrueba();
const p = id => n.productos.find(x => x.id === id);

/* ---------------- Totales de una venta ---------------- */
console.log('\nLo que vale una venta');

// 3 x 1990 = 5970, y 1,5 kg x 2500 = 3750. Total 9720.
revisar('La cantidad con decimales no rompe el total', Negocio.totalDe(n.ventas[0]), 9720);
revisar('El costo de lo vendido', Negocio.sumaDeCostos(n.ventas[0].lineas), 3600 + 2250);
revisar('La ganancia de esa venta', Negocio.gananciaDe(n.ventas[0]), 9720 - 5850);

// 24000 con 1000 de descuento
revisar('El descuento se resta en pesos', Negocio.totalDe(n.ventas[1]), 23000);
revisar('Un descuento mayor que la venta no deja el total en negativo',
  Negocio.totalDe({ lineas: [{ cantidad: 1, precio: 1000, costo: 0 }], descuento: 99999 }), 0);

/* ---------------- Fiados ---------------- */
console.log('\nLo que te deben');

revisar('Una venta pagada no debe nada', Negocio.saldoPendienteDe(n.ventas[0]), 0);
revisar('Una fiada debe la diferencia', Negocio.saldoPendienteDe(n.ventas[1]), 23000 - 5000);
revisar('Una anulada no debe nada', Negocio.saldoPendienteDe(n.ventas[2]), 0);

/* ---------------- Existencias ---------------- */
console.log('\nLas existencias');

revisar('El stock sale del libro, no de un número guardado',
  Negocio.stockDe(n, 'p1', null), 24 - 3 - 2);
revisar('Los kilos con decimales se guardan bien', Negocio.stockDe(n, 'p2', null), 8.5);
revisar('Cada variante lleva su propio stock', Negocio.stockDe(n, 'p3', 'v-s'), 5);
revisar('El stock de un producto con tallas es la suma de sus tallas',
  Negocio.stockTotalDe(n, p('p3')), 7);
revisar('La venta anulada NO descontó stock', Negocio.stockDe(n, 'p1', null), 19);

// 19 bebidas x 1200 + 8,5 kg x 1500 + 7 poleras x 4000
revisar('El valor de la bodega va a costo, no a precio de venta',
  Negocio.valorInventario(n), 19 * 1200 + Math.round(8.5 * 1500) + 7 * 4000);

/* ---------------- Bajo mínimo ---------------- */
console.log('\nLo que se está acabando');

// p3 tiene 7 y su mínimo es 3 -> está bien. p1 tiene 19, mínimo 6 -> bien.
// p2 tiene 8,5, mínimo 2 -> bien. Ninguno bajo mínimo todavía.
revisar('Con la bodega llena no hay nada bajo mínimo', Negocio.bajoMinimo(n).length, 0);

const vacio = almacenDePrueba();
vacio.stock.push({ id: 's8', fecha: HOY, productoId: 'p1', varianteId: null, cantidad: -19, motivo: 'venta' });
revisar('Un producto en cero aparece bajo mínimo', Negocio.bajoMinimo(vacio).length, 1);
revisar('Y aparece con cuánto queda', Negocio.bajoMinimo(vacio)[0].hay, 0);
revisar('Un servicio sin control de stock nunca aparece bajo mínimo',
  Negocio.bajoMinimo(vacio).some(f => f.producto.id === 'p4'), false);

/* ---------------- El mes ---------------- */
console.log('\nEl resumen del mes');

const r = Negocio.resumenDelMes(n, 2026, 8);   // septiembre

revisar('Cuenta las ventas que valen', r.cuantasVentas, 2);
revisar('Vendido: la anulada no suma', r.vendido, 9720 + 23000);
revisar('Cobrado: lo fiado no entró completo', r.cobrado, 9720 + 5000);
revisar('Por cobrar: lo que sigue afuera', r.porCobrar, 18000);
revisar('Gastado: las compras del negocio', r.gastado, 60000);
revisar('Margen: vendido menos lo que costó', r.margen, (9720 + 23000) - (5850 + 19000));
revisar('Utilidad: el margen menos los gastos', r.utilidad, (9720 + 23000) - (5850 + 19000) - 60000);
revisar('Retirado: lo que te pasaste a ti mismo', r.retirado, 30000);
revisar('Caja: lo que entró menos lo que salió', r.caja, (9720 + 5000) - 60000 - 30000);
revisar('Ticket promedio', r.ticketPromedio, Math.round((9720 + 23000) / 2));

const otroMes = Negocio.resumenDelMes(n, 2026, 7);   // agosto: sin nada
revisar('Un mes sin ventas da todo en cero, no error', otroMes.vendido, 0);
revisar('Y su ticket promedio es cero, no infinito', otroMes.ticketPromedio, 0);

const historial = Negocio.historialDeMeses(n, 2026, 8, 6);
revisar('El historial trae los seis meses pedidos', historial.length, 6);
revisar('Y el último es el mes en que estamos', historial[5].mes, 8);

/* ---------------- Rankings ---------------- */
console.log('\nQué se vende más');

const top = Negocio.masVendidos(n, '2026-09-01', '2026-09-30', 5);
revisar('El más vendido en plata es la recarga de gas', top[0].nombre, 'Recarga de gas');
revisar('Y la anulada no metió 50 bebidas en el ranking',
  top.find(t => t.nombre === 'Bebida 1,5 L').unidades, 3);

const porEmpleado = Negocio.ventasAgrupadas(n, 'empleadoId', '2026-09-01', '2026-09-30');
revisar('Camila aparece con sus dos ventas', porEmpleado[0].cuantas, 2);
revisar('Y con lo que vendió', porEmpleado[0].vendido, 9720 + 23000);

/* ---------------- Cotizaciones ---------------- */
console.log('\nLas cotizaciones');

revisar('Una enviada y vigente sigue enviada', Negocio.estadoDeCotizacion(n.cotizaciones[0], HOY), 'enviada');
revisar('Una enviada con fecha pasada está vencida', Negocio.estadoDeCotizacion(n.cotizaciones[1], HOY), 'vencida');
revisar('Una aceptada no vence aunque pase la fecha', Negocio.estadoDeCotizacion(n.cotizaciones[2], HOY), 'aceptada');
revisar('Una cotización se totaliza igual que una venta',
  Negocio.totalDe(n.cotizaciones[0]), 89900);

/* ---------------- Alertas ---------------- */
console.log('\nLo que hay que mirar hoy');

const avisos = Negocio.alertas(n, HOY);
revisar('Avisa de lo fiado', avisos.some(a => a.icono === '🧾'), true);
revisar('Avisa de la cotización esperando respuesta', avisos.some(a => a.icono === '📄'), true);
revisar('Con la bodega llena no avisa de stock', avisos.some(a => a.icono === '📦'), false);

const avisosVacio = Negocio.alertas(vacio, HOY);
revisar('Sin stock sí avisa, y primero', avisosVacio[0].icono, '📦');
revisar('Y ese aviso es de nivel alto', avisosVacio[0].nivel, 'alto');

const apagado = almacenDePrueba();
apagado.ajustes.avisarStockBajo = false;
apagado.stock.push({ id: 's9', fecha: HOY, productoId: 'p1', varianteId: null, cantidad: -19, motivo: 'venta' });
revisar('Si apagaste el aviso de stock, no molesta',
  Negocio.alertas(apagado, HOY).some(a => a.icono === '📦'), false);

/* ---------------- Un negocio recién nacido ---------------- */
console.log('\nUn negocio en blanco');

const nuevo = { activo: true, productos: [], ventas: [], compras: [], cotizaciones: [],
                stock: [], retiros: [], clientes: [], proveedores: [], empleados: [], ajustes: {} };
revisar('No revienta con todo vacío', Negocio.resumenDelMes(nuevo, 2026, 8).vendido, 0);
revisar('No tiene nada que valorizar', Negocio.valorInventario(nuevo), 0);
revisar('Y no tiene nada que avisar', Negocio.alertas(nuevo, HOY).length, 0);
revisar('Ni siquiera revienta con un negocio que no existe', Negocio.alertas(null, HOY).length, 0);

console.log('\n--------------------------------------');
if (fallos) {
  console.log(`${fallos} de ${hechas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`Las ${hechas} pruebas pasaron: las cuentas del negocio cuadran.`);
