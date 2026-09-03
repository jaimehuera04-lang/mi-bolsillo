/* ============================================================
   src/core/voz.js
   Entender una frase dicha en voz alta.

       "gané 50 lucas por un trabajo que hice"
       "gasté cinco mil en comida"
       "me pagaron medio palo ayer"

   Funciones puras: entra texto, sale una propuesta. No escucha el
   micrófono —eso es src/ui/voz.js— ni guarda nada. Se puede
   probar entera en Node.

   Igual que el lector de comprobantes: PROPONE y nunca anota
   solo. La pantalla muestra qué entendió de cada parte y la
   persona confirma. Regla 12.

   ------------------------------------------------------------
   POR QUÉ ESTO NO ES SOLO "PASAR VOZ A TEXTO"

   Pasar voz a texto lo hace el teléfono. Lo difícil viene
   después, y es chileno:

     - "cinco lucas" son 5.000, no un 5 seguido de una palabra.
     - "medio palo" son 500.000.
     - el mismo monto llega como "50000", "50 mil", "cincuenta
       mil" o "cincuenta lucas" según cómo lo diga la persona y
       cómo lo escriba el dictado del teléfono.
     - "gané" y "gasté" suenan parecido pero significan lo
       contrario, y ahí se juega todo.

   Nada de esto lo resuelve un modelo: son reglas del idioma que
   se pueden escribir, leer y probar. Regla 1.
   ============================================================ */

