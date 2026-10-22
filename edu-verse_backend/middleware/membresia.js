const pool = require('../db');

const aEnteroPositivo = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Devuelve el rol del usuario dentro del equipo ('admin' | 'miembro'),
// o null si no pertenece (o si algún id no es válido).
async function obtenerRolEnEquipo(equipoId, usuarioId) {
  const equipo = aEnteroPositivo(equipoId);
  const usuario = aEnteroPositivo(usuarioId);
  if (!equipo || !usuario) return null;

  const r = await pool.query(
    'SELECT rol FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
    [equipo, usuario]
  );
  return r.rows.length ? r.rows[0].rol : null;
}

// Fábrica de middleware: exige que el usuario del token sea miembro del equipo
// que devuelva `obtenerEquipoId(req)`. Debe ir DESPUÉS de verificarToken.
// Deja `req.equipoId` y `req.rolEquipo` listos para la ruta.
//
// Si `obtenerEquipoId` devuelve null/undefined, el recurso no existe → 404.
const requiereMiembro = (obtenerEquipoId) => async (req, res, next) => {
  try {
    const equipoId = aEnteroPositivo(await obtenerEquipoId(req));
    if (!equipoId) return res.status(404).json('No encontrado');

    const rol = await obtenerRolEnEquipo(equipoId, req.usuario.id);
    if (!rol) return res.status(403).json('No eres miembro de este equipo');

    req.equipoId = equipoId;
    req.rolEquipo = rol;
    next();
  } catch (err) {
    next(err);
  }
};

// Resolutores de equipo para los casos habituales.
const equipoDeParametro = (nombre = 'equipo_id') => (req) => req.params[nombre];
const equipoDeBody = (req) => req.body?.equipo_id;

// Para rutas /tareas/:id/...: busca a qué equipo pertenece la tarea.
const equipoDeTarea = async (req) => {
  const id = aEnteroPositivo(req.params.id);
  if (!id) return null;
  const r = await pool.query('SELECT equipo_id FROM tareas WHERE tarea_id = $1', [id]);
  return r.rows.length ? r.rows[0].equipo_id : null;
};

module.exports = {
  aEnteroPositivo,
  obtenerRolEnEquipo,
  requiereMiembro,
  equipoDeParametro,
  equipoDeBody,
  equipoDeTarea,
};
