/* ============================================================
   gráficos.js - Dibuja los gráficos del dashboard.
   No usamos ninguna librería externa: son dibujos SVG hechos a
   mano. Ventaja: la app pesa poco, funciona sin internet y se
   ve nítida en cualquier pantalla.

   Detalle importante: los colores NO se copian como valor fijo,
   se escriben como var(--nombre) dentro de style="...". Así, si
   el celular cambia de modo claro a oscuro, los gráficos se
   adaptan solos sin tener que volver a dibujarlos.
   ============================================================ */

const Graficos = (() => {

  const esc = t => String(t).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ------------------------------------------------------------
     1) DONA - en que se va la plata, por categoría
     ------------------------------------------------------------ */
  function dona(contenedor, datos, opciones = {}) {
    const total = datos.reduce((a, d) => a + d.monto, 0);
    if (!total) {
      contenedor.innerHTML = vacio(opciones.mensajeVacio || 'Sin gastos este mes 🎉');
      return;
    }

    const T = 200;                 // lienzo cuadrado de 200x200
    const centro = T / 2;
    const radio = 78;
    const grosor = 26;
    let angulo = -Math.PI / 2;     // arrancamos arriba
    let arcos = '';

    // Las porciones muy chicas se juntan en "Otros" para no ensuciar el dibujo
    const visibles = [];
    let restoMonto = 0;
    datos.forEach(d => (d.porcentaje >= 3 ? visibles.push(d) : (restoMonto += d.monto)));
    if (restoMonto > 0) {
      visibles.push({
        id: '__resto', nombre: 'Otros pequeños', emoji: '·',
        color: '#9aa6b2', monto: restoMonto, porcentaje: (restoMonto / total) * 100,
      });
    }

    visibles.forEach(d => {
      const barrido = (d.monto / total) * Math.PI * 2;
      const fin = angulo + barrido;
      // pequeño espacio entre porciones para que se distingan
      const hueco = visibles.length > 1 ? Math.min(0.045, barrido * 0.12) : 0;
      arcos += arco(centro, centro, radio, angulo + hueco / 2, fin - hueco / 2, grosor, d.color);
      angulo = fin;
    });

    const principal = visibles[0];
    contenedor.innerHTML = `
      <svg class="grafico" viewBox="0 0 ${T} ${T}" style="max-height:230px" role="img"
           aria-label="Reparto de gastos por categoría">
        ${arcos}
        <text x="${centro}" y="${centro - 8}" text-anchor="middle"
              font-size="10" style="fill:var(--texto-suave)">Gastaste</text>
        <text x="${centro}" y="${centro + 11}" text-anchor="middle"
              font-size="17" font-weight="700" style="fill:var(--texto)">
          ${esc(Datos.formatearDinero(total))}
        </text>
        ${principal ? `<text x="${centro}" y="${centro + 28}" text-anchor="middle"
              font-size="9.5" style="fill:var(--texto-suave)">
          Lo más alto: ${esc(principal.nombre)}</text>` : ''}
      </svg>
      <div class="leyenda">
        ${visibles.map(d => `
          <span class="item">
            <span class="punto" style="background:${d.color}"></span>
            ${esc(d.nombre)}
            <span class="pct">${Math.round(d.porcentaje)}%</span>
          </span>`).join('')}
      </div>`;
  }

  // Genera el "trozo de rosquilla" entre dos ángulos
  function arco(cx, cy, r, desde, hasta, grosor, relleno) {
    const rExt = r, rInt = r - grosor;
    const p = (radio, ang) => [cx + radio * Math.cos(ang), cy + radio * Math.sin(ang)];
    const grande = hasta - desde > Math.PI ? 1 : 0;
    const [x1, y1] = p(rExt, desde), [x2, y2] = p(rExt, hasta);
    const [x3, y3] = p(rInt, hasta), [x4, y4] = p(rInt, desde);
    const d = [
      `M ${x1} ${y1}`,
      `A ${rExt} ${rExt} 0 ${grande} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInt} ${rInt} 0 ${grande} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
    return `<path d="${d}" style="fill:${relleno}"></path>`;
  }

  /* ------------------------------------------------------------
     2) BARRAS - ingresos vs gastos, mes a mes
     ------------------------------------------------------------ */
  function barras(contenedor, meses) {
    const maximo = Math.max(1, ...meses.map(m => Math.max(m.ingresos, m.gastos)));
    const A = 320, H = 170;
    const margenAbajo = 26, margenArriba = 10;
    const alturaUtil = H - margenAbajo - margenArriba;
    const anchoRanura = A / meses.length;
    const anchoBarra = Math.min(15, anchoRanura / 3.2);

    let cuerpo = '';
    // líneas guía horizontales
    for (let i = 0; i <= 3; i++) {
      const y = margenArriba + (alturaUtil / 3) * i;
      cuerpo += `<line x1="0" y1="${y}" x2="${A}" y2="${y}"
                  stroke-width="1" style="stroke:var(--borde)"></line>`;
    }

    meses.forEach((m, i) => {
      const centro = anchoRanura * i + anchoRanura / 2;
      const hIn = (m.ingresos / maximo) * alturaUtil;
      const hGa = (m.gastos / maximo) * alturaUtil;
      const base = margenArriba + alturaUtil;
      const x1 = centro - anchoBarra - 2, x2 = centro + 2;
      cuerpo += `
        <rect x="${x1}" y="${base - hIn}" width="${anchoBarra}" height="${Math.max(hIn, 1.5)}"
              rx="4" style="fill:var(--verde)"></rect>
        <rect x="${x2}" y="${base - hGa}" width="${anchoBarra}" height="${Math.max(hGa, 1.5)}"
              rx="4" style="fill:var(--rojo)"></rect>
        <text x="${centro}" y="${H - 8}" text-anchor="middle" font-size="10"
              style="fill:var(--texto-suave)">${esc(m.etiqueta)}</text>`;
    });

    contenedor.innerHTML = `
      <svg class="grafico" viewBox="0 0 ${A} ${H}" style="max-height:190px" role="img"
           aria-label="Ingresos y gastos de los últimos meses">${cuerpo}</svg>
      <div class="leyenda">
        <span class="item"><span class="punto" style="background:var(--verde)"></span>Entró</span>
        <span class="item"><span class="punto" style="background:var(--rojo)"></span>Salió</span>
      </div>`;
  }

  /* ------------------------------------------------------------
     3) LÍNEA - como evoluciona tu saldo día a día
     ------------------------------------------------------------ */
  function linea(contenedor, puntos) {
    if (puntos.length < 2) {
      contenedor.innerHTML = vacio('Anota un par de días para ver la curva');
      return;
    }

    const A = 320, H = 160, m = { arriba: 14, abajo: 24, izq: 4, der: 4 };
    const valores = puntos.map(p => p.valor);
    let max = Math.max(...valores, 0), min = Math.min(...valores, 0);
    if (max === min) { max += 1; min -= 1; }
    const rango = max - min;

    const x = i => m.izq + (i / (puntos.length - 1)) * (A - m.izq - m.der);
    const y = v => m.arriba + (1 - (v - min) / rango) * (H - m.arriba - m.abajo);

    const camino = puntos.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
    const suelo = y(min < 0 ? 0 : min);
    const relleno = `${camino} L ${x(puntos.length - 1)} ${suelo} L ${x(0)} ${suelo} Z`;
    const ultimo = puntos[puntos.length - 1];
    // verde si terminas el mes en positivo, rojo si terminas en rojo
    const trazo = ultimo.valor >= 0 ? 'var(--verde)' : 'var(--rojo)';

    contenedor.innerHTML = `
      <svg class="grafico" viewBox="0 0 ${A} ${H}" style="max-height:180px" role="img"
           aria-label="Evolucion del saldo durante el mes">
        <defs>
          <linearGradient id="degradadoLinea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   style="stop-color:${trazo}; stop-opacity:.28"></stop>
            <stop offset="100%" style="stop-color:${trazo}; stop-opacity:0"></stop>
          </linearGradient>
        </defs>
        <line x1="0" y1="${y(0)}" x2="${A}" y2="${y(0)}" stroke-width="1"
              stroke-dasharray="4 4" style="stroke:var(--borde)"></line>
        <path d="${relleno}" fill="url(#degradadoLinea)"></path>
        <path d="${camino}" fill="none" stroke-width="2.5" stroke-linejoin="round"
              stroke-linecap="round" style="stroke:${trazo}"></path>
        <circle cx="${x(puntos.length - 1)}" cy="${y(ultimo.valor)}" r="4" style="fill:${trazo}"></circle>
        <text x="0" y="${H - 6}" font-size="10" style="fill:var(--texto-suave)">día 1</text>
        <text x="${A}" y="${H - 6}" font-size="10" text-anchor="end"
              style="fill:var(--texto-suave)">día ${ultimo.dia}</text>
      </svg>`;
  }

  /* ------------------------------------------------------------
     4) BARRA COMPARATIVA - lo que haces vs lo recomendado
     ------------------------------------------------------------ */
  function reglaVisual(contenedor, reparto) {
    const filas = [
      { nombre: 'Necesidades', datos: reparto.necesidades, col: 'var(--azul)',
        pista: 'Techo, comida, transporte, cuentas, salud' },
      { nombre: 'Gustos',      datos: reparto.deseos,      col: 'var(--morado)',
        pista: 'Salidas, ropa, antojos, suscripciones' },
      { nombre: 'Ahorro',      datos: reparto.ahorro,      col: 'var(--verde)',
        pista: 'Lo que guardas o usas para bajar deudas' },
    ];

    contenedor.innerHTML = filas.map(f => {
      const pct = Math.round(f.datos.pct);
      const marca = f.datos.ideal;
      return `
        <div class="linea-progreso">
          <div class="encabezado">
            <span class="nombre">${f.nombre}
              <span style="color:var(--texto-suave); font-weight:400">${pct}%</span>
            </span>
            <span class="cifras">meta ${marca}% · ${esc(Datos.formatearDinero(f.datos.monto))}</span>
          </div>
          <div class="barra" style="position:relative">
            <span style="width:${Math.min(100, pct)}%; background:${f.col}"></span>
            <i style="position:absolute; top:-3px; left:${marca}%; width:2px; height:15px;
                      background:var(--texto-suave); opacity:.55; border-radius:2px"></i>
          </div>
          <p class="ayuda">${f.pista}</p>
        </div>`;
    }).join('');
  }

  const vacio = mensaje =>
    `<p class="vacio" style="padding:20px 0">${esc(mensaje)}</p>`;

  return { dona, barras, linea, reglaVisual };
})();
