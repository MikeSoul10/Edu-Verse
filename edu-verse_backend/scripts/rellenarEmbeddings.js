// Calcula los embeddings de todos los fragmentos que aún no tienen.
//   npm run embeddings:rellenar
// El worker también lo hace solo cuando no tiene apuntes en cola; este script
// es para hacerlo de una vez (p. ej. justo después de migrar a pgvector).

require('dotenv').config({ quiet: true });
const pool = require('../db');
const { rellenarPendientes, vectorDisponible } = require('../services/embeddings');

(async () => {
  try {
    if (!(await vectorDisponible())) {
      console.error('❌ La columna embedding no existe: ¿PostgreSQL tiene pgvector y el backend ya aplicó la migración 004?');
      process.exitCode = 1;
      return;
    }
    let total = 0;
    for (;;) {
      const n = await rellenarPendientes(32);
      if (n === 0) break;
      total += n;
      console.log(`… ${total} fragmento(s) con embedding`);
    }
    console.log(`✅ Listo: ${total} fragmento(s) actualizados.`);
  } catch (err) {
    console.error('❌ Error al rellenar embeddings:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
