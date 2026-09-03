/* ============================================================
   src/ui/capas.js
   LAS CAPAS: todo lo que se pone encima de la pantalla.

   Esto es lo que hace que Mi Bolsillo se sienta una app y no una
   página web. Una app tiene capas: una hoja que sube, un cajón
   que entra, una ventana que pregunta. Y todas obedecen las
   mismas reglas, que es justamente lo que uno nota cuando NO
   pasa.

   Antes esto estaba repartido: las hojas se abrían con un par de
   funciones, el cajón del menú con otro par casi igual, los
   diálogos llevaban su propia pila, y cada uno tenía su gesto sin
   saber del otro. Tres sistemas parecidos son tres sistemas que
   se desincronizan: al agregar el menú, el botón "atrás" dejó de
   cerrarlo bien porque su código no era el mismo que el de las
   hojas.

   Acá hay UNO solo.

   ------------------------------------------------------------
   LAS TRES REGLAS

   1. Todo lo que se abre encima es una capa, y va a la MISMA
      pila. Da igual si es hoja, cajón o diálogo.

   2. El botón "atrás" del teléfono cierra la capa de más arriba,
      una por vez, y nunca saca de la app mientras quede alguna.

   3. Cada capa se cierra con el dedo como corresponde a su forma:
      una hoja se arrastra hacia abajo, un cajón hacia su borde.
      El gesto lo resuelve este archivo, que sabe qué hay abierto,
      y no cada capa por su cuenta.

   ------------------------------------------------------------
   EL ORDEN DE ARRIBA ABAJO

   Las alturas viven en estilos.css como variables (--capa-*), y
   el orden está explicado ahí. Acá solo se respeta.
   ============================================================ */

