// Rutas del Tutor IA (montadas en /api).
// Todas requieren sesión y cada usuario solo ve y modifica SUS sesiones,
// mazos y tarjetas: los recursos ajenos responden 404 (no se revela si existen).

const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const verificarAdmin = require('../middleware/admin');
const limiteTutor = require('../middleware/limiteTutor');
const { buscarApuntes } = require('../services/busquedaApuntes');
const { ErrorIA, NIVELES, responderPregunta, generarFlashcards } = require('../services/groq');

const MAX_HISTORIAL = 10;
const MAX_MATERIAL_FLASHCARDS = 24_000;
const MAX_TEMA = 200;
const MAX_PREGUNTA = 4000;

router.use(verificarToken);

// --- utilidades -------------------------------------------------------------
const idValido = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const texto = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');

const formatoMensaje = (m) => ({
  id: m.mensaje_id,
  rol: m.rol,
  contenido: m.contenido,
  display: m.display,
  fuentes: m.fuentes || [],
  subtemas: m.subtemas || [],
  sin_busqueda: m.sin_busqueda,
  creado: m.creado,
});

const formatoTarjeta = (t) => ({ id: t.flashcard_id, frente: t.frente, reverso: t.reverso, tipo: t.tipo, orden: t.orden });

function manejarError(res, err, contexto) {
  if (err instanceof ErrorIA) {
    return res.status(err.status).json({ mensaje: err.message, codigo: err.codigo });
  }
  console.error(`❌ Tutor IA (${contexto}):`, err.message);
  return res.status(500).json({ mensaje: 'Error en el servidor del Tutor IA.' });
}

// buscar_apuntes ligado al usuario autenticado: el id sale del token y nunca
// de lo que mande la IA.
const buscadorDe = (usuarioId) => (consulta) => buscarApuntes({ consulta, usuarioId, limite: 5 });

async function sesionDelUsuario(sesionId, usuarioId, cliente = pool) {
  const r = await cliente.query(
    'SELECT * FROM tutor_sesiones WHERE sesion_id = $1 AND usuario_id = $2',
    [sesionId, usuarioId]
  );
  return r.rows[0] || null;
}

// Historial para la IA: se arma SIEMPRE desde la base de datos.
async function historialIA(sesionId) {
  const r = await pool.query(
    `SELECT rol, contenido FROM (
       SELECT mensaje_id, rol, contenido FROM tutor_mensajes
       WHERE sesion_id = $1 ORDER BY mensaje_id DESC LIMIT $2
     ) ultimos ORDER BY mensaje_id ASC`,
    [sesionId, MAX_HISTORIAL - 1]
  );
  return r.rows.map((m) => ({ role: m.rol, content: m.contenido }));
}

async function guardarIntercambio(cliente, sesionId, pregunta, respuesta) {
  const u = await cliente.query(
    `INSERT INTO tutor_mensajes (sesion_id, rol, contenido, display)
     VALUES ($1, 'user', $2, $3) RETURNING *`,
    [sesionId, pregunta.contenido, pregunta.display || null]
  );
  const a = await cliente.query(
    `INSERT INTO tutor_mensajes (sesion_id, rol, contenido, fuentes, subtemas, sin_busqueda)
     VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING *`,
    [sesionId, respuesta.contenido, JSON.stringify(respuesta.fuentes), JSON.stringify(respuesta.subtemas), respuesta.sin_busqueda]
  );
  await cliente.query('UPDATE tutor_sesiones SET actualizado = now() WHERE sesion_id = $1', [sesionId]);
  return [formatoMensaje(u.rows[0]), formatoMensaje(a.rows[0])];
}

// --- sesiones ---------------------------------------------------------------

