// Worker de indexado de apuntes (proceso aparte de la API).
//
//   node worker/indexador.js
//
// Cada ~5 s toma UN apunte 'pendiente' (seguro con varios workers gracias a
// FOR UPDATE SKIP LOCKED), extrae su texto (PDF o OCR), lo divide en
// fragmentos y los guarda. Un apunte que falla queda en 'error' sin tumbar el
// worker. Corre aparte para que el OCR no bloquee la API.

require('dotenv').config({ quiet: true });
const pool = require('../db');
const { rutaDesdeUrl } = require('../utils/files');
const { extraerTexto, reiniciarOcr } = require('../services/extraccion');
const { fragmentar } = require('../services/fragmentos');

const INTERVALO_MS = 5_000;
const LIMITE_POR_APUNTE_MS = 3 * 60_000;
// Un apunte en 'procesando' por más de esto se considera abandonado (el worker
// que lo tomó se cayó) y vuelve a la cola.
const ABANDONADO_MIN = 10;

let detenido = false;
const hora = () => new Date().toISOString().slice(11, 19);
const log = (id, msg) => console.log(`[indexador ${hora()}]${id ? ` apunte ${id}:` : ''} ${msg}`);

// Mensajes que ve el usuario (la columna se expone en la API): nunca rutas ni
// trazas internas.
function mensajeError(err) {
  const m = err?.message || '';
  if (err?.code === 'TIEMPO') return 'El archivo tardó demasiado en procesarse.';
  if (err?.code === 'ENOENT') return 'No se encontró el archivo del apunte.';
  if (/password|encrypt/i.test(m)) return 'El PDF está protegido con contraseña.';
  if (/Invalid PDF|PDF structure|Missing PDF|bad XRef|FormatError/i.test(m)) return 'El PDF está dañado o no se pudo leer.';
  if (/no soportado/i.test(m)) return 'Tipo de archivo no soportado.';
  if (err?.code === 'SIN_TEXTO') return 'No se encontró texto legible (¿letra manuscrita o imagen sin texto?).';
  return 'No se pudo procesar el archivo.';
}

async function tomarApunte() {
  const r = await pool.query(`
    UPDATE apuntes
       SET estado_indexado = 'procesando', indexando_desde = now(), error_indexado = NULL
     WHERE apunte_id = (
       SELECT apunte_id FROM apuntes
        WHERE estado_indexado = 'pendiente'
        ORDER BY apunte_id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING apunte_id, titulo, archivo_url`);
  return r.rows[0] || null;
}

async function rescatarAbandonados() {
  const r = await pool.query(
    `UPDATE apuntes SET estado_indexado = 'pendiente', indexando_desde = NULL
      WHERE estado_indexado = 'procesando'
        AND (indexando_desde IS NULL OR indexando_desde < now() - make_interval(mins => $1))`,
    [ABANDONADO_MIN]
  );
  if (r.rowCount) log(null, `${r.rowCount} apunte(s) abandonados vuelven a la cola`);
}

function conLimiteDeTiempo(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => {
      const err = new Error(`Excedió ${ms / 1000} s`);
      err.code = 'TIEMPO';
      reject(err);
    }, ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

async function procesar(apunte) {
  const id = apunte.apunte_id;
  const inicio = Date.now();
  log(id, `inicio "${apunte.titulo}" (${apunte.archivo_url})`);

  const ruta = rutaDesdeUrl(apunte.archivo_url);
  if (!ruta) {
    const err = new Error('Ruta de archivo inválida');
    err.code = 'ENOENT';
    throw err;
  }

  const paginas = await conLimiteDeTiempo(extraerTexto(ruta, { log: (m) => log(id, m) }), LIMITE_POR_APUNTE_MS);
  const fragmentos = fragmentar(paginas);
  if (fragmentos.length === 0) {
    const err = new Error('Sin texto');
    err.code = 'SIN_TEXTO';
    throw err;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM apunte_fragmentos WHERE apunte_id = $1', [id]);
    for (const f of fragmentos) {
      await cliente.query(
        'INSERT INTO apunte_fragmentos (apunte_id, pagina, orden, texto, metodo) VALUES ($1, $2, $3, $4, $5)',
        [id, f.pagina, f.orden, f.texto, f.metodo]
      );
    }
    // Solo se marca 'listo' si nadie lo devolvió a la cola mientras tanto.
    await cliente.query(
      `UPDATE apuntes SET estado_indexado = 'listo', indexado_en = now(), indexando_desde = NULL, error_indexado = NULL
        WHERE apunte_id = $1 AND estado_indexado = 'procesando'`,
      [id]
    );
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
  log(id, `listo: ${fragmentos.length} fragmento(s) en ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
}

async function marcarError(id, err) {
  log(id, `❌ error: ${err?.message || err}`);
  // Si se excedió el tiempo, el OCR en curso se corta reiniciando su worker.
  if (err?.code === 'TIEMPO') await reiniciarOcr();
  await pool.query(
    `UPDATE apuntes SET estado_indexado = 'error', error_indexado = $2, indexando_desde = NULL WHERE apunte_id = $1`,
    [id, mensajeError(err)]
  ).catch((e) => log(id, `no se pudo marcar el error: ${e.message}`));
}

async function ciclo() {
  let ultimoRescate = 0;
  log(null, 'iniciado');
  while (!detenido) {
    let apunte = null;
    try {
      if (Date.now() - ultimoRescate > 60_000) {
        await rescatarAbandonados();
        ultimoRescate = Date.now();
      }
      apunte = await tomarApunte();
      if (apunte) {
        await procesar(apunte);
        continue; // hay cola: sigue sin esperar
      }
    } catch (err) {
      if (apunte) {
        await marcarError(apunte.apunte_id, err);
        continue;
      }
      // 42703/42P01: la migración aún no se aplica (el backend la aplica al
      // arrancar). Se reintenta en el siguiente ciclo.
      if (['42703', '42P01'].includes(err.code)) log(null, 'esperando a que el backend aplique las migraciones…');
      else log(null, `error del ciclo: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

async function detener(senal) {
  if (detenido) return;
  detenido = true;
  log(null, `${senal}: deteniendo…`);
  await reiniciarOcr();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => detener('SIGINT'));
process.on('SIGTERM', () => detener('SIGTERM'));

if (require.main === module) {
  ciclo();
}

module.exports = { procesar, tomarApunte, mensajeError };
