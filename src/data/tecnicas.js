/* ============================================================
   src/data/tecnicas.js
   El contenido educativo: metodos de ahorro explicados en simple
   y las pildoras cortas del pie de pantalla.
   Es TEXTO, no logica. Quien decide cuando mostrarlo es
   /src/core/sugerencias.js.
   ============================================================ */

const Tecnicas = (() => {

  /* ------------------------------------------------------------
     TECNICAS DE AHORRO
     nivel: facil / medio / avanzado
     ------------------------------------------------------------ */
  const TECNICAS = [
    {
      emoji: '⚖️',
      titulo: 'La regla 50 / 30 / 20',
      nivel: 'facil',
      resumen: 'Reparte tu sueldo en tres bolsillos y deja de improvisar.',
      cuerpo: `
        <p>De cada 100 pesos que entran:</p>
        <ul>
          <li><strong>50 van a necesidades</strong>: arriendo, comida, transporte, cuentas, salud. Lo que no puedes dejar de pagar.</li>
          <li><strong>30 van a gustos</strong>: salidas, ropa, delivery, streaming. Vivir tambien cuenta.</li>
          <li><strong>20 van a ti</strong>: ahorro, fondo de emergencia o pagar deudas mas rapido.</li>
        </ul>
        <p><strong>Por que funciona:</strong> no te obliga a llevar cuentas de cada peso, solo a mirar tres numeros. Y te avisa temprano si tus gastos fijos se comieron el sueldo.</p>
        <p><strong>Como partir hoy:</strong> mira la barra "Tu reparto del mes" en Inicio. Si necesidades pasa el 50%, el problema no es el cafe: es un gasto fijo grande.</p>`,
    },
    {
      emoji: '🐷',
      titulo: 'Paguese a usted primero',
      nivel: 'facil',
      resumen: 'Ahorra apenas te pagan, no con lo que sobra a fin de mes.',
      cuerpo: `
        <p>La mayoria ahorra lo que sobra. El problema: casi nunca sobra.</p>
        <p>Da vuelta el orden. El mismo dia que te pagan, aparta primero tu ahorro (aunque sea el 5%) y recien despues vive con el resto.</p>
        <ul>
          <li>Empieza con una cifra que <em>no duela</em>: si el 20% te asusta, parte con 5%.</li>
          <li>Programa una transferencia automatica el dia del pago. Lo automatico gana a la fuerza de voluntad.</li>
          <li>Guardalo en una cuenta distinta a la de tus gastos diarios.</li>
        </ul>
        <p><strong>En la app:</strong> anota ese traspaso como gasto en la categoria 🐷 Ahorro. Asi lo ves reflejado en tu reparto del mes.</p>`,
    },
    {
      emoji: '🛟',
      titulo: 'Fondo de emergencia',
      nivel: 'facil',
      resumen: 'Tu colchon para que un imprevisto no se convierta en deuda.',
      cuerpo: `
        <p>Es plata guardada con un solo trabajo: cubrir lo inesperado. Se te echo a perder el refrigerador, te quedaste sin pega, una urgencia medica.</p>
        <ul>
          <li><strong>Meta inicial:</strong> un mes de tus gastos basicos.</li>
          <li><strong>Meta ideal:</strong> de 3 a 6 meses.</li>
          <li>Debe estar disponible (no en algo que tarde dias en rescatarse) pero no <em>demasiado</em> a mano.</li>
        </ul>
        <p><strong>Por que primero esto y no invertir:</strong> sin colchon, cualquier imprevisto te empuja a la tarjeta de credito, y ahi pagas intereses altisimos. Evitar un interes es tan valioso como ganarlo.</p>`,
    },
    {
      emoji: '✉️',
      titulo: 'Metodo de los sobres',
      nivel: 'facil',
      resumen: 'Un tope por categoria. Cuando se acaba, se acabo.',
      cuerpo: `
        <p>Antiguamente se repartia el sueldo en sobres de papel: uno para la feria, otro para bencina, otro para salidas. Cuando el sobre quedaba vacio, esa categoria se cerraba hasta el proximo mes.</p>
        <p>Hoy no necesitas papel: le pones un tope a cada categoria y lo respetas.</p>
        <ul>
          <li>Funciona muy bien para gastos que se descontrolan: delivery, salidas, compras online.</li>
          <li>Si un sobre se acaba antes de tiempo, puedes sacar de otro, pero <em>a conciencia</em>, no sin darte cuenta.</li>
        </ul>
        <p><strong>En la app:</strong> anda a Ajustes → Topes por categoria. Vas a ver una barra que se llena y se pone roja al pasarte.</p>`,
    },
    {
      emoji: '🐜',
      titulo: 'Cazar gastos hormiga',
      nivel: 'facil',
      resumen: 'Compras chicas que no duelen una por una, pero suman una fortuna.',
      cuerpo: `
        <p>El cafe de $2.500, el delivery de $7.000, la app de $4.990. Cada uno parece nada. Doce veces al mes, ya no.</p>
        <p><strong>Ejercicio de una semana:</strong> anota <em>todo</em>, hasta la moneda mas chica. Al septimo dia mira el total. Casi siempre sorprende.</p>
        <ul>
          <li>No se trata de eliminarlos: se trata de <strong>elegir cual vale la pena</strong>.</li>
          <li>Revisa tus suscripciones una vez al ano. Es el gasto hormiga mas silencioso.</li>
        </ul>
        <p><strong>En la app:</strong> Inicio te avisa cuando detecta muchos gastos chicos en el mes.</p>`,
    },
    {
      emoji: '⏳',
      titulo: 'La regla de las 24 horas (y los 30 dias)',
      nivel: 'facil',
      resumen: 'Poner tiempo entre las ganas y la compra.',
      cuerpo: `
        <p>Antes de una compra por impulso, espera:</p>
        <ul>
          <li><strong>24 horas</strong> si es un monto chico.</li>
          <li><strong>30 dias</strong> si es un monto grande.</li>
        </ul>
        <p>Anotalo en una lista de "lo quiero". Cuando pase el plazo, vuelve a mirar. Buena parte de las veces las ganas ya se fueron, y esa plata se quedo contigo.</p>
        <p><strong>Por que funciona:</strong> la compra impulsiva es emocional. El tiempo le devuelve el turno a la parte de tu cabeza que hace cuentas.</p>`,
    },
    {
      emoji: '📅',
      titulo: 'El reto de las 52 semanas',
      nivel: 'medio',
      resumen: 'Ahorrar de a poquito y terminar el ano con una cifra seria.',
      cuerpo: `
        <p>Semana 1 guardas 1.000. Semana 2, 2.000. Semana 3, 3.000... hasta la semana 52.</p>
        <p>Al final del ano juntaste <strong>1.378.000</strong> sin haber sentido un golpe fuerte en ningun mes.</p>
        <ul>
          <li>Si diciembre te queda apretado, dalo vuelta: parte por la semana 52 y termina con la 1.</li>
          <li>Version mas suave: monto fijo semanal. Menos epico, igual de efectivo.</li>
        </ul>
        <p><strong>En la app:</strong> crealo como Meta con objetivo 1.378.000 y anota tu abono cada semana. Ver la barra avanzar es la mitad del truco.</p>`,
    },
    {
      emoji: '📓',
      titulo: 'Kakebo (el metodo japones)',
      nivel: 'medio',
      resumen: 'Antes de gastar, preguntate cuatro cosas.',
      cuerpo: `
        <p>Kakebo significa "libro de cuentas del hogar". Su idea central no son las matematicas, es la <strong>conciencia</strong>.</p>
        <p>Al empezar el mes te preguntas:</p>
        <ul>
          <li>Cuanta plata tengo disponible?</li>
          <li>Cuanto quiero ahorrar?</li>
          <li>Cuanto voy a gastar realmente?</li>
          <li>Como puedo mejorar el proximo mes?</li>
        </ul>
        <p>Y ordenas cada gasto en cuatro grupos: <em>supervivencia</em> (comida, techo), <em>opcional</em> (salidas), <em>cultura</em> (libros, cursos) y <em>extras</em> (regalos, imprevistos).</p>
        <p><strong>La cuarta pregunta es la importante.</strong> Revisar el mes que paso, sin culpa, es lo que hace que el siguiente sea mejor.</p>`,
    },
    {
      emoji: '❄️',
      titulo: 'Bola de nieve vs. avalancha (deudas)',
      nivel: 'medio',
      resumen: 'Dos formas de salir de deudas: una motiva, la otra ahorra mas.',
      cuerpo: `
        <p>Si tienes varias deudas, paga el minimo en todas y mete todo lo extra en <strong>una sola</strong>. Cual eliges cambia la estrategia:</p>
        <ul>
          <li><strong>Bola de nieve:</strong> ataca primero la deuda <em>mas chica</em>. La liquidas rapido, sientes el avance y esa energia te mantiene. Cuando la cierras, ese pago completo pasa a la siguiente.</li>
          <li><strong>Avalancha:</strong> ataca primero la de <em>interes mas alto</em>. Matematicamente pagas menos intereses en total.</li>
        </ul>
        <p><strong>Cual elegir:</strong> la avalancha te ahorra mas plata, pero la bola de nieve la termina mas gente. Si te cuesta mantener el habito, empieza con bola de nieve.</p>
        <p><strong>Ojo:</strong> pagar una deuda con 30% de interes es como ganar 30% garantizado. Casi siempre viene antes que invertir.</p>`,
    },
    {
      emoji: '🎯',
      titulo: 'Presupuesto base cero',
      nivel: 'avanzado',
      resumen: 'Cada peso que entra tiene un trabajo asignado antes del mes.',
      cuerpo: `
        <p>En vez de gastar y ver que queda, le asignas un destino a cada peso <em>antes</em> de que empiece el mes. Ingresos menos asignaciones tiene que dar exactamente cero.</p>
        <p>Ojo: "cero" no significa gastarlo todo. El ahorro tambien es una asignacion.</p>
        <ul>
          <li>Es el metodo mas exigente y tambien el mas efectivo.</li>
          <li>Ideal si tus ingresos son variables: asignas al empezar el mes con lo que realmente tienes.</li>
          <li>Reasignar durante el mes esta permitido. Ignorar el plan, no.</li>
        </ul>`,
    },
    {
      emoji: '📈',
      titulo: 'El interes compuesto (por que partir hoy)',
      nivel: 'avanzado',
      resumen: 'Tu ahorro genera ahorro. El tiempo pesa mas que el monto.',
      cuerpo: `
        <p>Interes compuesto significa que tus intereses tambien generan intereses. Al principio es aburrido; despues de unos anos se pone interesante.</p>
        <p><strong>Ejemplo:</strong> 50.000 al mes al 6% anual.</p>
        <ul>
          <li>A los 10 anos: aportaste 6.000.000 y tienes cerca de 8.200.000.</li>
          <li>A los 20 anos: aportaste 12.000.000 y tienes cerca de 23.000.000.</li>
          <li>A los 30 anos: aportaste 18.000.000 y tienes cerca de 50.000.000.</li>
        </ul>
        <p>El aporte se duplico entre los 10 y 20 anos; el resultado se triplico. <strong>Lo que hace la diferencia es el tiempo, no el monto.</strong></p>
        <p class="ayuda">Los numeros son un ejemplo educativo con rentabilidad constante. La realidad sube y baja, y esta app no da recomendaciones de inversion.</p>`,
    },
    {
      emoji: '🔁',
      titulo: 'Revision mensual de 15 minutos',
      nivel: 'medio',
      resumen: 'El habito que sostiene todos los demas.',
      cuerpo: `
        <p>Una vez al mes, con calma:</p>
        <ul>
          <li>Mira tu grafico de categorias. Hubo alguna sorpresa?</li>
          <li>Compara con el mes anterior en el grafico de barras.</li>
          <li>Ajusta un solo tope. Uno. El que mas se desvio.</li>
          <li>Abona a tu meta lo que hayas podido.</li>
        </ul>
        <p><strong>Sin culpa.</strong> Un mes malo es informacion, no un fracaso. La gente que logra ordenarse no es la que nunca se pasa: es la que vuelve a mirar.</p>`,
    },
  ];

  /** Un consejo corto y rotativo, distinto cada dia. */
  const PILDORAS = [
    'Anotar un gasto toma 5 segundos. Reconstruir el mes de memoria, imposible.',
    'Un tope que rompes todos los meses no es disciplina que falta: es un tope mal puesto.',
    'Revisa tus suscripciones una vez al ano. Es el gasto que mas se olvida.',
    'Antes de una compra grande, espera 30 dias. Si a los 30 dias la sigues queriendo, comprala tranquilo.',
    'Pagar una deuda cara rinde mas que casi cualquier inversion.',
    'Tu fondo de emergencia no tiene que ser rentable. Tiene que estar disponible.',
    'Comparar tu mes con el anterior sirve. Compararte con otras personas, casi nunca.',
    'El sueldo que no ves, no lo gastas: automatiza la transferencia el dia del pago.',
    'Ahorrar el 5% todos los meses gana por lejos a ahorrar el 30% una vez.',
    'Un mes malo es informacion, no un fracaso. Lo unico grave es dejar de mirar.',
    'Si tus ingresos son variables, presupuesta con tu peor mes, no con el mejor.',
    'Anota tambien lo que ganas. Ver ingresos y gastos juntos cambia las decisiones.',
  ];

  function pildoraDelDia() {
    const dias = Math.floor(Date.now() / 86400000);
    return PILDORAS[dias % PILDORAS.length];
  }

  return { TECNICAS, PILDORAS, pildoraDelDia };
})();
