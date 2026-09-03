/* ============================================================
   src/datos-negocio.js
   La puerta de entrada del negocio, igual que datos.js lo es de
   las finanzas personales. Es lo único que la pantalla del
   negocio conoce.

   Acá NO hay cuentas matemáticas (esas están en core/negocio.js)
   ni código de localStorage (ese está en storage/). Este archivo
   valida lo que llega, llama a quien corresponde y guarda.

   LA FRONTERA, que es lo más importante de todo el módulo:
   la plata del negocio NO es tu plata. Una venta no es un ingreso
   tuyo y una compra de mercadería no es un gasto tuyo. Si se
   mezclaran, tu sueldo libre quedaría inflado con plata que en
   realidad hay que devolverle al negocio para reponer, que es el
   error que quiebra almacenes.

   Lo único que cruza la frontera es el RETIRO: el día que te
   pagas a ti mismo. Eso sí entra a tus movimientos como ingreso
   y recién ahí cuenta para tu sueldo libre. Ver registrarRetiro().
   ============================================================ */

const DatosNegocio = (() => {

  /* El objeto negocio vive dentro del estado general, así que se
     guarda, se respalda y se sincroniza con todo lo demás sin
     código aparte. */
  const neg = () => {
    const estado = Datos.obtener();
    // Red de seguridad: si alguien restaura un respaldo viejo a mano,
    // mejor un negocio en blanco que la app reventando.
    if (!estado.negocio) estado.negocio = Esquema.negocioNuevo();
    return estado.negocio;
  };

  const guardar = () => Datos.guardar();
  const texto = v => String(v === undefined || v === null ? '' : v).trim();
  const entero = v => Dinero.entero(v);
  const cantidad = v => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
  };

  /* ---------------- Encender y apagar ---------------- */

  const estaActivo = () => Boolean(neg().activo);
  const perfil = () => neg().perfil;
  const ajustes = () => neg().ajustes;

  /** Enciende la pestaña Negocio. Sin nombre no hay negocio. */
  function encender({ nombre, rubro }) {
    const limpio = texto(nombre);
    if (!limpio) throw new Error('¿Cómo se llama tu negocio?');
    const n = neg();
    n.activo = true;
    n.perfil.nombre = limpio;
    if (rubro !== undefined) n.perfil.rubro = texto(rubro);
    guardar();
    return n;
  }

  /**
   * Apaga la pestaña. No borra nada: los productos, las ventas y los
   * clientes quedan enteros esperando. Borrar por apagar sería una
   * trampa: el botón dice "apagar", no "perder tres años de ventas".
   */
  function apagar() {
    neg().activo = false;
    guardar();
  }

  function guardarPerfil(datos) {
    const p = neg().perfil;
    ['nombre', 'rubro', 'rut', 'telefono', 'correo', 'direccion', 'mensaje', 'emoji', 'color']
      .forEach(campo => { if (datos[campo] !== undefined) p[campo] = texto(datos[campo]); });
    if (!p.nombre) throw new Error('¿Cómo se llama tu negocio?');
    guardar();
    return p;
  }

  function guardarAjustes(datos) {
    const a = neg().ajustes;
    if (datos.diasCotizacion !== undefined) {
      a.diasCotizacion = Math.max(1, Math.min(365, entero(datos.diasCotizacion) || 15));
    }
    if (datos.avisarStockBajo !== undefined) a.avisarStockBajo = Boolean(datos.avisarStockBajo);
    if (datos.catalogo) {
      if (datos.catalogo.whatsapp !== undefined) a.catalogo.whatsapp = texto(datos.catalogo.whatsapp);
      if (datos.catalogo.mostrarPrecios !== undefined) a.catalogo.mostrarPrecios = Boolean(datos.catalogo.mostrarPrecios);
      if (datos.catalogo.mostrarStock !== undefined) a.catalogo.mostrarStock = Boolean(datos.catalogo.mostrarStock);
    }
    guardar();
    return a;
  }

  /* ---------------- El folio ----------------
     Un número correlativo por documento. Sube solo cuando el
     documento se crea de verdad, nunca al abrir el formulario:
     si subiera al abrirlo, cada vez que alguien se arrepiente
     quedaría un hueco en la numeración que después nadie sabe
     explicarle al SII.                                          */

  function siguienteFolio(cual) {
    const a = neg().ajustes;
    const llave = { venta: 'folioVenta', cotizacion: 'folioCotizacion', compra: 'folioCompra' }[cual];
    const numero = Math.max(1, entero(a[llave]) || 1);
    a[llave] = numero + 1;
    return numero;
  }

  /* ---------------- Productos ---------------- */

  const productos = (incluirArchivados) =>
    neg().productos.filter(p => incluirArchivados || p.activo !== false);

  const productoPorId = id => neg().productos.find(p => p.id === id) || null;

  /**
   * Un producto nuevo.
   * 'stockInicial' no se guarda como número suelto: se anota como la
   * primera entrada del libro de existencias, para que el stock de
   * hoy siempre se pueda explicar sumando el libro.
   */
  function agregarProducto(datos) {
    const nombre = texto(datos.nombre);
    if (!nombre) throw new Error('Ponle un nombre al producto.');

    const producto = {
      id: Esquema.nuevoId(),
      nombre,
      sku: texto(datos.sku),
      descripcion: texto(datos.descripcion),
      categoria: texto(datos.categoria),
      precio: entero(datos.precio),
      costo: entero(datos.costo),
      unidad: texto(datos.unidad) || 'unidad',
      controlaStock: datos.controlaStock !== false,
      stockMinimo: cantidad(datos.stockMinimo),
      // Solo las fichas de las fotos. El archivo vive en IndexedDB
      // (regla 12): una foto de producto pesa lo mismo que una boleta.
      fotos: Array.isArray(datos.fotos) ? datos.fotos : [],
      variantes: [],
      enCatalogo: datos.enCatalogo !== false,
      activo: true,
      creado: Fechas.hoyISO(),
    };
    neg().productos.push(producto);

    const inicial = cantidad(datos.stockInicial);
    if (producto.controlaStock && inicial > 0) {
      anotarStock(producto.id, null, inicial, 'inicial', null);
    }
    guardar();
    return producto;
  }

  function editarProducto(id, datos) {
    const p = productoPorId(id);
    if (!p) return null;
    if (datos.nombre !== undefined) {
      const nombre = texto(datos.nombre);
      if (!nombre) throw new Error('Ponle un nombre al producto.');
      p.nombre = nombre;
    }
    ['sku', 'descripcion', 'categoria', 'unidad'].forEach(c => {
      if (datos[c] !== undefined) p[c] = texto(datos[c]);
    });
    if (datos.precio !== undefined) p.precio = entero(datos.precio);
    if (datos.costo !== undefined) p.costo = entero(datos.costo);
    if (datos.stockMinimo !== undefined) p.stockMinimo = cantidad(datos.stockMinimo);
    if (datos.controlaStock !== undefined) p.controlaStock = Boolean(datos.controlaStock);
    if (datos.enCatalogo !== undefined) p.enCatalogo = Boolean(datos.enCatalogo);
    if (Array.isArray(datos.fotos)) p.fotos = datos.fotos;
    guardar();
    return p;
  }

  /** Guardar un producto que ya no vendes sin borrar su historia de ventas. */
  function archivarProducto(id) {
    const p = productoPorId(id);
    if (!p) return null;
    p.activo = false;
    guardar();
    return p;
  }

  function reactivarProducto(id) {
    const p = productoPorId(id);
    if (!p) return null;
    p.activo = true;
    guardar();
    return p;
  }

  /** Cuántas ventas lo mencionan. Sirve para avisar antes de borrar. */
  function ventasDeProducto(id) {
    return neg().ventas.filter(v => (v.lineas || []).some(l => l.productoId === id)).length;
  }

  /**
   * Borrar de verdad. Solo se permite si nunca se vendió: si ya se
   * vendió, borrarlo dejaría ventas antiguas apuntando al vacío y los
   * totales de meses cerrados cambiarían solos. En ese caso se archiva.
   */
  function borrarProducto(id) {
    if (ventasDeProducto(id) > 0) {
      throw new Error('Este producto ya tiene ventas. Archívalo en vez de borrarlo, así tus meses anteriores no cambian.');
    }
    const n = neg();
    n.productos = n.productos.filter(p => p.id !== id);
    n.stock = n.stock.filter(m => m.productoId !== id);
    guardar();
  }

  /* ---------------- Variantes ----------------
     Talla, color, sabor. Cada una lleva su propio SKU, precio,
     costo y existencias. Un producto con variantes no lleva stock
     propio: si lo llevara habría dos números para lo mismo y algún
     día no calzarían.                                            */

  function agregarVariante(productoId, { nombre, sku, precio, costo, stockInicial }) {
    const p = productoPorId(productoId);
    if (!p) throw new Error('Ese producto ya no está.');
    const limpio = texto(nombre);
    if (!limpio) throw new Error('Ponle un nombre a la variante. Por ejemplo: talla M, o rojo.');

    const variante = {
      id: Esquema.nuevoId(),
      nombre: limpio,
      sku: texto(sku),
      precio: precio === undefined || precio === '' ? p.precio : entero(precio),
      costo:  costo  === undefined || costo  === '' ? p.costo  : entero(costo),
    };
    p.variantes.push(variante);

    const inicial = cantidad(stockInicial);
    if (p.controlaStock && inicial > 0) anotarStock(p.id, variante.id, inicial, 'inicial', null);
    guardar();
    return variante;
  }

  function editarVariante(productoId, varianteId, datos) {
    const p = productoPorId(productoId);
    if (!p) return null;
    const v = p.variantes.find(x => x.id === varianteId);
    if (!v) return null;
    if (datos.nombre !== undefined) {
      const limpio = texto(datos.nombre);
      if (!limpio) throw new Error('Ponle un nombre a la variante.');
      v.nombre = limpio;
    }
    if (datos.sku !== undefined) v.sku = texto(datos.sku);
    if (datos.precio !== undefined) v.precio = entero(datos.precio);
    if (datos.costo !== undefined) v.costo = entero(datos.costo);
    guardar();
    return v;
  }

  function borrarVariante(productoId, varianteId) {
    const p = productoPorId(productoId);
    if (!p) return;
    const vendida = neg().ventas.some(v =>
      (v.lineas || []).some(l => l.varianteId === varianteId));
    if (vendida) {
      throw new Error('Esa variante ya se vendió. Déjala en cero en vez de borrarla, así tus ventas anteriores siguen cuadrando.');
    }
    p.variantes = p.variantes.filter(x => x.id !== varianteId);
    neg().stock = neg().stock.filter(m => m.varianteId !== varianteId);
    guardar();
  }

  /* ---------------- Existencias ---------------- */

  /** Anota una entrada o salida en el libro. No guarda: guarda quien llama. */
  function anotarStock(productoId, varianteId, cuanto, motivo, referencia, fecha) {
    neg().stock.push({
      id: Esquema.nuevoId(),
      fecha: fecha || Fechas.hoyISO(),
      productoId,
      varianteId: varianteId || null,
      cantidad: cantidad(cuanto),
      motivo: motivo || 'ajuste',
      referencia: referencia || null,
      creado: new Date().toISOString(),
    });
  }

  /** Entrada o salida a mano: reposición, merma, devolución, regalo. */
  function moverStock({ productoId, varianteId, cantidad: cuanto, motivo, fecha }) {
    const p = productoPorId(productoId);
    if (!p) throw new Error('Ese producto ya no está.');
    if (!p.controlaStock) throw new Error('Este producto no lleva existencias. Enciéndele el control de stock si quieres contarlo.');
    const delta = cantidad(cuanto);
    if (delta === 0) throw new Error('Escribe cuántas unidades entraron o salieron.');
    anotarStock(productoId, varianteId, delta, motivo || 'ajuste', null, fecha);
    guardar();
  }

  /**
   * "Hice el inventario y hay 14". Guarda la DIFERENCIA, no el número
   * final, para no romper la regla de que el stock siempre sale del
   * libro. El motivo queda como 'conteo' y así después se puede ver
   * cuánto se perdió entre conteo y conteo.
   */
  function fijarStock({ productoId, varianteId, hay, fecha }) {
    const p = productoPorId(productoId);
    if (!p) throw new Error('Ese producto ya no está.');
    const actual = Negocio.stockDe(neg(), productoId, varianteId || null);
    const delta = cantidad(hay) - actual;
    if (delta === 0) return 0;
    anotarStock(productoId, varianteId, delta, 'conteo', null, fecha);
    guardar();
    return delta;
  }

  /* ---------------- Gente: clientes, proveedores y empleados ----------------
     Los tres tienen la misma forma, así que comparten el mismo par de
     funciones. Escribir tres veces lo mismo es tres veces la
     oportunidad de que una quede distinta.                          */

  const CAMPOS_FICHA = ['nombre', 'rut', 'telefono', 'correo', 'direccion', 'nota'];

  function agregarFicha(lista, datos, comoSeLlama) {
    const nombre = texto(datos.nombre);
    if (!nombre) throw new Error(`Ponle un nombre ${comoSeLlama}.`);
    const ficha = { id: Esquema.nuevoId(), creado: Fechas.hoyISO() };
    CAMPOS_FICHA.forEach(c => { ficha[c] = texto(datos[c]); });
    ficha.nombre = nombre;
    if (lista === 'empleados') {
      ficha.rol = texto(datos.rol);
      ficha.sueldo = entero(datos.sueldo);
      ficha.activo = true;
    }
    neg()[lista].push(ficha);
    guardar();
    return ficha;
  }

  function editarFicha(lista, id, datos) {
    const f = neg()[lista].find(x => x.id === id);
    if (!f) return null;
    CAMPOS_FICHA.forEach(c => { if (datos[c] !== undefined) f[c] = texto(datos[c]); });
    if (!f.nombre) throw new Error('El nombre no puede quedar vacío.');
    if (lista === 'empleados') {
      if (datos.rol !== undefined) f.rol = texto(datos.rol);
      if (datos.sueldo !== undefined) f.sueldo = entero(datos.sueldo);
      if (datos.activo !== undefined) f.activo = Boolean(datos.activo);
    }
    guardar();
    return f;
  }

  /** Cuántos documentos la mencionan. Sirve para avisar antes de borrar. */
  function usosDeFicha(lista, id) {
    const n = neg();
    if (lista === 'clientes') {
      return n.ventas.filter(v => v.clienteId === id).length +
             n.cotizaciones.filter(c => c.clienteId === id).length;
    }
    if (lista === 'proveedores') return n.compras.filter(c => c.proveedorId === id).length;
    return n.ventas.filter(v => v.empleadoId === id).length;
  }

  /**
   * Borrar una ficha no borra sus documentos: los suelta.
   * Una venta sin cliente sigue siendo una venta y su plata sigue
   * contando. Borrar la venta junto con el cliente cambiaría los
   * totales de meses ya cerrados.
   */
  function borrarFicha(lista, id) {
    const n = neg();
    n[lista] = n[lista].filter(x => x.id !== id);
    const campo = { clientes: 'clienteId', proveedores: 'proveedorId', empleados: 'empleadoId' }[lista];
    ['ventas', 'compras', 'cotizaciones'].forEach(donde => {
      n[donde].forEach(d => { if (d[campo] === id) d[campo] = null; });
    });
    guardar();
  }

  const fichaPorId = (lista, id) => neg()[lista].find(x => x.id === id) || null;
  const nombreDeFicha = (lista, id) => {
    const f = fichaPorId(lista, id);
    return f ? f.nombre : '';
  };

  /* ---------------- Ventas ---------------- */

  /**
   * Deja las líneas listas: completa el nombre y el costo desde el
   * producto para que la venta quede FOTOGRAFIADA. Si mañana subes el
   * precio o cambias el nombre, la venta de ayer no puede cambiar
   * sola: eso es lo que hace que un mes cerrado siga cuadrando el
   * año que viene.
   */
  function prepararLineas(lineas) {
    const listas = (lineas || []).map(l => {
      const p = productoPorId(l.productoId);
      const v = p && l.varianteId ? (p.variantes || []).find(x => x.id === l.varianteId) : null;
      const nombre = texto(l.nombre) ||
        (p ? (v ? `${p.nombre} — ${v.nombre}` : p.nombre) : 'Producto');
      const precio = l.precio !== undefined && l.precio !== ''
        ? entero(l.precio) : entero(v ? v.precio : (p ? p.precio : 0));
      const costo = l.costo !== undefined && l.costo !== ''
        ? entero(l.costo) : entero(v ? v.costo : (p ? p.costo : 0));
      return {
        productoId: l.productoId || null,
        varianteId: l.varianteId || null,
        nombre,
        cantidad: cantidad(l.cantidad),
        precio,
        costo,
      };
    }).filter(l => l.cantidad > 0);

    if (!listas.length) throw new Error('Agrega al menos un producto.');
    return listas;
  }

  /**
   * Registra una venta y descuenta las existencias en el mismo acto.
   *
   * El estado 'fiada' no es un adorno: una venta fiada ya vendió, pero
   * su plata todavía no entró. Los dos números viven separados en el
   * resumen del mes (ver core/negocio.js) justo por eso.
   */
  function registrarVenta(datos) {
    const lineas = prepararLineas(datos.lineas);
    const fecha = datos.fecha || Fechas.hoyISO();
    const estado = ['pagada', 'fiada'].includes(datos.estado) ? datos.estado : 'pagada';

    const borrador = { lineas, descuento: entero(datos.descuento) };
    const total = Negocio.totalDe(borrador);
    // Una venta pagada está pagada completa; una fiada lleva el abono
    // que le hayan dejado, y nunca más que el total.
    const pagado = estado === 'pagada'
      ? total
      : Math.min(total, entero(datos.pagado));

    const venta = {
      id: Esquema.nuevoId(),
      folio: siguienteFolio('venta'),
      fecha,
      clienteId: datos.clienteId || null,
      empleadoId: datos.empleadoId || null,
      lineas,
      descuento: Math.min(entero(datos.descuento), Negocio.sumaDeLineas(lineas)),
      medioPago: texto(datos.medioPago) || (estado === 'fiada' ? 'fiado' : 'efectivo'),
      estado,
      pagado,
      nota: texto(datos.nota),
      adjuntos: Array.isArray(datos.adjuntos) ? datos.adjuntos : [],
      creado: new Date().toISOString(),
    };
    neg().ventas.push(venta);

    // Y sale de la bodega. Solo lo que lleva existencias: un servicio no.
    lineas.forEach(l => {
      const p = productoPorId(l.productoId);
      if (p && p.controlaStock) {
        anotarStock(l.productoId, l.varianteId, -l.cantidad, 'venta', venta.id, fecha);
      }
    });

    guardar();
    // Los respaldos se guardaron sueltos mientras se llenaba el
    // formulario, sin dueño. Recién ahora sabemos de quién son, y sin
    // eso "borrar la venta" no sabría qué foto borrar.
    if (typeof Adjuntos !== 'undefined') {
      venta.adjuntos.forEach(a => Adjuntos.asignarMovimiento(a.id, venta.id));
    }
    return venta;
  }

  const ventaPorId = id => neg().ventas.find(v => v.id === id) || null;

  /** Un abono de una venta fiada. Cuando se completa, queda pagada. */
  function abonarAVenta(id, monto) {
    const v = ventaPorId(id);
    if (!v) return null;
    if (v.estado === 'anulada') throw new Error('Esa venta está anulada.');
    const abono = entero(monto);
    if (abono <= 0) throw new Error('El abono tiene que ser mayor que cero.');
    const total = Negocio.totalDe(v);
    v.pagado = Math.min(total, entero(v.pagado) + abono);
    if (v.pagado >= total) v.estado = 'pagada';
    guardar();
    return v;
  }

  /**
   * Anular no borra: deja la venta a la vista, marcada, y devuelve la
   * mercadería a la bodega. Borrarla dejaría un hueco en los folios y
   * ninguna forma de explicar qué pasó con esa venta que alguien vio.
   */
  function anularVenta(id) {
    const v = ventaPorId(id);
    if (!v) return null;
    if (v.estado === 'anulada') return v;
    v.estado = 'anulada';
    v.pagado = 0;
    v.anulada = Fechas.hoyISO();
    v.lineas.forEach(l => {
      const p = productoPorId(l.productoId);
      if (p && p.controlaStock) {
        anotarStock(l.productoId, l.varianteId, l.cantidad, 'anulacion', v.id);
      }
    });
    guardar();
    return v;
  }

  /* ---------------- Compras y gastos del negocio ---------------- */

  /**
   * Un gasto del negocio. Si trae líneas, además entra a la bodega:
   * es la forma normal de reponer.
   *
   * Ojo: esto NO es un gasto tuyo. No baja tu sueldo libre. Es plata
   * del negocio comprando cosas del negocio.
   */
  function registrarCompra(datos) {
    const fecha = datos.fecha || Fechas.hoyISO();
    const lineas = Array.isArray(datos.lineas) && datos.lineas.length
      ? prepararLineas(datos.lineas.map(l => ({ ...l, precio: l.precio !== undefined ? l.precio : l.costo })))
      : [];

    // Si hay líneas, el monto sale de ellas; si no, del campo escrito.
    const monto = lineas.length
      ? lineas.reduce((t, l) => t + Math.round(l.cantidad * l.precio), 0)
      : entero(datos.monto);
    if (monto <= 0) throw new Error('¿Cuánto te costó? Escribe un monto mayor que cero.');

    const compra = {
      id: Esquema.nuevoId(),
      folio: siguienteFolio('compra'),
      fecha,
      proveedorId: datos.proveedorId || null,
      categoria: texto(datos.categoria) || 'mercaderia',
      descripcion: texto(datos.descripcion),
      lineas,
      monto,
      medioPago: texto(datos.medioPago) || 'efectivo',
      nota: texto(datos.nota),
      adjuntos: Array.isArray(datos.adjuntos) ? datos.adjuntos : [],
      creado: new Date().toISOString(),
    };
    neg().compras.push(compra);

    lineas.forEach(l => {
      const p = productoPorId(l.productoId);
      if (p && p.controlaStock) {
        anotarStock(l.productoId, l.varianteId, l.cantidad, 'compra', compra.id, fecha);
        // Reponer a otro precio actualiza lo que te cuesta hoy. Las
        // ventas anteriores no se tocan: ya quedaron fotografiadas.
        if (l.precio > 0) {
          if (l.varianteId) {
            const v = (p.variantes || []).find(x => x.id === l.varianteId);
            if (v) v.costo = l.precio;
          } else {
            p.costo = l.precio;
          }
        }
      }
    });

    guardar();
    if (typeof Adjuntos !== 'undefined') {
      compra.adjuntos.forEach(a => Adjuntos.asignarMovimiento(a.id, compra.id));
    }
    return compra;
  }

  const compraPorId = id => neg().compras.find(c => c.id === id) || null;

  /** Borrar una compra devuelve a la bodega lo que había entrado con ella. */
  function borrarCompra(id) {
    const c = compraPorId(id);
    if (!c) return;
    (c.lineas || []).forEach(l => {
      const p = productoPorId(l.productoId);
      if (p && p.controlaStock) anotarStock(l.productoId, l.varianteId, -l.cantidad, 'correccion', c.id);
    });
    const n = neg();
    n.compras = n.compras.filter(x => x.id !== id);
    guardar();
    if (typeof Adjuntos !== 'undefined') Adjuntos.borrarDeMovimiento(id);
  }

  /* ---------------- Cotizaciones ----------------
     Una cotización es una venta que todavía no pasa: no toca la
     bodega ni la caja hasta que el cliente dice que sí.          */

  function guardarCotizacion(datos, id) {
    const lineas = prepararLineas(datos.lineas);
    const fecha = datos.fecha || Fechas.hoyISO();
    const dias = Math.max(1, entero(neg().ajustes.diasCotizacion) || 15);
    const hasta = new Date(Fechas.aFecha(fecha).getTime() + dias * 86400000);

    const base = {
      fecha,
      validaHasta: datos.validaHasta || Fechas.aISO(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()),
      clienteId: datos.clienteId || null,
      lineas,
      descuento: Math.min(entero(datos.descuento), Negocio.sumaDeLineas(lineas)),
      nota: texto(datos.nota),
      estado: ['borrador', 'enviada', 'aceptada', 'rechazada'].includes(datos.estado)
        ? datos.estado : 'borrador',
    };

    if (id) {
      const q = neg().cotizaciones.find(x => x.id === id);
      if (!q) return null;
      Object.assign(q, base);
      guardar();
      return q;
    }

    const cotizacion = {
      id: Esquema.nuevoId(),
      folio: siguienteFolio('cotizacion'),
      ...base,
      creado: new Date().toISOString(),
    };
    neg().cotizaciones.push(cotizacion);
    guardar();
    return cotizacion;
  }

  const cotizacionPorId = id => neg().cotizaciones.find(c => c.id === id) || null;

  function cambiarEstadoCotizacion(id, estado) {
    const q = cotizacionPorId(id);
    if (!q) return null;
    if (!['borrador', 'enviada', 'aceptada', 'rechazada'].includes(estado)) return q;
    q.estado = estado;
    guardar();
    return q;
  }

  /**
   * El cliente dijo que sí. Se convierte en venta de verdad: recién
   * ahí sale de la bodega y entra a la caja.
   */
  function convertirEnVenta(id, extra) {
    const q = cotizacionPorId(id);
    if (!q) throw new Error('Esa cotización ya no está.');
    if (q.ventaId) throw new Error('Esta cotización ya se convirtió en venta.');

    const venta = registrarVenta({
      fecha: (extra && extra.fecha) || Fechas.hoyISO(),
      clienteId: q.clienteId,
      empleadoId: extra && extra.empleadoId,
      lineas: q.lineas,
      descuento: q.descuento,
      medioPago: extra && extra.medioPago,
      estado: (extra && extra.estado) || 'pagada',
      pagado: extra && extra.pagado,
      nota: `De la cotización N° ${q.folio}`,
    });
    q.estado = 'aceptada';
    q.ventaId = venta.id;
    guardar();
    return venta;
  }

  function borrarCotizacion(id) {
    const n = neg();
    n.cotizaciones = n.cotizaciones.filter(c => c.id !== id);
    guardar();
  }

  /* ---------------- EL PUENTE: los retiros ----------------

     Acá es donde el negocio toca tus finanzas personales, y es el
     único lugar. Un retiro hace dos cosas a la vez:

       1. sale de la caja del negocio, y
       2. entra a TUS movimientos como un ingreso de categoría
          'negocio', en la cuenta que elijas.

     Recién en ese momento esa plata cuenta para tu sueldo libre,
     que es la verdad: mientras esté en el negocio no es tuya, la
     necesitas para reponer.

     El retiro guarda el id del movimiento personal que creó, para
     poder deshacer los dos juntos. Sin ese id, borrar un retiro
     dejaría un ingreso huérfano inflando tu mes.               */

  function registrarRetiro({ monto, fecha, concepto, cuentaDestino }) {
    const valor = entero(monto);
    if (valor <= 0) throw new Error('¿Cuánto te vas a pagar? Escribe un monto mayor que cero.');
    if (!cuentaDestino) throw new Error('Elige a qué cuenta tuya entra esta plata.');

    const dia = fecha || Fechas.hoyISO();
    const texto_ = texto(concepto) || 'Retiro de mi negocio';

    // Primero el movimiento personal: si algo falla acá, mejor que
    // falle antes de tocar la caja del negocio.
    const mov = Datos.agregarMovimiento({
      tipo: 'ingreso',
      monto: valor,
      categoria: 'negocio',
      fecha: dia,
      cuentaDestino,
      descripcion: texto_,
      nota: perfil().nombre ? `Desde ${perfil().nombre}` : '',
    });

    const retiro = {
      id: Esquema.nuevoId(),
      fecha: dia,
      monto: valor,
      concepto: texto_,
      cuentaDestino,
      movimientoId: mov.id,
      creado: new Date().toISOString(),
    };
    neg().retiros.push(retiro);
    guardar();
    return retiro;
  }

  /** Deshace el retiro y su ingreso personal en el mismo acto. */
  function borrarRetiro(id) {
    const n = neg();
    const r = n.retiros.find(x => x.id === id);
    if (!r) return;
    n.retiros = n.retiros.filter(x => x.id !== id);
    if (r.movimientoId) Datos.borrarMovimiento(r.movimientoId);
    guardar();
  }

  /* ---------------- Consultas ----------------
     Todo esto es core/negocio.js con el negocio actual ya puesto,
     para que la pantalla no tenga que ir a buscarlo cada vez.   */

  const resumenDelMes   = (anio, mes)        => Negocio.resumenDelMes(neg(), anio, mes);
  const historialMeses  = (anio, mes, n)     => Negocio.historialDeMeses(neg(), anio, mes, n);
  const alertas         = ()                 => Negocio.alertas(neg(), Fechas.hoyISO());
  const stockDe         = (p, v)             => Negocio.stockDe(neg(), p, v);
  const stockTotalDe    = producto           => Negocio.stockTotalDe(neg(), producto);
  const valorInventario = ()                 => Negocio.valorInventario(neg());
  const bajoMinimo      = ()                 => Negocio.bajoMinimo(neg());
  const masVendidos     = (d, h, n)          => Negocio.masVendidos(neg(), d, h, n);
  const ventasAgrupadas = (campo, d, h)      => Negocio.ventasAgrupadas(neg(), campo, d, h);
  const estadoCotizacion = q                 => Negocio.estadoDeCotizacion(q, Fechas.hoyISO());

  /** Las ventas de un mes, de la más nueva a la más vieja. */
  function ventasDelMes(anio, mes) {
    const clave = Fechas.claveMes(anio, mes);
    return neg().ventas
      .filter(v => String(v.fecha).slice(0, 7) === clave)
      .sort((a, b) => (a.fecha === b.fecha ? (b.folio - a.folio) : (a.fecha < b.fecha ? 1 : -1)));
  }

  function comprasDelMes(anio, mes) {
    const clave = Fechas.claveMes(anio, mes);
    return neg().compras
      .filter(c => String(c.fecha).slice(0, 7) === clave)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  /** Las ventas fiadas que siguen sin cobrarse, la más vieja primero. */
  const fiadosPendientes = () => neg().ventas
    .filter(v => Negocio.saldoPendienteDe(v) > 0)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

  /** Los ids de respaldo que figuran en alguna venta o compra del negocio. */
  function idsDeAdjuntosVivos() {
    const vivos = new Set();
    const n = neg();
    [...n.ventas, ...n.compras].forEach(d => {
      (d.adjuntos || []).forEach(a => { if (a && a.id) vivos.add(a.id); });
    });
    (n.productos || []).forEach(p => {
      (p.fotos || []).forEach(f => { if (f && f.id) vivos.add(f.id); });
    });
    return vivos;
  }

  return {
    // encender
    estaActivo, encender, apagar, perfil, guardarPerfil, ajustes, guardarAjustes,

    // productos y variantes
    productos, productoPorId, agregarProducto, editarProducto,
    archivarProducto, reactivarProducto, borrarProducto, ventasDeProducto,
    agregarVariante, editarVariante, borrarVariante,

    // existencias
    moverStock, fijarStock, stockDe, stockTotalDe, valorInventario, bajoMinimo,

    // gente
    clientes:    () => neg().clientes,
    proveedores: () => neg().proveedores,
    empleados:   incluirInactivos => neg().empleados.filter(e => incluirInactivos || e.activo !== false),
    agregarFicha, editarFicha, borrarFicha, usosDeFicha, fichaPorId, nombreDeFicha,

    // ventas
    ventas: () => neg().ventas,
    ventaPorId, registrarVenta, abonarAVenta, anularVenta,
    ventasDelMes, fiadosPendientes,

    // compras
    compras: () => neg().compras,
    compraPorId, registrarCompra, borrarCompra, comprasDelMes,

    // cotizaciones
    cotizaciones: () => neg().cotizaciones,
    cotizacionPorId, guardarCotizacion, cambiarEstadoCotizacion,
    convertirEnVenta, borrarCotizacion, estadoCotizacion,

    // el puente
    retiros: () => neg().retiros,
    registrarRetiro, borrarRetiro,

    // consultas
    resumenDelMes, historialMeses, alertas, masVendidos, ventasAgrupadas,
    totalDe: Negocio.totalDe, gananciaDe: Negocio.gananciaDe,
    saldoPendienteDe: Negocio.saldoPendienteDe,
    sumaDeLineas: Negocio.sumaDeLineas, totalDeLinea: Negocio.totalDeLinea,

    // para el barrido de respaldos huérfanos
    idsDeAdjuntosVivos,

    // el objeto entero, para el catálogo y las planillas
    todo: () => neg(),
  };
})();
