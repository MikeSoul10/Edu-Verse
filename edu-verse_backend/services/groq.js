// Lógica de IA del Tutor (Groq). Sin Express ni base de datos: solo arma
// prompts, llama a la API y procesa respuestas. Las rutas viven en
// routes/tutor.js.
//
// Groq expone una API compatible con OpenAI. Se usa fetch directo (sin SDK).

const GROQ_URL = 'https://api.groq.com/openai/v1';

const config = {
  modelo: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  respaldo: process.env.GROQ_MODEL_RESPALDO || 'openai/gpt-oss-20b',
};

const NIVELES = {
  basico: 'básico (explica desde cero, con analogías y sin jerga)',
  intermedio: 'intermedio (estudiante universitario que ya conoce lo esencial)',
  avanzado: 'avanzado (detalle técnico, formalismo y casos límite)',
};

const TIMEOUT_MS = 100_000;

class ErrorIA extends Error {
  constructor(mensaje, { status = 502, codigo = 'error_ia', esperaSegundos = null } = {}) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.esperaSegundos = esperaSegundos;
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Groq indica cuándo se libera la cuota en retry-after ("12") o en
// x-ratelimit-reset-tokens ("7.66s", "1m2.5s").
function segundosDeEspera(headers) {
  const directo = Number(headers.get('retry-after'));
  if (Number.isFinite(directo) && directo > 0) return directo;
  const reset = headers.get('x-ratelimit-reset-tokens') || headers.get('x-ratelimit-reset-requests') || '';
  const m = reset.match(/^(?:(\d+)m)?(?:([\d.]+)s)?$/);
  if (!m || !reset) return null;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

const hayApiKey = () => Boolean(process.env.GROQ_API_KEY);

// ---------------------------------------------------------------------------
// Llamada base
// ---------------------------------------------------------------------------
async function llamarGroq(cuerpo) {
  if (!hayApiKey()) {
    throw new ErrorIA('El Tutor IA no está configurado (falta GROQ_API_KEY en el servidor).', {
      status: 503,
      codigo: 'sin_configurar',
    });
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${GROQ_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: controlador.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ErrorIA('La IA tardó demasiado en responder. Intenta de nuevo.', { status: 504, codigo: 'timeout' });
    }
    throw new ErrorIA('No se pudo conectar con el servicio de IA.', { status: 502, codigo: 'conexion' });
  } finally {
    clearTimeout(temporizador);
  }

  if (!res.ok) {
    let detalle = '';
    try {
      const datos = await res.json();
      detalle = datos?.error?.message || '';
    } catch { /* cuerpo no JSON */ }

    if (res.status === 429) {
      throw new ErrorIA(
        'Se alcanzó el límite de uso gratuito de la IA. Espera un minuto e intenta de nuevo (si persiste, el límite diario se reinicia mañana).',
        { status: 429, codigo: 'limite', esperaSegundos: segundosDeEspera(res.headers) }
      );
    }
    // Nunca se reenvía el detalle crudo al cliente: puede incluir datos de la cuenta.
    console.error(`❌ Groq ${res.status}:`, detalle);
    throw new ErrorIA('El servicio de IA devolvió un error. Intenta de nuevo en un momento.', {
      status: 502,
      codigo: res.status === 404 || /does not exist/i.test(detalle) ? 'modelo' : 'groq',
    });
  }

  return res.json();
}

// Al arrancar se valida que los modelos existan en la cuenta. Si el principal
// desapareció, se usa el de respaldo como principal.
async function revisarModelos() {
  if (!hayApiKey()) {
    console.warn('⚠️  GROQ_API_KEY no definida: el Tutor IA responderá 503 hasta configurarla.');
    return;
  }
  try {
    const res = await fetch(`${GROQ_URL}/models`, {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    });
    if (!res.ok) {
      console.warn(`⚠️  No se pudo validar los modelos de Groq (HTTP ${res.status}).`);
      return;
    }
    const { data = [] } = await res.json();
    const ids = new Set(data.map((m) => m.id));
    const principalOk = ids.has(config.modelo);
    const respaldoOk = ids.has(config.respaldo);

    if (!principalOk && respaldoOk) {
      console.warn(`⚠️  El modelo ${config.modelo} no existe en la cuenta; se usará ${config.respaldo}.`);
      config.modelo = config.respaldo;
    } else if (!principalOk) {
      console.error(`❌ Ni ${config.modelo} ni ${config.respaldo} están disponibles en Groq.`);
    } else if (!respaldoOk) {
      console.warn(`⚠️  El modelo de respaldo ${config.respaldo} no existe; no habrá respaldo.`);
      config.respaldo = null;
    } else {
      console.log(`🤖 Tutor IA listo: ${config.modelo} (respaldo ${config.respaldo}).`);
    }
  } catch (err) {
    console.warn('⚠️  No se pudo validar los modelos de Groq:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
// conBusqueda = false para el modelo de respaldo: si el prompt le pide
// investigar, intenta llamar a una herramienta que no tiene y Groq responde
// 400 ("Tool choice is none, but model called a tool").
//
// conApuntes = true cuando la IA tiene la función buscar_apuntes.
// fragmentos = apuntes ya buscados por el backend (para el respaldo, que no
// puede usar herramientas): se inyectan en el prompt.
const REGLA_CITA_APUNTE =
  '- Cita los apuntes con un enlace Markdown cuyo destino sea EXACTAMENTE el campo "cita" del fragmento: [Título del apunte](edu-verse://apunte/<id>?pagina=<n>). Nunca inventes ids ni páginas.';

function systemPrompt({ tema, nivel, conBusqueda = true, conApuntes = false, fragmentos = [] }) {
  const fuentes = conBusqueda
    ? [
        '- Investiga en la web antes de responder y apoya cada afirmación importante con su fuente.',
        '- Cita las fuentes con enlaces Markdown en línea: [nombre del sitio](https://url-exacta). Usa la URL real de la página consultada.',
      ]
    : [
        '- NO tienes herramientas ni acceso a internet en esta respuesta: no intentes buscar ni llamar funciones. Responde solo con tu conocimiento y no inventes enlaces web.',
      ];
  if (conBusqueda && conApuntes) {
    fuentes.push(
      '- Tienes la función buscar_apuntes para consultar la biblioteca de apuntes de clase de Edu-Verse. Úsala PRIMERO cuando la pregunta sea de un tema de clase.',
      '- Prioriza la información de los apuntes de la biblioteca cuando sea relevante y complétala con la web.',
      REGLA_CITA_APUNTE
    );
  }
  if (fragmentos.length) {
    fuentes.push(
      '- Abajo tienes fragmentos de apuntes de la biblioteca de Edu-Verse. Si son relevantes, priorízalos.',
      REGLA_CITA_APUNTE,
      '',
      'Fragmentos de apuntes:',
      JSON.stringify(fragmentos)
    );
  }
  return [
    'Eres el Tutor IA de Edu-Verse, una plataforma para estudiantes de la Universidad de Guadalajara.',
    `El estudiante está estudiando: "${tema}". Nivel: ${NIVELES[nivel] || NIVELES.intermedio}.`,
    '',
    'Reglas:',
    '- Responde SIEMPRE en español, en Markdown claro (títulos ##, listas, **negritas**, bloques de código si aplica).',
    ...fuentes,
    '- Sé didáctico: explica el porqué, da ejemplos concretos y señala errores comunes.',
    '- No inventes datos ni URLs. Si no estás seguro, dilo.',
    '- Termina SIEMPRE con una última línea exactamente así (3 a 5 subtemas para seguir aprendiendo):',
    'SUBTEMAS: subtema 1 | subtema 2 | subtema 3',
  ].join('\n');
}

// conPaginas = true para flashcards desde un apunte: el material viene
// marcado con "[pág. n]" y cada tarjeta debe indicar de qué página sale.
function promptFlashcards({ tema, nivel, material, conPaginas = false }) {
  const forma = conPaginas
    ? '{"tarjetas":[{"frente":"pregunta o concepto","reverso":"respuesta breve y precisa","tipo":"concepto|definicion|pregunta|ejemplo","pagina":3}]}'
    : '{"tarjetas":[{"frente":"pregunta o concepto","reverso":"respuesta breve y precisa","tipo":"concepto|definicion|pregunta|ejemplo"}]}';
  return [
    {
      role: 'system',
      content: [
        'Eres un generador de flashcards de estudio. Responde SOLO con JSON válido con esta forma:',
        forma,
        'Reglas: entre 8 y 20 tarjetas, en español, sin repetir ideas, frente corto (máx. 140 caracteres),',
        'reverso autocontenido (máx. 400 caracteres), basadas ÚNICAMENTE en el material proporcionado.',
        ...(conPaginas
          ? ['El material está marcado con [pág. n]: en "pagina" pon el número de la página de donde sale la información de cada tarjeta (número entero).']
          : []),
      ].join(' '),
    },
    {
      role: 'user',
      content: `Tema: ${tema}\nNivel: ${NIVELES[nivel] || NIVELES.intermedio}\n\nMaterial:\n${material}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Procesamiento de respuestas
// ---------------------------------------------------------------------------

// Páginas consultadas por browser_search. Groq las devuelve en
// message.executed_tools; el formato exacto ha variado, así que se leen de
// forma defensiva (resultados estructurados y, si no, URLs en el texto).
function resultadosBusqueda(mensaje) {
  const vistos = new Map();
  const agregar = (url, titulo) => {
    if (!url || !/^https?:\/\//i.test(url) || vistos.has(url)) return;
    vistos.set(url, { url, titulo: (titulo || '').trim() || dominio(url), tipo: 'web' });
  };

  for (const herramienta of mensaje?.executed_tools || []) {
    const resultados = herramienta?.search_results?.results;
    if (Array.isArray(resultados)) {
      resultados.forEach((r) => agregar(r.url, r.title));
    }
    if (typeof herramienta?.output === 'string') {
      const urls = herramienta.output.match(/https?:\/\/[^\s)\]}"'<>】]+/g) || [];
      urls.forEach((u) => agregar(u.replace(/[.,;]+$/, '')));
    }
  }
  return [...vistos.values()];
}

function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Limpia marcas internas, separa subtemas y convierte enlaces Markdown en
// citas numeradas [n] con su lista de fuentes (web y apuntes).
//
// apuntes: Map apunte_id -> { titulo, pagina } con los apuntes que
// buscar_apuntes devolvió en ESTA respuesta. Un enlace edu-verse:// a un
// apunte que no está ahí (inventado o fuera de lo consultado) se descarta:
// así la IA no puede citar apuntes que el usuario no puede ver.
const RE_APUNTE = /^edu-verse:\/\/apunte\/(\d+)(?:\?pagina=(\d+))?/i;

function procesarRespuesta(mensaje, { apuntes = new Map() } = {}) {
  let texto = (mensaje?.content || '').replace(/【[^】]*】/g, '').trim();

  let subtemas = [];
  const coincidencia = texto.match(/\n?\**SUBTEMAS:?\**:?\s*(.+)\s*$/i);
  if (coincidencia) {
    subtemas = coincidencia[1]
      .split('|')
      .map((s) => s.replace(/[*_`]/g, '').trim())
      .filter((s) => s && s.length <= 120)
      .slice(0, 6);
    texto = texto.slice(0, coincidencia.index).trim();
  }

  const fuentes = [];
  const indice = new Map();
  const registrar = (clave, fuente) => {
    if (!indice.has(clave)) {
      fuentes.push(fuente);
      indice.set(clave, fuentes.length);
    }
    return indice.get(clave);
  };
  const numeroWeb = (url, titulo) => {
    const limpia = url.replace(/[.,;]+$/, '');
    return registrar(limpia, { url: limpia, titulo: titulo || dominio(limpia), tipo: 'web' });
  };
  const fuenteApunte = (id, titulo, pagina) => ({
    tipo: 'apunte',
    apunte_id: id,
    titulo,              // el título sale de la BD, no de la IA
    pagina: pagina ?? null,
    url: `/apunte/${id}${pagina ? `?pagina=${pagina}` : ''}`,
  });
  // Devuelve null si el apunte no fue consultado en esta respuesta.
  const numeroApunte = (url) => {
    const m = url.match(RE_APUNTE);
    const id = m && Number(m[1]);
    const info = id && apuntes.get(id);
    if (!info) return null;
    const pagina = m[2] ? Number(m[2]) : null;
    return registrar(`apunte:${id}:${pagina ?? ''}`, fuenteApunte(id, info.titulo, pagina));
  };

  // [texto](https://...) o [texto](edu-verse://apunte/...) -> [n], numerando
  // web y apuntes en el orden en que aparecen. Se conserva el texto del enlace
  // cuando es parte de la oración (no solo el nombre del sitio).
  texto = texto.replace(/\[([^\]]+)\]\(((?:https?|edu-verse):\/\/[^\s)]+)\)/gi, (_, etiqueta, url) => {
    const limpia = etiqueta.trim();
    if (/^edu-verse:/i.test(url)) {
      const n = numeroApunte(url);
      if (n === null) return etiqueta;
      return /^(apunte|apuntes|fuente)$/i.test(limpia) ? `[${n}]` : `${etiqueta} [${n}]`;
    }
    const n = numeroWeb(url, etiqueta);
    // Una sola palabra ("Wikipedia", "khanacademy.org", "1") es el nombre del
    // sitio: se reemplaza por el número. Una frase se conserva.
    const esNombreDeSitio = !/\s/.test(limpia) || /^fuente\b/i.test(limpia);
    return esNombreDeSitio ? `[${n}]` : `${etiqueta} [${n}]`;
  });
  // URLs edu-verse:// sueltas (sin formato de enlace).
  texto = texto.replace(/\(?edu-verse:\/\/apunte\/\d+(?:\?pagina=\d+)?\)?/gi, (url) => {
    const n = numeroApunte(url.replace(/^\(|\)$/g, ''));
    return n === null ? '' : `[${n}]`;
  });

  // Si la IA no citó nada, al menos se listan los apuntes y páginas que consultó.
  if (fuentes.length === 0) {
    for (const [id, info] of apuntes) fuentes.push(fuenteApunte(id, info.titulo, info.pagina));
    resultadosBusqueda(mensaje).slice(0, 8).forEach((f) => fuentes.push(f));
  }

  return { contenido: texto, fuentes, subtemas };
}

// Limpia, deduplica y acota las tarjetas que devuelve la IA.
// paginasValidas (Set) : si viene, conserva "pagina" solo si está en el set
// (la IA no puede inventar páginas que no estaban en el material).
function validarTarjetas(datos, { paginasValidas = null } = {}) {
  const lista = Array.isArray(datos) ? datos : datos?.tarjetas || datos?.flashcards || [];
  if (!Array.isArray(lista)) return [];

  const limpiar = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const vistos = new Set();
  const tarjetas = [];

  for (const t of lista) {
    const frente = limpiar(t?.frente ?? t?.front ?? t?.pregunta, 300);
    const reverso = limpiar(t?.reverso ?? t?.back ?? t?.respuesta, 1000);
    if (frente.length < 3 || reverso.length < 1) continue;
    const clave = frente.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const tarjeta = { frente, reverso, tipo: limpiar(t?.tipo, 30).toLowerCase() || 'concepto' };
    if (paginasValidas) {
      const pagina = Number.parseInt(t?.pagina, 10);
      tarjeta.pagina = paginasValidas.has(pagina) ? pagina : null;
    }
    tarjetas.push(tarjeta);
    if (tarjetas.length === 20) break;
  }
  return tarjetas.length >= 3 ? tarjetas : [];
}

// ---------------------------------------------------------------------------
// Operaciones de alto nivel
// ---------------------------------------------------------------------------

// historial: [{ role, content }] ya ordenado (máx. 10) incluyendo la pregunta nueva.
// Si el límite por minuto se libera pronto, conviene esperar y conservar la
// búsqueda web en vez de caer al respaldo. Tope para no pasar los ~100 s.
const ESPERA_MAXIMA_429_S = 25;

const MAX_RONDAS_HERRAMIENTAS = 3;

const HERRAMIENTA_APUNTES = {
  type: 'function',
  function: {
    name: 'buscar_apuntes',
    description: 'Busca en la biblioteca de apuntes de Edu-Verse (apuntes de clase de los estudiantes). Úsala primero cuando la pregunta sea de un tema de clase.',
    parameters: {
      type: 'object',
      properties: { consulta: { type: 'string', description: 'Palabras clave en español' } },
      required: ['consulta'],
    },
  },
};

// Ejecuta buscar_apuntes con la función que inyecta la ruta, ya ligada al
// usuario autenticado: la IA solo controla el texto de la consulta.
async function ejecutarBuscarApuntes(argumentos, buscarApuntes, apuntes) {
  let consulta = '';
  try {
    consulta = JSON.parse(argumentos || '{}')?.consulta;
  } catch { /* argumentos mal formados */ }
  consulta = String(consulta || '').slice(0, 300);
  if (!consulta.trim()) return { error: 'Falta el parámetro "consulta".' };
  try {
    const resultados = await buscarApuntes(consulta);
    for (const f of resultados) {
      if (!apuntes.has(f.apunte_id)) apuntes.set(f.apunte_id, { titulo: f.titulo, pagina: f.pagina });
    }
    return resultados.length
      ? { resultados }
      : { resultados: [], mensaje: 'No hay apuntes sobre eso en la biblioteca. Usa la búsqueda web.' };
  } catch (err) {
    console.error('❌ buscar_apuntes:', err.message);
    return { error: 'La biblioteca no está disponible en este momento. Usa la búsqueda web.' };
  }
}

// historial: [{ role, content }] ya ordenado (máx. 10) incluyendo la pregunta nueva.
// buscarApuntes(consulta) es opcional; si viene, la IA puede consultar la
// biblioteca además de la web.
async function responderPregunta({ tema, nivel, historial, primera, buscarApuntes = null }) {
  const base = { temperature: 0.4, max_completion_tokens: 6000, reasoning_effort: 'medium' };

  // Ciclo de herramientas: browser_search lo ejecuta Groq; buscar_apuntes lo
  // ejecuta este backend y se le devuelve el resultado. Máximo 3 rondas;
  // después se pide la respuesta final sin herramientas.
  const llamarPrincipal = async () => {
    const mensajes = [
      { role: 'system', content: systemPrompt({ tema, nivel, conApuntes: Boolean(buscarApuntes) }) },
      ...historial,
    ];
    const herramientas = [{ type: 'browser_search' }, ...(buscarApuntes ? [HERRAMIENTA_APUNTES] : [])];
    const ejecutadas = [];
    const apuntes = new Map();

    for (let ronda = 0; ronda <= MAX_RONDAS_HERRAMIENTAS; ronda++) {
      const ultima = ronda === MAX_RONDAS_HERRAMIENTAS;
      const cuerpo = { ...base, model: config.modelo, messages: mensajes };
      if (ultima) {
        mensajes.push({ role: 'system', content: 'Ya no puedes usar más herramientas. Responde ahora con la información que reuniste.' });
      } else {
        cuerpo.tools = herramientas;
        cuerpo.tool_choice = primera && ronda === 0 ? 'required' : 'auto';
      }

      const datos = await llamarGroq(cuerpo);
      const mensaje = datos?.choices?.[0]?.message;
      ejecutadas.push(...(mensaje?.executed_tools || []));
      const llamadas = (mensaje?.tool_calls || []).filter((c) => c.type === 'function');

      if (llamadas.length && !ultima) {
        mensajes.push({ role: 'assistant', content: mensaje.content || '', tool_calls: llamadas });
        for (const llamada of llamadas) {
          const resultado = llamada.function?.name === 'buscar_apuntes' && buscarApuntes
            ? await ejecutarBuscarApuntes(llamada.function.arguments, buscarApuntes, apuntes)
            : { error: 'Herramienta no disponible.' };
          mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: JSON.stringify(resultado) });
        }
        continue;
      }

      if (!mensaje?.content) throw new ErrorIA('La IA devolvió una respuesta vacía.', { codigo: 'vacia' });
      return {
        ...procesarRespuesta({ content: mensaje.content, executed_tools: ejecutadas }, { apuntes }),
        sin_busqueda: false,
      };
    }
    throw new ErrorIA('La IA no terminó de responder.', { codigo: 'vacia' });
  };

  const inicio = Date.now();
  try {
    return await llamarPrincipal();
  } catch (err) {
    if (err.codigo === 'sin_configurar') throw err;
    const espera = err.esperaSegundos;
    const transcurrido = (Date.now() - inicio) / 1000;
    if (err.codigo === 'limite' && espera && espera <= ESPERA_MAXIMA_429_S && transcurrido < 20) {
      console.warn(`⏳ Límite por minuto de Groq; reintentando en ${Math.ceil(espera)} s.`);
      await dormir(Math.ceil(espera) * 1000 + 500);
      try {
        return await llamarPrincipal();
      } catch (err2) {
        if (!config.respaldo) throw err2;
        console.warn(`⚠️  Modelo principal falló de nuevo (${err2.codigo}); usando respaldo sin búsqueda.`);
      }
    } else {
      if (!config.respaldo) throw err;
      console.warn(`⚠️  Modelo principal falló (${err.codigo}); usando respaldo sin búsqueda.`);
    }
  }

  // El respaldo no puede usar herramientas: el backend busca en los apuntes
  // con la pregunta del usuario e inyecta los fragmentos en el prompt.
  const apuntes = new Map();
  let fragmentos = [];
  if (buscarApuntes) {
    const pregunta = historial[historial.length - 1]?.content || '';
    const r = await ejecutarBuscarApuntes(JSON.stringify({ consulta: `${tema} ${pregunta}` }), buscarApuntes, apuntes);
    fragmentos = r.resultados || [];
  }

  const datos = await llamarGroq({
    ...base,
    model: config.respaldo,
    messages: [{ role: 'system', content: systemPrompt({ tema, nivel, conBusqueda: false, fragmentos }) }, ...historial],
  });
  const mensaje = datos?.choices?.[0]?.message;
  if (!mensaje?.content) throw new ErrorIA('La IA devolvió una respuesta vacía.', { codigo: 'vacia' });
  const procesada = procesarRespuesta(mensaje, { apuntes });
  procesada.contenido =
    '> ⚠️ *Esta respuesta se generó **sin búsqueda web** (el modelo principal no estaba disponible). Verifica los datos importantes.*\n\n' +
    procesada.contenido;
  return { ...procesada, sin_busqueda: true };
}

