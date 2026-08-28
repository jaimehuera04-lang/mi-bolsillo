/* ============================================================
   config-nube.js - Los dos datos de tu proyecto de Supabase.

   MIENTRAS ESTO ESTÉ VACÍO, LA APP FUNCIONA COMO SIEMPRE:
   guarda solo en el teléfono y no hay nada de nube. No se rompe
   nada. Recién cuando pegues los dos valores de abajo aparece la
   opción de tener cuenta y sincronizar.

   De dónde salen los dos valores está explicado paso a paso en
   SUPABASE.md, en la raíz del proyecto.

   ¿Es seguro que la llave esté aquí, a la vista de cualquiera?
   Sí. La "anon key" de Supabase está hecha para vivir en el
   navegador: sola no sirve para nada. Quien manda es la regla de
   seguridad de la tabla (RLS), que solo deja ver y escribir a
   quien inició sesión, y solo sus propias filas. La llave que
   NUNCA va aquí es la "service_role": esa se salta las reglas.
   ============================================================ */

const CONFIG_NUBE = {
  // Ejemplo: 'https://abcdefghijklm.supabase.co'
  url: '',

  // La llave "anon public", la larga que empieza con "eyJ..."
  llavePublica: '',
};
