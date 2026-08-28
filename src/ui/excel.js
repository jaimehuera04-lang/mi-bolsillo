/* ============================================================
   excel.js - Arma un archivo .xlsx de verdad, sin librerías.

   Un .xlsx no es un formato secreto: es una carpeta comprimida
   (un ZIP) con varios archivos XML adentro. Así que acá hacemos
   tres cosas:

     1. escribir el XML de cada hoja de cálculo,
     2. escribir el XML de cada gráfico (dona y barras), y
     3. meter todo en un ZIP a mano.

   Se hace a mano a propósito: el proyecto no usa librerías ni
   tiene paso de compilación, y bajar una de 400 KB para esto
   sería cambiar el trato.

   Cómo se usa:

     const archivo = Excel.crear([
       { nombre: 'Movimientos',
         columnas: [ { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
                     { titulo: 'Monto', ancho: 14, tipo: 'pesos' } ],
         filas: [ ['2026-08-27', 12500] ],
         graficos: [ ... ] },      // opcional, ver más abajo
     ]);
     // "archivo" es un Blob listo para descargar
   ============================================================ */

const Excel = (() => {
  'use strict';

  /* ---------------- 1. Utilidades de bytes ----------------
     El ZIP se escribe byte a byte, con los números en el orden
     que pide el formato: el byte más chico primero. */

  const u16 = n => [n & 255, (n >> 8) & 255];
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

  const codificador = new TextEncoder();

  // Tabla del CRC32, la "huella" que el ZIP le exige a cada archivo.
  let tablaCRC = null;
  function crc32(bytes) {
    if (!tablaCRC) {
      tablaCRC = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        tablaCRC[i] = c >>> 0;
      }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = tablaCRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Arma un ZIP con los archivos que le pasen. Guarda todo sin
   * comprimir (método "store"): el archivo pesa un poco más, pero
   * el código es la mitad de largo y Excel lo abre igual.
   */
  function armarZip(archivos) {
    const partes = [];
    const directorio = [];
    let posicion = 0;

    for (const archivo of archivos) {
      const nombre = codificador.encode(archivo.nombre);
      const datos = archivo.datos;
      const huella = crc32(datos);

      // Cabecera que va justo antes del contenido de cada archivo
      const cabecera = new Uint8Array([
        ...u32(0x04034b50),      // firma
        ...u16(20),              // versión necesaria para abrirlo
        ...u16(0x0800),          // los nombres van en UTF-8
        ...u16(0),               // sin comprimir
        ...u16(0), ...u16(0),    // hora y fecha (no nos importan)
        ...u32(huella),
        ...u32(datos.length),    // tamaño comprimido
        ...u32(datos.length),    // tamaño real
        ...u16(nombre.length),
        ...u16(0),               // sin campos extra
      ]);

      partes.push(cabecera, nombre, datos);

      // La misma información va repetida al final, en el "índice"
      directorio.push(new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(huella), ...u32(datos.length), ...u32(datos.length),
        ...u16(nombre.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(posicion),
        ...nombre,
      ]));

      posicion += cabecera.length + nombre.length + datos.length;
    }

    const largoDirectorio = directorio.reduce((suma, d) => suma + d.length, 0);
    const cierre = new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0), ...u16(0),
      ...u16(archivos.length), ...u16(archivos.length),
      ...u32(largoDirectorio),
      ...u32(posicion),
      ...u16(0),
    ]);

    return new Blob([...partes, ...directorio, cierre], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  /* ---------------- 2. Piezas del XML ---------------- */

  const escapar = t => String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /** Devuelve "A", "B"... "AA" a partir del número de columna (1 = A). */
  function letraColumna(n) {
    let letra = '';
    while (n > 0) {
      const resto = (n - 1) % 26;
      letra = String.fromCharCode(65 + resto) + letra;
      n = Math.floor((n - 1) / 26);
    }
    return letra;
  }

  /**
   * Excel guarda las fechas como el número de días transcurridos
   * desde el 30 de diciembre de 1899. Nada de esto se ve: en la
   * planilla aparece como una fecha normal.
   */
  function fechaANumero(iso) {
    const partes = String(iso).split('-').map(Number);
    if (partes.length !== 3 || partes.some(n => !Number.isFinite(n))) return null;
    return Date.UTC(partes[0], partes[1] - 1, partes[2]) / 86400000 + 25569;
  }

  // Los estilos disponibles. El número es la posición en cellXfs, más abajo.
  const ESTILO = {
    normal: 0, encabezado: 1, pesos: 2, fecha: 3, porcentaje: 4,
    titulo: 5, subtitulo: 6, destacado: 7, pesosGrande: 8, ajustado: 9,
  };

  const estiloDeTipo = tipo =>
    tipo === 'pesos' ? ESTILO.pesos
      : tipo === 'fecha' ? ESTILO.fecha
        : tipo === 'porcentaje' ? ESTILO.porcentaje
          : tipo === 'titulo' ? ESTILO.titulo
            : tipo === 'subtitulo' ? ESTILO.subtitulo
              : tipo === 'destacado' ? ESTILO.destacado
                : tipo === 'pesosGrande' ? ESTILO.pesosGrande
                  : tipo === 'parrafo' ? ESTILO.ajustado
                    : ESTILO.normal;

  const ES_NUMERO = { pesos: 1, numero: 1, porcentaje: 1, pesosGrande: 1 };

  /** Una celda. Los números van tal cual; el texto va "en línea". */
  function celda(referencia, valor, tipo, estilo) {
    if (valor === null || valor === undefined || valor === '') {
      return '<c r="' + referencia + '" s="' + estilo + '"/>';
    }
    if (tipo === 'fecha') {
      const n = fechaANumero(valor);
      // si la fecha viniera rara, la escribimos como texto en vez de perderla
      if (n === null) {
        return '<c r="' + referencia + '" t="inlineStr"><is><t>' + escapar(valor) + '</t></is></c>';
      }
      return '<c r="' + referencia + '" s="' + estilo + '"><v>' + n + '</v></c>';
    }
    if (ES_NUMERO[tipo]) {
      const n = Number(valor);
      if (!Number.isFinite(n)) return '<c r="' + referencia + '" s="' + estilo + '"/>';
      return '<c r="' + referencia + '" s="' + estilo + '"><v>' + n + '</v></c>';
    }
    return '<c r="' + referencia + '" s="' + estilo + '" t="inlineStr">'
      + '<is><t xml:space="preserve">' + escapar(valor) + '</t></is></c>';
  }

  /* ---------------- 3. Los gráficos ----------------

     Un gráfico dentro de un .xlsx son tres archivos que se apuntan
     entre sí: la hoja apunta a un "dibujo", el dibujo dice en qué
     celdas va pegado, y adentro va el gráfico propiamente tal, que
     no guarda los números sino que apunta al rango de celdas. Por
     eso, si editas la tabla, el gráfico se actualiza solo. */

  /** 'A2:A9' -> "'Mi hoja'!$A$2:$A$9" */
  function rangoAbsoluto(nombreHoja, rango) {
    const conSignos = rango.replace(/([A-Z]+)([0-9]+)/g, '$$$1$$$2');
    return "'" + String(nombreHoja).replace(/'/g, "''") + "'!" + conSignos;
  }

  const color = c => String(c || '#888888').replace('#', '').toUpperCase();

  /** Los textos de las categorías, guardados dentro del gráfico. */
  function cacheTextos(valores) {
    const lista = valores || [];
    return '<c:strCache><c:ptCount val="' + lista.length + '"/>'
      + lista.map((v, i) => '<c:pt idx="' + i + '"><c:v>' + escapar(v) + '</c:v></c:pt>').join('')
      + '</c:strCache>';
  }

  function cacheNumeros(valores) {
    const lista = valores || [];
    return '<c:numCache><c:formatCode>General</c:formatCode>'
      + '<c:ptCount val="' + lista.length + '"/>'
      + lista.map((v, i) => '<c:pt idx="' + i + '"><c:v>' + Number(v || 0) + '</c:v></c:pt>').join('')
      + '</c:numCache>';
  }

  /** Cómo se ven las etiquetas: acá es donde salen los porcentajes. */
  function etiquetasConPorcentaje() {
    return '<c:dLbls>'
      + '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'
      + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1">'
      + '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>'
      + '</a:defRPr></a:pPr><a:endParaRPr lang="es-CL"/></a:p></c:txPr>'
      + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/>'
      + '<c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/>'
      + '</c:dLbls>';
  }

  function tituloDeGrafico(texto) {
    if (!texto) return '<c:autoTitleDeleted val="1"/>';
    return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p>'
      + '<a:pPr><a:defRPr sz="1200" b="1"/></a:pPr>'
      + '<a:r><a:rPr lang="es-CL" sz="1200" b="1"/><a:t>' + escapar(texto) + '</a:t></a:r>'
      + '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'
      + '<c:autoTitleDeleted val="0"/>';
  }

  /** El gráfico de dona, con un pedazo de color por categoría. */
  function donaXML(g, nombreHoja) {
    const colores = g.colores || [];
    const puntos = colores.map((c, i) =>
      '<c:dPt><c:idx val="' + i + '"/><c:bubble3D val="0"/>'
      + '<c:spPr><a:solidFill><a:srgbClr val="' + color(c) + '"/></a:solidFill>'
      + '<a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>'
    ).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
      + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<c:chart>'
      + tituloDeGrafico(g.titulo)
      + '<c:plotArea><c:layout/>'
      + '<c:doughnutChart><c:varyColors val="1"/>'
      + '<c:ser><c:idx val="0"/><c:order val="0"/>'
      + (g.nombreSerie
        ? '<c:tx><c:strRef><c:f>' + rangoAbsoluto(nombreHoja, g.nombreSerie) + '</c:f></c:strRef></c:tx>'
        : '')
      + puntos
      + etiquetasConPorcentaje()
      + '<c:cat><c:strRef><c:f>' + rangoAbsoluto(nombreHoja, g.categorias) + '</c:f>'
      + cacheTextos(g.cacheCategorias) + '</c:strRef></c:cat>'
      + '<c:val><c:numRef><c:f>' + rangoAbsoluto(nombreHoja, g.valores) + '</c:f>'
      + cacheNumeros(g.cacheValores) + '</c:numRef></c:val>'
      + '</c:ser>'
      + '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/>'
      + '<c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>'
      + '<c:firstSliceAng val="0"/><c:holeSize val="' + (g.hueco || 52) + '"/>'
      + '</c:doughnutChart>'
      + '</c:plotArea>'
      + '<c:legend><c:legendPos val="r"/><c:overlay val="0"/>'
      + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr>'
      + '<a:endParaRPr lang="es-CL"/></a:p></c:txPr></c:legend>'
      + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
      + '</c:chart></c:chartSpace>';
  }

  /** El gráfico de barras, para comparar mes con mes. */
  function barrasXML(g, nombreHoja) {
    const ejeCat = 111111111;
    const ejeVal = 222222222;

    const series = (g.series || []).map((s, i) =>
      '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>'
      + (s.nombreRef
        ? '<c:tx><c:strRef><c:f>' + rangoAbsoluto(nombreHoja, s.nombreRef) + '</c:f>'
          + cacheTextos([s.nombre || '']) + '</c:strRef></c:tx>'
        : '')
      + '<c:spPr><a:solidFill><a:srgbClr val="' + color(s.color) + '"/></a:solidFill></c:spPr>'
      + '<c:invertIfNegative val="0"/>'
      + '<c:cat><c:strRef><c:f>' + rangoAbsoluto(nombreHoja, g.categorias) + '</c:f>'
      + cacheTextos(g.cacheCategorias) + '</c:strRef></c:cat>'
      + '<c:val><c:numRef><c:f>' + rangoAbsoluto(nombreHoja, s.ref) + '</c:f>'
      + cacheNumeros(s.cache) + '</c:numRef></c:val>'
      + '</c:ser>'
    ).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
      + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<c:chart>'
      + tituloDeGrafico(g.titulo)
      + '<c:plotArea><c:layout/>'
      + '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>'
      + series
      + '<c:gapWidth val="60"/>'
      + '<c:axId val="' + ejeCat + '"/><c:axId val="' + ejeVal + '"/>'
      + '</c:barChart>'
      + '<c:catAx><c:axId val="' + ejeCat + '"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
      + '<c:delete val="0"/><c:axPos val="b"/>'
      + '<c:txPr><a:bodyPr rot="-2700000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr>'
      + '<a:endParaRPr lang="es-CL"/></a:p></c:txPr>'
      + '<c:crossAx val="' + ejeVal + '"/></c:catAx>'
      + '<c:valAx><c:axId val="' + ejeVal + '"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
      + '<c:delete val="0"/><c:axPos val="l"/>'
      + '<c:majorGridlines/>'
      + '<c:numFmt formatCode="&quot;$&quot;#,##0" sourceLinked="0"/>'
      + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr>'
      + '<a:endParaRPr lang="es-CL"/></a:p></c:txPr>'
      + '<c:crossAx val="' + ejeCat + '"/></c:valAx>'
      + '</c:plotArea>'
      + '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'
      + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
      + '</c:chart></c:chartSpace>';
  }

  /** El "dibujo": dice en qué celdas queda pegado cada gráfico. */
  function dibujoXML(graficos) {
    const anclas = graficos.map((g, i) => {
      const desde = g.ancla || { columna: 0, fila: 0 };
      const hasta = {
        columna: desde.columna + (g.ancho || 9),
        fila: desde.fila + (g.alto || 16),
      };
      return '<xdr:twoCellAnchor>'
        + '<xdr:from><xdr:col>' + desde.columna + '</xdr:col><xdr:colOff>0</xdr:colOff>'
        + '<xdr:row>' + desde.fila + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
        + '<xdr:to><xdr:col>' + hasta.columna + '</xdr:col><xdr:colOff>0</xdr:colOff>'
        + '<xdr:row>' + hasta.fila + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'
        + '<xdr:graphicFrame macro="">'
        + '<xdr:nvGraphicFramePr>'
        + '<xdr:cNvPr id="' + (i + 2) + '" name="Grafico ' + (i + 1) + '"/>'
        + '<xdr:cNvGraphicFramePr/>'
        + '</xdr:nvGraphicFramePr>'
        + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
        + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
        + '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
        + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        + ' r:id="rId' + (i + 1) + '"/>'
        + '</a:graphicData></a:graphic>'
        + '</xdr:graphicFrame>'
        + '<xdr:clientData/>'
        + '</xdr:twoCellAnchor>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"'
      + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
      + anclas
      + '</xdr:wsDr>';
  }

  /* ---------------- 4. El XML de una hoja ---------------- */

  function hojaXML(hoja, tieneDibujo) {
    const columnas = hoja.columnas;
    const ultima = letraColumna(Math.max(1, columnas.length));
    const totalFilas = hoja.filas.length + (hoja.sinEncabezado ? 0 : 1);

    const anchos = columnas.map((c, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="'
      + (c.ancho || 14) + '" customWidth="1"/>'
    ).join('');

    const encabezado = hoja.sinEncabezado ? '' : '<row r="1">' + columnas.map((c, i) =>
      celda(letraColumna(i + 1) + '1', c.titulo, 'texto', ESTILO.encabezado)
    ).join('') + '</row>';

    const desplazamiento = hoja.sinEncabezado ? 1 : 2;
    const cuerpo = hoja.filas.map((fila, f) => {
      const numero = f + desplazamiento;
      const alto = (hoja.altoDeFila && hoja.altoDeFila[f])
        ? ' ht="' + hoja.altoDeFila[f] + '" customHeight="1"' : '';
      return '<row r="' + numero + '"' + alto + '>' + fila.map((valor, i) => {
        // una celda puede traer su propio tipo: ['texto', 'parrafo']
        const propio = Array.isArray(valor) ? valor[1] : null;
        const contenido = Array.isArray(valor) ? valor[0] : valor;
        const tipo = propio || (columnas[i] && columnas[i].tipo) || 'texto';
        return celda(letraColumna(i + 1) + numero, contenido, tipo, estiloDeTipo(tipo));
      }).join('') + '</row>';
    }).join('');

    const combinadas = (hoja.combinar && hoja.combinar.length)
      ? '<mergeCells count="' + hoja.combinar.length + '">'
        + hoja.combinar.map(r => '<mergeCell ref="' + r + '"/>').join('')
        + '</mergeCells>'
      : '';

    // el orden de estos elementos lo exige el formato: no se pueden mover
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<dimension ref="A1:' + ultima + Math.max(1, totalFilas) + '"/>'
      + '<sheetViews><sheetView workbookViewId="0"'
      + (hoja.sinCuadricula ? ' showGridLines="0"' : '') + '>'
      + (hoja.sinEncabezado ? ''
        : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>')
      + '</sheetView></sheetViews>'
      + '<sheetFormatPr defaultRowHeight="15"/>'
      + '<cols>' + anchos + '</cols>'
      + '<sheetData>' + encabezado + cuerpo + '</sheetData>'
      + (hoja.sinEncabezado || hoja.sinFiltro ? ''
        : '<autoFilter ref="A1:' + ultima + Math.max(1, totalFilas) + '"/>')
      + combinadas
      + (tieneDibujo ? '<drawing r:id="rId1"/>' : '')
      + '</worksheet>';
  }

  function estilosXML() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<numFmts count="2">'
      + '<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>'
      + '<numFmt numFmtId="165" formatCode="dd-mm-yyyy"/>'
      + '</numFmts>'
      + '<fonts count="5">'
      + '<font><sz val="11"/><name val="Calibri"/></font>'
      + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
      + '<font><b/><sz val="16"/><color rgb="FF0B7554"/><name val="Calibri"/></font>'
      + '<font><b/><sz val="12"/><color rgb="FF1C2530"/><name val="Calibri"/></font>'
      + '<font><b/><sz val="14"/><name val="Calibri"/></font>'
      + '</fonts>'
      + '<fills count="4">'
      + '<fill><patternFill patternType="none"/></fill>'
      + '<fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid">'
      + '<fgColor rgb="FF10A072"/><bgColor indexed="64"/></patternFill></fill>'
      + '<fill><patternFill patternType="solid">'
      + '<fgColor rgb="FFE8F7F1"/><bgColor indexed="64"/></patternFill></fill>'
      + '</fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="10">'
      // 0 normal
      + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      // 1 encabezado de tabla
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      // 2 pesos
      + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      // 3 fecha
      + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      // 4 porcentaje
      + '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      // 5 título grande
      + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
      // 6 subtítulo de sección
      + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
      // 7 destacado, con fondo verde suave
      + '<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"'
      + ' applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
      // 8 pesos en grande
      + '<xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0"'
      + ' applyNumberFormat="1" applyFont="1"/>'
      // 9 párrafo que se acomoda solo
      + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">'
      + '<alignment vertical="top" wrapText="1"/></xf>'
      + '</cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>';
  }

  /* ---------------- 5. El armado final ---------------- */

  // Excel no acepta estos caracteres en el nombre de una pestaña
  const PROHIBIDOS = /[:*?/\\[\]]/g;

  /**
   * Recibe la lista de hojas y devuelve un Blob con el .xlsx.
   *
   * Cada hoja es:
   *   { nombre, columnas: [{titulo, ancho, tipo}], filas: [[...]],
   *     graficos?, combinar?, sinEncabezado?, sinFiltro?, sinCuadricula?, altoDeFila? }
   *
   * "tipo" puede ser 'texto' (por defecto), 'pesos', 'numero', 'fecha'
   * (texto AAAA-MM-DD), 'porcentaje' (0 a 1), 'titulo', 'subtitulo',
   * 'destacado', 'pesosGrande' o 'parrafo'. Una celda puede traer el
   * suyo propio pasándola como ['el texto', 'subtitulo'].
   *
   * Cada gráfico es:
   *   { tipo: 'dona', titulo, categorias: 'A2:A9', valores: 'B2:B9',
   *     colores: ['#..'], cacheCategorias: [], cacheValores: [],
   *     ancla: {columna, fila}, ancho, alto }
   *   { tipo: 'barras', titulo, categorias: 'A2:A13',
   *     series: [{ref, nombreRef, nombre, color, cache}], ... }
   */
  function crear(hojas) {
    // nombres de pestaña limpios y de menos de 32 letras
    const limpias = hojas.map((h, i) => ({
      ...h,
      nombre: String(h.nombre).replace(PROHIBIDOS, ' ').slice(0, 31) || ('Hoja ' + (i + 1)),
    }));

    const archivos = [];
    const tiposExtra = [];        // overrides para [Content_Types].xml
    let numeroDeGrafico = 0;

    limpias.forEach((hoja, i) => {
      const graficos = hoja.graficos || [];
      const numeroHoja = i + 1;

      archivos.push({
        nombre: 'xl/worksheets/sheet' + numeroHoja + '.xml',
        texto: hojaXML(hoja, graficos.length > 0),
      });
      tiposExtra.push('<Override PartName="/xl/worksheets/sheet' + numeroHoja + '.xml" '
        + 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');

      if (!graficos.length) return;

      // la hoja apunta al dibujo
      archivos.push({
        nombre: 'xl/worksheets/_rels/sheet' + numeroHoja + '.xml.rels',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + '<Relationship Id="rId1" '
          + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" '
          + 'Target="../drawings/drawing' + numeroHoja + '.xml"/>'
          + '</Relationships>',
      });

      archivos.push({
        nombre: 'xl/drawings/drawing' + numeroHoja + '.xml',
        texto: dibujoXML(graficos),
      });
      tiposExtra.push('<Override PartName="/xl/drawings/drawing' + numeroHoja + '.xml" '
        + 'ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');

      // y el dibujo apunta a cada gráfico
      const relaciones = [];
      graficos.forEach((g, j) => {
        numeroDeGrafico++;
        const nombreArchivo = 'xl/charts/chart' + numeroDeGrafico + '.xml';
        archivos.push({
          nombre: nombreArchivo,
          texto: g.tipo === 'barras' ? barrasXML(g, hoja.nombre) : donaXML(g, hoja.nombre),
        });
        tiposExtra.push('<Override PartName="/' + nombreArchivo + '" '
          + 'ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
        relaciones.push('<Relationship Id="rId' + (j + 1) + '" '
          + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" '
          + 'Target="../charts/chart' + numeroDeGrafico + '.xml"/>');
      });

      archivos.push({
        nombre: 'xl/drawings/_rels/drawing' + numeroHoja + '.xml.rels',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + relaciones.join('')
          + '</Relationships>',
      });
    });

    const relacionesLibro = limpias.map((h, i) =>
      '<Relationship Id="rId' + (i + 1) + '" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
      + 'Target="worksheets/sheet' + (i + 1) + '.xml"/>'
    ).join('');

    const idEstilos = 'rId' + (limpias.length + 1);

    archivos.unshift(
      {
        nombre: '[Content_Types].xml',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          + tiposExtra.join('')
          + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
          + '</Types>',
      },
      {
        nombre: '_rels/.rels',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + '<Relationship Id="rId1" '
          + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
          + 'Target="xl/workbook.xml"/>'
          + '</Relationships>',
      },
      {
        nombre: 'xl/workbook.xml',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
          + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          + '<sheets>'
          + limpias.map((h, i) =>
            '<sheet name="' + escapar(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'
          ).join('')
          + '</sheets></workbook>',
      },
      {
        nombre: 'xl/_rels/workbook.xml.rels',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + relacionesLibro
          + '<Relationship Id="' + idEstilos + '" '
          + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
          + 'Target="styles.xml"/>'
          + '</Relationships>',
      },
      { nombre: 'xl/styles.xml', texto: estilosXML() }
    );

    return armarZip(archivos.map(a => ({
      nombre: a.nombre,
      datos: codificador.encode(a.texto),
    })));
  }

  return { crear };
})();
