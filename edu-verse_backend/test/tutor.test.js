// Pruebas del Tutor IA (fase 2): fragmentos, consulta de búsqueda, citas de
// apuntes y aislamiento del usuario en el ciclo de herramientas.
// No usan red ni base de datos: Groq se simula reemplazando fetch.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'gsk_prueba';

const { limpiarTexto, fragmentar } = require('../services/fragmentos');
const { consultaWebsearch } = require('../services/busquedaApuntes');
const groq = require('../services/groq');

// --- fragmentos ---------------------------------------------------------------
test('limpiarTexto une palabras cortadas con guion y colapsa espacios', () => {
  assert.equal(limpiarTexto('La normali-\nzación   reduce\n\n redundancia'), 'La normalización reduce redundancia');
  assert.equal(limpiarTexto('Guion real - aquí'), 'Guion real - aquí');
});

test('fragmentar usa ventanas de 800 palabras con 100 de solapamiento sin mezclar páginas', () => {
  const palabras = (prefijo, n) => Array.from({ length: n }, (_, i) => `${prefijo}${i}`).join(' ');
  const f = fragmentar([
    { pagina: 1, texto: palabras('a', 1000), metodo: 'pdf_texto' },
    { pagina: 2, texto: palabras('b', 50), metodo: 'ocr' },
  ]);
  assert.deepEqual(f.map((x) => [x.pagina, x.orden, x.metodo]), [[1, 0, 'pdf_texto'], [1, 1, 'pdf_texto'], [2, 2, 'ocr']]);
  assert.equal(f[0].texto.split(' ').length, 800);
  // Solapamiento: las últimas 100 palabras del primero inician el segundo.
  assert.deepEqual(f[0].texto.split(' ').slice(700), f[1].texto.split(' ').slice(0, 100));
  assert.equal(f[1].texto.split(' ').at(-1), 'a999');
  // La página 2 (corta) es su propio fragmento: nunca se mezcla con la 1.
  assert.equal(f[2].texto, palabras('b', 50));
});

test('fragmentar ignora páginas vacías y devuelve [] sin texto', () => {
  assert.deepEqual(fragmentar([{ pagina: 1, texto: '   ', metodo: 'ocr' }]), []);
});

// --- consulta -------------------------------------------------------------------
test('consultaWebsearch une términos con OR y quita operadores', () => {
  assert.equal(consultaWebsearch('formas "normales" -tablas'), 'formas or normales or tablas');
  assert.equal(consultaWebsearch('  '), '');
  assert.equal(consultaWebsearch('normal OR forma and tabla x'), 'normal or forma or tabla');
});

// --- citas de apuntes -----------------------------------------------------------
test('procesarRespuesta numera web y apuntes en orden y toma el título de la BD', () => {
  const apuntes = new Map([[4, { titulo: 'Sprint Modular', pagina: 1 }]]);
  const r = groq.procesarRespuesta({
    content: 'Según [mis apuntes](edu-verse://apunte/4?pagina=3) y [Wikipedia](https://es.wikipedia.org/wiki/Scrum). Otra vez edu-verse://apunte/4?pagina=3\n\nSUBTEMAS: a | b',
  }, { apuntes });
  assert.equal(r.contenido, 'Según mis apuntes [1] y [2]. Otra vez [1]');
  assert.deepEqual(r.fuentes[0], { tipo: 'apunte', apunte_id: 4, titulo: 'Sprint Modular', pagina: 3, url: '/apunte/4?pagina=3' });
  assert.equal(r.fuentes[1].tipo, 'web');
  assert.deepEqual(r.subtemas, ['a', 'b']);
});

test('procesarRespuesta descarta citas a apuntes que la búsqueda no devolvió', () => {
  const r = groq.procesarRespuesta(
    { content: 'Dato [apunte secreto](edu-verse://apunte/99?pagina=1) y suelto edu-verse://apunte/98.' },
    { apuntes: new Map([[4, { titulo: 'Sprint Modular', pagina: 1 }]]) }
  );
  assert.equal(r.contenido, 'Dato apunte secreto y suelto .');
  assert.ok(r.fuentes.every((f) => f.apunte_id !== 99 && f.apunte_id !== 98));
});

// --- ciclo de herramientas ------------------------------------------------------
function simularGroq(respuestas) {
  const original = global.fetch;
  const cuerpos = [];
  global.fetch = async (url, opciones) => {
    cuerpos.push(JSON.parse(opciones.body));
    const mensaje = respuestas.shift();
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: mensaje }] }), headers: new Map() };
  };
  return { cuerpos, restaurar: () => { global.fetch = original; } };
}

