/* ============================================================
   src/core/dinero.js
   Mi Bolsillo trabaja SOLO con pesos chilenos enteros.
   Nunca decimales, nunca float: los centavos que en Chile no
   existen terminan generando diferencias de un peso que despues
   nadie sabe explicar.
   Formatear con puntos es cosa de la pantalla, jamas del calculo.
   ============================================================ */

const Dinero = (() => {

  /** Deja cualquier entrada como entero de pesos, siempre positivo. */
  const entero = valor => Math.round(Math.abs(Number(valor) || 0));

  /** Igual que entero(), pero conserva el signo (saldos y deudas). */
  const conSigno = valor => Math.round(Number(valor) || 0);

  const formateador = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  /* El signo va antes del peso: "-$6.500" y no "$-6.500", que es lo que
     devuelve Intl y se lee como si el monto fuera raro. */
  function formatear(monto) {
    const n = conSigno(monto);
    const signo = n < 0 ? '-' : '';
    const valor = Math.abs(n);
    try {
      return signo + formateador.format(valor);
    } catch (e) {
      return `${signo}$${valor.toLocaleString('es-CL')}`;
    }
  }

  return { entero, conSigno, formatear };
})();
