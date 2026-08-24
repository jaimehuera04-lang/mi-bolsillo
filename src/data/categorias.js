/* ============================================================
   src/data/categorias.js
   Listas fijas: categorias de gasto, de ingreso y tipos de cuenta.
   Son DATOS, no logica. No calculan ni dibujan nada.
   ============================================================ */

const Categorias = (() => {

  /* Cada categoria tiene emoji, nombre, color y "tipo", que sirve
     para la regla 50/30/20:
       'necesidad' = techo, comida, transporte, salud, deudas.
       'deseo'     = salidas, ropa, antojos.
       'ahorro'    = ahorro e inversion.                          */
  const GASTO = [
    { id: 'comida',      emoji: '🛒', nombre: 'Supermercado', color: '#e8a33d', tipo: 'necesidad' },
    { id: 'restaurante', emoji: '🍔', nombre: 'Comer fuera',  color: '#ef7f4e', tipo: 'deseo' },
    { id: 'transporte',  emoji: '🚌', nombre: 'Transporte',   color: '#3b7dd8', tipo: 'necesidad' },
    { id: 'vivienda',    emoji: '🏠', nombre: 'Arriendo/Casa',color: '#5b6b7c', tipo: 'necesidad' },
    { id: 'servicios',   emoji: '💡', nombre: 'Cuentas',      color: '#38a3c9', tipo: 'necesidad' },
    { id: 'salud',       emoji: '💊', nombre: 'Salud',        color: '#43b5a0', tipo: 'necesidad' },
    { id: 'educacion',   emoji: '📚', nombre: 'Educacion',    color: '#7c5cd6', tipo: 'necesidad' },
    { id: 'ocio',        emoji: '🎬', nombre: 'Entretencion', color: '#c455a5', tipo: 'deseo' },
    { id: 'ropa',        emoji: '👕', nombre: 'Ropa',         color: '#d96a8a', tipo: 'deseo' },
    { id: 'suscripcion', emoji: '📱', nombre: 'Suscripciones',color: '#6f7fd6', tipo: 'deseo' },
    // Las cuotas y las deudas son obligaciones, no ahorro: van en necesidad.
    { id: 'deuda',       emoji: '🏦', nombre: 'Cuotas y deudas', color: '#96502f', tipo: 'necesidad' },
    { id: 'ahorro',      emoji: '🐷', nombre: 'Ahorro',       color: '#10a072', tipo: 'ahorro' },
    { id: 'mascota',     emoji: '🐶', nombre: 'Mascota',      color: '#a8894a', tipo: 'deseo' },
    { id: 'regalo',      emoji: '🎁', nombre: 'Regalos',      color: '#e2564d', tipo: 'deseo' },
    { id: 'otro',        emoji: '📦', nombre: 'Otro',         color: '#8c99a6', tipo: 'deseo' },
  ];

  const INGRESO = [
    { id: 'sueldo',    emoji: '💼', nombre: 'Sueldo',        color: '#10a072' },
    { id: 'extra',     emoji: '🧾', nombre: 'Trabajo extra', color: '#3b7dd8' },
    { id: 'venta',     emoji: '🏷️', nombre: 'Venta',         color: '#e8a33d' },
    { id: 'regalo-in', emoji: '🎉', nombre: 'Regalo',        color: '#c455a5' },
    { id: 'interes',   emoji: '📈', nombre: 'Intereses',     color: '#7c5cd6' },
    { id: 'otro-in',   emoji: '➕', nombre: 'Otro',          color: '#8c99a6' },
  ];

  const DESCONOCIDA = { emoji: '📦', nombre: 'Otro', color: '#8c99a6', tipo: 'deseo' };

  function porId(id) {
    return GASTO.find(c => c.id === id) || INGRESO.find(c => c.id === id) || { ...DESCONOCIDA, id };
  }

  /* ---------- Tipos de cuenta ----------
     "deuda: true" marca las cuentas donde un saldo negativo significa
     que debes plata (la tarjeta de credito), no que algo se calculo mal. */
  const TIPOS_CUENTA = [
    { id: 'cuenta_rut', emoji: '🏧', nombre: 'Cuenta RUT',         deuda: false },
    { id: 'corriente',  emoji: '🏦', nombre: 'Cuenta corriente',   deuda: false },
    { id: 'vista',      emoji: '💳', nombre: 'Cuenta vista',       deuda: false },
    { id: 'ahorro',     emoji: '🐷', nombre: 'Cuenta de ahorro',   deuda: false },
    { id: 'efectivo',   emoji: '💵', nombre: 'Efectivo',           deuda: false },
    // MACH, Tenpo, BE Pay, Mercado Pago
    { id: 'billetera',  emoji: '📲', nombre: 'Billetera digital',  deuda: false },
    { id: 'credito',    emoji: '💳', nombre: 'Tarjeta de credito', deuda: true },
  ];

  const tipoCuenta = id =>
    TIPOS_CUENTA.find(t => t.id === id) || { id, emoji: '💳', nombre: 'Cuenta', deuda: false };

  return { GASTO, INGRESO, porId, TIPOS_CUENTA, tipoCuenta };
})();
