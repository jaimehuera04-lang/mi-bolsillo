/* ============================================================
   src/core/lector.js
   Saca movimientos del texto de un comprobante o una cartola.

   Es una función pura: entra TEXTO, sale una propuesta. No abre
   archivos (de eso se encarga /src/ui/archivos.js), no dibuja y
   no guarda nada. Por eso se puede probar en Node sin navegador:
   herramientas/probar-lector.js.

   Tres cosas que este archivo NO hace, a propósito:

   1. No adivina con inteligencia artificial. Todo lo que decide
      sale de una expresión regular o del diccionario de
      /src/data/pistas.js. Regla 1 de la casa: la IA nunca calcula.
   2. No guarda nada solo. Devuelve una PROPUESTA con su evidencia
      ("el monto salió de la línea Total a pagar $45.990") y es la
      persona la que confirma. Un lector que anota solo es un lector
      que te ensucia el mes sin que te enteres.
   3. No inventa lo que no encontró. Si no hay monto, el campo viene
      en null y la pantalla lo deja vacío, no en cero.
   ============================================================ */

const Lector = (() => {

  /* ============================================================
     1. Limpieza previa

     Antes de buscar montos hay que tapar los números que NO son
     plata, o el lector se lleva el RUT del comercio como si fuera
     el total. Tapar = reemplazar por espacios, para que las
     posiciones del texto no se muevan.
     ============================================================ */

  const espacios = n => ' '.repeat(n);

  /* Un RUT chileno: 12.345.678-9 o 12345678-K */
  const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b/g;
  /* Tarjetas enmascaradas: ****1234, XXXX 5678 */
  const TARJETA = /(?:[*xX]{3,}\s*\d{3,4})|(?:\d{4}\s*[*xX]{4,})/g;
  /* Corridas larguísimas de dígitos: cuentas, folios, códigos de barra */
  const CODIGO_LARGO = /\b\d{10,}\b/g;
  /* Horas: 14:32, 09:05:22 */
  const HORA = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

  function taparRuido(texto) {
    return texto
      .replace(RUT, c => espacios(c.length))
      .replace(TARJETA, c => espacios(c.length))
      .replace(CODIGO_LARGO, c => espacios(c.length))
      .replace(HORA, c => espacios(c.length));
  }

  /* ============================================================
     2. Fechas
     ============================================================ */

  const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const dosDigitos = n => String(n).padStart(2, '0');
  const aISO = (a, m, d) => `${a}-${dosDigitos(m)}-${dosDigitos(d)}`;

  /** ¿Existe de verdad ese día? El 31 de febrero no. */
  function fechaValida(a, m, d) {
    if (!(a >= 2000 && a <= 2100)) return false;
    if (!(m >= 1 && m <= 12)) return false;
    if (!(d >= 1 && d <= 31)) return false;
    return d <= new Date(a, m, 0).getDate();
  }

  /* En Chile la fecha se escribe dd/mm/aaaa. Un 03/04 es el 3 de abril. */
  const FECHA_NUMERICA = /\b(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  const FECHA_LARGA = new RegExp(
    '\\b(\\d{1,2})\\s*(?:de\\s+)?(' + MESES_LARGOS.join('|') + ')\\.?\\s*(?:de\\s+)?(\\d{4})\\b', 'gi');
  const FECHA_CORTA = new RegExp(
    '\\b(\\d{1,2})[\\s\\-\\/]+(' + MESES_CORTOS.join('|') + ')[a-z]*\\.?[\\s\\-\\/]+(\\d{2,4})\\b', 'gi');

  const anioCompleto = n => (n < 100 ? (n < 70 ? 2000 + n : 1900 + n) : n);

  /**
   * Todas las fechas del texto, en el orden en que aparecen.
   * Cada una trae su posición para poder mirar qué decía la línea.
   */
  function fechasDe(texto) {
    const salida = [];
    const agregar = (iso, indice, crudo) => {
      if (iso) salida.push({ iso, indice, crudo });
    };

    let m;
    FECHA_NUMERICA.lastIndex = 0;
    while ((m = FECHA_NUMERICA.exec(texto)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      // 2026-03-12 (ISO) se distingue porque el primer grupo tiene 4 cifras
      if (m[1].length === 4) {
        if (fechaValida(a, b, c)) agregar(aISO(a, b, c), m.index, m[0]);
      } else {
        const anio = anioCompleto(c);
        if (fechaValida(anio, b, a)) agregar(aISO(anio, b, a), m.index, m[0]);
      }
    }

    FECHA_LARGA.lastIndex = 0;
    while ((m = FECHA_LARGA.exec(texto)) !== null) {
      const dia = Number(m[1]);
      const mes = MESES_LARGOS.indexOf(m[2].toLowerCase()) + 1;
      const anio = Number(m[3]);
      if (fechaValida(anio, mes, dia)) agregar(aISO(anio, mes, dia), m.index, m[0]);
    }

    FECHA_CORTA.lastIndex = 0;
    while ((m = FECHA_CORTA.exec(texto)) !== null) {
      const dia = Number(m[1]);
      const mes = MESES_CORTOS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1;
      const anio = anioCompleto(Number(m[3]));
      if (fechaValida(anio, mes, dia)) agregar(aISO(anio, mes, dia), m.index, m[0]);
    }

    return salida.sort((x, y) => x.indice - y.indice);
  }

  /* ============================================================
     3. Montos

     Un monto chileno se escribe $12.990 o 12.990 o 45000. Nunca
     con centavos: la regla 3 de la casa dice pesos enteros, así
     que si viene ",00" lo botamos en vez de redondear.
     ============================================================ */

  const MONTO = /(\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{2,9})(?:\s*,\s*\d{2}\b|\s*\.\s*-)?/g;

  const MINIMO = 100;              // menos de cien pesos no es un movimiento
  const MAXIMO = 999999999;        // mil millones ya no cabe en un bolsillo

  /** La línea completa en la que cae esa posición del texto. */
  function lineaEn(texto, indice) {
    const desde = texto.lastIndexOf('\n', indice - 1) + 1;
    let hasta = texto.indexOf('\n', indice);
    if (hasta === -1) hasta = texto.length;
    return texto.slice(desde, hasta).trim();
  }

  /**
   * Todos los montos plausibles, cada uno con su puntaje.
   * El puntaje es lo único que decide cuál gana, y se explica solo:
   * gana el que está pegado a la palabra "total".
   */
  function montosDe(texto) {
    const limpio = taparRuido(texto);
    const salida = [];
    let m;

    MONTO.lastIndex = 0;
    while ((m = MONTO.exec(limpio)) !== null) {
      const conPuntos = m[2].includes('.');
      const valor = Number(m[2].replace(/\./g, ''));
      if (!Number.isFinite(valor) || valor < MINIMO || valor > MAXIMO) continue;

      // Un número pelado de 4 cifras entre 1900 y 2100 casi siempre es un año.
      if (!conPuntos && !m[1] && valor >= 1900 && valor <= 2100) continue;

      const linea = lineaEn(limpio, m.index);
      const lineaN = Pistas.normalizar(linea);

      // Lo que va antes del número en su propia línea: ahí está el rótulo.
      const antes = Pistas.normalizar(
        limpio.slice(Math.max(0, m.index - 45), m.index).split('\n').pop());

      if (Pistas.ROTULOS_PROHIBIDOS.some(p => antes.includes(p))) continue;

      let puntaje = 0;
      const rotulo = Pistas.ROTULOS_MONTO.find(r => antes.includes(r))
                  || Pistas.ROTULOS_MONTO.find(r => lineaN.includes(r));
      if (rotulo) {
        // los primeros de la lista son los más específicos ("total a pagar"
        // vale más que "total" a secas)
        puntaje += 100 - Pistas.ROTULOS_MONTO.indexOf(rotulo) * 3;
        if (antes.includes(rotulo)) puntaje += 25;   // el rótulo va justo antes
      }
      if (m[1]) puntaje += 20;          // trae el signo $
      if (conPuntos) puntaje += 30;     // 12.990 se escribió como plata

      // El saldo de una cartola no es el monto del movimiento.
      if (lineaN.includes('saldo')) puntaje -= 60;

      salida.push({ valor, puntaje, indice: m.index, linea, rotulo: rotulo || '' });
    }

    return salida;
  }

  /** El monto más probable del texto, o null si no hay ninguno creíble. */
  function montoDe(texto) {
    const todos = montosDe(texto);
    if (!todos.length) return null;
    todos.sort((a, b) => (b.puntaje - a.puntaje) || (b.valor - a.valor));
    return todos[0];
  }

  /* ============================================================
     4. ¿Entró o salió la plata?
     ============================================================ */

  /**
   * Gana la frase más larga encontrada, porque es la más específica:
   * "transferencia recibida" le gana a "transferencia" y a "cargo".
   */
  function tipoDe(texto) {
    const t = Pistas.normalizar(texto);
    let mejor = null;

    for (const frase of Pistas.ENTRA) {
      if (t.includes(frase) && (!mejor || frase.length > mejor.frase.length)) {
        mejor = { tipo: 'ingreso', frase };
      }
    }
    for (const frase of Pistas.SALE) {
      if (t.includes(frase) && (!mejor || frase.length > mejor.frase.length)) {
        mejor = { tipo: 'gasto', frase };
      }
    }
    // Sin ninguna pista, un comprobante suele ser algo que pagaste.
    return mejor || { tipo: 'gasto', frase: '' };
  }

  /* ============================================================
     5. De quién era la plata

     Se busca en este orden: un rótulo explícito ("Destinatario:"),
     después el comercio que reconoció el diccionario, y al final
     la primera línea que parezca un nombre.
     ============================================================ */

  const ROTULOS_NOMBRE = /^\s*(destinatario|beneficiario|comercio|empresa|razon social|razón social|nombre|pagado a|pagaste a|remitente|origen|de|para|glosa|detalle|concepto|descripcion|descripción)\s*[:\-]\s*(.+)$/i;

  function descripcionDe(texto, pistaComercio) {
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

    for (const linea of lineas) {
      const m = linea.match(ROTULOS_NOMBRE);
      if (m && m[2] && m[2].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '').length >= 3) {
        return recortar(m[2]);
      }
    }

    // El comercio que reconoció el diccionario, escrito como venía en el papel.
    if (pistaComercio) {
      for (const linea of lineas) {
        if (Pistas.normalizar(linea).includes(pistaComercio)) return recortar(linea);
      }
    }

    // Última opción: la primera línea con letras de verdad que no sea un título.
    for (const linea of lineas) {
      const soloLetras = linea.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ ]/g, '').trim();
      if (soloLetras.length >= 5 && !/^(comprobante|transferencia|boleta|factura|recibo)$/i.test(soloLetras)) {
        return recortar(linea);
      }
    }
    return '';
  }

  /* El campo de nota acepta 60 caracteres; cortamos por palabra. */
  function recortar(texto, largo = 58) {
    const limpio = String(texto).replace(/\s+/g, ' ').trim();
    if (limpio.length <= largo) return limpio;
    const corte = limpio.slice(0, largo);
    const ultimo = corte.lastIndexOf(' ');
    return (ultimo > 20 ? corte.slice(0, ultimo) : corte) + '…';
  }

  /* ============================================================
     6. Un comprobante -> un movimiento propuesto
     ============================================================ */

  /**
   * @param {string} texto  lo que decía el archivo
   * @param {object} opciones
   *        hoy      → 'AAAA-MM-DD' para no aceptar fechas del futuro
   *        fechaAlternativa → la del EXIF de la foto, si el texto no trae ninguna
   * @returns propuesta con tipo, monto, fecha, nota, categoría y la
   *          evidencia de dónde salió cada cosa.
   */
  function leerComprobante(texto, opciones) {
    const o = opciones || {};
    const hoy = o.hoy || null;
    const crudo = String(texto || '');
    const evidencia = [];

    /* ---- Monto ---- */
    const monto = montoDe(crudo);
    if (monto) {
      evidencia.push({ campo: 'monto', linea: recortar(monto.linea, 70) });
    }

    /* ---- Fecha ---- */
    const fechas = fechasDe(crudo).filter(f => !hoy || f.iso <= hoy);
    // la que está en una línea que dice "fecha" manda sobre las demás
    const conRotulo = fechas.find(f => Pistas.normalizar(lineaEn(crudo, f.indice)).includes('fecha'));
    const elegida = conRotulo || fechas[0] || null;
    let fecha = elegida ? elegida.iso : null;
    if (elegida) {
      evidencia.push({ campo: 'fecha', linea: recortar(lineaEn(crudo, elegida.indice), 70) });
    } else if (o.fechaAlternativa) {
      fecha = o.fechaAlternativa;
      evidencia.push({ campo: 'fecha', linea: 'La fecha en que se tomó la foto' });
    }

    /* ---- Ingreso o gasto ---- */
    const t = tipoDe(crudo);
    if (t.frase) evidencia.push({ campo: 'tipo', linea: `Dice "${t.frase}"` });

    /* ---- Categoría ---- */
    const pista = t.tipo === 'ingreso'
      ? Pistas.categoriaDeIngreso(crudo)
      : Pistas.categoriaDeGasto(crudo);
    if (pista) evidencia.push({ campo: 'categoria', linea: `Reconocimos "${pista.pista}"` });

    /* ---- Descripción ---- */
    const nota = descripcionDe(crudo, pista ? pista.pista : '');

    return {
      tipo: t.tipo,
      // Sin esta bandera, un papel que no dice nada sobre la dirección de
      // la plata devolvería 'gasto' igual, y la pantalla le daría vuelta
      // el tipo a quien ya había marcado "Ingreso". Pasa con las fotos,
      // que no traen ni una palabra que leer.
      tipoDetectado: Boolean(t.frase),
      monto: monto ? monto.valor : null,
      fecha,
      nota,
      categoria: pista ? pista.categoria : null,
      evidencia,
      // Cuántas de las tres cosas que importan salieron del papel.
      encontrados: (monto ? 1 : 0) + (fecha ? 1 : 0) + (pista ? 1 : 0),
    };
  }

  /* ============================================================
     7. Una cartola -> muchos movimientos propuestos

     Funciona de dos maneras, y se elige sola:
       a) con encabezados (el CSV que baja el banco)
       b) línea por línea (lo que uno pega desde la pantalla del banco)
     ============================================================ */

  const SEPARADORES = [';', '\t', ',', '|'];

  /** El separador que parte las líneas en la misma cantidad de trozos. */
  function separadorDe(lineas) {
    let mejor = null;
    for (const sep of SEPARADORES) {
      const cuentas = lineas.map(l => l.split(sep).length);
      const mediana = cuentas.slice().sort((a, b) => a - b)[Math.floor(cuentas.length / 2)];
      if (mediana < 2) continue;
      const parejas = cuentas.filter(c => c === mediana).length / cuentas.length;
      const puntaje = mediana * parejas;
      if (!mejor || puntaje > mejor.puntaje) mejor = { sep, puntaje, columnas: mediana };
    }
    return mejor;
  }

  /** Qué es cada columna, mirando el encabezado. */
  function mapearColumnas(celdas) {
    const mapa = {};
    celdas.forEach((celda, i) => {
      const c = Pistas.normalizar(celda).replace(/["']/g, '');
      if (!c) return;
      for (const [campo, nombres] of Object.entries(Pistas.COLUMNAS)) {
        if (mapa[campo] !== undefined) continue;
        if (nombres.some(n => c === n || c.startsWith(n + ' ') || c.endsWith(' ' + n))) {
          mapa[campo] = i;
          return;
        }
      }
    });
    return mapa;
  }

  /** Un número de cartola: "-45.000", "(45.000)", "45.000,00", "" */
  function numeroDeCelda(celda) {
    const t = String(celda == null ? '' : celda).trim();
    if (!t) return null;
    const negativo = t.startsWith('-') || (t.startsWith('(') && t.endsWith(')'));
    const digitos = t.replace(/[^\d]/g, '');
    if (!digitos) return null;
    // ",00" o ".00" al final son centavos que en Chile no existen: se van
    const sinCentavos = /[.,]\d{2}\s*[)]?$/.test(t) ? digitos.slice(0, -2) : digitos;
    const valor = Number(sinCentavos);
    if (!Number.isFinite(valor) || valor === 0) return null;
    return negativo ? -valor : valor;
  }

  function fechaDeCelda(celda) {
    const f = fechasDe(String(celda == null ? '' : celda));
    return f.length ? f[0].iso : null;
  }

  /**
   * @returns { filas: [...], separador, conEncabezado, aviso }
   *          Cada fila es una propuesta igual a la de leerComprobante,
   *          más un 'crudo' con la línea original para poder mostrarla.
   */
  function leerCartola(texto, opciones) {
    const o = opciones || {};
    const hoy = o.hoy || null;
    const lineas = String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lineas.length < 2) return { filas: [], conEncabezado: false, aviso: '' };

    const elegido = separadorDe(lineas.slice(0, 40));
    if (elegido) {
      const partido = lineas.map(l => partirLinea(l, elegido.sep));
      // el encabezado es la primera fila que nombra al menos una fecha y un monto
      for (let i = 0; i < Math.min(partido.length, 15); i++) {
        const mapa = mapearColumnas(partido[i]);
        const hayMonto = mapa.monto !== undefined || mapa.cargo !== undefined || mapa.abono !== undefined;
        if (mapa.fecha !== undefined && hayMonto) {
          return {
            filas: filasDeTabla(partido.slice(i + 1), mapa, hoy),
            separador: elegido.sep,
            conEncabezado: true,
            aviso: '',
          };
        }
      }
    }

    // Sin encabezados: cada línea que traiga una fecha y un monto es candidata.
    return { filas: filasDeLineas(lineas, hoy), conEncabezado: false, aviso: '' };
  }

  /** Parte una línea respetando las comillas del CSV. */
  function partirLinea(linea, sep) {
    const celdas = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++; }
        else entreComillas = !entreComillas;
      } else if (c === sep && !entreComillas) {
        celdas.push(actual.trim());
        actual = '';
      } else {
        actual += c;
      }
    }
    celdas.push(actual.trim());
    return celdas;
  }

  function filasDeTabla(filas, mapa, hoy) {
    const salida = [];
    for (const celdas of filas) {
      const fecha = fechaDeCelda(celdas[mapa.fecha]);
      if (!fecha || (hoy && fecha > hoy)) continue;

      let monto = null;
      let tipo = null;

      const cargo = mapa.cargo !== undefined ? numeroDeCelda(celdas[mapa.cargo]) : null;
      const abono = mapa.abono !== undefined ? numeroDeCelda(celdas[mapa.abono]) : null;

      if (cargo) { monto = Math.abs(cargo); tipo = 'gasto'; }
      else if (abono) { monto = Math.abs(abono); tipo = 'ingreso'; }
      else if (mapa.monto !== undefined) {
        const n = numeroDeCelda(celdas[mapa.monto]);
        if (n) { monto = Math.abs(n); tipo = n < 0 ? 'gasto' : 'ingreso'; }
      }
      if (!monto) continue;

      const nota = mapa.descripcion !== undefined ? recortar(celdas[mapa.descripcion]) : '';
      salida.push(propuestaDeFila({ fecha, monto, tipo, nota, crudo: celdas.join(' · ') }));
    }
    return salida;
  }

  function filasDeLineas(lineas, hoy) {
    const salida = [];
    for (const linea of lineas) {
      const fechas = fechasDe(linea);
      if (!fechas.length) continue;
      const fecha = fechas[0].iso;
      if (hoy && fecha > hoy) continue;

      const monto = montoDe(linea);
      if (!monto) continue;

      // el signo menos pegado al número manda sobre las palabras
      const negativo = /-\s*\$?\s*\d/.test(linea.slice(Math.max(0, monto.indice - 3), monto.indice + 2));
      const t = tipoDe(linea);
      const nota = recortar(linea
        .replace(fechas[0].crudo, ' ')
        .replace(/\$?\s*[\d.]{3,}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim());

      salida.push(propuestaDeFila({
        fecha,
        monto: monto.valor,
        tipo: negativo ? 'gasto' : t.tipo,
        nota,
        crudo: linea,
      }));
    }
    return salida;
  }

  /** Le pone categoría a una fila ya armada. */
  function propuestaDeFila({ fecha, monto, tipo, nota, crudo }) {
    const pista = tipo === 'ingreso'
      ? Pistas.categoriaDeIngreso(nota || crudo)
      : Pistas.categoriaDeGasto(nota || crudo);
    return {
      fecha, monto, tipo, nota,
      categoria: pista ? pista.categoria : null,
      crudo,
      evidencia: [{ campo: 'linea', linea: recortar(crudo, 90) }],
    };
  }

  return {
    leerComprobante, leerCartola,
    // se exportan para poder probarlas sueltas
    montoDe, montosDe, fechasDe, tipoDe, descripcionDe, numeroDeCelda,
    separadorDe, mapearColumnas, recortar, lineaEn,
  };
})();
