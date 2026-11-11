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
// Ventanas de ~800 palabras con ~100 de solapamiento DENTRO de cada página:
// un fragmento nunca mezcla páginas, así la cita "pág. n" es exacta y el
// embedding no promedia temas distintos (un PDF de páginas cortas quedaba en
// un solo fragmento con todo su contenido marcado como pág. 1).
function fragmentar(paginas, { tamano = PALABRAS_POR_FRAGMENTO, solapamiento = SOLAPAMIENTO } = {}) {
  const paso = Math.max(1, tamano - solapamiento);
  const fragmentos = [];
  for (const p of paginas) {
    const palabras = limpiarTexto(p.texto).split(' ').filter(Boolean);
    for (let inicio = 0; inicio < palabras.length; inicio += paso) {
      fragmentos.push({
        pagina: p.pagina ?? null,
        orden: fragmentos.length,
        texto: palabras.slice(inicio, inicio + tamano).join(' '),
        metodo: p.metodo,
      });
      if (inicio + tamano >= palabras.length) break;
    }
  }
  return fragmentos;
}

module.exports = { limpiarTexto, fragmentar, PALABRAS_POR_FRAGMENTO, SOLAPAMIENTO };
