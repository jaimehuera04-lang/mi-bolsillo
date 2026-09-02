/* ============================================================
   src/data/pistas.js
   El diccionario chileno que usa el lector de comprobantes.

   Son DATOS, no lógica: acá no se lee ningún archivo ni se
   calcula nada. Solo se dice "si en el papel aparece la palabra
   JUMBO, esto huele a supermercado".

   Por qué existe separado: cuando el lector se equivoque con el
   comercio de la esquina, la corrección se hace agregando una
   línea acá, sin tocar el motor ni la pantalla.
   ============================================================ */

const Pistas = (() => {

  /* ------------------------------------------------------------
     1. Comercios y palabras -> categoría de gasto

     El orden importa: se busca de arriba hacia abajo y gana la
     primera que calce. Por eso "farmacias ahumada" va antes que
     "ahumada" a secas, que en Chile es una calle.
     Todo se compara en minúsculas y sin tildes.
     ------------------------------------------------------------ */
  const COMERCIOS = [
    // --- Supermercado y feria ---
    ['comida', ['lider', 'jumbo', 'santa isabel', 'unimarc', 'tottus', 'ekono',
                'acuenta', 'a cuenta', 'mayorista 10', 'alvi', 'ok market',
                'oxxo', 'big john', 'supermercado', 'minimarket', 'almacen',
                'verduleria', 'carniceria', 'panaderia', 'feria']],

    // --- Comer fuera y delivery ---
    ['restaurante', ['pedidosya', 'pedidos ya', 'rappi', 'uber eats', 'ubereats',
                     'justo', 'mcdonald', 'burger king', 'kfc', 'doggis', 'juan maestro',
                     'telepizza', 'papa johns', 'dominos', 'subway',
                     'starbucks', 'dunkin', 'juan valdez', 'cafe', 'restaurant',
                     'sushi', 'pizzeria', 'empanadas', 'completos', 'schopdog']],

    // --- Transporte ---
    ['transporte', ['copec', 'shell', 'petrobras', 'aramco', 'enex', 'terpel',
                    'bencina', 'combustible', 'uber', 'cabify', 'didi', 'beat',
                    'metro de santiago', 'tarjeta bip', 'transantiago',
                    'red movilidad', 'autopista', 'costanera norte', 'vespucio',
                    'autopasse', 'peaje', 'estacionamiento', 'parking',
                    'turbus', 'tur bus', 'pullman', 'condor bus', 'latam', 'sky airline',
                    'jetsmart', 'permiso de circulacion', 'revision tecnica']],

    // --- Casa ---
    ['vivienda', ['arriendo', 'canon de arriendo', 'gastos comunes', 'administracion edificio',
                  'sodimac', 'homecenter', 'easy', 'construmart', 'imperial',
                  'contribuciones', 'dividendo hipotecario', 'mudanza']],

    // --- Cuentas y servicios ---
    ['servicios', ['enel', 'cge', 'saesa', 'chilquinta', 'frontel', 'copelec',
                   'aguas andinas', 'esval', 'essbio', 'aguas del valle', 'nuevosur',
                   'smapa', 'metrogas', 'lipigas', 'abastible', 'gasco', 'gasvalpo',
                   'entel', 'movistar', 'wom', 'claro', 'vtr', 'mundo pacifico',
                   'gtd', 'directv', 'cuenta de luz', 'cuenta de agua', 'cuenta de gas',
                   'internet', 'telefonia', 'plan movil']],

    // --- Salud ---
    ['salud', ['cruz verde', 'salcobrand', 'farmacias ahumada', 'farmacia', 'dr simi',
               'fonasa', 'isapre', 'banmedica', 'colmena', 'consalud', 'nueva masvida',
               'cruz blanca', 'vida tres', 'esencial', 'integramedica', 'redsalud',
               'clinica', 'hospital', 'megasalud', 'dental', 'oftalmo', 'kinesio',
               'laboratorio', 'examenes', 'consulta medica']],

    // --- Educación ---
    ['educacion', ['duoc', 'inacap', 'aiep', 'santo tomas', 'universidad', 'colegio',
                   'jardin infantil', 'matricula', 'mensualidad', 'arancel',
                   'cae', 'ingresa', 'preuniversitario', 'utem', 'usach',
                   'libreria', 'utiles escolares']],

    // --- Entretención ---
    ['ocio', ['cinemark', 'cineplanet', 'cinepolis', 'hoyts', 'cine',
              'puntoticket', 'ticketmaster', 'passline', 'teatro', 'estadio',
              'gimnasio', 'smartfit', 'pacific fitness', 'energy fitness',
              'sportlife', 'steam', 'playstation', 'xbox', 'nintendo']],

    // --- Ropa ---
    ['ropa', ['falabella', 'paris', 'ripley', 'hites', 'la polar', 'abcdin',
              'zara', 'adidas', 'nike', 'puma', 'forever 21',
              'bata', 'tricot', 'corona', 'dijon', 'zapatos', 'vestuario']],

    // --- Suscripciones ---
    ['suscripcion', ['netflix', 'spotify', 'disney', 'hbo', 'star+',
                     'prime video', 'amazon prime', 'youtube premium', 'apple.com',
                     'icloud', 'google one', 'google storage', 'microsoft 365',
                     'office 365', 'openai', 'chatgpt', 'canva', 'adobe', 'dropbox',
                     'suscripcion', 'membresia']],

    // --- Cuotas y deudas ---
    ['deuda', ['cmr', 'cencosud scotiabank', 'tarjeta cencosud', 'lider bci',
               'presto', 'ripley card', 'abcvisa', 'credito de consumo',
               'cuota', 'cuotas', 'avance en efectivo', 'super avance',
               'pago automatico de tarjeta', 'linea de credito', 'mutuo',
               'interes por mora', 'repactacion']],

    // --- Mascota ---
    ['mascota', ['veterinaria', 'petbrands', 'pet happy', 'mundo animal',
                 'clinica veterinaria', 'alimento para perro', 'alimento para gato']],

    // --- Regalos ---
    ['regalo', ['regalo', 'floreria', 'chocolates', 'jugueteria']],
  ];

  /* ------------------------------------------------------------
     2. Palabras que dicen si entró o salió plata

     Las de ENTRA solo ganan cuando en el papel no hay una de SALE
     más específica; de esa pelea se encarga lector.js.
     ------------------------------------------------------------ */
  const ENTRA = [
    'transferencia recibida', 'recibiste', 'te transfirieron', 'te depositaron',
    'abono', 'abonado', 'deposito', 'te enviaron',
    'liquidacion de sueldo', 'remuneracion',
    'sueldo', 'honorarios', 'boleta de honorarios', 'devolucion',
    'reembolso', 'reintegro', 'bono', 'aguinaldo', 'finiquito', 'gratificacion',
    'pago recibido', 'comision recibida', 'intereses ganados',
  ];

  const SALE = [
    'transferencia enviada', 'transferiste', 'enviaste', 'destinatario',
    'compra', 'compraste', 'cargo', 'cargado', 'giro', 'pago de',
    'pagaste', 'total a pagar', 'monto a pagar', 'boleta', 'factura',
    'debito', 'suscripcion',
  ];

  /* ------------------------------------------------------------
     3. Categorías de ingreso, por palabra
     ------------------------------------------------------------ */
  const INGRESOS = [
    ['sueldo',    ['sueldo', 'remuneracion', 'liquidacion de sueldo', 'salario',
                   'nomina', 'gratificacion', 'aguinaldo', 'finiquito']],
    ['extra',     ['honorarios', 'boleta de honorarios', 'pololito', 'freelance',
                   'trabajo extra', 'comision', 'propina']],
    ['venta',     ['venta', 'vendido', 'mercado pago', 'mercadolibre', 'yapo']],
    ['interes',   ['interes', 'intereses', 'rentabilidad', 'dividendo de accion',
                   'fondo mutuo', 'deposito a plazo']],
    ['regalo-in', ['regalo', 'me regalaron']],
  ];

  /* ------------------------------------------------------------
     4. Rótulos que suelen ir pegados al monto que de verdad importa

     En una boleta hay cinco números; el que sirve es el que va al
     lado de una de estas palabras. Van en orden de confianza.
     ------------------------------------------------------------ */
  const ROTULOS_MONTO = [
    'monto transferido', 'monto de la transferencia', 'total a pagar',
    'monto a pagar', 'total pagado', 'monto total', 'valor total',
    'total boleta', 'total compra', 'importe total', 'liquido a pagar',
    'total', 'monto', 'valor', 'importe',
  ];

  /* Números que NUNCA son un monto, aunque lleven puntos. */
  const ROTULOS_PROHIBIDOS = [
    'rut', 'r.u.t', 'run', 'folio', 'n de operacion', 'nro operacion',
    'numero de operacion', 'codigo', 'comprobante n',
    'cuenta n', 'n cuenta', 'numero de cuenta', 'tarjeta', 'telefono',
    'celular', 'orden de compra', 'sii', 'timbre', 'autorizacion',
    'resolucion', 'boleta n', 'factura n', 'documento n',
  ];

  /* ------------------------------------------------------------
     5. Encabezados de cartola, para saber qué columna es cuál
     ------------------------------------------------------------ */
  const COLUMNAS = {
    fecha:       ['fecha', 'fecha transaccion', 'fecha movimiento',
                  'fecha contable', 'dia'],
    descripcion: ['descripcion', 'detalle', 'glosa', 'concepto',
                  'movimiento', 'comercio', 'referencia'],
    cargo:       ['cargo', 'cargos', 'giro', 'giros', 'debito', 'egreso'],
    abono:       ['abono', 'abonos', 'deposito', 'credito', 'ingreso'],
    monto:       ['monto', 'monto $', 'valor', 'importe', 'monto total'],
    saldo:       ['saldo', 'saldo contable', 'saldo disponible'],
  };

  /**
   * Minúsculas, sin tildes y con los espacios apretados.
   * El símbolo de grado también se va: en los papeles chilenos aparece
   * como "N° de operación", y sin quitarlo "n de operacion" no calza
   * nunca con la lista de rótulos prohibidos.
   */
  function normalizar(texto) {
    return String(texto == null ? '' : texto)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[°º]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * La primera categoría de gasto que calce con el texto.
   * Devuelve { categoria, pista } o null si no reconoce nada.
   */
  function categoriaDeGasto(texto) {
    const t = normalizar(texto);
    for (const [categoria, palabras] of COMERCIOS) {
      for (const p of palabras) {
        if (t.includes(p)) return { categoria, pista: p };
      }
    }
    return null;
  }

  /** Lo mismo, con las categorías de ingreso. */
  function categoriaDeIngreso(texto) {
    const t = normalizar(texto);
    for (const [categoria, palabras] of INGRESOS) {
      for (const p of palabras) {
        if (t.includes(p)) return { categoria, pista: p };
      }
    }
    return null;
  }

  return {
    COMERCIOS, ENTRA, SALE, INGRESOS, ROTULOS_MONTO, ROTULOS_PROHIBIDOS, COLUMNAS,
    normalizar, categoriaDeGasto, categoriaDeIngreso,
  };
})();