// 2 intentos con el modelo principal y 1 con el de respaldo, en modo JSON y
// sin búsqueda web.
async function generarFlashcards({ tema, nivel, material, paginasValidas = null }) {
  const intentos = [config.modelo, config.modelo, config.respaldo].filter(Boolean);
  let ultimoError = null;

  for (const modelo of intentos) {
    try {
      const datos = await llamarGroq({
        model: modelo,
        messages: promptFlashcards({ tema, nivel, material, conPaginas: Boolean(paginasValidas) }),
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_completion_tokens: 6000,
        reasoning_effort: 'medium',
      });
      const texto = datos?.choices?.[0]?.message?.content || '';
      const tarjetas = validarTarjetas(JSON.parse(texto), { paginasValidas });
      if (tarjetas.length) return tarjetas;
      ultimoError = new ErrorIA('La IA no generó suficientes tarjetas válidas.', { codigo: 'tarjetas' });
    } catch (err) {
      if (err.codigo === 'sin_configurar') throw err;
      ultimoError = err instanceof ErrorIA ? err : new ErrorIA('La IA devolvió tarjetas con formato inválido.', { codigo: 'json' });
    }
  }
  throw ultimoError;
}

module.exports = {
  ErrorIA,
  config,
  NIVELES,
  llamarGroq,
  revisarModelos,
  systemPrompt,
  promptFlashcards,
  HERRAMIENTA_APUNTES,
  procesarRespuesta,
  resultadosBusqueda,
  validarTarjetas,
  responderPregunta,
  generarFlashcards,
};
