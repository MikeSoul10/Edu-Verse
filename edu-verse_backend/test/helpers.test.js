const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { sanitize } = require('../middleware/sanitize');
const { aEnteroPositivo } = require('../utils/validacion');
const {
  RAIZ_UPLOADS,
  rutaDesdeUrl,
  borrarArchivo,
  borrarArchivos,
  tamanoArchivo,
} = require('../utils/files');

test('sanitize conserva HTML y simbolos: React escapa al renderizar', () => {
  assert.equal(sanitize('Tom & Jerry <3'), 'Tom & Jerry <3');
  assert.equal(sanitize('<script>alert(1)</script>'), '<script>alert(1)</script>');
  assert.equal(sanitize('Acentos: ñandú'), 'Acentos: ñandú');
});

test('sanitize elimina caracteres de control pero conserva saltos de linea y tabuladores', () => {
  assert.equal(sanitize('linea1\nlinea2\tfin'), 'linea1\nlinea2\tfin');
  assert.equal(sanitize('a\u0000b\u0007c'), 'abc');
});

test('sanitize devuelve valores no string sin tocarlos', () => {
  assert.equal(sanitize(null), null);
  assert.equal(sanitize(42), 42);
  assert.equal(sanitize(undefined), undefined);
});

test('aEnteroPositivo solo acepta enteros mayores que cero', () => {
  assert.equal(aEnteroPositivo('12'), 12);
  assert.equal(aEnteroPositivo(1), 1);
  assert.equal(aEnteroPositivo('0'), null);
  assert.equal(aEnteroPositivo('-3'), null);
  assert.equal(aEnteroPositivo('1.5'), null);
  assert.equal(aEnteroPositivo('abc'), null);
  assert.equal(aEnteroPositivo(null), null);
});

test('rutaDesdeUrl resuelve solo rutas dentro de uploads', () => {
  assert.equal(
    rutaDesdeUrl('/uploads/apuntes/archivo.pdf'),
    path.join(RAIZ_UPLOADS, 'apuntes', 'archivo.pdf')
  );
  assert.equal(rutaDesdeUrl('/uploads/../db.js'), null);
  assert.equal(rutaDesdeUrl('/uploads/../../etc/passwd'), null);
  assert.equal(rutaDesdeUrl('https://ejemplo.com/foto.png'), null);
  assert.equal(rutaDesdeUrl('/otros/archivo.pdf'), null);
  assert.equal(rutaDesdeUrl(null), null);
});

test('borrarArchivo ignora rutas externas y archivos que no existen', async () => {
  await assert.doesNotReject(() => borrarArchivo('/etc/passwd'));
  await assert.doesNotReject(() => borrarArchivo('/uploads/no-existe-12345.pdf'));
  await assert.doesNotReject(() => borrarArchivos([null, undefined, '/uploads/no-existe-12345.pdf']));
});

test('tamanoArchivo devuelve 0 para rutas invalidas o inexistentes', async () => {
  assert.equal(await tamanoArchivo('/uploads/no-existe-12345.pdf'), 0);
  assert.equal(await tamanoArchivo('/etc/passwd'), 0);
});

test('tamanoArchivo y borrarArchivo funcionan con un archivo real', async () => {
  const nombreCarpeta = `test-${process.pid}`;
  const carpeta = path.join(RAIZ_UPLOADS, nombreCarpeta);
  const ruta = path.join(carpeta, 'temporal.txt');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(ruta, 'hola');

  assert.equal(await tamanoArchivo(`/uploads/${nombreCarpeta}/temporal.txt`), 4);

  await borrarArchivo(`/uploads/${nombreCarpeta}/temporal.txt`);
  assert.equal(fs.existsSync(ruta), false);

  fs.rmSync(carpeta, { recursive: true, force: true });
});