test('buscar_apuntes usa SIEMPRE el usuario del token, no lo que mande la IA', async () => {
  const sim = simularGroq([
    {
      content: '',
      tool_calls: [{
        id: 'c1',
        type: 'function',
        function: { name: 'buscar_apuntes', arguments: JSON.stringify({ consulta: 'sprint', usuarioId: 999, usuario_id: 999 }) },
      }],
    },
    { content: 'Respuesta [Sprint](edu-verse://apunte/4?pagina=2)' },
  ]);
  const recibidos = [];
  // Así liga la ruta el buscador: el id viene del token (aquí, 7).
  const usuarioDelToken = 7;
  const buscador = (consulta, ...extra) => {
    recibidos.push({ consulta, extra, usuarioId: usuarioDelToken });
    return Promise.resolve([{ apunte_id: 4, titulo: 'Sprint Modular', pagina: 2, cita: 'edu-verse://apunte/4?pagina=2', texto: '...' }]);
  };
  try {
    const r = await groq.responderPregunta({
      tema: 'Scrum', nivel: 'basico', primera: true, buscarApuntes: buscador,
      historial: [{ role: 'user', content: '¿Qué es un sprint?' }],
    });
    assert.deepEqual(recibidos, [{ consulta: 'sprint', extra: [], usuarioId: 7 }]);
    assert.equal(r.fuentes[0].apunte_id, 4);
    assert.equal(r.sin_busqueda, false);
    // Primera ronda: browser_search + buscar_apuntes con tool_choice required.
    assert.deepEqual(sim.cuerpos[0].tools.map((t) => t.type), ['browser_search', 'function']);
    assert.equal(sim.cuerpos[0].tool_choice, 'required');
    // Segunda ronda: lleva el resultado como mensaje role=tool.
    const tool = sim.cuerpos[1].messages.find((m) => m.role === 'tool');
    assert.equal(tool.tool_call_id, 'c1');
  } finally {
    sim.restaurar();
  }
});

test('el ciclo de herramientas se corta tras 3 rondas y pide respuesta sin herramientas', async () => {
  const llamada = (id) => ({ content: '', tool_calls: [{ id, type: 'function', function: { name: 'buscar_apuntes', arguments: '{"consulta":"x"}' } }] });
  const sim = simularGroq([llamada('1'), llamada('2'), llamada('3'), { content: 'Final' }]);
  try {
    const r = await groq.responderPregunta({
      tema: 't', nivel: 'basico', primera: false, buscarApuntes: async () => [],
      historial: [{ role: 'user', content: 'p' }],
    });
    assert.equal(r.contenido, 'Final');
    assert.equal(sim.cuerpos.length, 4);
    assert.equal(sim.cuerpos[3].tools, undefined);
  } finally {
    sim.restaurar();
  }
});

// --- fase 3 -----------------------------------------------------------------------
const { fusionarRRF } = require('../services/busquedaApuntes');

test('fusionarRRF premia lo que aparece alto en texto Y en vector', () => {
  const f = (id) => ({ fragmento_id: id });
  const texto = [f(1), f(2), f(3)];
  const vector = [f(3), f(4), f(1)];
  const r = fusionarRRF([texto, vector], 3).map((x) => x.fragmento_id);
  // 1: 1/61 + 1/63 ; 3: 1/63 + 1/61 (empate, desempata el id) ; luego 2 y 4.
  assert.deepEqual(r, [1, 3, 2]);
  assert.deepEqual(fusionarRRF([[], vector], 2).map((x) => x.fragmento_id), [3, 4]);
});

test('validarTarjetas solo conserva páginas que estaban en el material', () => {
  const datos = { tarjetas: [
    { frente: 'Pregunta uno', reverso: 'r', pagina: 2 },
    { frente: 'Pregunta dos', reverso: 'r', pagina: 99 },
    { frente: 'Pregunta tres', reverso: 'r', pagina: '3' },
  ] };
  const t = groq.validarTarjetas(datos, { paginasValidas: new Set([1, 2, 3]) });
  assert.deepEqual(t.map((x) => x.pagina), [2, null, 3]);
  // Sin paginasValidas (flashcards del tutor) no se agrega "pagina".
  assert.equal('pagina' in groq.validarTarjetas(datos)[0], false);
});

test('estudio: intervalos Leitner, fechas y material sin solapamiento', () => {
  // estudio.js carga la BD de forma perezosa vía pool solo al consultar.
  const { INTERVALOS, sumarDias, armarMaterial } = require('../routes/estudio');
  assert.deepEqual(INTERVALOS, { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 });
  assert.equal(sumarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');

  const palabras = (desde, n) => Array.from({ length: n }, (_, i) => `w${desde + i}`).join(' ');
  const material = armarMaterial([
    { orden: 0, pagina: 1, texto: palabras(0, 800) },
    { orden: 1, pagina: 1, texto: palabras(700, 800) },   // misma página: 100 repetidas
    { orden: 2, pagina: 2, texto: palabras(5000, 10) },   // página nueva: nada repetido
  ]);
  const [p1, p2, p3] = material.split('\n\n');
  assert.ok(p1.startsWith('[pág. 1] w0 '));
  assert.ok(p2.startsWith('[pág. 1] w800 '));            // sin el solapamiento
  assert.ok(p3.startsWith('[pág. 2] w5000 '));           // completa
});
