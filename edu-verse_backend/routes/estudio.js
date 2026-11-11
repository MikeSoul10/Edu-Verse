// Estudio con flashcards (Tutor IA, fase 3), montado en /api:
// - Mazos: listar, ver, borrar; tarjetas: editar y borrar (solo el autor).
// - Repaso espaciado (Leitner): progreso individual por usuario.
// - Mazos compartidos con equipos: los miembros ven y estudian.
// - Flashcards generadas desde un apunte de la biblioteca.

const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middleware/auth');
const limiteTutor = require('../middleware/limiteTutor');
const { obtenerRolEnEquipo } = require('../middleware/membresia');
const { filtrarTexto } = require('../middleware/profanity');
const { sanitize } = require('../middleware/sanitize');
const { aEnteroPositivo: idValido } = require('../utils/validacion');
const { ErrorIA, generarFlashcards } = require('../services/groq');
const { condicionAcceso } = require('../services/busquedaApuntes');
const { SOLAPAMIENTO } = require('../services/fragmentos');

// Comparte el prefijo /api con routes/tutor.js, que ya verificó el token: no
// se repite la consulta a la BD si req.usuario ya está.
router.use((req, res, next) => (req.usuario ? next() : verificarToken(req, res, next)));

const MAX_MATERIAL = 24_000;

// Leitner: días hasta el próximo repaso según la caja.
const INTERVALOS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

// "Hoy" en la zona de los estudiantes (UDG), no en la del servidor (UTC):
// si no, después de las 18:00 en México las tarjetas de mañana ya "tocarían".
const ZONA = process.env.TUTOR_ZONA_HORARIA || 'America/Mexico_City';
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Un mazo es visible si el usuario es su autor o si está compartido con un
// equipo del que es miembro. `p` es el parámetro SQL con el usuario del token.
const VISIBLE = (m, p) => `(${m}.usuario_id = ${p} OR EXISTS (
    SELECT 1 FROM mazo_compartido mc JOIN miembros_equipo me ON me.equipo_id = mc.equipo_id
     WHERE mc.mazo_id = ${m}.mazo_id AND me.usuario_id = ${p}))`;

function manejarError(res, err, contexto) {
  if (err instanceof ErrorIA) return res.status(err.status).json({ mensaje: err.message, codigo: err.codigo });
  console.error(`❌ Estudio (${contexto}):`, err.message);
  return res.status(500).json({ mensaje: 'Error en el servidor.' });
}

const formatoTarjeta = (t) => ({
  id: t.flashcard_id,
  frente: t.frente,
  reverso: t.reverso,
  tipo: t.tipo,
  orden: t.orden,
  apunte_id: t.apunte_id ?? null,
  pagina: t.pagina ?? null,
  caja: t.caja ?? 1,
  proximo_repaso: t.proximo_repaso ?? null,
});

