const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Edu-verseDB',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// ESTO NOS DIRÁ EL ERROR REAL
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error conectando a PostgreSQL:', err.stack);
  }
  console.log('✅ ¡Conexión a la base de datos exitosa!');
  release();
});

module.exports = pool;