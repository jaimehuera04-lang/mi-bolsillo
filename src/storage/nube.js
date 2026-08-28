/* ============================================================
   nube.js - La copia de tus datos que vive fuera del teléfono.

   Qué hace y qué NO hace:

     - El teléfono sigue siendo el que manda para lo inmediato.
       Anotas un gasto, se guarda en `localStorage` al tiro y la
       pantalla responde sin esperar a internet.
     - Unos segundos después, en silencio, sube una copia a tu
       proyecto de Supabase. Si no hay señal, queda pendiente y
       sube sola cuando vuelva.
     - Nunca borra nada del teléfono por su cuenta.

   Se habla con Supabase por HTTP pelado (`fetch`), sin su
   librería: el proyecto no usa librerías ni tiene compilación.

   Si `config-nube.js` está vacío, todo esto queda apagado y la
   app se comporta exactamente como antes.
   ============================================================ */

const Nube = (() => {
  'use strict';

  const LLAVE_SESION = 'mi-bolsillo:sesion';
  const LLAVE_CONFIG = 'mi-bolsillo:nube';
  const TABLA = 'estados';

  // Cuánto esperamos, después del último cambio, antes de subir.
  // Anotar tres gastos seguidos sube una vez, no tres.
  const ESPERA_ANTES_DE_SUBIR = 2500;

  /* ---------------- 0. De dónde salen la dirección y la llave ----------------

     Hay dos caminos y el orden importa:

       1. Lo que la persona pegó en Ajustes, guardado en este teléfono.
          Es el camino normal: no hay que tocar código ni publicar nada.
       2. `config-nube.js`, para dejarlo fijo en el repositorio.

     Si no hay ninguno de los dos, la nube no existe y la app funciona
     igual que siempre, guardando solo en el teléfono. */

  function configGuardada() {
    try {
      const crudo = localStorage.getItem(LLAVE_CONFIG);
      if (!crudo) return null;
      const c = JSON.parse(crudo);
      return (c && c.url && c.llavePublica) ? c : null;
    } catch (_) {
      return null;
    }
  }

  const configDelArchivo = () =>
    (typeof CONFIG_NUBE !== 'undefined' && CONFIG_NUBE.url && CONFIG_NUBE.llavePublica)
      ? CONFIG_NUBE : null;

  let conf = configGuardada() || configDelArchivo() || {};

  /** true si hay un proyecto configurado. Si no, la nube ni existe. */
  const configurada = () => Boolean(conf.url && conf.llavePublica);

  /** true si la conexión la pegó la persona desde Ajustes. */
  const configEsDelTelefono = () => Boolean(configGuardada());

  const direccionDelProyecto = () => conf.url || '';

  /** Limpia la dirección: sin barra final y siempre con https. */
  function ordenarUrl(texto) {
    let url = String(texto || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }

  /**
   * Revisa que la dirección y la llave sirvan de verdad, y de paso que
   * la tabla exista. Devuelve { ok: true } o { ok: false, mensaje }.
   * Vale la pena hacer las dos preguntas por separado: así podemos
   * decir "te faltó el paso del SQL" en vez de un error genérico.
   */
  async function probarConexion(urlCruda, llave) {
    const url = ordenarUrl(urlCruda);
    const apikey = String(llave || '').trim();

    if (!url) return { ok: false, mensaje: 'Falta la dirección del proyecto.' };
    if (!apikey) return { ok: false, mensaje: 'Falta la llave pública.' };
    if (/^ey/.test(apikey) === false && !/localhost/.test(url)) {
      return { ok: false, mensaje: 'Esa no parece la llave. La correcta es larga y empieza con "eyJ".' };
    }

    // 1. ¿Responde el proyecto y acepta la llave?
    let respuesta;
    try {
      respuesta = await fetch(url + '/auth/v1/settings', { headers: { apikey } });
    } catch (_) {
      return { ok: false, mensaje: 'No se pudo llegar a esa dirección. Revísala, o revisa tu internet.' };
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      return { ok: false, mensaje: 'El proyecto responde, pero rechaza la llave. Copia la que dice "anon public".' };
    }
    if (!respuesta.ok) {
      return { ok: false, mensaje: 'Esa dirección no parece un proyecto de Supabase.' };
    }

    // 2. ¿Existe la tabla? Sin sesión, con las reglas puestas, esto
    //    devuelve una lista vacía. Si la tabla no existe, da 404.
    let tabla;
    try {
      tabla = await fetch(url + '/rest/v1/' + TABLA + '?select=usuario_id&limit=1',
        { headers: { apikey, Authorization: 'Bearer ' + apikey } });
    } catch (_) {
      return { ok: false, mensaje: 'El proyecto responde, pero no pudimos revisar la tabla.' };
    }
    if (tabla.status === 404) {
      return {
        ok: false,
        mensaje: 'Falta crear la tabla. Es el paso 2 de SUPABASE.md: pegar el SQL en el editor de Supabase.',
      };
    }

    return { ok: true, url, llavePublica: apikey };
  }

  /** Guarda la conexión en este teléfono y la deja andando. */
  function guardarConfig(url, llavePublica) {
    conf = { url, llavePublica };
    try {
      localStorage.setItem(LLAVE_CONFIG, JSON.stringify(conf));
    } catch (_) { /* si no se puede guardar, dura lo que dure la pestaña */ }
    avisarCambio(haySesion() ? 'pendiente' : 'sin-sesion');
  }

  /** Olvida la conexión. Los datos del teléfono no se tocan. */
  function borrarConfig() {
    try { localStorage.removeItem(LLAVE_CONFIG); } catch (_) { /* da lo mismo */ }
    guardarSesion(null);
    conf = configDelArchivo() || {};
    ultimoSubido = '';
    avisarCambio(configurada() ? 'sin-sesion' : 'apagada');
  }

  /* ---------------- 1. La sesión ---------------- */

  let sesion = null;          // { token, refresco, expira, usuarioId, correo }
  let obtenerEstado = null;   // se lo pasa datos.js: devuelve el objeto a subir
  let temporizador = null;
  let ultimoSubido = '';      // para no subir dos veces lo mismo

  function leerSesionGuardada() {
    try {
      const crudo = localStorage.getItem(LLAVE_SESION);
      if (!crudo) return null;
      const s = JSON.parse(crudo);
      return (s && s.token && s.usuarioId) ? s : null;
    } catch (_) {
      return null;
    }
  }

  function guardarSesion(s) {
    sesion = s;
    try {
      if (s) localStorage.setItem(LLAVE_SESION, JSON.stringify(s));
      else localStorage.removeItem(LLAVE_SESION);
    } catch (_) { /* si no se puede guardar, la sesión dura lo que dure la pestaña */ }
  }

  const haySesion = () => Boolean(sesion && sesion.token);
  const correoDeLaSesion = () => (sesion ? sesion.correo : '');

  /* ---------------- 2. El estado que ve la interfaz ---------------- */

  // 'apagada'    no hay proyecto configurado
  // 'sin-sesion' hay proyecto pero nadie entró
  // 'al-dia'     lo del teléfono y lo de la nube son lo mismo
  // 'subiendo'   en eso estamos
  // 'pendiente'  hay cambios sin subir (sin internet, por ejemplo)
  // 'error'      algo falló; el detalle va en `ultimoError`
  let estadoActual = 'apagada';
  let ultimoError = '';
  const oyentes = [];

  function avisarCambio(nuevo, error) {
    estadoActual = nuevo;
    ultimoError = error || '';
    for (const oyente of oyentes) {
      try { oyente(estadoActual, ultimoError); } catch (_) { /* un oyente roto no rompe al resto */ }
    }
  }

  const alCambiar = f => { oyentes.push(f); f(estadoActual, ultimoError); };
  const estado = () => estadoActual;
  const errorActual = () => ultimoError;

  /* ---------------- 3. Hablar con Supabase ---------------- */

  /** Traduce los errores de Supabase a algo que una persona entienda. */
  function mensajeDeError(datos, respuesta) {
    const crudo = String(
      (datos && (datos.error_description || datos.msg || datos.message || datos.error)) || ''
    ).toLowerCase();

    if (crudo.includes('invalid login')) return 'Ese correo o esa contraseña no calzan.';
    if (crudo.includes('already registered')) return 'Ese correo ya tiene cuenta. Prueba con Entrar.';
    if (crudo.includes('email not confirmed')) return 'Falta confirmar tu correo. Revisa tu bandeja.';
    if (crudo.includes('password should be')) return 'La contraseña tiene que tener al menos 6 letras o números.';
    if (crudo.includes('rate limit') || (respuesta && respuesta.status === 429)) {
      return 'Demasiados intentos seguidos. Espera un minuto.';
    }
    if (respuesta && respuesta.status === 401) return 'Tu sesión venció. Vuelve a entrar.';
    return crudo ? crudo.charAt(0).toUpperCase() + crudo.slice(1) : 'No se pudo conectar con la nube.';
  }

  async function pedir(ruta, { metodo = 'GET', cuerpo, conSesion = true, cabeceras = {} } = {}) {
    if (!configurada()) throw new Error('La nube no está configurada.');

    const opciones = {
      method: metodo,
      headers: {
        apikey: conf.llavePublica,
        'Content-Type': 'application/json',
        ...cabeceras,
      },
    };
    if (conSesion && sesion && sesion.token) {
      opciones.headers.Authorization = 'Bearer ' + sesion.token;
    }
    if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);

    let respuesta;
    try {
      respuesta = await fetch(conf.url.replace(/\/+$/, '') + ruta, opciones);
    } catch (_) {
      // esto es quedarse sin internet, no un error del servidor
      const error = new Error('Sin conexión');
      error.sinConexion = true;
      throw error;
    }

    const texto = await respuesta.text();
    let datos = null;
    if (texto) { try { datos = JSON.parse(texto); } catch (_) { datos = null; } }

    if (!respuesta.ok) {
      const error = new Error(mensajeDeError(datos, respuesta));
      error.status = respuesta.status;
      throw error;
    }
    return datos;
  }

  /** Cambia el token vencido por uno nuevo. Devuelve true si lo logró. */
  async function refrescarSesion() {
    if (!sesion || !sesion.refresco) return false;
    try {
      const datos = await pedir('/auth/v1/token?grant_type=refresh_token', {
        metodo: 'POST',
        cuerpo: { refresh_token: sesion.refresco },
        conSesion: false,
      });
      guardarSesion(sesionDesdeRespuesta(datos, sesion.correo));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Repite la petición una sola vez si el token estaba vencido. */
  async function pedirConReintento(ruta, opciones) {
    try {
      return await pedir(ruta, opciones);
    } catch (error) {
      if (error.status !== 401) throw error;
      if (!(await refrescarSesion())) {
        guardarSesion(null);
        avisarCambio('sin-sesion');
        throw new Error('Tu sesión venció. Vuelve a entrar.');
      }
      return pedir(ruta, opciones);
    }
  }

  function sesionDesdeRespuesta(datos, correoDeRespaldo) {
    if (!datos || !datos.access_token) return null;
    return {
      token: datos.access_token,
      refresco: datos.refresh_token || '',
      expira: Date.now() + (Number(datos.expires_in || 3600) * 1000),
      usuarioId: (datos.user && datos.user.id) || (sesion && sesion.usuarioId) || '',
      correo: (datos.user && datos.user.email) || correoDeRespaldo || '',
    };
  }

  /* ---------------- 4. Entrar, crear cuenta, salir ---------------- */

  /**
   * Crea la cuenta. Si el proyecto pide confirmar el correo,
   * devuelve { confirmarCorreo: true } y todavía no hay sesión.
   */
  async function crearCuenta(correo, clave) {
    const datos = await pedir('/auth/v1/signup', {
      metodo: 'POST',
      cuerpo: { email: String(correo).trim().toLowerCase(), password: clave },
      conSesion: false,
    });

    const nueva = sesionDesdeRespuesta(datos, correo);
    if (!nueva) return { confirmarCorreo: true };

    guardarSesion(nueva);
    avisarCambio('pendiente');
    return { confirmarCorreo: false };
  }

  async function entrar(correo, clave) {
    const datos = await pedir('/auth/v1/token?grant_type=password', {
      metodo: 'POST',
      cuerpo: { email: String(correo).trim().toLowerCase(), password: clave },
      conSesion: false,
    });

    const nueva = sesionDesdeRespuesta(datos, correo);
    if (!nueva) throw new Error('La nube no devolvió una sesión válida.');

    guardarSesion(nueva);
    avisarCambio('pendiente');
    return true;
  }

  /** Manda el correo para poner una contraseña nueva. */
  async function recuperarClave(correo) {
    await pedir('/auth/v1/recover', {
      metodo: 'POST',
      cuerpo: { email: String(correo).trim().toLowerCase() },
      conSesion: false,
    });
    return true;
  }

  /** Cierra sesión. Los datos del teléfono quedan intactos. */
  async function salir() {
    clearTimeout(temporizador);
    try { await pedir('/auth/v1/logout', { metodo: 'POST' }); } catch (_) { /* da lo mismo si falla */ }
    guardarSesion(null);
    ultimoSubido = '';
    avisarCambio('sin-sesion');
  }

  /* ---------------- 5. Subir y bajar ---------------- */

  /** Trae lo que hay en la nube. Devuelve null si todavía no hay nada. */
  async function bajar() {
    if (!haySesion()) throw new Error('Primero tienes que entrar a tu cuenta.');
    const filas = await pedirConReintento(
      '/rest/v1/' + TABLA + '?select=datos,actualizado',
      { cabeceras: { Accept: 'application/json' } }
    );
    if (!Array.isArray(filas) || !filas.length) return null;
    return { datos: filas[0].datos, actualizado: filas[0].actualizado };
  }

  /** Sube el objeto completo. Pisa lo que hubiera en la nube. */
  async function subir(objeto) {
    if (!haySesion()) throw new Error('Primero tienes que entrar a tu cuenta.');

    const fila = {
      usuario_id: sesion.usuarioId,
      datos: objeto,
      version_esquema: (objeto && objeto.meta && objeto.meta.schemaVersion) || 1,
      actualizado: new Date().toISOString(),
    };

    await pedirConReintento('/rest/v1/' + TABLA, {
      metodo: 'POST',
      cuerpo: [fila],
      // merge-duplicates = si ya existe tu fila, la reemplaza en vez de fallar
      cabeceras: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });

    ultimoSubido = JSON.stringify(objeto);
    marcarSincronizado(fila.actualizado);
    return true;
  }

  /* ---------------- 5b. Quién tiene lo más nuevo ----------------

     Con dos dispositivos, "sube solo" no basta: si el celular estuvo
     sin internet y el computador siguió anotando, subir a ciegas
     borraría lo del computador. Así que guardamos una marca del
     último momento en que los dos lados estuvieron iguales, y al
     abrir comparamos. */

  const LLAVE_MARCA = 'mi-bolsillo:sincronizado';

  const instante = t => {
    const n = Date.parse(t);
    return Number.isFinite(n) ? n : 0;
  };

  function leerMarca() {
    try { return localStorage.getItem(LLAVE_MARCA) || ''; } catch (_) { return ''; }
  }

  function marcarSincronizado(iso) {
    try { localStorage.setItem(LLAVE_MARCA, iso); } catch (_) { /* da lo mismo */ }
  }

  /**
   * Se llama al abrir la app. Decide qué hacer y le devuelve el
   * veredicto a la interfaz, que es la que puede preguntar.
   * Devuelve { accion: 'nada' | 'subio' | 'bajar' | 'conflicto', ... }
   */
  async function revisarAlAbrir() {
    if (!configurada() || !haySesion() || !obtenerEstado) return { accion: 'nada' };

    let remoto;
    try {
      remoto = await bajar();
    } catch (error) {
      avisarCambio(error.sinConexion ? 'pendiente' : 'error', error.message);
      return { accion: 'nada' };
    }

    const marca = instante(leerMarca());
    const local = obtenerEstado();
    const fechaLocal = instante(local.meta && local.meta.actualizado);

    // La nube está vacía: subimos y listo.
    if (!remoto || !remoto.datos) {
      await subirAhora();
      return { accion: 'subio' };
    }

    const cambioAca  = fechaLocal > marca;
    const cambioAlla = instante(remoto.actualizado) > marca;

    if (cambioAca && cambioAlla) {
      return {
        accion: 'conflicto',
        remoto,
        movimientosAca:  (local.movimientos || []).length,
        movimientosAlla: ((remoto.datos && remoto.datos.movimientos) || []).length,
      };
    }
    if (cambioAlla) return { accion: 'bajar', remoto };
    if (cambioAca)  { await subirAhora(); return { accion: 'subio' }; }

    avisarCambio('al-dia');
    return { accion: 'nada' };
  }

  /* ---------------- 6. La sincronización automática ---------------- */

  /**
   * datos.js llama a esto cada vez que algo cambia. No sube al tiro:
   * espera un par de segundos por si vienen más cambios detrás.
   */
  function anotarCambio() {
    if (!configurada() || !haySesion() || !obtenerEstado) return;
    avisarCambio('pendiente');
    clearTimeout(temporizador);
    temporizador = setTimeout(subirAhora, ESPERA_ANTES_DE_SUBIR);
  }

  /** Sube ya, sin esperar. Se usa al entrar y al volver la conexión. */
  async function subirAhora() {
    if (!configurada() || !haySesion() || !obtenerEstado) return false;

    const objeto = obtenerEstado();
    const comoTexto = JSON.stringify(objeto);
    if (comoTexto === ultimoSubido) {           // nada cambió desde la última vez
      avisarCambio('al-dia');
      return true;
    }

    avisarCambio('subiendo');
    try {
      await subir(objeto);
      avisarCambio('al-dia');
      return true;
    } catch (error) {
      // sin internet no es un error del usuario: queda pendiente y ya subirá
      avisarCambio(error.sinConexion ? 'pendiente' : 'error', error.message);
      return false;
    }
  }

  /* ---------------- 7. Arranque ---------------- */

  /**
   * Lo llama datos.js al abrir la app. `dameElEstado` es una función
   * que devuelve el objeto completo que hay que subir.
   */
  function iniciar(dameElEstado) {
    obtenerEstado = dameElEstado;

    if (!configurada()) { avisarCambio('apagada'); return; }

    sesion = leerSesionGuardada();
    avisarCambio(haySesion() ? 'pendiente' : 'sin-sesion');

    // Ojo: acá NO subimos. Quien decide es revisarAlAbrir(), que la
    // interfaz llama en cuanto termina de dibujar la primera pantalla.
    if (haySesion() && sesion.expira && sesion.expira < Date.now() + 60000) {
      refrescarSesion();
    }

    // cuando vuelve internet, mandamos lo que haya quedado pendiente
    window.addEventListener('online', () => {
      if (estadoActual === 'pendiente' || estadoActual === 'error') subirAhora();
    });

    // al volver a la app después de dejarla en segundo plano
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && estadoActual === 'pendiente') subirAhora();
    });
  }

  return {
    configurada, configEsDelTelefono, direccionDelProyecto,
    probarConexion, guardarConfig, borrarConfig,
    iniciar,
    crearCuenta, entrar, salir, recuperarClave,
    haySesion, correoDeLaSesion,
    bajar, subir, anotarCambio, subirAhora,
    revisarAlAbrir,
    estado, errorActual, alCambiar,
  };
})();