// Mazos visibles para el usuario con sus estadísticas de repaso (de ESE
// usuario). Filtra por id o por apunte si se indica.
async function consultarMazos(usuarioId, { mazoId = null, apunteId = null } = {}) {
  const r = await pool.query(
    `SELECT m.mazo_id, m.tema, m.origen, m.sesion_id, m.apunte_id, m.creado,
            m.usuario_id = $1 AS es_autor, u.nombre AS autor, a.titulo AS apunte_titulo,
            est.total, est.pendientes, est.c1, est.c2, est.c3, est.c4, est.c5,
            (SELECT COALESCE(json_agg(json_build_object('equipo_id', e.equipo_id, 'nombre', e.nombre) ORDER BY e.nombre), '[]')
               FROM mazo_compartido mc JOIN equipos e ON e.equipo_id = mc.equipo_id
              WHERE mc.mazo_id = m.mazo_id
                -- El autor ve todos los equipos; un miembro, solo los suyos.
                AND (m.usuario_id = $1 OR EXISTS (
                     SELECT 1 FROM miembros_equipo me WHERE me.equipo_id = mc.equipo_id AND me.usuario_id = $1))
            ) AS equipos
       FROM mazos m
       JOIN usuarios u ON u.usuario_id = m.usuario_id
       LEFT JOIN apuntes a ON a.apunte_id = m.apunte_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE COALESCE(r.proximo_repaso, $2::date) <= $2::date)::int AS pendientes,
                COUNT(*) FILTER (WHERE COALESCE(r.caja, 1) = 1)::int AS c1,
                COUNT(*) FILTER (WHERE r.caja = 2)::int AS c2,
                COUNT(*) FILTER (WHERE r.caja = 3)::int AS c3,
                COUNT(*) FILTER (WHERE r.caja = 4)::int AS c4,
                COUNT(*) FILTER (WHERE r.caja = 5)::int AS c5
           FROM flashcards f
           LEFT JOIN repasos r ON r.flashcard_id = f.flashcard_id AND r.usuario_id = $1
          WHERE f.mazo_id = m.mazo_id
       ) est ON TRUE
      WHERE ${VISIBLE('m', '$1')}
        AND ($3::int IS NULL OR m.mazo_id = $3)
        AND ($4::int IS NULL OR m.apunte_id = $4)
      ORDER BY m.creado DESC`,
    [usuarioId, hoy(), mazoId, apunteId]
  );
  return r.rows.map((m) => ({
    id: m.mazo_id,
    tema: m.tema,
    origen: m.origen,
    sesion_id: m.es_autor ? m.sesion_id : null,   // la sesión del autor es privada
    apunte_id: m.apunte_id,
    apunte_titulo: m.apunte_titulo,
    creado: m.creado,
    es_autor: m.es_autor,
    autor: m.autor,
    total: m.total,
    pendientes_hoy: m.pendientes,
    cajas: [m.c1, m.c2, m.c3, m.c4, m.c5],
    equipos: m.equipos,
  }));
}

async function mazoCompleto(mazoId, usuarioId) {
  const [mazo] = await consultarMazos(usuarioId, { mazoId });
  if (!mazo) return null;
  const t = await pool.query(
    `SELECT f.*, r.caja, to_char(r.proximo_repaso, 'YYYY-MM-DD') AS proximo_repaso
       FROM flashcards f
       LEFT JOIN repasos r ON r.flashcard_id = f.flashcard_id AND r.usuario_id = $2
      WHERE f.mazo_id = $1
      ORDER BY f.orden, f.flashcard_id`,
    [mazoId, usuarioId]
  );
  return { ...mazo, tarjetas: t.rows.map(formatoTarjeta) };
}

// --- mazos ------------------------------------------------------------------

// Mazos propios y compartidos conmigo. ?apunte_id=n filtra por apunte.
router.get('/mazos', async (req, res) => {
  const apunteId = req.query.apunte_id === undefined ? null : idValido(req.query.apunte_id);
  try {
    res.json(await consultarMazos(req.usuario.id, { apunteId }));
  } catch (err) {
    manejarError(res, err, 'listar mazos');
  }
});

router.get('/mazos/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
  try {
    const mazo = await mazoCompleto(id, req.usuario.id);
    if (!mazo) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
    res.json(mazo);
  } catch (err) {
    manejarError(res, err, 'ver mazo');
  }
});

// Borrar un mazo (solo el autor).
router.delete('/mazos/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
  try {
    const r = await pool.query('DELETE FROM mazos WHERE mazo_id = $1 AND usuario_id = $2', [id, req.usuario.id]);
    if (r.rowCount === 0) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
    res.json({ mensaje: 'Mazo eliminado.' });
  } catch (err) {
    manejarError(res, err, 'borrar mazo');
  }
});

// --- tarjetas (solo el autor del mazo edita) ----------------------------------

router.patch('/flashcards/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
  const limpiar = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const frente = req.body?.frente === undefined ? null : limpiar(req.body.frente, 300);
  const reverso = req.body?.reverso === undefined ? null : limpiar(req.body.reverso, 1000);
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
    const rep = await pool.query(
      `SELECT caja, to_char(proximo_repaso, 'YYYY-MM-DD') AS proximo_repaso FROM repasos WHERE flashcard_id = $1 AND usuario_id = $2`,
      [id, req.usuario.id]
    );
    res.json(formatoTarjeta({ ...r.rows[0], ...rep.rows[0] }));
  } catch (err) {
    manejarError(res, err, 'editar tarjeta');
  }
});

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

