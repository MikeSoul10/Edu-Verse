const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const { sanitize } = require('../middleware/sanitize');

router.post('/crear', verificarToken, async (req, res) => {
  try {
    const { equipo_id, titulo, descripcion, prioridad, fecha_entrega, asignado_a, creado_por } = req.body;
    if (!equipo_id || !titulo) return res.status(400).json('Faltan campos obligatorios');

    const nueva = await pool.query(
      `INSERT INTO tareas (equipo_id, titulo, descripcion, prioridad, fecha_entrega, asignado_a, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [equipo_id, sanitize(titulo), sanitize(descripcion || ''), prioridad || 'verde', fecha_entrega || null, asignado_a || null, creado_por]
    );

    res.status(201).json({ mensaje: 'Tarea creada', tarea: nueva.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al crear tarea');
  }
});

router.get('/equipo/:equipo_id', async (req, res) => {
  try {
    const { equipo_id } = req.params;
    const tareas = await pool.query(
      `SELECT t.*, u.nombre AS asignado_nombre
       FROM tareas t
       LEFT JOIN usuarios u ON t.asignado_a = u.usuario_id
       WHERE t.equipo_id = $1
       ORDER BY t.fecha_creacion DESC`,
      [equipo_id]
    );
    res.json(tareas.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener tareas');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, estado, prioridad, fecha_entrega, asignado_a } = req.body;

    const actualizada = await pool.query(
      `UPDATE tareas SET
        titulo = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        estado = COALESCE($3, estado),
        prioridad = COALESCE($4, prioridad),
        fecha_entrega = COALESCE($5, fecha_entrega),
        asignado_a = $6
       WHERE tarea_id = $7 RETURNING *`,
      [titulo, descripcion, estado, prioridad, fecha_entrega, asignado_a, id]
    );

    if (actualizada.rows.length === 0) return res.status(404).json('Tarea no encontrada');
    res.json({ mensaje: 'Tarea actualizada', tarea: actualizada.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al actualizar tarea');
  }
});

router.put('/:id/mover', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const movida = await pool.query(
      'UPDATE tareas SET estado = $1 WHERE tarea_id = $2 RETURNING *',
      [estado, id]
    );

    if (movida.rows.length === 0) return res.status(404).json('Tarea no encontrada');
    res.json({ mensaje: 'Tarea movida', tarea: movida.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al mover tarea');
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tareas WHERE tarea_id = $1', [id]);
    res.json({ mensaje: 'Tarea eliminada' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al eliminar tarea');
  }
});

module.exports = router;
