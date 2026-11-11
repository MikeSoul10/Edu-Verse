// Búsqueda de texto completo en los apuntes indexados, para el Tutor IA.

// La BD se carga al buscar (no al importar) para que las funciones puras se
// puedan probar sin conexión.
const db = () => require('../db');

const MAX_CARACTERES_FRAGMENTO = 1500;
const MAX_TERMINOS = 12;

// REGLAS DE ACCESO A UN APUNTE — la única fuente para el tutor.
//
// Hoy la biblioteca de Edu-Verse es pública para cualquier usuario: GET
// /apuntes, /apuntes/buscar, /apuntes/:id y /apuntes/detalle/:id devuelven
// cualquier apunte sin filtrar por dueño, y la subida avisa "el apunte queda
// visible para toda la comunidad". No existen apuntes privados ni por equipo.
// Por eso la condición es simplemente que el apunte exista con su autor (el
// mismo JOIN con usuarios que usa la biblioteca).
//
// ⚠️ Si algún día se agregan apuntes privados o por equipo, la regla nueva
// debe ir AQUÍ (y en la biblioteca), usando `usuarioId`, que siempre viene del
// token del usuario autenticado y nunca de la IA.
function condicionAcceso(/* alias, parametroUsuario */) {
  return 'TRUE';
}

// La IA manda palabras clave; se unen con OR para no exigir que todas
// aparezcan en el mismo fragmento (ts_rank ordena por cuántas coinciden).
function consultaWebsearch(consulta) {
  const terminos = String(consulta || '')
    .replace(/["'()\-:!&|<>*]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^(or|and)$/i.test(t))
    .slice(0, MAX_TERMINOS);
  return terminos.join(' or ');
}

async function buscarApuntes({ consulta, usuarioId, limite = 5 }) {
  const q = consultaWebsearch(consulta);
  if (!q || !usuarioId) return [];

  const r = await db().query(
    `SELECT f.fragmento_id, f.texto, f.pagina, a.apunte_id, a.titulo, a.materia,
            ts_rank(f.busqueda, q) AS relevancia
       FROM apunte_fragmentos f
       JOIN apuntes a  ON a.apunte_id = f.apunte_id
       JOIN usuarios u ON u.usuario_id = a.usuario_id,
            websearch_to_tsquery('spanish', public.f_unaccent($1)) q
      WHERE f.busqueda @@ q
        AND a.estado_indexado = 'listo'
        AND (${condicionAcceso('a', '$2')})
        AND $2::int IS NOT NULL
      ORDER BY relevancia DESC, f.fragmento_id
      LIMIT $3`,
    [q, usuarioId, Math.min(Math.max(1, limite), 10)]
  );

  return r.rows.map((f) => ({
    apunte_id: f.apunte_id,
    titulo: f.titulo,
    materia: f.materia,
    pagina: f.pagina,
    cita: `edu-verse://apunte/${f.apunte_id}${f.pagina ? `?pagina=${f.pagina}` : ''}`,
    texto: f.texto.length > MAX_CARACTERES_FRAGMENTO ? `${f.texto.slice(0, MAX_CARACTERES_FRAGMENTO)}…` : f.texto,
  }));
}

module.exports = { buscarApuntes, consultaWebsearch, condicionAcceso };
