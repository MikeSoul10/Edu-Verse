const LEET = {
  '4': 'a', '8': 'a', '@': 'a',
  '3': 'e',
  '1': 'i', '!': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't', '+': 't',
};

const PALABRAS_BLOQUEADAS = [
  'mierda', 'mierdas',
  'cagar', 'cagada', 'cagadas', 'cagon', 'cagones', 'cagona', 'cagonas',
  'puta', 'puto', 'putas', 'putos', 'puton', 'putona', 'putones', 'putonas',
  // El filtro exige coincidencia de palabra completa, así que las variantes
  // NO se heredan de "puto": en "putote" el "puto" interno cae por el límite
  // de palabra y la frase pasaba sin censurar. Cada variante va su entrada.
  'putito', 'putita', 'putitos', 'putitas',
  'putote', 'putotes',
  'putazo', 'putazos',
  'putear', 'puteada', 'puteadas', 'puteando', 'puteo',
  'joder', 'jodido', 'jodidos', 'jodida', 'jodidas', 'jodes',
  'jotido', 'jotida', 'jotidos', 'jotidas',
  'jotito', 'jotita', 'jotitos', 'jotitas',
  'jodito', 'jodita', 'joditos', 'joditas',
  'jodete',
  'carajo', 'carajos',
  'verga', 'vergas',
  'polla', 'pollas', 'pola', 'polas',
  'chingar', 'chingada', 'chingadas', 'chingado', 'chingados',
  'chinga', 'chingas', 'chingo', 'chingon', 'chingona', 'chinguear',
  'huevon', 'huevona', 'huevones',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejon', 'pendejona',
  'imbecil', 'imbeciles',
  'malparido', 'malparida', 'malparidos', 'malparidas',
  'cabron', 'cabrona', 'cabrones',
  'gilipollas', 'gilipolla', 'gilipolas',
  'nomames',
  'pinche', 'pinches',
  'hijodeputa', 'hijosdeputa', 'hijodelaputa', 'hijosdelaputa',
  'hijueputa', 'hijueputas', 'hijosdehijueputa',
  'hijodeperra', 'hijadeperra', 'hijosdeperra',
  'culero', 'culera', 'culeros', 'culeras',
  'webo', 'weba', 'webon', 'webas', 'webos',
  'mamahuevo', 'mamahuevos',
  'mamon', 'mamona', 'mamones',
  'maricon', 'marica', 'maricones',
  'joto', 'jotos',
  'zorra', 'zorras',
  'gonorrea', 'gonorreas',
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers',
  'motherfucker', 'motherfuckers',
  'bitch', 'bitches',
  'asshole', 'assholes', 'ashole', 'asholes',
  'shit', 'shits',
  'dumbass', 'dumbasses', 'dumbas',
  'cunt', 'cunts',
  'slut', 'sluts',
  'whore', 'whores',
  'retard', 'retards', 'retarded',
  'bastard', 'dick', 'prick', 'pussy', 'wanker', 'twat', 'jackass',
  'bollocks', 'douchebag', 'dipshit', 'cocksucker',
];

const DIACRITICOS = /[̀-ͯ]/g;

const normalizarUnidad = (unidad) => {
  let c = unidad.normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
  if (LEET[c] !== undefined) c = LEET[c];
  return c;
};

const esAlfanumerico = (unidad) => {
  const c = normalizarUnidad(unidad);
  return c.length === 1 && /[a-z0-9]/.test(c);
};

const normalizar = (texto) => {
  const salida = [];
  const spans = [];
  let ultimo = '';

  for (let i = 0; i < texto.length; i++) {
    const c = normalizarUnidad(texto[i]);
    if (c.length !== 1 || !/[a-z0-9]/.test(c)) { ultimo = ''; continue; }
    if (c === ultimo) { spans[spans.length - 1][1] = i; continue; }
    salida.push(c);
    spans.push([i, i]);
    ultimo = c;
  }

  return { texto: salida.join(''), spans };
};

const filtrarTexto = (texto) => {
  const resultado = { texto, censurado: false, cantidad: 0, palabras: [] };
  if (typeof texto !== 'string' || texto.length === 0) return resultado;

  const { texto: norm, spans } = normalizar(texto);
  if (spans.length === 0) return resultado;

  const mask = new Array(texto.length).fill(false);
  const encontradas = new Set();
  let cantidad = 0;

  for (const palabra of PALABRAS_BLOQUEADAS) {
    let idx = norm.indexOf(palabra);
    while (idx !== -1) {
      const ultimoToken = idx + palabra.length - 1;
      if (ultimoToken >= spans.length) break;

      const inicio = spans[idx][0];
      const fin = spans[ultimoToken][1];
      const inicioPalabra = inicio === 0 || !esAlfanumerico(texto[inicio - 1]);
      const finPalabra = fin === texto.length - 1 || !esAlfanumerico(texto[fin + 1]);

      if (inicioPalabra && finPalabra) {
        encontradas.add(palabra);
        cantidad++;
        for (let j = inicio; j <= fin; j++) mask[j] = true;
      }
      idx = norm.indexOf(palabra, idx + 1);
    }
  }

  if (cantidad === 0) return resultado;

  let salida = '';
  let i = 0;
  while (i < texto.length) {
    if (!mask[i]) { salida += texto[i]; i++; continue; }
    salida += texto[i];
    let j = i + 1;
    while (j < texto.length && mask[j]) { salida += '*'; j++; }
    i = j;
  }

  resultado.texto = salida;
  resultado.censurado = true;
  resultado.cantidad = cantidad;
  resultado.palabras = [...encontradas];
  return resultado;
};

const contieneInsulto = (texto) => filtrarTexto(texto).censurado;

module.exports = { PALABRAS_BLOQUEADAS, normalizar, filtrarTexto, contieneInsulto };
