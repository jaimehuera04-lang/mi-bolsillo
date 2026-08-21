/* ============================================================
   app.js - Une todo: escucha los toques del usuario y decide
   que se dibuja en pantalla.
   Orden del archivo:
     1. Estado de la pantalla     5. Metas
     2. Utilidades                6. Aprender
     3. Navegacion                7. Ajustes
     4. Inicio (dashboard)        8. Tutorial, instalacion, arranque
   ============================================================ */

(() => {
  'use strict';

  /* ---------------- 1. Estado de la pantalla ---------------- */
  const hoy = new Date();
  const vista = {
    anio: hoy.getFullYear(),
    mes: hoy.getMonth(),              // 0 = enero
    pantalla: 'inicio',
    tendencia: 'barras',              // 'barras' o 'linea'
    filtroMovimientos: 'todos',
    // formulario de movimiento
    tipo: 'gasto',
    categoria: 'comida',
  };

  /* ---------------- 2. Utilidades ---------------- */
  const $  = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const $$$ = id => document.getElementById(id);
  const dinero = m => Datos.formatearDinero(m);

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let temporizadorMensaje;
  function avisar(texto) {
    const caja = $$$('mensajito');
    caja.textContent = texto;
    caja.classList.add('visible');
    clearTimeout(temporizadorMensaje);
    temporizadorMensaje = setTimeout(() => caja.classList.remove('visible'), 2600);
  }

  const abrirHoja  = id => $$$(id).classList.add('abierto');
  const cerrarHoja = id => $$$(id).classList.remove('abierto');

  const esMesActual = () =>
    vista.anio === hoy.getFullYear() && vista.mes === hoy.getMonth();

  /* ---------------- 3. Navegacion ---------------- */
  function irA(nombre) {
    vista.pantalla = nombre;
    $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === `pantalla-${nombre}`));
    $$('.navegacion button').forEach(b => b.classList.toggle('activa', b.dataset.pantalla === nombre));
    // el boton + solo tiene sentido en las pantallas de plata
    $$$('botonAgregar').style.display = ['inicio', 'movimientos'].includes(nombre) ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    dibujar();
  }

  function cambiarMes(delta) {
    const f = new Date(vista.anio, vista.mes + delta, 1);
    vista.anio = f.getFullYear();
    vista.mes = f.getMonth();
    dibujar();
  }

  /** Redibuja lo que este visible. */
  function dibujar() {
    $$$('etiquetaMes').textContent = Datos.nombreMes(vista.anio, vista.mes);
    // no dejamos avanzar mas alla del mes actual
    const futuro = new Date(vista.anio, vista.mes + 1, 1) > new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    $$$('mesSiguiente').style.visibility = futuro ? 'hidden' : 'visible';

    if (vista.pantalla === 'inicio')       dibujarInicio();
    if (vista.pantalla === 'movimientos')  dibujarMovimientos();
    if (vista.pantalla === 'metas')        dibujarMetas();
    if (vista.pantalla === 'ajustes')      dibujarEditorTopes();
  }

  /* ---------------- 4. Inicio (dashboard) ---------------- */
  function dibujarInicio() {
    const r = Datos.resumenDelMes(vista.anio, vista.mes);

    const saldo = $$$('saldoMes');
    saldo.textContent = dinero(r.saldo);
    saldo.className = `monto ${r.saldo < 0 ? 'negativo' : 'positivo'}`;
    $$$('totalIngresos').textContent = dinero(r.ingresos);
    $$$('totalGastos').textContent = dinero(r.gastos);

    // Tasa de ahorro
    const tasa = Math.max(0, r.tasaAhorro);
    $$$('barraTasaAhorro').style.width = `${Math.min(100, tasa)}%`;
    $$$('barraTasaAhorro').style.background =
      tasa >= 20 ? 'var(--verde)' : tasa >= 10 ? 'var(--amarillo)' : 'var(--rojo)';
    $$$('textoTasaAhorro').textContent = r.ingresos > 0 ? `${r.tasaAhorro}%` : 'sin ingresos anotados';

    // Consejos automaticos
    const consejos = Consejos.sugerir(vista.anio, vista.mes);
    $$$('zonaConsejos').innerHTML = consejos.map(c => `
      <div class="consejo ${c.tipo === 'alerta' ? 'aviso' : ''}" style="margin-bottom:14px">
        <strong>${esc(c.titulo)}</strong>${esc(c.texto)}
      </div>`).join('');

    // Graficos
    Graficos.dona($$$('graficoDona'), Datos.gastosPorCategoria(vista.anio, vista.mes), {
      // el mensaje cambia segun si el mes esta vacio o si de verdad no gastaste nada
      mensajeVacio: r.cantidad === 0
        ? 'Este mes todavia no tiene nada anotado'
        : 'Sin gastos este mes 🎉',
    });
    dibujarTendencia();
    Graficos.reglaVisual($$$('graficoRegla'), Datos.reparto503020(vista.anio, vista.mes));

    dibujarTopes();
    $$$('pildoraDia').textContent = ' ' + Consejos.pildoraDelDia();
  }

  function dibujarTendencia() {
    if (vista.tendencia === 'barras') {
      $$$('tituloTendencia').textContent = 'Mes a mes';
      Graficos.barras($$$('graficoTendencia'), Datos.historialMeses(vista.anio, vista.mes, 6));
      $$$('pieTendencia').textContent =
        'Verde es lo que entro, rojo lo que salio. Si el rojo supera al verde, ese mes gastaste mas de lo que ganaste.';
    } else {
      $$$('tituloTendencia').textContent = 'Mi saldo dia a dia';
      Graficos.linea($$$('graficoTendencia'), Datos.saldoDiario(vista.anio, vista.mes));
      $$$('pieTendencia').textContent =
        'Como te fue quedando la plata a lo largo del mes. Si la curva cruza hacia abajo la linea punteada, ese dia entraste en numeros rojos.';
    }
  }

  function dibujarTopes() {
    const topes = Datos.estadoPresupuestos(vista.anio, vista.mes);
    $$$('tarjetaTopes').style.display = topes.length ? '' : 'none';
    if (!topes.length) return;

    $$$('listaTopes').innerHTML = topes.map(t => `
      <div class="linea-progreso">
        <div class="encabezado">
          <span class="nombre">${t.emoji} ${esc(t.nombre)}</span>
          <span class="cifras" style="${t.excedido ? 'color:var(--rojo);font-weight:700' : ''}">
            ${esc(dinero(t.usado))} de ${esc(dinero(t.tope))}
          </span>
        </div>
        <div class="barra">
          <span style="width:${t.pct}%; background:${
            t.excedido ? 'var(--rojo)' : t.pct > 80 ? 'var(--amarillo)' : t.color}"></span>
        </div>
        ${t.excedido
          ? `<p class="ayuda" style="color:var(--rojo)">Te pasaste por ${esc(dinero(t.usado - t.tope))}.</p>`
          : `<p class="ayuda">Te quedan ${esc(dinero(t.tope - t.usado))}.</p>`}
      </div>`).join('');
  }

  /* ---------------- 5. Movimientos ---------------- */
  function dibujarMovimientos() {
    let movs = Datos.movimientosDelMes(vista.anio, vista.mes);
    if (vista.filtroMovimientos !== 'todos') {
      movs = movs.filter(m => m.tipo === vista.filtroMovimientos);
    }

    if (!movs.length) {
      $$$('listaMovimientos').innerHTML = `
        <div class="vacio">
          <span class="emoji-grande">📝</span>
          <p><strong>Todavia no hay nada anotado</strong></p>
          <p class="ayuda">Toca el boton + de abajo a la derecha. Anotar un gasto toma cinco segundos
          y es lo unico que necesitas hacer todos los dias.</p>
        </div>`;
      return;
    }

    // agrupamos por dia para que se lea mejor
    const porDia = new Map();
    for (const m of movs) {
      if (!porDia.has(m.fecha)) porDia.set(m.fecha, []);
      porDia.get(m.fecha).push(m);
    }

    let html = '';
    for (const [fecha, delDia] of porDia) {
      const totalDia = delDia.reduce((a, m) => a + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
      html += `<div class="fecha-grupo">
                 ${esc(Datos.fechaLegible(fecha))}
                 <span style="float:right; text-transform:none; letter-spacing:0">
                   ${totalDia >= 0 ? '+' : ''}${esc(dinero(totalDia))}
                 </span>
               </div>
               <ul class="lista">`;
      for (const m of delDia) {
        const cat = Datos.categoriaPorId(m.categoria);
        html += `
          <li class="movimiento">
            <span class="emoji">${cat.emoji}</span>
            <span class="info">
              <span class="nombre">${esc(m.nota || cat.nombre)}</span>
              <span class="detalle">${esc(cat.nombre)}</span>
            </span>
            <span class="monto ${m.tipo}">${m.tipo === 'ingreso' ? '+' : '-'}${esc(dinero(m.monto))}</span>
            <button class="borrar" data-borrar="${m.id}" aria-label="Borrar">✕</button>
          </li>`;
      }
      html += '</ul>';
    }
    $$$('listaMovimientos').innerHTML = html;
  }

  /* ---------------- 6. Metas ---------------- */
  function dibujarMetas() {
    const metas = Datos.obtener().metas;
    if (!metas.length) {
      $$$('listaMetas').innerHTML = `
        <div class="tarjeta vacio">
          <span class="emoji-grande">🎯</span>
          <p><strong>Aun no tienes metas</strong></p>
          <p class="ayuda">Una buena primera meta es el fondo de emergencia: un mes de tus gastos
          basicos guardado para imprevistos.</p>
        </div>`;
      return;
    }

    $$$('listaMetas').innerHTML = metas.map(m => {
      const pct = Math.min(100, (m.ahorrado / m.objetivo) * 100);
      const falta = Math.max(0, m.objetivo - m.ahorrado);
      const lista = pct >= 100;

      // Si hay fecha limite, calculamos cuanto habria que guardar al mes
      let ritmo = '';
      if (m.fechaLimite && !lista) {
        const meses = Math.max(1, Math.round(
          (new Date(m.fechaLimite) - new Date()) / (1000 * 60 * 60 * 24 * 30.4)));
        ritmo = `<p class="ayuda">Para llegar a tiempo necesitas guardar
                 <strong>${esc(dinero(Math.ceil(falta / meses)))}</strong> al mes
                 (quedan ${meses} ${meses === 1 ? 'mes' : 'meses'}).</p>`;
      }

      return `
        <div class="tarjeta">
          <div class="meta">
            <span class="emoji">${m.emoji}</span>
            <div class="cuerpo">
              <div class="tarjeta-titulo" style="margin-bottom:8px">
                <h3>${esc(m.nombre)}</h3>
                <button class="borrar" data-borrar-meta="${m.id}" aria-label="Borrar meta">✕</button>
              </div>
              <div class="barra">
                <span style="width:${pct}%; background:${lista ? 'var(--verde)' : 'var(--azul)'}"></span>
              </div>
              <div class="encabezado" style="display:flex; justify-content:space-between; font-size:13px; margin-top:6px">
                <strong>${esc(dinero(m.ahorrado))}</strong>
                <span style="color:var(--texto-suave)">de ${esc(dinero(m.objetivo))} · ${Math.round(pct)}%</span>
              </div>
              ${lista
                ? '<p class="ayuda" style="color:var(--verde); font-weight:600">🎉 Meta cumplida. Disfrutalo, te lo ganaste.</p>'
                : `<p class="ayuda">Te faltan ${esc(dinero(falta))}.</p>${ritmo}`}
              <div class="acciones">
                <button class="boton chico" data-abonar="${m.id}">+ Abonar</button>
                <button class="boton chico secundario" data-retirar="${m.id}">- Retirar</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ---------------- 7. Aprender ---------------- */
  function dibujarTecnicas() {
    $$$('listaTecnicas').innerHTML = Consejos.TECNICAS.map(t => `
      <details class="tecnica">
        <summary>
          <span class="emoji">${t.emoji}</span>
          <span>
            ${esc(t.titulo)}
            <div class="ayuda" style="font-weight:400; margin:2px 0 0">${esc(t.resumen)}</div>
          </span>
          <span class="etiqueta-nivel">${t.nivel}</span>
          <span class="flecha">&#9654;</span>
        </summary>
        <div class="cuerpo">${t.cuerpo}</div>
      </details>`).join('');
  }

  function calcularAhorro() {
    const mensual = Number($$$('calcMonto').value) || 0;
    const anios = Math.max(1, Number($$$('calcAnios').value) || 1);
    const tasaAnual = Number($$$('calcTasa').value) || 0;
    const meses = anios * 12;
    const i = tasaAnual / 100 / 12;

    const aportado = mensual * meses;
    // valor futuro de una serie de pagos iguales
    const total = i === 0 ? aportado : mensual * ((Math.pow(1 + i, meses) - 1) / i);
    const intereses = total - aportado;

    $$$('resultadoCalc').innerHTML = `
      <strong>En ${anios} ${anios === 1 ? 'ano' : 'anos'} juntarias ${esc(dinero(Math.round(total)))}</strong>
      De eso, ${esc(dinero(aportado))} salieron de tu bolsillo y
      ${esc(dinero(Math.round(intereses)))} los generaron los intereses.
      ${intereses > aportado * 0.25
        ? ' Fijate como el tiempo empieza a hacer la pega por ti.'
        : ' Prueba subir los anos y mira como cambia: el tiempo pesa mas que el monto.'}`;
  }

  /* ---------------- 8. Ajustes ---------------- */
  function cargarAjustesEnFormulario() {
    const a = Datos.obtener().ajustes;
    $$$('campoCorreoAjustes').value = a.correo || '';
    $$$('campoNombre').value = a.nombre || '';
    $$$('campoMoneda').value = a.moneda || 'CLP';
    $$$('campoIngresoEsperado').value = a.ingresoEsperado || '';
  }

  function dibujarEditorTopes() {
    const presupuestos = Datos.obtener().presupuestos;
    const ingreso = Number(Datos.obtener().ajustes.ingresoEsperado) || 0;

    $$$('editorTopes').innerHTML = Datos.CATEGORIAS_GASTO
      .filter(c => c.id !== 'ahorro')
      .map(c => {
        // sugerencia simple: reparte el 50% del ingreso entre las necesidades
        const sugerido = ingreso ? Math.round(ingreso * (c.tipo === 'necesidad' ? 0.09 : 0.05) / 1000) * 1000 : 0;
        return `
          <label for="tope-${c.id}" style="display:flex; align-items:center; gap:8px">
            <span style="font-size:18px">${c.emoji}</span> ${esc(c.nombre)}
          </label>
          <input type="number" id="tope-${c.id}" data-tope="${c.id}" inputmode="numeric" min="0" step="1000"
                 value="${presupuestos[c.id] || ''}"
                 placeholder="${sugerido ? 'sugerido: ' + sugerido.toLocaleString('es-CL') : 'sin tope'}">`;
      }).join('');
  }

  function guardarTopesDesdeFormulario() {
    $$('[data-tope]').forEach(inp => Datos.fijarPresupuesto(inp.dataset.tope, inp.value));
  }

  /* ---------------- 9. Formulario de movimiento ---------------- */
  function dibujarCategorias() {
    const lista = vista.tipo === 'gasto' ? Datos.CATEGORIAS_GASTO : Datos.CATEGORIAS_INGRESO;
    if (!lista.some(c => c.id === vista.categoria)) vista.categoria = lista[0].id;

    $$$('rejillaCategorias').innerHTML = lista.map(c => `
      <button type="button" data-categoria="${c.id}" class="${c.id === vista.categoria ? 'activa' : ''}">
        <span class="emoji">${c.emoji}</span>
        <span>${esc(c.nombre)}</span>
      </button>`).join('');
  }

  function abrirFormularioMovimiento() {
    $$$('campoMonto').value = '';
    $$$('campoNota').value = '';
    // si estas mirando un mes pasado, la fecha por defecto es el dia 1 de ese mes
    $$$('campoFecha').value = esMesActual()
      ? Datos.hoyISO()
      : `${vista.anio}-${String(vista.mes + 1).padStart(2, '0')}-01`;
    $$$('campoFecha').max = Datos.hoyISO();
    dibujarCategorias();
    abrirHoja('telonMovimiento');
    setTimeout(() => $$$('campoMonto').focus(), 260);
  }

  function fijarTipo(tipo) {
    vista.tipo = tipo;
    $$$('tipoGasto').classList.toggle('activo', tipo === 'gasto');
    $$$('tipoIngreso').classList.toggle('activo', tipo === 'ingreso');
    $$$('tituloHojaMovimiento').textContent =
      tipo === 'gasto' ? 'Anotar un gasto' : 'Anotar un ingreso';
    dibujarCategorias();
  }

  /* ---------------- 10. Registro ----------------
     No es una cuenta: no hay servidor ni contrasena. Solo pedimos
     el correo una vez, lo guardamos en este dispositivo y con eso
     personalizamos la app. Quien se registra entra directo, sin
     pasar por el tutorial.                                       */

  function mostrarRegistro() {
    $$$('bienvenida').hidden = false;
    // el foco automatico molesta en celular (abre el teclado de golpe),
    // asi que solo lo hacemos en pantallas grandes
    if (window.innerWidth >= 700) setTimeout(() => $$$('campoCorreo').focus(), 300);
  }

  function ocultarRegistro() {
    $$$('bienvenida').hidden = true;
  }

  function mostrarErrorCorreo(mensaje) {
    const caja = $$$('errorCorreo');
    caja.textContent = mensaje;
    caja.hidden = !mensaje;
    $$$('campoCorreo').classList.toggle('con-error', Boolean(mensaje));
  }

  function enviarRegistro(evento) {
    evento.preventDefault();
    const correo = $$$('campoCorreo').value.trim();

    if (!correo) {
      mostrarErrorCorreo('⚠️ Escribe tu correo para continuar');
      $$$('campoCorreo').focus();
      return;
    }
    if (!Datos.correoValido(correo)) {
      mostrarErrorCorreo('⚠️ Ese correo no se ve bien. Revisa que tenga @ y un punto.');
      $$$('campoCorreo').focus();
      return;
    }

    mostrarErrorCorreo('');
    Datos.registrar(correo);      // esto tambien marca el tutorial como visto
    ocultarRegistro();
    actualizarSaludo();
    cargarAjustesEnFormulario();

    const nombre = Datos.obtener().ajustes.nombre;
    avisar(nombre ? `Bienvenido, ${nombre} 👋` : 'Bienvenido 👋');
  }

  /* ---------------- 11. Tutorial ---------------- */
  const PASOS = [
    {
      titulo: 'Bienvenido a Mi Bolsillo 👋',
      cuerpo: `<p>Esta app hace tres cosas:</p>
        <ul>
          <li><strong>Anota</strong> lo que entra y lo que sale.</li>
          <li><strong>Te lo muestra</strong> en graficos faciles de leer.</li>
          <li><strong>Te ensena</strong> tecnicas de ahorro y te dice cual te conviene segun tus numeros.</li>
        </ul>
        <p>Todo se guarda solo en tu dispositivo. No hay cuenta, ni clave, ni nadie mirando.</p>`,
    },
    {
      titulo: 'Lo unico que tienes que hacer 📝',
      cuerpo: `<p>Toca el boton <strong>+</strong> verde y anota lo que gastaste. Toma cinco segundos.</p>
        <p>No intentes anotar el mes completo de memoria el primer dia. Anota lo de <em>hoy</em>,
        y manana lo de manana. En una semana ya vas a ver patrones que hoy no ves.</p>`,
    },
    {
      titulo: 'Lee tus graficos 📊',
      cuerpo: `<ul>
          <li><strong>La dona</strong> te dice en que se te va la plata. La porcion mas grande es donde tienes mas que ganar si quieres recortar.</li>
          <li><strong>Las barras</strong> comparan mes con mes. Ahi se ve si vas mejorando.</li>
          <li><strong>Tu reparto</strong> compara tus gastos con la regla 50/30/20, un estandar simple y bastante util.</li>
        </ul>`,
    },
    {
      titulo: 'Ponte una meta 🎯',
      cuerpo: `<p>Ahorrar "por si acaso" cuesta. Ahorrar para algo con nombre cuesta mucho menos.</p>
        <p>Si no sabes por donde partir, la mejor primera meta casi siempre es la misma:
        <strong>un fondo de emergencia</strong> equivalente a un mes de tus gastos basicos.
        Es lo que evita que un imprevisto se convierta en deuda.</p>
        <p>En la pestana <strong>Aprender</strong> hay once tecnicas explicadas en simple. No las leas todas
        de una: elige una y pruebala un mes.</p>`,
    },
  ];
  let pasoActual = 0;

  function mostrarPaso() {
    const p = PASOS[pasoActual];
    $$$('tutorialTitulo').textContent = p.titulo;
    $$$('tutorialCuerpo').innerHTML = p.cuerpo;
    $$$('tutorialAtras').style.visibility = pasoActual === 0 ? 'hidden' : 'visible';
    $$$('tutorialSiguiente').textContent =
      pasoActual === PASOS.length - 1 ? 'Empezar' : `Siguiente (${pasoActual + 1}/${PASOS.length})`;
  }

  function abrirTutorial() {
    pasoActual = 0;
    mostrarPaso();
    abrirHoja('telonTutorial');
  }

  /* ---------------- 12. Copia de seguridad ---------------- */
  function exportarArchivo() {
    const blob = new Blob([Datos.exportar()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mi-bolsillo-${Datos.hoyISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    avisar('Copia descargada ✅');
  }

  function importarArchivo(archivo) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        Datos.importar(lector.result);
        cargarAjustesEnFormulario();
        dibujar();
        avisar('Datos restaurados ✅');
      } catch (e) {
        avisar('Ese archivo no se pudo leer');
      }
    };
    lector.readAsText(archivo);
  }

  /* ---------------- 13. Instalacion en el celular ---------------- */
  let promesaInstalacion = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    promesaInstalacion = e;
    $$$('avisoInstalar').classList.add('visible');
  });

  window.addEventListener('appinstalled', () => {
    $$$('avisoInstalar').classList.remove('visible');
    promesaInstalacion = null;
    avisar('Listo, ya la tienes instalada 🎉');
  });

  /* ---------------- 14. Eventos ---------------- */
  function conectarEventos() {
    // ---- Registro ----
    $$$('formRegistro').addEventListener('submit', enviarRegistro);
    // al empezar a corregir, el error se va solo
    $$$('campoCorreo').addEventListener('input', () => mostrarErrorCorreo(''));

    // Navegacion inferior
    $$('.navegacion button').forEach(b =>
      b.addEventListener('click', () => irA(b.dataset.pantalla)));

    // Botones internos que llevan a otra pantalla
    document.addEventListener('click', e => {
      const ir = e.target.closest('[data-ir]');
      if (ir) irA(ir.dataset.ir);

      const cerrar = e.target.closest('[data-cerrar]');
      if (cerrar) cerrarHoja(cerrar.dataset.cerrar);
    });

    // Cambio de mes
    $$$('mesAnterior').addEventListener('click', () => cambiarMes(-1));
    $$$('mesSiguiente').addEventListener('click', () => cambiarMes(1));

    // Boton +
    $$$('botonAgregar').addEventListener('click', abrirFormularioMovimiento);

    // Cerrar ventanas tocando el fondo oscuro
    $$('.telon').forEach(t =>
      t.addEventListener('click', e => { if (e.target === t) t.classList.remove('abierto'); }));

    // ---- Formulario de movimiento ----
    $$$('tipoGasto').addEventListener('click', () => fijarTipo('gasto'));
    $$$('tipoIngreso').addEventListener('click', () => fijarTipo('ingreso'));

    $$$('rejillaCategorias').addEventListener('click', e => {
      const b = e.target.closest('[data-categoria]');
      if (!b) return;
      vista.categoria = b.dataset.categoria;
      dibujarCategorias();
    });

    $$$('formMovimiento').addEventListener('submit', e => {
      e.preventDefault();
      const monto = Number($$$('campoMonto').value);
      if (!monto || monto <= 0) { avisar('Escribe un monto mayor que cero'); return; }

      Datos.agregarMovimiento({
        tipo: vista.tipo,
        monto,
        categoria: vista.categoria,
        nota: $$$('campoNota').value,
        fecha: $$$('campoFecha').value || Datos.hoyISO(),
      });

      cerrarHoja('telonMovimiento');
      // si anotaste algo de otro mes, saltamos a ese mes para que lo veas
      const [a, m] = ($$$('campoFecha').value || Datos.hoyISO()).split('-').map(Number);
      vista.anio = a; vista.mes = m - 1;
      dibujar();
      avisar(vista.tipo === 'gasto' ? 'Gasto anotado ✅' : 'Ingreso anotado ✅');
    });

    // ---- Lista de movimientos ----
    $$$('filtroTipo').addEventListener('change', e => {
      vista.filtroMovimientos = e.target.value;
      dibujarMovimientos();
    });

    $$$('listaMovimientos').addEventListener('click', e => {
      const b = e.target.closest('[data-borrar]');
      if (!b) return;
      if (!confirm('Borrar este movimiento?')) return;
      Datos.borrarMovimiento(b.dataset.borrar);
      dibujar();
      avisar('Movimiento borrado');
    });

    // ---- Pestanas del grafico de tendencia ----
    $$('.pestanas-grafico button').forEach(b =>
      b.addEventListener('click', () => {
        vista.tendencia = b.dataset.vista;
        $$('.pestanas-grafico button').forEach(o => o.classList.toggle('activa', o === b));
        dibujarTendencia();
      }));

    // ---- Metas ----
    $$$('botonNuevaMeta').addEventListener('click', () => {
      $$$('formMeta').reset();
      abrirHoja('telonMeta');
    });

    $$$('formMeta').addEventListener('submit', e => {
      e.preventDefault();
      Datos.agregarMeta({
        nombre: $$$('metaNombre').value,
        objetivo: Number($$$('metaObjetivo').value),
        emoji: $$$('metaEmoji').value,
        fechaLimite: $$$('metaFecha').value,
      });
      cerrarHoja('telonMeta');
      dibujarMetas();
      avisar('Meta creada 🎯');
    });

    $$$('listaMetas').addEventListener('click', e => {
      const abonar  = e.target.closest('[data-abonar]');
      const retirar = e.target.closest('[data-retirar]');
      const borrar  = e.target.closest('[data-borrar-meta]');

      if (abonar) {
        const monto = Number(prompt('Cuanto quieres abonar a esta meta?'));
        if (monto > 0) {
          Datos.abonarMeta(abonar.dataset.abonar, monto);
          dibujarMetas();
          avisar('Abono registrado 🐷');
        }
      }
      if (retirar) {
        const monto = Number(prompt('Cuanto quieres retirar?'));
        if (monto > 0) {
          Datos.abonarMeta(retirar.dataset.retirar, -monto);
          dibujarMetas();
          avisar('Retiro registrado');
        }
      }
      if (borrar) {
        if (!confirm('Borrar esta meta? Lo que llevas ahorrado no se descuenta de tus movimientos.')) return;
        Datos.borrarMeta(borrar.dataset.borrarMeta);
        dibujarMetas();
      }
    });

    // ---- Calculadora ----
    ['calcMonto', 'calcAnios', 'calcTasa'].forEach(id =>
      $$$(id).addEventListener('input', calcularAhorro));

    // ---- Ajustes ----
    $$$('botonGuardarAjustes').addEventListener('click', () => {
      // si escribio un correo, tiene que ser valido; si lo dejo vacio, lo respetamos
      const correo = $$$('campoCorreoAjustes').value.trim().toLowerCase();
      if (correo && !Datos.correoValido(correo)) {
        avisar('Ese correo no se ve bien. Revisa que tenga @ y un punto.');
        $$$('campoCorreoAjustes').focus();
        return;
      }

      Datos.guardarAjustes({
        correo,
        nombre: $$$('campoNombre').value.trim(),
        moneda: $$$('campoMoneda').value,
        ingresoEsperado: Number($$$('campoIngresoEsperado').value) || 0,
      });
      guardarTopesDesdeFormulario();
      actualizarSaludo();
      dibujarEditorTopes();
      avisar('Guardado ✅');
    });

    // los topes se guardan solos al salir del campo
    $$$('editorTopes').addEventListener('change', e => {
      const inp = e.target.closest('[data-tope]');
      if (!inp) return;
      Datos.fijarPresupuesto(inp.dataset.tope, inp.value);
      avisar('Tope actualizado');
    });

    $$$('botonExportar').addEventListener('click', exportarArchivo);
    $$$('botonImportar').addEventListener('click', () => $$$('archivoImportar').click());
    $$$('archivoImportar').addEventListener('change', e => {
      if (e.target.files[0]) importarArchivo(e.target.files[0]);
      e.target.value = '';
    });

    $$$('botonEjemplo').addEventListener('click', () => {
      if (!confirm('Esto reemplaza los movimientos del mes actual por datos de prueba. Seguimos?')) return;
      Datos.cargarEjemplo();
      cargarAjustesEnFormulario();
      irA('inicio');
      avisar('Datos de ejemplo cargados 🧪');
    });

    $$$('botonTutorial').addEventListener('click', abrirTutorial);

    $$$('botonBorrarTodo').addEventListener('click', () => {
      if (!confirm('Esto borra TODOS tus movimientos, metas y topes. No se puede deshacer.')) return;
      if (!confirm('Seguro? Si no descargaste una copia, se pierde todo.')) return;
      Datos.borrarTodo();
      cargarAjustesEnFormulario();
      irA('inicio');
      // se borro tambien el registro, asi que volvemos a la pantalla de bienvenida
      $$$('campoCorreo').value = '';
      mostrarErrorCorreo('');
      mostrarRegistro();
      avisar('Todo borrado');
    });

    // ---- Instalacion ----
    $$$('botonInstalar').addEventListener('click', async () => {
      if (!promesaInstalacion) {
        avisar('En iPhone: boton Compartir → Agregar a inicio');
        return;
      }
      promesaInstalacion.prompt();
      await promesaInstalacion.userChoice;
      promesaInstalacion = null;
      $$$('avisoInstalar').classList.remove('visible');
    });

    // ---- Tutorial ----
    $$$('tutorialSiguiente').addEventListener('click', () => {
      if (pasoActual < PASOS.length - 1) { pasoActual++; mostrarPaso(); }
      else {
        Datos.guardarAjustes({ tutorialVisto: true });
        cerrarHoja('telonTutorial');
      }
    });
    $$$('tutorialAtras').addEventListener('click', () => {
      if (pasoActual > 0) { pasoActual--; mostrarPaso(); }
    });
  }

  function actualizarSaludo() {
    const nombre = Datos.obtener().ajustes.nombre;
    const h = new Date().getHours();
    const momento = h < 12 ? 'Buenos dias' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    $$$('saludo').textContent = nombre ? `${momento}, ${nombre}` : momento;
  }

  /* ---------------- 15. Arranque ---------------- */
  function iniciar() {
    Datos.cargar();
    conectarEventos();
    actualizarSaludo();
    cargarAjustesEnFormulario();
    dibujarTecnicas();
    calcularAhorro();
    fijarTipo('gasto');
    irA('inicio');

    // Quien no se ha registrado ve primero la pantalla de bienvenida.
    // Quien ya se registro entra directo, sin instrucciones.
    if (!Datos.estaRegistrado()) {
      mostrarRegistro();
    } else if (!Datos.obtener().ajustes.tutorialVisto) {
      setTimeout(abrirTutorial, 450);
    }

    // El "service worker" es lo que permite que la app funcione sin internet
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Si el celular cambia entre modo claro y oscuro, redibujamos los graficos
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => dibujar());
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
