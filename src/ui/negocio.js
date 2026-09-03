/* ============================================================
   src/ui/negocio.js
   La pestaña Negocio: todo lo que se ve y se toca.

   Vive aparte de app.js a propósito. app.js ya tiene 3.000 líneas
   con las finanzas personales; meterle el negocio adentro lo
   volvía imposible de leer, y este proyecto se lee.

   De la cáscara solo usa lo que app.js publica en window.App:
   abrir y cerrar hojas, el mensajito, el mes en pantalla y el
   cambio de pestaña. Nada más.

   Cómo está armado:
     - UNA pantalla (el resumen, con sus accesos).
     - UNA hoja de sección, que se rellena por dentro según lo que
       toques. Así el botón "atrás" del teléfono siempre cierra
       una sola cosa y no hay diez hojas escondidas en el HTML.
     - UNA hoja de formulario, igual de reutilizada.
     - UNA hoja para vender, que es la que más se usa y merece
       pantalla propia.
   ============================================================ */

const UiNegocio = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = m => Dinero.formatear(m);
  const avisar = t => window.App.avisar(t);

  /** Los números de cantidad se ven "3" y no "3.000", pero "1,5" sí. */
  const verCantidad = n => {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  };

  /* ---------------- Lo que está mirando la persona ---------------- */
  const vista = {
    seccion: null,          // qué lista está abierta
    buscar: '',             // el filtro de esa lista
    // El carrito de la venta en curso. Vive acá y no en el estado
    // guardado: una venta a medio hacer no es un dato, es un momento.
    carrito: [],
    clienteVenta: null,
    empleadoVenta: null,
    descuentoVenta: 0,
    // Igual para la cotización que se está armando.
    carritoCotizacion: [],
    cotizacionEditando: null,
    // Las fotos que se adjuntaron en un formulario todavía sin guardar.
    fotosPendientes: [],
    // A qué producto le estamos poniendo una foto.
    fotoPara: null,
  };

  /* ============================================================
     1. LA PANTALLA PRINCIPAL
     ============================================================ */

  function dibujar() {
    const caja = $$$('negocioHub');
    if (!caja) return;
    if (!DatosNegocio.estaActivo()) { caja.innerHTML = ''; return; }

    const { anio, mes } = window.App.mesEnPantalla();
    const r = DatosNegocio.resumenDelMes(anio, mes);
    const avisos = DatosNegocio.alertas();
    const p = DatosNegocio.perfil();

    caja.innerHTML = `
      <div class="tarjeta negocio-cabecera">
        <div class="negocio-marca">
          <span class="negocio-emoji">${esc(p.emoji || '🏪')}</span>
          <div>
            <h2>${esc(p.nombre)}</h2>
            <p class="ayuda">${esc(p.rubro || 'Tu negocio')}</p>
          </div>
        </div>

        <div class="par-cifras">
          <div>
            <span class="etiqueta">Vendiste</span>
            <span class="cifra ${r.vendido > 0 ? 'verde' : ''}">${dinero(r.vendido)}</span>
            <span class="ayuda">${r.cuantasVentas} ${r.cuantasVentas === 1 ? 'venta' : 'ventas'}</span>
          </div>
          <div>
            <span class="etiqueta">Te queda en caja</span>
            <span class="cifra ${r.caja < 0 ? 'rojo' : ''}">${dinero(r.caja)}</span>
            <span class="ayuda">después de gastos y retiros</span>
          </div>
        </div>

        <div class="negocio-detalle">
          <div><span>Ganancia de lo vendido</span><strong>${dinero(r.margen)}</strong></div>
          <div><span>Gastos del negocio</span><strong>${dinero(r.gastado)}</strong></div>
          <div><span>Te deben</span><strong class="${r.porCobrar > 0 ? 'rojo' : ''}">${dinero(r.porCobrar)}</strong></div>
          <div><span>Te pagaste a ti</span><strong>${dinero(r.retirado)}</strong></div>
        </div>

        ${r.vendido > 0 ? `
          <p class="ayuda negocio-explicacion">
            De los ${dinero(r.vendido)} que vendiste, ${dinero(r.costoVendido)} eran para reponer.
            Lo que de verdad ganaste este mes fue ${dinero(r.utilidad)}.
          </p>` : ''}
      </div>

      ${avisos.length ? `
        <div class="tarjeta">
          <h3>Para mirar hoy</h3>
          ${avisos.map(a => `
            <div class="aviso-negocio nivel-${a.nivel}">
              <span class="icono">${a.icono}</span>
              <div><strong>${esc(a.titulo)}</strong><span>${esc(a.detalle)}</span></div>
            </div>`).join('')}
        </div>` : ''}

      <button class="boton grande" data-negocio="vender">🏷️ Vender</button>

      <div class="rejilla-negocio">
        ${accesos().map(a => `
          <button class="ficha-negocio" data-seccion="${a.id}">
            <span class="icono">${a.icono}</span>
            <span class="nombre">${a.nombre}</span>
            <span class="dato">${esc(a.dato)}</span>
          </button>`).join('')}
      </div>

      <div class="consejo" style="margin-top:6px">
        <strong>🌉 La plata del negocio no es tu plata</strong>
        Lo que vende el negocio no aparece en tus movimientos ni en tu sueldo libre.
        Recién cuando te pagas a ti mismo, con <em>Pagarme</em>, esa plata entra a tu bolsillo.
        Así no te gastas lo que necesitas para reponer.
      </div>`;
  }

  /** Las fichas de acceso, cada una con un número de verdad debajo. */
  function accesos() {
    const n = DatosNegocio.todo();
    const { anio, mes } = window.App.mesEnPantalla();
    const bajos = DatosNegocio.bajoMinimo().length;
    const fiados = DatosNegocio.fiadosPendientes().length;
    const cotizando = n.cotizaciones.filter(c => DatosNegocio.estadoCotizacion(c) === 'enviada').length;

    return [
      { id: 'productos',   icono: '📦', nombre: 'Inventario',
        dato: bajos ? `${bajos} por reponer` : `${DatosNegocio.productos().length} productos` },
      { id: 'ventas',      icono: '🧾', nombre: 'Ventas',
        dato: fiados ? `${fiados} sin cobrar` : `${DatosNegocio.ventasDelMes(anio, mes).length} este mes` },
      { id: 'gastos',      icono: '💸', nombre: 'Gastos',
        dato: `${DatosNegocio.comprasDelMes(anio, mes).length} este mes` },
      { id: 'cotizaciones', icono: '📄', nombre: 'Cotizaciones',
        dato: cotizando ? `${cotizando} esperando` : `${n.cotizaciones.length} en total` },
      { id: 'clientes',    icono: '🙋', nombre: 'Clientes',    dato: `${n.clientes.length}` },
      { id: 'proveedores', icono: '🚚', nombre: 'Proveedores', dato: `${n.proveedores.length}` },
      { id: 'empleados',   icono: '👥', nombre: 'Equipo',      dato: `${DatosNegocio.empleados().length}` },
      { id: 'catalogo',    icono: '🌐', nombre: 'Mi catálogo',
        dato: `${DatosNegocio.productos().filter(p => p.enCatalogo !== false).length} publicados` },
      { id: 'estadisticas', icono: '📈', nombre: 'Estadísticas', dato: 'Cómo vas' },
      { id: 'reportes',    icono: '📊', nombre: 'Reportes',    dato: 'Bajar planilla' },
      { id: 'retiros',     icono: '🌉', nombre: 'Pagarme',     dato: 'A mi bolsillo' },
      { id: 'ajustes',     icono: '⚙️', nombre: 'Mi negocio',  dato: 'Datos y ajustes' },
    ];
  }

  /* ============================================================
     2. LA HOJA DE SECCIÓN
     ============================================================ */

  function abrirSeccion(nombre) {
    vista.seccion = nombre;
    vista.buscar = '';
    pintarSeccion();
    window.App.abrirHoja('telonNegocioSeccion');
  }

  function pintarSeccion() {
    const caja = $$$('negocioSeccion');
    if (!caja || !vista.seccion) return;
    const pintores = {
      productos, ventas, gastos, cotizaciones, catalogo,
      estadisticas, reportes, retiros,
      clientes:    () => fichas('clientes',    'Clientes',    '🙋', 'al cliente'),
      proveedores: () => fichas('proveedores', 'Proveedores', '🚚', 'al proveedor'),
      empleados:   () => fichas('empleados',   'Mi equipo',   '👥', 'a la persona'),
      ajustes:     ajustesDelNegocio,
    };
    caja.innerHTML = (pintores[vista.seccion] || (() => ''))();

    // Los gráficos necesitan el elemento ya puesto en la página para
    // poder medirlo, así que van después del innerHTML, no dentro.
    if (vista.seccion === 'estadisticas') UiReportes.dibujarGraficos();

    // Y las miniaturas salen de IndexedDB, que responde con promesa.
    caja.querySelectorAll('[data-foto]').forEach(el => {
      if (el.dataset.foto) pintarMiniatura(el.dataset.foto);
    });
  }

  /** La cabecera que llevan todas las secciones. */
  const cabecera = (titulo, boton) => `
    <div class="tarjeta-titulo">
      <h2>${esc(titulo)}</h2>
      <button class="boton fantasma chico" data-cerrar-negocio="telonNegocioSeccion">Cerrar</button>
    </div>
    ${boton || ''}`;

  const buscador = pista => `
    <input type="search" class="buscador-negocio" id="buscadorNegocio"
           placeholder="${esc(pista)}" value="${esc(vista.buscar)}"
           autocomplete="off" autocorrect="off" spellcheck="false">`;

  const vacio = (emoji, titulo, texto) => `
    <div class="vacio">
      <div style="font-size:38px">${emoji}</div>
      <strong>${esc(titulo)}</strong>
      <p>${esc(texto)}</p>
    </div>`;

  const calza = (texto) =>
    !vista.buscar || String(texto || '').toLowerCase().includes(vista.buscar.toLowerCase());

  /* ---------------- Inventario ---------------- */

  function productos() {
    const lista = DatosNegocio.productos()
      .filter(p => calza(`${p.nombre} ${p.sku} ${p.categoria}`));
    const valor = DatosNegocio.valorInventario();

    return cabecera('Inventario', `
      <button class="boton" data-form="producto">+ Agregar un producto</button>
      <div class="negocio-detalle" style="margin:12px 0 4px">
        <div><span>Lo que vale tu bodega</span><strong>${dinero(valor)}</strong></div>
        <div><span>Productos activos</span><strong>${DatosNegocio.productos().length}</strong></div>
      </div>
      ${buscador('Buscar un producto…')}`)
      + (lista.length ? `<ul class="lista">${lista.map(lineaDeProducto).join('')}</ul>` : vacio(
          '📦', vista.buscar ? 'No encontramos ese producto' : 'Todavía no hay productos',
          vista.buscar ? 'Prueba con otra palabra.'
                       : 'Agrega lo que vendes y la app se encarga de contar, avisarte cuando quede poco y armarte el catálogo.'));
  }

  function lineaDeProducto(p) {
    const hay = DatosNegocio.stockTotalDe(p);
    const bajo = p.controlaStock !== false && p.stockMinimo > 0 && hay <= p.stockMinimo;
    const foto = (p.fotos || [])[0];
    return `
      <li class="movimiento" data-producto="${p.id}">
        <span class="emoji ${foto ? 'con-foto' : ''}" data-foto="${foto ? esc(foto.id) : ''}">${foto ? '' : '📦'}</span>
        <div class="info">
          <strong>${esc(p.nombre)}</strong>
          <span class="ayuda">
            ${p.controlaStock === false
              ? 'Servicio, no lleva stock'
              : `Quedan ${verCantidad(hay)}${p.variantes.length ? ` en ${p.variantes.length} variantes` : ''}`}
            ${bajo ? ' · <b class="rojo">reponer</b>' : ''}
          </span>
        </div>
        <div class="monto">
          <strong>${dinero(p.precio)}</strong>
          <span class="ayuda">te cuesta ${dinero(p.costo)}</span>
        </div>
      </li>`;
  }

  /* ---------------- Ventas ---------------- */

  function ventas() {
    const { anio, mes } = window.App.mesEnPantalla();
    const lista = DatosNegocio.ventasDelMes(anio, mes)
      .filter(v => calza(`${v.folio} ${DatosNegocio.nombreDeFicha('clientes', v.clienteId)} ${(v.lineas || []).map(l => l.nombre).join(' ')}`));
    const fiados = DatosNegocio.fiadosPendientes();

    return cabecera(`Ventas de ${Fechas.nombreMes(anio, mes)}`, `
      <button class="boton" data-negocio="vender">🏷️ Vender ahora</button>
      ${fiados.length ? `
        <div class="aviso-negocio nivel-medio" style="margin-top:12px">
          <span class="icono">🧾</span>
          <div>
            <strong>Te deben ${dinero(fiados.reduce((t, v) => t + DatosNegocio.saldoPendienteDe(v), 0))}</strong>
            <span>De ${fiados.length} ${fiados.length === 1 ? 'venta fiada' : 'ventas fiadas'}. Tócalas para abonar.</span>
          </div>
        </div>` : ''}
      ${buscador('Buscar por folio, cliente o producto…')}`)
      + (lista.length ? `<ul class="lista">${lista.map(lineaDeVenta).join('')}</ul>` : vacio(
          '🧾', 'Sin ventas este mes',
          'Cuando vendas algo, va a aparecer acá con su comprobante.'));
  }

  function lineaDeVenta(v) {
    const total = DatosNegocio.totalDe(v);
    const debe = DatosNegocio.saldoPendienteDe(v);
    const cliente = DatosNegocio.nombreDeFicha('clientes', v.clienteId);
    const cuantos = (v.lineas || []).length;
    return `
      <li class="movimiento" data-venta="${v.id}">
        <span class="emoji">${v.estado === 'anulada' ? '🚫' : (debe > 0 ? '🕓' : '✅')}</span>
        <div class="info">
          <strong>N° ${v.folio}${cliente ? ` · ${esc(cliente)}` : ''}</strong>
          <span class="ayuda">
            ${Fechas.fechaLegible(v.fecha)} · ${cuantos} ${cuantos === 1 ? 'producto' : 'productos'}
            ${v.estado === 'anulada' ? ' · anulada' : (debe > 0 ? ` · debe ${dinero(debe)}` : '')}
          </span>
        </div>
        <div class="monto">
          <strong class="${v.estado === 'anulada' ? 'tachado' : 'verde'}">${dinero(total)}</strong>
        </div>
      </li>`;
  }

  /* ---------------- Gastos del negocio ---------------- */

  function gastos() {
    const { anio, mes } = window.App.mesEnPantalla();
    const lista = DatosNegocio.comprasDelMes(anio, mes)
      .filter(c => calza(`${c.descripcion} ${DatosNegocio.nombreDeFicha('proveedores', c.proveedorId)}`));
    const total = lista.reduce((t, c) => t + c.monto, 0);

    return cabecera(`Gastos de ${Fechas.nombreMes(anio, mes)}`, `
      <button class="boton" data-form="compra">+ Anotar un gasto o compra</button>
      <p class="ayuda" style="margin:10px 0 0">
        Esto es plata del negocio, no tuya: no baja tu sueldo libre.
        Si la compra trae productos, entran solos a la bodega.
      </p>
      <div class="negocio-detalle" style="margin:12px 0 4px">
        <div><span>Gastado este mes</span><strong>${dinero(total)}</strong></div>
        <div><span>Comprobantes</span><strong>${lista.length}</strong></div>
      </div>
      ${buscador('Buscar un gasto…')}`)
      + (lista.length ? `<ul class="lista">${lista.map(lineaDeCompra).join('')}</ul>` : vacio(
          '💸', 'Sin gastos este mes',
          'Anota lo que compras para vender, el arriendo del local, la luz. Todo lo que sale del negocio.'));
  }

  function lineaDeCompra(c) {
    const prov = DatosNegocio.nombreDeFicha('proveedores', c.proveedorId);
    return `
      <li class="movimiento" data-compra="${c.id}">
        <span class="emoji">${(c.lineas || []).length ? '📥' : '💸'}</span>
        <div class="info">
          <strong>${esc(c.descripcion || 'Gasto del negocio')}</strong>
          <span class="ayuda">${Fechas.fechaLegible(c.fecha)}${prov ? ` · ${esc(prov)}` : ''}</span>
        </div>
        <div class="monto"><strong class="rojo">${dinero(c.monto)}</strong></div>
      </li>`;
  }

  /* ---------------- Cotizaciones ---------------- */

  function cotizaciones() {
    const lista = DatosNegocio.cotizaciones()
      .slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .filter(q => calza(`${q.folio} ${DatosNegocio.nombreDeFicha('clientes', q.clienteId)}`));

    return cabecera('Cotizaciones', `
      <button class="boton" data-form="cotizacion">+ Hacer una cotización</button>
      <p class="ayuda" style="margin:10px 0 0">
        Una cotización no toca la bodega ni la caja. Cuando el cliente dice que sí,
        la conviertes en venta con un toque y ahí recién descuenta el stock.
      </p>
      ${buscador('Buscar por folio o cliente…')}`)
      + (lista.length ? `<ul class="lista">${lista.map(lineaDeCotizacion).join('')}</ul>` : vacio(
          '📄', 'Sin cotizaciones',
          'Arma un presupuesto, mándalo por WhatsApp y déjalo esperando respuesta.'));
  }

  const NOMBRE_ESTADO = {
    borrador: 'Borrador', enviada: 'Esperando respuesta',
    aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida',
  };

  function lineaDeCotizacion(q) {
    const estado = DatosNegocio.estadoCotizacion(q);
    const cliente = DatosNegocio.nombreDeFicha('clientes', q.clienteId);
    const emoji = { borrador: '✏️', enviada: '🕓', aceptada: '✅', rechazada: '❌', vencida: '⌛' }[estado];
    return `
      <li class="movimiento" data-cotizacion="${q.id}">
        <span class="emoji">${emoji}</span>
        <div class="info">
          <strong>N° ${q.folio}${cliente ? ` · ${esc(cliente)}` : ''}</strong>
          <span class="ayuda">${NOMBRE_ESTADO[estado]} · ${Fechas.fechaLegible(q.fecha)}</span>
        </div>
        <div class="monto"><strong>${dinero(DatosNegocio.totalDe(q))}</strong></div>
      </li>`;
  }

  /* ---------------- Clientes, proveedores y equipo ---------------- */

  function fichas(lista, titulo, icono, comoSeLlama) {
    const todas = (lista === 'empleados' ? DatosNegocio.empleados(true) : DatosNegocio[lista]())
      .filter(f => calza(`${f.nombre} ${f.telefono} ${f.rut}`));

    return cabecera(titulo, `
      <button class="boton" data-form="ficha" data-lista="${lista}">+ Agregar</button>
      ${buscador('Buscar por nombre o teléfono…')}`)
      + (todas.length ? `<ul class="lista">${todas.map(f => `
        <li class="movimiento" data-ficha="${f.id}" data-lista="${lista}">
          <span class="emoji">${icono}</span>
          <div class="info">
            <strong>${esc(f.nombre)}${f.activo === false ? ' · inactivo' : ''}</strong>
            <span class="ayuda">${esc(f.telefono || f.rut || f.rol || 'Sin más datos')}</span>
          </div>
          <div class="monto"><span class="ayuda">${DatosNegocio.usosDeFicha(lista, f.id)}</span></div>
        </li>`).join('')}</ul>` : vacio(
          icono, `Todavía no hay nadie acá`,
          `Agrega ${comoSeLlama.replace(/^a[l]? /, '')} y vas a poder ponerle nombre a cada venta.`));
  }

  /* ---------------- Pagarme (el puente) ---------------- */

  function retiros() {
    const lista = DatosNegocio.retiros().slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const { anio, mes } = window.App.mesEnPantalla();
    const r = DatosNegocio.resumenDelMes(anio, mes);

    return cabecera('Pagarme a mí mismo', `
      <div class="consejo" style="margin-bottom:14px">
        <strong>🌉 Este es el único puente</strong>
        Mientras la plata esté en el negocio no es tuya: la necesitas para reponer.
        Cuando te la pasas, entra a tus movimientos como ingreso y recién ahí
        cuenta para tu sueldo libre.
      </div>
      <div class="negocio-detalle" style="margin-bottom:12px">
        <div><span>Hay en caja</span><strong class="${r.caja < 0 ? 'rojo' : ''}">${dinero(r.caja)}</strong></div>
        <div><span>Te pagaste este mes</span><strong>${dinero(r.retirado)}</strong></div>
      </div>
      <button class="boton" data-form="retiro">💸 Pasarme plata a mi bolsillo</button>`)
      + (lista.length ? `<ul class="lista">${lista.map(x => `
        <li class="movimiento" data-retiro="${x.id}">
          <span class="emoji">🌉</span>
          <div class="info">
            <strong>${esc(x.concepto)}</strong>
            <span class="ayuda">${Fechas.fechaLegible(x.fecha)} · a ${esc(nombreDeCuenta(x.cuentaDestino))}</span>
          </div>
          <div class="monto"><strong class="verde">${dinero(x.monto)}</strong></div>
        </li>`).join('')}</ul>` : vacio(
          '🌉', 'Todavía no te has pagado',
          'Cuando lo hagas, va a aparecer también en tus movimientos personales.'));
  }

  const nombreDeCuenta = id => {
    const c = Datos.cuentaPorId(id);
    return c ? c.nombre : 'una cuenta borrada';
  };

  /* ============================================================
     3. VENDER — la pantalla que más se usa
     ============================================================ */

  function abrirVender() {
    vista.carrito = [];
    vista.clienteVenta = null;
    vista.empleadoVenta = null;
    vista.descuentoVenta = 0;
    pintarVender();
    window.App.abrirHoja('telonNegocioVender');
  }

  function pintarVender() {
    const caja = $$$('negocioVender');
    if (!caja) return;

    const bruto = DatosNegocio.sumaDeLineas(vista.carrito);
    const total = Math.max(0, bruto - vista.descuentoVenta);
    const disponibles = DatosNegocio.productos()
      .filter(p => calza(`${p.nombre} ${p.sku}`));

    caja.innerHTML = `
      <div class="tarjeta-titulo">
        <h2>Vender</h2>
        <button class="boton fantasma chico" data-cerrar-negocio="telonNegocioVender">Cerrar</button>
      </div>

      ${vista.carrito.length ? `
        <ul class="lista carrito">
          ${vista.carrito.map((l, i) => `
            <li class="linea-carrito">
              <div class="info">
                <strong>${esc(l.nombre)}</strong>
                <span class="ayuda">${dinero(l.precio)} cada uno</span>
              </div>
              <div class="contador">
                <button type="button" class="boton fantasma chico" data-menos="${i}">−</button>
                <span>${verCantidad(l.cantidad)}</span>
                <button type="button" class="boton fantasma chico" data-mas="${i}">+</button>
              </div>
              <strong class="monto-linea">${dinero(DatosNegocio.totalDeLinea(l))}</strong>
            </li>`).join('')}
        </ul>

        <div class="total-venta">
          <div><span>Suma</span><strong>${dinero(bruto)}</strong></div>
          <div>
            <span>Descuento</span>
            <input type="number" id="descuentoVenta" inputmode="numeric" min="0" step="1"
                   value="${vista.descuentoVenta || ''}" placeholder="0">
          </div>
          <div class="grande"><span>Total</span><strong>${dinero(total)}</strong></div>
        </div>

        <label for="clienteVenta">¿Para quién es? (opcional)</label>
        <select id="clienteVenta">
          <option value="">Cliente de paso</option>
          ${DatosNegocio.clientes().map(c =>
            `<option value="${c.id}" ${vista.clienteVenta === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select>

        ${DatosNegocio.empleados().length ? `
          <label for="empleadoVenta">¿Quién atendió?</label>
          <select id="empleadoVenta">
            <option value="">Yo</option>
            ${DatosNegocio.empleados().map(e =>
              `<option value="${e.id}" ${vista.empleadoVenta === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
          </select>` : ''}

        <label for="medioPagoVenta">¿Cómo te pagaron?</label>
        <select id="medioPagoVenta">
          <option value="efectivo">💵 Efectivo</option>
          <option value="debito">💳 Débito</option>
          <option value="credito">💳 Crédito</option>
          <option value="transferencia">📲 Transferencia</option>
        </select>

        <div class="fila-botones" style="margin-top:16px">
          <button class="boton secundario" data-cobrar="fiada">🕓 Queda fiado</button>
          <button class="boton" data-cobrar="pagada">✅ Cobrar ${dinero(total)}</button>
        </div>
        <hr class="separador">` : `
        <p class="ayuda">Toca lo que te están comprando. Puedes tocar varias veces para sumar unidades.</p>`}

      ${buscador('Buscar un producto…')}

      ${disponibles.length ? `
        <div class="rejilla-productos">
          ${disponibles.map(p => botonDeProducto(p)).join('')}
        </div>` : vacio('📦', 'No hay productos para vender',
          'Agrégalos primero en Inventario y después vuelve acá.')}`;
  }

  /** Un producto con variantes muestra un botón por variante. */
  function botonDeProducto(p) {
    if (p.variantes && p.variantes.length) {
      return p.variantes.map(v => {
        const hay = DatosNegocio.stockDe(p.id, v.id);
        return `
          <button class="boton-producto ${hay <= 0 && p.controlaStock !== false ? 'sin-stock' : ''}"
                  data-vender="${p.id}" data-variante="${v.id}">
            <span class="nombre">${esc(p.nombre)}</span>
            <span class="variante">${esc(v.nombre)}</span>
            <span class="precio">${dinero(v.precio)}</span>
            ${p.controlaStock === false ? '' : `<span class="stock">${verCantidad(hay)}</span>`}
          </button>`;
      }).join('');
    }
    const hay = DatosNegocio.stockTotalDe(p);
    return `
      <button class="boton-producto ${hay <= 0 && p.controlaStock !== false ? 'sin-stock' : ''}"
              data-vender="${p.id}">
        <span class="nombre">${esc(p.nombre)}</span>
        <span class="precio">${dinero(p.precio)}</span>
        ${p.controlaStock === false ? '<span class="stock">servicio</span>' : `<span class="stock">${verCantidad(hay)}</span>`}
      </button>`;
  }

  function alCarrito(productoId, varianteId) {
    const p = DatosNegocio.productoPorId(productoId);
    if (!p) return;
    const v = varianteId ? (p.variantes || []).find(x => x.id === varianteId) : null;
    const ya = vista.carrito.find(l => l.productoId === productoId && l.varianteId === (varianteId || null));
    if (ya) {
      ya.cantidad = Math.round((ya.cantidad + 1) * 1000) / 1000;
    } else {
      vista.carrito.push({
        productoId,
        varianteId: varianteId || null,
        nombre: v ? `${p.nombre} — ${v.nombre}` : p.nombre,
        cantidad: 1,
        precio: v ? v.precio : p.precio,
        costo: v ? v.costo : p.costo,
      });
    }
    window.App.vibrar(6);
    pintarVender();
  }

  async function cobrar(estado) {
    if (!vista.carrito.length) return;

    // Avisamos si vas a dejar algo en negativo, pero no lo impedimos:
    // en un negocio de verdad primero se vende y después se cuadra la
    // bodega. Bloquearlo obligaría a mentirle a la app con un cliente
    // esperando en el mesón.
    const faltantes = vista.carrito.filter(l => {
      const p = DatosNegocio.productoPorId(l.productoId);
      return p && p.controlaStock !== false &&
             DatosNegocio.stockDe(l.productoId, l.varianteId) < l.cantidad;
    });
    if (faltantes.length) {
      const seguir = await Dialogos.confirmar({
        titulo: '¿Vendes igual?',
        texto: `Según la app no te queda suficiente ${faltantes[0].nombre}. `
             + 'Puede ser que falte anotar una compra. Si vendes igual, el stock queda en negativo hasta que lo cuadres.',
        aceptar: 'Vender igual',
      });
      if (!seguir) return;
    }

    let pagado = 0;
    if (estado === 'fiada') {
      const abono = await Dialogos.pedirMonto({
        titulo: '¿Te dejó algo de abono?',
        texto: 'Si no te dejó nada, escribe 0 y toca Guardar.',
        etiqueta: 'Abono', placeholder: '0', aceptar: 'Guardar',
      });
      if (abono === null) return;
      pagado = abono;
    }

    try {
      const venta = DatosNegocio.registrarVenta({
        clienteId: valorDe('clienteVenta'),
        empleadoId: valorDe('empleadoVenta'),
        lineas: vista.carrito,
        descuento: vista.descuentoVenta,
        medioPago: valorDe('medioPagoVenta') || 'efectivo',
        estado,
        pagado,
      });
      window.App.cerrarHoja('telonNegocioVender');
      window.App.vibrar(14);
      avisar(`Venta N° ${venta.folio} anotada.`);
      dibujar();
      if (vista.seccion) pintarSeccion();
      mostrarComprobante(venta);
    } catch (e) {
      avisar(e.message);
    }
  }

  const valorDe = id => {
    const campo = $$$(id);
    return campo ? campo.value : '';
  };

  /* ============================================================
     4. LOS FORMULARIOS
     ============================================================ */

  function abrirFormulario(tipo, extra) {
    const caja = $$$('negocioForm');
    if (!caja) return;
    vista.fotosPendientes = [];
    const pintores = {
      producto: formProducto, ficha: formFicha, compra: formCompra,
      cotizacion: formCotizacion, retiro: formRetiro, variante: formVariante,
      stock: formStock, perfil: formPerfil,
    };
    const pintar = pintores[tipo];
    if (!pintar) return;
    caja.dataset.tipo = tipo;
    caja.dataset.extra = JSON.stringify(extra || {});
    caja.innerHTML = pintar(extra || {});
    window.App.abrirHoja('telonNegocioForm');
  }

  const tituloForm = titulo => `
    <div class="tarjeta-titulo">
      <h2>${esc(titulo)}</h2>
      <button class="boton fantasma chico" data-cerrar-negocio="telonNegocioForm">Cerrar</button>
    </div>`;

  /* ---------------- Producto ---------------- */

  function formProducto({ id }) {
    const p = id ? DatosNegocio.productoPorId(id) : null;
    const hay = p ? DatosNegocio.stockTotalDe(p) : 0;

    return tituloForm(p ? 'Editar producto' : 'Producto nuevo') + `
      <form id="formNegocio" data-guardar="producto" data-id="${p ? p.id : ''}">
        <label for="pNombre">¿Qué vendes?</label>
        <input type="text" id="pNombre" value="${esc(p ? p.nombre : '')}" required
               placeholder="Bebida 1,5 L" autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="pPrecio">Lo vendes en</label>
            <input type="number" id="pPrecio" inputmode="numeric" min="0" step="1"
                   value="${p ? p.precio : ''}" placeholder="1990">
          </div>
          <div>
            <label for="pCosto">Te cuesta</label>
            <input type="number" id="pCosto" inputmode="numeric" min="0" step="1"
                   value="${p ? p.costo : ''}" placeholder="1200">
          </div>
        </div>
        <p class="ayuda">Con esos dos números la app sabe cuánto ganas de verdad, no solo cuánto vendiste.</p>

        <label class="interruptor">
          <input type="checkbox" id="pControlaStock" ${!p || p.controlaStock !== false ? 'checked' : ''}>
          <span>Llevar la cuenta de cuántos quedan</span>
        </label>
        <p class="ayuda">Apágalo si es un servicio: un corte de pelo no se acaba.</p>

        <div id="zonaStock" ${!p || p.controlaStock !== false ? '' : 'hidden'}>
          <div class="fila-dos">
            <div>
              <label for="pStock">${p ? 'Hay ahora' : '¿Cuántos tienes?'}</label>
              <input type="number" id="pStock" inputmode="decimal" min="0" step="any"
                     value="${p ? hay : ''}" placeholder="0"
                     ${p && p.variantes.length ? 'disabled' : ''}>
            </div>
            <div>
              <label for="pMinimo">Avísame cuando queden</label>
              <input type="number" id="pMinimo" inputmode="decimal" min="0" step="any"
                     value="${p ? p.stockMinimo : ''}" placeholder="6">
            </div>
          </div>
          ${p && p.variantes.length
            ? '<p class="ayuda">Este producto tiene variantes, así que su stock se cuenta en cada una.</p>'
            : ''}
        </div>

        <label for="pDescripcion">Descripción para el catálogo (opcional)</label>
        <textarea id="pDescripcion" rows="2" placeholder="Bebida de 1,5 litros, bien fría.">${esc(p ? p.descripcion : '')}</textarea>

        <div class="fila-dos">
          <div>
            <label for="pSku">Código o SKU (opcional)</label>
            <input type="text" id="pSku" value="${esc(p ? p.sku : '')}" autocomplete="off">
          </div>
          <div>
            <label for="pCategoria">Categoría (opcional)</label>
            <input type="text" id="pCategoria" value="${esc(p ? p.categoria : '')}"
                   placeholder="Bebidas" autocomplete="off">
          </div>
        </div>

        <label class="interruptor">
          <input type="checkbox" id="pEnCatalogo" ${!p || p.enCatalogo !== false ? 'checked' : ''}>
          <span>Mostrarlo en mi catálogo</span>
        </label>

        <!-- Fotos: sin "accept", porque en iPhone poner extensiones raras
             esconde la Fototeca y parece que la app no dejara subir la foto. -->
        <label>Fotos</label>
        <button type="button" class="boton secundario" id="botonFotoProducto">📷 Agregar una foto</button>
        <div class="tiras-adjuntos" id="fotosDelProducto"></div>
        <p class="ayuda">Las fotos se quedan en este aparato. La app puede recortarlas y aclararlas por ti.</p>

        ${p ? `
          <hr class="separador">
          <div class="tarjeta-titulo"><h3>Variantes</h3></div>
          <p class="ayuda">Talla, color o sabor. Cada una lleva su propio precio y su propio stock.</p>
          ${p.variantes.length ? `<ul class="lista">${p.variantes.map(v => `
            <li class="movimiento" data-variante-de="${p.id}" data-variante-id="${v.id}">
              <span class="emoji">🏷️</span>
              <div class="info">
                <strong>${esc(v.nombre)}</strong>
                <span class="ayuda">Quedan ${verCantidad(DatosNegocio.stockDe(p.id, v.id))}</span>
              </div>
              <div class="monto"><strong>${dinero(v.precio)}</strong></div>
            </li>`).join('')}</ul>` : ''}
          <button type="button" class="boton secundario" data-nueva-variante="${p.id}">+ Agregar una variante</button>
        ` : `<p class="ayuda" style="margin-top:14px">Las variantes (tallas, colores) se agregan después de guardar.</p>`}

        <div class="fila-botones" style="margin-top:18px">
          ${p ? `<button type="button" class="boton peligro" data-borrar-producto="${p.id}">Borrar</button>` : ''}
          <button type="submit" class="boton">${p ? 'Guardar cambios' : 'Guardar producto'}</button>
        </div>
      </form>`;
  }

  function formVariante({ productoId, varianteId }) {
    const p = DatosNegocio.productoPorId(productoId);
    const v = varianteId ? (p.variantes || []).find(x => x.id === varianteId) : null;
    return tituloForm(v ? 'Editar variante' : 'Variante nueva') + `
      <form id="formNegocio" data-guardar="variante" data-id="${productoId}" data-variante="${v ? v.id : ''}">
        <p class="ayuda">De <strong>${esc(p.nombre)}</strong>.</p>
        <label for="vNombre">¿Cuál es?</label>
        <input type="text" id="vNombre" value="${esc(v ? v.nombre : '')}" required
               placeholder="Talla M" autocomplete="off">
        <div class="fila-dos">
          <div>
            <label for="vPrecio">Se vende en</label>
            <input type="number" id="vPrecio" inputmode="numeric" min="0" step="1"
                   value="${v ? v.precio : p.precio}">
          </div>
          <div>
            <label for="vCosto">Cuesta</label>
            <input type="number" id="vCosto" inputmode="numeric" min="0" step="1"
                   value="${v ? v.costo : p.costo}">
          </div>
        </div>
        ${v ? '' : `
          <label for="vStock">¿Cuántas tienes?</label>
          <input type="number" id="vStock" inputmode="decimal" min="0" step="any" value="0">`}
        <div class="fila-botones" style="margin-top:18px">
          ${v ? `<button type="button" class="boton peligro" data-borrar-variante="${v.id}" data-de="${productoId}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
      </form>`;
  }

  function formStock({ productoId, varianteId }) {
    const p = DatosNegocio.productoPorId(productoId);
    const hay = DatosNegocio.stockDe(productoId, varianteId || null);
    return tituloForm('Cuadrar el stock') + `
      <form id="formNegocio" data-guardar="stock" data-id="${productoId}" data-variante="${varianteId || ''}">
        <p class="ayuda">De <strong>${esc(p.nombre)}</strong>. La app cree que quedan
           <strong>${verCantidad(hay)}</strong>.</p>
        <label for="sHay">¿Cuántos hay de verdad?</label>
        <input type="number" id="sHay" inputmode="decimal" step="any" value="${hay}" required>
        <p class="ayuda">Se guarda la diferencia, no el número final, así siempre se puede
           ver hacia atrás qué pasó entre un conteo y otro.</p>
        <button type="submit" class="boton" style="margin-top:16px">Cuadrar</button>
      </form>`;
  }

  /* ---------------- Ficha de persona ---------------- */

  function formFicha({ lista, id }) {
    const f = id ? DatosNegocio.fichaPorId(lista, id) : null;
    const titulos = { clientes: 'cliente', proveedores: 'proveedor', empleados: 'persona del equipo' };
    return tituloForm(f ? `Editar ${titulos[lista]}` : `Nuevo ${titulos[lista]}`) + `
      <form id="formNegocio" data-guardar="ficha" data-lista="${lista}" data-id="${f ? f.id : ''}">
        <label for="fNombre">Nombre</label>
        <input type="text" id="fNombre" value="${esc(f ? f.nombre : '')}" required autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="fTelefono">Teléfono</label>
            <input type="tel" id="fTelefono" value="${esc(f ? f.telefono : '')}"
                   placeholder="+56 9 1234 5678" autocomplete="off">
          </div>
          <div>
            <label for="fRut">RUT</label>
            <input type="text" id="fRut" value="${esc(f ? f.rut : '')}"
                   placeholder="12.345.678-9" autocomplete="off">
          </div>
        </div>

        <label for="fCorreo">Correo</label>
        <input type="email" id="fCorreo" value="${esc(f ? f.correo : '')}" autocomplete="off">

        <label for="fDireccion">Dirección</label>
        <input type="text" id="fDireccion" value="${esc(f ? f.direccion : '')}" autocomplete="off">

        ${lista === 'empleados' ? `
          <div class="fila-dos">
            <div>
              <label for="fRol">¿Qué hace?</label>
              <input type="text" id="fRol" value="${esc(f ? f.rol : '')}"
                     placeholder="Vendedora" autocomplete="off">
            </div>
            <div>
              <label for="fSueldo">Sueldo mensual</label>
              <input type="number" id="fSueldo" inputmode="numeric" min="0" step="1"
                     value="${f ? f.sueldo : ''}">
            </div>
          </div>
          ${f ? `
            <label class="interruptor">
              <input type="checkbox" id="fActivo" ${f.activo !== false ? 'checked' : ''}>
              <span>Sigue trabajando acá</span>
            </label>` : ''}` : ''}

        <label for="fNota">Nota</label>
        <textarea id="fNota" rows="2">${esc(f ? f.nota : '')}</textarea>

        <div class="fila-botones" style="margin-top:18px">
          ${f ? `<button type="button" class="boton peligro" data-borrar-ficha="${f.id}" data-lista="${lista}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
      </form>`;
  }

  /* ---------------- Gasto o compra ---------------- */

  function formCompra() {
    return tituloForm('Gasto del negocio') + `
      <form id="formNegocio" data-guardar="compra">
        <p class="ayuda">Esto sale de la caja del negocio, no de tu bolsillo. No baja tu sueldo libre.</p>

        <!-- Esto es lo que otras apps venden como "lectura de facturas con
             IA". Acá lo hace core/lector.js, que ya lee comprobantes
             chilenos en PDF, Excel, correo del banco y texto pegado, sin
             mandar el archivo a ninguna parte. Va ARRIBA a propósito: si
             lees primero, los campos de abajo se llenan solos. -->
        <div class="zona-respaldo">
          <button type="button" class="boton secundario" id="botonLeerFactura">
            📄 Leer la factura o boleta
          </button>
          <p class="ayuda">Se queda en tu teléfono. La app te muestra de qué línea sacó cada dato.</p>
          <div id="lecturaCompra"></div>
          <div class="tiras-adjuntos" id="adjuntosCompra"></div>
        </div>

        <label for="cDescripcion">¿Qué fue?</label>
        <input type="text" id="cDescripcion" required autocomplete="off"
               placeholder="Pedido semanal, arriendo del local, luz…">

        <div class="fila-dos">
          <div>
            <label for="cMonto">Monto</label>
            <input type="number" id="cMonto" inputmode="numeric" min="0" step="1" placeholder="60000">
          </div>
          <div>
            <label for="cFecha">Fecha</label>
            <input type="date" id="cFecha" value="${Fechas.hoyISO()}">
          </div>
        </div>

        <label for="cProveedor">¿A quién le compraste?</label>
        <select id="cProveedor">
          <option value="">Sin proveedor</option>
          ${DatosNegocio.proveedores().map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}
        </select>

        <label for="cCategoria">Tipo de gasto</label>
        <select id="cCategoria">
          <option value="mercaderia">📥 Mercadería para vender</option>
          <option value="arriendo">🏠 Arriendo del local</option>
          <option value="servicios">💡 Luz, agua, internet</option>
          <option value="sueldos">👥 Sueldos</option>
          <option value="transporte">🚚 Transporte y despacho</option>
          <option value="otro">📦 Otro</option>
        </select>

        <hr class="separador">
        <p class="ayuda">Si compraste productos para vender, agrégalos acá y entran solos a la bodega
           (y actualizan lo que te cuestan hoy).</p>
        <div id="lineasCompra"></div>
        <button type="button" class="boton secundario" id="agregarLineaCompra">+ Agregar un producto</button>

        <button type="submit" class="boton" style="margin-top:18px">Guardar gasto</button>
      </form>`;
  }

  /* ---------------- Cotización ---------------- */

  function formCotizacion({ id }) {
    const q = id ? DatosNegocio.cotizacionPorId(id) : null;
    vista.carritoCotizacion = q ? q.lineas.map(l => ({ ...l })) : [];
    vista.cotizacionEditando = q ? q.id : null;

    return tituloForm(q ? `Cotización N° ${q.folio}` : 'Nueva cotización') + `
      <form id="formNegocio" data-guardar="cotizacion" data-id="${q ? q.id : ''}">
        <label for="qCliente">¿Para quién?</label>
        <select id="qCliente">
          <option value="">Sin cliente</option>
          ${DatosNegocio.clientes().map(c =>
            `<option value="${c.id}" ${q && q.clienteId === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
        </select>

        <label>Lo que le estás cotizando</label>
        <div id="lineasCotizacion"></div>
        <button type="button" class="boton secundario" id="agregarLineaCotizacion">+ Agregar un producto</button>

        <div class="fila-dos" style="margin-top:14px">
          <div>
            <label for="qDescuento">Descuento</label>
            <input type="number" id="qDescuento" inputmode="numeric" min="0" step="1"
                   value="${q ? q.descuento : ''}" placeholder="0">
          </div>
          <div>
            <label for="qValida">Vale hasta</label>
            <input type="date" id="qValida" value="${q ? q.validaHasta : ''}">
          </div>
        </div>

        <label for="qNota">Nota para el cliente</label>
        <textarea id="qNota" rows="2" placeholder="Precios incluyen despacho dentro de la comuna.">${esc(q ? q.nota : '')}</textarea>

        <label for="qEstado">¿En qué va?</label>
        <select id="qEstado">
          <option value="borrador"  ${q && q.estado === 'borrador'  ? 'selected' : ''}>✏️ Borrador</option>
          <option value="enviada"   ${!q || q.estado === 'enviada'  ? 'selected' : ''}>🕓 Se la mandé, espero respuesta</option>
          <option value="rechazada" ${q && q.estado === 'rechazada' ? 'selected' : ''}>❌ La rechazó</option>
        </select>

        <div class="fila-botones" style="margin-top:18px">
          ${q ? `<button type="button" class="boton peligro" data-borrar-cotizacion="${q.id}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
        ${q && !q.ventaId ? `
          <button type="button" class="boton" style="margin-top:10px" data-convertir="${q.id}">
            ✅ El cliente aceptó: convertir en venta
          </button>` : ''}
      </form>`;
  }

  /* ---------------- Retiro (el puente) ---------------- */

  function formRetiro() {
    const cuentas = Datos.cuentasActivas();
    const { anio, mes } = window.App.mesEnPantalla();
    const caja = DatosNegocio.resumenDelMes(anio, mes).caja;

    return tituloForm('Pagarme a mí mismo') + `
      <form id="formNegocio" data-guardar="retiro">
        <div class="consejo" style="margin-bottom:14px">
          <strong>🌉 Esto cruza el puente</strong>
          Esta plata deja de ser del negocio y pasa a ser tuya. Va a aparecer en tus
          movimientos como un ingreso y va a subir tu sueldo libre del mes.
        </div>

        <label for="rMonto">¿Cuánto te vas a pagar?</label>
        <!-- OJO con min y step juntos: el navegador cuenta los pasos DESDE
             el mínimo, así que con min="1" step="1000" los únicos montos
             válidos serían 1, 1001, 2001… y escribir 20000 dejaba el
             formulario mudo: no enviaba y no decía por qué. El mínimo va
             en 0 y de que sea mayor que cero se encarga datos-negocio.js,
             que además explica el error con palabras. -->
        <input type="number" id="rMonto" inputmode="numeric" min="0" step="1" required
               placeholder="300000">
        <p class="ayuda">En la caja del negocio hay ${dinero(caja)} este mes.</p>

        <label for="rCuenta">¿A qué cuenta tuya entra?</label>
        <select id="rCuenta" required>
          ${cuentas.map(c => `<option value="${c.id}">${c.icono} ${esc(c.nombre)}</option>`).join('')}
        </select>

        <div class="fila-dos">
          <div>
            <label for="rConcepto">¿Por qué concepto?</label>
            <input type="text" id="rConcepto" value="Mi sueldo" autocomplete="off">
          </div>
          <div>
            <label for="rFecha">Fecha</label>
            <input type="date" id="rFecha" value="${Fechas.hoyISO()}">
          </div>
        </div>

        <button type="submit" class="boton" style="margin-top:18px">Pasarme la plata</button>
      </form>`;
  }

  /* ---------------- Perfil del negocio ---------------- */

  function formPerfil() {
    const p = DatosNegocio.perfil();
    return tituloForm('Mi negocio') + `
      <form id="formNegocio" data-guardar="perfil">
        <label for="nNombre">Nombre del negocio</label>
        <input type="text" id="nNombre" value="${esc(p.nombre)}" required autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="nEmoji">Su carita</label>
            <input type="text" id="nEmoji" value="${esc(p.emoji)}" maxlength="4">
          </div>
          <div>
            <label for="nRubro">¿A qué te dedicas?</label>
            <input type="text" id="nRubro" value="${esc(p.rubro)}"
                   placeholder="Almacén de barrio" autocomplete="off">
          </div>
        </div>

        <label for="nMensaje">Frase para tu catálogo</label>
        <input type="text" id="nMensaje" value="${esc(p.mensaje)}"
               placeholder="Pedidos por WhatsApp, despacho el mismo día" autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="nTelefono">Teléfono</label>
            <input type="tel" id="nTelefono" value="${esc(p.telefono)}" autocomplete="off">
          </div>
          <div>
            <label for="nRut">RUT</label>
            <input type="text" id="nRut" value="${esc(p.rut)}" autocomplete="off">
          </div>
        </div>

        <label for="nDireccion">Dirección</label>
        <input type="text" id="nDireccion" value="${esc(p.direccion)}" autocomplete="off">

        <label for="nCorreo">Correo</label>
        <input type="email" id="nCorreo" value="${esc(p.correo)}" autocomplete="off">

        <button type="submit" class="boton" style="margin-top:18px">Guardar</button>
      </form>`;
  }

  /* ============================================================
     5. AJUSTES DEL NEGOCIO (dentro de la hoja de sección)
     ============================================================ */

  function ajustesDelNegocio() {
    const p = DatosNegocio.perfil();
    const a = DatosNegocio.ajustes();
    const n = DatosNegocio.todo();

    return cabecera('Mi negocio') + `
      <div class="tarjeta">
        <div class="negocio-marca">
          <span class="negocio-emoji">${esc(p.emoji)}</span>
          <div><h3>${esc(p.nombre)}</h3><p class="ayuda">${esc(p.rubro || 'Sin rubro')}</p></div>
        </div>
        <button class="boton secundario" data-form="perfil" style="margin-top:12px">Editar los datos</button>
      </div>

      <div class="tarjeta">
        <h3>Cómo se comporta</h3>
        <label class="interruptor">
          <input type="checkbox" id="aStockBajo" ${a.avisarStockBajo !== false ? 'checked' : ''}>
          <span>Avisarme cuando quede poco de algo</span>
        </label>
        <label for="aDias">Una cotización vale por</label>
        <input type="number" id="aDias" inputmode="numeric" min="1" max="365" value="${a.diasCotizacion}">
        <p class="ayuda">Días. Pasado ese plazo la app la marca como vencida sola.</p>
        <button class="boton secundario" id="guardarAjustesNegocio">Guardar</button>
      </div>

      <div class="tarjeta">
        <h3>Lo que tienes guardado</h3>
        <div class="negocio-detalle">
          <div><span>Productos</span><strong>${n.productos.length}</strong></div>
          <div><span>Ventas</span><strong>${n.ventas.length}</strong></div>
          <div><span>Clientes</span><strong>${n.clientes.length}</strong></div>
          <div><span>Movimientos de bodega</span><strong>${n.stock.length}</strong></div>
        </div>
      </div>

      <div class="tarjeta">
        <h3>✨ Las funciones que otras apps cobran como "con IA"</h3>
        <p class="ayuda">
          Acá las hace tu propio teléfono, sin mandar tus datos a ninguna parte y sin pagar nada al mes:
        </p>
        <ul class="lista-simple">
          <li><strong>Tu sitio web</strong> — <em>Mi catálogo</em> arma una página completa con tus productos.</li>
          <li><strong>Mejorar las fotos</strong> — al agregar una foto puedes recortarla, aclararla y dejarle el fondo parejo.</li>
          <li><strong>Leer facturas</strong> — el lector de comprobantes que ya usas en Movimientos también llena los gastos del negocio.</li>
        </ul>
        <p class="ayuda">
          El día que quieras además un modelo de verdad redactando descripciones, hay un
          interruptor listo esperando en los ajustes. Hoy está apagado a propósito.
        </p>
      </div>

      <div class="tarjeta">
        <h3>Apagar el negocio</h3>
        <p class="ayuda">
          Esconde la pestaña. No borra nada: tus productos, ventas y clientes quedan
          enteros esperando por si la vuelves a encender.
        </p>
        <button class="boton secundario" id="apagarNegocio">Apagar la pestaña Negocio</button>
      </div>`;
  }

  /* ============================================================
     6. LA SECCIÓN EN AJUSTES (para encenderlo)
     ============================================================ */

  function dibujarEnAjustes() {
    const caja = $$$('negocioEnAjustes');
    if (!caja) return;

    if (DatosNegocio.estaActivo()) {
      const p = DatosNegocio.perfil();
      caja.innerHTML = `
        <h2>Mi negocio</h2>
        <p class="ayuda">
          <strong>${esc(p.nombre)}</strong> está encendido. Lo administras desde la pestaña
          Negocio, abajo a la derecha.
        </p>
        <button class="boton secundario" id="irAlNegocio">Ir a mi negocio</button>`;
      return;
    }

    caja.innerHTML = `
      <h2>¿Vendes algo?</h2>
      <p class="ayuda">
        Enciende la pestaña Negocio y vas a poder llevar tu inventario, tus ventas, tus
        clientes, tus cotizaciones y tu catálogo. La plata del negocio se lleva aparte de
        la tuya: solo lo que te pagas a ti mismo entra a tu sueldo libre.
      </p>
      <label for="nombreNegocioNuevo">¿Cómo se llama tu negocio?</label>
      <input type="text" id="nombreNegocioNuevo" placeholder="Almacén Doña Rosa" autocomplete="off">
      <label for="rubroNegocioNuevo">¿A qué te dedicas? (opcional)</label>
      <input type="text" id="rubroNegocioNuevo" placeholder="Almacén de barrio" autocomplete="off">
      <button class="boton" id="encenderNegocio" style="margin-top:14px">Encender la pestaña Negocio</button>`;
  }

  /* ============================================================
     7. EVENTOS
     ============================================================ */

  function conectar() {
    // Un solo escucha para toda la pestaña. Con listas que se
    // redibujan enteras, poner un escucha por botón significa
    // quedarse con escuchas colgando de botones que ya no existen.
    document.addEventListener('click', alTocar);
    document.addEventListener('submit', alEnviar);
    document.addEventListener('input', alEscribir);
    document.addEventListener('change', alCambiar);
  }

  /* Los nombres que reconoce el escucha de toques.
     Están en una lista y no en un selector escrito a mano porque un
     selector hay que mantenerlo en paralelo con las ramas de abajo, y
     ya se me olvidó una vez: el botón de leer la factura existía, tenía
     su rama, y no hacía nada porque faltaba en el selector. Con la
     lista, agregar una rama es agregar una palabra acá al lado. */
  const ATRIBUTOS = [
    'negocio', 'seccion', 'cerrarNegocio', 'form', 'producto', 'venta', 'compra',
    'cotizacion', 'ficha', 'retiro', 'vender', 'mas', 'menos', 'cobrar',
    'nuevaVariante', 'varianteDe', 'borrarProducto', 'borrarFicha',
    'borrarCotizacion', 'borrarVariante', 'convertir', 'quitarLinea',
  ];
  const IDS = new Set([
    'encenderNegocio', 'irAlNegocio', 'apagarNegocio', 'guardarAjustesNegocio',
    'agregarLineaCompra', 'agregarLineaCotizacion', 'botonFotoProducto', 'botonLeerFactura',
  ]);

  /** Sube desde donde se tocó hasta encontrar algo que nos interese. */
  function objetivo(desde) {
    for (let el = desde; el && el !== document; el = el.parentElement) {
      if (el.id && IDS.has(el.id)) return el;
      if (el.dataset && ATRIBUTOS.some(a => el.dataset[a] !== undefined)) return el;
    }
    return null;
  }

  async function alTocar(e) {
    const t = objetivo(e.target);
    if (!t) return;
    const d = t.dataset;

    /* --- navegación --- */
    if (d.negocio === 'vender')     return abrirVender();
    if (d.seccion)                  return abrirSeccion(d.seccion);
    if (d.cerrarNegocio) {
      // Cerrar un formulario sin guardar deja sus fotos sin dueño. Se van
      // ahora; y si alguien cerró con el botón "atrás" en vez de este, el
      // barrido de huérfanos del arranque las alcanza igual.
      if (d.cerrarNegocio === 'telonNegocioForm') soltarFotosPendientes();
      return window.App.cerrarHoja(d.cerrarNegocio);
    }
    if (d.form)                     return abrirFormulario(d.form, { lista: d.lista });

    /* --- encender y apagar --- */
    if (t.id === 'encenderNegocio') return encenderDesdeAjustes();
    if (t.id === 'irAlNegocio')     return window.App.irA('negocio');
    if (t.id === 'apagarNegocio')   return apagarNegocio();
    if (t.id === 'guardarAjustesNegocio') return guardarAjustesDesdeLaHoja();

    /* --- vender --- */
    if (d.vender)                   return alCarrito(d.vender, d.variante || null);
    if (d.mas !== undefined)        return cambiarCantidad(Number(d.mas), 1);
    if (d.menos !== undefined)      return cambiarCantidad(Number(d.menos), -1);
    if (d.cobrar)                   return cobrar(d.cobrar);

    /* --- abrir un elemento de una lista --- */
    if (d.producto)                 return abrirFormulario('producto', { id: d.producto });
    if (d.venta)                    return abrirVenta(d.venta);
    if (d.compra)                   return abrirCompra(d.compra);
    if (d.cotizacion)               return abrirFormulario('cotizacion', { id: d.cotizacion });
    if (d.ficha)                    return abrirFormulario('ficha', { lista: d.lista, id: d.ficha });
    if (d.retiro)                   return abrirRetiro(d.retiro);

    /* --- variantes --- */
    if (d.nuevaVariante)            return abrirFormulario('variante', { productoId: d.nuevaVariante });
    if (d.varianteDe)               return abrirFormulario('variante',
                                            { productoId: d.varianteDe, varianteId: d.varianteId });

    /* --- borrar --- */
    if (d.borrarProducto)           return borrarProducto(d.borrarProducto);
    if (d.borrarFicha)              return borrarFicha(d.lista, d.borrarFicha);
    if (d.borrarCotizacion)         return borrarCotizacion(d.borrarCotizacion);
    if (d.borrarVariante)           return borrarVariante(d.de, d.borrarVariante);
    if (d.convertir)                return convertirCotizacion(d.convertir);

    /* --- líneas de formularios --- */
    if (t.id === 'agregarLineaCompra')     return agregarLinea('lineasCompra');
    if (t.id === 'agregarLineaCotizacion') return agregarLinea('lineasCotizacion');
    if (d.quitarLinea !== undefined)       { t.closest('.linea-editable').remove(); return; }

    // El mismo selector de archivos sirve para las dos cosas; lo que
    // cambia es qué hacemos con lo que traiga.
    if (t.id === 'botonFotoProducto')      return pedirArchivo('foto');
    if (t.id === 'botonLeerFactura')       return pedirArchivo('factura');
  }

  function pedirArchivo(paraQue) {
    vista.fotoPara = paraQue;
    $$$('archivoFotoNegocio').click();
  }

  /** Borra de la bodega las fotos de un formulario que se cerró sin guardar. */
  function soltarFotosPendientes() {
    if (typeof Adjuntos !== 'undefined') {
      vista.fotosPendientes.forEach(f => Adjuntos.borrar(f.id));
    }
    vista.fotosPendientes = [];
  }

  function alEscribir(e) {
    if (e.target.id === 'buscadorNegocio') {
      vista.buscar = e.target.value;
      // Solo se redibuja la lista, no la hoja entera: si redibujáramos
      // todo, el campo perdería el foco en cada letra y el teclado del
      // teléfono se cerraría solo.
      redibujarSoloLaLista();
    }
    if (e.target.id === 'descuentoVenta') {
      vista.descuentoVenta = Math.max(0, Math.round(Number(e.target.value) || 0));
      const total = Math.max(0, DatosNegocio.sumaDeLineas(vista.carrito) - vista.descuentoVenta);
      const caja = document.querySelector('.total-venta .grande strong');
      if (caja) caja.textContent = dinero(total);
      const boton = document.querySelector('[data-cobrar="pagada"]');
      if (boton) boton.textContent = `✅ Cobrar ${dinero(total)}`;
    }
  }

  function alCambiar(e) {
    if (e.target.id === 'pControlaStock') {
      const zona = $$$('zonaStock');
      if (zona) zona.hidden = !e.target.checked;
    }
    if (e.target.id === 'archivoFotoNegocio') {
      const archivos = [...e.target.files];
      // El value se limpia siempre: sin eso, elegir DOS VECES la misma foto
      // no dispara 'change' la segunda vez y parece que la app se colgó.
      e.target.value = '';
      if (vista.fotoPara === 'factura') leerFactura(archivos);
      else recibirFotos(archivos);
    }
    if (e.target.id === 'clienteVenta')   vista.clienteVenta = e.target.value || null;
    if (e.target.id === 'empleadoVenta')  vista.empleadoVenta = e.target.value || null;
  }

  /** Redibuja la lista de la sección sin tocar el buscador. */
  function redibujarSoloLaLista() {
    const caja = $$$('negocioSeccion');
    if (!caja) return;
    const foco = document.activeElement;
    const donde = foco === $$$('buscadorNegocio') ? foco.selectionStart : null;
    const abierto = $$$('telonNegocioVender').classList.contains('abierto');
    if (abierto) { pintarVender(); } else { pintarSeccion(); }
    const nuevo = $$$('buscadorNegocio');
    if (nuevo && donde !== null) {
      nuevo.focus();
      nuevo.setSelectionRange(donde, donde);
    }
  }

  function cambiarCantidad(indice, delta) {
    const l = vista.carrito[indice];
    if (!l) return;
    l.cantidad = Math.round((l.cantidad + delta) * 1000) / 1000;
    if (l.cantidad <= 0) vista.carrito.splice(indice, 1);
    pintarVender();
  }

  /* ---------------- Guardar ---------------- */

  async function alEnviar(e) {
    if (e.target.id !== 'formNegocio') return;
    e.preventDefault();
    const d = e.target.dataset;
    try {
      const guardadores = {
        producto: guardarProducto, variante: guardarVariante, stock: guardarStock,
        ficha: guardarFicha, compra: guardarCompra, cotizacion: guardarCotizacion,
        retiro: guardarRetiro, perfil: guardarPerfil,
      };
      await guardadores[d.guardar](d);
      window.App.cerrarHoja('telonNegocioForm');
      dibujar();
      if (vista.seccion) pintarSeccion();
    } catch (error) {
      avisar(error.message);
    }
  }

  const num = id => {
    const c = $$$(id);
    return c && c.value !== '' ? Number(c.value) : undefined;
  };
  const txt = id => {
    const c = $$$(id);
    return c ? c.value : '';
  };
  const marcado = id => {
    const c = $$$(id);
    return c ? c.checked : false;
  };

  async function guardarProducto(d) {
    const datos = {
      nombre: txt('pNombre'),
      precio: num('pPrecio') || 0,
      costo: num('pCosto') || 0,
      controlaStock: marcado('pControlaStock'),
      stockMinimo: num('pMinimo') || 0,
      descripcion: txt('pDescripcion'),
      sku: txt('pSku'),
      categoria: txt('pCategoria'),
      enCatalogo: marcado('pEnCatalogo'),
    };

    if (d.id) {
      const p = DatosNegocio.productoPorId(d.id);
      datos.fotos = [...(p.fotos || []), ...vista.fotosPendientes];
      DatosNegocio.editarProducto(d.id, datos);
      // El campo de stock del formulario es "cuántos hay ahora": si lo
      // cambiaron, se cuadra como un conteo.
      if (marcado('pControlaStock') && !p.variantes.length && num('pStock') !== undefined) {
        DatosNegocio.fijarStock({ productoId: d.id, hay: num('pStock') });
      }
      avisar('Producto guardado.');
    } else {
      datos.stockInicial = num('pStock') || 0;
      datos.fotos = vista.fotosPendientes;
      DatosNegocio.agregarProducto(datos);
      avisar('Producto agregado.');
    }
    vista.fotosPendientes = [];
  }

  function guardarVariante(d) {
    if (d.variante) {
      DatosNegocio.editarVariante(d.id, d.variante, {
        nombre: txt('vNombre'), precio: num('vPrecio'), costo: num('vCosto'),
      });
    } else {
      DatosNegocio.agregarVariante(d.id, {
        nombre: txt('vNombre'), precio: num('vPrecio'), costo: num('vCosto'),
        stockInicial: num('vStock') || 0,
      });
    }
    avisar('Variante guardada.');
  }

  function guardarStock(d) {
    const delta = DatosNegocio.fijarStock({
      productoId: d.id, varianteId: d.variante || null, hay: num('sHay') || 0,
    });
    avisar(delta === 0 ? 'Ya estaba cuadrado.'
      : `Cuadrado: ${delta > 0 ? 'sobraban' : 'faltaban'} ${verCantidad(Math.abs(delta))}.`);
  }

  function guardarFicha(d) {
    const datos = {
      nombre: txt('fNombre'), telefono: txt('fTelefono'), rut: txt('fRut'),
      correo: txt('fCorreo'), direccion: txt('fDireccion'), nota: txt('fNota'),
    };
    if (d.lista === 'empleados') {
      datos.rol = txt('fRol');
      datos.sueldo = num('fSueldo') || 0;
      if ($$$('fActivo')) datos.activo = marcado('fActivo');
    }
    const comoSeLlama = { clientes: 'al cliente', proveedores: 'al proveedor', empleados: 'a la persona' }[d.lista];
    if (d.id) DatosNegocio.editarFicha(d.lista, d.id, datos);
    else DatosNegocio.agregarFicha(d.lista, datos, comoSeLlama);
    avisar('Guardado.');
  }

  function guardarCompra() {
    DatosNegocio.registrarCompra({
      descripcion: txt('cDescripcion'),
      monto: num('cMonto') || 0,
      fecha: txt('cFecha'),
      proveedorId: txt('cProveedor') || null,
      categoria: txt('cCategoria'),
      lineas: leerLineas('lineasCompra'),
      // La factura que se leyó (o se adjuntó sin leer) queda colgada
      // del gasto, para poder mirarla después.
      adjuntos: vista.fotosPendientes,
    });
    vista.fotosPendientes = [];
    avisar('Gasto anotado.');
  }

  function guardarCotizacion(d) {
    DatosNegocio.guardarCotizacion({
      clienteId: txt('qCliente') || null,
      lineas: leerLineas('lineasCotizacion'),
      descuento: num('qDescuento') || 0,
      validaHasta: txt('qValida'),
      nota: txt('qNota'),
      estado: txt('qEstado'),
    }, d.id || null);
    avisar('Cotización guardada.');
  }

  function guardarRetiro() {
    DatosNegocio.registrarRetiro({
      monto: num('rMonto') || 0,
      cuentaDestino: txt('rCuenta'),
      concepto: txt('rConcepto'),
      fecha: txt('rFecha'),
    });
    avisar('Listo: esa plata ya es tuya y está en tus movimientos.');
  }

  function guardarPerfil() {
    DatosNegocio.guardarPerfil({
      nombre: txt('nNombre'), emoji: txt('nEmoji'), rubro: txt('nRubro'),
      mensaje: txt('nMensaje'), telefono: txt('nTelefono'), rut: txt('nRut'),
      direccion: txt('nDireccion'), correo: txt('nCorreo'),
    });
    avisar('Guardado.');
  }

  /* ---------------- Líneas de producto en compras y cotizaciones ---------------- */

  function agregarLinea(dondeId) {
    const caja = $$$(dondeId);
    if (!caja) return;
    const esCompra = dondeId === 'lineasCompra';
    const fila = document.createElement('div');
    fila.className = 'linea-editable';
    fila.innerHTML = `
      <select class="linea-producto">
        ${DatosNegocio.productos().map(p =>
          (p.variantes && p.variantes.length
            ? p.variantes.map(v =>
                `<option value="${p.id}|${v.id}">${esc(p.nombre)} — ${esc(v.nombre)}</option>`).join('')
            : `<option value="${p.id}|">${esc(p.nombre)}</option>`)).join('')}
      </select>
      <input type="number" class="linea-cantidad" inputmode="decimal" min="0" step="any" value="1" placeholder="1">
      <input type="number" class="linea-precio" inputmode="numeric" min="0" step="1"
             placeholder="${esCompra ? 'costo' : 'precio'}">
      <button type="button" class="boton fantasma chico" data-quitar-linea>✕</button>`;
    caja.appendChild(fila);
  }

  function leerLineas(dondeId) {
    const caja = $$$(dondeId);
    if (!caja) return [];
    return [...caja.querySelectorAll('.linea-editable')].map(fila => {
      const [productoId, varianteId] = fila.querySelector('.linea-producto').value.split('|');
      const precio = fila.querySelector('.linea-precio').value;
      const linea = {
        productoId,
        varianteId: varianteId || null,
        cantidad: Number(fila.querySelector('.linea-cantidad').value) || 0,
      };
      if (precio !== '') { linea.precio = Number(precio); linea.costo = Number(precio); }
      return linea;
    }).filter(l => l.cantidad > 0);
  }

  /* ---------------- Leer una factura ----------------

     El mismo lector determinístico de Movimientos, apuntado al
     formulario de gastos del negocio. No inventa nada y no anota solo:
     rellena, muestra de qué línea sacó cada dato y deja deshacer.
     Regla 12 de CLAUDE.md.                                        */

  async function leerFactura(archivos) {
    const caja = $$$('lecturaCompra');
    if (!caja) return;

    for (const archivo of archivos) {
      try {
        const leido = await Archivos.leer(archivo);

        // El archivo se guarda igual, aunque no se le entienda el texto:
        // la foto de la factura vale por sí sola.
        if (await Adjuntos.disponible()) {
          const ficha = await Adjuntos.guardar({
            id: 'adj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            nombre: leido.nombre, tipo: leido.tipo, blob: leido.blob,
          });
          if (ficha) vista.fotosPendientes.push(ficha);
        }

        if (!leido.texto) {
          caja.innerHTML = avisoDeLectura(leido.aviso
            || 'Guardamos el archivo, pero no le pudimos sacar el texto. Escribe los datos tú.');
          continue;
        }

        const p = Lector.leerComprobante(leido.texto, { hoy: Fechas.hoyISO() });
        if (leido.fechaFoto && !p.fecha) p.fecha = leido.fechaFoto;
        aplicarLecturaDeFactura(p);
      } catch (e) {
        caja.innerHTML = avisoDeLectura(e.message || 'No pudimos leer ese archivo.');
      }
    }
    pintarFotosPendientes('adjuntosCompra');
  }

  const avisoDeLectura = texto =>
    `<div class="consejo lectura" style="margin-top:10px"><strong>📄 Lectura</strong>${esc(texto)}</div>`;

  function aplicarLecturaDeFactura(p) {
    const caja = $$$('lecturaCompra');
    if (p.encontrados === 0) {
      caja.innerHTML = avisoDeLectura('Guardamos el archivo, pero no reconocimos ni el monto ni la fecha. Escríbelos tú.');
      return;
    }

    const antes = { monto: valorDe('cMonto'), fecha: valorDe('cFecha'), descripcion: valorDe('cDescripcion') };

    if (p.monto) $$$('cMonto').value = p.monto;
    if (p.fecha) $$$('cFecha').value = p.fecha;
    if (p.nota && !antes.descripcion) $$$('cDescripcion').value = p.nota;

    caja.innerHTML = `
      <div class="consejo lectura" style="margin-top:10px">
        <strong>📄 Esto entendimos del papel</strong>
        ${(p.evidencia || []).map(e =>
          `<span class="ayuda" style="display:block">· ${esc(e.linea)}</span>`).join('')}
        <button type="button" class="boton fantasma chico" id="deshacerLecturaCompra">
          No, déjalo como estaba
        </button>
      </div>`;

    $$$('deshacerLecturaCompra').addEventListener('click', () => {
      $$$('cMonto').value = antes.monto;
      $$$('cFecha').value = antes.fecha;
      $$$('cDescripcion').value = antes.descripcion;
      caja.innerHTML = '';
    }, { once: true });
  }

  /* ---------------- Fotos de producto ---------------- */

  async function recibirFotos(archivos) {
    if (!(await Adjuntos.disponible())) {
      return avisar('Este navegador no nos deja guardar fotos.');
    }
    for (const archivo of archivos) {
      try {
        // Acá pasa lo que otras apps venden como "mejora de fotos con
        // IA": se recorta al cuadrado, se le empareja la luz y se deja
        // liviana. Todo en el propio teléfono. Ver src/ui/fotos.js.
        const lista = await UiFotos.mejorar(archivo);
        const ficha = await Adjuntos.guardar({
          id: 'adj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          nombre: lista.nombre,
          tipo: lista.blob.type,
          blob: lista.blob,
        });
        if (!ficha) {
          avisar(`"${archivo.name}" pesa demasiado.`);
          continue;
        }
        vista.fotosPendientes.push(ficha);
      } catch (e) {
        avisar(e.message || 'No pudimos guardar esa foto.');
      }
    }
    pintarFotosPendientes();
  }

  function pintarFotosPendientes(dondeId) {
    const caja = $$$(dondeId || 'fotosDelProducto');
    if (!caja) return;
    const tipo = $$$('negocioForm').dataset.tipo;
    const extra = JSON.parse($$$('negocioForm').dataset.extra || '{}');
    const yaGuardadas = tipo === 'producto' && extra.id
      ? (DatosNegocio.productoPorId(extra.id).fotos || []) : [];
    const todas = [...yaGuardadas, ...vista.fotosPendientes];

    caja.innerHTML = todas.map(f =>
      `<span class="tira-adjunto" data-adjunto="${esc(f.id)}">📷 ${esc(f.nombre)}</span>`).join('');
    todas.forEach(f => pintarMiniatura(f.id));
  }

  /** Le pone la imagen de verdad a la miniatura, sacándola de IndexedDB. */
  async function pintarMiniatura(id) {
    try {
      const archivo = await Adjuntos.obtener(id);
      if (!archivo || !archivo.blob) return;
      const url = URL.createObjectURL(archivo.blob);
      document.querySelectorAll(`[data-adjunto="${id}"], [data-foto="${id}"]`).forEach(el => {
        el.style.backgroundImage = `url(${url})`;
        el.classList.add('con-foto');
      });
    } catch (e) { /* si no se puede mostrar, queda el emoji */ }
  }

  /* ---------------- Abrir cosas ya guardadas ---------------- */

  async function abrirVenta(id) {
    const v = DatosNegocio.ventaPorId(id);
    if (!v) return;
    const debe = DatosNegocio.saldoPendienteDe(v);
    const cliente = DatosNegocio.nombreDeFicha('clientes', v.clienteId);

    const detalle = v.lineas.map(l =>
      `${verCantidad(l.cantidad)} × ${l.nombre} — ${dinero(DatosNegocio.totalDeLinea(l))}`).join('\n');

    if (v.estado === 'anulada') {
      return Dialogos.avisar({
        titulo: `Venta N° ${v.folio} (anulada)`,
        texto: `${detalle}\n\nSe anuló el ${Fechas.fechaLegible(v.anulada || v.fecha)}.`,
      });
    }

    if (debe > 0) {
      const abono = await Dialogos.pedirMonto({
        titulo: `N° ${v.folio}: te deben ${dinero(debe)}`,
        texto: `${cliente || 'Cliente de paso'}\n\n${detalle}\n\n¿Cuánto te abonó?`,
        etiqueta: 'Abono', placeholder: String(debe), aceptar: 'Anotar el abono',
      });
      if (abono === null) return;
      DatosNegocio.abonarAVenta(id, abono);
      avisar('Abono anotado.');
      dibujar();
      return pintarSeccion();
    }

    const anular = await Dialogos.confirmar({
      titulo: `Venta N° ${v.folio}`,
      texto: `${cliente || 'Cliente de paso'}\n${Fechas.fechaLegible(v.fecha)}\n\n${detalle}\n\n`
           + `Total: ${dinero(DatosNegocio.totalDe(v))}`,
      aceptar: 'Ver el comprobante', cancelar: 'Anular la venta',
    });
    if (anular) return mostrarComprobante(v);

    const seguro = await Dialogos.confirmar({
      titulo: '¿Anular esta venta?',
      texto: 'La mercadería vuelve a la bodega y la venta queda marcada como anulada. '
           + 'No se borra: así el folio no queda con un hueco que después nadie sabe explicar.',
      aceptar: 'Sí, anular', peligro: true,
    });
    if (!seguro) return;
    DatosNegocio.anularVenta(id);
    avisar('Venta anulada.');
    dibujar();
    pintarSeccion();
  }

  async function abrirCompra(id) {
    const c = DatosNegocio.compraPorId(id);
    if (!c) return;
    const borrar = await Dialogos.confirmar({
      titulo: c.descripcion || 'Gasto del negocio',
      texto: `${Fechas.fechaLegible(c.fecha)}\n${dinero(c.monto)}`
           + ((c.lineas || []).length ? `\n\nTrajo ${c.lineas.length} productos a la bodega.` : ''),
      aceptar: 'Cerrar', cancelar: 'Borrar',
    });
    if (borrar) return;
    const seguro = await Dialogos.confirmar({
      titulo: '¿Borrar este gasto?',
      texto: (c.lineas || []).length
        ? 'Lo que había entrado a la bodega con esta compra va a salir de nuevo.'
        : 'No se puede deshacer.',
      aceptar: 'Borrar', peligro: true,
    });
    if (!seguro) return;
    DatosNegocio.borrarCompra(id);
    avisar('Gasto borrado.');
    dibujar();
    pintarSeccion();
  }

  async function abrirRetiro(id) {
    const r = DatosNegocio.retiros().find(x => x.id === id);
    if (!r) return;
    const seguro = await Dialogos.confirmar({
      titulo: '¿Deshacer este pago?',
      texto: `${r.concepto}\n${dinero(r.monto)}\n\nSe va a borrar también el ingreso que `
           + 'creó en tus movimientos personales, para que tu mes no quede inflado.',
      aceptar: 'Deshacer', cancelar: 'Dejarlo', peligro: true,
    });
    if (!seguro) return;
    DatosNegocio.borrarRetiro(id);
    avisar('Deshecho, en los dos lados.');
    dibujar();
    pintarSeccion();
  }

  /* ---------------- Borrar ---------------- */

  async function borrarProducto(id) {
    const p = DatosNegocio.productoPorId(id);
    const ventas = DatosNegocio.ventasDeProducto(id);
    if (ventas > 0) {
      const archivar = await Dialogos.confirmar({
        titulo: `${p.nombre} ya se vendió`,
        texto: `Aparece en ${ventas} ${ventas === 1 ? 'venta' : 'ventas'}. Si lo borráramos, `
             + 'esos meses cambiarían solos. Lo que sí podemos es archivarlo: desaparece de '
             + 'la lista y del catálogo, pero tus ventas siguen cuadrando.',
        aceptar: 'Archivarlo', cancelar: 'Dejarlo',
      });
      if (!archivar) return;
      DatosNegocio.archivarProducto(id);
      avisar('Archivado.');
    } else {
      const seguro = await Dialogos.confirmar({
        titulo: `¿Borrar ${p.nombre}?`,
        texto: 'Nunca se ha vendido, así que se puede borrar del todo.',
        aceptar: 'Borrar', peligro: true,
      });
      if (!seguro) return;
      DatosNegocio.borrarProducto(id);
      avisar('Borrado.');
    }
    window.App.cerrarHoja('telonNegocioForm');
    dibujar();
    pintarSeccion();
  }

  async function borrarFicha(lista, id) {
    const f = DatosNegocio.fichaPorId(lista, id);
    const usos = DatosNegocio.usosDeFicha(lista, id);
    const seguro = await Dialogos.confirmar({
      titulo: `¿Borrar a ${f.nombre}?`,
      texto: usos
        ? `Aparece en ${usos} ${usos === 1 ? 'documento' : 'documentos'}. Esos no se borran: `
          + 'quedan sin nombre, pero su plata sigue contando igual.'
        : 'No se puede deshacer.',
      aceptar: 'Borrar', peligro: true,
    });
    if (!seguro) return;
    DatosNegocio.borrarFicha(lista, id);
    window.App.cerrarHoja('telonNegocioForm');
    avisar('Borrado.');
    dibujar();
    pintarSeccion();
  }

  async function borrarCotizacion(id) {
    const seguro = await Dialogos.confirmar({
      titulo: '¿Borrar la cotización?',
      texto: 'No se puede deshacer.', aceptar: 'Borrar', peligro: true,
    });
    if (!seguro) return;
    DatosNegocio.borrarCotizacion(id);
    window.App.cerrarHoja('telonNegocioForm');
    avisar('Borrada.');
    dibujar();
    pintarSeccion();
  }

  async function borrarVariante(productoId, varianteId) {
    try {
      const seguro = await Dialogos.confirmar({
        titulo: '¿Borrar la variante?', texto: 'No se puede deshacer.',
        aceptar: 'Borrar', peligro: true,
      });
      if (!seguro) return;
      DatosNegocio.borrarVariante(productoId, varianteId);
      abrirFormulario('producto', { id: productoId });
      avisar('Borrada.');
    } catch (e) {
      avisar(e.message);
    }
  }

  async function convertirCotizacion(id) {
    const q = DatosNegocio.cotizacionPorId(id);
    const seguro = await Dialogos.confirmar({
      titulo: '¿El cliente aceptó?',
      texto: `Se va a crear una venta por ${dinero(DatosNegocio.totalDe(q))} y recién ahí `
           + 'sale la mercadería de la bodega.',
      aceptar: 'Sí, es una venta',
    });
    if (!seguro) return;
    try {
      const venta = DatosNegocio.convertirEnVenta(id);
      window.App.cerrarHoja('telonNegocioForm');
      avisar(`Venta N° ${venta.folio} creada.`);
      dibujar();
      pintarSeccion();
      mostrarComprobante(venta);
    } catch (e) {
      avisar(e.message);
    }
  }

  /* ---------------- Encender y apagar ---------------- */

  function encenderDesdeAjustes() {
    try {
      DatosNegocio.encender({
        nombre: txt('nombreNegocioNuevo'),
        rubro: txt('rubroNegocioNuevo'),
      });
      window.App.acomodarPestanaNegocio();
      dibujarEnAjustes();
      avisar('Listo. La pestaña Negocio está abajo.');
      window.App.irA('negocio');
    } catch (e) {
      avisar(e.message);
    }
  }

  async function apagarNegocio() {
    const seguro = await Dialogos.confirmar({
      titulo: '¿Apagar la pestaña Negocio?',
      texto: 'No se borra nada. Tus productos, ventas y clientes quedan guardados '
           + 'esperando por si la vuelves a encender.',
      aceptar: 'Apagar',
    });
    if (!seguro) return;
    DatosNegocio.apagar();
    window.App.cerrarHoja('telonNegocioSeccion');
    window.App.acomodarPestanaNegocio();
    dibujarEnAjustes();
    avisar('Apagada. Nada se perdió.');
  }

  function guardarAjustesDesdeLaHoja() {
    DatosNegocio.guardarAjustes({
      avisarStockBajo: marcado('aStockBajo'),
      diasCotizacion: num('aDias'),
    });
    avisar('Guardado.');
    dibujar();
  }

  /* ---------------- Los que viven en otros archivos ---------------- */

  const catalogo      = () => UiCatalogo.pantalla(cabecera);
  const estadisticas  = () => UiReportes.pantallaEstadisticas(cabecera);
  const reportes      = () => UiReportes.pantallaReportes(cabecera);
  const mostrarComprobante = venta => UiReportes.comprobante(venta);

  return {
    dibujar, dibujarEnAjustes, conectar, abrirVender, abrirSeccion,
    pintarSeccion, abrirFormulario,
    // para que catálogo y reportes puedan pedir un redibujo
    refrescar: () => { dibujar(); if (vista.seccion) pintarSeccion(); },
  };
})();
