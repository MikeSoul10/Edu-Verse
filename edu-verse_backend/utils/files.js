const fs = require('fs');
const path = require('path');

const RAIZ_UPLOADS = path.resolve(__dirname, '..', 'uploads');

// Traduce una URL pública (/uploads/...) a una ruta absoluta DENTRO de uploads.
// Devuelve null si la URL no es de uploads o si intenta salir de la carpeta
// (path traversal), así nunca se borra un archivo del sistema por accidente.
function rutaDesdeUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const relativa = url.slice('/uploads/'.length).replace(/\\/g, '/');
  const absoluta = path.resolve(RAIZ_UPLOADS, relativa);
  if (absoluta !== RAIZ_UPLOADS && !absoluta.startsWith(`${RAIZ_UPLOADS}${path.sep}`)) {
    return null;
  }
  return absoluta;
}

async function borrarArchivo(url) {
  const ruta = rutaDesdeUrl(url);
  if (!ruta) return;
  try {
    await fs.promises.unlink(ruta);
  } catch (err) {
    // ENOENT es normal: el archivo pudo borrarse antes o nunca existió.
    if (err.code !== 'ENOENT') console.warn(`No se pudo borrar ${ruta}:`, err.message);
  }
}

async function borrarArchivos(urls) {
  await Promise.all((urls || []).filter(Boolean).map((url) => borrarArchivo(url)));
}

async function tamanoArchivo(url) {
  const ruta = rutaDesdeUrl(url);
  if (!ruta) return 0;
  try {
    return (await fs.promises.stat(ruta)).size;
  } catch {
    return 0;
  }
}

module.exports = { RAIZ_UPLOADS, rutaDesdeUrl, borrarArchivo, borrarArchivos, tamanoArchivo };
