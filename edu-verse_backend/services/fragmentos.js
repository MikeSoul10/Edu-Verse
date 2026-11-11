// Limpieza del texto extraído y división en fragmentos para la búsqueda.
// Funciones puras (sin BD ni archivos) para poder probarlas aisladas.

const PALABRAS_POR_FRAGMENTO = 800;
const SOLAPAMIENTO = 100;

// Une palabras cortadas con guion al final de línea ("normali-\nzación"),
// quita caracteres de control y colapsa espacios repetidos.
function limpiarTexto(texto) {
  return String(texto || '')
    .replace(/\r\n?/g, '\n')
    .replace(/(\p{L})[-­]\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/­/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

// paginas: [{ pagina, texto, metodo }] -> [{ pagina, orden, texto, metodo }]
// Ventanas de ~800 palabras con ~100 de solapamiento. Cada fragmento guarda
// la página donde empieza (para citar "pág. n") y el método de su primera
// palabra.
function fragmentar(paginas, { tamano = PALABRAS_POR_FRAGMENTO, solapamiento = SOLAPAMIENTO } = {}) {
  const palabras = [];
  for (const p of paginas) {
    for (const w of limpiarTexto(p.texto).split(' ')) {
      if (w) palabras.push({ w, pagina: p.pagina ?? null, metodo: p.metodo });
    }
  }
  if (palabras.length === 0) return [];

  const paso = Math.max(1, tamano - solapamiento);
  const fragmentos = [];
  for (let inicio = 0; inicio < palabras.length; inicio += paso) {
    const trozo = palabras.slice(inicio, inicio + tamano);
    fragmentos.push({
      pagina: trozo[0].pagina,
      orden: fragmentos.length,
      texto: trozo.map((x) => x.w).join(' '),
      metodo: trozo[0].metodo,
    });
    if (inicio + tamano >= palabras.length) break;
  }
  return fragmentos;
}

module.exports = { limpiarTexto, fragmentar, PALABRAS_POR_FRAGMENTO, SOLAPAMIENTO };
