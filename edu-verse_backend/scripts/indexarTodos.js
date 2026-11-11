// Marca TODOS los apuntes como 'pendiente' para que el worker los (re)indexe.
//   npm run indexar:todos
// Útil para la biblioteca existente o tras cambiar el motor de extracción.

require('dotenv').config({ quiet: true });
const pool = require('../db');

(async () => {
  try {
    const r = await pool.query(
      `UPDATE apuntes SET estado_indexado = 'pendiente', error_indexado = NULL, indexando_desde = NULL
        WHERE estado_indexado <> 'procesando'`
    );
    console.log(`✅ ${r.rowCount} apunte(s) marcados como pendientes. El worker los procesará en orden.`);
  } catch (err) {
    console.error('❌ No se pudo marcar los apuntes:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
