/* ============================================================
   src/ui/voz.js
   El micrófono: hablar en vez de escribir.

       "gané 50 lucas por un trabajo que hice"
       "gasté 5 mil en comida"
       "ayer gasté 20 lucas en bencina y 5 mil en el almuerzo"

   Este archivo solo se encarga de ESCUCHAR y de mostrar lo que se
   entendió. Quien entiende la frase es core/voz.js, que es
   aritmética y reglas del idioma, no un modelo. Regla 1.

   ------------------------------------------------------------
   LO QUE HAY QUE DECIR ANTES DE APRETAR EL MICRÓFONO

   El dictado NO lo hace esta app: lo hace el teléfono, con el
   mismo servicio que usa el botón del micrófono de tu teclado.
   En Android eso pasa por Google y en iPhone por Apple. O sea que
   tu voz sale del aparato, y eso rompe la promesa que el resto de
   la app sí cumple.

   Por eso: se avisa ANTES, con todas sus letras, y se pregunta
   una vez. Quien prefiera no hacerlo tiene el mismo resultado
   escribiendo, o usando el micrófono de su propio teclado, que es
   exactamente el mismo servicio pero activado por la persona y no
   por nosotros.

   No se guarda ni un segundo de audio en ninguna parte. Lo que
   llega es texto, y ese texto lo lee core/voz.js aquí adentro.

   ------------------------------------------------------------
   Y NADA SE ANOTA SOLO. Sale la propuesta con de dónde salió cada
   dato, y la persona confirma. Regla 12.
   ============================================================ */

