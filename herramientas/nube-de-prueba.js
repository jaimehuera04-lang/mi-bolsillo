/* ============================================================
   nube-de-prueba.js - Un Supabase de mentira, para probar.

   Habla lo justo del idioma de Supabase (crear cuenta, entrar,
   leer y escribir la tabla) pero guarda todo en la memoria: al
   cerrarlo se olvida de todo. Sirve para probar la sincronización
   sin tocar tu proyecto de verdad y sin necesitar internet.

   Uso:
     1. node herramientas/nube-de-prueba.js
     2. en src/config-nube.js pon:
          url: 'http://localhost:5174'
          llavePublica: 'llave-de-prueba'
     3. node herramientas/servidor.js  y abre la app
     4. cuando termines, DEJA config-nube.js vacío otra vez

   No usar para nada real: no hay contraseñas cifradas ni nada
   parecido. Es un simulador de escritorio.
   ============================================================ */

const http = require('http');

const PUERTO = process.env.PUERTO_NUBE || 5174;

// "Base de datos" en memoria
const usuarios = new Map();   // correo -> { id, correo, clave }
const sesiones = new Map();   // token  -> id de usuario
const filas = new Map();      // id de usuario -> { datos, actualizado }

let contador = 0;
const nuevoId = () => 'usuario-' + (++contador);
const nuevoToken = () => 'token-' + Math.random().toString(36).slice(2) + '-' + Date.now();

function responder(res, codigo, cuerpo) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': '*',
  });
  res.end(texto);
}

function leerCuerpo(req) {
  return new Promise(resolver => {
    let texto = '';
    req.on('data', trozo => { texto += trozo; });
    req.on('end', () => {
      try { resolver(texto ? JSON.parse(texto) : {}); } catch (_) { resolver({}); }
    });
  });
}

/** Devuelve el id del usuario de la cabecera Authorization, o null. */
function usuarioDe(req) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.replace(/^Bearer\s+/i, '');
  return sesiones.get(token) || null;
}

