/* ============================================================
   src/storage/esquema.js
   La forma exacta que tienen los datos guardados.

   Si cambias algo aquí, sube VERSION_ESQUEMA y escribe la
   migración correspondiente en migraciones.js. Nunca cambies
   la forma sin migración: los datos viejos de la gente que ya
   tiene la app instalada entran mutilados y en silencio.
   ============================================================ */

const Esquema = (() => {

  const VERSION_ESQUEMA = 4;

  // La llave ya no lleva el número de versión: la versión vive DENTRO
  // del objeto. Poner "v1" en el nombre invita a crear otra llave en
  // vez de migrar, que es justo lo que no queremos.
  const LLAVE        = 'mi-bolsillo';
  const LLAVE_VIEJA  = 'mi-bolsillo-v1';          // esquema 1, el de antes
  const LLAVE_RESPALDO = 'mi-bolsillo:respaldo';  // copia previa a migrar

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Lo que ve alguien que recién instala ---------- */
  function estadoNuevo() {
    return {
      meta: {
        schemaVersion: VERSION_ESQUEMA,
        creado: Fechas.hoyISO(),
        ultimoRespaldo: '',
        // Cuándo se guardó por última vez en este dispositivo. Lo usa la
        // nube para saber si acá hay algo más nuevo que allá.
        actualizado: '',
      },

      /* cuentas: donde vive la plata.
         saldoInicial es el saldo del día que creaste la cuenta.
         El saldo de hoy NO se guarda, se calcula (ver calculos.js). */
      cuentas: [],

      /* movimientos: tipo 'ingreso' | 'gasto' | 'transferencia'.
         monto siempre positivo y entero. El signo lo da el tipo.

         Desde el esquema 3 cada movimiento lleva 'adjuntos': la lista
         de fichas { id, nombre, tipo, tamano } de sus respaldos. Ojo:
         acá va SOLO la ficha. El archivo mismo vive en IndexedDB
         (ver storage/adjuntos.js), porque una foto no cabe en
         localStorage y no queremos mandarla a la nube.              */
      movimientos: [],

      /* compromisos: plata que ya prometiste y todavía no sale.
         Se llenan en la Fase 2. Aquí solo dejamos el cajón listo.  */
      compromisos: [],
      ingresosPrevistos: [],
      estacionales: [],
      simulaciones: [],

      metas: [],

      // Secundario a propósito: el corazón de la app son los
      // compromisos futuros, no los topes de gasto.
      presupuestos: {},

      /* negocio: el mundo de quien además vende algo. Nace apagado
         (activo: false) y hasta que no se encienda en Ajustes, la
         pestaña Negocio ni siquiera aparece. Ver negocioNuevo(). */
      negocio: negocioNuevo(),

      ajustes: {
        correo: '',
        registrado: false,
        nombre: '',
        ingresoEsperado: 0,
        tutorialVisto: false,
        iaActivada: false,        // apagada de fábrica, se enciende en la Fase 6
      },
    };
  }

  /* ------------------------------------------------------------
     El cajón del negocio (esquema 4).

     Ojo con la frontera, que es la decisión de diseño más
     importante de todo este bloque: la plata del negocio NO se
     mezcla con la plata personal. Las ventas de aquí no son
     ingresos tuyos y las compras de aquí no son gastos tuyos.
     Lo único que cruza es el RETIRO: el día que te pagas a ti
     mismo, eso sí entra a tus movimientos como ingreso y recién
     ahí alimenta tu sueldo libre. Ver 'retiros' más abajo.
     ------------------------------------------------------------ */
  function negocioNuevo() {
    return {
      activo: false,

      /* La cara del negocio. Sale en el catálogo, en las
         cotizaciones y en los comprobantes. */
      perfil: {
        nombre: '',
        rubro: '',
        rut: '',
        telefono: '',
        correo: '',
        direccion: '',
        mensaje: '',            // la frase que sale bajo el nombre en el catálogo
        emoji: '🏪',
        color: '#10a072',
      },

      /* productos: lo que vendes.
         precio y costo en pesos enteros, como todo acá.
         controlaStock apagado sirve para servicios (un corte de pelo
         no tiene existencias). Las 'variantes' son talla, color o
         sabor: cada una lleva su propio SKU, precio y stock, y cuando
         un producto tiene variantes el stock del padre no se usa. */
      productos: [],

      clientes: [],
      proveedores: [],

      /* empleados: quién atiende. Cada venta puede quedar a nombre de
         uno, y de ahí sale el ranking de quién vende más. Por ahora
         son fichas, no cuentas con clave: para que cada uno entre con
         su propio acceso hace falta la nube encendida. */
      empleados: [],

      /* ventas y compras: el registro del negocio.
         lineas: [{ productoId, varianteId, nombre, cantidad, precio, costo }]
         estado: 'pagada' | 'fiada' | 'anulada'. */
      ventas: [],
      compras: [],

      /* cotizaciones: la misma forma de una venta, pero sin tocar el
         stock ni la caja hasta que se acepta. */
      cotizaciones: [],

      /* stock: el libro de existencias. Cada entrada y cada salida
         queda anotada con su motivo, así el número de hoy siempre se
         puede explicar hacia atrás. El stock NO se guarda como un
         número suelto que alguien edita: se calcula sumando este
         libro (ver core/negocio.js). */
      stock: [],

      /* retiros: el puente con tus finanzas personales. Cada retiro
         guarda el id del movimiento que creó en tus movimientos, para
         poder deshacer los dos juntos y no dejar un ingreso huérfano. */
      retiros: [],

      ajustes: {
        folioVenta: 1,
        folioCotizacion: 1,
        folioCompra: 1,
        diasCotizacion: 15,      // cuánto vale una cotización antes de vencer
        avisarStockBajo: true,
        catalogo: {
          whatsapp: '',
          mostrarPrecios: true,
          mostrarStock: false,
        },
        // El hueco de la Fase 6. Mientras esté apagado, todo lo que
        // dice "con IA" en otras apps acá lo hace el propio teléfono
        // sin mandar nada afuera. Ver NEGOCIO.md.
        iaActivada: false,
      },
    };
  }

  /** Cuenta por defecto para quien recién parte o viene del esquema 1. */
  function cuentaPorDefecto() {
    return {
      id: nuevoId(),
      nombre: 'Mi cuenta',
      tipo: 'cuenta_rut',
      saldoInicial: 0,
      icono: '🏧',
      activa: true,
      fechaCreacion: Fechas.hoyISO(),
    };
  }

  return { VERSION_ESQUEMA, LLAVE, LLAVE_VIEJA, LLAVE_RESPALDO,
           nuevoId, estadoNuevo, cuentaPorDefecto, negocioNuevo };
})();