const UiVoz = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Se busca CADA VEZ, no una sola al cargar el archivo. Dos razones:
     algunos navegadores lo publican con retraso, y así se puede poner
     uno de mentira para probar la pantalla completa sin micrófono
     (ver herramientas: la prueba suplanta esto). */
  const elReconocedor = () => window.SpeechRecognition || window.webkitSpeechRecognition;

  /** ¿Este teléfono sabe dictar? */
  const sePuede = () => Boolean(elReconocedor());

  /** ¿Ya dijo que sí alguna vez? */
  const yaAcepto = () => {
    try { return localStorage.getItem('mi-bolsillo:voz') === 'si'; }
    catch (e) { return false; }
  };
  const recordarQueAcepto = () => {
    try { localStorage.setItem('mi-bolsillo:voz', 'si'); } catch (e) {}
  };

  let escuchando = null;      // el reconocedor mientras está prendido
  let alTerminar = null;      // a quién avisarle con el texto final

  /* ============================================================
     1. ESCUCHAR
     ============================================================ */

  /**
   * Prende el micrófono. Devuelve una promesa con lo que se dijo,
   * o '' si se canceló o no se entendió nada.
   *
   * @param {function} alOir  recibe el texto parcial mientras hablas
   */
  function escuchar(alOir) {
    return new Promise(resolver => {
      if (!sePuede()) return resolver('');
      if (escuchando) { detener(); return resolver(''); }

      const r = new (elReconocedor())();
      r.lang = 'es-CL';
      // Los parciales son lo que hace que se sienta vivo: ver aparecer
      // las palabras mientras hablas es la diferencia entre "está
      // escuchando" y "se colgó".
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;

      let ultimo = '';

      r.onresult = evento => {
        let texto = '';
        for (let i = 0; i < evento.results.length; i++) {
          texto += evento.results[i][0].transcript;
        }
        ultimo = texto.trim();
        if (alOir) alOir(ultimo, evento.results[evento.results.length - 1].isFinal);
      };

      r.onerror = evento => {
        escuchando = null;
        // 'no-speech' y 'aborted' no son fallas: es alguien que se
        // arrepintió o que no alcanzó a hablar.
        resolver(evento.error === 'no-speech' || evento.error === 'aborted' ? '' : '');
      };

      r.onend = () => { escuchando = null; resolver(ultimo); };

      escuchando = r;
      alTerminar = resolver;
      try { r.start(); }
      catch (e) { escuchando = null; resolver(''); }
    });
  }

  function detener() {
    if (!escuchando) return;
    try { escuchando.stop(); } catch (e) {}
    escuchando = null;
  }

  const estaEscuchando = () => Boolean(escuchando);

  /* ============================================================
     2. PEDIR PERMISO, UNA VEZ Y DE FRENTE
     ============================================================ */

  async function pedirPermiso() {
    if (yaAcepto()) return true;

    const si = await Dialogos.confirmar({
      titulo: '¿Uso el micrófono?',
      texto: 'Vas a poder decir "gasté 5 lucas en comida" y yo lleno el formulario.\n\n'
           + 'Ojo con esto, porque es la única parte de la app donde algo sale de tu '
           + 'teléfono: el dictado lo hace tu propio teléfono, con el mismo servicio del '
           + 'micrófono de tu teclado (Google en Android, Apple en iPhone). Tu voz pasa por '
           + 'ahí para convertirse en texto.\n\n'
           + 'No guardo audio en ninguna parte, y lo que entiendo de la frase lo hago acá '
           + 'adentro, sin internet.',
      aceptar: 'Está bien, úsalo', cancelar: 'Mejor no',
    });
    if (si) recordarQueAcepto();
    return si;
  }

  /* ============================================================
     3. LA PANTALLA
     ============================================================ */

  /**
   * Abre la hoja de hablar. Cuando la persona termina, le pasa lo
   * entendido a quien corresponda:
   *   - un solo movimiento -> se llena el formulario
   *   - varios             -> la pantalla de revisar, la misma de las
   *                           cartolas, que ya existe y está probada
   */
  async function abrir(alEntender) {
    if (!sePuede()) {
      await Dialogos.avisar({
        titulo: 'Este navegador no sabe dictar',
        texto: 'Pero puedes hacer lo mismo: toca el micrófono de tu teclado y dicta '
             + 'la frase en "Pegar texto". Yo la entiendo igual.',
      });
      return;
    }
    if (!(await pedirPermiso())) return;

    pintar({ estado: 'listo' });
    window.App.abrirHoja('telonVoz');
    empezarAEscuchar(alEntender);
  }

  async function empezarAEscuchar(alEntender) {
    pintar({ estado: 'escuchando', texto: '' });
    window.App.vibrar(10);

    const dicho = await escuchar((parcial) => {
      pintar({ estado: 'escuchando', texto: parcial });
    });

    if (!dicho) {
      pintar({ estado: 'nada' });
      return;
    }

    const propuestas = Voz.entenderVarios(dicho, { hoy: Datos.hoyISO() });
    const utiles = propuestas.filter(p => p.monto);

    if (!utiles.length) {
      pintar({ estado: 'no-entendi', texto: dicho, propuestas });
      return;
    }

    pintar({ estado: 'entendido', texto: dicho, propuestas: utiles });
    guardarPendiente(utiles, alEntender);
  }

  let pendientes = null;
  let entregar = null;
  function guardarPendiente(propuestas, alEntender) {
    pendientes = propuestas;
    entregar = alEntender;
  }

  const ROTULO = {
    monto: 'El monto',
    tipo: 'Si entró o salió',
    fecha: 'La fecha',
    categoria: 'De qué es',
  };

  function pintar({ estado, texto, propuestas }) {
    const caja = $$$('cuerpoVoz');
    if (!caja) return;

    if (estado === 'escuchando') {
      caja.innerHTML = `
        <div class="voz-escuchando">
          <div class="voz-onda"><span></span><span></span><span></span><span></span><span></span></div>
          <p class="voz-dicho">${texto ? esc(texto) : 'Te escucho…'}</p>
          <p class="ayuda">Di algo como <em>“gasté 5 lucas en comida”</em>.</p>
          <button class="boton secundario" data-voz="detener">Listo, ya dije</button>
        </div>`;
      return;
    }

    if (estado === 'nada') {
      caja.innerHTML = `
        <div class="vacio">
          <div style="font-size:38px">🎤</div>
          <strong>No te escuché</strong>
          <p>Puede ser el ruido, o que el micrófono no alcanzó a prenderse.</p>
        </div>
        <button class="boton" data-voz="repetir">Probar de nuevo</button>`;
      return;
    }

    if (estado === 'no-entendi') {
      caja.innerHTML = `
        <div class="voz-dicho-final">“${esc(texto)}”</div>
        <div class="consejo lectura">
          <strong>Entendí lo que dijiste, pero no encontré un monto</strong>
          Necesito una cantidad para poder anotar algo. Prueba diciendo también cuánto fue:
          <em>“gasté cinco mil en comida”</em>.
        </div>
        <div class="fila-botones" style="margin-top:14px">
          <button class="boton secundario" data-voz="repetir">Decirlo de nuevo</button>
          <button class="boton" data-voz="escribirlo">Lo escribo yo</button>
        </div>`;
      return;
    }

    if (estado === 'entendido') {
      const varios = propuestas.length > 1;
      caja.innerHTML = `
        <div class="voz-dicho-final">“${esc(texto)}”</div>

        ${propuestas.map(p => `
          <div class="voz-propuesta ${p.tipo}">
            <div class="voz-cifra">
              <span class="signo">${p.tipo === 'ingreso' ? '+' : '−'}</span>
              ${esc(Dinero.formatear(p.monto))}
            </div>
            <div class="voz-detalle">
              <span>${p.tipo === 'ingreso' ? '⬆️ Entró' : '⬇️ Salió'}${p.tipoHeredado ? ' (como lo anterior)' : ''}</span>
              <span>${esc(Categorias.porId(p.categoria || 'otro').emoji)} ${esc(Categorias.porId(p.categoria || 'otro').nombre)}</span>
              <span>📅 ${esc(Fechas.fechaLegible(p.fecha))}${p.fechaHeredada ? ' (como lo anterior)' : ''}</span>
            </div>
            ${p.evidencia.length ? `
              <ul class="voz-evidencia">
                ${p.evidencia.map(e => `<li>${esc(ROTULO[e.campo] || e.campo)}
                  <span class="de-donde">← “${esc(e.dicho)}”</span></li>`).join('')}
              </ul>` : ''}
            ${!p.tipoDetectado && !p.tipoHeredado ? `
              <p class="ayuda">No dijiste si entró o salió, así que lo puse como gasto.
                 Puedes cambiarlo en el paso siguiente.</p>` : ''}
          </div>`).join('')}

        <div class="fila-botones" style="margin-top:16px">
          <button class="boton secundario" data-voz="repetir">Decirlo de nuevo</button>
          <button class="boton" data-voz="usar">
            ${varios ? `Revisar ${propuestas.length} movimientos` : 'Usar esto'}
          </button>
        </div>
        <p class="ayuda" style="text-align:center; margin-top:10px">
          ${varios
            ? 'Los vas a poder revisar y desmarcar uno por uno antes de anotarlos.'
            : 'Se llena el formulario y tú confirmas antes de guardar.'}
        </p>`;
      return;
    }

    caja.innerHTML = '<p class="ayuda">Preparando el micrófono…</p>';
  }

  /* ============================================================
     4. LOS BOTONES
     ============================================================ */

  function conectar(alEntender) {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-voz]');
      if (!t) return;
      const que = t.dataset.voz;

      if (que === 'abrir')    return abrir(alEntender);
      if (que === 'detener')  return detener();
      if (que === 'repetir')  return empezarAEscuchar(alEntender);
      if (que === 'usar')     return usarLoEntendido();
      if (que === 'escribirlo') {
        window.App.cerrarHoja('telonVoz');
        return;
      }
    });

    // Si la hoja se cierra por cualquier vía, el micrófono se apaga.
    // Dejarlo prendido detrás de una pantalla cerrada es lo peor que
    // puede hacer una app con el micrófono de alguien.
    Capas.avisarmeAlCerrar('telonVoz', detener);
  }

  function usarLoEntendido() {
    if (!pendientes || !entregar) return;
    const propuestas = pendientes;
    pendientes = null;
    window.App.cerrarHoja('telonVoz');
    // El cierre de la hoja anima; se espera a que termine para que la
    // siguiente no aparezca encima de la que se está yendo.
    setTimeout(() => entregar(propuestas), 260);
  }

  return { sePuede, escuchar, detener, estaEscuchando, abrir, conectar, pedirPermiso };
})();