// --- repaso espaciado (Leitner) -----------------------------------------------

// { resultado: 'sabia' | 'repasar' }. "Lo sabía" sube una caja (máx. 5);
// "Repasar" vuelve a la 1. El próximo repaso depende de la caja nueva.
router.post('/flashcards/:id/repaso', async (req, res) => {
  const id = idValido(req.params.id);
  const resultado = req.body?.resultado;
  if (!id) return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
  if (!['sabia', 'repasar'].includes(resultado)) return res.status(400).json({ mensaje: 'resultado debe ser "sabia" o "repasar".' });

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const visible = await cliente.query(
      `SELECT 1 FROM flashcards f JOIN mazos m ON m.mazo_id = f.mazo_id
        WHERE f.flashcard_id = $1 AND ${VISIBLE('m', '$2')}`,
      [id, req.usuario.id]
    );
    if (visible.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Tarjeta no encontrada.' });
    }

    const previo = await cliente.query(
      'SELECT caja FROM repasos WHERE flashcard_id = $1 AND usuario_id = $2 FOR UPDATE',
      [id, req.usuario.id]
    );
    const cajaActual = previo.rows[0]?.caja ?? 1;
    const caja = resultado === 'sabia' ? Math.min(cajaActual + 1, 5) : 1;
    const proximo = sumarDias(hoy(), INTERVALOS[caja]);
    const sabia = resultado === 'sabia' ? 1 : 0;

    await cliente.query(
      `INSERT INTO repasos (flashcard_id, usuario_id, caja, proximo_repaso, aciertos, fallos, ultimo_repaso)
       VALUES ($1, $2, $3, $4::date, $5, $6, now())
       ON CONFLICT (flashcard_id, usuario_id) DO UPDATE
         SET caja = EXCLUDED.caja,
             proximo_repaso = EXCLUDED.proximo_repaso,
             aciertos = repasos.aciertos + EXCLUDED.aciertos,
             fallos = repasos.fallos + EXCLUDED.fallos,
             ultimo_repaso = now()`,
      [id, req.usuario.id, caja, proximo, sabia, 1 - sabia]
    );
    await cliente.query('COMMIT');
    res.json({ id, caja, proximo_repaso: proximo });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'registrar repaso');
  } finally {
    cliente.release();
  }
});

// Tarjetas que tocan hoy (proximo_repaso <= hoy, o nuevas) de todos los mazos
// visibles. ?conteo=1 devuelve solo { total }.
router.get('/repasos/hoy', async (req, res) => {
  const filtro = `
       FROM flashcards f
       JOIN mazos m ON m.mazo_id = f.mazo_id
       LEFT JOIN repasos r ON r.flashcard_id = f.flashcard_id AND r.usuario_id = $1
      WHERE ${VISIBLE('m', '$1')}
        AND COALESCE(r.proximo_repaso, $2::date) <= $2::date`;
  try {
    if (req.query.conteo) {
      const r = await pool.query(`SELECT COUNT(*)::int AS total ${filtro}`, [req.usuario.id, hoy()]);
      return res.json({ total: r.rows[0].total, fecha: hoy() });
    }
    const r = await pool.query(
      `SELECT f.*, r.caja, to_char(r.proximo_repaso, 'YYYY-MM-DD') AS proximo_repaso, m.mazo_id, m.tema AS mazo_tema
         ${filtro}
        ORDER BY r.proximo_repaso NULLS LAST, m.mazo_id, f.orden
        LIMIT 200`,
      [req.usuario.id, hoy()]
    );
    res.json({
      fecha: hoy(),
      tarjetas: r.rows.map((t) => ({ ...formatoTarjeta(t), mazo_id: t.mazo_id, mazo_tema: t.mazo_tema })),
    });
  } catch (err) {
    manejarError(res, err, 'repasos de hoy');
  }
});

// --- compartir con equipos ------------------------------------------------------

