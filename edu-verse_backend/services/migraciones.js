// Aplica al arrancar las migraciones SQL de /migraciones, en orden alfabético.
// Cada archivo debe ser idempotente (CREATE ... IF NOT EXISTS), así que
// correrlas en cada arranque es seguro y no requiere tabla de control.

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function aplicarMigraciones() {
  const carpeta = path.join(__dirname, '..', 'migraciones');
  if (!fs.existsSync(carpeta)) return;

  const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    try {
      await pool.query(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
      console.log(`🗄️  Migración aplicada: ${archivo}`);
    } catch (err) {
      console.error(`❌ Error en migración ${archivo}:`, err.message);
    }
  }
}

module.exports = { aplicarMigraciones };
