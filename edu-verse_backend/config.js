require('dotenv').config();

// Única fuente de verdad para el secreto JWT. Tanto el login (que firma) como
// el middleware y Socket.IO (que verifican) importan este mismo valor: así es
// imposible que uno use un valor por defecto y otro ninguno.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    '❌ Falta JWT_SECRET. Defínelo en el .env (genera uno con: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").'
  );
  process.exit(1);
}

module.exports = { JWT_SECRET };