// Lista de sesiones del usuario
router.get('/tutor/sesiones', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.sesion_id, s.tema, s.nivel, s.creado, s.actualizado,
              (SELECT COUNT(*) FROM tutor_mensajes m WHERE m.sesion_id = s.sesion_id AND m.rol = 'assistant')::int AS respuestas,
              (SELECT COUNT(*) FROM mazos z JOIN flashcards f ON f.mazo_id = z.mazo_id WHERE z.sesion_id = s.sesion_id)::int AS tarjetas
       FROM tutor_sesiones s
       WHERE s.usuario_id = $1
       ORDER BY s.actualizado DESC`,
      [req.usuario.id]
    );
    res.json(r.rows.map((s) => ({
      id: s.sesion_id, tema: s.tema, nivel: s.nivel, creado: s.creado,
      actualizado: s.actualizado, respuestas: s.respuestas, tarjetas: s.tarjetas,
    })));
  } catch (err) {
    manejarError(res, err, 'listar sesiones');
  }
});

// Crea una sesión y genera la primera respuesta
router.post('/tutor/sesiones', limiteTutor, async (req, res) => {
  const tema = texto(req.body?.tema, MAX_TEMA);
  const nivel = NIVELES[req.body?.nivel] ? req.body.nivel : 'intermedio';
  const preguntas = texto(req.body?.preguntas, MAX_PREGUNTA);
  if (tema.length < 2) return res.status(400).json({ mensaje: 'Escribe el tema que quieres estudiar.' });

  const contenido = preguntas
    ? `Quiero aprender sobre: ${tema}.\n\nTengo estas dudas concretas:\n${preguntas}`
    : `Quiero aprender sobre: ${tema}. Dame una explicación completa para empezar.`;
  const pregunta = { contenido, display: preguntas ? `${tema}\n\n${preguntas}` : tema };

  let respuesta;
  try {
    respuesta = await responderPregunta({
      tema, nivel, primera: true, historial: [{ role: 'user', content: contenido }],
      buscarApuntes: buscadorDe(req.usuario.id),
    });
  } catch (err) {
    return manejarError(res, err, 'crear sesión');
  }

  // La sesión y sus dos mensajes se guardan juntos o no se guarda nada.
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const s = await cliente.query(
      'INSERT INTO tutor_sesiones (usuario_id, tema, nivel) VALUES ($1, $2, $3) RETURNING *',
      [req.usuario.id, tema, nivel]
    );
    const sesion = s.rows[0];
    const mensajes = await guardarIntercambio(cliente, sesion.sesion_id, pregunta, respuesta);
    await cliente.query('COMMIT');
    res.status(201).json({
      id: sesion.sesion_id, tema, nivel, creado: sesion.creado, actualizado: sesion.actualizado,
      mensajes, mazo_id: null,
    });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'guardar sesión');
  } finally {
    cliente.release();
  }
});

// Sesión con todos sus mensajes
router.get('/tutor/sesiones/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });
  try {
    const sesion = await sesionDelUsuario(id, req.usuario.id);
    if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });

    const [mensajes, mazo] = await Promise.all([
      pool.query('SELECT * FROM tutor_mensajes WHERE sesion_id = $1 ORDER BY mensaje_id', [id]),
      pool.query('SELECT mazo_id FROM mazos WHERE sesion_id = $1 AND usuario_id = $2 ORDER BY mazo_id DESC LIMIT 1', [id, req.usuario.id]),
    ]);
    res.json({
      id: sesion.sesion_id, tema: sesion.tema, nivel: sesion.nivel,
      creado: sesion.creado, actualizado: sesion.actualizado,
      mensajes: mensajes.rows.map(formatoMensaje),
      mazo_id: mazo.rows[0]?.mazo_id || null,
    });
  } catch (err) {
    manejarError(res, err, 'ver sesión');
  }
});

// Pregunta de seguimiento
router.post('/tutor/sesiones/:id/mensajes', limiteTutor, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });
  const contenido = texto(req.body?.contenido, MAX_PREGUNTA);
  const display = texto(req.body?.display, 300);
  if (!contenido) return res.status(400).json({ mensaje: 'Escribe tu pregunta.' });

  try {
    const sesion = await sesionDelUsuario(id, req.usuario.id);
    if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });

    const historial = await historialIA(id);
    const respuesta = await responderPregunta({
      tema: sesion.tema,
      nivel: sesion.nivel,
      primera: historial.length === 0,
      historial: [...historial, { role: 'user', content: contenido }],
      buscarApuntes: buscadorDe(req.usuario.id),
    });

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      // La sesión pudo borrarse mientras la IA respondía.
      if (!(await sesionDelUsuario(id, req.usuario.id, cliente))) {
        await cliente.query('ROLLBACK');
        return res.status(404).json({ mensaje: 'La sesión fue eliminada.' });
      }
      const mensajes = await guardarIntercambio(cliente, id, { contenido, display }, respuesta);
      await cliente.query('COMMIT');
      res.status(201).json({ mensajes });
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      cliente.release();
    }
  } catch (err) {
    manejarError(res, err, 'pregunta');
  }
});

// Borra una sesión (sus mensajes caen en cascada; los mazos quedan sin sesión
// por ON DELETE SET NULL, así que se borran explícitamente para no dejar
// basura invisible).
router.delete('/tutor/sesiones/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `DELETE FROM mazos WHERE sesion_id = $1 AND usuario_id = $2 AND origen = 'tutor'`,
      [id, req.usuario.id]
    );
    const r = await cliente.query(
      'DELETE FROM tutor_sesiones WHERE sesion_id = $1 AND usuario_id = $2',
      [id, req.usuario.id]
    );
    if (r.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Sesión no encontrada.' });
    }
    await cliente.query('COMMIT');
    res.json({ mensaje: 'Sesión eliminada.' });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'borrar sesión');
  } finally {
    cliente.release();
  }
});

// --- flashcards -------------------------------------------------------------

// Genera (o regenera) el mazo de una sesión con lo ya investigado.
router.post('/tutor/sesiones/:id/flashcards', limiteTutor, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });

  try {
    const sesion = await sesionDelUsuario(id, req.usuario.id);
    if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada.' });

    const r = await pool.query(
      `SELECT contenido FROM tutor_mensajes WHERE sesion_id = $1 AND rol = 'assistant' ORDER BY mensaje_id DESC`,
      [id]
    );
    if (r.rows.length === 0) return res.status(400).json({ mensaje: 'La sesión todavía no tiene respuestas.' });

    // Lo más reciente primero hasta llenar el límite; luego en orden cronológico.
    const partes = [];
    let total = 0;
    for (const { contenido } of r.rows) {
      if (total + contenido.length > MAX_MATERIAL_FLASHCARDS) {
        if (partes.length === 0) partes.push(contenido.slice(0, MAX_MATERIAL_FLASHCARDS));
        break;
      }
      partes.push(contenido);
      total += contenido.length;
    }
    const material = partes.reverse().join('\n\n---\n\n');

    const tarjetas = await generarFlashcards({ tema: sesion.tema, nivel: sesion.nivel, material });

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(
        `DELETE FROM mazos WHERE sesion_id = $1 AND usuario_id = $2 AND origen = 'tutor'`,
        [id, req.usuario.id]
      );
      const m = await cliente.query(
        `INSERT INTO mazos (usuario_id, sesion_id, tema, origen) VALUES ($1, $2, $3, 'tutor') RETURNING *`,
        [req.usuario.id, id, sesion.tema]
      );
      const mazo = m.rows[0];
      const insertadas = [];
      for (const [orden, t] of tarjetas.entries()) {
        const f = await cliente.query(
          'INSERT INTO flashcards (mazo_id, frente, reverso, tipo, orden) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [mazo.mazo_id, t.frente, t.reverso, t.tipo, orden]
        );
        insertadas.push(formatoTarjeta(f.rows[0]));
      }
      await cliente.query('COMMIT');
      res.status(201).json({ id: mazo.mazo_id, tema: mazo.tema, sesion_id: id, origen: mazo.origen, creado: mazo.creado, tarjetas: insertadas });
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      cliente.release();
    }
  } catch (err) {
    manejarError(res, err, 'generar flashcards');
  }
});

// Mazo con sus tarjetas
router.get('/mazos/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
  try {
    const m = await pool.query('SELECT * FROM mazos WHERE mazo_id = $1 AND usuario_id = $2', [id, req.usuario.id]);
    if (!m.rows[0]) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
    const t = await pool.query('SELECT * FROM flashcards WHERE mazo_id = $1 ORDER BY orden, flashcard_id', [id]);
    const mazo = m.rows[0];
    res.json({
      id: mazo.mazo_id, tema: mazo.tema, sesion_id: mazo.sesion_id, origen: mazo.origen,
      creado: mazo.creado, tarjetas: t.rows.map(formatoTarjeta),
    });
  } catch (err) {
    manejarError(res, err, 'ver mazo');
  }
});

// Editar frente/reverso de una tarjeta
router.patch('/flashcards/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
  const frente = req.body?.frente === undefined ? null : texto(req.body.frente, 300);
  const reverso = req.body?.reverso === undefined ? null : texto(req.body.reverso, 1000);
  if (frente === '' || reverso === '') return res.status(400).json({ mensaje: 'La tarjeta no puede quedar vacía.' });
  if (frente === null && reverso === null) return res.status(400).json({ mensaje: 'Nada que actualizar.' });

  try {
    const r = await pool.query(
      `UPDATE flashcards f SET frente = COALESCE($1, f.frente), reverso = COALESCE($2, f.reverso)
       FROM mazos m
       WHERE f.flashcard_id = $3 AND f.mazo_id = m.mazo_id AND m.usuario_id = $4
       RETURNING f.*`,
      [frente, reverso, id, req.usuario.id]
    );
    if (!r.rows[0]) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
    res.json(formatoTarjeta(r.rows[0]));
  } catch (err) {
    manejarError(res, err, 'editar tarjeta');
  }
});

// Borrar tarjeta
router.delete('/flashcards/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
  try {
    const r = await pool.query(
      `DELETE FROM flashcards f USING mazos m
       WHERE f.flashcard_id = $1 AND f.mazo_id = m.mazo_id AND m.usuario_id = $2`,
      [id, req.usuario.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
    res.json({ mensaje: 'Tarjeta eliminada.' });
  } catch (err) {
    manejarError(res, err, 'borrar tarjeta');
  }
});

// --- indexado de apuntes (administradores) --------------------------------

// Resumen del estado del indexado de la biblioteca.
router.get('/admin/indexado', verificarAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT estado_indexado AS estado, COUNT(*)::int AS total FROM apuntes GROUP BY estado_indexado`
    );
    const errores = await pool.query(
      `SELECT apunte_id, titulo, error_indexado FROM apuntes WHERE estado_indexado = 'error' ORDER BY apunte_id`
    );
    res.json({ estados: Object.fromEntries(r.rows.map((f) => [f.estado, f.total])), errores: errores.rows });
  } catch (err) {
    manejarError(res, err, 'estado del indexado');
  }
});

// Devuelve a la cola los apuntes que quedaron en 'error'. Con { apunte_id }
// reintenta solo ese.
router.post('/admin/indexado/reintentar', verificarAdmin, async (req, res) => {
  const id = req.body?.apunte_id === undefined ? null : idValido(req.body.apunte_id);
  if (req.body?.apunte_id !== undefined && !id) return res.status(400).json({ mensaje: 'apunte_id inválido.' });
  try {
    const r = await pool.query(
      `UPDATE apuntes SET estado_indexado = 'pendiente', error_indexado = NULL
        WHERE estado_indexado = 'error' AND ($1::int IS NULL OR apunte_id = $1)`,
      [id]
    );
    await pool.query(
      'INSERT INTO admin_logs (admin_id, accion, detalle) VALUES ($1, $2, $3)',
      [req.usuario.id, 'reindexar_apuntes', id ? `Reintentó indexar el apunte ID ${id}` : `Reintentó indexar ${r.rowCount} apunte(s) con error`]
    ).catch(() => {});
    res.json({ mensaje: `${r.rowCount} apunte(s) vuelven a la cola de indexado.`, reintentados: r.rowCount });
  } catch (err) {
    manejarError(res, err, 'reintentar indexado');
  }
});

module.exports = router;
