/* ============================================================
   dialogos.js - Las ventanas de confirmar y preguntar.

   Por que existe este archivo:
   el navegador trae sus propios confirm() y prompt(), pero salen
   con el nombre del sitio arriba ("jaimehuera04-lang.github.io
   dice:") y con los botones del navegador. Eso delata al tiro que
   esto es una página web. Acá dibujamos las mismas preguntas con
   la cara de la app.

   Como se usan (fíjate en el "await": ahora hay que esperar la
   respuesta, porque la ventana no congela el teléfono):

     if (await Dialogos.confirmar({ título: 'Borrar esto?' })) { ... }

     const monto = await Dialogos.pedirMonto({ título: 'Cuanto?' });
     if (monto !== null) { ... }
   ============================================================ */

const Dialogos = (() => {
  'use strict';

  /* Las ventanas abiertas NO se llevan acá: van a la misma pila que
     las hojas y el menú, en src/ui/capas.js. Antes este archivo tenía
     su propia lista además de aquella, o sea dos registros de lo
     mismo que había que mantener de acuerdo a mano. Uno solo.

     Todas las ventanas entran con el id "dialogo": puede haber más de
     una encima, y la pila las distingue por el orden. */

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * Dibuja una ventana y devuelve una promesa que se resuelve
   * cuando el usuario elige. Es la base de las dos de abajo.
   */
  function abrir({ titulo, texto, campo, aceptar, cancelar, peligro }) {
    return new Promise(resolver => {
      const telon = document.createElement('div');
      telon.className = 'telon-dialogo';
      telon.innerHTML = `
        <div class="dialogo" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
          <h2>${esc(titulo)}</h2>
          ${texto ? `<p>${esc(texto)}</p>` : ''}
          ${campo ? `
            <label for="dialogoCampo">${esc(campo.etiqueta || 'Monto')}</label>
            <input type="number" id="dialogoCampo" inputmode="numeric" min="1" step="1"
                   placeholder="${esc(campo.placeholder || '0')}"
                   class="dialogo-monto">` : ''}
          <div class="dialogo-botones">
            ${cancelar ? `<button type="button" class="boton secundario" data-no>${esc(cancelar)}</button>` : ''}
            <button type="button" class="boton ${peligro ? 'peligro' : ''}" data-si>${esc(aceptar)}</button>
          </div>
        </div>`;

      // Va dentro del marco de la app, no del documento: así en el
      // computador la ventana aparece dentro del teléfono dibujado.
      (document.getElementById('app') || document.body).appendChild(telon);
      // Leer una medida obliga al navegador a calcular el estado inicial;
      // recién después la clase "abierto" se anima en vez de aparecer de
      // golpe. Usamos esto y no requestAnimationFrame porque aquel no
      // corre si la ventana está en segundo plano, y la ventana se
      // quedaría invisible.
      void telon.offsetHeight;
      telon.classList.add('abierto');

      const entrada = telon.querySelector('#dialogoCampo');
      if (entrada) setTimeout(() => entrada.focus(), 180);

      let yaCerro = false;
      function cerrar(respuesta) {
        if (yaCerro) return;
        yaCerro = true;
        Capas.despilar('dialogo');
        document.removeEventListener('keydown', enTecla);
        telon.classList.remove('abierto');
        setTimeout(() => telon.remove(), 200);
        resolver(respuesta);
      }

      function aceptado() {
        if (!campo) return cerrar(true);
        const valor = Math.round(Number(entrada.value));
        // sin monto válido no cerramos: le marcamos el campo y lo dejamos corregir
        if (!Number.isFinite(valor) || valor <= 0) {
          entrada.classList.add('con-error');
          entrada.focus();
          return;
        }
        cerrar(valor);
      }

      function enTecla(e) {
        if (e.key === 'Escape') cerrar(campo ? null : false);
        if (e.key === 'Enter' && campo) { e.preventDefault(); aceptado(); }
      }

      telon.querySelector('[data-si]').addEventListener('click', aceptado);
      const botonNo = telon.querySelector('[data-no]');
      if (botonNo) botonNo.addEventListener('click', () => cerrar(campo ? null : false));
      // tocar el fondo oscuro equivale a cancelar
      telon.addEventListener('click', e => { if (e.target === telon) cerrar(campo ? null : false); });
      if (entrada) entrada.addEventListener('input', () => entrada.classList.remove('con-error'));
      document.addEventListener('keydown', enTecla);

      // guardamos la función de cierre por si el botón "atrás" la necesita
      cerrar.cancelar = () => cerrar(campo ? null : false);
      Capas.apilar({ id: 'dialogo', forma: 'dialogo', cerrar: cerrar.cancelar });
    });
  }

  return {
    /** Pregunta de si o no. Devuelve true o false. */
    confirmar: ({ titulo, texto = '', aceptar = 'Sí', cancelar = 'Cancelar', peligro = false }) =>
      abrir({ titulo, texto, aceptar, cancelar, peligro }),

    /** Aviso de una sola salida. Devuelve true cuando cierran. */
    avisar: ({ titulo, texto = '', aceptar = 'Entendido' }) =>
      abrir({ titulo, texto, aceptar, cancelar: null }),

    /** Pide un monto en pesos. Devuelve el número, o null si cancelan. */
    pedirMonto: ({ titulo, texto = '', etiqueta = 'Monto', placeholder = '0', aceptar = 'Guardar' }) =>
      abrir({ titulo, texto, campo: { etiqueta, placeholder }, aceptar, cancelar: 'Cancelar' }),

    /** true si lo de más arriba es una de estas ventanas. */
    hayAbierto: () => {
      const arriba = Capas.laDeArriba();
      return Boolean(arriba && arriba.forma === 'dialogo');
    },

    /** Cierra la de más arriba como si hubieran cancelado. */
    cerrarUltimo: () => Capas.cerrarLaDeArriba(),
  };
})();
