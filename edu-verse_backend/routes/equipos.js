const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const { sanitize } = require('../middleware/sanitize');
const { requiereMiembro, equipoDeParametro } = require('../middleware/membresia');

const LARGO_MAX_NOMBRE = 150; // varchar(150) en la tabla

// Todas las rutas de equipos exigen sesión. En ninguna se usa el usuario_id
// del body: la identidad sale SIEMPRE del token, así nadie puede crear o
// unir equipos a nombre de otra persona.
router.use(verificarToken);

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

router.post('/crear', async (req, res) => {
  const client = await pool.connect();
  try {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) return res.status(400).json('Faltan campos');
    if (nombre.length > LARGO_MAX_NOMBRE) return res.status(400).json(`El nombre no puede superar ${LARGO_MAX_NOMBRE} caracteres`);

    let codigo;
    let existe = true;
    while (existe) {
      codigo = generarCodigo();
      const check = await client.query('SELECT 1 FROM equipos WHERE codigo_invitacion = $1', [codigo]);
      existe = check.rows.length > 0;
    }

    // Equipo + membresía del creador en UNA transacción: antes, si el segundo
    // INSERT fallaba quedaba un equipo huérfano sin ningún miembro.
    await client.query('BEGIN');
    const nuevoEquipo = await client.query(
      'INSERT INTO equipos (nombre, codigo_invitacion, creado_por) VALUES ($1, $2, $3) RETURNING *',
      [sanitize(nombre), codigo, req.usuario.id]
    );
    await client.query(
      'INSERT INTO miembros_equipo (equipo_id, usuario_id, rol) VALUES ($1, $2, $3)',
      [nuevoEquipo.rows[0].equipo_id, req.usuario.id, 'admin']
    );
    await client.query('COMMIT');

    // Se devuelve el equipo YA con `rol`: el frontend lee `equipoActivo.rol`
    // para decidir si muestra los controles de admin del chat.
    res.status(201).json({
      mensaje: 'Equipo creado',
      equipo: { ...nuevoEquipo.rows[0], rol: 'admin' },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err.message);
    res.status(500).send('Error al crear equipo');
  } finally {
    client.release();
  }
});

router.post('/unirse', async (req, res) => {
  try {
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim().toUpperCase() : '';
    if (!codigo) return res.status(400).json('Faltan campos');

    const equipo = await pool.query('SELECT * FROM equipos WHERE codigo_invitacion = $1', [codigo]);
    if (equipo.rows.length === 0) return res.status(404).json('Código no válido');

    // ON CONFLICT cubre la carrera de dos peticiones simultáneas (la PK
    // compuesta ya impide duplicados, pero antes eso terminaba en un 500).
    const insertado = await pool.query(
      `INSERT INTO miembros_equipo (equipo_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (equipo_id, usuario_id) DO NOTHING`,
      [equipo.rows[0].equipo_id, req.usuario.id]
    );
    if (insertado.rowCount === 0) return res.status(400).json('Ya eres miembro de este equipo');

    // El INSERT usa el DEFAULT de la columna ('miembro'); se devuelve `rol`
    // por la misma razón que en /crear.
    res.json({ mensaje: 'Te uniste al equipo', equipo: { ...equipo.rows[0], rol: 'miembro' } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al unirse');
  }
});

// Solo tus propios equipos: el id de la URL se conserva por compatibilidad con
// el frontend, pero debe coincidir con el del token.
router.get('/mis-equipos/:usuario_id', async (req, res) => {
  try {
    if (String(req.params.usuario_id) !== String(req.usuario.id)) {
      return res.status(403).json('No autorizado');
    }
    const resultados = await pool.query(
      `SELECT e.*, me.rol
       FROM equipos e
       JOIN miembros_equipo me ON e.equipo_id = me.equipo_id
       WHERE me.usuario_id = $1
       ORDER BY e.fecha_creacion DESC`,
      [req.usuario.id]
    );
    res.json(resultados.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener equipos');
  }
});

router.get('/:equipo_id/miembros', requiereMiembro(equipoDeParametro()), async (req, res) => {
  try {
    const miembros = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.foto_url, me.rol
       FROM miembros_equipo me
       JOIN usuarios u ON me.usuario_id = u.usuario_id
       WHERE me.equipo_id = $1`,
      [req.equipoId]
    );
    res.json(miembros.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener miembros');
  }
});

router.get('/:equipo_id', requiereMiembro(equipoDeParametro()), async (req, res) => {
  try {
    const equipo = await pool.query('SELECT * FROM equipos WHERE equipo_id = $1', [req.equipoId]);
    if (equipo.rows.length === 0) return res.status(404).json('Equipo no encontrado');
    res.json(equipo.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener equipo');
  }
});

module.exports = router;