function sesionPara(usuario) {
  const token = nuevoToken();
  sesiones.set(token, usuario.id);
  return {
    access_token: token,
    refresh_token: 'refresco-' + token,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: usuario.id, email: usuario.correo },
  };
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return responder(res, 204);

  const url = new URL(req.url, 'http://localhost');
  const ruta = url.pathname;
  const cuerpo = (req.method === 'POST') ? await leerCuerpo(req) : {};

  console.log(req.method, ruta);

  /* ---------- Crear cuenta ---------- */
  if (ruta === '/auth/v1/signup' && req.method === 'POST') {
    const correo = String(cuerpo.email || '').toLowerCase();
    if (usuarios.has(correo)) {
      return responder(res, 400, { msg: 'User already registered' });
    }
    if (String(cuerpo.password || '').length < 6) {
      return responder(res, 422, { msg: 'Password should be at least 6 characters' });
    }
    const usuario = { id: nuevoId(), correo, clave: cuerpo.password };
    usuarios.set(correo, usuario);

    // Los proyectos nuevos de Supabase piden confirmar el correo: crean
    // el usuario pero NO devuelven sesión. Con CONFIRMAR=1 simulamos eso,
    // que es lo que le pasa a una persona de verdad.
    //   CONFIRMAR=1 node herramientas/nube-de-prueba.js
    if (process.env.CONFIRMAR) {
      usuario.sinConfirmar = true;
      return responder(res, 200, { user: { id: usuario.id, email: correo }, session: null });
    }
    return responder(res, 200, sesionPara(usuario));
  }

  /* ---------- Entrar y refrescar ---------- */
  if (ruta === '/auth/v1/token' && req.method === 'POST') {
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const token = String(cuerpo.refresh_token || '').replace(/^refresco-/, '');
      const id = sesiones.get(token);
      if (!id) return responder(res, 400, { msg: 'Invalid Refresh Token' });
      const usuario = [...usuarios.values()].find(u => u.id === id);
      return responder(res, 200, sesionPara(usuario));
    }
    const usuario = usuarios.get(String(cuerpo.email || '').toLowerCase());
    if (!usuario || usuario.clave !== cuerpo.password) {
      return responder(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    return responder(res, 200, sesionPara(usuario));
  }

  if (ruta === '/auth/v1/logout' && req.method === 'POST') {
    const cabecera = req.headers.authorization || '';
    sesiones.delete(cabecera.replace(/^Bearer\s+/i, ''));
    return responder(res, 204);
  }

  if (ruta === '/auth/v1/recover' && req.method === 'POST') {
    return responder(res, 200, {});
  }

  /* ---------- Entrar con un código al correo (sin contraseña) ---------- */

  // Pedir el código. Supabase lo manda por correo; acá lo escribimos en
  // la consola, que para probar es lo mismo y más rápido.
  if (ruta === '/auth/v1/otp' && req.method === 'POST') {
    const correo = String(cuerpo.email || '').toLowerCase();
    if (!correo.includes('@')) return responder(res, 400, { msg: 'Invalid email' });

    let usuario = usuarios.get(correo);
    if (!usuario) {
      usuario = { id: nuevoId(), correo, clave: null };
      usuarios.set(correo, usuario);
    }
    usuario.codigo = String(Math.floor(100000 + Math.random() * 900000));
    console.log('  >>> CÓDIGO para ' + correo + ': ' + usuario.codigo);
    return responder(res, 200, {});
  }

  // Cambiar el código por una sesión.
  if (ruta === '/auth/v1/verify' && req.method === 'POST') {
    const usuario = usuarios.get(String(cuerpo.email || '').toLowerCase());
    if (!usuario || !usuario.codigo || usuario.codigo !== String(cuerpo.token || '')) {
      return responder(res, 403, { msg: 'Token has expired or is invalid' });
    }
    usuario.codigo = null;          // un código se usa una sola vez
    return responder(res, 200, sesionPara(usuario));
  }

  /* ---------- Lo que consulta "Probar y conectar" ---------- */

  // Supabase de verdad responde acá con la configuración pública del
  // proyecto. Nos sirve para saber si la dirección y la llave sirven.
  if (ruta === '/auth/v1/settings' && req.method === 'GET') {
    if (!req.headers.apikey) return responder(res, 401, { message: 'No API key found in request' });
    return responder(res, 200, { external: {}, disable_signup: false });
  }

  /* ---------- La tabla ---------- */
  if (ruta === '/rest/v1/estados') {
    // Para simular que a alguien se le olvidó crear la tabla:
    //   SIN_TABLA=1 node herramientas/nube-de-prueba.js
    if (process.env.SIN_TABLA) {
      return responder(res, 404, {
        message: 'relation "public.estados" does not exist', code: '42P01',
      });
    }

    const id = usuarioDe(req);

    // Sin sesión válida pero con la llave pública: es el rol anónimo.
    // Con las reglas RLS puestas, Supabase devuelve una lista vacía,
    // y eso es justo lo que revisa "Probar y conectar".
    if (!id) {
      if (req.method === 'GET' && req.headers.apikey) return responder(res, 200, []);
      return responder(res, 401, { message: 'JWT expired' });
    }

    if (req.method === 'GET') {
      const fila = filas.get(id);
      // como en Supabase con RLS: solo se ve la fila propia
      return responder(res, 200, fila ? [{ datos: fila.datos, actualizado: fila.actualizado }] : []);
    }

    if (req.method === 'POST') {
      const entrante = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
      filas.set(id, {
        datos: entrante.datos,
        actualizado: entrante.actualizado || new Date().toISOString(),
      });
      return responder(res, 201);
    }
  }

  responder(res, 404, { message: 'No existe ' + ruta });
});

servidor.listen(PUERTO, () => {
  console.log('Nube de prueba escuchando en http://localhost:' + PUERTO);
  console.log('Recuerda dejar src/config-nube.js vacío cuando termines.');
});
