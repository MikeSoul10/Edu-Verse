// Normaliza texto plano antes de guardarlo. NO escapa HTML: la base guarda el
// texto tal como lo escribió el usuario y es el frontend (React) quien se
// encarga de codificarlo al pintarlo. Escapar aquí convertía "Tom & Jerry" en
// "Tom &amp; Jerry" y nada lo revertía al leerlo.
//
// Solo se eliminan bytes de control que no aportan nada y pueden romper el
// protocolo o el renderizado. Los saltos de línea y tabuladores se conservan.
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

module.exports = { sanitize };
