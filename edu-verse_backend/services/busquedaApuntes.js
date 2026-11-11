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

// Candidatos por método antes de fusionar.
const CANDIDATOS = 20;
const K_RRF = 60;

// FROM + WHERE comunes a las dos búsquedas: el MISMO filtro de permisos y
// estado para texto y vector. $2 es siempre el usuario autenticado.
const BASE_ACCESO = `
       FROM apunte_fragmentos f
       JOIN apuntes a  ON a.apunte_id = f.apunte_id
       JOIN usuarios u ON u.usuario_id = a.usuario_id`;
const FILTRO_ACCESO = `
        a.estado_indexado = 'listo'
        AND (${condicionAcceso('a', '$2')})
        AND $2::int IS NOT NULL`;

async function porTexto(q, usuarioId) {
  if (!q) return [];
  const r = await db().query(
    `SELECT f.fragmento_id, f.texto, f.pagina, a.apunte_id, a.titulo, a.materia
       ${BASE_ACCESO},
            websearch_to_tsquery('spanish', public.f_unaccent($1)) q
      WHERE f.busqueda @@ q AND ${FILTRO_ACCESO}
      ORDER BY ts_rank(f.busqueda, q) DESC, f.fragmento_id
      LIMIT $3`,
    [q, usuarioId, CANDIDATOS]
  );
  return r.rows;
}

async function porVector(consulta, usuarioId) {
  const { vectorDisponible, embeberConsulta, aVectorSql } = require('./embeddings');
  if (!(await vectorDisponible())) return [];
  const vector = aVectorSql(await embeberConsulta(consulta));
  if (!vector) return [];
  const r = await db().query(
    `SELECT f.fragmento_id, f.texto, f.pagina, a.apunte_id, a.titulo, a.materia
       ${BASE_ACCESO}
      WHERE f.embedding IS NOT NULL AND ${FILTRO_ACCESO}
      ORDER BY f.embedding <=> $1::vector
      LIMIT $3`,
    [vector, usuarioId, CANDIDATOS]
  );
  return r.rows;
}

// Reciprocal Rank Fusion: puntaje = Σ 1 / (60 + posición) sobre cada lista
// donde aparece el fragmento. Premia lo que sale alto en ambas.
function fusionarRRF(listas, limite) {
  const puntajes = new Map();
  for (const lista of listas) {
    lista.forEach((fila, i) => {
      const previo = puntajes.get(fila.fragmento_id) || { fila, puntaje: 0 };
      previo.puntaje += 1 / (K_RRF + i + 1);
      puntajes.set(fila.fragmento_id, previo);
    });
  }
  return [...puntajes.values()]
    .sort((x, y) => y.puntaje - x.puntaje || x.fila.fragmento_id - y.fila.fragmento_id)
    .slice(0, limite)
    .map((x) => x.fila);
}

// Búsqueda híbrida: top 20 por texto (ts_rank) + top 20 por significado
// (distancia coseno), fusionados con RRF. Si no hay pgvector o modelo de
// embeddings, queda solo la parte de texto.
async function buscarApuntes({ consulta, usuarioId, limite = 5 }) {
  const texto = String(consulta || '').trim().slice(0, 300);
  if (!texto || !usuarioId) return [];

  const [filasTexto, filasVector] = await Promise.all([
    porTexto(consultaWebsearch(texto), usuarioId),
    porVector(texto, usuarioId).catch((err) => {
      console.error('⚠️  Búsqueda semántica no disponible:', err.message);
      return [];
    }),
  ]);
  const filas = fusionarRRF([filasTexto, filasVector], Math.min(Math.max(1, limite), 10));

  return filas.map((f) => ({
    apunte_id: f.apunte_id,
    titulo: f.titulo,
    materia: f.materia,
    pagina: f.pagina,
    cita: `edu-verse://apunte/${f.apunte_id}${f.pagina ? `?pagina=${f.pagina}` : ''}`,
    texto: f.texto.length > MAX_CARACTERES_FRAGMENTO ? `${f.texto.slice(0, MAX_CARACTERES_FRAGMENTO)}…` : f.texto,
  }));
}

module.exports = { buscarApuntes, consultaWebsearch, condicionAcceso, fusionarRRF, FILTRO_ACCESO };
