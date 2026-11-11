# Tutor IA (fases 1 y 2)

Módulo de estudio con IA: el estudiante escribe un tema, el tutor investiga en
la web (Groq + `browser_search`) y responde con explicación, citas numeradas,
fuentes, subtemas sugeridos y flashcards. Todo se guarda en PostgreSQL por
usuario. Especificación completa: `EDU-VERSE-TUTOR-IA.md` (raíz).

## Configuración

Variables del backend (en `.env` de la raíz, que lee `docker-compose.yml`;
plantilla en `.env.example`):

| Variable | Valor por defecto | Uso |
|---|---|---|
| `GROQ_API_KEY` | — (obligatoria) | Clave de https://console.groq.com/keys. Sin ella los endpoints responden 503. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo principal, con búsqueda web. |
| `GROQ_MODEL_RESPALDO` | `openai/gpt-oss-20b` | Respaldo sin búsqueda si el principal falla (429, etc.). |
| `TUTOR_LIMITE_POR_MINUTO` | `10` | Peticiones de IA por usuario por minuto. |

La API key **solo** vive en el backend; el frontend nunca la ve.

Al arrancar, el backend:
1. Aplica las migraciones de `edu-verse_backend/migraciones/*.sql` (idempotentes).
2. Consulta `GET /openai/v1/models` para validar los modelos y, si el principal
   no existe, usa el de respaldo.

## Base de datos

`edu-verse_backend/migraciones/001_tutor_ia.sql` crea `tutor_sesiones`,
`tutor_mensajes`, `mazos` y `flashcards` (PK con el estilo del proyecto:
`sesion_id`, `mensaje_id`, `mazo_id`, `flashcard_id`; FK a
`usuarios(usuario_id)` con `ON DELETE CASCADE`).

## Backend

| Archivo | Contenido |
|---|---|
| `services/groq.js` | `llamarGroq`, `revisarModelos`, `systemPrompt`, `procesarRespuesta`, `resultadosBusqueda`, `promptFlashcards`, `validarTarjetas`, `responderPregunta`, `generarFlashcards`. Sin Express ni BD. |
| `routes/tutor.js` | Endpoints HTTP, montados en `/api`. |
| `middleware/limiteTutor.js` | Límite por usuario (ventana de 60 s en memoria). |
| `services/migraciones.js` | Aplica las migraciones SQL al arrancar. |

