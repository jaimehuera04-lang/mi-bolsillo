/* ============================================================
   excel.js - Arma un archivo .xlsx de verdad, sin librerías.

   Un .xlsx no es un formato secreto: es una carpeta comprimida
   (un ZIP) con varios archivos XML adentro. Así que acá hacemos
   dos cosas:

     1. escribir el XML de cada hoja de cálculo, y
     2. meter todo en un ZIP a mano.

   Se hace a mano a propósito: el proyecto no usa librerías ni
   tiene paso de compilación, y bajar una de 400 KB para esto
   sería cambiar el trato.

   Cómo se usa:

     const archivo = Excel.crear([
       { nombre: 'Movimientos',
         columnas: [ { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
                     { titulo: 'Monto', ancho: 14, tipo: 'pesos' } ],
         filas: [ ['2026-08-27', 12500] ] },
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
  const ESTILO = { normal: 0, encabezado: 1, pesos: 2, fecha: 3, porcentaje: 4 };

  const estiloDeTipo = tipo =>
    tipo === 'pesos' ? ESTILO.pesos
      : tipo === 'fecha' ? ESTILO.fecha
        : tipo === 'porcentaje' ? ESTILO.porcentaje
          : ESTILO.normal;

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
    if (tipo === 'pesos' || tipo === 'numero' || tipo === 'porcentaje') {
      const n = Number(valor);
      if (!Number.isFinite(n)) return '<c r="' + referencia + '" s="' + estilo + '"/>';
      return '<c r="' + referencia + '" s="' + estilo + '"><v>' + n + '</v></c>';
    }
    return '<c r="' + referencia + '" s="' + estilo + '" t="inlineStr">'
      + '<is><t xml:space="preserve">' + escapar(valor) + '</t></is></c>';
  }

  /** El XML completo de una hoja. */
  function hojaXML(hoja) {
    const columnas = hoja.columnas;
    const ultima = letraColumna(columnas.length);
    const totalFilas = hoja.filas.length + 1;

    const anchos = columnas.map((c, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="'
      + (c.ancho || 14) + '" customWidth="1"/>'
    ).join('');

    const encabezado = '<row r="1">' + columnas.map((c, i) =>
      celda(letraColumna(i + 1) + '1', c.titulo, 'texto', ESTILO.encabezado)
    ).join('') + '</row>';

    const cuerpo = hoja.filas.map((fila, f) => {
      const numero = f + 2;
      return '<row r="' + numero + '">' + fila.map((valor, i) =>
        celda(letraColumna(i + 1) + numero, valor,
          (columnas[i] && columnas[i].tipo) || 'texto',
          estiloDeTipo(columnas[i] && columnas[i].tipo))
      ).join('') + '</row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<dimension ref="A1:' + ultima + totalFilas + '"/>'
      // la primera fila queda congelada al hacer scroll
      + '<sheetViews><sheetView workbookViewId="0">'
      + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '</sheetView></sheetViews>'
      + '<sheetFormatPr defaultRowHeight="15"/>'
      + '<cols>' + anchos + '</cols>'
      + '<sheetData>' + encabezado + cuerpo + '</sheetData>'
      // los embudos para filtrar y ordenar cada columna
      + '<autoFilter ref="A1:' + ultima + totalFilas + '"/>'
      + '</worksheet>';
  }

  function estilosXML() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<numFmts count="2">'
      + '<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/>'
      + '<numFmt numFmtId="165" formatCode="dd-mm-yyyy"/>'
      + '</numFmts>'
      + '<fonts count="2">'
      + '<font><sz val="11"/><name val="Calibri"/></font>'
      + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
      + '</fonts>'
      + '<fills count="3">'
      + '<fill><patternFill patternType="none"/></fill>'
      + '<fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid">'
      + '<fgColor rgb="FF10A072"/><bgColor indexed="64"/></patternFill></fill>'
      + '</fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="5">'
      + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      + '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      + '</cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>';
  }

  /* ---------------- 3. El armado final ---------------- */

  // Excel no acepta estos caracteres en el nombre de una pestaña
  const PROHIBIDOS = /[:*?/\\[\]]/g;

  /**
   * Recibe la lista de hojas y devuelve un Blob con el .xlsx.
   * Cada hoja es { nombre, columnas: [{titulo, ancho, tipo}], filas: [[...]] }.
   * "tipo" puede ser 'texto' (por defecto), 'pesos', 'numero',
   * 'fecha' (texto AAAA-MM-DD) o 'porcentaje' (0 a 1).
   */
  function crear(hojas) {
    // nombres de pestaña limpios y de menos de 32 letras
    const limpias = hojas.map((h, i) => ({
      columnas: h.columnas,
      filas: h.filas,
      nombre: String(h.nombre).replace(PROHIBIDOS, ' ').slice(0, 31) || ('Hoja ' + (i + 1)),
    }));

    const relacionesLibro = limpias.map((h, i) =>
      '<Relationship Id="rId' + (i + 1) + '" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
      + 'Target="worksheets/sheet' + (i + 1) + '.xml"/>'
    ).join('');

    const idEstilos = 'rId' + (limpias.length + 1);

    const archivos = [
      {
        nombre: '[Content_Types].xml',
        texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          + limpias.map((h, i) =>
            '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" '
            + 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          ).join('')
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
      { nombre: 'xl/styles.xml', texto: estilosXML() },
      ...limpias.map((h, i) => ({
        nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml',
        texto: hojaXML(h),
      })),
    ];

    return armarZip(archivos.map(a => ({
      nombre: a.nombre,
      datos: codificador.encode(a.texto),
    })));
  }

  return { crear };
})();
