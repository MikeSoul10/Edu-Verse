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

    // LEFT JOIN a sí misma para traer el texto y el autor de la cita.
    // respuesta_texto queda NULL cuando el original fue borrado (ON DELETE SET NULL).
    let query = `
      SELECT m.*, COALESCE(u.nombre, 'Usuario eliminado') AS autor_nombre,
             u.foto_url AS autor_foto,
             r.texto AS respuesta_texto,
             ru.nombre AS respuesta_autor_nombre
      FROM mensajes_chat m
      LEFT JOIN usuarios u ON m.usuario_id = u.usuario_id
      LEFT JOIN mensajes_chat r ON m.respuesta_a = r.mensaje_id
      LEFT JOIN usuarios ru ON ru.usuario_id = r.usuario_id
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
    // La cita se filtra igual que el mensaje: si no, un texto ofensivo
    // borrado del cuerpo volvería a ser visible dentro de la respuesta.
    const filtrados = mensajes.rows.map((m) => {
      const filtrado = filtrarTexto(m.texto);
      const fila = { ...m, texto: filtrado.texto, censurado: filtrado.censurado };
      if (fila.respuesta_texto) {
        fila.respuesta_texto = filtrarTexto(fila.respuesta_texto).texto;
      }
      return fila;
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
    let respuesta_a = req.body.respuesta_a;

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

    // Validar la cita: debe existir y ser del MISMO equipo. Sin esto se podría
    // citar (y por lo tanto leer) un mensaje de un equipo ajeno. Si no es
    // válido se ignora silenciosamente y el mensaje se guarda sin cita.
    respuesta_a = parseInt(respuesta_a, 10);
    if (!Number.isNaN(respuesta_a) && respuesta_a > 0) {
      const cita = await pool.query(
        'SELECT 1 FROM mensajes_chat WHERE mensaje_id = $1 AND equipo_id = $2',
        [respuesta_a, equipo_id]
      );
      if (cita.rows.length === 0) respuesta_a = null;
    } else {
      respuesta_a = null;
    }

    const filtrado = filtrarTexto(texto);
    const textoFinal = sanitize(filtrado.texto);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const nuevo = await client.query(
        `INSERT INTO mensajes_chat (equipo_id, usuario_id, texto, respuesta_a)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [equipo_id, usuario_id, textoFinal, respuesta_a]
      );

      const mensaje = nuevo.rows[0];

      if (filtrado.censurado) {
        try {
          await client.query('SAVEPOINT mod');
          await client.query(
            `INSERT INTO moderacion_logs (usuario_id, equipo_id, palabras_bloqueadas, sustituciones, accion, detalle)
             VALUES ($1, $2, $3, $4, 'censo', NULL)`,
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
        'SELECT nombre, foto_url FROM usuarios WHERE usuario_id = $1',
        [usuario_id]
      );
      const mensajeConAutor = {
        ...mensaje,
        autor_nombre: autor.rows[0]?.nombre || '?',
        // La foto viaja en el emit por la misma razón que la cita: sin esto,
        // el mensaje en vivo llega sin avatar hasta que se recargue.
        autor_foto: autor.rows[0]?.foto_url || null
      };

      // Traemos la cita para el emit: sin esto el receptor vería la respuesta
      // sin el bloque citado hasta que recargara la conversación.
      if (respuesta_a) {
        const cita = await pool.query(
          `SELECT r.texto, u.nombre AS autor_nombre
           FROM mensajes_chat r
           LEFT JOIN usuarios u ON r.usuario_id = u.usuario_id
           WHERE r.mensaje_id = $1`,
          [respuesta_a]
        );
        mensajeConAutor.respuesta_texto = cita.rows[0]?.texto ?? null;
        mensajeConAutor.respuesta_autor_nombre = cita.rows[0]?.autor_nombre ?? null;
      }

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

// Borrado de mensajes. Solo el admin DEL EQUIPO, no el admin global de la
// plataforma: el rol de sistema vive en usuarios.rol y no da ninguna
// autoridad sobre conversaciones ajenas.
router.delete('/mensajes/:mensaje_id', verificarToken, async (req, res) => {
  try {
    const mensaje_id = parseInt(req.params.mensaje_id, 10);
    if (!Number.isInteger(mensaje_id) || mensaje_id <= 0) {
      return res.status(400).json('Mensaje inválido');
    }

    const usuario_id = req.usuario.id;

    const encontrado = await pool.query(
      'SELECT equipo_id FROM mensajes_chat WHERE mensaje_id = $1',
      [mensaje_id]
    );
    if (encontrado.rows.length === 0) return res.status(404).json('El mensaje no existe');

    const { equipo_id } = encontrado.rows[0];

    // Membresía primero, luego rol. Un 403 genérico en ambos casos para no
    // filtrar la existencia de mensajes de otros equipos.
    const miembro = await pool.query(
      'SELECT rol FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
      [equipo_id, usuario_id]
    );
    if (miembro.rows.length === 0) return res.status(403).json('No eres miembro de este equipo');
    if (miembro.rows[0].rol !== 'admin') return res.status(403).json('Solo el administrador del equipo puede borrar mensajes');

    await pool.query('DELETE FROM mensajes_chat WHERE mensaje_id = $1', [mensaje_id]);

    const io = req.app.get('io');
    io?.to(`equipo-${equipo_id}`).emit('mensaje-eliminado', { mensaje_id });

    res.json({ ok: true, mensaje_id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al borrar mensaje');
  }
});

// Vaciado completo del historial de un equipo. Solo su admin.
//
// Borrado y registro van en la MISMA transacción a propósito: si no se puede
// escribir el log, el vaciado tampoco se ejecuta. Así queda garantizado que
// nunca hay un historial borrado sin rastro de quién lo hizo.
router.delete('/historial/:equipo_id', verificarToken, async (req, res) => {
  try {
    const equipo_id = parseInt(req.params.equipo_id, 10);
    if (!Number.isInteger(equipo_id) || equipo_id <= 0) {
      return res.status(400).json('Equipo inválido');
    }

    const usuario_id = req.usuario.id;

    const miembro = await pool.query(
      'SELECT rol FROM miembros_equipo WHERE equipo_id = $1 AND usuario_id = $2',
      [equipo_id, usuario_id]
    );
    if (miembro.rows.length === 0) return res.status(403).json('No eres miembro de este equipo');
    if (miembro.rows[0].rol !== 'admin') return res.status(403).json('Solo el administrador del equipo puede vaciar el historial');

    const client = await pool.connect();
    let borrados = 0;
    try {
      await client.query('BEGIN');

      const eliminados = await client.query(
        'DELETE FROM mensajes_chat WHERE equipo_id = $1 RETURNING mensaje_id',
        [equipo_id]
      );
      borrados = eliminados.rowCount;

      await client.query(
        `INSERT INTO moderacion_logs (usuario_id, equipo_id, sustituciones, accion, detalle)
         VALUES ($1, $2, 0, 'chat_vaciado', $3)`,
        [usuario_id, equipo_id, `${borrados} mensaje(s)`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const io = req.app.get('io');
    io?.to(`equipo-${equipo_id}`).emit('chat-vaciado', { equipo_id, borrados });

    res.json({ ok: true, borrados });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al vaciar el historial');
  }
});

module.exports = router;