/* ============================================================
   src/storage/esquema.js
   La forma exacta que tienen los datos guardados.

   Si cambias algo aquí, sube VERSION_ESQUEMA y escribe la
   migración correspondiente en migraciones.js. Nunca cambies
   la forma sin migración: los datos viejos de la gente que ya
   tiene la app instalada entran mutilados y en silencio.
   ============================================================ */

const Esquema = (() => {

  const VERSION_ESQUEMA = 2;

  // La llave ya no lleva el número de versión: la versión vive DENTRO
  // del objeto. Poner "v1" en el nombre invita a crear otra llave en
  // vez de migrar, que es justo lo que no queremos.
  const LLAVE        = 'mi-bolsillo';
  const LLAVE_VIEJA  = 'mi-bolsillo-v1';          // esquema 1, el de antes
  const LLAVE_RESPALDO = 'mi-bolsillo:respaldo';  // copia previa a migrar

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Lo que ve alguien que recién instala ---------- */
  function estadoNuevo() {
    return {
      meta: {
        schemaVersion: VERSION_ESQUEMA,
        creado: Fechas.hoyISO(),
        ultimoRespaldo: '',
      },

      /* cuentas: donde vive la plata.
         saldoInicial es el saldo del día que creaste la cuenta.
         El saldo de hoy NO se guarda, se calcula (ver calculos.js). */
      cuentas: [],

      /* movimientos: tipo 'ingreso' | 'gasto' | 'transferencia'.
         monto siempre positivo y entero. El signo lo da el tipo.   */
      movimientos: [],

      /* compromisos: plata que ya prometiste y todavía no sale.
         Se llenan en la Fase 2. Aquí solo dejamos el cajón listo.  */
      compromisos: [],
      ingresosPrevistos: [],
      estacionales: [],
      simulaciones: [],

      metas: [],

      // Secundario a propósito: el corazón de la app son los
      // compromisos futuros, no los topes de gasto.
      presupuestos: {},

      ajustes: {
        correo: '',
        registrado: false,
        nombre: '',
        ingresoEsperado: 0,
        tutorialVisto: false,
        iaActivada: false,        // apagada de fábrica, se enciende en la Fase 6
      },
    };
  }

  /** Cuenta por defecto para quien recién parte o viene del esquema 1. */
  function cuentaPorDefecto() {
    return {
      id: nuevoId(),
      nombre: 'Mi cuenta',
      tipo: 'cuenta_rut',
      saldoInicial: 0,
      icono: '🏧',
      activa: true,
      fechaCreacion: Fechas.hoyISO(),
    };
  }

  return { VERSION_ESQUEMA, LLAVE, LLAVE_VIEJA, LLAVE_RESPALDO,
           nuevoId, estadoNuevo, cuentaPorDefecto };
})();
