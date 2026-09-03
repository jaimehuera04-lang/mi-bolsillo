/* ============================================================
   app.js - Une todo: escucha los toques del usuario y decide
   que se dibuja en pantalla.
   Orden del archivo:
     1. Estado de la pantalla     5. Metas
     2. Utilidades                6. Aprender
     3. Navegación                7. Ajustes
     4. Inicio (dashboard)        8. Tutorial, instalación, arranque
   ============================================================ */

(() => {
  'use strict';

  /* ---------------- 1. Estado de la pantalla ---------------- */
  const hoy = new Date();
  const vista = {
    anio: hoy.getFullYear(),
    mes: hoy.getMonth(),              // 0 = enero
    pantalla: 'inicio',
    tendencia: 'barras',              // 'barras' o 'línea'
    filtroMovimientos: 'todos',
    // formulario de movimiento
    tipo: 'gasto',
    categoria: 'comida',
    cuentaOrigen: null,
    cuentaDestino: null,
    // Respaldos que se adjuntaron mientras el formulario está abierto.
    // Ya están guardados en la bodega pero todavía no tienen dueño: si
    // la persona cierra sin guardar, se borran.
    adjuntosPendientes: [],
    // Lo que había escrito antes de que el lector rellenara, para poder
    // deshacer sin perder lo tipeado.
    antesDeLeer: null,
    // Las líneas que encontramos en una cartola, esperando revisión.
    cartola: [],
    // A qué movimiento ya anotado le estamos colgando un respaldo.
    adjuntandoA: null,
    // 'entrar' o 'crear': en qué modo está la pantalla de bienvenida
    pasoEntrada: 'correo',
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

  /* --- Ventanas abiertas y el botón "atrás" del celular ---
     En una app, "atrás" cierra lo que tengas abierto; nunca te saca a
     la calle. Para conseguirlo llevamos una pila de lo que hay abierto
     y una entrada de historial por cada cosa. */
  const capas = [];            // funciones que cierran; la última es la de arriba
  let cerrandoPorAtras = false;

  /* Cuántos "atrás" pedimos nosotros y todavía no nos han llegado de vuelta.
     Es un CONTADOR y no un sí/no, y eso importa: history.back() no ocurre al
     tiro, avisa después con un evento. Si se cierran dos capas seguidas
     —confirmar una ventana y acto seguido cerrar la hoja— quedan dos "atrás"
     en vuelo; con un sí/no, el primero apagaba la bandera y el segundo se
     colaba y cerraba de más lo que se acabara de abrir. Nos pasó al convertir
     una cotización en venta: el comprobante se abría y desaparecía solo. */
  let atrasProgramado = 0;

  /** Anota una ventana recién abierta para que "atrás" la cierre. */
  function anotarCapa(cerrar) {
    capas.push(cerrar);
    history.pushState({ capa: capas.length }, '');
  }

  /** La cerró el usuario con un botón: devolvemos su entrada de historial. */
  function olvidarCapa() {
    if (cerrandoPorAtras || !capas.length) return;
    capas.pop();
    atrasProgramado++;
    history.back();
  }

  /**
   * Esconde una hoja y suelta el foco si se había quedado adentro.
   *
   * Sin el blur, el cursor sigue dentro de un campo que ya no se ve: en
   * el teléfono el teclado queda colgando y en el computador todo lo que
   * escribas (Ctrl+V incluido) se lo lleva un campo invisible.
   */
  function ocultarHoja(id) {
    const hoja = $$$(id);
    hoja.classList.remove('abierto');
    if (hoja.contains(document.activeElement)) document.activeElement.blur();
  }

  const abrirHoja = id => {
    $$$(id).classList.add('abierto');
    anotarCapa(() => ocultarHoja(id));
  };
  const cerrarHoja = id => {
    if (!$$$(id).classList.contains('abierto')) return;
    ocultarHoja(id);
    olvidarCapa();
    // Si se cerró el formulario sin guardar, los respaldos que se
    // adjuntaron ahí no le pertenecen a nadie: se van de la bodega.
    if (id === 'telonMovimiento') soltarAdjuntosPendientes();
  };

  const esMesActual = () =>
    vista.anio === hoy.getFullYear() && vista.mes === hoy.getMonth();

  /* ---------------- 3. Navegación ---------------- */

  // Cada pestaña recuerda donde la dejaste, como en cualquier app del
  // teléfono. Volver a Inicio no te devuelve al principio de la lista.
  const scrollDeCadaPantalla = {};

  function irA(nombre, sinHistorial) {
    const contenido = $$$('contenido');
    const repetida = vista.pantalla === nombre;

    // cada cambio de pestaña deja huella, para que "atrás" te devuelva
    // a la anterior en vez de sacarte de la app
    if (!repetida && !sinHistorial) history.pushState({ tab: nombre }, '');

    // antes de cambiar, anotamos donde iba la pestaña que dejamos
    if (!repetida && vista.pantalla) scrollDeCadaPantalla[vista.pantalla] = contenido.scrollTop;

    vista.pantalla = nombre;
    $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === `pantalla-${nombre}`));
    $$('.navegacion button').forEach(b => b.classList.toggle('activa', b.dataset.pantalla === nombre));
    // el botón + solo tiene sentido en las pantallas de plata
    $$$('botonAgregar').style.display = ['inicio', 'movimientos', 'negocio'].includes(nombre) ? '' : 'none';
    // En el negocio el + no anota un gasto tuyo: vende.
    $$$('botonAgregar').textContent = nombre === 'negocio' ? '🏷️' : '+';

    dibujar();

    // tocar la pestaña en la que ya estás te sube al principio;
    // cambiar de pestaña te deja donde la habías dejado
    contenido.scrollTop = repetida ? 0 : (scrollDeCadaPantalla[nombre] || 0);
    marcarDesplazamiento();
  }

  /** Una vibración cortita al tocar. Si el aparato no puede, no pasa nada. */
  function vibrar(ms) {
    try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {}
  }

  /**
   * Deja el botón "atrás" del celular funcionando como en una app:
   * primero cierra lo que esté abierto, después te devuelve a Inicio,
   * y recién ahí, estando en Inicio y sin nada abierto, sale.
   */
  function prepararBotonAtras() {
    history.replaceState({ tab: 'inicio' }, '');

    window.addEventListener('popstate', evento => {
      // este "atrás" lo pedimos nosotros al cerrar algo: ya está hecho
      if (atrasProgramado > 0) { atrasProgramado--; return; }

      // 1. hay algo abierto encima (una hoja o una ventana de confirmar)?
      //    se cierra lo de más arriba y nos quedamos donde estábamos
      if (capas.length) {
        cerrandoPorAtras = true;
        capas.pop()();
        cerrandoPorAtras = false;
        return;
      }

      // 2. estábamos en otra pestaña: volvemos a la anterior
      if (evento.state && evento.state.tab) irA(evento.state.tab, true);

      // 3. Inicio y nada abierto: dejamos que el celular cierre la app
    });

    // las ventanas de confirmar usan la misma pila de capas
    Dialogos.conectarHistorial(anotarCapa, olvidarCapa);
  }

  /** Le pone sombra al encabezado cuando hay contenido pasando por debajo. */
  /**
   * Sube un campo al centro de su propio contenedor, sin tocar nada más.
   * El contenedor es la hoja abierta o la pantalla; si el campo no vive
   * dentro de ninguno de los dos, no se mueve nadie.
   */
  function acomodarCampo(campo) {
    const caja = campo.closest('.hoja') || campo.closest('#contenido');
    if (!caja) return;

    const cCaja = caja.getBoundingClientRect();
    const cCampo = campo.getBoundingClientRect();
    // dónde queda el centro del campo respecto del centro de su contenedor
    const corrimiento = (cCampo.top + cCampo.height / 2) - (cCaja.top + cCaja.height / 2);

    // menos de 40 píxeles no vale la pena: mover la pantalla por nada
    // se siente como un salto raro, no como una ayuda
    if (Math.abs(corrimiento) < 40) return;

    const destino = Math.max(0, Math.min(
      caja.scrollTop + corrimiento,
      caja.scrollHeight - caja.clientHeight));
    caja.scrollTo({ top: destino, behavior: 'smooth' });
  }

  function marcarDesplazamiento() {
    $$$('app').classList.toggle('desplazado', $$$('contenido').scrollTop > 4);
  }

  /**
   * Ajusta el marco al aparato real: mide la barra de abajo para que el
   * botón + quede justo encima, pase lo que pase con el tamaño de letra
   * del sistema o con la barra de gestos del celular.
   */
  function prepararMarco() {
    const medir = () => {
      const alto = $('.navegacion').offsetHeight;
      document.documentElement.style.setProperty('--alto-barra-inferior', alto + 'px');
    };
    medir();
    window.addEventListener('resize', medir);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', medir);

    $$$('contenido').addEventListener('scroll', marcarDesplazamiento, { passive: true });
    prepararArrastreDeHojas();

    /* Que el marco de la app NO se pueda desplazar no se arregla desde
       acá: se arregla en el CSS, recortando el telón (ver .telon en
       estilos.css). Un elemento con overflow:hidden ni siquiera avisa
       cuando algo lo desplaza —Chrome no dispara el evento scroll—, así
       que un vigilante en JavaScript sería letra muerta. */

    // Con el marco fijo, el navegador ya no acomoda solo el campo que
    // estás llenando. Lo hacemos nosotros: al tocar un campo, lo
    // subimos al centro de lo que quede visible sobre el teclado.
    //
    // Se hace a mano y no con scrollIntoView porque ese sube TODOS los
    // contenedores que puedan subir —incluido el marco de la app— y ese
    // era justamente el problema.
    document.addEventListener('focusin', evento => {
      const campo = evento.target;
      if (!campo.matches || !campo.matches('input, select, textarea')) return;
      setTimeout(() => acomodarCampo(campo), 250);
    });
  }

  /**
   * Deja cerrar las hojas arrastrándolas hacia abajo con el dedo, como
   * en cualquier app del teléfono. Solo empieza a arrastrar si la hoja
   * ya está arriba del todo; si no, el dedo está haciendo scroll dentro
   * de ella y no hay que quitárselo.
   */
  function prepararArrastreDeHojas() {
    $$('.hoja').forEach(hoja => {
      let partida = null;
      let recorrido = 0;

      hoja.addEventListener('touchstart', e => {
        if (hoja.scrollTop > 0 || e.touches.length !== 1) return;
        partida = e.touches[0].clientY;
        recorrido = 0;
        hoja.classList.add('arrastrando');
      }, { passive: true });

      hoja.addEventListener('touchmove', e => {
        if (partida === null) return;
        recorrido = Math.max(0, e.touches[0].clientY - partida);
        hoja.style.transform = 'translateY(' + recorrido + 'px)';
      }, { passive: true });

      const soltar = () => {
        if (partida === null) return;
        partida = null;
        hoja.classList.remove('arrastrando');
        hoja.style.transform = '';
        // pasado el tercio de la hoja, se cierra; si no, vuelve a su sitio
        if (recorrido > Math.min(120, hoja.offsetHeight / 3)) {
          vibrar(6);
          cerrarHoja(hoja.closest('.telon').id);
        }
      };

      hoja.addEventListener('touchend', soltar);
      hoja.addEventListener('touchcancel', soltar);
    });
  }

  function cambiarMes(delta) {
    const f = new Date(vista.anio, vista.mes + delta, 1);
    vista.anio = f.getFullYear();
    vista.mes = f.getMonth();
    dibujar();
  }

  /** Redibuja lo que esté visible. */
  function dibujar() {
    $$$('etiquetaMes').textContent = Datos.nombreMes(vista.anio, vista.mes);
    // no dejamos avanzar más allá del mes actual
    const futuro = new Date(vista.anio, vista.mes + 1, 1) > new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    $$$('mesSiguiente').style.visibility = futuro ? 'hidden' : 'visible';

    if (vista.pantalla === 'inicio')       dibujarInicio();
    if (vista.pantalla === 'movimientos')  dibujarMovimientos();
    if (vista.pantalla === 'metas')        dibujarMetas();
    if (vista.pantalla === 'negocio')      UiNegocio.dibujar();
    if (vista.pantalla === 'ajustes')    { dibujarEditorTopes(); dibujarCuentas(); UiNegocio.dibujarEnAjustes(); }
  }

  /**
   * Muestra o esconde la pestaña Negocio.
   * Se llama al arrancar y cada vez que se enciende o se apaga, porque
   * la barra de abajo pasa de cinco columnas a seis.
   */
  function acomodarPestanaNegocio() {
    const activo = typeof DatosNegocio !== 'undefined' && DatosNegocio.estaActivo();
    const boton = $('.navegacion button[data-pantalla="negocio"]');
    if (boton) boton.hidden = !activo;
    $('.navegacion').classList.toggle('con-negocio', activo);
    // Si estabas parado en Negocio y lo apagaste, no te podemos dejar
    // mirando una pantalla que ya no existe.
    if (!activo && vista.pantalla === 'negocio') irA('inicio');
  }

  /* ---------------- 4. Inicio (dashboard) ---------------- */
  function dibujarInicio() {
    // El sueldo libre va primero: es la razón de existir de la app.
    UiSueldo.dibujarEnInicio();
    const r = Datos.resumenDelMes(vista.anio, vista.mes);

    const saldo = $$$('saldoMes');
    saldo.textContent = dinero(r.saldo);
    saldo.className = `monto ${r.saldo < 0 ? 'negativo' : 'positivo'}`;
    $$$('totalIngresos').textContent = dinero(r.ingresos);
    $$$('totalGastos').textContent = dinero(r.gastos);

    // Lo que tienes hoy repartido entre tus cuentas. Es un dato distinto al
    // saldo del mes: aquel mira un mes, este mira tu bolsillo completo.
    const total = Datos.patrimonio();
    $$$('patrimonioInicio').textContent = dinero(total);
    $$$('patrimonioInicio').style.color = total < 0 ? 'var(--rojo)' : 'var(--texto)';
    $$$('detallePatrimonio').textContent = Datos.saldosDeCuentas()
      .map(c => `${c.icono} ${c.nombre}: ${dinero(c.saldo)}`).join(' · ');

    // Tasa de ahorro
    const tasa = Math.max(0, r.tasaAhorro);
    $$$('barraTasaAhorro').style.width = `${Math.min(100, tasa)}%`;
    $$$('barraTasaAhorro').style.background =
      tasa >= 20 ? 'var(--verde)' : tasa >= 10 ? 'var(--amarillo)' : 'var(--rojo)';
    $$$('textoTasaAhorro').textContent = r.ingresos > 0 ? `${r.tasaAhorro}%` : 'sin ingresos anotados';

    // Consejos automáticos
    const consejos = Datos.sugerir(vista.anio, vista.mes);
    $$$('zonaConsejos').innerHTML = consejos.map(c => `
      <div class="consejo ${c.tipo === 'alerta' ? 'aviso' : ''}" style="margin-bottom:14px">
        <strong>${esc(c.titulo)}</strong>${esc(c.texto)}
      </div>`).join('');

    // Gráficos
    Graficos.dona($$$('graficoDona'), Datos.gastosPorCategoria(vista.anio, vista.mes), {
      // el mensaje cambia según si el mes está vacío o si de verdad no gastaste nada
      mensajeVacio: r.cantidad === 0
        ? 'Este mes todavía no tiene nada anotado'
        : 'Sin gastos este mes 🎉',
    });
    dibujarTendencia();
    Graficos.reglaVisual($$$('graficoRegla'), Datos.reparto503020(vista.anio, vista.mes));

    dibujarTopes();
    $$$('pildoraDia').textContent = ' ' + Datos.pildoraDelDia();
  }

  function dibujarTendencia() {
    if (vista.tendencia === 'barras') {
      $$$('tituloTendencia').textContent = 'Mes a mes';
      Graficos.barras($$$('graficoTendencia'), Datos.historialMeses(vista.anio, vista.mes, 6));
      $$$('pieTendencia').textContent =
        'Verde es lo que entró, rojo lo que salió. Si el rojo supera al verde, ese mes gastaste más de lo que ganaste.';
    } else {
      $$$('tituloTendencia').textContent = 'Mi saldo día a día';
      Graficos.linea($$$('graficoTendencia'), Datos.saldoDiario(vista.anio, vista.mes));
      $$$('pieTendencia').textContent =
        'Cómo te fue quedando la plata a lo largo del mes. Si la curva cruza hacia abajo la línea punteada, ese día entraste en números rojos.';
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

  /** Una línea de la lista. Las transferencias se ven distinto a propósito:
      no llevan signo, porque no suman ni restan a lo que tienes. */
  function lineaDeMovimiento(m) {
    const nombreCuenta = id => {
      const c = Datos.cuentaPorId(id);
      return c ? `${c.icono} ${c.nombre}` : 'Cuenta borrada';
    };

    // El clip va SIEMPRE, apagado cuando no hay nada: es la única forma
    // de poder adjuntarle la boleta a un gasto que anotaste al paso y
    // fotografiaste después, que es como pasa en la vida real.
    // No preguntamos acá si el archivo está en ESTE aparato: eso obligaría
    // a consultar la bodega antes de dibujar. Se resuelve al tocarlo, y si
    // la foto se quedó en el otro teléfono, el visor lo dice sin rodeos.
    const cuantos = (m.adjuntos || []).length;
    const clip = `
      <button class="clip ${cuantos ? '' : 'vacio'}" data-adjuntos="${m.id}"
              aria-label="${cuantos
                ? (cuantos === 1 ? 'Ver el respaldo' : `Ver los ${cuantos} respaldos`)
                : 'Adjuntar un respaldo'}">📎</button>`;

    if (m.tipo === 'transferencia') {
      return `
        <li class="movimiento">
          <span class="emoji">🔄</span>
          <span class="info">
            <span class="nombre">${esc(m.nota || 'Movida entre cuentas')}</span>
            <span class="detalle">${esc(nombreCuenta(m.cuentaOrigen))} → ${esc(nombreCuenta(m.cuentaDestino))}</span>
          </span>
          <span class="monto transferencia">${esc(dinero(m.monto))}</span>
          ${clip}
          <button class="borrar" data-borrar="${m.id}" aria-label="Borrar">✕</button>
        </li>`;
    }

    const cat = Datos.categoriaPorId(m.categoria);
    const cuenta = m.tipo === 'ingreso' ? m.cuentaDestino : m.cuentaOrigen;
    return `
      <li class="movimiento">
        <span class="emoji">${cat.emoji}</span>
        <span class="info">
          <span class="nombre">${esc(m.nota || cat.nombre)}</span>
          <span class="detalle">${esc(cat.nombre)} · ${esc(nombreCuenta(cuenta))}</span>
        </span>
        <span class="monto ${m.tipo}">${m.tipo === 'ingreso' ? '+' : '-'}${esc(dinero(m.monto))}</span>
        ${clip}
        <button class="borrar" data-borrar="${m.id}" aria-label="Borrar">✕</button>
      </li>`;
  }

  function dibujarMovimientos() {
    let movs = Datos.movimientosDelMes(vista.anio, vista.mes);
    if (vista.filtroMovimientos !== 'todos') {
      movs = movs.filter(m => m.tipo === vista.filtroMovimientos);
    }

    if (!movs.length) {
      $$$('listaMovimientos').innerHTML = `
        <div class="vacio">
          <span class="emoji-grande">📝</span>
          <p><strong>Todavía no hay nada anotado</strong></p>
          <p class="ayuda">Toca el botón + de abajo a la derecha. Anotar un gasto toma cinco segundos
          y es lo único que necesitas hacer todos los días.</p>
        </div>`;
      return;
    }

    // agrupamos por día para que se lea mejor
    const porDia = new Map();
    for (const m of movs) {
      if (!porDia.has(m.fecha)) porDia.set(m.fecha, []);
      porDia.get(m.fecha).push(m);
    }

    let html = '';
    for (const [fecha, delDia] of porDia) {
      // el total del día no cuenta las transferencias: mover plata entre tus
      // cuentas no te deja ni con más ni con menos
      const totalDia = delDia.reduce((a, m) =>
        m.tipo === 'ingreso' ? a + m.monto
      : m.tipo === 'gasto'   ? a - m.monto
      : a, 0);
      // Un día en que solo moviste plata entre cuentas no tiene total que mostrar:
      // poner "+$0" sería un número sin significado.
      const soloMovidas = delDia.every(m => m.tipo === 'transferencia');
      const totalHtml = soloMovidas ? '' : `
                 <span style="float:right; text-transform:none; letter-spacing:0">
                   ${totalDia >= 0 ? '+' : ''}${esc(dinero(totalDia))}
                 </span>`;
      html += `<div class="fecha-grupo">
                 ${esc(Datos.fechaLegible(fecha))}${totalHtml}
               </div>
               <ul class="lista">`;
      for (const m of delDia) html += lineaDeMovimiento(m);
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
          básicos guardado para imprevistos.</p>
        </div>`;
      return;
    }

    $$$('listaMetas').innerHTML = metas.map(m => {
      const pct = Math.min(100, (m.montoActual / m.montoObjetivo) * 100);
      const falta = Math.max(0, m.montoObjetivo - m.montoActual);
      const lista = pct >= 100;

      // Si hay fecha límite, calculamos cuanto habría que guardar al mes
      let ritmo = '';
      if (m.fechaObjetivo && !lista) {
        // aFecha() y no new Date(iso): esto último se lee como UTC y corre un día
        const meses = Math.max(1, Math.round(
          (Fechas.aFecha(m.fechaObjetivo) - Fechas.aFecha(Datos.hoyISO())) / (1000 * 60 * 60 * 24 * 30.4)));
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
                <strong>${esc(dinero(m.montoActual))}</strong>
                <span style="color:var(--texto-suave)">de ${esc(dinero(m.montoObjetivo))} · ${Math.round(pct)}%</span>
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
    $$$('listaTecnicas').innerHTML = Datos.TECNICAS.map(t => `
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
      <strong>En ${anios} ${anios === 1 ? 'año' : 'años'} juntarías ${esc(dinero(Math.round(total)))}</strong>
      De eso, ${esc(dinero(aportado))} salieron de tu bolsillo y
      ${esc(dinero(Math.round(intereses)))} los generaron los intereses.
      ${intereses > aportado * 0.25
        ? ' Fíjate cómo el tiempo empieza a hacer la pega por ti.'
        : ' Prueba subir los años y mira cómo cambia: el tiempo pesa más que el monto.'}`;
  }

  /* ---------------- 8. Ajustes ---------------- */
  function cargarAjustesEnFormulario() {
    const a = Datos.obtener().ajustes;
    $$$('campoCorreoAjustes').value = a.correo || '';
    $$$('campoNombre').value = a.nombre || '';
    $$$('campoIngresoEsperado').value = a.ingresoEsperado || '';
  }

  /* ---------------- 8b. Cuentas ----------------
     Una cuenta es un lugar donde vive tu plata: la Cuenta RUT, el
     efectivo del bolsillo, la tarjeta de crédito. El saldo no se
     guarda, se calcula sumando tus movimientos sobre el saldo
     inicial, así nunca se desincroniza.                          */

  function dibujarCuentas() {
    const cuentas = Datos.saldosDeCuentas();
    const total = Datos.patrimonio();

    $$$('listaCuentas').innerHTML = cuentas.map(c => {
      const tipo = Datos.tipoCuenta(c.tipo);
      const esDeuda = tipo.deuda;
      // En una tarjeta, saldo negativo significa que debes. En el resto, números rojos.
      const texto = esDeuda && c.saldo < 0
        ? `Debes ${dinero(Math.abs(c.saldo))}`
        : dinero(c.saldo);
      const color = c.saldo < 0 ? 'var(--rojo)' : 'var(--texto)';
      return `
        <div class="cuenta" data-cuenta="${c.id}">
          <span class="emoji">${c.icono}</span>
          <span class="info">
            <span class="nombre">${esc(c.nombre)}</span>
            <span class="detalle">${esc(tipo.nombre)}</span>
          </span>
          <span class="saldo" style="color:${color}">${esc(texto)}</span>
          <button class="boton fantasma chico" data-editar-cuenta="${c.id}" aria-label="Editar">✏️</button>
        </div>`;
    }).join('');

    $$$('patrimonioTotal').textContent = dinero(total);
    $$$('patrimonioTotal').style.color = total < 0 ? 'var(--rojo)' : 'var(--verde)';

    const archivadas = Datos.obtener().cuentas.filter(c => c.activa === false);
    $$$('cuentasArchivadas').hidden = !archivadas.length;
    $$$('cuentasArchivadas').innerHTML = archivadas.length
      ? `<p class="ayuda">Archivadas: ${archivadas.map(c => esc(c.nombre)).join(', ')}.
         Sus movimientos siguen contando en tu historial.
         ${archivadas.map(c => `<button class="boton fantasma chico" data-reactivar="${c.id}">Reactivar ${esc(c.nombre)}</button>`).join(' ')}</p>`
      : '';
  }

  /** Abre la hoja de cuenta. Sin id = cuenta nueva. */
  function abrirFormularioCuenta(id) {
    vista.cuentaEditando = id || null;
    const c = id ? Datos.cuentaPorId(id) : null;

    $$$('tituloHojaCuenta').textContent = c ? 'Editar cuenta' : 'Nueva cuenta';
    $$$('cuentaNombre').value = c ? c.nombre : '';
    $$$('cuentaSaldo').value = c ? c.saldoInicial : '';
    $$$('cuentaTipo').innerHTML = Datos.TIPOS_CUENTA.map(t => `
      <option value="${t.id}" ${c && c.tipo === t.id ? 'selected' : ''}>${t.emoji} ${esc(t.nombre)}</option>`
    ).join('');
    if (c) $$$('cuentaTipo').value = c.tipo;

    // El saldo inicial solo se puede tocar al crear: cambiarlo después
    // mueve todos los saldos históricos de golpe y nadie entiende por que.
    $$$('ayudaSaldoCuenta').textContent = c
      ? 'Es el saldo con el que partió la cuenta. Cambiarlo mueve todos tus saldos desde esa fecha.'
      : 'Cuánta plata hay hoy en esta cuenta. Si es una tarjeta de crédito y debes plata, escríbelo en negativo.';

    $$$('zonaBorrarCuenta').hidden = !c;
    if (c) {
      const usados = Datos.movimientosDeCuenta(c.id);
      $$$('ayudaBorrarCuenta').textContent = usados
        ? `Esta cuenta tiene ${usados} ${usados === 1 ? 'movimiento' : 'movimientos'}. Archivarla la saca de los formularios sin borrar tu historial.`
        : 'Esta cuenta no tiene movimientos, así que se puede borrar sin perder nada.';
      $$$('botonBorrarCuenta').textContent = usados ? '📦 Archivar cuenta' : '🗑️ Borrar cuenta';
    }

    abrirHoja('telonCuenta');
  }

  function guardarCuentaDesdeFormulario(evento) {
    evento.preventDefault();
    const datos = {
      nombre: $$$('cuentaNombre').value,
      tipo: $$$('cuentaTipo').value,
      saldoInicial: Number($$$('cuentaSaldo').value) || 0,
      icono: Datos.tipoCuenta($$$('cuentaTipo').value).emoji,
    };
    try {
      if (vista.cuentaEditando) Datos.editarCuenta(vista.cuentaEditando, datos);
      else Datos.agregarCuenta(datos);
    } catch (error) {
      avisar(error.message);
      return;
    }
    cerrarHoja('telonCuenta');
    dibujarCuentas();
    dibujarInicioSiVisible();
    avisar(vista.cuentaEditando ? 'Cuenta actualizada ✅' : 'Cuenta creada ✅');
  }

  const dibujarInicioSiVisible = () => { if (vista.pantalla === 'inicio') dibujarInicio(); };

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
    if (vista.tipo === 'transferencia') return;   // una transferencia no tiene categoría
    const lista = vista.tipo === 'gasto' ? Datos.CATEGORIAS_GASTO : Datos.CATEGORIAS_INGRESO;
    if (!lista.some(c => c.id === vista.categoria)) vista.categoria = lista[0].id;

    $$$('rejillaCategorias').innerHTML = lista.map(c => `
      <button type="button" data-categoria="${c.id}" class="${c.id === vista.categoria ? 'activa' : ''}">
        <span class="emoji">${c.emoji}</span>
        <span>${esc(c.nombre)}</span>
      </button>`).join('');
  }

  /** Opciones de un selector de cuenta, con el saldo al lado. */
  function opcionesDeCuenta(seleccionada) {
    return Datos.saldosDeCuentas().map(c => `
      <option value="${c.id}" ${c.id === seleccionada ? 'selected' : ''}>
        ${c.icono} ${esc(c.nombre)} · ${esc(dinero(c.saldo))}
      </option>`).join('');
  }

  /** Muestra los selectores que correspondan según el tipo de movimiento. */
  function dibujarCuentasDelFormulario() {
    const cuentas = Datos.cuentasActivas();
    const primera = (cuentas[0] || {}).id;
    const segunda = (cuentas[1] || cuentas[0] || {}).id;

    // el destino por defecto nunca puede ser igual al origen
    if (vista.cuentaOrigen === vista.cuentaDestino && cuentas.length > 1) {
      vista.cuentaDestino = cuentas.find(c => c.id !== vista.cuentaOrigen).id;
    }
    if (!cuentas.some(c => c.id === vista.cuentaOrigen))  vista.cuentaOrigen = primera;
    if (!cuentas.some(c => c.id === vista.cuentaDestino)) vista.cuentaDestino = segunda;

    $$$('campoCuentaOrigen').innerHTML  = opcionesDeCuenta(vista.cuentaOrigen);
    $$$('campoCuentaDestino').innerHTML = opcionesDeCuenta(vista.cuentaDestino);

    const t = vista.tipo;
    $$$('filaCuentaOrigen').hidden  = t === 'ingreso';
    $$$('filaCuentaDestino').hidden = t === 'gasto';
    $$$('etiquetaCuentaOrigen').textContent =
      t === 'transferencia' ? 'Sale de' : '¿De qué cuenta salió?';
    $$$('etiquetaCuentaDestino').textContent =
      t === 'transferencia' ? 'Entra a' : '¿A qué cuenta entró?';

    // Una sola cuenta y querer transferir no tiene sentido: se avisa y se ofrece la salida.
    $$$('avisoUnaCuenta').hidden = !(t === 'transferencia' && cuentas.length < 2);
  }

  function abrirFormularioMovimiento() {
    limpiarZonaDeRespaldo();
    $$$('campoMonto').value = '';
    $$$('campoNota').value = '';
    // si estás mirando un mes pasado, la fecha por defecto es el día 1 de ese mes
    $$$('campoFecha').value = esMesActual()
      ? Datos.hoyISO()
      : `${vista.anio}-${String(vista.mes + 1).padStart(2, '0')}-01`;
    $$$('campoFecha').max = Datos.hoyISO();
    dibujarCategorias();
    dibujarCuentasDelFormulario();
    abrirHoja('telonMovimiento');
    setTimeout(() => $$$('campoMonto').focus(), 260);
  }

  const TITULO_MOVIMIENTO = {
    gasto: 'Anotar un gasto',
    ingreso: 'Anotar un ingreso',
    transferencia: 'Mover plata entre cuentas',
  };

  function fijarTipo(tipo) {
    vista.tipo = tipo;
    $$$('tipoGasto').classList.toggle('activo', tipo === 'gasto');
    $$$('tipoIngreso').classList.toggle('activo', tipo === 'ingreso');
    $$$('tipoTransferencia').classList.toggle('activo', tipo === 'transferencia');
    $$$('tituloHojaMovimiento').textContent = TITULO_MOVIMIENTO[tipo];

    // La categoría solo existe para ingresos y gastos.
    $$$('bloqueCategorias').hidden = tipo === 'transferencia';
    dibujarCategorias();
    dibujarCuentasDelFormulario();
  }

  /* ---------------- 9b. Respaldos y lectura de archivos ----------------

     Dos cosas distintas que conviene no confundir:

       ADJUNTAR  guardar la foto o el PDF junto al movimiento, para
                 poder mirarlo después. Funciona con cualquier archivo.
       LEER      sacar el monto, la fecha y el comercio del archivo
                 para llenar el formulario. Solo funciona con lo que
                 tiene texto adentro: PDF, CSV, correos. De una foto
                 se saca la fecha y nada más, y así se dice.

     Regla que no se negocia: nada se anota solo. El lector propone y
     muestra de qué línea sacó cada dato; la persona confirma. Un
     lector que anota por su cuenta te ensucia el mes en silencio.  */

  /** Deja la zona de respaldo como recién abierta. */
  function limpiarZonaDeRespaldo() {
    soltarAdjuntosPendientes();
    vista.antesDeLeer = null;
    $$$('resultadoLectura').hidden = true;
    $$$('resultadoLectura').innerHTML = '';
    $$$('archivoAdjunto').value = '';
    $$$('zonaPegar').hidden = true;
    $$$('campoPegado').value = '';
    dibujarAdjuntosDelFormulario();
  }

  /* ---------------- Pegar el texto de una captura ----------------

     Acá está la respuesta honesta al caso más común de todos: la
     captura de pantalla de la app del banco.

     Una captura son píxeles y sin OCR no hay nada que leer. Pero el
     teléfono YA trae OCR: en el iPhone, Fotos deja seleccionar el
     texto de cualquier imagen y copiarlo (el iconito de las líneas,
     abajo a la derecha), y en Android lo hace Google Fotos con Lens.
     O sea que el OCR ya lo hizo el teléfono y nosotros solo tenemos
     que recibir el resultado.

     No es un parche: es mejor que meterle OCR a la app. El de Apple
     y el de Google están entrenados de verdad, corren en el aparato,
     no pesan un byte de más y no rompen ninguna regla de la casa.  */

  async function pegarTextoDeCaptura() {
    // Primero probamos leer el portapapeles solos, que es un toque menos.
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const texto = await navigator.clipboard.readText();
        if (texto && texto.trim()) {
          leerTextoPegado(texto);
          return;
        }
        // portapapeles vacío: no es un error, es que no copió nada
        avisar('No hay texto copiado todavía');
        mostrarZonaDePegado();
        return;
      }
    } catch (e) {
      // el navegador no nos deja leerlo solos (pasa en iPhone según
      // el caso): se lo pedimos a la persona, que siempre puede
    }
    mostrarZonaDePegado();
  }

  function mostrarZonaDePegado() {
    $$$('zonaPegar').hidden = false;
    $$$('campoPegado').focus();
  }

  /**
   * Le pasa al motor un texto que llegó pegado, no desde un archivo.
   * Si trae varias líneas con fecha y monto es una cartola pegada a
   * mano, y eso ya tiene su propia pantalla.
   */
  function leerTextoPegado(texto) {
    const cartola = Lector.leerCartola(texto, { hoy: Datos.hoyISO() });
    if (cartola.filas.length >= 3) {
      cerrarHojaSinSoltarAdjuntos('telonMovimiento');
      abrirRevisionDeCartola(cartola.filas, 'lo que pegaste', cartola.futuras);
      return;
    }

    const propuesta = Lector.leerComprobante(texto, { hoy: Datos.hoyISO() });
    if (!propuesta.encontrados) {
      $$$('zonaPegar').hidden = false;
      mostrarLectura(null, 'De ese texto no pudimos sacar ni el monto ni la fecha. '
        + 'Si viene de una captura, revisa que hayas copiado la parte donde salen.');
      return;
    }

    $$$('zonaPegar').hidden = true;
    $$$('campoPegado').value = '';
    aplicarLectura(propuesta, '', 'texto');
  }

  /** Borra de la bodega los archivos que quedaron sin movimiento. */
  function soltarAdjuntosPendientes() {
    for (const ficha of vista.adjuntosPendientes) Adjuntos.borrar(ficha.id);
    vista.adjuntosPendientes = [];
    dibujarAdjuntosDelFormulario();
  }

  const EMOJI_ARCHIVO = { imagen: '🖼️', pdf: '📄', hoja: '📊', texto: '📃', desconocido: '📎' };

  function dibujarAdjuntosDelFormulario() {
    const caja = $$$('adjuntosDelFormulario');
    if (!caja) return;

    caja.innerHTML = vista.adjuntosPendientes.map(a => `
      <div class="tira-adjunto" data-adjunto="${esc(a.id)}">
        <span class="miniatura" data-mini="${esc(a.id)}">${EMOJI_ARCHIVO[a.clase] || '📎'}</span>
        <span class="info">
          <span class="nombre">${esc(a.nombre)}</span>
          <span class="detalle">${esc(Archivos.pesoLegible(a.tamano))}</span>
        </span>
        <button type="button" class="quitar" data-quitar="${esc(a.id)}" aria-label="Quitar">✕</button>
      </div>`).join('');

    // La miniatura de las fotos se pide a la bodega después de dibujar,
    // porque leer un archivo es asíncrono y la lista no puede esperar.
    for (const a of vista.adjuntosPendientes) {
      if (a.clase !== 'imagen') continue;
      Adjuntos.obtener(a.id).then(registro => {
        const hueco = caja.querySelector(`[data-mini="${a.id}"]`);
        if (!registro || !hueco) return;
        const url = URL.createObjectURL(registro.blob);
        hueco.innerHTML = `<img src="${url}" alt="">`;
        hueco.querySelector('img').onload = () => URL.revokeObjectURL(url);
      });
    }
  }

  /* ---------------- Leer el pantallazo del banco ----------------

     Lo que más sube la gente no es una boleta: es una captura de la
     pantalla de movimientos de su banco. Hasta ahora de una imagen
     solo se sacaba la fecha del EXIF y el QR, y el texto había que
     pegarlo a mano.

     La primera vez hay que bajar el lector de texto, que pesa varios
     megas. Eso se pregunta ANTES: bajarle 5 MB por datos móviles a
     alguien sin avisarle es una falta de respeto, aunque sea para
     algo que pidió. La respuesta se recuerda.               */

  async function leerImagenConOcr(adjuntoId, nombre) {
    if (typeof UiOcr === 'undefined') return '';

    if (!UiOcr.yaSeBajo() && !UiOcr.yaEstaListo()) {
      const si = await Dialogos.confirmar({
        titulo: '¿Leo la imagen por ti?',
        texto: `Puedo sacarle el texto a ese pantallazo y llenar los movimientos solo.\n\n`
             + `La primera vez tengo que bajar el lector, que pesa unos ${UiOcr.PESO_APROXIMADO}. `
             + `Después queda guardado en este teléfono y funciona sin internet.`,
        aceptar: 'Sí, léelo', cancelar: 'Ahora no',
      });
      if (!si) {
        avisar('Puedes pegarme el texto con el botón "Pegar texto".');
        return '';
      }
    }

    const guardado = await Adjuntos.obtener(adjuntoId);
    if (!guardado || !guardado.blob) return '';

    mostrarProgresoDeLectura('Preparando el lector…', 0);
    try {
      const texto = await UiOcr.leer(guardado.blob, ({ fase, pct }) => {
        mostrarProgresoDeLectura(
          fase === 'preparando' ? 'Bajando el lector, solo esta vez…' : 'Leyendo la imagen…',
          pct);
      });
      if (!texto || texto.length < 8) {
        mostrarLectura(null, 'Le pasé el lector a la imagen pero no le entendí el texto. '
          + 'Prueba con una captura más grande, o usa "Pegar texto".');
        return '';
      }
      return texto;
    } catch (e) {
      mostrarLectura(null, e.message || 'No pudimos leer la imagen.');
      return '';
    }
  }

  /** La barra de "voy en esto". Sin ella la app parece colgada. */
  function mostrarProgresoDeLectura(que, pct) {
    const caja = $$$('resultadoLectura');
    if (!caja) return;
    // La caja YA es un .consejo.lectura, así que acá va solo el
    // contenido; envolverlo otra vez dibujaba una caja dentro de otra.
    caja.hidden = false;
    caja.innerHTML = `
      <strong>🔎 ${esc(que)}</strong>
      <div class="barra" style="margin-top:8px">
        <span style="width:${Math.max(3, pct)}%; background:var(--verde)"></span>
      </div>`;
  }

  /**
   * La persona eligió uno o más archivos en el formulario.
   * Se guardan todos como respaldo; del primero que traiga texto
   * intentamos además llenar los campos.
   */
  async function adjuntarArchivos(archivos) {
    if (!Adjuntos.disponible()) {
      avisar('Este navegador no nos deja guardar archivos');
      return;
    }

    const boton = $$$('botonAdjuntar');
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Leyendo…';

    let paraLeer = null;
    let avisoDelArchivo = '';

    try {
      for (const archivo of archivos) {
        const leido = await Archivos.leer(archivo);

        const ficha = await Adjuntos.guardar({
          id: 'adj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          nombre: leido.nombre,
          tipo: leido.tipo,
          blob: leido.blob,
        });

        if (!ficha) {
          avisar(`"${leido.nombre}" pesa más de ${Archivos.pesoLegible(Adjuntos.MAXIMO_POR_ARCHIVO)}`);
          continue;
        }

        vista.adjuntosPendientes.push({ ...ficha, clase: leido.clase });
        if (!paraLeer && (leido.texto || leido.fechaFoto)) paraLeer = leido;
        if (!avisoDelArchivo && leido.aviso) avisoDelArchivo = leido.aviso;
      }
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
      dibujarAdjuntosDelFormulario();
    }

    // Una imagen sin texto útil todavía no está perdida: puede ser el
    // pantallazo de los movimientos del banco, que es lo que más se
    // sube. Ahí entra el lector de texto (OCR).
    const soloImagen = !paraLeer || !paraLeer.texto;
    const imagen = vista.adjuntosPendientes.filter(a => a.clase === 'imagen').pop();
    if (soloImagen && imagen) {
      const texto = await leerImagenConOcr(imagen.id, imagen.nombre);
      if (texto) {
        paraLeer = { ...(paraLeer || {}), texto, nombre: imagen.nombre };
        avisoDelArchivo = '';
      }
    }

    if (!paraLeer || (!paraLeer.texto && !paraLeer.fechaFoto)) {
      mostrarLectura(null, avisoDelArchivo);
      return;
    }

    // Si el archivo trae muchas líneas con fecha y monto, no es un
    // comprobante: es una cartola, y esa se revisa en su propia ventana.
    const cartola = Lector.leerCartola(paraLeer.texto, { hoy: Datos.hoyISO() });
    if (cartola.filas.length >= 3) {
      cerrarHojaSinSoltarAdjuntos('telonMovimiento');
      abrirRevisionDeCartola(cartola.filas, paraLeer.nombre);
      return;
    }

    const propuesta = Lector.leerComprobante(paraLeer.texto, {
      hoy: Datos.hoyISO(),
      fechaAlternativa: paraLeer.fechaFoto,
    });
    aplicarLectura(propuesta, avisoDelArchivo);
  }

  /** Cierra el formulario dejando los respaldos vivos (van a otra ventana). */
  function cerrarHojaSinSoltarAdjuntos(id) {
    const pendientes = vista.adjuntosPendientes;
    vista.adjuntosPendientes = [];
    cerrarHoja(id);
    vista.adjuntosPendientes = pendientes;
  }

  /**
   * Rellena el formulario con lo que se entendió y deja constancia.
   * @param origen 'archivo' o 'texto', solo para nombrarlo bien en pantalla
   */
  function aplicarLectura(propuesta, avisoExtra, origen) {
    // guardamos lo que había, para que "lo lleno yo" no borre lo tipeado
    vista.antesDeLeer = {
      monto: $$$('campoMonto').value,
      nota: $$$('campoNota').value,
      fecha: $$$('campoFecha').value,
      tipo: vista.tipo,
      categoria: vista.categoria,
    };

    // Solo le damos vuelta el tipo si el papel de verdad lo dice. Si no
    // dice nada, mandas tú: ya lo habías elegido antes de adjuntar.
    if (propuesta.tipoDetectado && propuesta.tipo !== vista.tipo) fijarTipo(propuesta.tipo);
    if (propuesta.monto) $$$('campoMonto').value = propuesta.monto;
    if (propuesta.fecha) $$$('campoFecha').value = propuesta.fecha;
    if (propuesta.nota && !$$$('campoNota').value) $$$('campoNota').value = propuesta.nota;
    if (propuesta.categoria) {
      vista.categoria = propuesta.categoria;
      dibujarCategorias();
    }

    mostrarLectura(propuesta, avisoExtra, origen);
  }

  const ROTULO_CAMPO = {
    monto: 'El monto',
    fecha: 'La fecha',
    tipo: 'Si entró o salió',
    categoria: 'La categoría',
  };

  /** El panel verde que explica de dónde salió cada dato. */
  function mostrarLectura(propuesta, avisoExtra, origen) {
    const caja = $$$('resultadoLectura');
    const deDonde = origen === 'texto' ? 'del texto que pegaste' : 'del archivo';

    if (!propuesta || !propuesta.encontrados) {
      if (!avisoExtra) { caja.hidden = true; return; }
      caja.hidden = false;
      caja.innerHTML = `<strong>Guardamos el respaldo</strong>${esc(avisoExtra)}`;
      return;
    }

    const lineas = propuesta.evidencia
      .filter(e => ROTULO_CAMPO[e.campo])
      .map(e => `<li>${esc(ROTULO_CAMPO[e.campo])}
                     <span class="de-donde">← ${esc(e.linea)}</span></li>`)
      .join('');

    // Falta el monto y hay que decirlo, pero una sola vez: el aviso del
    // archivo ("de una foto no se puede leer el monto") ya lo explica.
    const faltaElMonto = !propuesta.monto && !avisoExtra
      ? `<p style="margin:8px 0 0">El monto no aparecía ${esc(deDonde)}, así que ese lo pones tú.</p>`
      : '';

    caja.hidden = false;
    caja.innerHTML = `
      <strong>Esto sacamos ${esc(deDonde)}</strong>
      <ul>${lineas}</ul>
      ${faltaElMonto}
      ${avisoExtra ? `<p style="margin:8px 0 0">${esc(avisoExtra)}</p>` : ''}
      <button type="button" class="boton fantasma chico" id="botonDeshacerLectura">
        Prefiero llenarlo yo
      </button>`;
  }

  /** Devuelve el formulario a como estaba antes de leer el archivo. */
  function deshacerLectura() {
    const antes = vista.antesDeLeer;
    if (!antes) return;
    $$$('campoMonto').value = antes.monto;
    $$$('campoNota').value = antes.nota;
    $$$('campoFecha').value = antes.fecha;
    vista.categoria = antes.categoria;
    if (antes.tipo !== vista.tipo) fijarTipo(antes.tipo);
    else dibujarCategorias();
    vista.antesDeLeer = null;
    $$$('resultadoLectura').hidden = true;
    avisar('Listo, los campos quedaron como estaban');
  }

  /* ---------------- Ver un respaldo ya guardado ---------------- */

  async function abrirVisorDeAdjuntos(movimientoId) {
    const mov = Datos.obtener().movimientos.find(m => m.id === movimientoId);
    if (!mov) return;

    // Sin respaldos, el clip no abre una ventana vacía: va derecho a
    // elegir el archivo, que es lo único que se puede hacer ahí.
    if (!(mov.adjuntos || []).length) {
      vista.adjuntandoA = movimientoId;
      $$$('archivoRespaldoSuelto').click();
      return;
    }

    $$$('visorAdjunto').innerHTML = '<p class="ayuda">Abriendo…</p>';
    abrirHoja('telonAdjunto');
    await pintarVisor(movimientoId);
  }

  /** Dibuja el contenido del visor. Separado de abrirlo, para poder
      refrescarlo al agregar un respaldo sin apilar otra ventana. */
  async function pintarVisor(movimientoId) {
    const mov = Datos.obtener().movimientos.find(m => m.id === movimientoId);
    if (!mov) return;

    const visor = $$$('visorAdjunto');
    $$$('tituloAdjunto').textContent =
      mov.adjuntos.length === 1 ? 'El respaldo' : `Los ${mov.adjuntos.length} respaldos`;

    const partes = [];
    for (const ficha of mov.adjuntos) {
      const registro = await Adjuntos.obtener(ficha.id);

      if (!registro) {
        // El movimiento llegó por la nube, pero el archivo no: los
        // respaldos no viajan. Decirlo es mejor que mostrar un hueco.
        partes.push(`
          <div class="consejo aviso" style="margin-bottom:12px">
            <strong>${esc(ficha.nombre)}</strong>
            Este respaldo se quedó en el aparato donde lo sacaste. Las fotos y los archivos no
            suben a la nube: solo viajan tus movimientos.
          </div>`);
        continue;
      }

      const url = URL.createObjectURL(registro.blob);
      // claseDe espera un File (name/type); la bodega guarda nombre/tipo
      const clase = Archivos.claseDe({ name: registro.nombre, type: registro.tipo });
      const encabezado = `
        <p class="ayuda" style="margin:14px 0 6px">
          ${esc(registro.nombre)} · ${esc(Archivos.pesoLegible(registro.tamano))}
        </p>`;

      if (clase === 'imagen') {
        partes.push(encabezado + `<img src="${url}" alt="${esc(registro.nombre)}">`);
      } else if (clase === 'texto') {
        const texto = await registro.blob.text();
        partes.push(encabezado
          + `<div class="texto-archivo">${esc(texto.slice(0, 4000))}</div>`);
      } else {
        // Un PDF no se puede incrustar dentro de la app instalada sin que
        // se note el navegador, así que se ofrece abrirlo aparte.
        partes.push(encabezado + `
          <a class="boton secundario" href="${url}" target="_blank" rel="noopener"
             style="display:block; text-align:center; text-decoration:none">
            Abrir ${esc(registro.nombre)}
          </a>`);
      }
    }

    visor.innerHTML = partes.join('') + `
      <button type="button" class="boton secundario" data-agregar-respaldo="${esc(mov.id)}"
              style="margin-top:16px">
        📎 Agregar otro respaldo
      </button>
      <button type="button" class="boton fantasma chico" data-quitar-respaldos="${esc(mov.id)}"
              style="margin-top:8px">
        Quitar los respaldos de este movimiento
      </button>`;
  }

  /**
   * Le cuelga archivos a un movimiento que YA está anotado.
   * Acá no se lee nada: el movimiento existe y sus números están puestos.
   * Cambiárselos por lo que diga un papel sería pasar por encima de algo
   * que la persona ya decidió.
   */
  async function adjuntarAMovimientoExistente(movimientoId, archivos) {
    if (!Adjuntos.disponible()) {
      avisar('Este navegador no nos deja guardar archivos');
      return;
    }
    avisar('Guardando el respaldo…');

    const fichas = [];
    for (const archivo of archivos) {
      const leido = await Archivos.leer(archivo);
      const ficha = await Adjuntos.guardar({
        id: 'adj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        movimientoId,
        nombre: leido.nombre,
        tipo: leido.tipo,
        blob: leido.blob,
      });
      if (ficha) fichas.push(ficha);
      else avisar(`"${leido.nombre}" pesa más de ${Archivos.pesoLegible(Adjuntos.MAXIMO_POR_ARCHIVO)}`);
    }

    if (!fichas.length) return;
    Datos.adjuntarAMovimiento(movimientoId, fichas);
    mostrarPesoDeRespaldos();
    dibujarMovimientos();
    // si el visor está abierto, que muestre lo recién agregado
    if ($$$('telonAdjunto').classList.contains('abierto')) await pintarVisor(movimientoId);
    avisar(fichas.length === 1 ? 'Respaldo guardado 📎' : `${fichas.length} respaldos guardados 📎`);
  }

  /* ---------------- Leer una cartola completa ---------------- */

  async function leerCartolaDeArchivo(archivo) {
    avisar('Leyendo la cartola…');
    const leido = await Archivos.leer(archivo);

    if (!leido.texto) {
      await Dialogos.avisar({
        titulo: 'No pudimos leer ese archivo',
        texto: leido.aviso
          || 'Ese archivo no trae texto adentro. Una cartola sirve si la bajas del banco '
           + 'en .csv o .txt, o si copias las líneas y las pegas en un archivo de texto.',
      });
      return;
    }

    const cartola = Lector.leerCartola(leido.texto, { hoy: Datos.hoyISO() });
    if (!cartola.filas.length) {
      // Distinguir los dos "no hay nada" importa: si las líneas estaban y
      // se fueron por venir con fecha de mañana, decir "no encontramos
      // nada" es mentira y deja a la persona sin saber qué hacer.
      await Dialogos.avisar(cartola.futuras ? {
        titulo: 'Esa cartola viene adelantada',
        texto: `Encontramos ${cartola.futuras} `
             + `${cartola.futuras === 1 ? 'movimiento' : 'movimientos'}, pero con fecha `
             + 'posterior a hoy, así que no los anotamos: serían gastos que todavía no pasaron.\n\n'
             + 'Si son cargos que vienen (una cuota, un pago automático), van a entrar solos '
             + 'cuando llegue el día. Vuelve a leer la cartola entonces.',
      } : {
        titulo: 'No encontramos movimientos ahí',
        texto: 'Buscamos líneas que tengan una fecha y un monto y no apareció ninguna. '
             + 'Si el archivo es un comprobante suelto, adjúntalo con el botón + al anotar '
             + 'el movimiento: ahí sí lo leemos.',
      });
      return;
    }

    abrirRevisionDeCartola(cartola.filas, leido.nombre, cartola.futuras);
  }

  function abrirRevisionDeCartola(filas, nombreArchivo, futuras) {
    // Cada fila se marca sola, salvo las que ya parecen anotadas.
    vista.cartola = filas.map((f, i) => {
      const repetido = Datos.movimientoParecido(f);
      return { ...f, indice: i, marcada: !repetido, repetido: Boolean(repetido) };
    });

    const repetidos = vista.cartola.filter(f => f.repetido).length;
    $$$('resumenCartola').textContent =
      `De ${nombreArchivo} sacamos ${filas.length} `
      + `${filas.length === 1 ? 'movimiento' : 'movimientos'}`
      + (repetidos ? `, y ${repetidos} ya ${repetidos === 1 ? 'estaba anotado' : 'estaban anotados'}` : '')
      + '.'
      + (futuras ? ` Dejamos fuera ${futuras} con fecha posterior a hoy.` : '');

    $$$('cuentaCartola').innerHTML = opcionesDeCuenta(vista.cuentaOrigen);
    dibujarCartola();
    abrirHoja('telonCartola');
  }

  function dibujarCartola() {
    const opcionesCategoria = (tipo, elegida) => {
      const lista = tipo === 'ingreso' ? Datos.CATEGORIAS_INGRESO : Datos.CATEGORIAS_GASTO;
      return lista.map(c =>
        `<option value="${c.id}" ${c.id === elegida ? 'selected' : ''}>${c.emoji} ${esc(c.nombre)}</option>`
      ).join('');
    };

    $$$('listaCartola').innerHTML = vista.cartola.map(f => `
      <div class="fila-cartola ${f.repetido ? 'repetido' : ''}">
        <input type="checkbox" data-fila="${f.indice}" ${f.marcada ? 'checked' : ''}
               aria-label="Anotar este movimiento">
        <div class="cuerpo">
          <div class="encabezado">
            <span class="nombre">${esc(f.nota || 'Sin detalle')}</span>
            <span class="monto ${f.tipo}">${f.tipo === 'ingreso' ? '+' : '-'}${esc(dinero(f.monto))}</span>
          </div>
          <div class="detalle">
            ${esc(Datos.fechaLegible(f.fecha))}
            ${f.repetido ? '<span class="pastilla-repetido">repetido</span>' : ''}
          </div>
          <select data-categoria-fila="${f.indice}">
            ${opcionesCategoria(f.tipo, f.categoria || (f.tipo === 'ingreso' ? 'otro-in' : 'otro'))}
          </select>
        </div>
      </div>`).join('');

    const marcadas = vista.cartola.filter(f => f.marcada).length;
    $$$('botonGuardarCartola').textContent = marcadas
      ? `Anotar ${marcadas} ${marcadas === 1 ? 'movimiento' : 'movimientos'}`
      : 'No hay nada marcado';
    $$$('botonGuardarCartola').disabled = !marcadas;
  }

  function guardarCartola() {
    const cuenta = $$$('cuentaCartola').value;
    const elegidas = vista.cartola.filter(f => f.marcada);
    if (!elegidas.length || !cuenta) return;

    const r = Datos.agregarVarios(elegidas.map(f => ({
      tipo: f.tipo,
      monto: f.monto,
      categoria: f.categoria || (f.tipo === 'ingreso' ? 'otro-in' : 'otro'),
      nota: f.nota,
      fecha: f.fecha,
      cuentaOrigen:  f.tipo === 'ingreso' ? null : cuenta,
      cuentaDestino: f.tipo === 'gasto'   ? null : cuenta,
    })));

    cerrarHoja('telonCartola');
    vista.cartola = [];

    // Saltamos al mes del primer movimiento anotado, o el usuario no ve nada.
    if (r.anotados.length) {
      const [a, m] = r.anotados[0].fecha.split('-').map(Number);
      vista.anio = a; vista.mes = m - 1;
    }
    dibujar();

    if (r.errores.length) {
      avisar(`${r.anotados.length} anotados · ${r.errores.length} no se pudieron`);
    } else {
      avisar(`${r.anotados.length} ${r.anotados.length === 1 ? 'movimiento anotado' : 'movimientos anotados'} ✅`);
    }
  }

  /* ---------------- Arrastrar y pegar (solo computador) ----------------

     En el teléfono no existe ninguna de las dos cosas, así que esto no
     le quita nada a nadie: es comodidad de escritorio. Arrastrar un
     comprobante encima de la app o pegar una captura con Ctrl+V hace lo
     mismo que el botón de adjuntar, sin ir a buscar el archivo.        */

  function prepararArrastreDeArchivos() {
    const marco = $$$('app') || document.body;

    // Sin esto el navegador se lleva el archivo a una pestaña nueva y
    // te saca de la app, que es exactamente lo contrario de lo que
    // esperabas al soltarlo.
    ['dragenter', 'dragover'].forEach(evento =>
      marco.addEventListener(evento, e => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        marco.classList.add('recibiendo-archivo');
      }));

    ['dragleave', 'drop'].forEach(evento =>
      marco.addEventListener(evento, e => {
        // dragleave salta también al pasar por encima de los hijos: solo
        // apagamos el aviso cuando el puntero salió del marco de verdad
        if (evento === 'dragleave' && e.relatedTarget && marco.contains(e.relatedTarget)) return;
        marco.classList.remove('recibiendo-archivo');
      }));

    marco.addEventListener('drop', async e => {
      const archivos = [...((e.dataTransfer || {}).files || [])];
      if (!archivos.length) return;
      e.preventDefault();
      await recibirArchivosDeAfuera(archivos);
    });

    // Pegar una captura de pantalla del comprobante con Ctrl+V.
    document.addEventListener('paste', async e => {
      // si estás escribiendo en un campo, pegar es pegar texto y punto
      const donde = document.activeElement;
      if (donde && /^(INPUT|TEXTAREA|SELECT)$/.test(donde.tagName)) return;

      const archivos = [...((e.clipboardData || {}).files || [])];
      if (archivos.length) {
        e.preventDefault();
        await recibirArchivosDeAfuera(archivos);
        return;
      }

      // Texto pegado: es el camino de las capturas de pantalla, donde el
      // OCR ya lo hizo el propio teléfono y lo que llega es el resultado.
      const texto = e.clipboardData ? e.clipboardData.getData('text') : '';
      if (!texto || texto.trim().length < 12) return;
      e.preventDefault();
      if (!$$$('telonMovimiento').classList.contains('abierto')) {
        abrirFormularioMovimiento();
        await new Promise(r => setTimeout(r, 280));
      }
      leerTextoPegado(texto);
    });
  }

  const traeArchivos = e =>
    Boolean(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));

  /**
   * Un archivo que llegó arrastrado o pegado. Si el formulario ya está
   * abierto se suma ahí; si no, lo abrimos nosotros. No adivinamos si es
   * cartola o comprobante: de eso ya se encarga adjuntarArchivos().
   */
  async function recibirArchivosDeAfuera(archivos) {
    if (!$$$('telonMovimiento').classList.contains('abierto')) {
      abrirFormularioMovimiento();
      await new Promise(r => setTimeout(r, 280));   // que alcance a entrar la hoja
    }
    await adjuntarArchivos(archivos);
  }

  /* ---------------- Cuánto ocupan los respaldos ---------------- */

  function mostrarPesoDeRespaldos() {
    const caja = $$$('pesoRespaldos');
    if (!caja) return;
    Adjuntos.peso().then(({ cantidad, bytes }) => {
      caja.textContent = cantidad
        ? `Tienes ${cantidad} ${cantidad === 1 ? 'respaldo guardado' : 'respaldos guardados'} `
          + `(${Archivos.pesoLegible(bytes)}). Las fotos y los archivos se quedan en este `
          + 'aparato: ni suben a la nube ni entran en la copia de seguridad.'
        : 'Las fotos y archivos que adjuntes se quedan en este aparato: ni suben a la nube '
          + 'ni entran en la copia de seguridad.';
    });
  }

  /* ---------------- 10. Registro ----------------
     No es una cuenta: no hay servidor ni contraseña. Solo pedimos
     el correo una vez, lo guardamos en este dispositivo y con eso
     personalizamos la app. Quien se registra entra directo, sin
     pasar por el tutorial.                                       */

  function mostrarRegistro() {
    $$$('bienvenida').hidden = false;
    // el foco automático molesta en celular (abre el teclado de golpe),
    // así que solo lo hacemos en pantallas grandes
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

  function mostrarErrorCodigo(mensaje) {
    const caja = $$$('errorCodigo');
    caja.textContent = mensaje;
    caja.hidden = !mensaje;
    $$$('campoCodigo').classList.toggle('con-error', Boolean(mensaje));
  }

  /**
   * La bienvenida tiene dos pasos cuando hay nube:
   *   'correo' → escribes tu correo y te mandamos un código
   *   'codigo' → escribes el código y entras
   * Sin nube configurada no hay segundo paso: el correo se anota en el
   * teléfono y listo, como toda la vida.
   */
  function fijarPasoDeEntrada(paso) {
    vista.pasoEntrada = paso;
    const enCodigo = paso === 'codigo';

    $$$('bloqueCodigo').hidden = !enCodigo;
    $$$('campoCorreo').readOnly = enCodigo;
    $$$('botonEntrar').textContent = enCodigo ? 'Entrar' : 'Mándame el código';
    $$$('botonReenviar').hidden = !enCodigo;
    $$$('botonOtroCorreo').hidden = !enCodigo;

    mostrarErrorCodigo('');
    if (enCodigo) {
      $$$('campoCodigo').value = '';
      setTimeout(() => $$$('campoCodigo').focus(), 200);
    }
  }

  async function enviarRegistro(evento) {
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

    // Sin nube configurada, entrar es lo mismo de siempre: anotar el
    // correo en este teléfono y seguir.
    if (!Nube.configurada()) {
      entrarSinNube(correo);
      return;
    }

    if (vista.pasoEntrada === 'codigo') {
      await entrarConElCodigo(correo);
      return;
    }
    await pedirElCodigo(correo);
  }

  /** Primer paso: que le manden el código al correo. */
  async function pedirElCodigo(correo) {
    const boton = $$$('botonEntrar');
    boton.disabled = true;
    boton.textContent = 'Mandando…';

    try {
      await Nube.mandarCodigo(correo);
    } catch (error) {
      mostrarErrorCorreo('⚠️ ' + error.message);
      return;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Mándame el código';
    }

    fijarPasoDeEntrada('codigo');
    $$$('ayudaCodigo').textContent =
      'Te lo mandamos a ' + correo + '. Llega en menos de un minuto; '
      + 'si no lo ves, revisa la carpeta de spam.';
    avisar('Código enviado 📬');
  }

  /** Segundo paso: cambiar el código por una sesión. */
  async function entrarConElCodigo(correo) {
    const codigo = $$$('campoCodigo').value.replace(/\D/g, '');
    if (codigo.length < 6) {
      mostrarErrorCodigo('⚠️ El código son 6 números');
      $$$('campoCodigo').focus();
      return;
    }
    mostrarErrorCodigo('');

    const boton = $$$('botonEntrar');
    boton.disabled = true;
    boton.textContent = 'Entrando…';

    try {
      await Nube.entrarConCodigo(correo, codigo);
    } catch (error) {
      mostrarErrorCodigo('⚠️ ' + error.message);
      return;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }

    await terminarDeEntrar(correo);
  }

  /** Lo que pasa una vez que ya hay sesión, venga del código o del enlace. */
  async function terminarDeEntrar(correo) {
    // El correo puede venir de dos lados: lo escribió la persona, o lo
    // leímos del token del enlace. Si por lo que sea no llega ninguno,
    // no rompemos nada: la sesión ya existe, que es lo que importa.
    const limpio = String(correo || '').trim();
    if (limpio && Datos.correoValido(limpio)) {
      try { Datos.registrar(limpio); } catch (_) { /* seguimos igual */ }
    }

    await reconciliarConLaNube();

    fijarPasoDeEntrada('correo');
    ocultarRegistro();
    actualizarSaludo();
    cargarAjustesEnFormulario();
    dibujar();

    const nombre = Datos.obtener().ajustes.nombre;
    avisar(nombre ? `Bienvenido, ${nombre} 👋` : 'Bienvenido 👋');
  }

  /** El camino de siempre: sin cuenta, todo en este teléfono. */
  function entrarSinNube(correo) {
    Datos.registrar(correo);      // esto también marca el tutorial como visto
    ocultarRegistro();
    actualizarSaludo();
    cargarAjustesEnFormulario();

    const nombre = Datos.obtener().ajustes.nombre;
    avisar(nombre ? `Bienvenido, ${nombre} 👋` : 'Bienvenido 👋');
  }

  /**
   * Recién entrado, puede haber datos en los dos lados. En vez de
   * pisar uno en silencio, le contamos a la persona qué hay en cada
   * lado y que elija. Perder movimientos sin avisar sería imperdonable.
   */
  async function reconciliarConLaNube() {
    let enLaNube = null;
    try {
      enLaNube = await Nube.bajar();
    } catch (error) {
      avisar('No pudimos leer la nube ahora. Tus datos siguen en el teléfono.');
      return;
    }

    const locales = Datos.obtener().movimientos.length;
    const remotos = (enLaNube && enLaNube.datos && Array.isArray(enLaNube.datos.movimientos))
      ? enLaNube.datos.movimientos.length : 0;

    // La nube está vacía: subimos lo que hay acá y listo.
    if (!enLaNube || !enLaNube.datos) { await Nube.subirAhora(); return; }

    // Este teléfono está vacío: bajamos sin preguntar, no hay nada que perder.
    if (locales === 0) { await traerDeLaNube(true); return; }

    // Hay datos en los dos lados. Que elija.
    const quedarseConLaNube = await Dialogos.confirmar({
      titulo: '¿Con cuáles nos quedamos?',
      texto: 'En este teléfono hay ' + locales + (locales === 1 ? ' movimiento' : ' movimientos')
        + ' y en tu nube hay ' + remotos + '.\n\n'
        + 'Los que no elijas se pierden. Si tienes dudas, cancela y descarga primero '
        + 'una copia desde Ajustes.',
      aceptar: 'Los de la nube',
      cancelar: 'Los de este teléfono',
    });

    if (quedarseConLaNube) await traerDeLaNube(true);
    else await Nube.subirAhora();
  }

  /**
   * Al abrir, la nube compara quién tiene lo más nuevo. Si los dos
   * lados cambiaron desde la última vez, no elige sola: pregunta.
   * No traba el arranque: corre por detrás.
   */
  async function revisarNubeAlAbrir() {
    if (!Nube.configurada() || !Nube.haySesion() || !Datos.estaRegistrado()) return;

    const veredicto = await Nube.revisarAlAbrir();

    if (veredicto.accion === 'bajar') {
      if (await traerDeLaNube(true)) avisar('Traído de tu nube ☁️');
      return;
    }

    if (veredicto.accion === 'conflicto') {
      const quedarseConLaNube = await Dialogos.confirmar({
        titulo: 'Hay dos versiones',
        texto: 'Anotaste cosas en este teléfono y también en otro lado desde la última vez '
          + 'que se pusieron de acuerdo.\n\n'
          + 'Acá hay ' + veredicto.movimientosAca + ' y en tu nube hay '
          + veredicto.movimientosAlla + '. Los que no elijas se pierden.',
        aceptar: 'Los de la nube',
        cancelar: 'Los de este teléfono',
      });

      if (quedarseConLaNube) {
        if (await traerDeLaNube(true)) avisar('Traído de tu nube ☁️');
      } else {
        // subirAhora se encarga de dejar la marca al día
        await Nube.subirAhora();
        avisar('Guardado en tu nube ☁️');
      }
    }
  }

  /** Reemplaza lo del teléfono por lo que hay en la nube. */
  async function traerDeLaNube(silencioso) {
    let enLaNube;
    try {
      enLaNube = await Nube.bajar();
    } catch (error) {
      avisar(error.message);
      return false;
    }
    if (!enLaNube || !enLaNube.datos) {
      avisar('Tu nube todavía está vacía');
      return false;
    }
    try {
      // importar valida y migra, igual que al restaurar un archivo
      Datos.importar(JSON.stringify(enLaNube.datos));
    } catch (error) {
      avisar(error.message);
      return false;
    }
    cargarAjustesEnFormulario();
    actualizarSaludo();
    dibujar();
    if (!silencioso) avisar('Datos traídos de la nube ☁️');
    return true;
  }

  /* ---------------- 11. Tutorial ---------------- */
  const PASOS = [
    {
      titulo: 'Bienvenido a Mi Bolsillo 👋',
      cuerpo: `<p>Esta app hace tres cosas:</p>
        <ul>
          <li><strong>Anota</strong> lo que entra y lo que sale.</li>
          <li><strong>Te lo muestra</strong> en gráficos fáciles de leer.</li>
          <li><strong>Te enseña</strong> técnicas de ahorro y te dice cuál te conviene según tus números.</li>
        </ul>
        <p>Todo se guarda solo en tu dispositivo. No hay cuenta, ni clave, ni nadie mirando.</p>`,
    },
    {
      titulo: 'Lo único que tienes que hacer 📝',
      cuerpo: `<p>Toca el botón <strong>+</strong> verde y anota lo que gastaste. Toma cinco segundos.</p>
        <p>No intentes anotar el mes completo de memoria el primer día. Anota lo de <em>hoy</em>,
        y mañana lo de mañana. En una semana ya vas a ver patrones que hoy no ves.</p>`,
    },
    {
      titulo: 'Lee tus gráficos 📊',
      cuerpo: `<ul>
          <li><strong>La dona</strong> te dice en qué se te va la plata. La porción más grande es donde tienes más que ganar si quieres recortar.</li>
          <li><strong>Las barras</strong> comparan mes con mes. Ahí se ve si vas mejorando.</li>
          <li><strong>Tu reparto</strong> compara tus gastos con la regla 50/30/20, un estándar simple y bastante útil.</li>
        </ul>`,
    },
    {
      titulo: 'Ponte una meta 🎯',
      cuerpo: `<p>Ahorrar "por si acaso" cuesta. Ahorrar para algo con nombre cuesta mucho menos.</p>
        <p>Si no sabes por dónde partir, la mejor primera meta casi siempre es la misma:
        <strong>un fondo de emergencia</strong> equivalente a un mes de tus gastos básicos.
        Es lo que evita que un imprevisto se convierta en deuda.</p>
        <p>En la pestaña <strong>Aprender</strong> hay once técnicas explicadas en simple. No las leas todas
        de una: elige una y pruébala un mes.</p>`,
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
    descargar(blob, `mi-bolsillo-${Datos.hoyISO()}.json`);
    Datos.marcarRespaldo();
    avisar('Copia descargada ✅');
  }

  /* ---------------- 12b. Las planillas de Excel ----------------

     Son dos salidas distintas:
       - "Descargar en Excel" (Ajustes): todo lo anotado, con gráficos.
       - "Análisis del mes" (el selector de mes): el cierre de un mes,
         con su aspecto a mejorar.

     Los dos comparten las piezas de abajo. Ningún número se calcula
     acá: todos salen del motor, igual que en pantalla. */

  const ROTULO_TIPO = {
    ingreso: 'Ingreso', gasto: 'Gasto', transferencia: 'Movida entre cuentas',
  };

  const nombreDeCuenta = id => {
    const c = Datos.cuentaPorId(id);
    return c ? c.nombre : '';
  };

  /** Las columnas y filas de una lista de movimientos. */
  function hojaDeMovimientos(nombre, lista) {
    return {
      nombre,
      columnas: [
        { titulo: 'Fecha', ancho: 12, tipo: 'fecha' },
        { titulo: 'Mes', ancho: 16 },
        { titulo: 'Tipo', ancho: 20 },
        { titulo: 'Categoría', ancho: 20 },
        { titulo: 'Monto', ancho: 14, tipo: 'pesos' },
        { titulo: 'Sale de', ancho: 20 },
        { titulo: 'Entra a', ancho: 20 },
        { titulo: 'Nota', ancho: 34 },
      ],
      filas: [...lista]
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
        .map(m => {
          const partes = String(m.fecha).split('-').map(Number);
          return [
            m.fecha,
            Datos.nombreMes(partes[0], partes[1] - 1),
            ROTULO_TIPO[m.tipo] || m.tipo,
            m.tipo === 'transferencia' ? '' : Datos.categoriaPorId(m.categoria).nombre,
            m.monto,
            nombreDeCuenta(m.cuentaOrigen),
            nombreDeCuenta(m.cuentaDestino),
            m.nota || m.descripcion || '',
          ];
        }),
    };
  }

  /**
   * La hoja de categorías con su gráfico de dona. El porcentaje va
   * como número entre 0 y 1: Excel le pone el % al mostrarlo, y así
   * se puede seguir haciendo cuentas con él.
   */
  function hojaDeCategorias(nombre, titulo, categorias, movimientos) {
    const total = categorias.reduce((suma, c) => suma + c.monto, 0);

    const cuenta = new Map();
    for (const m of movimientos) {
      cuenta.set(m.categoria, (cuenta.get(m.categoria) || 0) + 1);
    }

    const filas = categorias.map(c => {
      const veces = cuenta.get(c.id) || 0;
      return [
        (c.emoji ? c.emoji + ' ' : '') + c.nombre,
        c.monto,
        total > 0 ? c.monto / total : 0,
        veces,
        veces > 0 ? Math.round(c.monto / veces) : 0,
      ];
    });

    const ultimaFila = filas.length + 1;

    return {
      nombre,
      columnas: [
        { titulo: 'Categoría', ancho: 24 },
        { titulo: 'Total', ancho: 15, tipo: 'pesos' },
        { titulo: 'Del total', ancho: 11, tipo: 'porcentaje' },
        { titulo: 'Veces', ancho: 9, tipo: 'numero' },
        { titulo: 'Promedio', ancho: 15, tipo: 'pesos' },
      ],
      filas,
      graficos: filas.length ? [{
        tipo: 'dona',
        titulo,
        categorias: 'A2:A' + ultimaFila,
        valores: 'B2:B' + ultimaFila,
        nombreSerie: 'B1',
        colores: categorias.map(c => c.color),
        cacheCategorias: categorias.map(c => (c.emoji ? c.emoji + ' ' : '') + c.nombre),
        cacheValores: categorias.map(c => c.monto),
        ancla: { columna: 6, fila: 0 },
        ancho: 10, alto: Math.max(16, filas.length + 4),
      }] : [],
    };
  }

  /** La hoja de mes a mes con su gráfico de barras. */
  function hojaResumenMensual(nombre, historial) {
    const filas = historial.map(m => [
      Datos.nombreMes(m.anio, m.mes),
      m.ingresos, m.gastos, m.saldo,
      m.tasaAhorro / 100, m.cantidad,
    ]);
    const ultimaFila = filas.length + 1;

    return {
      nombre,
      columnas: [
        { titulo: 'Mes', ancho: 18 },
        { titulo: 'Entró', ancho: 15, tipo: 'pesos' },
        { titulo: 'Salió', ancho: 15, tipo: 'pesos' },
        { titulo: 'Diferencia', ancho: 15, tipo: 'pesos' },
        { titulo: 'Tasa de ahorro', ancho: 15, tipo: 'porcentaje' },
        { titulo: 'Movimientos', ancho: 13, tipo: 'numero' },
      ],
      filas,
      graficos: filas.length ? [{
        tipo: 'barras',
        titulo: 'Lo que entró y lo que salió, mes a mes',
        categorias: 'A2:A' + ultimaFila,
        cacheCategorias: historial.map(m => Datos.nombreMes(m.anio, m.mes)),
        series: [
          {
            ref: 'B2:B' + ultimaFila, nombreRef: 'B1', nombre: 'Entró',
            color: '#10a072', cache: historial.map(m => m.ingresos),
          },
          {
            ref: 'C2:C' + ultimaFila, nombreRef: 'C1', nombre: 'Salió',
            color: '#e2564d', cache: historial.map(m => m.gastos),
          },
        ],
        ancla: { columna: 7, fila: 0 },
        ancho: 13, alto: Math.max(18, filas.length + 4),
      }] : [],
    };
  }

  /**
   * El reparto 50/30/20, en filas listas para una hoja.
   * El nombre va corto a propósito: es lo que después aparece en la
   * leyenda del gráfico de dona, y ahí un nombre largo no se lee.
   * La explicación va en su propia columna.
   */
  function filasDeReparto(reparto) {
    return [
      ['Necesidades', reparto.necesidades.monto, reparto.necesidades.pct / 100, 0.5,
        'Arriendo, comida, transporte, cuentas, salud'],
      ['Gustos', reparto.deseos.monto, reparto.deseos.pct / 100, 0.3,
        'Salidas, ropa, delivery, streaming'],
      ['Para ti', reparto.ahorro.monto, reparto.ahorro.pct / 100, 0.2,
        'Ahorro, fondo de emergencia, pagar deudas'],
    ];
  }

  /** Las cuatro filas del reparto listas para pegar en una hoja. */
  const bloqueDeReparto = reparto => [
    [['Grupo', 'subtitulo'], ['Monto', 'subtitulo'], ['Tuyo', 'subtitulo'],
     ['Ideal', 'subtitulo'], ['Qué entra acá', 'subtitulo']],
    ...filasDeReparto(reparto).map(f => [
      f[0], [f[1], 'pesos'], [f[2], 'porcentaje'], [f[3], 'porcentaje'], f[4],
    ]),
  ];

  /* ---------------- La planilla completa ---------------- */

  /**
   * Todo lo anotado, en siete hojas y con gráficos. A diferencia de
   * la copia de seguridad (el .json), esto es para mirar y hacer
   * cuentas aparte: la app no lo vuelve a leer.
   */
  function exportarExcel() {
    const estado = Datos.obtener();
    const movimientos = estado.movimientos || [];

    if (!movimientos.length && !(estado.cuentas || []).length) {
      avisar('Todavía no hay nada que exportar');
      return;
    }

    const r = Datos.resumenDelMes(vista.anio, vista.mes);
    const reparto = Datos.reparto503020(vista.anio, vista.mes);
    const mesActual = Datos.nombreMes(vista.anio, vista.mes);
    const saldos = Datos.saldosDeCuentas();

    // ---- Hoja 1: la portada ----
    const portada = {
      nombre: 'Resumen',
      sinEncabezado: true, sinCuadricula: true,
      columnas: [{ ancho: 34 }, { ancho: 18 }, { ancho: 12 }, { ancho: 12 }, { ancho: 44 }],
      combinar: ['A1:E1'],
      altoDeFila: { 0: 26 },
      filas: [
        [['Mi Bolsillo · todos tus datos', 'titulo']],
        ['Planilla generada el', [Datos.hoyISO(), 'fecha']],
        [],
        [['Hoy', 'subtitulo']],
        ['Lo que tienes menos lo que debes', [Datos.patrimonio(), 'pesosGrande']],
        ['Cuentas activas', [saldos.length, 'numero']],
        ['Movimientos anotados en total', [movimientos.length, 'numero']],
        [],
        [[mesActual, 'subtitulo']],
        ['Entró', [r.ingresos, 'pesos']],
        ['Salió', [r.gastos, 'pesos']],
        ['Diferencia', [r.saldo, 'pesos']],
        ['Tasa de ahorro', [r.tasaAhorro / 100, 'porcentaje']],
        ['Movimientos del mes', [r.cantidad, 'numero']],
        [],
        [['Tu reparto del mes', 'subtitulo']],
        ...bloqueDeReparto(reparto),
      ],
      graficos: r.gastos > 0 ? [{
        tipo: 'dona',
        titulo: 'Tu reparto de ' + mesActual,
        categorias: 'A18:A20',
        valores: 'B18:B20',
        colores: ['#3b7dd8', '#e8a33d', '#10a072'],
        cacheCategorias: ['Necesidades', 'Gustos', 'Para ti'],
        cacheValores: [reparto.necesidades.monto, reparto.deseos.monto, reparto.ahorro.monto],
        ancla: { columna: 5, fila: 2 }, ancho: 9, alto: 16,
      }] : [],
    };

    // ---- Hoja 3: en qué se te fue ----
    const categorias = Datos.gastosPorCategoria(vista.anio, vista.mes);
    const delMes = Datos.movimientosDelMes(vista.anio, vista.mes);
    const hojaCategorias = hojaDeCategorias(
      'Gastos por categoría',
      'En qué se te fue en ' + mesActual,
      categorias, delMes
    );

    // ---- Hoja 4: dónde está la plata hoy ----
    const hojaCuentas = {
      nombre: 'Cuentas',
      columnas: [
        { titulo: 'Cuenta', ancho: 24 },
        { titulo: 'Tipo', ancho: 22 },
        { titulo: 'Saldo inicial', ancho: 16, tipo: 'pesos' },
        { titulo: 'Saldo hoy', ancho: 16, tipo: 'pesos' },
        { titulo: 'Movimientos', ancho: 13, tipo: 'numero' },
        { titulo: 'Estado', ancho: 14 },
      ],
      filas: (estado.cuentas || []).map(c => [
        c.nombre,
        Datos.tipoCuenta(c.tipo).nombre,
        c.saldoInicial,
        Datos.saldoDeCuenta(c.id),
        Datos.movimientosDeCuenta(c.id),
        c.activa === false ? 'Archivada' : 'Activa',
      ]),
    };

    // ---- Hoja 5: metas ----
    const hojaMetas = {
      nombre: 'Metas',
      columnas: [
        { titulo: 'Meta', ancho: 26 },
        { titulo: 'Objetivo', ancho: 16, tipo: 'pesos' },
        { titulo: 'Llevas', ancho: 16, tipo: 'pesos' },
        { titulo: 'Falta', ancho: 16, tipo: 'pesos' },
        { titulo: 'Avance', ancho: 12, tipo: 'porcentaje' },
        { titulo: 'Para cuándo', ancho: 14, tipo: 'fecha' },
      ],
      filas: (estado.metas || []).map(m => [
        ((m.emoji ? m.emoji + ' ' : '') + m.nombre),
        m.montoObjetivo,
        m.montoActual,
        Math.max(0, m.montoObjetivo - m.montoActual),
        m.montoObjetivo > 0 ? Math.min(1, m.montoActual / m.montoObjetivo) : 0,
        m.fechaObjetivo || '',
      ]),
    };

    // ---- Hoja 6: topes ----
    const topes = Datos.estadoPresupuestos(vista.anio, vista.mes);
    const hojaTopes = {
      nombre: 'Topes',
      columnas: [
        { titulo: 'Categoría', ancho: 24 },
        { titulo: 'Tope del mes', ancho: 16, tipo: 'pesos' },
        { titulo: 'Gastado', ancho: 16, tipo: 'pesos' },
        { titulo: 'Queda', ancho: 16, tipo: 'pesos' },
        { titulo: 'Usado', ancho: 11, tipo: 'porcentaje' },
      ],
      filas: topes.map(t => [
        (t.emoji ? t.emoji + ' ' : '') + t.nombre,
        t.tope, t.usado, t.tope - t.usado,
        t.tope > 0 ? t.usado / t.tope : 0,
      ]),
    };

    const hojas = [
      portada,
      hojaDeMovimientos('Movimientos', movimientos),
      hojaCategorias,
      hojaCuentas,
      hojaMetas,
      hojaTopes,
      hojaResumenMensual('Resumen mensual', Datos.historialMeses(vista.anio, vista.mes, 12)),
    ];

    entregarPlanilla(hojas, `mi-bolsillo-${Datos.hoyISO()}.xlsx`, 'Planilla descargada 📊');
  }

  /* ---------------- El análisis de un mes ---------------- */

  /**
   * El cierre de un mes: cómo te fue, cómo cambió respecto del mes
   * anterior, y qué conviene mirar.
   *
   * El "aspecto a mejorar" NO lo inventa esta función: sale de
   * Datos.sugerir(), el mismo motor determinístico que alimenta los
   * consejos de la pantalla de Inicio. Si no hay ninguna alerta, se
   * dice que no la hay en vez de inventar una.
   */
  function exportarAnalisisDelMes() {
    const anio = vista.anio;
    const mes = vista.mes;
    const nombre = Datos.nombreMes(anio, mes);

    const delMes = Datos.movimientosDelMes(anio, mes);
    if (!delMes.length) {
      avisar('En ' + nombre + ' no hay nada anotado todavía');
      return;
    }

    const r = Datos.resumenDelMes(anio, mes);
    const reparto = Datos.reparto503020(anio, mes);
    const categorias = Datos.gastosPorCategoria(anio, mes);
    const avisos = Datos.sugerir(anio, mes);
    const hormiga = Datos.gastosHormiga(anio, mes);

    // el mes anterior, para poder comparar
    const anterior = new Date(anio, mes - 1, 1);
    const rAnterior = Datos.resumenDelMes(anterior.getFullYear(), anterior.getMonth());
    const nombreAnterior = Datos.nombreMes(anterior.getFullYear(), anterior.getMonth());
    // sin mes anterior con datos no hay con qué comparar: mejor una
    // raya que un 0% que parece un dato
    const hayAnterior = rAnterior.cantidad > 0;
    const variacion = (ahora, antes) =>
      (hayAnterior && antes > 0) ? [(ahora - antes) / antes, 'porcentaje'] : '—';
    const siHay = (valor, tipo) => (hayAnterior ? [valor, tipo] : '—');

    // Lo que hay que mejorar es la primera alerta del motor. Si el mes
    // no dejó ninguna, igual hay algo que mirar: el grupo del reparto
    // que más se pasó de su ideal. No inventamos nada, solo elegimos
    // cuál de los números que ya calculó el motor conviene mostrar.
    const alertas = avisos.filter(a => a.tipo === 'alerta');
    const loBueno = avisos.find(a => a.tipo === 'bien') || null;
    const aMejorar = alertas[0] || mejorarDesdeElReparto(reparto, categorias);

    const filas = [
      [['Análisis de ' + nombre, 'titulo']],
      ['Generado el', [Datos.hoyISO(), 'fecha']],
      [],

      [['Cómo te fue', 'subtitulo']],
      [['', 'texto'], ['Este mes', 'subtitulo'], [nombreAnterior, 'subtitulo'],
       ['Cambio', 'subtitulo']],
      ['Entró', [r.ingresos, 'pesos'], siHay(rAnterior.ingresos, 'pesos'),
        variacion(r.ingresos, rAnterior.ingresos)],
      ['Salió', [r.gastos, 'pesos'], siHay(rAnterior.gastos, 'pesos'),
        variacion(r.gastos, rAnterior.gastos)],
      ['Diferencia', [r.saldo, 'pesos'], siHay(rAnterior.saldo, 'pesos'), ''],
      ['Tasa de ahorro', [r.tasaAhorro / 100, 'porcentaje'],
        siHay(rAnterior.tasaAhorro / 100, 'porcentaje'), ''],
      ['Movimientos anotados', [r.cantidad, 'numero'], siHay(rAnterior.cantidad, 'numero'), ''],
      [],

      [['Tu reparto del mes', 'subtitulo']],
      ...bloqueDeReparto(reparto),
      [],

      [['Aspecto a mejorar', 'subtitulo']],
    ];

    filas.push([[aMejorar.titulo, 'destacado']]);
    filas.push([[aMejorar.texto, 'parrafo']]);
    filas.push([]);

    // el resto de lo que detectó el motor, sin repetir lo ya dicho
    const otros = avisos.filter(a => a !== aMejorar && a !== loBueno);
    if (otros.length) {
      filas.push([['Lo demás que vale la pena mirar', 'subtitulo']]);
      for (const a of otros) {
        filas.push([[a.titulo, 'destacado']]);
        filas.push([[a.texto, 'parrafo']]);
      }
      filas.push([]);
    }

    if (hormiga) {
      filas.push([['Gastos hormiga', 'subtitulo']]);
      filas.push(['Compras chicas', [hormiga.cantidad, 'numero']]);
      filas.push(['Promedio de cada una', [hormiga.promedio, 'pesos']]);
      filas.push(['Todas juntas suman', [hormiga.total, 'pesos']]);
      filas.push([]);
    }

    if (loBueno) {
      filas.push([['Lo que sí va bien', 'subtitulo']]);
      filas.push([[loBueno.titulo, 'destacado']]);
      filas.push([[loBueno.texto, 'parrafo']]);
    }

    // Los textos largos ocupan la fila entera y necesitan altura, si no
    // quedan cortados. Como no sabemos de antemano en qué fila cae cada
    // uno, lo resolvemos recorriendo lo ya armado.
    const altoDeFila = { 0: 26 };
    const combinar = ['A1:E1'];
    filas.forEach((f, i) => {
      const tipo = (f.length === 1 && Array.isArray(f[0])) ? f[0][1] : null;
      if (tipo !== 'parrafo' && tipo !== 'destacado') return;
      const numeroDeFila = i + 1;                 // sin encabezado, la fila 1 es la primera
      combinar.push('A' + numeroDeFila + ':E' + numeroDeFila);
      // el ancho total ronda los 120 caracteres por línea
      if (tipo === 'parrafo') {
        const largo = String(f[0][0]).length;
        altoDeFila[i] = Math.min(90, Math.max(30, Math.ceil(largo / 118) * 15 + 6));
      } else {
        altoDeFila[i] = 22;
      }
    });

    const hojaAnalisis = {
      nombre: 'Análisis',
      sinEncabezado: true, sinCuadricula: true,
      columnas: [{ ancho: 34 }, { ancho: 16 }, { ancho: 16 }, { ancho: 12 }, { ancho: 44 }],
      combinar,
      altoDeFila,
      filas,
    };

    const hojas = [
      hojaAnalisis,
      hojaDeCategorias('Gastos del mes', 'En qué se te fue en ' + nombre, categorias, delMes),
      hojaDeMovimientos('Movimientos', delMes),
      hojaResumenMensual('Comparación', Datos.historialMeses(anio, mes, 6)),
    ];

    const claveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    entregarPlanilla(hojas, `mi-bolsillo-analisis-${claveMes}.xlsx`,
      `Análisis de ${nombre} descargado 📊`);
  }

  /**
   * Cuando el mes no dejó ninguna alerta, igual hay algo que mirar.
   * Elegimos el grupo del reparto que más se alejó de su ideal y lo
   * decimos con los números del motor, más una salida concreta: nunca
   * una advertencia sin una puerta abierta.
   */
  function mejorarDesdeElReparto(reparto, categorias) {
    const mayorDeTipo = tipo => categorias
      .filter(c => Datos.categoriaPorId(c.id).tipo === tipo)
      .sort((a, b) => b.monto - a.monto)[0] || null;

    if (reparto.deseos.pct > 32) {
      const top = mayorDeTipo('deseo');
      return {
        titulo: `Los gustos se llevaron el ${Math.round(reparto.deseos.pct)}% del mes`,
        texto: `Son ${dinero(reparto.deseos.monto)}. La regla 50/30/20 deja 30% para esto, `
          + `así que no estás lejos, pero es la parte más fácil de mover.`
          + (top ? ` Lo más grande fue ${top.nombre} con ${dinero(top.monto)}: ponerle un tope `
            + `en Ajustes te avisa antes de pasarte, no después.` : ''),
      };
    }

    if (reparto.necesidades.pct > 52) {
      return {
        titulo: `Tus gastos fijos se llevaron el ${Math.round(reparto.necesidades.pct)}%`,
        texto: `Son ${dinero(reparto.necesidades.monto)} y lo sano ronda el 50%. Cuando los `
          + `fijos aprietan, recortar en lo chico casi no alcanza: lo que mueve la aguja es `
          + `renegociar algo grande, como el plan de celular, un seguro o una deuda cara. `
          + `Revisa cuál de esos puedes bajar este mes.`,
      };
    }

    if (reparto.ahorro.pct < 20 && reparto.ingresos > 0) {
      const falta = Math.max(0, Math.round(reparto.ingresos * 0.2) - reparto.ahorro.monto);
      return {
        titulo: `Guardaste el ${Math.round(reparto.ahorro.pct)}% de lo que entró`,
        texto: `Para llegar al 20% que sugiere la regla 50/30/20 te faltaron ${dinero(falta)}. `
          + `Lo que funciona no es apretar a fin de mes: el día que te paguen, aparta esa `
          + `cifra primero y vive con el resto.`,
      };
    }

    const top = categorias[0];
    if (top) {
      return {
        titulo: `${top.emoji} ${top.nombre} fue tu gasto más grande`,
        texto: `${dinero(top.monto)}, el ${Math.round(top.porcentaje)}% de todo lo que gastaste. `
          + `El mes cerró ordenado, así que esto no es una alarma: es dónde está tu palanca `
          + `más grande si el próximo mes quieres que sobre más.`,
      };
    }

    return {
      titulo: 'El mes cerró sin nada que corregir',
      texto: 'No te pasaste de ningún tope, gastaste menos de lo que entró y tu reparto quedó '
        + 'dentro de lo sano. Lo que sigue es sostenerlo: vuelve a mirar el próximo cierre.',
    };
  }

  /** Arma el archivo y lo entrega. Si algo falla, lo dice y no rompe. */
  function entregarPlanilla(hojas, nombreArchivo, mensaje) {
    let archivo;
    try {
      archivo = Excel.crear(hojas);
    } catch (error) {
      avisar('No se pudo armar la planilla. Prueba con la copia en .json.');
      return;
    }
    descargar(archivo, nombreArchivo);
    avisar(mensaje);
  }

  /** Le pasa un archivo al navegador para que la persona lo guarde. */
  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importarArchivo(archivo) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const r = Datos.importar(lector.result);
        cargarAjustesEnFormulario();
        ocultarRegistro();
        dibujar();
        avisar(r.migro
          ? 'Datos restaurados y actualizados al formato nuevo ✅'
          : 'Datos restaurados ✅');
      } catch (e) {
        // el mensaje viene del validador y ya está escrito para una persona
        avisar(e.message || 'Ese archivo no se pudo leer');
      }
    };
    lector.readAsText(archivo);
  }

  /* ---------------- 13. Instalación en el celular ---------------- */
  let promesaInstalacion = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    promesaInstalacion = e;
    // si ya corre instalada no tiene sentido ofrecerle instalarla
    if (!estaInstalada()) $$$('avisoInstalar').classList.add('visible');
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


    // ---- Conectar una nube ----
    $$$('botonConectarNube').addEventListener('click', async () => {
      const caja = $$$('errorNube');
      const mostrarError = t => { caja.textContent = t; caja.hidden = !t; };
      mostrarError('');
      $$$('zonaSql').hidden = true;

      const boton = $$$('botonConectarNube');
      boton.disabled = true;
      boton.textContent = 'Probando…';

      let r;
      try {
        r = await Nube.probarConexion($$$('campoNubeUrl').value, $$$('campoNubeLlave').value);
      } finally {
        boton.disabled = false;
        boton.textContent = 'Probar y conectar';
      }

      if (!r.ok) {
        mostrarError('⚠️ ' + r.mensaje);
        // si lo único que falta es la tabla, le mostramos el SQL acá mismo
        if (r.faltaTabla) {
          $$$('zonaSql').hidden = false;
          $$$('zonaSql').scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
      }

      Nube.guardarConfig(r.url, r.llavePublica);
      await Dialogos.avisar({
        titulo: 'Tu nube quedó conectada',
        texto: 'Ahora vas a poder crear tu cuenta con correo y contraseña. Tus datos de este '
          + 'teléfono no se tocaron: cuando entres, te vamos a preguntar qué hacer con ellos.',
        aceptar: 'Entendido',
      });
      // recargamos para que todo arranque con la conexión nueva
      location.reload();
    });

    /** Copia un campo al portapapeles; si no se puede, lo deja seleccionado. */
    async function copiarCampo(id, comoSeLlama) {
      const campo = $$$(id);
      try {
        await navigator.clipboard.writeText(campo.value);
        avisar(comoSeLlama + ' copiada ✅');
      } catch (_) {
        campo.select();
        campo.setSelectionRange(0, 99999);   // en iPhone hace falta el rango
        avisar('Quedó seleccionada: cópiala tú');
      }
    }

    $$$('copiarUrlNube').addEventListener('click', () => copiarCampo('verUrlNube', 'La dirección'));
    $$$('copiarLlaveNube').addEventListener('click', () => copiarCampo('verLlaveNube', 'La llave'));

    $$$('botonCopiarSql').addEventListener('click', async () => {
      const sql = $$$('bloqueSql').textContent;
      try {
        await navigator.clipboard.writeText(sql);
        avisar('SQL copiado ✅');
      } catch (_) {
        // en algunos navegadores no se puede copiar solo: lo seleccionamos
        // para que baste con tocar "copiar"
        const rango = document.createRange();
        rango.selectNodeContents($$$('bloqueSql'));
        const seleccion = window.getSelection();
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
        avisar('Quedó seleccionado: cópialo tú');
      }
    });

    $$$('botonDesconectarNube').addEventListener('click', async () => {
      const seguro = await Dialogos.confirmar({
        titulo: '¿Desconectar esta nube?',
        texto: 'Tus datos se quedan en este teléfono tal como están. Lo que se olvida es la '
          + 'dirección del proyecto y tu sesión, así que la app vuelve a guardar solo acá.',
        aceptar: 'Desconectar',
      });
      if (!seguro) return;
      Nube.borrarConfig();
      location.reload();
    });

    // ---- Nube ----
    $$$('botonReenviar').addEventListener('click', async () => {
      const boton = $$$('botonReenviar');
      boton.disabled = true;
      try {
        await Nube.mandarCodigo($$$('campoCorreo').value.trim());
        avisar('Te mandamos otro código 📬');
        mostrarErrorCodigo('');
      } catch (error) {
        mostrarErrorCodigo('⚠️ ' + error.message);
      } finally {
        boton.disabled = false;
      }
    });

    $$$('botonOtroCorreo').addEventListener('click', () => {
      fijarPasoDeEntrada('correo');
      $$$('campoCorreo').focus();
    });

    // al escribir el código, el error se va solo; y con 6 números entramos
    $$$('campoCodigo').addEventListener('input', e => {
      mostrarErrorCodigo('');
      const limpio = e.target.value.replace(/\D/g, '').slice(0, 6);
      if (limpio !== e.target.value) e.target.value = limpio;
      // pegar el código desde el correo debería bastar
      if (limpio.length === 6) {
        $$$('formRegistro').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    $$$('botonEntrarNube').addEventListener('click', () => {
      fijarPasoDeEntrada('correo');
      $$$('campoCorreo').value = Datos.obtener().ajustes.correo || '';
      mostrarRegistro();
    });

    $$$('botonSubirNube').addEventListener('click', async () => {
      const ok = await Nube.subirAhora();
      avisar(ok ? 'Guardado en tu nube ☁️' : (Nube.errorActual() || 'No se pudo subir ahora'));
    });

    $$$('botonBajarNube').addEventListener('click', async () => {
      const locales = Datos.obtener().movimientos.length;
      const seguro = await Dialogos.confirmar({
        titulo: '¿Traer los datos de la nube?',
        texto: 'Reemplaza lo que hay en este teléfono (' + locales
          + (locales === 1 ? ' movimiento' : ' movimientos') + ') por lo que esté guardado '
          + 'en tu nube. Lo de acá se pierde.',
        aceptar: 'Traer', peligro: true,
      });
      if (!seguro) return;
      if (await traerDeLaNube(false)) irA('inicio');
    });

    $$$('botonSalirNube').addEventListener('click', async () => {
      const seguro = await Dialogos.confirmar({
        titulo: '¿Cerrar sesión?',
        texto: 'Tus datos se quedan en este teléfono tal como están. Lo único que pasa '
          + 'es que dejan de sincronizarse hasta que vuelvas a entrar.',
        aceptar: 'Cerrar sesión',
      });
      if (!seguro) return;
      await Nube.salir();
      avisar('Sesión cerrada');
    });

    // Navegación inferior
    $$('.navegacion button').forEach(b =>
      b.addEventListener('click', () => { vibrar(6); irA(b.dataset.pantalla); }));

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

    // Botón +
    $$$('botonAgregar').addEventListener('click', () => {
      vibrar(9);
      if (vista.pantalla === 'negocio') UiNegocio.abrirVender();
      else abrirFormularioMovimiento();
    });

    // Cerrar ventanas tocando el fondo oscuro
    $$('.telon').forEach(t =>
      t.addEventListener('click', e => { if (e.target === t) cerrarHoja(t.id); }));

    // ---- Formulario de movimiento ----
    $$$('tipoGasto').addEventListener('click', () => fijarTipo('gasto'));
    $$$('tipoIngreso').addEventListener('click', () => fijarTipo('ingreso'));
    $$$('tipoTransferencia').addEventListener('click', () => fijarTipo('transferencia'));

    $$$('rejillaCategorias').addEventListener('click', e => {
      const b = e.target.closest('[data-categoria]');
      if (!b) return;
      vista.categoria = b.dataset.categoria;
      dibujarCategorias();
    });

    // los selectores de cuenta se recuerdan para el próximo movimiento
    $$$('campoCuentaOrigen').addEventListener('change', e => {
      vista.cuentaOrigen = e.target.value;
      if (vista.tipo === 'transferencia') dibujarCuentasDelFormulario();
    });
    $$$('campoCuentaDestino').addEventListener('change', e => {
      vista.cuentaDestino = e.target.value;
      if (vista.tipo === 'transferencia') dibujarCuentasDelFormulario();
    });

    $$$('formMovimiento').addEventListener('submit', e => {
      e.preventDefault();
      const monto = Number($$$('campoMonto').value);
      if (!monto || monto <= 0) { avisar('Escribe un monto mayor que cero'); return; }

      const t = vista.tipo;
      try {
        Datos.agregarMovimiento({
          tipo: t,
          monto,
          categoria: t === 'transferencia' ? null : vista.categoria,
          nota: $$$('campoNota').value,
          fecha: $$$('campoFecha').value || Datos.hoyISO(),
          cuentaOrigen:  t === 'ingreso' ? null : $$$('campoCuentaOrigen').value,
          cuentaDestino: t === 'gasto'   ? null : $$$('campoCuentaDestino').value,
          // Solo la ficha; el archivo ya está en la bodega y recién ahora
          // se entera de a qué movimiento pertenece.
          adjuntos: vista.adjuntosPendientes.map(
            ({ id, nombre, tipo, tamano }) => ({ id, nombre, tipo, tamano })),
        });
      } catch (error) {
        avisar(error.message);
        return;
      }

      // Se guardaron con el movimiento: ya tienen dueño, así que cerrar
      // la hoja no debe borrarlos.
      vista.adjuntosPendientes = [];
      mostrarPesoDeRespaldos();
      cerrarHoja('telonMovimiento');
      // si anotaste algo de otro mes, saltamos a ese mes para que lo veas
      const [a, m] = ($$$('campoFecha').value || Datos.hoyISO()).split('-').map(Number);
      vista.anio = a; vista.mes = m - 1;
      dibujar();
      avisar(t === 'gasto' ? 'Gasto anotado ✅'
           : t === 'ingreso' ? 'Ingreso anotado ✅'
           : 'Plata movida entre tus cuentas ✅');
    });

    /* ---- Respaldos: adjuntar y leer ----
       El input de archivo va escondido y lo dispara un botón nuestro:
       el input que trae el navegador dice "Examinar… ningún archivo
       seleccionado" y delata al tiro que esto es una página. */
    $$$('botonAdjuntar').addEventListener('click', () => $$$('archivoAdjunto').click());

    $$$('archivoAdjunto').addEventListener('change', async e => {
      const archivos = [...e.target.files];
      e.target.value = '';                 // para poder elegir el mismo dos veces
      if (archivos.length) await adjuntarArchivos(archivos);
    });

    // ---- Pegar el texto de una captura ----
    $$$('botonPegarTexto').addEventListener('click', pegarTextoDeCaptura);

    // Se lee en cuanto pega, sin pedirle además que toque un botón.
    $$$('campoPegado').addEventListener('paste', e => {
      const texto = (e.clipboardData || {}).getData
        ? e.clipboardData.getData('text') : '';
      if (!texto.trim()) return;
      e.preventDefault();
      $$$('campoPegado').value = texto;
      leerTextoPegado(texto);
    });
    // por si lo pega con el menú del sistema, que no siempre dispara 'paste'
    $$$('campoPegado').addEventListener('input', e => {
      const texto = e.target.value;
      if (texto.trim().length > 12) leerTextoPegado(texto);
    });

    $$$('adjuntosDelFormulario').addEventListener('click', e => {
      const b = e.target.closest('[data-quitar]');
      if (!b) return;
      const id = b.dataset.quitar;
      Adjuntos.borrar(id);
      vista.adjuntosPendientes = vista.adjuntosPendientes.filter(a => a.id !== id);
      dibujarAdjuntosDelFormulario();
    });

    $$$('resultadoLectura').addEventListener('click', e => {
      if (e.target.closest('#botonDeshacerLectura')) deshacerLectura();
    });

    // Adjuntarle un respaldo a un movimiento que ya está anotado.
    $$$('archivoRespaldoSuelto').addEventListener('change', async e => {
      const archivos = [...e.target.files];
      e.target.value = '';
      const movimientoId = vista.adjuntandoA;
      vista.adjuntandoA = null;
      if (archivos.length && movimientoId) {
        await adjuntarAMovimientoExistente(movimientoId, archivos);
      }
    });

    $$$('visorAdjunto').addEventListener('click', async e => {
      const agregar = e.target.closest('[data-agregar-respaldo]');
      if (agregar) {
        vista.adjuntandoA = agregar.dataset.agregarRespaldo;
        $$$('archivoRespaldoSuelto').click();
        return;
      }

      const b = e.target.closest('[data-quitar-respaldos]');
      if (!b) return;
      const seguro = await Dialogos.confirmar({
        titulo: '¿Quitar los respaldos?',
        texto: 'El movimiento se queda tal cual: lo que se borra son las fotos y archivos '
             + 'que le habías adjuntado. No se puede deshacer.',
        aceptar: 'Quitar', peligro: true,
      });
      if (!seguro) return;
      const mov = Datos.obtener().movimientos.find(m => m.id === b.dataset.quitarRespaldos);
      if (mov) for (const a of [...(mov.adjuntos || [])]) Datos.quitarAdjunto(mov.id, a.id);
      cerrarHoja('telonAdjunto');
      mostrarPesoDeRespaldos();
      dibujarMovimientos();
      avisar('Respaldos quitados');
    });

    // ---- Leer una cartola del banco ----
    $$$('botonCartola').addEventListener('click', () => $$$('archivoCartola').click());

    $$$('archivoCartola').addEventListener('change', async e => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (archivo) await leerCartolaDeArchivo(archivo);
    });

    $$$('listaCartola').addEventListener('change', e => {
      const marca = e.target.closest('[data-fila]');
      if (marca) {
        const fila = vista.cartola[Number(marca.dataset.fila)];
        if (fila) fila.marcada = marca.checked;
        // solo se actualiza el botón: redibujar la lista entera perdería
        // el lugar donde iba la persona
        const marcadas = vista.cartola.filter(f => f.marcada).length;
        $$$('botonGuardarCartola').textContent = marcadas
          ? `Anotar ${marcadas} ${marcadas === 1 ? 'movimiento' : 'movimientos'}`
          : 'No hay nada marcado';
        $$$('botonGuardarCartola').disabled = !marcadas;
        return;
      }
      const categoria = e.target.closest('[data-categoria-fila]');
      if (categoria) {
        const fila = vista.cartola[Number(categoria.dataset.categoriaFila)];
        if (fila) fila.categoria = categoria.value;
      }
    });

    $$$('marcarTodoCartola').addEventListener('click', () => {
      vista.cartola.forEach(f => { f.marcada = true; });
      dibujarCartola();
    });
    $$$('desmarcarTodoCartola').addEventListener('click', () => {
      vista.cartola.forEach(f => { f.marcada = false; });
      dibujarCartola();
    });
    $$$('botonGuardarCartola').addEventListener('click', guardarCartola);

    // ---- Lista de movimientos ----
    $$$('filtroTipo').addEventListener('change', e => {
      vista.filtroMovimientos = e.target.value;
      dibujarMovimientos();
    });

    $$$('listaMovimientos').addEventListener('click', async e => {
      const clip = e.target.closest('[data-adjuntos]');
      if (clip) { abrirVisorDeAdjuntos(clip.dataset.adjuntos); return; }

      const b = e.target.closest('[data-borrar]');
      if (!b) return;
      const seguro = await Dialogos.confirmar({
        titulo: '¿Borrar este movimiento?',
        texto: 'Deja de contar en el mes y en el saldo de su cuenta.',
        aceptar: 'Borrar', peligro: true,
      });
      if (!seguro) return;
      Datos.borrarMovimiento(b.dataset.borrar);
      dibujar();
      avisar('Movimiento borrado');
    });

    // ---- Pestañas del gráfico de tendencia ----
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
      try {
        Datos.agregarMeta({
          nombre: $$$('metaNombre').value,
          montoObjetivo: Number($$$('metaObjetivo').value),
          emoji: $$$('metaEmoji').value,
          fechaObjetivo: $$$('metaFecha').value,
        });
      } catch (error) {
        avisar(error.message);
        return;
      }
      cerrarHoja('telonMeta');
      dibujarMetas();
      avisar('Meta creada 🎯');
    });

    $$$('listaMetas').addEventListener('click', async e => {
      const abonar  = e.target.closest('[data-abonar]');
      const retirar = e.target.closest('[data-retirar]');
      const borrar  = e.target.closest('[data-borrar-meta]');

      if (abonar) {
        const monto = await Dialogos.pedirMonto({
          titulo: 'Abonar a esta meta',
          etiqueta: '¿Cuánto le sumas?',
          placeholder: 'Ej: 20000',
          aceptar: 'Abonar',
        });
        if (monto !== null) {
          Datos.abonarMeta(abonar.dataset.abonar, monto);
          dibujarMetas();
          avisar('Abono registrado 🐷');
        }
      }
      if (retirar) {
        const monto = await Dialogos.pedirMonto({
          titulo: 'Retirar de esta meta',
          etiqueta: '¿Cuánto sacas?',
          placeholder: 'Ej: 20000',
          aceptar: 'Retirar',
        });
        if (monto !== null) {
          Datos.abonarMeta(retirar.dataset.retirar, -monto);
          dibujarMetas();
          avisar('Retiro registrado');
        }
      }
      if (borrar) {
        const seguro = await Dialogos.confirmar({
          titulo: '¿Borrar esta meta?',
          texto: 'Lo que llevas ahorrado no se descuenta de tus movimientos: solo desaparece la meta.',
          aceptar: 'Borrar', peligro: true,
        });
        if (!seguro) return;
        Datos.borrarMeta(borrar.dataset.borrarMeta);
        dibujarMetas();
      }
    });

    // ---- Calculadora ----
    ['calcMonto', 'calcAnios', 'calcTasa'].forEach(id =>
      $$$(id).addEventListener('input', calcularAhorro));

    // ---- Ajustes ----
    $$$('botonGuardarAjustes').addEventListener('click', () => {
      // si escribió un correo, tiene que ser válido; si lo dejo vacío, lo respetamos
      const correo = $$$('campoCorreoAjustes').value.trim().toLowerCase();
      if (correo && !Datos.correoValido(correo)) {
        avisar('Ese correo no se ve bien. Revisa que tenga @ y un punto.');
        $$$('campoCorreoAjustes').focus();
        return;
      }

      Datos.guardarAjustes({
        correo,
        nombre: $$$('campoNombre').value.trim(),
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

    // ---- Cuentas ----
    $$$('botonNuevaCuenta').addEventListener('click', () => abrirFormularioCuenta(null));
    $$$('formCuenta').addEventListener('submit', guardarCuentaDesdeFormulario);

    $$$('listaCuentas').addEventListener('click', e => {
      const b = e.target.closest('[data-editar-cuenta]');
      if (b) abrirFormularioCuenta(b.dataset.editarCuenta);
    });

    $$$('cuentasArchivadas').addEventListener('click', e => {
      const b = e.target.closest('[data-reactivar]');
      if (!b) return;
      Datos.reactivarCuenta(b.dataset.reactivar);
      dibujarCuentas();
      avisar('Cuenta reactivada');
    });

    $$$('botonBorrarCuenta').addEventListener('click', async () => {
      const id = vista.cuentaEditando;
      if (!id) return;
      const usados = Datos.movimientosDeCuenta(id);

      if (usados > 0) {
        // Si todavía queda plata adentro, decirlo antes y no después.
        const saldo = Datos.saldoDeCuenta(id);
        const texto = saldo !== 0
          ? `Todavía tiene ${dinero(saldo)}. Al archivarla deja de sumar a tu total de hoy, `
            + 'aunque tus movimientos pasados quedan intactos.\n\n'
            + 'Si esa plata se fue a otra cuenta, anota primero la movida con el botón + '
            + 'y después archívala.'
          : 'Deja de aparecer al anotar, pero sus movimientos siguen contando en tu historial.';
        const seguro = await Dialogos.confirmar({
          titulo: '¿Archivar esta cuenta?', texto, aceptar: 'Archivar',
        });
        if (!seguro) return;
        try { Datos.archivarCuenta(id); }
        catch (error) { avisar(error.message); return; }
        avisar('Cuenta archivada 📦');
      } else {
        const seguro = await Dialogos.confirmar({
          titulo: '¿Borrar esta cuenta?',
          texto: 'No tiene movimientos, así que no se pierde nada.',
          aceptar: 'Borrar', peligro: true,
        });
        if (!seguro) return;
        try { Datos.borrarCuenta(id); }
        catch (error) { avisar(error.message); return; }
        avisar('Cuenta borrada');
      }
      cerrarHoja('telonCuenta');
      dibujarCuentas();
      dibujarInicioSiVisible();
    });

    $$$('botonExportar').addEventListener('click', exportarArchivo);
    $$$('botonExcel').addEventListener('click', exportarExcel);
    $$$('botonAnalisisMes').addEventListener('click', () => {
      vibrar(9);
      exportarAnalisisDelMes();
    });
    $$$('botonImportar').addEventListener('click', () => $$$('archivoImportar').click());
    $$$('archivoImportar').addEventListener('change', e => {
      if (e.target.files[0]) importarArchivo(e.target.files[0]);
      e.target.value = '';
    });

    $$$('botonEjemplo').addEventListener('click', async () => {
      const seguro = await Dialogos.confirmar({
        titulo: '¿Cargar datos de ejemplo?',
        texto: 'Reemplaza los movimientos del mes actual por datos de prueba, para que veas cómo se ve la app llena.',
        aceptar: 'Cargar',
      });
      if (!seguro) return;
      Datos.cargarEjemplo();
      cargarAjustesEnFormulario();
      irA('inicio');
      avisar('Datos de ejemplo cargados 🧪');
    });

    $$$('botonTutorial').addEventListener('click', abrirTutorial);

    $$$('botonBorrarTodo').addEventListener('click', async () => {
      const primera = await Dialogos.confirmar({
        titulo: '¿Borrar todos tus datos?',
        texto: 'Se van tus movimientos, cuentas, metas y topes. No se puede deshacer.',
        aceptar: 'Continuar', peligro: true,
      });
      if (!primera) return;
      const segunda = await Dialogos.confirmar({
        titulo: 'Última parada',
        texto: 'Si no descargaste una copia desde Ajustes, esto no se recupera.',
        aceptar: 'Borrar todo', cancelar: 'Mejor no', peligro: true,
      });
      if (!segunda) return;
      Datos.borrarTodo();
      cargarAjustesEnFormulario();
      irA('inicio');
      // se borró también el registro, así que volvemos a la pantalla de bienvenida
      $$$('campoCorreo').value = '';
      mostrarErrorCorreo('');
      mostrarRegistro();
      avisar('Todo borrado');
    });

    // ---- Instalación ----
    $$$('botonInstalar').addEventListener('click', async () => {
      if (!promesaInstalacion) {
        avisar('En iPhone: botón Compartir → Agregar a inicio');
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
    const momento = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    $$$('saludo').textContent = nombre ? `${momento}, ${nombre}` : momento;
  }

  /* ---------------- 15. Arranque ---------------- */

  /** Si al abrir paso algo que el usuario debería saber, se le dice una vez. */
  function avisarDelArranque() {
    const a = Datos.arranque();

    if (a.error) {
      $$$('avisoArranque').hidden = false;
      $$$('avisoArranque').className = 'consejo aviso';
      $$$('avisoArranque').innerHTML = `<strong>Ojo con este dispositivo</strong>${esc(a.error)}`;
      return;
    }

    if (a.migro) {
      $$$('avisoArranque').hidden = false;
      $$$('avisoArranque').className = 'consejo';
      $$$('avisoArranque').innerHTML =
        '<strong>Actualizamos el formato de tus datos</strong>'
        + 'Tus movimientos, metas y topes están tal cual los dejaste, ahora repartidos en cuentas. '
        + 'Guardamos una copia de lo anterior antes de tocar nada. '
        + 'Si algo no te calza, descarga tu copia desde Ajustes y avísanos.';
    }
  }

  function iniciar() {
    Datos.cargar();
    prepararMarco();
    prepararBotonAtras();
    prepararArrastreDeArchivos();
    conectarEventos();
    prepararNube();
    actualizarSaludo();
    cargarAjustesEnFormulario();
    mostrarPesoDeRespaldos();
    dibujarTecnicas();
    calcularAhorro();
    fijarTipo('gasto');
    UiSueldo.conectar();
    UiNegocio.conectar();
    acomodarPestanaNegocio();
    irA('inicio');
    avisarDelArranque();

    // Quien no se ha registrado ve primero la pantalla de bienvenida.
    // Quien ya se registró entra directo, sin instrucciones.
    // Si tocó el enlace del correo en vez de escribir el código, vuelve
    // con la sesión colgando de la dirección. Se recoge acá.
    const vinoDelEnlace = Nube.configurada() && Nube.recogerSesionDelEnlace();

    if (vinoDelEnlace) {
      terminarDeEntrar(Nube.correoDeLaSesion() || Datos.obtener().ajustes.correo);
    } else if (!Datos.estaRegistrado()) {
      mostrarRegistro();
    } else if (atenderAtajo()) {
      // entró por un atajo del icono: ya lo dejamos donde quería
    } else if (!Datos.obtener().ajustes.tutorialVisto) {
      setTimeout(abrirTutorial, 450);
    }

    // El "service worker" es lo que permite que la app funcione sin internet
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Si el celular cambia entre modo claro y oscuro, redibujamos los gráficos
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => dibujar());
    }

    apagarArranque();

    // Va al final y sin await: la app ya está usable mientras esto pasa.
    revisarNubeAlAbrir();
  }

  /**
   * Saca la pantalla de arranque. La dejamos un momento mínimo: un
   * destello de 40 milisegundos se ve como un error, no como una app
   * abriendo.
   */
  function apagarArranque() {
    const arranque = $$$('arranque');
    if (!arranque) return;
    const yaPasado = performance.now();
    const espera = Math.max(0, 520 - yaPasado);
    setTimeout(() => {
      arranque.classList.add('listo');
      setTimeout(() => arranque.remove(), 400);
    }, espera);
  }

  /**
   * Atajos del icono: en el celular, dejar apretado el icono de la app
   * muestra "Anotar un gasto" y "Ver mis movimientos". Cada uno abre la
   * app con una marca en la dirección, y acá la atendemos.
   * Devuelve true si venía por un atajo.
   */
  function atenderAtajo() {
    const parametros = new URLSearchParams(location.search);
    const pantalla = parametros.get('ir');
    const accion = parametros.get('accion');
    if (!pantalla && !accion) return false;

    // Primero limpiamos la marca de la dirección, para que recargar no
    // repita el atajo. Va antes de abrir nada: si no, borraríamos la
    // huella que el botón "atrás" necesita para cerrar la ventana.
    history.replaceState({ tab: 'inicio' }, '', location.pathname);

    if (['inicio', 'movimientos', 'metas', 'aprender', 'ajustes'].includes(pantalla)) {
      irA(pantalla);
    }
    if (accion === 'gasto') {
      fijarTipo('gasto');
      abrirFormularioMovimiento();
    }
    return true;
  }

  /* ---------------- 13b. La nube ---------------- */

  const ROTULO_NUBE = {
    'apagada':    { texto: '—',            clase: '' },
    'sin-sesion': { texto: 'sin cuenta',   clase: '' },
    'al-dia':     { texto: '✓ al día',     clase: 'al-dia' },
    'subiendo':   { texto: 'subiendo…',    clase: 'subiendo' },
    'pendiente':  { texto: 'por subir',    clase: 'pendiente' },
    'error':      { texto: 'no subió',     clase: 'error' },
  };

  const DETALLE_NUBE = {
    'sin-sesion': 'Tus datos están solo en este teléfono.',
    'al-dia':     'Todo lo que anotaste está guardado en tu nube.',
    'subiendo':   'Guardando en tu nube…',
    'pendiente':  'Hay cambios que todavía no suben. Se van solos cuando haya internet.',
    'error':      'No se pudo guardar en la nube. Lo del teléfono está intacto.',
  };

  /**
   * Enciende o apaga toda la parte de nube según config-nube.js.
   * Si no está configurada, esta función deja la app tal como estaba
   * antes de que existiera la nube.
   */
  function prepararNube() {
    const hay = Nube.configurada();

    // ---- pantalla de bienvenida ----
    $$$('opcionesCuenta').hidden = !hay;
    $$$('opcionesCuenta').hidden = !hay;
    $$$('notaSoloTelefono').hidden = hay;
    $$$('notaConNube').hidden = !hay;

    // ---- Ajustes: o se conecta una nube, o se administra la que hay ----
    $$$('tarjetaNube').hidden = !hay;
    $$$('tarjetaConectarNube').hidden = hay;
    $$$('zonaDesconectar').hidden = !Nube.configEsDelTelefono();
    if (Nube.configEsDelTelefono()) {
      $$$('detalleProyecto').textContent = 'Conectado a ' + Nube.direccionDelProyecto();
    }

    // los datos para llevarse la conexión a otro aparato
    $$$('otroDispositivo').hidden = !hay;
    if (hay) {
      $$$('verUrlNube').value = Nube.direccionDelProyecto();
      $$$('verLlaveNube').value = Nube.llaveDelProyecto();
    }

    if (!hay) return;

    fijarPasoDeEntrada('correo');

    // ---- la pastilla y el detalle, en Ajustes ----
    Nube.alCambiar(estado => {
      const rotulo = ROTULO_NUBE[estado] || ROTULO_NUBE['sin-sesion'];
      const pastilla = $$$('pastillaNube');
      pastilla.textContent = rotulo.texto;
      pastilla.className = 'pastilla-nube ' + rotulo.clase;

      const conSesion = Nube.haySesion();
      $$$('zonaNubeConSesion').hidden = !conSesion;
      $$$('zonaNubeSinSesion').hidden = conSesion;

      const detalle = DETALLE_NUBE[estado] || '';
      // si el token no trajo el correo, usamos el que guardó la app
      const correo = Nube.correoDeLaSesion() || Datos.obtener().ajustes.correo;
      $$$('detalleNube').textContent = conSesion
        ? ((correo ? correo + ' · ' : '') + detalle)
        : detalle;
    });
  }


  /* ---------------- 16. Lo que la cáscara le presta al negocio ----------------

     El módulo del negocio (src/ui/negocio.js) vive aparte para que
     app.js no se vuelva ilegible, pero necesita cuatro cosas de acá:
     abrir y cerrar hojas —y así el botón "atrás" del teléfono las
     cierra igual que las demás—, el mensajito de abajo, el mes que
     está mirando la persona y el cambio de pestaña.

     Se publica esto y nada más. Cuanto más chica sea esta ventana,
     menos posibilidades hay de que un cambio en app.js rompa el
     negocio sin avisar.                                            */
  window.App = {
    abrirHoja,
    cerrarHoja,
    avisar,
    vibrar,
    irA,
    esc,
    dinero,
    mesEnPantalla: () => ({ anio: vista.anio, mes: vista.mes }),
    /** La barra de abajo pasa de cinco a seis columnas y viceversa. */
    acomodarPestanaNegocio,
    /** Redibuja la pantalla que esté a la vista. */
    redibujar: dibujar,
    /** Mueve el mes que está mirando la persona. */
    verMes(anio, mes) { vista.anio = anio; vista.mes = mes; dibujar(); },
    /** Redibuja la pestaña del negocio si es la que está a la vista. */
    refrescarNegocio() {
      if (vista.pantalla === 'negocio' && typeof UiNegocio !== 'undefined') UiNegocio.dibujar();
    },
  };

  /** true cuando la app corre instalada, fuera del navegador. */
  function estaInstalada() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
