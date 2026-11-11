// Embeddings locales y gratuitos para la búsqueda semántica en apuntes.
//
// Modelo: Xenova/multilingual-e5-small (384 dimensiones, multilingüe) con
// @huggingface/transformers. Corre en el propio proceso: sin API externa.
// - Requiere prefijos: "passage: " al indexar y "query: " al buscar.
// - Vectores normalizados (mean pooling + normalize) -> distancia coseno.
// - El modelo (~120 MB) se descarga una vez a MODELOS_CACHE (volumen de
//   Docker) y después carga en ~1 s.
// - Su binario nativo (onnxruntime-node) NO funciona en Alpine (musl): por eso
//   la imagen del backend usa node:20-bookworm-slim.
//
// Si el modelo o pgvector no están disponibles, todo sigue funcionando con
// búsqueda solo por texto: estas funciones devuelven null.

const os = require('os');
const path = require('path');

const MODELO = 'Xenova/multilingual-e5-small';
const DIMENSIONES = 384;
const LOTE = 8;

const db = () => require('../db');

let extractor = null;
let cargando = null;
let deshabilitado = false;

async function obtenerExtractor() {
  if (deshabilitado) return null;
  if (extractor) return extractor;
  if (!cargando) {
    cargando = (async () => {
      const inicio = Date.now();
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = process.env.MODELOS_CACHE || path.join(os.tmpdir(), 'eduverse-modelos');
      const e = await pipeline('feature-extraction', MODELO, { dtype: 'q8' });
      console.log(`🧠 Modelo de embeddings listo en ${((Date.now() - inicio) / 1000).toFixed(1)} s (${env.cacheDir}).`);
      return e;
    })()
      .then((e) => { extractor = e; return e; })
      .catch((err) => {
        // Se deshabilita para no reintentar en cada búsqueda; un reinicio lo
        // vuelve a intentar.
        deshabilitado = true;
        console.error('❌ No se pudo cargar el modelo de embeddings; la búsqueda será solo por texto:', err.message);
        return null;
      })
      .finally(() => { cargando = null; });
  }
  return cargando;
}

async function embeber(textos) {
  const e = await obtenerExtractor();
  if (!e) return null;
  const salida = [];
  for (let i = 0; i < textos.length; i += LOTE) {
    const tensor = await e(textos.slice(i, i + LOTE), { pooling: 'mean', normalize: true });
    salida.push(...tensor.tolist());
  }
  return salida;
}

const embeberPasajes = (textos) => embeber(textos.map((t) => `passage: ${t}`));

async function embeberConsulta(texto) {
  const r = await embeber([`query: ${texto}`]);
  return r ? r[0] : null;
}

// pgvector acepta el vector como texto '[0.1,0.2,...]'.
const aVectorSql = (v) => (v && v.length === DIMENSIONES ? `[${v.join(',')}]` : null);

// ¿Existe la columna embedding? (pgvector instalado y migración 004 aplicada)
let hayColumna = null;
let revisadoEn = 0;
async function vectorDisponible() {
  // Se cachea 5 min: la migración puede aplicarse después de arrancar.
  if (hayColumna !== null && Date.now() - revisadoEn < 300_000) return hayColumna;
  try {
    const r = await db().query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'apunte_fragmentos' AND column_name = 'embedding'`
    );
    hayColumna = r.rows.length > 0;
  } catch {
    hayColumna = false;
  }
  revisadoEn = Date.now();
  return hayColumna;
}

// Calcula el embedding de hasta `limite` fragmentos que aún no lo tienen
// (indexados antes de la fase 3 o cuando el modelo no estaba disponible).
// Devuelve cuántos actualizó; 0 si no hay pendientes o no hay pgvector.
async function rellenarPendientes(limite = 16) {
  if (!(await vectorDisponible())) return 0;
  const r = await db().query(
    `SELECT f.fragmento_id, f.texto FROM apunte_fragmentos f
       JOIN apuntes a ON a.apunte_id = f.apunte_id
      WHERE f.embedding IS NULL AND a.estado_indexado = 'listo'
      ORDER BY f.fragmento_id LIMIT $1`,
    [limite]
  );
  if (r.rows.length === 0) return 0;
  const vectores = await embeberPasajes(r.rows.map((f) => f.texto));
  if (!vectores) return 0;
  for (const [i, f] of r.rows.entries()) {
    await db().query('UPDATE apunte_fragmentos SET embedding = $1::vector WHERE fragmento_id = $2', [aVectorSql(vectores[i]), f.fragmento_id]);
  }
  return r.rows.length;
}

module.exports = {
  embeberPasajes, embeberConsulta, aVectorSql, vectorDisponible, obtenerExtractor, rellenarPendientes, MODELO, DIMENSIONES,
};
