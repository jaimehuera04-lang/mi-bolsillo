/* ============================================================
   src/ui/reportes.js
   Las tres formas en que el negocio te devuelve lo que anotaste:

     1. ESTADÍSTICAS — la pantalla con los gráficos.
     2. REPORTES — las planillas de Excel que te puedes bajar.
     3. COMPROBANTES — el papelito de cada venta, para mandarlo
        por WhatsApp o guardarlo.

   Ninguna de las tres calcula nada por su cuenta: todos los
   números salen de core/negocio.js. Acá solo se dibujan.
   ============================================================ */

const UiReportes = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = m => Dinero.formatear(m);
  const verCantidad = n => {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  };

  /* ============================================================
     1. ESTADÍSTICAS
     ============================================================ */

  function pantallaEstadisticas(cabecera) {
    const { anio, mes } = window.App.mesEnPantalla();
    const r = DatosNegocio.resumenDelMes(anio, mes);
    const desde = Fechas.aISO(anio, mes, 1);
    const hasta = Fechas.aISO(anio, mes, Fechas.diasDelMes(anio, mes));
    const top = DatosNegocio.masVendidos(desde, hasta, 6);
    const equipo = DatosNegocio.ventasAgrupadas('empleadoId', desde, hasta);
    const medios = DatosNegocio.ventasAgrupadas('medioPago', desde, hasta);

    return cabecera(`Estadísticas de ${Fechas.nombreMes(anio, mes)}`) + `
      <div class="tarjeta">
        <h3>Cómo vienen los últimos seis meses</h3>
        <p class="ayuda">Verde: lo que vendiste. Rojo: lo que gastaste.</p>
        <div class="grafico" id="graficoNegocioMeses"></div>
      </div>

      <div class="tarjeta">
        <h3>Lo que más se vende</h3>
        <div class="grafico" id="graficoNegocioTop"></div>
        ${top.length ? `<ul class="lista">${top.map((t, i) => `
          <li class="movimiento">
            <span class="emoji">${['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'][i]}</span>
            <div class="info">
              <strong>${esc(t.nombre)}</strong>
              <span class="ayuda">${verCantidad(t.unidades)} vendidos</span>
            </div>
            <div class="monto"><strong>${dinero(t.vendido)}</strong></div>
          </li>`).join('')}</ul>` : ''}
      </div>

      <div class="tarjeta">
        <h3>Los números del mes</h3>
        <div class="negocio-detalle">
          <div><span>Ventas</span><strong>${r.cuantasVentas}</strong></div>
          <div><span>Venta promedio</span><strong>${dinero(r.ticketPromedio)}</strong></div>
          <div><span>Vendiste</span><strong>${dinero(r.vendido)}</strong></div>
          <div><span>Te costó reponer</span><strong>${dinero(r.costoVendido)}</strong></div>
          <div><span>Ganancia de la venta</span><strong class="verde">${dinero(r.margen)}</strong></div>
          <div><span>Gastos del negocio</span><strong class="rojo">${dinero(r.gastado)}</strong></div>
          <div><span>Ganaste de verdad</span><strong class="${r.utilidad < 0 ? 'rojo' : 'verde'}">${dinero(r.utilidad)}</strong></div>
          <div><span>Margen</span><strong>${r.vendido ? Math.round(r.margen / r.vendido * 100) : 0}%</strong></div>
        </div>
        ${explicarMargen(r)}
      </div>

      ${medios.length ? `
        <div class="tarjeta">
          <h3>Cómo te pagan</h3>
          ${medios.map(m => barraSimple(NOMBRE_MEDIO[m.llave] || m.llave || 'Sin anotar',
                                        m.vendido, medios[0].vendido)).join('')}
        </div>` : ''}

      ${equipo.length > 1 || (equipo[0] && equipo[0].llave) ? `
        <div class="tarjeta">
          <h3>Quién vende</h3>
          ${equipo.map(e => barraSimple(
            e.llave ? DatosNegocio.nombreDeFicha('empleados', e.llave) || 'Alguien que ya no está' : 'Tú',
            e.vendido, equipo[0].vendido)).join('')}
        </div>` : ''}

      <div class="tarjeta">
        <h3>Tu bodega</h3>
        <div class="negocio-detalle">
          <div><span>Vale (a lo que te costó)</span><strong>${dinero(DatosNegocio.valorInventario())}</strong></div>
          <div><span>Productos por reponer</span><strong>${DatosNegocio.bajoMinimo().length}</strong></div>
        </div>
        <p class="ayuda">
          Esa plata está en la bodega, no en la caja. Es lo que tienes guardado en forma de mercadería.
        </p>
      </div>`;
  }

  const NOMBRE_MEDIO = {
    efectivo: '💵 Efectivo', debito: '💳 Débito', credito: '💳 Crédito',
    transferencia: '📲 Transferencia', fiado: '🕓 Fiado',
  };

  function explicarMargen(r) {
    if (!r.vendido) {
      return '<p class="ayuda">Cuando vendas algo este mes, acá vas a ver cuánto ganaste de verdad.</p>';
    }
    const margen = Math.round(r.margen / r.vendido * 100);
    if (r.utilidad < 0) {
      return `<div class="consejo" style="margin-top:12px"><strong>⚠️ Este mes el negocio perdió plata</strong>
        Vendiste ${dinero(r.vendido)}, pero entre reponer y los gastos se fueron
        ${dinero(r.costoVendido + r.gastado)}. Mira si hay un gasto que se pueda mover de mes
        o un precio que lleve mucho tiempo sin subir.</div>`;
    }
    if (margen < 20) {
      return `<div class="consejo" style="margin-top:12px"><strong>Tu margen es ${margen}%</strong>
        De cada ${dinero(1000)} que vendes, te quedan ${dinero(Math.round(margen * 10))}.
        Es apretado: cualquier gasto nuevo se te come la ganancia.</div>`;
    }
    return `<div class="consejo" style="margin-top:12px"><strong>Tu margen es ${margen}%</strong>
      De cada ${dinero(1000)} que vendes, te quedan ${dinero(Math.round(margen * 10))} antes de los gastos.</div>`;
  }

  const barraSimple = (nombre, valor, maximo) => `
    <div class="linea-progreso">
      <div class="encabezado">
        <span class="nombre">${esc(nombre)}</span>
        <span class="cifras">${dinero(valor)}</span>
      </div>
      <div class="barra"><span style="width:${maximo ? Math.round(valor / maximo * 100) : 0}%;
           background:var(--verde)"></span></div>
    </div>`;

  /**
   * Los gráficos se dibujan DESPUÉS de meter el HTML, porque
   * Graficos.* necesita el elemento ya puesto en la página para
   * poder medirlo. Por eso no van dentro del texto de arriba.
   */
  function dibujarGraficos() {
    const { anio, mes } = window.App.mesEnPantalla();

    const caja = $$$('graficoNegocioMeses');
    if (caja) {
      // Graficos.barras habla de ingresos y gastos; para el negocio,
      // "ingresos" es lo que vendiste y "gastos" lo que te costó todo.
      // Graficos.barras pide 'etiqueta', 'ingresos' y 'gastos'. Para el
      // negocio, lo verde es lo que vendiste y lo rojo es todo lo que te
      // costó: reponer más los gastos. Sin la etiqueta, debajo de cada
      // par de barras salía la palabra "undefined".
      const meses = DatosNegocio.historialMeses(anio, mes, 6).map(m => ({
        etiqueta: Fechas.NOMBRES_MES[m.mes].slice(0, 3),
        ingresos: m.vendido,
        gastos: m.costoVendido + m.gastado,
      }));
      Graficos.barras(caja, meses, { nombreVerde: 'Vendiste', nombreRojo: 'Te costó' });
    }

    const dona = $$$('graficoNegocioTop');
    if (dona) {
      const desde = Fechas.aISO(anio, mes, 1);
      const hasta = Fechas.aISO(anio, mes, Fechas.diasDelMes(anio, mes));
      const top = DatosNegocio.masVendidos(desde, hasta, 6);
      const colores = ['#10a072', '#3b7dd8', '#e8a33d', '#7c5cd6', '#e2564d', '#38a3c9'];
      Graficos.dona(dona, top.map((t, i) => ({
        nombre: t.nombre, monto: t.vendido, color: colores[i % colores.length],
      // El rótulo NO dice "Vendiste": este total es la suma de las líneas,
      // antes de los descuentos, así que puede no cuadrar con el "vendiste"
      // del mes. Dos cifras distintas con el mismo nombre confunden más de
      // lo que informan.
      })), { rotulo: 'En productos', mensajeVacio: 'Todavía no hay ventas este mes' });
    }
  }

  /* ============================================================
     2. REPORTES EN EXCEL
     ============================================================ */

  function pantallaReportes(cabecera) {
    const { anio, mes } = window.App.mesEnPantalla();
    return cabecera('Reportes') + `
      <p class="ayuda">
        Planillas de Excel de verdad, con sus columnas, sus formatos de peso y sus gráficos.
        Se arman en tu teléfono: no pasan por ningún servidor.
      </p>

      <div class="tarjeta">
        <h3>📊 El mes completo</h3>
        <p class="ayuda">${Fechas.nombreMes(anio, mes)}: ventas una por una, gastos, resumen y
           qué se vendió más, con gráficos.</p>
        <button class="boton" data-reporte="mes">Bajar el reporte del mes</button>
      </div>

      <div class="tarjeta">
        <h3>📦 Inventario</h3>
        <p class="ayuda">Todo lo que tienes, con su stock, lo que vale y qué hay que reponer.</p>
        <button class="boton secundario" data-reporte="inventario">Bajar el inventario</button>
      </div>

      <div class="tarjeta">
        <h3>🧾 Lo que te deben</h3>
        <p class="ayuda">Las ventas fiadas sin cobrar, con nombre, fecha y cuánto falta.</p>
        <button class="boton secundario" data-reporte="fiados">Bajar las cuentas por cobrar</button>
      </div>

      <div class="tarjeta">
        <h3>📅 El año</h3>
        <p class="ayuda">Los doce meses, uno por fila: vendido, costo, gastos, ganancia y caja.</p>
        <button class="boton secundario" data-reporte="anual">Bajar el año</button>
      </div>

      <div class="tarjeta">
        <h3>🙋 Clientes y proveedores</h3>
        <p class="ayuda">Tus listas de contactos, para tenerlas fuera de la app también.</p>
        <button class="boton secundario" data-reporte="gente">Bajar los contactos</button>
      </div>`;
  }

  const COL = {
    fecha:   { titulo: 'Fecha',    ancho: 12, tipo: 'fecha' },
    pesos:   ancho => ({ ancho: ancho || 14, tipo: 'pesos' }),
  };

  function bajarReporte(cual) {
    const { anio, mes } = window.App.mesEnPantalla();
    const p = DatosNegocio.perfil();
    const marca = String(p.nombre || 'negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    const armadores = {
      mes:        () => [hojasDelMes(anio, mes), `${marca}-${Fechas.claveMes(anio, mes)}.xlsx`],
      inventario: () => [[hojaInventario()], `${marca}-inventario.xlsx`],
      fiados:     () => [[hojaFiados()], `${marca}-por-cobrar.xlsx`],
      anual:      () => [[hojaAnual(anio)], `${marca}-${anio}.xlsx`],
      gente:      () => [hojasDeGente(), `${marca}-contactos.xlsx`],
    };
    const [hojas, nombre] = armadores[cual]();
    entregar(hojas, nombre);
  }

  function entregar(hojas, nombre) {
    try {
      descargar(Excel.crear(hojas), nombre);
      window.App.avisar('Planilla lista.');
    } catch (e) {
      window.App.avisar('No se pudo armar la planilla.');
    }
  }

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------- Las hojas ---------------- */

  function hojasDelMes(anio, mes) {
    const r = DatosNegocio.resumenDelMes(anio, mes);
    const ventas = DatosNegocio.ventasDelMes(anio, mes);
    const compras = DatosNegocio.comprasDelMes(anio, mes);
    const desde = Fechas.aISO(anio, mes, 1);
    const hasta = Fechas.aISO(anio, mes, Fechas.diasDelMes(anio, mes));
    const top = DatosNegocio.masVendidos(desde, hasta, 15);

    const resumen = {
      nombre: 'Resumen',
      columnas: [{ titulo: '', ancho: 34 }, { titulo: '', ancho: 18, tipo: 'pesos' }],
      sinEncabezado: true, sinFiltro: true, sinCuadricula: true,
      filas: [
        [[DatosNegocio.perfil().nombre || 'Mi negocio', 'titulo'], ''],
        [[Fechas.nombreMes(anio, mes), 'subtitulo'], ''],
        ['', ''],
        ['Ventas del mes', [r.cuantasVentas, 'numero']],
        ['Vendiste', r.vendido],
        ['Te costó reponer lo vendido', r.costoVendido],
        ['Ganancia de la venta', r.margen],
        ['Gastos del negocio', r.gastado],
        [['Ganaste de verdad', 'destacado'], [r.utilidad, 'pesosGrande']],
        ['', ''],
        ['Entró a la caja', r.cobrado],
        ['Te deben todavía', r.porCobrar],
        ['Te pasaste a tu bolsillo', r.retirado],
        [['Queda en caja', 'destacado'], [r.caja, 'pesosGrande']],
        ['', ''],
        ['Venta promedio', r.ticketPromedio],
        ['Lo que vale la bodega', DatosNegocio.valorInventario()],
        ['', ''],
        [['La plata del negocio no es tu plata: solo lo que aparece en '
          + '"te pasaste a tu bolsillo" entró a tus finanzas personales.', 'parrafo'], ''],
      ],
    };

    const hojaVentas = {
      nombre: 'Ventas',
      columnas: [
        { titulo: 'N°', ancho: 7, tipo: 'numero' },
        COL.fecha,
        { titulo: 'Cliente', ancho: 22 },
        { titulo: 'Atendió', ancho: 16 },
        { titulo: 'Productos', ancho: 34 },
        { titulo: 'Total', ...COL.pesos() },
        { titulo: 'Pagado', ...COL.pesos() },
        { titulo: 'Debe', ...COL.pesos() },
        { titulo: 'Cómo pagó', ancho: 16 },
        { titulo: 'Estado', ancho: 12 },
      ],
      filas: ventas.map(v => [
        v.folio, v.fecha,
        DatosNegocio.nombreDeFicha('clientes', v.clienteId) || 'Cliente de paso',
        DatosNegocio.nombreDeFicha('empleados', v.empleadoId) || '',
        v.lineas.map(l => `${verCantidad(l.cantidad)}× ${l.nombre}`).join(', '),
        DatosNegocio.totalDe(v), v.pagado, DatosNegocio.saldoPendienteDe(v),
        NOMBRE_MEDIO[v.medioPago] || v.medioPago || '',
        v.estado,
      ]),
    };

    const hojaGastos = {
      nombre: 'Gastos',
      columnas: [
        COL.fecha,
        { titulo: 'Qué fue', ancho: 32 },
        { titulo: 'Proveedor', ancho: 22 },
        { titulo: 'Tipo', ancho: 16 },
        { titulo: 'Monto', ...COL.pesos() },
      ],
      filas: compras.map(c => [
        c.fecha, c.descripcion || 'Gasto del negocio',
        DatosNegocio.nombreDeFicha('proveedores', c.proveedorId) || '',
        c.categoria || '', c.monto,
      ]),
    };

    const hojaTop = {
      nombre: 'Lo mas vendido',
      columnas: [
        { titulo: 'Producto', ancho: 32 },
        { titulo: 'Unidades', ancho: 12, tipo: 'numero' },
        { titulo: 'Vendido', ...COL.pesos() },
      ],
      filas: top.map(t => [t.nombre, t.unidades, t.vendido]),
      graficos: top.length ? [{
        tipo: 'dona',
        titulo: 'Lo que más se vende',
        categorias: `A2:A${top.length + 1}`,
        valores: `C2:C${top.length + 1}`,
        cacheCategorias: top.map(t => t.nombre),
        cacheValores: top.map(t => t.vendido),
        colores: ['#10a072', '#3b7dd8', '#e8a33d', '#7c5cd6', '#e2564d', '#38a3c9',
                  '#c455a5', '#43b5a0', '#ef7f4e', '#5b6b7c'],
        ancla: { columna: 4, fila: 1 }, ancho: 10, alto: 14,
      }] : [],
    };

    return [resumen, hojaVentas, hojaGastos, hojaTop];
  }

  function hojaInventario() {
    const productos = DatosNegocio.productos(true);
    const filas = [];
    productos.forEach(p => {
      if (p.variantes && p.variantes.length) {
        p.variantes.forEach(v => filas.push([
          p.nombre, v.nombre, v.sku || p.sku || '', p.categoria || '',
          DatosNegocio.stockDe(p.id, v.id), p.stockMinimo,
          v.precio, v.costo,
          Math.round(DatosNegocio.stockDe(p.id, v.id) * v.costo),
          p.activo === false ? 'archivado' : 'activo',
        ]));
      } else {
        const hay = DatosNegocio.stockTotalDe(p);
        filas.push([
          p.nombre, '', p.sku || '', p.categoria || '',
          p.controlaStock === false ? '' : hay, p.stockMinimo,
          p.precio, p.costo,
          p.controlaStock === false ? 0 : Math.round(hay * p.costo),
          p.activo === false ? 'archivado' : (p.controlaStock === false ? 'servicio' : 'activo'),
        ]);
      }
    });

    return {
      nombre: 'Inventario',
      columnas: [
        { titulo: 'Producto', ancho: 28 },
        { titulo: 'Variante', ancho: 14 },
        { titulo: 'Código', ancho: 14 },
        { titulo: 'Categoría', ancho: 16 },
        { titulo: 'Quedan', ancho: 10, tipo: 'numero' },
        { titulo: 'Avisar en', ancho: 10, tipo: 'numero' },
        { titulo: 'Precio', ...COL.pesos(12) },
        { titulo: 'Costo', ...COL.pesos(12) },
        { titulo: 'Vale', ...COL.pesos() },
        { titulo: 'Estado', ancho: 12 },
      ],
      filas,
    };
  }

  function hojaFiados() {
    const fiados = DatosNegocio.fiadosPendientes();
    return {
      nombre: 'Por cobrar',
      columnas: [
        { titulo: 'N°', ancho: 7, tipo: 'numero' },
        COL.fecha,
        { titulo: 'Cliente', ancho: 24 },
        { titulo: 'Teléfono', ancho: 18 },
        { titulo: 'Total', ...COL.pesos() },
        { titulo: 'Abonado', ...COL.pesos() },
        { titulo: 'Debe', ...COL.pesos() },
        { titulo: 'Días', ancho: 8, tipo: 'numero' },
      ],
      filas: fiados.map(v => {
        const c = DatosNegocio.fichaPorId('clientes', v.clienteId);
        const dias = Math.round((Fechas.aFecha(Fechas.hoyISO()) - Fechas.aFecha(v.fecha)) / 86400000);
        return [
          v.folio, v.fecha, c ? c.nombre : 'Cliente de paso', c ? c.telefono : '',
          DatosNegocio.totalDe(v), v.pagado, DatosNegocio.saldoPendienteDe(v), dias,
        ];
      }),
    };
  }

  function hojaAnual(anio) {
    const meses = [];
    for (let m = 0; m < 12; m++) meses.push(DatosNegocio.resumenDelMes(anio, m));
    return {
      nombre: String(anio),
      columnas: [
        { titulo: 'Mes', ancho: 14 },
        { titulo: 'Ventas', ancho: 9, tipo: 'numero' },
        { titulo: 'Vendido', ...COL.pesos() },
        { titulo: 'Costo', ...COL.pesos() },
        { titulo: 'Ganancia', ...COL.pesos() },
        { titulo: 'Gastos', ...COL.pesos() },
        { titulo: 'Utilidad', ...COL.pesos() },
        { titulo: 'Caja', ...COL.pesos() },
      ],
      filas: meses.map(m => [
        Fechas.NOMBRES_MES[m.mes], m.cuantasVentas, m.vendido,
        m.costoVendido, m.margen, m.gastado, m.utilidad, m.caja,
      ]),
      graficos: [{
        tipo: 'barras',
        titulo: `El año ${anio}`,
        categorias: 'A2:A13',
        series: [
          { ref: 'C2:C13', nombreRef: 'C1', nombre: 'Vendido', color: '#10a072',
            cache: meses.map(m => m.vendido) },
          { ref: 'G2:G13', nombreRef: 'G1', nombre: 'Utilidad', color: '#3b7dd8',
            cache: meses.map(m => m.utilidad) },
        ],
        cacheCategorias: meses.map(m => Fechas.NOMBRES_MES[m.mes]),
        ancla: { columna: 9, fila: 1 }, ancho: 12, alto: 15,
      }],
    };
  }

  function hojasDeGente() {
    const ficha = (lista, nombre, extra) => ({
      nombre,
      columnas: [
        { titulo: 'Nombre', ancho: 26 },
        { titulo: 'Teléfono', ancho: 18 },
        { titulo: 'RUT', ancho: 14 },
        { titulo: 'Correo', ancho: 26 },
        { titulo: 'Dirección', ancho: 30 },
        ...(extra || []),
      ],
      filas: (lista === 'empleados' ? DatosNegocio.empleados(true) : DatosNegocio[lista]())
        .map(f => [
          f.nombre, f.telefono, f.rut, f.correo, f.direccion,
          ...(lista === 'empleados' ? [f.rol || '', f.sueldo || 0] : []),
          ...(lista === 'clientes' ? [DatosNegocio.usosDeFicha('clientes', f.id)] : []),
        ]),
    });

    return [
      ficha('clientes', 'Clientes', [{ titulo: 'Compras', ancho: 10, tipo: 'numero' }]),
      ficha('proveedores', 'Proveedores'),
      ficha('empleados', 'Equipo', [
        { titulo: 'Rol', ancho: 18 },
        { titulo: 'Sueldo', ...COL.pesos() },
      ]),
    ];
  }

  /* ============================================================
     3. EL COMPROBANTE
     ============================================================ */

  let ventaEnPantalla = null;

  function comprobante(venta) {
    ventaEnPantalla = venta;
    const caja = $$$('negocioComprobante');
    if (!caja) return;
    caja.innerHTML = dibujarComprobante(venta);
    window.App.abrirHoja('telonNegocioComprobante');
  }

  function dibujarComprobante(v) {
    const p = DatosNegocio.perfil();
    const cliente = DatosNegocio.fichaPorId('clientes', v.clienteId);
    const bruto = DatosNegocio.sumaDeLineas(v.lineas);
    const total = DatosNegocio.totalDe(v);
    const debe = DatosNegocio.saldoPendienteDe(v);

    return `
      <div class="tarjeta-titulo">
        <h2>Comprobante</h2>
        <button class="boton fantasma chico" data-cerrar-negocio="telonNegocioComprobante">Cerrar</button>
      </div>

      <div class="comprobante">
        <div class="comprobante-cabecera">
          <span class="emoji">${esc(p.emoji || '🏪')}</span>
          <strong>${esc(p.nombre || 'Mi negocio')}</strong>
          ${p.rut ? `<span>RUT ${esc(p.rut)}</span>` : ''}
          ${p.direccion ? `<span>${esc(p.direccion)}</span>` : ''}
          ${p.telefono ? `<span>${esc(p.telefono)}</span>` : ''}
        </div>

        <div class="comprobante-datos">
          <span>Comprobante N° ${v.folio}</span>
          <span>${Fechas.fechaLegible(v.fecha)}</span>
          ${cliente ? `<span>Para: ${esc(cliente.nombre)}</span>` : ''}
        </div>

        <table class="comprobante-tabla">
          ${v.lineas.map(l => `
            <tr>
              <td>${verCantidad(l.cantidad)}×</td>
              <td>${esc(l.nombre)}</td>
              <td class="derecha">${dinero(DatosNegocio.totalDeLinea(l))}</td>
            </tr>`).join('')}
          ${v.descuento > 0 ? `
            <tr class="suave"><td></td><td>Suma</td><td class="derecha">${dinero(bruto)}</td></tr>
            <tr class="suave"><td></td><td>Descuento</td><td class="derecha">−${dinero(v.descuento)}</td></tr>` : ''}
          <tr class="total"><td></td><td>Total</td><td class="derecha">${dinero(total)}</td></tr>
          ${debe > 0 ? `
            <tr class="suave"><td></td><td>Abonado</td><td class="derecha">${dinero(v.pagado)}</td></tr>
            <tr class="pendiente"><td></td><td>Queda debiendo</td><td class="derecha">${dinero(debe)}</td></tr>` : ''}
        </table>

        <p class="comprobante-pie">
          ${debe > 0 ? 'Documento no válido como boleta. ' : '¡Gracias por tu compra! '}
          ${esc(p.mensaje || '')}
        </p>
      </div>

      <div class="fila-botones" style="margin-top:16px">
        <button class="boton secundario" data-comprobante="copiar">📋 Copiar para WhatsApp</button>
        <button class="boton secundario" data-comprobante="compartir">📤 Compartir</button>
      </div>
      <button class="boton fantasma" data-comprobante="guardar" style="margin-top:8px">
        💾 Guardar como archivo
      </button>`;
  }

  /** El mismo comprobante, pero en texto plano para pegar en WhatsApp. */
  function comoTexto(v) {
    const p = DatosNegocio.perfil();
    const cliente = DatosNegocio.fichaPorId('clientes', v.clienteId);
    const debe = DatosNegocio.saldoPendienteDe(v);
    const lineas = [
      `*${p.nombre || 'Mi negocio'}*`,
      `Comprobante N° ${v.folio} — ${v.fecha}`,
      cliente ? `Para: ${cliente.nombre}` : '',
      '',
      ...v.lineas.map(l => `${verCantidad(l.cantidad)}× ${l.nombre}   ${dinero(DatosNegocio.totalDeLinea(l))}`),
      '',
      v.descuento > 0 ? `Descuento: −${dinero(v.descuento)}` : '',
      `*Total: ${dinero(DatosNegocio.totalDe(v))}*`,
      debe > 0 ? `Abonado: ${dinero(v.pagado)}` : '',
      debe > 0 ? `*Queda debiendo: ${dinero(debe)}*` : '',
      '',
      p.telefono || '',
      p.mensaje || '',
    ];
    return lineas.filter(l => l !== '').join('\n');
  }

  async function accionComprobante(cual) {
    const v = ventaEnPantalla;
    if (!v) return;
    const texto = comoTexto(v);

    if (cual === 'copiar') {
      try {
        await navigator.clipboard.writeText(texto);
        window.App.avisar('Copiado. Pégalo en WhatsApp.');
      } catch (e) {
        window.App.avisar('Este navegador no nos deja copiar. Toma una captura.');
      }
      return;
    }

    if (cual === 'compartir') {
      if (navigator.share) {
        try {
          await navigator.share({ title: `Comprobante N° ${v.folio}`, text: texto });
        } catch (e) { /* si cancela, no pasa nada */ }
      } else {
        window.App.avisar('Este aparato no tiene el botón de compartir. Usa "Copiar".');
      }
      return;
    }

    if (cual === 'guardar') {
      const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
      descargar(blob, `comprobante-${v.folio}.txt`);
      window.App.avisar('Guardado.');
    }
  }

  /* ---------------- Eventos propios ---------------- */

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-reporte], [data-comprobante]');
    if (!t) return;
    if (t.dataset.reporte) return bajarReporte(t.dataset.reporte);
    if (t.dataset.comprobante) return accionComprobante(t.dataset.comprobante);
  });

  return {
    pantallaEstadisticas, dibujarGraficos, pantallaReportes,
    comprobante, comoTexto, bajarReporte,
  };
})();