router.post('/mazos/:id/compartir', async (req, res) => {
  const id = idValido(req.params.id);
  const equipoId = idValido(req.body?.equipo_id);
  if (!id) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
  if (!equipoId) return res.status(400).json({ mensaje: 'Elige un equipo.' });

  try {
    const m = await pool.query(
      `SELECT m.mazo_id, m.tema, (SELECT COUNT(*) FROM flashcards f WHERE f.mazo_id = m.mazo_id)::int AS total
         FROM mazos m WHERE m.mazo_id = $1 AND m.usuario_id = $2`,
      [id, req.usuario.id]
    );
    if (!m.rows[0]) return res.status(404).json({ mensaje: 'Mazo no encontrado.' });
    if (!(await obtenerRolEnEquipo(equipoId, req.usuario.id))) {
      return res.status(403).json({ mensaje: 'Solo puedes compartir con equipos de los que eres miembro.' });
    }

    const nuevo = await pool.query(
      `INSERT INTO mazo_compartido (mazo_id, equipo_id, compartido_por) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING mazo_id`,
      [id, equipoId, req.usuario.id]
    );

    // Aviso en el chat del equipo, con el mismo filtro y sanitizado que los
    // mensajes normales (el tema del mazo lo escribió un usuario).
    if (nuevo.rows.length) {
      try {
        const { tema, total } = m.rows[0];
        const textoAviso = sanitize(filtrarTexto(
          `🃏 Compartí el mazo de flashcards «${tema}» (${total} tarjetas). Encuéntralo en Tutor IA → Mis mazos.`
        ).texto);
        const msg = await pool.query(
          'INSERT INTO mensajes_chat (equipo_id, usuario_id, texto) VALUES ($1, $2, $3) RETURNING *',
          [equipoId, req.usuario.id, textoAviso]
        );
        req.app.get('io')?.to(`equipo-${equipoId}`).emit('nuevo-mensaje', {
          ...msg.rows[0],
          autor_nombre: req.usuario.nombre,
          autor_foto: req.usuario.foto_url || null,
        });
      } catch (err) {
        console.warn('No se pudo avisar en el chat del equipo:', err.message);
      }
    }

    const [mazo] = await consultarMazos(req.usuario.id, { mazoId: id });
    res.status(nuevo.rows.length ? 201 : 200).json({ equipos: mazo?.equipos || [] });
  } catch (err) {
    manejarError(res, err, 'compartir mazo');
  }
});

router.delete('/mazos/:id/compartir/:equipoId', async (req, res) => {
  const id = idValido(req.params.id);
  const equipoId = idValido(req.params.equipoId);
  if (!id || !equipoId) return res.status(404).json({ mensaje: 'No encontrado.' });
  try {
    const r = await pool.query(
      `DELETE FROM mazo_compartido mc USING mazos m
        WHERE mc.mazo_id = m.mazo_id AND mc.mazo_id = $1 AND mc.equipo_id = $2 AND m.usuario_id = $3`,
      [id, equipoId, req.usuario.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ mensaje: 'No encontrado.' });
    const [mazo] = await consultarMazos(req.usuario.id, { mazoId: id });
    res.json({ equipos: mazo?.equipos || [] });
  } catch (err) {
    manejarError(res, err, 'dejar de compartir');
  }
});

// --- flashcards desde un apunte ---------------------------------------------------

// Junta los fragmentos del apunte marcando la página de cada uno con
// "[pág. n]". El solapamiento solo existe entre fragmentos consecutivos de la
// MISMA página (los fragmentos no cruzan páginas), y solo ahí se quita.
function armarMaterial(fragmentos) {
  let previo = null;
  return fragmentos.map((f) => {
    let texto = f.texto;
    if (previo && f.orden === previo.orden + 1 && f.pagina === previo.pagina) {
      texto = texto.split(' ').slice(SOLAPAMIENTO).join(' ');
    }
    previo = f;
    return f.pagina ? `[pág. ${f.pagina}] ${texto}` : texto;
  }).join('\n\n');
}

