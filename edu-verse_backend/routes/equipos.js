const express = require('express');
const router = express.Router();
const pool = require('../db');

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

router.post('/crear', async (req, res) => {
  try {
    const { nombre, usuario_id } = req.body;
    console.log('CREAR EQUIPO - Body:', req.body, 'nombre:', nombre, 'usuario_id:', usuario_id);
    if (!nombre || !usuario_id) return res.status(400).json('Faltan campos');

    let codigo;
    let existe = true;
    while (existe) {
      codigo = generarCodigo();
      const check = await pool.query('SELECT 1 FROM equipos WHERE codigo_invitacion = $1', [codigo]);
      existe = check.rows.length > 0;
    }

    const nuevoEquipo = await pool.query(
      'INSERT INTO equipos (nombre, codigo_invitacion, creado_por) VALUES ($1, $2, $3) RETURNING *',
      [nombre, codigo, usuario_id]
    );

    await pool.query(
      'INSERT INTO miembros_equipo (equipo_id, usuario_id, rol) VALUES ($1, $2, $3)',
      [nuevoEquipo.rows[0].equipo_id, usuario_id, 'admin']
    );

    res.status(201).json({ mensaje: 'Equipo creado', equipo: nuevoEquipo.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al crear equipo');
  }
});

router.post('/unirse', async (req, res) => {
  try {
    const { codigo, usuario_id } = req.body;
    if (!codigo || !usuario_id) return res.status(400).json('Faltan campos');

    const equipo = await pool.query('SELECT * FROM equipos WHERE codigo_invitacion = $1', [codigo]);
    if (equipo.rows.length === 0) return res.status(404).json('Código no válido');

    const yaMiembro = await pool.query(
      'SELECT 1 FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
      [equipo.rows[0].equipo_id, usuario_id]
    );
    if (yaMiembro.rows.length > 0) return res.status(400).json('Ya eres miembro de este equipo');

    await pool.query(
      'INSERT INTO miembros_equipo (equipo_id, usuario_id) VALUES ($1, $2)',
      [equipo.rows[0].equipo_id, usuario_id]
    );

    res.json({ mensaje: 'Te uniste al equipo', equipo: equipo.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al unirse');
  }
});

router.get('/mis-equipos/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const resultados = await pool.query(
      `SELECT e.*, me.rol
       FROM equipos e
       JOIN miembros_equipo me ON e.equipo_id = me.equipo_id
       WHERE me.usuario_id = $1
       ORDER BY e.fecha_creacion DESC`,
      [usuario_id]
    );
    res.json(resultados.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener equipos');
  }
});

router.get('/:equipo_id/miembros', async (req, res) => {
  try {
    const { equipo_id } = req.params;
    const miembros = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.foto_url, me.rol
       FROM miembros_equipo me
       JOIN usuarios u ON me.usuario_id = u.usuario_id
       WHERE me.equipo_id = $1`,
      [equipo_id]
    );
    res.json(miembros.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener miembros');
  }
});

router.get('/:equipo_id', async (req, res) => {
  try {
    const { equipo_id } = req.params;
    const equipo = await pool.query('SELECT * FROM equipos WHERE equipo_id = $1', [equipo_id]);
    if (equipo.rows.length === 0) return res.status(404).json('Equipo no encontrado');
    res.json(equipo.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener equipo');
  }
});

module.exports = router;