Endpoints (todos con `verificarToken`; un recurso de otro usuario responde 404):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tutor/sesiones` | Sesiones del usuario (tema, nivel, fechas, nº de respuestas y tarjetas) |
| POST | `/api/tutor/sesiones` | `{ tema, nivel, preguntas? }` → crea sesión con la primera respuesta |
| GET | `/api/tutor/sesiones/:id` | Sesión con mensajes y `mazo_id` |
| POST | `/api/tutor/sesiones/:id/mensajes` | `{ contenido, display? }` → pregunta de seguimiento |
| DELETE | `/api/tutor/sesiones/:id` | Borra sesión, mensajes y su mazo |
| POST | `/api/tutor/sesiones/:id/flashcards` | Genera el mazo (reemplaza el anterior) |
| GET | `/api/mazos/:id` | Mazo con tarjetas |
| PATCH | `/api/flashcards/:id` | `{ frente?, reverso? }` |
| DELETE | `/api/flashcards/:id` | Borra tarjeta |

Detalles:
- El historial que se manda a la IA se arma desde la BD (últimos 10 mensajes).
- Primero se llama a la IA y después, en **una transacción**, se guardan la
  pregunta y la respuesta: si la IA falla no queda una pregunta huérfana.
- `tool_choice: "required"` en la primera pregunta, `"auto"` en las demás.
- Si el modelo principal falla se usa el de respaldo y la respuesta lleva un
  aviso "sin búsqueda web" (`sin_busqueda = true`).
- Flashcards: sin búsqueda, con modo JSON, sobre las respuestas de la sesión
  (máx. 24 000 caracteres); 2 intentos con el principal y 1 con el respaldo.
- Errores de Groq en español: 429 (límite gratuito), 504 (timeout), 502.
- Ante un 429 del modelo principal, si Groq indica que la cuota se libera en
  ≤ 25 s, se espera y se reintenta con búsqueda; si no, se usa el respaldo.
- El respaldo recibe un prompt **sin** instrucciones de búsqueda: si se le pide
  investigar intenta llamar una herramienta que no tiene y Groq responde 400.
- **Cuota gratuita:** `gpt-oss-120b` tiene 8 000 tokens/minuto y 200 000
  tokens/día. Cada respuesta con búsqueda web consume mucho (el contenido de las
  páginas entra al contexto), así que la cuota diaria se agota rápido; después
  de eso las respuestas salen del respaldo, sin búsqueda, hasta que se libera.
- Timeouts de ~120 s en el servidor Node, el proxy de Vite (`/api`) y nginx.

## Frontend

- Rutas `/tutor` y `/tutor/:sesionId` (protegidas) → `pages/TutorIA.jsx`.
- Componentes en `components/tutor/`: `FormularioTema`, `SesionEstudio`
  (incluye `IndicadorCarga`), `Respuesta`, `Markdown` (renderizador propio que
  genera elementos React, sin HTML crudo), `Flashcards`, `utilidades.js`.
- Cliente `TutorAPI` y `mensajeErrorTutor` en `services/api.js`.
- Funciones: niveles, acciones rápidas (más simple, ejemplos, quiz, resumen),
  subtemas clicables, citas `[n]` en superíndice, lista de fuentes, descarga de
  apuntes `.md`, flashcards con volteo 3D, "Lo sabía / Repasar", atajos
  (Espacio, ←/→, 1, 2, Esc), edición/borrado de tarjetas y exportación a Anki.
- Tarjeta "Tutor IA" del Home y enlace del Navbar habilitados.

## Pruebas manuales hechas

Con dos usuarios reales de la BD y el backend local: sin token → 401; el
usuario B recibe 404 al leer, borrar o preguntar en la sesión de A, y al leer,
editar o borrar su mazo/tarjetas; sin `GROQ_API_KEY` → 503 y no se guarda
nada; el límite por usuario devuelve 429 en la petición 11 del minuto.

---

# Fase 2 — El tutor busca también en la biblioteca de apuntes

El texto de cada apunte (PDF o imagen) se extrae y se indexa en PostgreSQL. La
IA tiene una función `buscar_apuntes` además de `browser_search`, y cita los
apuntes con enlace a su página dentro de Edu-Verse.

## Reglas de acceso

Hoy **todos los apuntes son públicos** para la comunidad: la biblioteca
(`GET /apuntes`, `/apuntes/buscar`, `/apuntes/:id`) no filtra por dueño y la
subida avisa que el apunte queda visible para todos. No hay apuntes privados ni
por equipo. La regla está centralizada en `condicionAcceso()` de
`services/busquedaApuntes.js`: **si algún día se agregan apuntes privados, la
regla nueva va ahí** (y en la biblioteca). El `usuarioId` de la búsqueda sale
siempre del token, nunca de la IA (probado en `test/tutor.test.js`).

## Base de datos

`migraciones/002_indexado_apuntes.sql` (se aplica sola al arrancar el backend):
extensión `unaccent` + función inmutable `f_unaccent`; columnas nuevas en
`apuntes` (`estado_indexado`, `error_indexado`, `indexado_en`,
`indexando_desde`); tabla `apunte_fragmentos` con columna `tsvector` generada
(español, sin acentos) e índice GIN. Los apuntes que ya existían quedan
`pendiente` y el worker los procesa solos.

## Worker de indexado

`worker/indexador.js` — servicio `worker` en los dos `docker-compose` (misma
imagen que el backend, otro comando), para que el OCR no bloquee la API.

1. Cada ~5 s toma **un** apunte `pendiente` con `FOR UPDATE SKIP LOCKED` (seguro
   con varios workers).
2. `services/extraccion.js` → `extraerTexto(ruta)`:
   - **PDF:** `pdfjs-dist` (build legacy) página por página. Página con menos de
     30 caracteres = escaneada → `pdftoppm` a 200 dpi (`poppler-utils`, en el
     Dockerfile) → OCR.
   - **Imágenes:** OCR directo.
   - **OCR:** `tesseract.js` con `spa+eng`, un solo worker reutilizado. Los
     modelos vienen en los paquetes npm `@tesseract.js-data/spa|eng`: no se
     descargan de internet al arrancar.
3. `services/fragmentos.js`: limpia el texto y lo divide en fragmentos de ~800
   palabras con ~100 de solapamiento, guardando la página.
4. En una transacción borra los fragmentos anteriores, inserta los nuevos y
   marca `listo`. Si falla: `error` + mensaje amigable (sin rutas internas, la
   columna se ve en la API) y sigue con el siguiente.
5. Límite de 3 min por apunte. Los que quedan en `procesando` más de 10 min
   (worker caído) vuelven a la cola.

Comandos:

| Comando | Para qué |
|---|---|
| `npm run worker` | Correr el worker fuera de Docker |
| `npm run indexar:todos` | Marcar todos los apuntes como pendientes (reindexar la biblioteca) |
| `GET /api/admin/indexado` | (admin) Conteo por estado y lista de errores |
| `POST /api/admin/indexado/reintentar` | (admin) Devolver a la cola los apuntes en `error`; `{ apunte_id }` para uno solo |

Al reemplazar el archivo de un apunte habría que volver a ponerlo en
`pendiente`; hoy Edu-Verse no permite reemplazar archivos (solo subir y borrar),
y al borrar un apunte sus fragmentos se borran en cascada.

> **Limitación conocida:** Tesseract lee bien texto impreso pero **mal la letra
> manuscrita**. Se avisa en la subida y en "Mis apuntes". Para cambiar de motor
> de OCR basta con reemplazar `ocrImagen()` en `services/extraccion.js`.

## Búsqueda y herramienta de la IA

- `buscarApuntes({ consulta, usuarioId, limite = 5 })`: `websearch_to_tsquery`
  en español sin acentos (términos unidos con OR, ordenados por `ts_rank`),
  solo apuntes `listo`, fragmentos recortados a 1 500 caracteres.
- Se verificó que Groq **acepta** `browser_search` + la función `buscar_apuntes`
  juntas en `gpt-oss-120b`, así que se usa el ciclo de herramientas: el backend
  ejecuta `buscar_apuntes`, devuelve el resultado como mensaje `tool` y vuelve a
  llamar; máximo 3 rondas y luego respuesta final sin herramientas.
- El modelo de respaldo no puede usar herramientas: el backend busca en los
  apuntes con la pregunta e inyecta los fragmentos en el prompt.
- La IA cita `[Título](edu-verse://apunte/<id>?pagina=<n>)`;
  `procesarRespuesta()` lo convierte en `[n]` con fuente
  `{ tipo: 'apunte', apunte_id, titulo, pagina, url }`. El título sale de la BD
  y **solo se aceptan apuntes que la búsqueda devolvió en esa respuesta**: una
  cita a un id inventado se descarta.

## Frontend

- `Respuesta`: fuentes en **📚 De la biblioteca** (enlace a `/apunte/:id?pagina=n`)
  y **🌐 De la web**, con una sola numeración para las citas `[n]`.
- `DetalleApunte`: con `?pagina=n` el botón abre el PDF en esa página.
- "Mis apuntes": estado discreto del indexado (`EstadoIndexado.jsx`) y aviso de
  letra manuscrita; también en la página de subida.

## Pruebas hechas (fase 2)

- Worker con los apuntes locales: imagen por OCR (1,5 s) y dos PDF digitales
  (9 y 4 páginas) indexados con su página.
- PDF corrupto, archivo inexistente y ruta `../` → `error` con mensaje amigable,
  sin detener el worker.
- Búsqueda: encuentra con y sin acentos, 0–10 ms, nada sin usuario.
- Con Groq real: el modelo llamó `buscar_apuntes` dos veces y la respuesta citó
  "Sprint Modular" (pág. 1) y otro apunte con enlace a su página.
- `npm test`: 16 pruebas (incluye que el usuario de la búsqueda sale del token
  aunque la IA mande otro, y el corte a las 3 rondas).
- **Pendiente:** OCR de PDF escaneados con `pdftoppm` (solo existe dentro del
  contenedor Linux) y `docker compose up` (Docker no estaba corriendo).
