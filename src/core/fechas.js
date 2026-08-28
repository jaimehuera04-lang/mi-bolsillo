/* ============================================================
   src/core/fechas.js
   Todo lo que tiene que ver con días y meses.

   Regla: las fechas se guardan y se comparan como texto ISO
   'AAAA-MM-DD' en la zona horaria LOCAL del usuario.
   Nunca new Date('2026-03-01') a secas: eso se interpreta como
   UTC y en Chile devuelve el 28 de febrero.
   ============================================================ */

const Fechas = (() => {
  const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const dosDigitos = n => String(n).padStart(2, '0');

  function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  }

  /** ISO de un anio/mes/día concretos. mes va de 0 a 11. */
  const aISO = (anio, mes, dia) => `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;

  /** 'AAAA-MM' del mes. mes va de 0 a 11. */
  const claveMes = (anio, mes) => `${anio}-${dosDigitos(mes + 1)}`;

  /** Convierte '2026-08-20' en un Date local, sin sustos de zona horaria. */
  function aFecha(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  const nombreMes = (anio, mes) => `${NOMBRES_MES[mes]} ${anio}`;

  function fechaLegible(iso) {
    const f = aFecha(iso);
    const dias = Math.round((aFecha(hoyISO()) - f) / 86400000);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return `${f.getDate()} de ${NOMBRES_MES[f.getMonth()]}`;
  }

  /** Cuantos días tiene ese mes. mes va de 0 a 11. */
  const diasDelMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate();

  /** Suma meses y devuelve { anio, mes }. Sirve para proyectar hacia adelante. */
  function sumarMeses(anio, mes, cuantos) {
    const f = new Date(anio, mes + cuantos, 1);
    return { anio: f.getFullYear(), mes: f.getMonth() };
  }

  return { NOMBRES_MES, dosDigitos, hoyISO, aISO, claveMes, aFecha, nombreMes,
           fechaLegible, diasDelMes, sumarMeses };
})();
