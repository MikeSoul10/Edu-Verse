const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const { sanitize } = require('../middleware/sanitize');

router.get('/:equipo_id', async (req, res) => {
  try {
    const { equipo_id } = req.params;
    const mensajes = await pool.query(
      `SELECT m.*, u.nombre AS autor_nombre
       FROM mensajes_chat m
       JOIN usuarios u ON m.usuario_id = u.usuario_id
       WHERE m.equipo_id = $1
       ORDER BY m.fecha_envio ASC
       LIMIT 100`,
      [equipo_id]
    );
    res.json(mensajes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener mensajes');
  }
});

router.post('/enviar', verificarToken, async (req, res) => {
  try {
    const { equipo_id, usuario_id, texto } = req.body;
    if (!equipo_id || !usuario_id || !texto) return res.status(400).json('Faltan campos');

    const nuevo = await pool.query(
      `INSERT INTO mensajes_chat (equipo_id, usuario_id, texto)
       VALUES ($1, $2, $3) RETURNING *`,
      [equipo_id, usuario_id, sanitize(texto)]
    );

    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al enviar mensaje');
  }
});

module.exports = router;
