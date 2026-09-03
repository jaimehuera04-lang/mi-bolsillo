/* ============================================================
   src/ui/catalogo.js
   Tu catálogo: una página web completa armada con tus productos.

   Otras apps venden esto como "crea tu sitio web con IA". Acá no
   hace falta ninguna IA, y eso no es un consuelo: un catálogo es
   una plantilla con tus datos adentro. Lo que lo hace útil son
   tus fotos, tus precios y tu número de WhatsApp, no un modelo
   escribiendo relleno.

   Lo que sale es UN archivo .html solo, sin internet, sin
   librerías y sin llamadas a ninguna parte. Las fotos van
   metidas adentro como data URI, así que el archivo se puede
   mandar por WhatsApp, subir a cualquier hosting gratis o abrir
   desde el propio teléfono, y se ve igual.

   Cada producto trae su botón de WhatsApp con el mensaje ya
   escrito, que es como se vende de verdad en Chile.
   ============================================================ */

const UiCatalogo = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = m => Dinero.formatear(m);

  /* ---------------- La pantalla dentro de la app ---------------- */

  function pantalla(cabecera) {
    const p = DatosNegocio.perfil();
    const a = DatosNegocio.ajustes().catalogo;
    const publicados = DatosNegocio.productos().filter(x => x.enCatalogo !== false);
    const conFoto = publicados.filter(x => (x.fotos || []).length).length;

    return cabecera('Mi catálogo') + `
      <div class="tarjeta">
        <h3>🌐 Tu página, armada sola</h3>
        <p class="ayuda">
          La app arma un archivo con tus ${publicados.length}
          ${publicados.length === 1 ? 'producto' : 'productos'} publicados, tus fotos adentro
          y un botón de WhatsApp por producto. Lo mandas, lo subes a donde quieras
          o lo abres desde el teléfono: funciona sin internet.
        </p>
        <div class="negocio-detalle">
          <div><span>Productos publicados</span><strong>${publicados.length}</strong></div>
          <div><span>Con foto</span><strong>${conFoto}</strong></div>
        </div>
        ${conFoto < publicados.length ? `
          <p class="ayuda">
            ${publicados.length - conFoto} sin foto. Un catálogo con fotos vende mucho más;
            agrégalas desde Inventario.
          </p>` : ''}
      </div>

      <div class="tarjeta">
        <h3>Cómo se va a ver</h3>
        <label for="catWhatsapp">Tu WhatsApp para los pedidos</label>
        <input type="tel" id="catWhatsapp" value="${esc(a.whatsapp || p.telefono || '')}"
               placeholder="+56 9 1234 5678" autocomplete="off">
        <p class="ayuda">Cada producto va a tener un botón que abre un chat contigo con el
           mensaje ya escrito.</p>

        <label class="interruptor">
          <input type="checkbox" id="catPrecios" ${a.mostrarPrecios !== false ? 'checked' : ''}>
          <span>Mostrar los precios</span>
        </label>
        <label class="interruptor">
          <input type="checkbox" id="catStock" ${a.mostrarStock ? 'checked' : ''}>
          <span>Mostrar cuántos quedan</span>
        </label>
        <p class="ayuda">Mostrar el stock apura al que está dudando, pero también deja ver
           cuando te queda uno solo.</p>

        <button class="boton secundario" data-catalogo="guardar">Guardar estos ajustes</button>
      </div>

      <div class="tarjeta">
        <h3>Llevártelo</h3>
        <button class="boton" data-catalogo="ver">👁️ Verlo antes</button>
        <button class="boton secundario" data-catalogo="bajar" style="margin-top:8px">
          💾 Bajar el archivo
        </button>
        <button class="boton secundario" data-catalogo="compartir" style="margin-top:8px">
          📤 Compartirlo
        </button>
        <p class="ayuda" style="margin-top:12px">
          ¿Quieres que tenga una dirección propia en internet? Sube ese archivo a
          Netlify Drop o a GitHub Pages, que son gratis. Arrastras el archivo y te dan el enlace.
        </p>
      </div>

      ${publicados.length ? `
        <div class="tarjeta">
          <h3>Lo que va a salir</h3>
          <ul class="lista">
            ${publicados.map(x => `
              <li class="movimiento" data-producto="${x.id}">
                <span class="emoji ${(x.fotos || []).length ? 'con-foto' : ''}"
                      data-foto="${(x.fotos || [])[0] ? esc(x.fotos[0].id) : ''}">${(x.fotos || []).length ? '' : '📦'}</span>
                <div class="info">
                  <strong>${esc(x.nombre)}</strong>
                  <span class="ayuda">${(x.fotos || []).length ? 'Con foto' : 'Sin foto todavía'}</span>
                </div>
                <div class="monto"><strong>${dinero(x.precio)}</strong></div>
              </li>`).join('')}
          </ul>
        </div>` : `
        <div class="vacio">
          <div style="font-size:38px">🌐</div>
          <strong>Todavía no hay nada que publicar</strong>
          <p>Agrega productos en Inventario y vuelve acá.</p>
        </div>`}`;
  }

  /* ---------------- Armar el archivo ---------------- */

  /**
   * Las fotos van dentro del archivo como data URI. Es la única
   * forma de que un .html suelto se vea completo en el teléfono de
   * otra persona, sin servidor y sin carpeta de imágenes al lado.
   */
  async function fotosEnTexto(productos) {
    const mapa = {};
    for (const p of productos) {
      const ficha = (p.fotos || [])[0];
      if (!ficha) continue;
      try {
        const guardado = await Adjuntos.obtener(ficha.id);
        if (guardado && guardado.blob) mapa[p.id] = await aDataUrl(guardado.blob);
      } catch (e) { /* sin foto, el producto igual sale */ }
    }
    return mapa;
  }

  const aDataUrl = blob => new Promise(resolver => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => resolver('');
    lector.readAsDataURL(blob);
  });

  const soloNumeros = tel => String(tel || '').replace(/[^0-9]/g, '');

  async function armar() {
    const p = DatosNegocio.perfil();
    const a = DatosNegocio.ajustes().catalogo;
    const productos = DatosNegocio.productos().filter(x => x.enCatalogo !== false);
    const fotos = await fotosEnTexto(productos);
    const wsp = soloNumeros(a.whatsapp || p.telefono);

    const porCategoria = {};
    productos.forEach(x => {
      const cat = (x.categoria || '').trim() || 'Todo';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(x);
    });
    const categorias = Object.keys(porCategoria).sort();

    const tarjeta = x => {
      const hay = DatosNegocio.stockTotalDe(x);
      const agotado = x.controlaStock !== false && hay <= 0;
      const precios = x.variantes && x.variantes.length
        ? [...new Set(x.variantes.map(v => v.precio))].sort((m, n) => m - n)
        : [x.precio];
      const mensaje = encodeURIComponent(
        `Hola! Vi ${x.nombre} en su catálogo y quiero saber más.`);

      return `
      <article class="p${agotado ? ' agotado' : ''}">
        <div class="foto">${fotos[x.id]
          ? `<img src="${fotos[x.id]}" alt="${esc(x.nombre)}" loading="lazy">`
          : '<span>📦</span>'}
          ${agotado ? '<span class="cinta">Agotado</span>' : ''}
        </div>
        <div class="d">
          <h3>${esc(x.nombre)}</h3>
          ${x.descripcion ? `<p>${esc(x.descripcion)}</p>` : ''}
          ${x.variantes && x.variantes.length
            ? `<p class="v">${x.variantes.map(v => esc(v.nombre)).join(' · ')}</p>` : ''}
          ${a.mostrarPrecios !== false ? `<strong class="precio">${
            precios.length > 1 && precios[0] !== precios[precios.length - 1]
              ? `${dinero(precios[0])} a ${dinero(precios[precios.length - 1])}`
              : dinero(precios[0])
          }</strong>` : ''}
          ${a.mostrarStock && x.controlaStock !== false && hay > 0
            ? `<span class="stock">Quedan ${hay}</span>` : ''}
          ${wsp && !agotado
            ? `<a class="wsp" href="https://wa.me/${wsp}?text=${mensaje}"
                  target="_blank" rel="noopener">Lo quiero</a>` : ''}
        </div>
      </article>`;
    };

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.nombre || 'Catálogo')}</title>
<meta name="description" content="${esc(p.mensaje || p.rubro || 'Catálogo de productos')}">
<style>
  :root{--m:${esc(p.color || '#10a072')};--f:#f6f8f9;--t:#1c2530;--s:#6a7785;--b:#e6ebef;--c:#fff}
  @media(prefers-color-scheme:dark){:root{--f:#12171d;--t:#e9eef3;--s:#94a3b3;--b:#2a333e;--c:#1b222b}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--f);color:var(--t);
       font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  header{background:var(--m);color:#fff;padding:34px 20px 30px;text-align:center}
  header .e{font-size:46px;line-height:1}
  header h1{margin:8px 0 4px;font-size:27px;letter-spacing:-.02em}
  header p{margin:0;opacity:.92;font-size:15px}
  nav{position:sticky;top:0;z-index:5;background:var(--c);border-bottom:1px solid var(--b);
      display:flex;gap:8px;overflow-x:auto;padding:11px 16px;scrollbar-width:none}
  nav::-webkit-scrollbar{display:none}
  nav a{flex:0 0 auto;text-decoration:none;color:var(--t);font-size:13.5px;font-weight:600;
        padding:6px 13px;border:1px solid var(--b);border-radius:999px}
  main{max-width:960px;margin:0 auto;padding:22px 16px 60px}
  h2{font-size:19px;margin:26px 0 12px}
  .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:14px}
  .p{background:var(--c);border-radius:16px;overflow:hidden;border:1px solid var(--b);
     display:flex;flex-direction:column}
  .p.agotado{opacity:.62}
  .foto{position:relative;aspect-ratio:1;background:var(--f);display:grid;place-items:center;
        font-size:40px}
  .foto img{width:100%;height:100%;object-fit:cover;display:block}
  .cinta{position:absolute;top:9px;left:9px;background:#e2564d;color:#fff;font-size:11px;
         font-weight:700;padding:3px 9px;border-radius:999px}
  .d{padding:12px 13px 14px;display:flex;flex-direction:column;gap:5px;flex:1}
  .d h3{margin:0;font-size:14.5px;line-height:1.3}
  .d p{margin:0;font-size:12.5px;color:var(--s)}
  .d .v{font-size:11.5px}
  .precio{font-size:17px;margin-top:auto;padding-top:4px}
  .stock{font-size:11.5px;color:var(--s)}
  .wsp{margin-top:8px;display:block;text-align:center;text-decoration:none;
       background:var(--m);color:#fff;font-weight:700;font-size:13.5px;
       padding:9px;border-radius:11px}
  footer{text-align:center;padding:26px 20px 40px;color:var(--s);font-size:13px}
  footer a{color:var(--m)}
</style>
</head>
<body>
<header>
  <div class="e">${esc(p.emoji || '🏪')}</div>
  <h1>${esc(p.nombre || 'Mi catálogo')}</h1>
  ${p.mensaje || p.rubro ? `<p>${esc(p.mensaje || p.rubro)}</p>` : ''}
</header>

${categorias.length > 1 ? `<nav>${categorias.map(c =>
  `<a href="#c-${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</nav>` : ''}

<main>
  ${categorias.map(c => `
    <section id="c-${encodeURIComponent(c)}">
      ${categorias.length > 1 ? `<h2>${esc(c)}</h2>` : ''}
      <div class="g">${porCategoria[c].map(tarjeta).join('')}</div>
    </section>`).join('')}
  ${!productos.length ? '<p style="text-align:center;color:var(--s)">Catálogo en preparación.</p>' : ''}
</main>

<footer>
  ${p.direccion ? `<p>${esc(p.direccion)}</p>` : ''}
  ${wsp ? `<p><a href="https://wa.me/${wsp}">Escríbenos por WhatsApp</a></p>` : ''}
  ${p.rut ? `<p>RUT ${esc(p.rut)}</p>` : ''}
  <p style="opacity:.6;font-size:11.5px;margin-top:14px">
    Catálogo generado el ${Fechas.hoyISO()} con Mi Bolsillo
  </p>
</footer>
</body>
</html>`;
  }

  const nombreArchivo = () => {
    const p = DatosNegocio.perfil();
    // Las tildes y las eñes se las lleva el propio [^a-z0-9]: no hace
    // falta normalizar nada. "Almacén Doña Rosa" queda "almac-n-do-a-rosa",
    // que es feo pero es un nombre de archivo, no un texto que alguien lea.
    return String(p.nombre || 'catalogo').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '.html';
  };

  /* ---------------- Los botones ---------------- */

  async function accion(cual) {
    if (cual === 'guardar') {
      DatosNegocio.guardarAjustes({
        catalogo: {
          whatsapp: $$$('catWhatsapp').value,
          mostrarPrecios: $$$('catPrecios').checked,
          mostrarStock: $$$('catStock').checked,
        },
      });
      window.App.avisar('Guardado.');
      return;
    }

    if (!DatosNegocio.productos().filter(x => x.enCatalogo !== false).length) {
      return window.App.avisar('Primero agrega algún producto al catálogo.');
    }

    window.App.avisar('Armando tu catálogo…');
    const html = await armar();

    if (cual === 'ver') {
      // Se abre en una pestaña nueva del navegador. Es el único lugar
      // de la app donde eso está bien: el catálogo ES una página web,
      // y lo que hay que ver es exactamente cómo lo va a ver un cliente.
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const ventana = window.open(url, '_blank');
      if (!ventana) window.App.avisar('Tu navegador bloqueó la ventana. Usa "Bajar el archivo".');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const nombre = nombreArchivo();

    if (cual === 'compartir') {
      const archivo = new File([blob], nombre, { type: 'text/html' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: DatosNegocio.perfil().nombre });
          return;
        } catch (e) { return; }   // si cancela, no pasa nada
      }
      window.App.avisar('Este aparato no puede compartir archivos. Bájalo y mándalo tú.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.App.avisar(`Listo: ${nombre}`);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-catalogo]');
    if (t) accion(t.dataset.catalogo);
  });

  return { pantalla, armar, nombreArchivo };
})();
