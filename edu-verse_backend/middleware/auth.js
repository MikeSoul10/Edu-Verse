const jwt = require('jsonwebtoken');

// El secreto se lee en cada petición (no al cargar el módulo) y NO tiene valor
// por defecto: index.js aborta el arranque si falta JWT_SECRET, así que firmar
// y verificar siempre usan el mismo valor.
const verificarToken = (req, res, next) => {
  const cabecera = req.header('Authorization') || '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: "Acceso denegado. No hay token." });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    // 401 (no 400): el cliente interpreta 401 como sesión expirada.
    res.status(401).json({ mensaje: "Token no válido." });
  }
};

module.exports = verificarToken;
