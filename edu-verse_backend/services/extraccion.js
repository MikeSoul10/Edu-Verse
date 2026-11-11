// Extracción de texto de apuntes (PDF e imágenes).
//
// extraerTexto(ruta) es el único punto de entrada y devuelve
//   [{ pagina, texto, metodo: 'pdf_texto' | 'ocr' }]
// Para cambiar el motor de OCR (p. ej. uno que lea letra manuscrita) basta con
// reemplazar `ocrImagen()`: el worker y la búsqueda no cambian.
//
// Limitación conocida: Tesseract lee bien texto impreso, pero MAL la letra
// manuscrita.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const MIN_CARACTERES_PAGINA = 30;   // menos que esto = página escaneada -> OCR
const DPI_OCR = 200;
const EXTENSIONES_IMAGEN = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff']);

// --- OCR (Tesseract) --------------------------------------------------------
// Un solo worker de Tesseract reutilizado: cargar los modelos cuesta segundos.
let workerOcr = null;

// Los modelos de idioma vienen en los paquetes @tesseract.js-data/* (instalados
// con npm, dentro de la imagen de Docker). Tesseract espera ambos en una misma
// carpeta, así que se copian a una carpeta temporal al primer uso: nunca se
// descargan de internet.
function carpetaIdiomas() {
  const destino = path.join(os.tmpdir(), 'eduverse-tessdata');
  fs.mkdirSync(destino, { recursive: true });
  for (const idioma of ['spa', 'eng']) {
    const archivo = `${idioma}.traineddata.gz`;
    const origen = path.join(path.dirname(require.resolve(`@tesseract.js-data/${idioma}/package.json`)), '4.0.0_best_int', archivo);
    const copia = path.join(destino, archivo);
    if (!fs.existsSync(copia)) fs.copyFileSync(origen, copia);
  }
  return destino;
}

async function obtenerWorkerOcr() {
  if (!workerOcr) {
    const { createWorker } = require('tesseract.js');
    const carpeta = carpetaIdiomas();
    workerOcr = await createWorker(['spa', 'eng'], 1, {
      langPath: carpeta,
      cachePath: carpeta,
      gzip: true,
      logger: () => {},
      errorHandler: (e) => console.warn('⚠️  Tesseract:', e?.message || e),
    });
  }
  return workerOcr;
}

async function ocrImagen(rutaOBuffer) {
  const worker = await obtenerWorkerOcr();
  const { data } = await worker.recognize(rutaOBuffer);
  return data?.text || '';
}

// Detiene el worker de OCR (al terminar o si un apunte excede su tiempo, para
// cortar el trabajo en curso). El siguiente uso crea uno nuevo.
async function reiniciarOcr() {
  const w = workerOcr;
  workerOcr = null;
  if (w) await w.terminate().catch(() => {});
}

// --- PDF ----------------------------------------------------------------------
let pdfjs = null;
async function cargarPdfjs() {
  // pdfjs-dist es ESM; desde CommonJS se carga con import() dinámico.
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

async function textoPorPagina(rutaPdf) {
  const { getDocument } = await cargarPdfjs();
  const datos = new Uint8Array(await fs.promises.readFile(rutaPdf));
  const documento = await getDocument({
    data: datos,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;

  const paginas = [];
  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const contenido = await pagina.getTextContent();
      const texto = contenido.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('');
      paginas.push({ pagina: n, texto });
      pagina.cleanup();
    }
  } finally {
    await documento.destroy();
  }
  return paginas;
}

// Convierte una página del PDF a PNG con pdftoppm (poppler-utils).
function renderizarPagina(rutaPdf, pagina, carpeta) {
  const salida = path.join(carpeta, `p${pagina}`);
  return new Promise((resolve, reject) => {
    execFile(
      'pdftoppm',
      ['-r', String(DPI_OCR), '-png', '-f', String(pagina), '-l', String(pagina), '-singlefile', rutaPdf, salida],
      { timeout: 60_000 },
      (err) => (err ? reject(err) : resolve(`${salida}.png`))
    );
  });
}

let hayPdftoppm = null;
function pdftoppmDisponible() {
  if (hayPdftoppm === null) {
    hayPdftoppm = new Promise((resolve) => {
      execFile('pdftoppm', ['-v'], { timeout: 10_000 }, (err) => resolve(!err || err.code !== 'ENOENT'));
    });
  }
  return hayPdftoppm;
}

async function extraerPdf(rutaPdf, log) {
  const paginas = await textoPorPagina(rutaPdf);
  const escaneadas = paginas.filter((p) => p.texto.replace(/\s/g, '').length < MIN_CARACTERES_PAGINA);
  log(`PDF de ${paginas.length} páginas; ${escaneadas.length} requieren OCR`);

  const resultado = paginas.map((p) => ({ pagina: p.pagina, texto: p.texto, metodo: 'pdf_texto' }));
  if (escaneadas.length === 0) return resultado;

  if (!(await pdftoppmDisponible())) {
    log('⚠️  pdftoppm no está instalado (poppler-utils): se omite el OCR de las páginas escaneadas');
    return resultado;
  }

  const carpeta = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'eduverse-ocr-'));
  try {
    for (const p of escaneadas) {
      const png = await renderizarPagina(rutaPdf, p.pagina, carpeta);
      const texto = await ocrImagen(png);
      await fs.promises.unlink(png).catch(() => {});
      const destino = resultado.find((r) => r.pagina === p.pagina);
      destino.texto = texto;
      destino.metodo = 'ocr';
      log(`OCR página ${p.pagina}: ${texto.trim().length} caracteres`);
    }
  } finally {
    await fs.promises.rm(carpeta, { recursive: true, force: true }).catch(() => {});
  }
  return resultado;
}

// --- Punto de entrada ---------------------------------------------------------
async function extraerTexto(ruta, { log = () => {} } = {}) {
  const ext = path.extname(ruta).toLowerCase();
  if (ext === '.pdf') return extraerPdf(ruta, log);
  if (EXTENSIONES_IMAGEN.has(ext)) {
    const texto = await ocrImagen(ruta);
    log(`OCR de imagen: ${texto.trim().length} caracteres`);
    return [{ pagina: null, texto, metodo: 'ocr' }];
  }
  throw new Error(`Tipo de archivo no soportado: ${ext || 'sin extensión'}`);
}

module.exports = { extraerTexto, reiniciarOcr, MIN_CARACTERES_PAGINA };