const Voz = (() => {

  /* ============================================================
     1. LOS NÚMEROS
     ============================================================ */

  const UNIDADES = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
    veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
    veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
    veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90,
  };

  const CIENTOS = {
    cien: 100, ciento: 100, doscientos: 200, doscientas: 200,
    trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
    quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
    novecientos: 900, novecientas: 900,
  };

  /* La plata en chileno. Estas cuatro palabras aparecen en cualquier
     conversación sobre plata en Chile y ninguna app las entiende. */
  const PLATA_CHILENA = {
    luca: 1000, lucas: 1000,
    palo: 1000000, palos: 1000000,
    gamba: 100, gambas: 100,
    quina: 500, quinas: 500,
  };

  const normalizar = t => String(t == null ? '' : t)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s.,$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /**
   * Convierte una tira de palabras-número en su valor.
   * "doscientos cincuenta mil" -> 250000
   *
   * El algoritmo de siempre para los números en castellano: se va
   * acumulando y cada "mil" o "millón" cierra el grupo que venía.
   */
  function palabrasANumero(palabras) {
    let total = 0, grupo = 0, hubo = false;

    for (const p of palabras) {
      if (p === 'y') continue;                       // "treinta y cinco"
      if (UNIDADES[p] !== undefined) { grupo += UNIDADES[p]; hubo = true; continue; }
      if (CIENTOS[p] !== undefined) { grupo += CIENTOS[p]; hubo = true; continue; }
      if (p === 'mil' || p === 'miles') {
        // "mil" solo, sin nada antes, vale mil
        grupo = (grupo || 1) * 1000;
        total += grupo; grupo = 0; hubo = true; continue;
      }
      if (p === 'millon' || p === 'millones') {
        total = (total + (grupo || 1)) * 1000000;
        grupo = 0; hubo = true; continue;
      }
      if (/^\d+$/.test(p)) { grupo += Number(p); hubo = true; continue; }
      break;
    }
    return hubo ? total + grupo : null;
  }

  /**
   * Todos los montos que aparecen en la frase, con la parte del texto
   * de la que salieron, para poder mostrarle a la persona de dónde.
   */
  function montosDe(texto) {
    const t = normalizar(texto);
    const palabras = t.split(' ');
    const encontrados = [];

    for (let i = 0; i < palabras.length; i++) {
      const p = palabras[i];

      /* --- a) Un número escrito con dígitos: 50000, 50.000, 5,000 --- */
      const digitos = p.replace(/[.,]/g, '');
      const esNumero = /^\$?\d[\d.,]*$/.test(p) && /^\d+$/.test(digitos.replace('$', ''));
      if (esNumero) {
        let valor = Number(digitos.replace('$', ''));
        let hasta = i;

        // "50 mil", "50 lucas", "2 palos"
        const siguiente = palabras[i + 1];
        if (siguiente === 'mil') { valor *= 1000; hasta = i + 1; }
        else if (PLATA_CHILENA[siguiente]) { valor *= PLATA_CHILENA[siguiente]; hasta = i + 1; }
        else if (siguiente === 'millon' || siguiente === 'millones') { valor *= 1000000; hasta = i + 1; }

        if (valor > 0) {
          encontrados.push({ valor, desde: i, hasta, dicho: palabras.slice(i, hasta + 1).join(' ') });
          i = hasta;
        }
        continue;
      }

      /* --- b) "medio palo", "media luca" --- */
      if ((p === 'medio' || p === 'media') && PLATA_CHILENA[palabras[i + 1]]) {
        encontrados.push({
          valor: Math.round(PLATA_CHILENA[palabras[i + 1]] / 2),
          desde: i, hasta: i + 1, dicho: `${p} ${palabras[i + 1]}`,
        });
        i++;
        continue;
      }

      /* --- c) Número en palabras: "cincuenta mil", "cinco lucas" --- */
      if (UNIDADES[p] !== undefined || CIENTOS[p] !== undefined || p === 'mil') {
        let j = i;
        while (j < palabras.length &&
               (UNIDADES[palabras[j]] !== undefined || CIENTOS[palabras[j]] !== undefined ||
                palabras[j] === 'mil' || palabras[j] === 'millon' || palabras[j] === 'millones' ||
                palabras[j] === 'y' || /^\d+$/.test(palabras[j]))) j++;

        let valor = palabrasANumero(palabras.slice(i, j));
        let hasta = j - 1;

        // Y si después viene "lucas" o "palos", multiplica.
        const despues = palabras[j];
        if (valor !== null && PLATA_CHILENA[despues]) {
          valor *= PLATA_CHILENA[despues];
          hasta = j;
        }

        if (valor !== null && valor > 0) {
          encontrados.push({ valor, desde: i, hasta, dicho: palabras.slice(i, hasta + 1).join(' ') });
          i = hasta;
        }
        continue;
      }

      /* --- d) "una luca", "un palo" (el número va implícito) --- */
      if (PLATA_CHILENA[p]) {
        encontrados.push({ valor: PLATA_CHILENA[p], desde: i, hasta: i, dicho: p });
      }
    }

    return encontrados;
  }

  /* ============================================================
     2. ¿ENTRÓ O SALIÓ?

     Es lo que más importa acertar: confundir un ingreso con un
     gasto no es un error de detalle, es anotar lo contrario de lo
     que pasó.
     ============================================================ */

  const ENTRA = [
    'gane', 'ganar', 'me pagaron', 'me pago', 'me deposito', 'me depositaron',
    'me transfirieron', 'me llego', 'recibi', 'cobre', 'cobrar', 'vendi',
    'entro', 'ingreso', 'ingrese', 'sueldo', 'me dieron', 'me devolvieron',
    'arriendo me pagaron', 'propina',
  ];

  const SALE = [
    'gaste', 'gastar', 'pague', 'pagar', 'compre', 'comprar', 'salio',
    'me costo', 'costo', 'saque', 'invertir', 'puse', 'deje', 'me cobraron',
    'boleta', 'transferi', 'le pague', 'abone',
  ];

  /**
   * Devuelve { tipo, pista } o null si la frase no lo dice.
   *
   * Gana la que aparece ANTES en la frase. "Gasté 5 lucas en el
   * regalo que me pagaron después" empieza con gasté, y esa manda:
   * lo primero que uno dice es lo que está anotando.
   */
  function tipoDe(texto) {
    const t = normalizar(texto);
    let mejor = null;

    for (const [tipo, lista] of [['ingreso', ENTRA], ['gasto', SALE]]) {
      for (const palabra of lista) {
        const donde = t.indexOf(palabra);
        if (donde === -1) continue;
        if (!mejor || donde < mejor.donde) mejor = { tipo, pista: palabra, donde };
      }
    }
    return mejor ? { tipo: mejor.tipo, pista: mejor.pista } : null;
  }

  /* ============================================================
     3. CUÁNDO
     ============================================================ */

  function fechaDe(texto, hoyISO) {
    const t = normalizar(texto);
    const hoy = new Date(hoyISO + 'T12:00:00');
    const correr = dias => {
      const f = new Date(hoy.getTime() - dias * 86400000);
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    };

    if (/\bantes de ayer\b|\banteayer\b/.test(t)) return { fecha: correr(2), pista: 'antes de ayer' };
    if (/\bayer\b/.test(t))                       return { fecha: correr(1), pista: 'ayer' };
    if (/\bhoy\b/.test(t))                        return { fecha: correr(0), pista: 'hoy' };

    // "el lunes", "el viernes pasado": el día de esta semana que ya pasó.
    const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    for (let d = 0; d < 7; d++) {
      if (!new RegExp(`\\b${DIAS[d]}\\b`).test(t)) continue;
      let atras = (hoy.getDay() - d + 7) % 7;
      if (atras === 0) atras = 7;              // "el lunes" dicho un lunes es el anterior
      return { fecha: correr(atras), pista: `el ${DIAS[d]}` };
    }
    return null;
  }

  /* ============================================================
     4. DE QUÉ SE TRATA
     ============================================================ */

  /* Palabras que la gente dice al hablar y que no están en el
     diccionario de comercios, porque ese es de nombres de tiendas. */
  const AL_HABLAR = [
    ['comida',      ['comida', 'almuerzo', 'once', 'desayuno', 'cena', 'colacion', 'supermercado', 'feria', 'verduras', 'carne', 'pan']],
    ['restaurante', ['restaurant', 'restaurante', 'delivery', 'pedido', 'sushi', 'pizza', 'completos', 'cafe', 'cerveza', 'salir a comer']],
    ['transporte',  ['bencina', 'combustible', 'micro', 'metro', 'bip', 'pasaje', 'taxi', 'uber', 'estacionamiento', 'peaje', 'tag']],
    ['vivienda',    ['arriendo', 'dividendo', 'gastos comunes', 'casa']],
    ['servicios',   ['luz', 'agua', 'gas', 'internet', 'cuenta de la luz', 'electricidad', 'basura']],
    ['salud',       ['farmacia', 'remedios', 'doctor', 'medico', 'dentista', 'consulta', 'isapre', 'examen']],
    ['educacion',   ['colegio', 'matricula', 'universidad', 'curso', 'utiles', 'libros', 'cuota del colegio']],
    ['ocio',        ['cine', 'carrete', 'salida', 'panorama', 'juego', 'concierto', 'fiesta']],
    ['ropa',        ['ropa', 'zapatillas', 'zapatos', 'polera', 'pantalon', 'chaqueta']],
    ['suscripcion', ['suscripcion', 'plan del celular', 'netflix', 'spotify', 'streaming']],
    ['mascota',     ['perro', 'gato', 'veterinario', 'mascota', 'alimento de perro']],
    ['regalo',      ['regalo', 'cumpleanos', 'aguinaldo']],
    ['deuda',       ['cuota', 'tarjeta', 'credito', 'deuda', 'prestamo']],
    ['ahorro',      ['ahorro', 'ahorre', 'guarde']],
  ];

  const AL_HABLAR_INGRESO = [
    ['sueldo',    ['sueldo', 'salario', 'remuneracion', 'quincena', 'liquidacion']],
    ['extra',     ['trabajo', 'pololito', 'freelance', 'pega', 'servicio', 'arreglo', 'hice un']],
    ['venta',     ['vendi', 'venta', 'vendimos']],
    ['regalo-in', ['regalo', 'me regalaron', 'aguinaldo']],
    ['interes',   ['interes', 'intereses', 'dividendos']],
  ];

  function categoriaDe(texto, tipo) {
    const t = normalizar(texto);
    const lista = tipo === 'ingreso' ? AL_HABLAR_INGRESO : AL_HABLAR;

    for (const [categoria, palabras] of lista) {
      for (const p of palabras) {
        if (t.includes(p)) return { categoria, pista: p };
      }
    }

    // Si al hablar no dijo nada reconocible, probamos con el diccionario
    // de comercios chilenos que ya usa el lector de boletas: puede haber
    // dicho "compré en el Jumbo".
    if (typeof Pistas !== 'undefined') {
      const dePapel = tipo === 'ingreso'
        ? Pistas.categoriaDeIngreso(t)
        : Pistas.categoriaDeGasto(t);
      if (dePapel) return dePapel;
    }
    return null;
  }

  /* ============================================================
     5. LA FRASE COMPLETA
     ============================================================ */

  /* Palabras de relleno que sobran en la nota: si la frase fue
     "gasté 5 lucas en comida", la nota útil es "comida". */
  const RELLENO = new RegExp(
    '\\b(' + [
      'gaste', 'gastar', 'pague', 'pagar', 'compre', 'comprar', 'gane', 'ganar',
      'recibi', 'cobre', 'me', 'pagaron', 'deposito', 'depositaron', 'llego',
      'salio', 'costo', 'entro', 'en', 'de', 'del', 'la', 'el', 'los', 'las',
      'un', 'una', 'unos', 'unas', 'por', 'para', 'con', 'al', 'a', 'que',
      'hoy', 'ayer', 'anteayer', 'pesos', 'peso', 'lucas', 'luca', 'palos',
      'palo', 'mil', 'y', 'hice', 'fue',
    ].join('|') + ')\\b', 'g');

  /**
   * Lo que la persona dijo, convertido en una propuesta de movimiento.
   *
   * Devuelve SIEMPRE de dónde sacó cada cosa, para que la pantalla
   * pueda mostrarlo. Un número que aparece sin explicación es un número
   * en el que nadie confía, y menos si lo sacó un micrófono.
   */
  function entender(texto, opciones) {
    const config = opciones || {};
    const hoy = config.hoy || new Date().toISOString().slice(0, 10);
    const dicho = String(texto || '').trim();

    const montos = montosDe(dicho);
    const elTipo = tipoDe(dicho);
    const cuando = fechaDe(dicho, hoy);

    // De varios montos nos quedamos con el mayor: si alguien dice
    // "compré 2 kilos a 3 lucas, 6 lucas en total", lo que anota es 6.
    const monto = montos.length
      ? montos.reduce((a, b) => (b.valor > a.valor ? b : a))
      : null;

    const tipo = elTipo ? elTipo.tipo : 'gasto';
    const cat = categoriaDe(dicho, tipo);

    const evidencia = [];
    if (monto)  evidencia.push({ campo: 'monto',     dicho: monto.dicho });
    if (elTipo) evidencia.push({ campo: 'tipo',      dicho: elTipo.pista });
    if (cuando) evidencia.push({ campo: 'fecha',     dicho: cuando.pista });
    if (cat)    evidencia.push({ campo: 'categoria', dicho: cat.pista });

    return {
      texto: dicho,
      tipo,
      // Si no dijo un verbo, no lo inventamos: la pantalla marca "gasto"
      // por ser lo más común, pero avisa que lo eligió ella.
      tipoDetectado: Boolean(elTipo),
      monto: monto ? monto.valor : null,
      fecha: cuando ? cuando.fecha : hoy,
      fechaDetectada: Boolean(cuando),
      categoria: cat ? cat.categoria : null,
      nota: notaDe(dicho, monto),
      evidencia,
      // Cuántas de las tres cosas que importan salieron de la frase.
      encontrados: (monto ? 1 : 0) + (elTipo ? 1 : 0) + (cat ? 1 : 0),
    };
  }

  /** La parte de la frase que vale como descripción. */
  function notaDe(dicho, monto) {
    let t = normalizar(dicho);
    if (monto) t = t.replace(monto.dicho, ' ');
    t = t.replace(/\$?\d[\d.,]*/g, ' ').replace(RELLENO, ' ')
         .replace(/\s+/g, ' ').trim();
    if (!t) return '';
    // Con la primera en mayúscula, como lo escribiría una persona.
    const corto = t.length > 60 ? t.slice(0, 57).trim() + '…' : t;
    return corto.charAt(0).toUpperCase() + corto.slice(1);
  }

  /* ============================================================
     6. VARIAS COSAS EN UNA SOLA FRASE

     "Gasté 5 lucas en comida y 20 mil en bencina" son DOS
     movimientos. Se parte por los "y" y por las comas, y cada
     pedazo se entiende por separado; solo cuentan los que traen
     su propio monto.
     ============================================================ */

  function entenderVarios(texto, opciones) {
    const pedazos = String(texto || '')
      .split(/\s*(?:,|;|\by luego\b|\btambien\b|\bademas\b|\by\b)\s*/i)
      .map(p => p.trim())
      .filter(Boolean);

    // Si al partir quedó uno solo, o los pedazos no traen monto propio,
    // era una frase sola: no hay que romperla.
    const conMonto = pedazos.filter(p => montosDe(p).length > 0);
    if (conMonto.length < 2) return [entender(texto, opciones)];

    /* El tipo y la fecha se dicen una vez y valen para todo:
       "ayer gasté 5 lucas en comida y 20 mil en bencina". El segundo
       pedazo no dice "gasté" ni "ayer", y sin esto quedaría como un
       gasto de hoy sin que nadie lo haya dicho. */
    const primera = entender(conMonto[0], opciones);
    return conMonto.map((p, i) => {
      const r = entender(p, opciones);
      if (i > 0 && !r.tipoDetectado)  { r.tipo = primera.tipo; r.tipoHeredado = true; }
      if (i > 0 && !r.fechaDetectada) { r.fecha = primera.fecha; r.fechaHeredada = true; }
      if (i > 0 && !r.categoria) r.categoria = null;
      return r;
    });
  }

  return {
    UNIDADES, CIENTOS, PLATA_CHILENA, ENTRA, SALE,
    normalizar, palabrasANumero, montosDe, tipoDe, fechaDe, categoriaDe,
    notaDe, entender, entenderVarios,
  };
})();

/* Para poder probarlo en Node sin navegador. */
if (typeof module !== 'undefined' && module.exports) module.exports = Voz;
