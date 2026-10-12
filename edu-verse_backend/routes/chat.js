const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const { sanitize } = require('../middleware/sanitize');
const { filtrarTexto } = require('../middleware/profanity');

const LARGO_MAXIMO_MENSAJE = 500;

router.get('/:equipo_id', verificarToken, async (req, res) => {
  try {
    const { equipo_id } = req.params;
    const { antes } = req.query; // mensaje_id para paginación (mensajes anteriores a este)
    const usuario_id = req.usuario.id;

    const pertenece = await pool.query(
      'SELECT 1 FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
      [equipo_id, usuario_id]
    );
    if (pertenece.rows.length === 0) return res.status(403).json('No eres miembro de este equipo');

    let query = `
      SELECT m.*, u.nombre AS autor_nombre
      FROM mensajes_chat m
      JOIN usuarios u ON m.usuario_id = u.usuario_id
      WHERE m.equipo_id = $1
    `;
    const params = [equipo_id];

    if (antes) {
      // Validar que es un número entero positivo
      const antesId = parseInt(antes, 10);
      if (!isNaN(antesId) && antesId > 0) {
        query += ` AND m.mensaje_id < $2`;
        params.push(antesId);
      }
    }

    query += ` ORDER BY m.fecha_envio DESC LIMIT 100`;

    const mensajes = await pool.query(query, params);

    // Filtro en lectura: red de seguridad para mensajes guardados antes
    // de que existiera el filtro. No se persiste, solo para mostrar.
    const filtrados = mensajes.rows.map((m) => {
      const filtrado = filtrarTexto(m.texto);
      return { ...m, texto: filtrado.texto, censurado: filtrado.censurado };
    });

    // Para paginación, el frontend espera orden cronológico (ASC).
    // La query trae DESC, así que invertimos antes de responder.
    res.json(filtrados.reverse());
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al obtener mensajes');
  }
});

router.post('/enviar', verificarToken, async (req, res) => {
  try {
    const { equipo_id } = req.body;
    let { texto } = req.body;

    if (!equipo_id || !texto) return res.status(400).json('Faltan campos');

    texto = String(texto).trim();
    if (!texto) return res.status(400).json('El mensaje no puede estar vacío');
    if (texto.length > LARGO_MAXIMO_MENSAJE) {
      return res.status(400).json(`El mensaje no puede superar ${LARGO_MAXIMO_MENSAJE} caracteres`);
    }

    const usuario_id = req.usuario.id;

    const pertenece = await pool.query(
      'SELECT 1 FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
      [equipo_id, usuario_id]
    );
    if (pertenece.rows.length === 0) return res.status(403).json('No eres miembro de este equipo');

    const filtrado = filtrarTexto(texto);
    const textoFinal = sanitize(filtrado.texto);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const nuevo = await client.query(
        `INSERT INTO mensajes_chat (equipo_id, usuario_id, texto)
         VALUES ($1, $2, $3) RETURNING *`,
        [equipo_id, usuario_id, textoFinal]
      );

      const mensaje = nuevo.rows[0];

      if (filtrado.censurado) {
        try {
          await client.query('SAVEPOINT mod');
          await client.query(
            `INSERT INTO moderacion_logs (usuario_id, equipo_id, palabras_bloqueadas, sustituciones)
             VALUES ($1, $2, $3, $4)`,
            [usuario_id, equipo_id, filtrado.palabras.join(', '), filtrado.cantidad]
          );
          await client.query('RELEASE mod');
        } catch (logErr) {
          await client.query('ROLLBACK TO mod').catch(() => {});
          console.warn('No se pudo registrar en moderacion_logs:', logErr.message);
        }
      }

      await client.query('COMMIT');

      const autor = await pool.query(
        'SELECT nombre FROM usuarios WHERE usuario_id = $1',
        [usuario_id]
      );
      const mensajeConAutor = {
        ...mensaje,
        autor_nombre: autor.rows[0]?.nombre || '?'
      };

      const io = req.app.get('io');
      io?.to(`equipo-${equipo_id}`).emit('nuevo-mensaje', mensajeConAutor);

      res.status(201).json({ ...mensajeConAutor, censurado: filtrado.censurado, palabras: filtrado.palabras });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al enviar mensaje');
  }
});

module.exports = router;