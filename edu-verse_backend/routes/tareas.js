const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const { sanitize } = require('../middleware/sanitize');
const {
  obtenerRolEnEquipo,
  requiereMiembro,
  equipoDeBody,
  equipoDeTarea,
} = require('../middleware/membresia');

const ESTADOS = ['pendiente', 'en_progreso', 'completada'];
const PRIORIDADES = ['verde', 'amarillo', 'rojo'];
const LARGO_MAX_TITULO = 200; // varchar(200) en la tabla

// Todas las rutas de tareas exigen sesión.
router.use(verificarToken);

// Siempre devolvemos la tarea con la misma forma (t.* + asignado_nombre), tanto
// al crear como al mover o editar. Con un RETURNING * pelado, la tarjeta
// perdía el nombre del asignado hasta recargar la página.
const SELECT_TAREA = `
  SELECT t.*, u.nombre AS asignado_nombre
  FROM tareas t
  LEFT JOIN usuarios u ON t.asignado_a = u.usuario_id
  WHERE t.tarea_id = $1`;

// El servidor es el ÚNICO que emite eventos de tareas, y solo después de
// escribir en la base. Antes los emitía el cliente y el servidor los
// retransmitía sin validar, así que cualquiera podía falsificarlos.
const emitir = (req, equipoId, evento, datos) => {
  req.app.get('io')?.to(`equipo-${equipoId}`).emit(evento, datos);
};

// Valida que el asignado (si viene) sea miembro del mismo equipo.
async function asignadoValido(equipoId, asignadoA) {
  if (asignadoA === null || asignadoA === undefined || asignadoA === '') return true;
  return (await obtenerRolEnEquipo(equipoId, asignadoA)) !== null;
}

router.post('/crear', requiereMiembro(equipoDeBody), async (req, res) => {
  try {
    const { titulo, descripcion, prioridad, fecha_entrega, asignado_a } = req.body;
    const equipo_id = req.equipoId;

    if (typeof titulo !== 'string' || !titulo.trim()) return res.status(400).json('Faltan campos obligatorios');
    if (titulo.trim().length > LARGO_MAX_TITULO) return res.status(400).json(`El título no puede superar ${LARGO_MAX_TITULO} caracteres`);
    if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json('Prioridad no válida');
    if (!(await asignadoValido(equipo_id, asignado_a))) return res.status(400).json('El asignado debe ser miembro del equipo');

    // creado_por sale del token: el cliente ya no puede firmar por otra persona.
    const insertada = await pool.query(
      `INSERT INTO tareas (equipo_id, titulo, descripcion, prioridad, fecha_entrega, asignado_a, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING tarea_id`,
      [equipo_id, sanitize(titulo.trim()), sanitize(descripcion || ''), prioridad || 'verde', fecha_entrega || null, asignado_a || null, req.usuario.id]
    );
    const tarea = (await pool.query(SELECT_TAREA, [insertada.rows[0].tarea_id])).rows[0];

    emitir(req, equipo_id, 'tarea-creada', { equipo_id, tarea });
    res.status(201).json({ mensaje: 'Tarea creada', tarea });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al crear tarea');
  }
});

