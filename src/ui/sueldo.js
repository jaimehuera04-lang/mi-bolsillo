/* ============================================================
   src/ui/sueldo.js
   La pantalla del SUELDO LIBRE, que es la razón de existir de
   esta app.

   Otras apps de finanzas te muestran lo que gastaste. Esta te
   muestra lo que ya prometiste: la plata que todavía está en tu
   cuenta pero que ya no es tuya.

   Tres cosas que este archivo hace y que no son negociables:

     1. La cifra grande NUNCA se muestra sola. Siempre trae al
        lado de qué se compone y se puede tocar para ver el
        desglose línea por línea. Un número sin explicación es un
        número en el que nadie confía, y esta app se juega entera
        en que la persona le crea a esta cifra.

     2. Ningún texto de acá lo inventa un modelo. Todo sale de
        core/sueldo.js, que es aritmética. Regla 1.

     3. Cuando el número es malo, se dice que es malo. Una app
        que maquilla un mes en rojo es peor que no tener app.

   Igual que el negocio, usa de la cáscara solo lo que app.js
   publica en window.App, y se apoya en DOS hojas que se rellenan
   por dentro, para que el botón "atrás" cierre siempre una sola
   cosa.
   ============================================================ */

const UiSueldo = (() => {
  'use strict';

  const $$$ = id => document.getElementById(id);
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = m => Dinero.formatear(m);
  const avisar = t => window.App.avisar(t);

  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const vista = {
    seccion: null,
    // Lo que la persona está escribiendo en el simulador. Vive acá y
    // no en el estado guardado: una compra que estás pensando no es
    // un dato, es una duda.
    simulacion: { monto: 0, cuotas: 12, interesTotal: 0, diaDelMes: 5 },
  };

  /* ============================================================
     1. LA TARJETA DE INICIO — lo primero que se ve al abrir
     ============================================================ */

  function dibujarEnInicio() {
    const caja = $$$('sueldoLibreHero');
    if (!caja) return;

    const { anio, mes } = window.App.mesEnPantalla();
    const s = Datos.sueldoLibre(anio, mes);

    // Si todavía no hay nada que calcular, la app no finge un número:
    // invita a poner lo mínimo para que la cifra signifique algo.
    if (s.ingreso === 0 && s.comprometido === 0) {
      caja.innerHTML = tarjetaVacia();
      return;
    }

    const liberacion = Datos.fechaLiberacion();
    const avisos = Datos.mesesApretados(anio, mes, 12);
    const proximo = avisos[0];

    caja.innerHTML = `
      <div class="tarjeta hero-sueldo ${s.libre < 0 ? 'en-rojo' : ''}" data-sueldo="desglose">
        <div class="hero-rotulo">Tu sueldo libre de ${esc(Fechas.NOMBRES_MES[mes])}</div>
        <div class="hero-cifra">${dinero(s.libre)}</div>

        ${s.ingreso > 0 ? `
          <p class="hero-frase">
            De tus ${dinero(s.ingreso)}, <strong>${dinero(s.comprometido)} ya están comprometidos</strong>.
          </p>
          <div class="barra-comprometido">
            <span class="cuotas"       style="width:${porcentaje(s.cuotas, s.ingreso)}%"></span>
            <span class="fijos"        style="width:${porcentaje(s.fijos, s.ingreso)}%"></span>
            <span class="estacionales" style="width:${porcentaje(s.estacionales, s.ingreso)}%"></span>
            <span class="metas"        style="width:${porcentaje(s.metas, s.ingreso)}%"></span>
          </div>
          <div class="leyenda-comprometido">
            ${s.cuotas       ? `<span><i class="cuotas"></i>Cuotas ${dinero(s.cuotas)}</span>` : ''}
            ${s.fijos        ? `<span><i class="fijos"></i>Fijos ${dinero(s.fijos)}</span>` : ''}
            ${s.estacionales ? `<span><i class="estacionales"></i>Del mes ${dinero(s.estacionales)}</span>` : ''}
            ${s.metas        ? `<span><i class="metas"></i>Metas ${dinero(s.metas)}</span>` : ''}
            <span><i class="libre"></i>Libre ${dinero(Math.max(0, s.libre))}</span>
          </div>` : `
          <p class="hero-frase">
            Todavía no me has dicho cuánto esperas recibir al mes, así que esto es
            solo lo que ya prometiste.
          </p>`}

        ${s.libre < 0 ? `
          <div class="aviso-sueldo alto">
            <span>⚠️</span>
            <div>
              <strong>Este mes no cierra</strong>
              <span>Te faltan ${dinero(Math.abs(s.libre))} para cubrir lo que ya comprometiste.</span>
            </div>
          </div>` : ''}

        <span class="hero-toque">Toca para ver el desglose completo</span>
      </div>

      <!-- Los tres accesos van pegados a la cifra, y no más abajo, por
           dos razones: son la acción que sigue naturalmente después de
           ver el número, y ahí arriba el botón flotante (+) no los tapa.
           Abajo a la derecha los cubría justo encima. -->
      <div class="fila-acciones-sueldo">
        <button class="boton-accion" data-sueldo="simulador">
          <span class="icono">🧮</span><span>¿Y si lo pago<br>en cuotas?</span>
        </button>
        <button class="boton-accion" data-sueldo="proyeccion">
          <span class="icono">📅</span><span>Mis próximos<br>12 meses</span>
        </button>
        <button class="boton-accion" data-sueldo="compromisos">
          <span class="icono">🔗</span><span>Lo que ya<br>prometí</span>
        </button>
      </div>

      ${proximo ? tarjetaDeAviso(proximo, anio, mes) : ''}

      ${liberacion ? `
        <div class="tarjeta liberacion" data-sueldo="liberacion">
          <div class="liberacion-icono">🔓</div>
          <div>
            <strong>Terminas de deber el ${fechaLarga(liberacion.fecha)}</strong>
            <span class="ayuda">
              ${liberacion.mesesQueFaltan <= 0 ? 'Este mes' : `Faltan ${liberacion.mesesQueFaltan} ${liberacion.mesesQueFaltan === 1 ? 'mes' : 'meses'}`}
              · ${liberacion.cuantasCuotas} ${liberacion.cuantasCuotas === 1 ? 'cuota' : 'cuotas'}
              · ${dinero(liberacion.totalQueFalta)}
            </span>
          </div>
        </div>` : ''}`;
  }

  const porcentaje = (parte, total) =>
    total > 0 ? Math.max(0, Math.min(100, (parte / total) * 100)) : 0;

  function fechaLarga(iso) {
    const f = Fechas.aFecha(iso);
    return `${f.getDate()} de ${Fechas.NOMBRES_MES[f.getMonth()]} de ${f.getFullYear()}`;
  }

  function tarjetaVacia() {
    return `
      <div class="tarjeta hero-sueldo vacia">
        <div class="hero-rotulo">Tu sueldo libre</div>
        <div class="hero-cifra apagada">—</div>
        <p class="hero-frase">
          Esta es la cifra que hace distinta a esta app: <strong>no lo que gastaste,
          sino lo que ya prometiste</strong>. Para calcularla necesito dos cosas.
        </p>
        <div class="fila-botones">
          <button class="boton" data-sueldo="form-ingreso">1. Cuánto recibo al mes</button>
        </div>
        <button class="boton secundario" data-sueldo="form-fijo" style="margin-top:8px">
          2. Qué pago todos los meses
        </button>
        <p class="ayuda" style="margin-top:12px">
          El dividendo o el arriendo, la isapre, el celular, el CAE. Después puedes
          agregar tus cuotas y los gastos de marzo.
        </p>
      </div>`;
  }

  /**
   * El aviso anticipado: el Modo Marzo.
   * No dice "ojo con marzo": dice cuánto guardar cada mes desde hoy
   * para llegar preparado. Un aviso sin una acción concreta al lado
   * solo genera angustia.
   */
  function tarjetaDeAviso(m, anio, mes) {
    const porQue = Datos.porQueApretaElMes(m.mes);
    return `
      <div class="tarjeta aviso-anticipado" data-sueldo="marzo">
        <div class="aviso-cabecera">
          <span class="icono">${m.libre < 0 ? '🔴' : '🟡'}</span>
          <div>
            <strong>${esc(Fechas.nombreMes(m.anio, m.mes))} viene apretado</strong>
            <span class="ayuda">
              ${m.libre < 0
                ? `Te faltarían ${dinero(Math.abs(m.libre))}`
                : `Te quedarían solo ${dinero(m.libre)} libres`}
              · faltan ${m.mesesDeAviso} ${m.mesesDeAviso === 1 ? 'mes' : 'meses'}
            </span>
          </div>
        </div>
        ${porQue ? `<p class="ayuda">${esc(porQue)}</p>` : ''}
        ${m.guardarPorMes > 0 ? `
          <div class="consejo">
            <strong>💡 Qué puedes hacer desde hoy</strong>
            Guardar <strong>${dinero(m.guardarPorMes)} al mes</strong> durante estos
            ${m.mesesDeAviso} ${m.mesesDeAviso === 1 ? 'mes' : 'meses'} y llegas cubierto.
          </div>` : ''}
      </div>`;
  }

  /* ============================================================
     2. EL DESGLOSE — de dónde sale cada peso
     ============================================================ */

  function abrirSeccion(nombre) {
    vista.seccion = nombre;
    pintarSeccion();
    window.App.abrirHoja('telonSueldo');
  }

  function pintarSeccion() {
    const caja = $$$('sueldoSeccion');
    if (!caja || !vista.seccion) return;
    const pintores = { desglose, compromisos, proyeccion, simulador, marzo, liberacion };
    caja.innerHTML = (pintores[vista.seccion] || (() => ''))();
    if (vista.seccion === 'proyeccion') dibujarGraficoProyeccion();
    if (vista.seccion === 'simulador') dibujarComparacion();
  }

  const cabecera = (titulo, extra) => `
    <div class="tarjeta-titulo">
      <h2>${esc(titulo)}</h2>
      <button class="boton fantasma chico" data-cerrar-sueldo="telonSueldo">Cerrar</button>
    </div>
    ${extra || ''}`;

  function desglose() {
    const { anio, mes } = window.App.mesEnPantalla();
    const s = Datos.sueldoLibre(anio, mes);
    const d = s.detalle;

    const bloque = (titulo, lista, total, campoMonto, quePasa) => {
      if (!lista.length) return '';
      return `
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h3>${titulo}</h3><strong>−${dinero(total)}</strong></div>
          <ul class="lista">
            ${lista.map(x => `
              <li class="movimiento">
                <span class="emoji">${esc(x.emoji || Categorias.porId(x.categoria).emoji)}</span>
                <div class="info">
                  <strong>${esc(x.nombre)}</strong>
                  <span class="ayuda">${x.fechaDelMes ? 'El ' + Fechas.aFecha(x.fechaDelMes).getDate() : ''}
                    ${x.estado === 'pagado' ? ' · ya pagado' : ''}</span>
                </div>
                <div class="monto">${dinero(x[campoMonto])}</div>
              </li>`).join('')}
          </ul>
          ${quePasa ? `<p class="ayuda">${quePasa}</p>` : ''}
        </div>`;
    };

    return cabecera(`Tu ${Fechas.nombreMes(anio, mes)}, peso por peso`) + `
      <div class="tarjeta">
        <div class="tarjeta-titulo"><h3>Lo que esperas que entre</h3><strong class="verde">${dinero(s.ingreso)}</strong></div>
        ${d.ingresos.length ? `<ul class="lista">${d.ingresos.map(i => `
          <li class="movimiento">
            <span class="emoji">💼</span>
            <div class="info"><strong>${esc(i.nombre)}</strong>
              <span class="ayuda">El ${Fechas.aFecha(i.fecha).getDate()}</span></div>
            <div class="monto verde">${dinero(i.monto)}</div>
          </li>`).join('')}</ul>` : `
          <p class="ayuda">No has anotado ningún ingreso previsto.</p>
          <button class="boton secundario" data-sueldo="form-ingreso">Anotar lo que recibo al mes</button>`}
      </div>

      ${bloque('Cuotas', d.cuotas, s.cuotas, 'montoDelMes',
        'Compras que ya hiciste y sigues pagando. Cada una tiene fecha de término.')}
      ${bloque('Compromisos fijos', d.fijos, s.fijos, 'montoDelMes',
        'Lo que pagas todos los meses: vivienda, salud, servicios, deudas.')}
      ${bloque('Lo que trae este mes', d.estacionales, s.estacionales, 'montoDelMes',
        'Gastos que sabías que venían: marzo, el permiso, el 18, diciembre.')}
      ${d.metas.length ? `
        <div class="tarjeta">
          <div class="tarjeta-titulo"><h3>Lo que le prometiste a tus metas</h3><strong>−${dinero(s.metas)}</strong></div>
          <ul class="lista">
            ${d.metas.map(m => `
              <li class="movimiento">
                <span class="emoji">${esc(m.emoji)}</span>
                <div class="info"><strong>${esc(m.nombre)}</strong>
                  <span class="ayuda">Aporte de este mes</span></div>
                <div class="monto">${dinero(m.monto)}</div>
              </li>`).join('')}
          </ul>
          <p class="ayuda">
            Ahorrar también es un compromiso, aunque sea contigo mismo. Si no se
            descontara, esta cifra te diría que tienes plata que en realidad ya
            destinaste.
          </p>
        </div>` : ''}

      <div class="tarjeta total-sueldo ${s.libre < 0 ? 'en-rojo' : ''}">
        <div class="fila-total"><span>Entra</span><strong class="verde">${dinero(s.ingreso)}</strong></div>
        <div class="fila-total"><span>Ya prometido</span><strong class="rojo">−${dinero(s.comprometido)}</strong></div>
        <div class="fila-total grande"><span>Te queda libre</span><strong>${dinero(s.libre)}</strong></div>
        <p class="ayuda">
          ${s.libre < 0
            ? 'Este mes no cierra. No es un error de la app: es lo que hay, y verlo a tiempo es lo que permite hacer algo.'
            : `Eso es ${dinero(Math.round(s.libre / Fechas.diasDelMes(anio, mes)))} por día hasta fin de mes.`}
        </p>
      </div>

      <button class="boton secundario" data-sueldo="compromisos">Ver y editar todo esto</button>`;
  }

  /* ============================================================
     3. LO QUE YA PROMETÍ — la lista editable
     ============================================================ */

  function compromisos() {
    const fijos = Datos.compromisos().filter(c => c.tipo !== 'cuota');
    const compras = Datos.comprasEnCuotas();
    const estacionales = Datos.estacionales();
    const ingresos = Datos.ingresosPrevistos();

    return cabecera('Lo que ya prometí') + `
      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>💼 Lo que espero recibir</h3>
          <button class="boton fantasma chico" data-sueldo="form-ingreso">+ Agregar</button>
        </div>
        ${ingresos.length ? `<ul class="lista">${ingresos.map(i => `
          <li class="movimiento" data-ingreso="${i.id}">
            <span class="emoji">💼</span>
            <div class="info"><strong>${esc(i.nombre)}</strong>
              <span class="ayuda">Cada mes, el ${i.diaDelMes}${i.activo === false ? ' · pausado' : ''}</span></div>
            <div class="monto verde">${dinero(i.monto)}</div>
          </li>`).join('')}</ul>` : `
          <p class="ayuda">Sin esto no hay sueldo libre que calcular.</p>`}
      </div>

      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>🔁 Todos los meses</h3>
          <button class="boton fantasma chico" data-sueldo="form-fijo">+ Agregar</button>
        </div>
        ${fijos.length ? `<ul class="lista">${fijos.map(c => `
          <li class="movimiento" data-compromiso="${c.id}">
            <span class="emoji">${esc(Categorias.porId(c.categoria).emoji)}</span>
            <div class="info"><strong>${esc(c.nombre)}</strong>
              <span class="ayuda">
                ${c.frecuencia === 'anual' ? `Cada año en ${Fechas.NOMBRES_MES[c.mesDelAnio]}` : `Cada mes, el ${c.diaDelMes}`}
                ${c.hasta ? ` · hasta ${c.hasta}` : ''}
              </span></div>
            <div class="monto">${dinero(c.monto)}</div>
          </li>`).join('')}</ul>` : `
          <p class="ayuda">El dividendo o arriendo, la isapre, el internet, el CAE.</p>`}
      </div>

      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>💳 Compras en cuotas</h3>
          <button class="boton fantasma chico" data-sueldo="form-cuotas">+ Agregar</button>
        </div>
        ${compras.length ? `<ul class="lista">${compras.map(c => `
          <li class="movimiento" data-compra="${c.compraId}">
            <span class="emoji">💳</span>
            <div class="info"><strong>${esc(c.nombre)}</strong>
              <span class="ayuda">
                ${c.pagadas} de ${c.cuantas} pagadas · termina en ${MESES_CORTOS[Fechas.aFecha(c.ultima).getMonth()]} ${Fechas.aFecha(c.ultima).getFullYear()}
              </span>
              <div class="barra" style="margin-top:5px">
                <span style="width:${Math.round(c.pagadas / c.cuantas * 100)}%; background:var(--verde)"></span>
              </div>
            </div>
            <div class="monto">
              <strong>${dinero(c.falta)}</strong>
              <span class="ayuda">falta</span>
            </div>
          </li>`).join('')}</ul>` : `
          <p class="ayuda">
            Una compra en cuotas no es un gasto de hoy: es un gasto de hoy más
            ${''}N compromisos futuros. Anótala acá y aparece en tus próximos meses.
          </p>`}
      </div>

      <div class="tarjeta">
        <div class="tarjeta-titulo">
          <h3>📅 Los que vienen una vez al año</h3>
          <button class="boton fantasma chico" data-sueldo="form-estacional">+ Agregar</button>
        </div>
        ${estacionales.length ? `<ul class="lista">${estacionales.map(e => `
          <li class="movimiento" data-estacional="${e.id}">
            <span class="emoji">${esc(e.emoji || '📅')}</span>
            <div class="info"><strong>${esc(e.nombre)}</strong>
              <span class="ayuda">Cada ${Fechas.NOMBRES_MES[e.mes]}, el ${e.dia}</span></div>
            <div class="monto">${dinero(e.monto)}</div>
          </li>`).join('')}</ul>` : `
          <p class="ayuda">Marzo, el permiso de circulación, las contribuciones, el 18, diciembre.</p>`}
        <button class="boton secundario" data-sueldo="calendario-chileno" style="margin-top:10px">
          🇨🇱 Ver el calendario chileno
        </button>
      </div>`;
  }

  /* ============================================================
     4. LOS PRÓXIMOS 12 MESES
     ============================================================ */

  function proyeccion() {
    const { anio, mes } = window.App.mesEnPantalla();
    const meses = Datos.proyeccion(anio, mes, 12);
    const apretado = Datos.mesMasApretado(anio, mes, 12);
    const enRojo = meses.filter(m => m.libre < 0);

    return cabecera('Tus próximos 12 meses') + `
      <div class="tarjeta">
        <p class="ayuda">
          Esto no es una predicción: es lo que ya está comprometido, mes por mes.
          Cada barra es lo que te quedaría libre.
        </p>
        <div class="grafico" id="graficoProyeccion"></div>
      </div>

      ${enRojo.length ? `
        <div class="aviso-sueldo alto" style="margin-bottom:12px">
          <span>⚠️</span>
          <div>
            <strong>${enRojo.length} ${enRojo.length === 1 ? 'mes no cierra' : 'meses no cierran'}</strong>
            <span>${enRojo.map(m => Fechas.NOMBRES_MES[m.mes]).join(', ')}</span>
          </div>
        </div>` : `
        <div class="consejo" style="margin-bottom:12px">
          <strong>✅ Los doce meses cierran</strong>
          El más apretado es ${Fechas.nombreMes(apretado.anio, apretado.mes)}, con
          ${dinero(apretado.libre)} libres.
        </div>`}

      <ul class="lista">
        ${meses.map(m => `
          <li class="movimiento mes-proyectado ${m.libre < 0 ? 'en-rojo' : ''}"
              data-ver-mes="${m.anio}-${m.mes}">
            <span class="emoji">${m.libre < 0 ? '🔴' : (m.clave === apretado.clave ? '🟡' : '🟢')}</span>
            <div class="info">
              <strong>${esc(Fechas.nombreMes(m.anio, m.mes))}</strong>
              <span class="ayuda">
                ${dinero(m.ingreso)} − ${dinero(m.comprometido)} comprometidos
                ${m.estacionales ? ` · trae ${dinero(m.estacionales)} de gastos del mes` : ''}
              </span>
            </div>
            <div class="monto"><strong class="${m.libre < 0 ? 'rojo' : 'verde'}">${dinero(m.libre)}</strong></div>
          </li>`).join('')}
      </ul>`;
  }

  function dibujarGraficoProyeccion() {
    const caja = $$$('graficoProyeccion');
    if (!caja) return;
    const { anio, mes } = window.App.mesEnPantalla();
    const meses = Datos.proyeccion(anio, mes, 12);
    caja.innerHTML = barrasDeSueldoLibre(meses);
  }

  /**
   * Un gráfico propio y no Graficos.barras, porque acá hay algo que
   * ese no sabe dibujar: las barras pueden ser NEGATIVAS. Un mes que
   * no cierra tiene que verse cayendo bajo la línea, no como una
   * barra chiquitita, porque no es "poco": es que falta.
   */
  function barrasDeSueldoLibre(meses) {
    const A = 320, H = 180;
    const margen = { arriba: 12, abajo: 26 };
    const alto = H - margen.arriba - margen.abajo;

    const maximo = Math.max(1, ...meses.map(m => Math.abs(m.libre)));
    const hayNegativos = meses.some(m => m.libre < 0);
    // Si no hay meses en rojo, el cero va abajo y se usa todo el alto.
    const cero = hayNegativos ? margen.arriba + alto / 2 : margen.arriba + alto;
    const escala = hayNegativos ? (alto / 2) / maximo : alto / maximo;

    const ranura = A / meses.length;
    const ancho = Math.min(20, ranura * 0.56);

    const barras = meses.map((m, i) => {
      const centro = ranura * i + ranura / 2;
      const h = Math.max(2, Math.abs(m.libre) * escala);
      const y = m.libre >= 0 ? cero - h : cero;
      const color = m.libre < 0 ? 'var(--rojo)' : 'var(--verde)';
      return `
        <rect x="${centro - ancho / 2}" y="${y}" width="${ancho}" height="${h}"
              rx="4" style="fill:${color}"></rect>
        <text x="${centro}" y="${H - 8}" text-anchor="middle" font-size="9.5"
              style="fill:var(--texto-suave)">${MESES_CORTOS[m.mes]}</text>`;
    }).join('');

    return `
      <svg class="grafico" viewBox="0 0 ${A} ${H}" style="max-height:200px" role="img"
           aria-label="Sueldo libre de los próximos doce meses">
        <line x1="0" y1="${cero}" x2="${A}" y2="${cero}" stroke-width="1"
              style="stroke:var(--borde)"></line>
        ${barras}
      </svg>
      <div class="leyenda">
        <span class="item"><span class="punto" style="background:var(--verde)"></span>Te queda</span>
        ${hayNegativos ? '<span class="item"><span class="punto" style="background:var(--rojo)"></span>Te falta</span>' : ''}
      </div>`;
  }

  /* ============================================================
     5. ¿Y SI LO PAGO EN CUOTAS? — la función estrella
     ============================================================ */

  function simulador() {
    const s = vista.simulacion;
    return cabecera('¿Y si lo pago en cuotas?') + `
      <div class="tarjeta">
        <p class="ayuda">
          No te voy a decir que sí o que no. Te voy a dibujar tus próximos 12 meses
          con esa compra adentro, y tú decides.
        </p>

        <label for="simMonto">¿Cuánto cuesta?</label>
        <input type="number" id="simMonto" inputmode="numeric" min="0" step="1"
               value="${s.monto || ''}" placeholder="600000">

        <label for="simCuotas">¿En cuántas cuotas?</label>
        <div class="pastillas-cuotas">
          ${[3, 6, 10, 12, 18, 24].map(n =>
            `<button type="button" class="pastilla ${s.cuotas === n ? 'activa' : ''}"
                     data-cuotas="${n}">${n}</button>`).join('')}
        </div>

        <label for="simInteres">Interés total, si te lo dijeron (opcional)</label>
        <input type="number" id="simInteres" inputmode="numeric" min="0" step="1"
               value="${s.interesTotal || ''}" placeholder="0">
        <p class="ayuda">
          Si la tienda te dijo "12 cuotas de 55.000" para algo de 600.000, el interés
          son 60.000. Si no lo sabes, déjalo en cero.
        </p>

        <button class="boton" data-sueldo="simular" style="margin-top:14px">Ver qué pasa</button>
      </div>

      <div id="resultadoSimulacion"></div>`;
  }

  /**
   * Pasa al estado lo que haya escrito en los campos, si es que están
   * en pantalla. Los campos se van y vuelven cada vez que se redibuja
   * la hoja, así que el estado es el que manda.
   */
  function recogerLoEscrito() {
    const monto = $$$('simMonto');
    const interes = $$$('simInteres');
    if (monto && monto.value !== '') vista.simulacion.monto = Number(monto.value) || 0;
    if (interes) vista.simulacion.interesTotal = Number(interes.value) || 0;
  }

  function correrSimulacion() {
    recogerLoEscrito();
    const monto = vista.simulacion.monto;
    if (monto <= 0) return avisar('¿Cuánto cuesta lo que estás pensando comprar?');

    // Los campos se acaban de redibujar: hay que devolverles lo escrito.
    if ($$$('simMonto')) $$$('simMonto').value = monto;
    if ($$$('simInteres')) $$$('simInteres').value = vista.simulacion.interesTotal || '';

    const { anio, mes } = window.App.mesEnPantalla();
    const r = Datos.simularCuotas({
      monto,
      cuotas: vista.simulacion.cuotas,
      interesTotal: vista.simulacion.interesTotal,
      desde: Fechas.claveMes(anio, mes),
      diaDelMes: vista.simulacion.diaDelMes,
      anio, mes,
    });

    $$$('resultadoSimulacion').innerHTML = resultadoDeSimulacion(r);
    dibujarComparacion(r);
    guardarUltima(r);
  }

  let ultimaSimulacion = null;
  const guardarUltima = r => { ultimaSimulacion = r; };

  function resultadoDeSimulacion(r) {
    const s = vista.simulacion;
    const interes = r.totalAPagar - s.monto;

    return `
      <div class="tarjeta ${r.alcanza ? 'cabe' : 'no-cabe'}">
        <div class="veredicto">
          <span class="icono">${r.alcanza ? '✅' : (r.metesMesesEnRojo > 0 ? '🔴' : '🟡')}</span>
          <div>
            <strong>${veredicto(r)}</strong>
            <span class="ayuda">${explicacion(r)}</span>
          </div>
        </div>

        <div class="negocio-detalle">
          <div><span>Cada cuota</span><strong>${dinero(r.valorCuota)}</strong></div>
          <div><span>Vas a pagar</span><strong>${dinero(r.totalAPagar)}</strong></div>
          ${interes > 0 ? `<div><span>De eso, interés</span><strong class="rojo">${dinero(interes)}</strong></div>` : ''}
          <div><span>Última cuota</span><strong>${MESES_CORTOS[Fechas.aFecha(r.cuotas[r.cuotas.length - 1].fecha).getMonth()]} ${Fechas.aFecha(r.cuotas[r.cuotas.length - 1].fecha).getFullYear()}</strong></div>
        </div>
      </div>

      <div class="tarjeta">
        <h3>Tus 12 meses, antes y después</h3>
        <div class="grafico" id="graficoComparacion"></div>
        <ul class="lista">
          ${r.despues.map((m, i) => {
            const a = r.antes[i];
            const cambio = a.libre - m.libre;
            if (cambio === 0 && m.libre >= 0) return '';
            return `
              <li class="movimiento ${m.libre < 0 ? 'en-rojo' : ''}">
                <span class="emoji">${m.libre < 0 ? '🔴' : '·'}</span>
                <div class="info">
                  <strong>${esc(Fechas.nombreMes(m.anio, m.mes))}</strong>
                  <span class="ayuda">${cambio > 0 ? `Te quedaban ${dinero(a.libre)}` : 'Sin cambios'}</span>
                </div>
                <div class="monto"><strong class="${m.libre < 0 ? 'rojo' : ''}">${dinero(m.libre)}</strong></div>
              </li>`;
          }).join('')}
        </ul>
      </div>

      ${r.alternativas.length ? `
        <div class="tarjeta">
          <h3>Qué más podrías hacer</h3>
          <p class="ayuda">
            Estas no son frases hechas: cada una está calculada con tus números y
            solo aparece si de verdad mejora tu mes más apretado.
          </p>
          ${r.alternativas.map(a => `
            <div class="alternativa">
              <strong>${esc(a.titulo)}</strong>
              <span class="ayuda">${esc(a.detalle)}</span>
              <span class="mejora">Tu peor mes mejora en ${dinero(a.mejora)}</span>
            </div>`).join('')}
        </div>` : ''}

      <button class="boton" data-sueldo="anotar-compra" style="margin-top:6px">
        Ya la compré: anotar las ${vista.simulacion.cuotas} cuotas
      </button>
      <p class="ayuda" style="text-align:center; margin-top:8px">
        Solo si de verdad la compraste. Anotarla la mete en tus próximos meses.
      </p>`;
  }

  function veredicto(r) {
    if (r.alcanza) return 'Te cabe en el presupuesto';
    if (r.metesMesesEnRojo > 0) {
      return `Esta compra te deja ${r.metesMesesEnRojo} ${r.metesMesesEnRojo === 1 ? 'mes' : 'meses'} sin cerrar`;
    }
    return 'Cabe, pero en un año que ya venía apretado';
  }

  function explicacion(r) {
    if (r.alcanza) {
      return `Tu mes más apretado quedaría con ${dinero(r.apretadoDespues.libre)} libres, `
           + `en ${Fechas.nombreMes(r.apretadoDespues.anio, r.apretadoDespues.mes)}.`;
    }
    if (r.yaEstabasEnRojo && r.metesMesesEnRojo === 0) {
      return `${Fechas.nombreMes(r.apretadoDespues.anio, r.apretadoDespues.mes)} ya no te cerraba `
           + 'antes de esta compra. Esta no lo empeora, pero tampoco lo arregla.';
    }
    return `En ${Fechas.nombreMes(r.apretadoDespues.anio, r.apretadoDespues.mes)} te faltarían `
         + `${dinero(Math.abs(r.apretadoDespues.libre))}.`;
  }

  function dibujarComparacion(r) {
    const datos = r || ultimaSimulacion;
    const caja = $$$('graficoComparacion');
    if (!caja || !datos) return;
    caja.innerHTML = barrasDeSueldoLibre(datos.despues);
  }

  /* ============================================================
     6. MODO MARZO
     ============================================================ */

  function marzo() {
    const { anio, mes } = window.App.mesEnPantalla();
    const avisos = Datos.mesesApretados(anio, mes, 12);

    return cabecera('Lo que viene') + `
      <div class="consejo" style="margin-bottom:14px">
        <strong>🇨🇱 Por qué existe esta pantalla</strong>
        En Chile marzo no es una sorpresa: llega todos los años con la matrícula, los
        útiles y el permiso de circulación. Lo que sí sorprende es llegar sin plata.
        Acá te aviso con meses de anticipación y con un número concreto.
      </div>

      ${avisos.length ? avisos.map(m => `
        <div class="tarjeta">
          <div class="aviso-cabecera">
            <span class="icono">${m.libre < 0 ? '🔴' : '🟡'}</span>
            <div>
              <strong>${esc(Fechas.nombreMes(m.anio, m.mes))}</strong>
              <span class="ayuda">
                Faltan ${m.mesesDeAviso} ${m.mesesDeAviso === 1 ? 'mes' : 'meses'} ·
                ${m.libre < 0 ? `te faltarían ${dinero(Math.abs(m.libre))}` : `quedarían ${dinero(m.libre)}`}
              </span>
            </div>
          </div>
          ${Datos.porQueApretaElMes(m.mes) ? `<p class="ayuda">${esc(Datos.porQueApretaElMes(m.mes))}</p>` : ''}
          ${m.detalle.estacionales.length ? `
            <ul class="lista">
              ${m.detalle.estacionales.map(e => `
                <li class="movimiento">
                  <span class="emoji">${esc(e.emoji || '📅')}</span>
                  <div class="info"><strong>${esc(e.nombre)}</strong></div>
                  <div class="monto">${dinero(e.montoDelMes)}</div>
                </li>`).join('')}
            </ul>` : ''}
          ${m.guardarPorMes > 0 ? `
            <div class="consejo">
              <strong>💡 Desde hoy</strong>
              Guarda <strong>${dinero(m.guardarPorMes)} cada mes</strong> durante estos
              ${m.mesesDeAviso} ${m.mesesDeAviso === 1 ? 'mes' : 'meses'} y llegas cubierto.
              <button class="boton fantasma chico" data-sueldo="meta-para-mes"
                      data-monto="${m.guardarPorMes}" data-nombre="${esc(Fechas.nombreMes(m.anio, m.mes))}">
                Crear una meta con ese monto
              </button>
            </div>` : ''}
        </div>`).join('') : `
        <div class="vacio">
          <div style="font-size:38px">🟢</div>
          <strong>No veo meses complicados por delante</strong>
          <p>Con lo que tienes anotado, los próximos doce meses cierran parejo.</p>
        </div>`}`;
  }

  /* ============================================================
     7. FECHA DE LIBERACIÓN
     ============================================================ */

  function liberacion() {
    const l = Datos.fechaLiberacion();
    if (!l) {
      return cabecera('Fecha de liberación') + `
        <div class="vacio">
          <div style="font-size:38px">🔓</div>
          <strong>No debes nada en cuotas</strong>
          <p>Cuando tengas una compra en cuotas anotada, acá vas a ver el día exacto
             en que terminas de pagarla.</p>
        </div>`;
    }

    const compras = Datos.comprasEnCuotas().filter(c => c.falta > 0);

    return cabecera('Fecha de liberación') + `
      <div class="tarjeta hero-sueldo">
        <div class="hero-rotulo">Terminas de deber el</div>
        <div class="hero-cifra chica">${fechaLarga(l.fecha)}</div>
        <p class="hero-frase">
          Faltan <strong>${l.mesesQueFaltan} ${l.mesesQueFaltan === 1 ? 'mes' : 'meses'}</strong>
          y <strong>${dinero(l.totalQueFalta)}</strong>, repartidos en
          ${l.cuantasCuotas} ${l.cuantasCuotas === 1 ? 'cuota' : 'cuotas'} de
          ${l.compras} ${l.compras === 1 ? 'compra' : 'compras'}.
        </p>
        <p class="ayuda">
          Esta fecha cuenta solo tus cuotas. El dividendo y la isapre no se
          "terminan de pagar": son gastos de vivir, y meterlos correría la fecha
          al infinito.
        </p>
      </div>

      ${compras.map(c => `
        <div class="tarjeta" data-compra="${c.compraId}">
          <div class="tarjeta-titulo">
            <h3>${esc(c.nombre)}</h3>
            <strong>${dinero(c.falta)}</strong>
          </div>
          <div class="barra">
            <span style="width:${Math.round(c.pagadas / c.cuantas * 100)}%; background:var(--verde)"></span>
          </div>
          <p class="ayuda" style="margin-top:8px">
            ${c.pagadas} de ${c.cuantas} pagadas · última el ${fechaLarga(c.ultima)}
          </p>
          ${c.siguiente ? `
            <button class="boton secundario" data-pagar-cuota="${c.siguiente.id}">
              Pagué la cuota ${c.siguiente.numero} (${dinero(c.siguiente.monto)})
            </button>` : ''}
        </div>`).join('')}`;
  }

  /* ============================================================
     8. LOS FORMULARIOS
     ============================================================ */

  function abrirFormulario(tipo, extra) {
    const caja = $$$('sueldoForm');
    if (!caja) return;
    const pintores = {
      ingreso: formIngreso, fijo: formFijo, cuotas: formCuotas,
      estacional: formEstacional, calendario: formCalendario,
    };
    const pintar = pintores[tipo];
    if (!pintar) return;
    caja.dataset.tipo = tipo;
    caja.dataset.extra = JSON.stringify(extra || {});
    caja.innerHTML = pintar(extra || {});
    window.App.abrirHoja('telonSueldoForm');
  }

  const tituloForm = titulo => `
    <div class="tarjeta-titulo">
      <h2>${esc(titulo)}</h2>
      <button class="boton fantasma chico" data-cerrar-sueldo="telonSueldoForm">Cerrar</button>
    </div>`;

  const opcionesDeCuenta = () => Datos.cuentasActivas()
    .map(c => `<option value="${c.id}">${c.icono} ${esc(c.nombre)}</option>`).join('');

  const opcionesDeCategoria = seleccionada => Datos.CATEGORIAS_GASTO
    .map(c => `<option value="${c.id}" ${c.id === seleccionada ? 'selected' : ''}>${c.emoji} ${esc(c.nombre)}</option>`).join('');

  function formIngreso({ id }) {
    const i = id ? Datos.ingresosPrevistos().find(x => x.id === id) : null;
    return tituloForm(i ? 'Editar ingreso' : '¿Cuánto recibes al mes?') + `
      <form id="formSueldo" data-guardar="ingreso" data-id="${i ? i.id : ''}">
        <p class="ayuda">
          Lo que <em>esperas</em> que entre, no lo que ya entró. Con esto la app puede
          calcular tu sueldo libre de los meses que todavía no llegan.
        </p>
        <label for="ipNombre">¿Qué es?</label>
        <input type="text" id="ipNombre" value="${esc(i ? i.nombre : 'Sueldo')}" required autocomplete="off">

        <label for="ipMonto">¿Cuánto?</label>
        <input type="number" id="ipMonto" inputmode="numeric" min="0" step="1" required
               value="${i ? i.monto : ''}" placeholder="750000">

        <label for="ipDia">¿Qué día del mes te llega?</label>
        <input type="number" id="ipDia" inputmode="numeric" min="1" max="31"
               value="${i ? i.diaDelMes : 30}">

        <div class="fila-botones" style="margin-top:18px">
          ${i ? `<button type="button" class="boton peligro" data-borrar-ingreso="${i.id}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
      </form>`;
  }

  function formFijo({ id }) {
    const c = id ? Datos.compromisoPorId(id) : null;
    return tituloForm(c ? 'Editar compromiso' : 'Algo que pagas todos los meses') + `
      <form id="formSueldo" data-guardar="fijo" data-id="${c ? c.id : ''}">
        <p class="ayuda">
          El dividendo o el arriendo, la isapre, el internet, el plan del celular,
          el CAE, el seguro. Lo que sale sí o sí.
        </p>
        <label for="cfNombre">¿Qué pagas?</label>
        <input type="text" id="cfNombre" value="${esc(c ? c.nombre : '')}" required
               placeholder="Dividendo" autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="cfMonto">Cuánto</label>
            <input type="number" id="cfMonto" inputmode="numeric" min="0" step="1" required
                   value="${c ? c.monto : ''}" placeholder="320000">
          </div>
          <div>
            <label for="cfDia">Qué día</label>
            <input type="number" id="cfDia" inputmode="numeric" min="1" max="31"
                   value="${c ? c.diaDelMes : 5}">
          </div>
        </div>

        <label for="cfCategoria">¿De qué es?</label>
        <select id="cfCategoria">${opcionesDeCategoria(c ? c.categoria : 'vivienda')}</select>

        <label for="cfHasta">¿Hasta cuándo? (opcional)</label>
        <input type="month" id="cfHasta" value="${c ? c.hasta : ''}">
        <p class="ayuda">
          Déjalo vacío si no se termina. Si es el CAE o un crédito, poner el mes final
          hace que la app sepa que después de esa fecha te va a sobrar esa plata.
        </p>

        <div class="fila-botones" style="margin-top:18px">
          ${c ? `<button type="button" class="boton peligro" data-borrar-compromiso="${c.id}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
      </form>`;
  }

  function formCuotas() {
    return tituloForm('Una compra en cuotas') + `
      <form id="formSueldo" data-guardar="cuotas">
        <p class="ayuda">
          Una compra en cuotas <strong>no es un gasto de hoy</strong>: es un gasto de hoy
          más N compromisos futuros. La app va a crear cada cuota con su fecha.
        </p>
        <label for="ccNombre">¿Qué compraste?</label>
        <input type="text" id="ccNombre" required placeholder="Refrigerador" autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="ccMonto">Precio total</label>
            <input type="number" id="ccMonto" inputmode="numeric" min="0" step="1" required
                   placeholder="479880">
          </div>
          <div>
            <label for="ccCuotas">Cuotas</label>
            <input type="number" id="ccCuotas" inputmode="numeric" min="1" max="60" value="12">
          </div>
        </div>

        <label for="ccInteres">Interés total (opcional)</label>
        <input type="number" id="ccInteres" inputmode="numeric" min="0" step="1" placeholder="0">

        <div class="fila-dos">
          <div>
            <label for="ccPrimera">Primera cuota</label>
            <input type="date" id="ccPrimera" value="${Fechas.hoyISO()}">
          </div>
          <div>
            <label for="ccCategoria">¿De qué es?</label>
            <select id="ccCategoria">${opcionesDeCategoria('deuda')}</select>
          </div>
        </div>

        <label for="ccCuenta">¿Con qué la pagas?</label>
        <select id="ccCuenta">${opcionesDeCuenta()}</select>

        <label class="interruptor">
          <input type="checkbox" id="ccAnotarGasto">
          <span>Anotar también el gasto de hoy</span>
        </label>
        <p class="ayuda">
          Enciéndelo solo si <strong>todavía no</strong> anotaste esta compra en tus
          movimientos. Si ya está anotada, dejarlo encendido contaría el mismo peso
          dos veces.
        </p>

        <button type="submit" class="boton" style="margin-top:18px">Crear las cuotas</button>
      </form>`;
  }

  function formEstacional({ id }) {
    const e = id ? Datos.estacionales().find(x => x.id === id) : null;
    return tituloForm(e ? 'Editar gasto del año' : 'Un gasto que viene una vez al año') + `
      <form id="formSueldo" data-guardar="estacional" data-id="${e ? e.id : ''}">
        <label for="esNombre">¿Qué es?</label>
        <input type="text" id="esNombre" value="${esc(e ? e.nombre : '')}" required
               placeholder="Matrícula del colegio" autocomplete="off">

        <div class="fila-dos">
          <div>
            <label for="esMonto">Cuánto</label>
            <input type="number" id="esMonto" inputmode="numeric" min="0" step="1" required
                   value="${e ? e.monto : ''}" placeholder="380000">
          </div>
          <div>
            <label for="esDia">Qué día</label>
            <input type="number" id="esDia" inputmode="numeric" min="1" max="31"
                   value="${e ? e.dia : 1}">
          </div>
        </div>

        <label for="esMes">¿En qué mes?</label>
        <select id="esMes">
          ${Fechas.NOMBRES_MES.map((n, i) =>
            `<option value="${i}" ${e && e.mes === i ? 'selected' : ''}>${n}</option>`).join('')}
        </select>

        <label for="esCategoria">¿De qué es?</label>
        <select id="esCategoria">${opcionesDeCategoria(e ? e.categoria : 'otro')}</select>

        <div class="fila-botones" style="margin-top:18px">
          ${e ? `<button type="button" class="boton peligro" data-borrar-estacional="${e.id}">Borrar</button>` : ''}
          <button type="submit" class="boton">Guardar</button>
        </div>
      </form>`;
  }

  /**
   * El calendario chileno: en vez de que la persona se acuerde sola de
   * que en marzo existe la matrícula, se la ofrecemos con un monto de
   * partida que puede cambiar. Los montos son sugerencias y la
   * pantalla lo dice: poner una cifra ajena como si fuera la tuya es
   * la forma más rápida de que deje de creerle a la app.
   */
  function formCalendario() {
    const yaTiene = new Set(Datos.estacionales().map(e => e.nombre));
    return tituloForm('El calendario chileno') + `
      <p class="ayuda">
        Lo que aprieta en Chile, mes por mes. Toca los que te tocan a ti y ajusta el
        monto: <strong>estas cifras son solo un punto de partida</strong>, dependen de
        tu colegio, tu auto y tu comuna.
      </p>
      ${Datos.PLANTILLAS_ESTACIONALES.map(p => `
        <div class="plantilla-estacional ${yaTiene.has(p.nombre) ? 'puesta' : ''}">
          <span class="emoji">${p.emoji}</span>
          <div class="info">
            <strong>${esc(p.nombre)}</strong>
            <span class="ayuda">${Fechas.NOMBRES_MES[p.mes]} · ${esc(p.pista)}</span>
          </div>
          ${yaTiene.has(p.nombre)
            ? '<span class="pastilla-puesta">Ya está</span>'
            : `<div class="agregar-plantilla">
                 <input type="number" id="pl-${p.id}" value="${p.monto}" inputmode="numeric" step="1000">
                 <button class="boton chico" data-plantilla="${p.id}">Agregar</button>
               </div>`}
        </div>`).join('')}`;
  }

  /* ============================================================
     9. EVENTOS
     ============================================================ */

  const ATRIBUTOS = ['sueldo', 'cerrarSueldo', 'cuotas', 'ingreso', 'compromiso',
                     'estacional', 'compra', 'verMes', 'pagarCuota', 'plantilla',
                     'borrarIngreso', 'borrarCompromiso', 'borrarEstacional', 'monto'];

  function objetivo(desde) {
    for (let el = desde; el && el !== document; el = el.parentElement) {
      if (el.dataset && ATRIBUTOS.some(a => el.dataset[a] !== undefined)) return el;
    }
    return null;
  }

  function conectar() {
    document.addEventListener('click', alTocar);
    document.addEventListener('submit', alEnviar);
  }

  async function alTocar(e) {
    const t = objetivo(e.target);
    if (!t) return;
    const d = t.dataset;

    if (d.cerrarSueldo)  return window.App.cerrarHoja(d.cerrarSueldo);

    if (d.sueldo) {
      if (d.sueldo.startsWith('form-')) return abrirFormulario(d.sueldo.slice(5));
      if (d.sueldo === 'calendario-chileno') return abrirFormulario('calendario');
      if (d.sueldo === 'simular')        return correrSimulacion();
      if (d.sueldo === 'anotar-compra')  return anotarLaCompra();
      if (d.sueldo === 'meta-para-mes')  return crearMetaParaElMes(d.monto, d.nombre);
      return abrirSeccion(d.sueldo);
    }

    if (d.cuotas !== undefined) {
      // Antes de redibujar hay que guardarse lo que la persona ya
      // escribió. Sin esto, elegir el número de cuotas le borraba el
      // monto recién tipeado, y ese es justo el orden natural: primero
      // cuánto cuesta, después en cuántas cuotas.
      recogerLoEscrito();
      vista.simulacion.cuotas = Number(d.cuotas);
      pintarSeccion();
      // Y si ya había un monto, recalculamos al tiro: cambiar las cuotas
      // y no ver el resultado moverse es lo más frustrante que puede
      // hacer una pantalla como esta.
      if (vista.simulacion.monto > 0) correrSimulacion();
      return;
    }

    if (d.ingreso)     return abrirFormulario('ingreso', { id: d.ingreso });
    if (d.compromiso)  return abrirFormulario('fijo', { id: d.compromiso });
    if (d.estacional)  return abrirFormulario('estacional', { id: d.estacional });
    if (d.compra)      return abrirCompra(d.compra);
    if (d.pagarCuota)  return pagarCuota(d.pagarCuota);
    if (d.plantilla)   return agregarDePlantilla(d.plantilla);

    if (d.verMes) {
      const [anio, mes] = d.verMes.split('-').map(Number);
      window.App.verMes(anio, mes);
      vista.seccion = 'desglose';
      pintarSeccion();
      return;
    }

    if (d.borrarIngreso)    return borrar('ingreso', d.borrarIngreso);
    if (d.borrarCompromiso) return borrar('compromiso', d.borrarCompromiso);
    if (d.borrarEstacional) return borrar('estacional', d.borrarEstacional);
  }

  /* ---------------- Guardar ---------------- */

  const num = id => { const c = $$$(id); return c && c.value !== '' ? Number(c.value) : undefined; };
  const txt = id => { const c = $$$(id); return c ? c.value : ''; };
  const marcado = id => { const c = $$$(id); return c ? c.checked : false; };

  async function alEnviar(e) {
    if (e.target.id !== 'formSueldo') return;
    e.preventDefault();
    const d = e.target.dataset;
    try {
      const guardadores = {
        ingreso: guardarIngreso, fijo: guardarFijo,
        cuotas: guardarCuotas, estacional: guardarEstacional,
      };
      await guardadores[d.guardar](d);
      window.App.cerrarHoja('telonSueldoForm');
      refrescar();
    } catch (error) {
      avisar(error.message);
    }
  }

  function guardarIngreso(d) {
    const datos = { nombre: txt('ipNombre'), monto: num('ipMonto'), diaDelMes: num('ipDia') };
    if (d.id) Datos.editarIngresoPrevisto(d.id, datos);
    else Datos.agregarIngresoPrevisto(datos);
    avisar('Guardado. Tu sueldo libre ya está calculado.');
  }

  function guardarFijo(d) {
    const datos = {
      nombre: txt('cfNombre'), monto: num('cfMonto'), diaDelMes: num('cfDia'),
      categoria: txt('cfCategoria'), hasta: txt('cfHasta'),
    };
    if (d.id) Datos.editarCompromiso(d.id, datos);
    else Datos.agregarCompromisoFijo(datos);
    avisar('Guardado.');
  }

  function guardarCuotas() {
    const r = Datos.comprarEnCuotas({
      nombre: txt('ccNombre'),
      monto: num('ccMonto'),
      cuotas: num('ccCuotas'),
      interesTotal: num('ccInteres') || 0,
      primeraFecha: txt('ccPrimera'),
      categoria: txt('ccCategoria'),
      cuenta: txt('ccCuenta'),
      anotarElGasto: marcado('ccAnotarGasto'),
    });
    avisar(`Listo: ${r.cuotas.length} cuotas anotadas hasta ${r.cuotas[r.cuotas.length - 1].fecha.slice(0, 7)}.`);
  }

  function guardarEstacional(d) {
    const datos = {
      nombre: txt('esNombre'), monto: num('esMonto'), dia: num('esDia'),
      mes: num('esMes'), categoria: txt('esCategoria'),
    };
    if (d.id) Datos.editarEstacional(d.id, datos);
    else Datos.agregarEstacional(datos);
    avisar('Guardado.');
  }

  function agregarDePlantilla(plantillaId) {
    try {
      const monto = num('pl-' + plantillaId);
      Datos.agregarEstacionalDePlantilla(plantillaId, monto);
      abrirFormulario('calendario');
      refrescar();
      avisar('Agregado.');
    } catch (e) {
      avisar(e.message);
    }
  }

  /* ---------------- Acciones ---------------- */

  async function anotarLaCompra() {
    const s = vista.simulacion;
    const nombre = await pedirTexto();
    if (nombre === null) return;
    const { anio, mes } = window.App.mesEnPantalla();
    try {
      const r = Datos.comprarEnCuotas({
        nombre: nombre || 'Compra en cuotas',
        monto: s.monto, cuotas: s.cuotas, interesTotal: s.interesTotal,
        primeraFecha: Fechas.aISO(anio, mes, s.diaDelMes),
        categoria: 'deuda',
      });
      window.App.cerrarHoja('telonSueldo');
      refrescar();
      avisar(`${r.cuotas.length} cuotas anotadas.`);
    } catch (e) {
      avisar(e.message);
    }
  }

  /** Un nombre para la compra. Sin prompt(): regla 10. */
  function pedirTexto() {
    return new Promise(resolver => {
      Dialogos.confirmar({
        titulo: '¿Qué compraste?',
        texto: 'Le voy a poner ese nombre a las cuotas para que después sepas cuál es cuál.',
        aceptar: 'Anotarla', cancelar: 'Mejor no',
      }).then(si => resolver(si ? (vista.simulacion.nombre || 'Compra en cuotas') : null));
    });
  }

  async function abrirCompra(compraId) {
    const compras = Datos.comprasEnCuotas();
    const c = compras.find(x => x.compraId === compraId);
    if (!c) return;
    const seguir = await Dialogos.confirmar({
      titulo: c.nombre,
      texto: `${c.pagadas} de ${c.cuantas} cuotas pagadas.\n`
           + `Falta ${dinero(c.falta)} y la última es el ${fechaLarga(c.ultima)}.`,
      aceptar: 'Cerrar', cancelar: 'Borrar la compra',
    });
    if (seguir) return;
    const seguro = await Dialogos.confirmar({
      titulo: '¿Borrar esta compra?',
      texto: `Se van las ${c.cuantas} cuotas. Media compra en cuotas no significa `
           + 'nada y dejaría tu fecha de liberación mintiendo.',
      aceptar: 'Borrar', peligro: true,
    });
    if (!seguro) return;
    Datos.borrarCompromiso(c.cuotas[0].id);
    refrescar();
    avisar('Borrada.');
  }

  async function pagarCuota(id) {
    const c = Datos.compromisoPorId(id);
    if (!c) return;
    const cuentas = Datos.cuentasActivas();
    const seguro = await Dialogos.confirmar({
      titulo: `¿Pagaste ${dinero(c.monto)}?`,
      texto: `${c.nombre}\n\nLa voy a marcar como pagada. Si la pagaste desde una `
           + 'cuenta, también anoto el movimiento.',
      aceptar: 'Sí, la pagué',
    });
    if (!seguro) return;
    Datos.pagarCompromiso(id, {
      cuentaOrigen: cuentas.length ? cuentas[0].id : null,
      comoTransferencia: false,
    });
    refrescar();
    avisar('Marcada como pagada.');
  }

  async function crearMetaParaElMes(monto, nombreMes) {
    try {
      const m = Datos.agregarMeta({
        nombre: `Para ${nombreMes}`,
        montoObjetivo: Math.round(Number(monto) || 0) * 6,
        emoji: '🛟',
      });
      avisar(`Meta creada. Ponle el aporte mensual de ${dinero(monto)} en Metas.`);
      refrescar();
    } catch (e) {
      avisar(e.message);
    }
  }

  async function borrar(que, id) {
    const seguro = await Dialogos.confirmar({
      titulo: '¿Borrarlo?',
      texto: 'Tu sueldo libre se va a recalcular sin esto.',
      aceptar: 'Borrar', peligro: true,
    });
    if (!seguro) return;
    if (que === 'ingreso')    Datos.borrarIngresoPrevisto(id);
    if (que === 'compromiso') Datos.borrarCompromiso(id);
    if (que === 'estacional') Datos.borrarEstacional(id);
    window.App.cerrarHoja('telonSueldoForm');
    refrescar();
    avisar('Borrado.');
  }

  function refrescar() {
    dibujarEnInicio();
    if (vista.seccion) pintarSeccion();
    window.App.redibujar();
  }

  return {
    dibujarEnInicio, conectar, abrirSeccion, abrirFormulario, refrescar,
    barrasDeSueldoLibre,
  };
})();