const Capas = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);

  /* Las formas que puede tener una capa. 'hacia' es por dónde se va
     cuando la arrastras con el dedo; null significa que no se arrastra. */
  const FORMAS = {
    hoja:    { adentro: '.hoja',          hacia: 'abajo' },
    cajon:   { adentro: '.menu-lateral',  hacia: 'izquierda' },
    dialogo: { adentro: '.dialogo',       hacia: null },
  };

  /* La pila. La última es la de más arriba y la primera que se cierra. */
  const pila = [];

  /* Cuando el cierre viene del propio botón "atrás" no hay que devolver
     su entrada de historial: el navegador ya la sacó. */
  let cerrandoPorAtras = false;

  /* Cuántos "atrás" pedimos nosotros y todavía no nos han llegado de
     vuelta. Es un CONTADOR y no un sí/no, y eso importa: history.back()
     no ocurre al tiro, avisa después con un evento. Si se cierran dos
     capas seguidas —confirmar una ventana y acto seguido cerrar la
     hoja— quedan dos "atrás" en vuelo; con un sí/no, el primero apagaba
     la bandera y el segundo se colaba y cerraba de más lo recién
     abierto. Pasó de verdad: el comprobante de una venta se abría y
     desaparecía solo. */
  let atrasProgramado = 0;

  /* Lo que la app quiera hacer cuando se cierre una capa concreta.
     Por ejemplo, soltar los respaldos de un formulario abandonado. */
  const alCerrarse = {};

  /* ============================================================
     1. ABRIR Y CERRAR
     ============================================================ */

  /**
   * Abre una capa por el id de su telón.
   * @param {string} id      el id del telón (telonMovimiento, telonMenu…)
   * @param {string} forma   'hoja' | 'cajon' | 'dialogo'
   */
  function abrir(id, forma) {
    const telon = $$$(id);
    if (!telon || telon.classList.contains('abierto')) return false;
    telon.classList.add('abierto');
    apilar({ id, forma: forma || 'hoja', cerrar: () => esconder(id) });
    return true;
  }

  /** Cierra una capa concreta. Si no estaba abierta, no hace nada. */
  function cerrar(id) {
    const telon = $$$(id);
    if (!telon || !telon.classList.contains('abierto')) return false;
    esconder(id);
    despilar(id);
    if (alCerrarse[id]) alCerrarse[id]();
    return true;
  }

  /**
   * Esconde el telón y suelta el foco si se había quedado adentro.
   *
   * Sin el blur, el cursor sigue dentro de un campo que ya no se ve: en
   * el teléfono el teclado queda colgando, y en el computador todo lo
   * que escribas —Ctrl+V incluido— se lo lleva un campo invisible.
   */
  function esconder(id) {
    const telon = $$$(id);
    if (!telon) return;
    telon.classList.remove('abierto');
    if (telon.contains(document.activeElement)) document.activeElement.blur();
  }

  /**
   * Apila algo que ya se abrió. Lo usan también los diálogos, que se
   * dibujan solos y solo necesitan entrar a la pila.
   */
  function apilar(capa) {
    pila.push(capa);
    history.pushState({ capas: pila.length }, '');
  }

  /**
   * Saca una capa de la pila y devuelve su entrada de historial.
   * Si el cierre vino del botón "atrás", el navegador ya la sacó.
   */
  function despilar(id) {
    if (cerrandoPorAtras || !pila.length) return;
    const i = id ? pila.map(c => c.id).lastIndexOf(id) : pila.length - 1;
    if (i === -1) return;
    pila.splice(i, 1);
    atrasProgramado++;
    history.back();
  }

  /** Cierra la de más arriba, como si hubieran tocado fuera. */
  function cerrarLaDeArriba() {
    if (!pila.length) return false;
    const arriba = pila[pila.length - 1];
    cerrandoPorAtras = true;
    arriba.cerrar();
    cerrandoPorAtras = false;
    pila.pop();
    if (alCerrarse[arriba.id]) alCerrarse[arriba.id]();
    return true;
  }

  const hayAlgo = () => pila.length > 0;
  const cuantas = () => pila.length;
  const laDeArriba = () => (pila.length ? pila[pila.length - 1] : null);
  const estaAbierta = id => pila.some(c => c.id === id);

  /** "Cuando se cierre esta capa, haz esto." */
  function avisarmeAlCerrar(id, quehacer) { alCerrarse[id] = quehacer; }

  /* ============================================================
     2. EL BOTÓN "ATRÁS" DEL TELÉFONO
     ============================================================ */

  /**
   * En una app, "atrás" cierra lo que tengas abierto; nunca te saca a
   * la calle. Para conseguirlo cada capa deja una entrada de historial,
   * y acá se decide qué hacer con cada "atrás" que llega.
   *
   * @param {function} volverAPantalla  qué hacer cuando ya no quedan capas
   */
  function prepararBotonAtras(volverAPantalla) {
    history.replaceState({ tab: 'inicio' }, '');

    window.addEventListener('popstate', evento => {
      // Este "atrás" lo pedimos nosotros al cerrar algo: ya está hecho.
      if (atrasProgramado > 0) { atrasProgramado--; return; }

      // 1. ¿Hay algo abierto encima? Se cierra lo de más arriba y nos
      //    quedamos donde estábamos.
      if (cerrarLaDeArriba()) return;

      // 2. Estábamos en otra pestaña: volvemos a la anterior.
      if (evento.state && evento.state.tab && volverAPantalla) {
        volverAPantalla(evento.state.tab);
        return;
      }

      // 3. Inicio y nada abierto: que el teléfono cierre la app.
    });
  }

  /* ============================================================
     3. LOS GESTOS

     Un solo lugar decide qué hace el dedo, y eso es justamente lo
     que antes fallaba: el arrastre de las hojas y el del menú
     vivían separados, no se conocían, y el del menú le robaba el
     gesto a la hoja que estuviera encima.
     ============================================================ */

  function prepararGestos(marco, opciones) {
    const config = opciones || {};
    const abrirCajon = config.abrirCajon || (() => {});
    const cerrarCajon = config.cerrarCajon || (() => {});
    const cajonId = config.cajonId;
    const vibrar = config.vibrar || (() => {});
    const DESDE_EL_BORDE = 20;     // píxeles del borde que abren el cajón

    let gesto = null;

    marco.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const arriba = laDeArriba();

      // a) Con una HOJA arriba: se arrastra hacia abajo para cerrarla,
      //    y solo si ya está mostrando su principio (si no, la persona
      //    está leyendo su contenido y quiere desplazarlo).
      if (arriba && arriba.forma === 'hoja') {
        const hoja = $$$(arriba.id).querySelector(FORMAS.hoja.adentro);
        if (!hoja || hoja.scrollTop > 0) return;
        gesto = { que: 'hoja', elemento: hoja, id: arriba.id, x: t.clientX, y: t.clientY, recorrido: 0 };
        hoja.classList.add('arrastrando');
        return;
      }

      // b) Con el CAJÓN arriba: se arrastra hacia su borde para cerrarlo.
      if (arriba && arriba.forma === 'cajon') {
        const cajon = $$$(arriba.id).querySelector(FORMAS.cajon.adentro);
        if (!cajon) return;
        gesto = { que: 'cerrar-cajon', elemento: cajon, id: arriba.id, x: t.clientX, y: t.clientY, recorrido: 0 };
        cajon.classList.add('arrastrando');
        return;
      }

      // c) Sin nada abierto: desde el borde izquierdo se abre el cajón.
      //    Se exige que el dedo PARTA en el borde; una franja que
      //    capturara toques se comería el toque de cualquier cosa
      //    pegada a ese borde, y ahí hay casillas y botones.
      if (!arriba && cajonId && t.clientX <= DESDE_EL_BORDE) {
        const telon = $$$(cajonId);
        const cajon = telon && telon.querySelector(FORMAS.cajon.adentro);
        if (!cajon) return;
        gesto = { que: 'abrir-cajon', elemento: cajon, id: cajonId, x: t.clientX, y: t.clientY, recorrido: 0 };
        cajon.classList.add('arrastrando');
        telon.classList.add('abierto');
      }
    }, { passive: true });

    marco.addEventListener('touchmove', e => {
      if (!gesto) return;
      const t = e.touches[0];
      const ancho = gesto.elemento.offsetWidth || 280;

      if (gesto.que === 'hoja') {
        gesto.recorrido = Math.max(0, t.clientY - gesto.y);
        gesto.elemento.style.transform = `translateY(${gesto.recorrido}px)`;
      } else if (gesto.que === 'abrir-cajon') {
        gesto.recorrido = Math.max(0, t.clientX - gesto.x);
        gesto.elemento.style.transform =
          `translateX(${Math.min(0, -ancho + gesto.recorrido)}px)`;
      } else {
        gesto.recorrido = Math.min(0, t.clientX - gesto.x);
        gesto.elemento.style.transform = `translateX(${gesto.recorrido}px)`;
      }
    }, { passive: true });

    const soltar = () => {
      if (!gesto) return;
      const g = gesto;
      gesto = null;
      g.elemento.classList.remove('arrastrando');
      g.elemento.style.transform = '';

      if (g.que === 'hoja') {
        // Pasado el tercio de la hoja se cierra; si no, vuelve a su sitio.
        if (g.recorrido > Math.min(120, g.elemento.offsetHeight / 3)) {
          vibrar(6);
          cerrar(g.id);
        }
        return;
      }

      const ancho = g.elemento.offsetWidth || 280;
      const suficiente = Math.abs(g.recorrido) > ancho / 3;

      if (g.que === 'abrir-cajon') {
        // Durante el arrastre el telón ya estaba "abierto" para poder
        // verse. Se quita antes de abrirlo de verdad, porque abrir() se
        // sale sola si lo encuentra abierto: sin esto el cajón quedaba
        // abierto SIN entrar a la pila, y el botón "atrás" sacaba de la
        // app en vez de cerrarlo.
        $$$(g.id).classList.remove('abierto');
        if (suficiente) { vibrar(6); abrirCajon(); }
      } else if (suficiente) {
        vibrar(6);
        cerrarCajon();
      }
    };

    marco.addEventListener('touchend', soltar);
    marco.addEventListener('touchcancel', soltar);
  }

  return {
    FORMAS,
    abrir, cerrar, esconder, apilar, despilar, cerrarLaDeArriba,
    hayAlgo, cuantas, laDeArriba, estaAbierta, avisarmeAlCerrar,
    prepararBotonAtras, prepararGestos,
  };
})();