router.get('/equipo/:equipo_id', requiereMiembro((req) => req.params.equipo_id), async (req, res) => {
  try {
    const tareas = await pool.query(
      `SELECT t.*, u.nombre AS asignado_nombre
       FROM tareas t
       LEFT JOIN usuarios u ON t.asignado_a = u.usuario_id
       WHERE t.equipo_id = $1
       ORDER BY t.fecha_creacion DESC`,
      [req.equipoId]
    );
    res.json(tareas.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener tareas');
  }
});

// Edición parcial: solo se tocan los campos que vienen en el body. Así
// `asignado_a: null` SÍ desasigna y omitirlo NO borra al asignado, y se puede
// vaciar la fecha o la descripción (con COALESCE no se podía).
router.put('/:id', requiereMiembro(equipoDeTarea), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const sets = [];
    const valores = [];
    const agregar = (columna, valor) => {
      valores.push(valor);
      sets.push(`${columna} = $${valores.length}`);
    };

    if ('titulo' in body) {
      if (typeof body.titulo !== 'string' || !body.titulo.trim()) return res.status(400).json('El título no puede estar vacío');
      if (body.titulo.trim().length > LARGO_MAX_TITULO) return res.status(400).json(`El título no puede superar ${LARGO_MAX_TITULO} caracteres`);
      agregar('titulo', sanitize(body.titulo.trim()));
    }
    if ('descripcion' in body) agregar('descripcion', sanitize(body.descripcion || ''));
    if ('estado' in body) {
      if (!ESTADOS.includes(body.estado)) return res.status(400).json('Estado no válido');
      agregar('estado', body.estado);
    }
    if ('prioridad' in body) {
      if (!PRIORIDADES.includes(body.prioridad)) return res.status(400).json('Prioridad no válida');
      agregar('prioridad', body.prioridad);
    }
    if ('fecha_entrega' in body) agregar('fecha_entrega', body.fecha_entrega || null);
    if ('asignado_a' in body) {
      if (!(await asignadoValido(req.equipoId, body.asignado_a))) return res.status(400).json('El asignado debe ser miembro del equipo');
      agregar('asignado_a', body.asignado_a || null);
    }

    if (sets.length === 0) return res.status(400).json('No hay cambios que guardar');

    valores.push(id);
    await pool.query(`UPDATE tareas SET ${sets.join(', ')} WHERE tarea_id = $${valores.length}`, valores);

    const tarea = (await pool.query(SELECT_TAREA, [id])).rows[0];
    emitir(req, req.equipoId, 'tarea-editada', { equipo_id: req.equipoId, tarea });
    res.json({ mensaje: 'Tarea actualizada', tarea });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al actualizar tarea');
  }
});

router.put('/:id/mover', requiereMiembro(equipoDeTarea), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    if (!ESTADOS.includes(estado)) return res.status(400).json('Estado no válido');

    await pool.query('UPDATE tareas SET estado = $1 WHERE tarea_id = $2', [estado, id]);
    const tarea = (await pool.query(SELECT_TAREA, [id])).rows[0];

    emitir(req, req.equipoId, 'tarea-movida', { equipo_id: req.equipoId, tarea });
    res.json({ mensaje: 'Tarea movida', tarea });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al mover tarea');
  }
});

// Hoy cualquier miembro puede borrar. Restringirlo al admin del equipo es del
// Sprint 2 (roles): aquí queda `req.rolEquipo` disponible para hacerlo.
router.delete('/:id', requiereMiembro(equipoDeTarea), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM tareas WHERE tarea_id = $1', [id]);
    emitir(req, req.equipoId, 'tarea-eliminada', { equipo_id: req.equipoId, tarea_id: id });
    res.json({ mensaje: 'Tarea eliminada' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al eliminar tarea');
  }
});

// Comentarios por tarea
router.get('/:id/comentarios', requiereMiembro(equipoDeTarea), async (req, res) => {
  try {
    const comentarios = await pool.query(
      `SELECT ct.*, u.nombre AS autor_nombre
       FROM comentarios_tarea ct
       JOIN usuarios u ON ct.usuario_id = u.usuario_id
       WHERE ct.tarea_id = $1
       ORDER BY ct.fecha ASC`,
      [Number(req.params.id)]
    );
    res.json(comentarios.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener comentarios');
  }
});

router.post('/:id/comentarios', requiereMiembro(equipoDeTarea), async (req, res) => {
  try {
    const tarea_id = Number(req.params.id);
    const { texto } = req.body || {};
    if (typeof texto !== 'string' || !texto.trim()) return res.status(400).json('Comentario vacío');

    const nuevo = await pool.query(
      `INSERT INTO comentarios_tarea (tarea_id, usuario_id, texto)
       VALUES ($1, $2, $3) RETURNING comentario_id`,
      [tarea_id, req.usuario.id, sanitize(texto)]
    );

    const comentario = (await pool.query(
      `SELECT ct.*, u.nombre AS autor_nombre
       FROM comentarios_tarea ct
       JOIN usuarios u ON ct.usuario_id = u.usuario_id
       WHERE ct.comentario_id = $1`,
      [nuevo.rows[0].comentario_id]
    )).rows[0];

    emitir(req, req.equipoId, 'comentario-nuevo', { equipo_id: req.equipoId, tarea_id, comentario });
    res.status(201).json(comentario);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al agregar comentario');
  }
});

module.exports = router;
