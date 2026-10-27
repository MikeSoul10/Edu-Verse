const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../config');

// Estado ACTUAL del usuario en la base de datos.
//
// El token vive 24 h, así que confiar solo en lo que dice el JWT deja huecos:
// - Un baneo solo se comprobaba al iniciar sesión, así que el usuario baneado
//   conservaba el acceso hasta que el token caducaba.
// - El rol venía del token, así que degradar a un admin no surtía efecto
//   hasta que renuevara el token.
//
// Por eso el rol se relee de la BD y el baneo se vuelve a comprobar en cada
// petición: ambas medidas surten efecto de inmediato.
async function cargarSesion(usuarioId) {
  const r = await pool.query(
    `SELECT u.usuario_id, u.nombre, u.email, u.foto_url,
            COALESCE(u.rol, 'user') AS rol,
            EXISTS (SELECT 1 FROM baneados b WHERE lower(b.email) = lower(u.email)) AS baneado
     FROM usuarios u
     WHERE u.usuario_id = $1`,
    [usuarioId]
  );
  return r.rows[0] || null;
}

// El secreto viene de config.js, la misma fuente que usa el login para firmar.
// No tiene valor por defecto y el arranque aborta si falta.
const verificarToken = async (req, res, next) => {
  const cabecera = req.header('Authorization') || '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: "Acceso denegado. No hay token." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    // 401 (no 400): el cliente interpreta 401 como sesión expirada.
    return res.status(401).json({ mensaje: "Token no válido." });
  }

  try {
    const usuario = await cargarSesion(payload.id);
    // El usuario ya no existe (fue borrado por un admin): el token caduca.
    if (!usuario) return res.status(401).json({ mensaje: "Token no válido." });
    if (usuario.baneado) {
      return res.status(403).json({ mensaje: "Tu cuenta ha sido suspendida. Contacta al administrador." });
    }

    // `id` y `nombre` vienen de la BD; el rol también, para que una
    // degradación de administrador surta efecto sin esperar al token.
    req.usuario = {
      ...payload,
      id: usuario.usuario_id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      foto_url: usuario.foto_url,
    };
    next();
  } catch (err) {
    next(err);
  }
};

// El mismo chequeo que en REST, pero para el handshake de Socket.IO: sin esto
// un baneo no cortaba el acceso en tiempo real y el rol viajaba sin revalidar.
const autenticarSocket = async (socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth?.token, JWT_SECRET, { algorithms: ['HS256'] });
    const usuario = await cargarSesion(payload.id);
    if (!usuario) return next(new Error('No autorizado'));
    if (usuario.baneado) return next(new Error('Cuenta suspendida'));

    socket.usuario = {
      id: usuario.usuario_id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
    next();
  } catch {
    next(new Error('No autorizado'));
  }
};

// Export por defecto: el middleware (las rutas hacen `require('../middleware/auth')`).
module.exports = verificarToken;
// Exportaciones con nombre para quien necesita algo más que el middleware.
module.exports.verificarToken = verificarToken;
module.exports.cargarSesion = cargarSesion;
module.exports.autenticarSocket = autenticarSocket;
