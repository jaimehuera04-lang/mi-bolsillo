/* ============================================================
   dialogos.js - Las ventanas de confirmar y preguntar.

   Por que existe este archivo:
   el navegador trae sus propios confirm() y prompt(), pero salen
   con el nombre del sitio arriba ("jaimehuera04-lang.github.io
   dice:") y con los botones del navegador. Eso delata al tiro que
   esto es una pagina web. Aca dibujamos las mismas preguntas con
   la cara de la app.

   Como se usan (fijate en el "await": ahora hay que esperar la
   respuesta, porque la ventana no congela el telefono):

     if (await Dialogos.confirmar({ titulo: 'Borrar esto?' })) { ... }

     const monto = await Dialogos.pedirMonto({ titulo: 'Cuanto?' });
     if (monto !== null) { ... }
   ============================================================ */

const Dialogos = (() => {
  'use strict';

  // La pila guarda las ventanas abiertas. Sirve para que el boton
  // "atras" del celular cierre la de mas arriba y no salga de la app.
  const pila = [];

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

      // Va dentro del marco de la app, no del documento: asi en el
      // computador la ventana aparece dentro del telefono dibujado.
      (document.getElementById('app') || document.body).appendChild(telon);
      // el navegador necesita un respiro antes de animar la entrada
      requestAnimationFrame(() => telon.classList.add('abierto'));

      const entrada = telon.querySelector('#dialogoCampo');
      if (entrada) setTimeout(() => entrada.focus(), 180);

      let yaCerro = false;
      function cerrar(respuesta) {
        if (yaCerro) return;
        yaCerro = true;
        const i = pila.indexOf(cerrar);
        if (i !== -1) pila.splice(i, 1);
        document.removeEventListener('keydown', enTecla);
        telon.classList.remove('abierto');
        setTimeout(() => telon.remove(), 200);
        resolver(respuesta);
      }

      function aceptado() {
        if (!campo) return cerrar(true);
        const valor = Math.round(Number(entrada.value));
        // sin monto valido no cerramos: le marcamos el campo y lo dejamos corregir
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

      // guardamos la funcion de cierre por si el boton "atras" la necesita
      cerrar.cancelar = () => cerrar(campo ? null : false);
      pila.push(cerrar);
    });
  }

  return {
    /** Pregunta de si o no. Devuelve true o false. */
    confirmar: ({ titulo, texto = '', aceptar = 'Si', cancelar = 'Cancelar', peligro = false }) =>
      abrir({ titulo, texto, aceptar, cancelar, peligro }),

    /** Aviso de una sola salida. Devuelve true cuando cierran. */
    avisar: ({ titulo, texto = '', aceptar = 'Entendido' }) =>
      abrir({ titulo, texto, aceptar, cancelar: null }),

    /** Pide un monto en pesos. Devuelve el numero, o null si cancelan. */
    pedirMonto: ({ titulo, texto = '', etiqueta = 'Monto', placeholder = '0', aceptar = 'Guardar' }) =>
      abrir({ titulo, texto, campo: { etiqueta, placeholder }, aceptar, cancelar: 'Cancelar' }),

    /** true si hay alguna ventana de estas abierta. */
    hayAbierto: () => pila.length > 0,

    /** Cierra la de mas arriba como si hubieran cancelado. */
    cerrarUltimo() {
      if (!pila.length) return false;
      pila[pila.length - 1].cancelar();
      return true;
    },
  };
})();
