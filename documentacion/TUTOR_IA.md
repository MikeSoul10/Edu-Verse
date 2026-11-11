# Tutor IA — Fase 1

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