// { pagina_desde?, pagina_hasta? }. Si el apunte es muy largo y no se indica
// rango, responde 422 con las páginas disponibles para que el usuario elija.
router.post('/apuntes/:id/flashcards', limiteTutor, async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(404).json({ mensaje: 'Apunte no encontrado.' });
  const desde = req.body?.pagina_desde == null ? null : idValido(req.body.pagina_desde);
  const hasta = req.body?.pagina_hasta == null ? null : idValido(req.body.pagina_hasta);
  if ((req.body?.pagina_desde != null && !desde) || (req.body?.pagina_hasta != null && !hasta) || (desde && hasta && desde > hasta)) {
    return res.status(400).json({ mensaje: 'Rango de páginas inválido.' });
  }

  try {
    // Permiso de lectura: la MISMA regla que la biblioteca y el tutor.
    const a = await pool.query(
      `SELECT a.apunte_id, a.titulo, a.materia, a.estado_indexado
         FROM apuntes a JOIN usuarios u ON u.usuario_id = a.usuario_id
        WHERE a.apunte_id = $1 AND (${condicionAcceso('a', '$2')}) AND $2::int IS NOT NULL`,
      [id, req.usuario.id]
    );
    const apunte = a.rows[0];
    if (!apunte) return res.status(404).json({ mensaje: 'Apunte no encontrado.' });
    if (apunte.estado_indexado !== 'listo') {
      return res.status(409).json({
        mensaje: apunte.estado_indexado === 'error'
          ? 'No se pudo leer el texto de este apunte, así que no se pueden generar flashcards.'
          : 'El apunte todavía se está procesando. Intenta en unos segundos.',
        codigo: 'no_indexado',
        estado: apunte.estado_indexado,
      });
    }

    const todos = (await pool.query(
      'SELECT orden, pagina, texto FROM apunte_fragmentos WHERE apunte_id = $1 ORDER BY orden',
      [id]
    )).rows;
    const paginasDoc = todos.map((f) => f.pagina).filter(Boolean);
    const rango = paginasDoc.length ? { min: Math.min(...paginasDoc), max: Math.max(...paginasDoc) } : null;

    const seleccion = todos.filter((f) =>
      f.pagina == null || ((desde == null || f.pagina >= desde) && (hasta == null || f.pagina <= hasta)));
    if (seleccion.length === 0) return res.status(400).json({ mensaje: 'No hay texto en ese rango de páginas.' });

    const material = armarMaterial(seleccion);
    if (material.length > MAX_MATERIAL) {
      return res.status(422).json({
        mensaje: desde || hasta
          ? 'El rango elegido sigue siendo muy largo. Elige menos páginas.'
          : 'El apunte es muy largo para generar todas las tarjetas de una vez. Elige un rango de páginas.',
        codigo: 'muy_largo',
        paginas: rango,
      });
    }

    // Páginas que la IA puede citar: las del rango enviado.
    let paginasValidas = null;
    if (rango) {
      paginasValidas = new Set();
      for (let p = desde || rango.min; p <= (hasta || rango.max); p++) paginasValidas.add(p);
    }

    const tarjetas = await generarFlashcards({
      tema: `${apunte.titulo} (${apunte.materia})`,
      nivel: 'intermedio',
      material,
      paginasValidas: paginasValidas || new Set(),
    });

    const cliente = await pool.connect();
    let mazoId;
    try {
      await cliente.query('BEGIN');
      // Un mazo por usuario y apunte: generar de nuevo reemplaza el anterior.
      await cliente.query(
        `DELETE FROM mazos WHERE usuario_id = $1 AND apunte_id = $2 AND origen = 'apunte'`,
        [req.usuario.id, id]
      );
      const m = await cliente.query(
        `INSERT INTO mazos (usuario_id, tema, origen, apunte_id) VALUES ($1, $2, 'apunte', $3) RETURNING mazo_id`,
        [req.usuario.id, apunte.titulo, id]
      );
      mazoId = m.rows[0].mazo_id;
      for (const [orden, t] of tarjetas.entries()) {
        await cliente.query(
          `INSERT INTO flashcards (mazo_id, frente, reverso, tipo, orden, apunte_id, pagina)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [mazoId, t.frente, t.reverso, t.tipo, orden, id, t.pagina ?? null]
        );
      }
      await cliente.query('COMMIT');
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      cliente.release();
    }

    res.status(201).json(await mazoCompleto(mazoId, req.usuario.id));
  } catch (err) {
    manejarError(res, err, 'flashcards de apunte');
  }
});

module.exports = router;
module.exports.armarMaterial = armarMaterial;
module.exports.sumarDias = sumarDias;
module.exports.INTERVALOS = INTERVALOS;
