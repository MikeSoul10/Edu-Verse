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

test('fragmentar usa ventanas de 800 palabras con 100 de solapamiento y guarda la página', () => {
  const pagina1 = Array.from({ length: 700 }, (_, i) => `a${i}`).join(' ');
  const pagina2 = Array.from({ length: 700 }, (_, i) => `b${i}`).join(' ');
  const f = fragmentar([
    { pagina: 1, texto: pagina1, metodo: 'pdf_texto' },
    { pagina: 2, texto: pagina2, metodo: 'ocr' },
  ]);
  assert.equal(f.length, 2);
  assert.equal(f[0].texto.split(' ').length, 800);
  assert.equal(f[0].pagina, 1);
  // El segundo empieza en la palabra 700 (paso = 800 - 100), que ya es la
  // primera de la página 2.
  assert.equal(f[1].texto.split(' ')[0], 'b0');
  assert.equal(f[1].pagina, 2);
  assert.deepEqual(f.map((x) => x.orden), [0, 1]);
  // Solapamiento: las últimas 100 palabras del primero inician el segundo.
  assert.deepEqual(f[0].texto.split(' ').slice(700), f[1].texto.split(' ').slice(0, 100));
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
