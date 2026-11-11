# Integración del Tutor IA en Edu-Verse

> **Para Claude Code:** este documento describe cómo integrar el Tutor IA (proyecto aparte, ya funcionando) dentro de Edu-Verse, en **tres fases**. Trabaja **una fase a la vez**: al terminar cada fase, detente, muestra un resumen de los cambios y espera la aprobación antes de seguir con la siguiente.

---

## 0. Contexto y reglas generales

### Qué es Edu-Verse
Plataforma para estudiantes de la UDG: biblioteca de apuntes, equipos con tablero Kanban y chat.

- **Stack:** Node.js (backend) · React (frontend) · PostgreSQL · Docker / docker-compose.
- **Apuntes:** solo **imágenes y PDF**, de **máximo 10 MB**.

### Qué es el Tutor IA (implementación de referencia)
Una app React + Vite con un servidor Express que ya funciona. El usuario da un tema (y opcionalmente dudas concretas), el tutor investiga en la web y responde con explicación, citas numeradas, fuentes, subtemas sugeridos y **flashcards**.

Archivos de referencia (están en el proyecto `tutor-ia`; pide al usuario la ruta si no la tienes):

| Archivo | Qué contiene |
|---|---|
| `server/index.js` | Llamada a Groq, prompt de sistema, procesamiento de citas/subtemas, endpoint de flashcards, modelo de respaldo |
| `src/App.jsx` | Estado de sesiones y flujo de envío |
| `src/components/SesionEstudio.jsx` | Vista de conversación, acciones rápidas, botón de flashcards |
| `src/components/Respuesta.jsx` | Render de Markdown, citas `[n]` y fuentes |
| `src/components/Flashcards.jsx` | Tarjetas con volteo 3D, modo repaso, exportación |
| `src/App.css` | Estilos (adaptarlos al sistema de diseño de Edu-Verse) |

**Reutiliza la lógica, no copies a ciegas.** El Tutor IA guarda todo en `localStorage` y no tiene usuarios; en Edu-Verse todo debe ir a PostgreSQL y respetar la autenticación existente.

### Cómo funciona la IA (Groq)
- API compatible con OpenAI: `POST https://api.groq.com/openai/v1/chat/completions`, encabezado `Authorization: Bearer <GROQ_API_KEY>`.
- **No usar SDK**: se usa `fetch` directo (ya probado y funcionando).
- Modelo principal: `openai/gpt-oss-120b`, con la herramienta integrada `{ "type": "browser_search" }` (Groq ejecuta la búsqueda en sus servidores).
- Modelo de respaldo: `openai/gpt-oss-20b` **sin búsqueda**, cuando el principal falla (límite 429, etc.). La respuesta debe avisar que se generó sin búsqueda.
- `tool_choice: "required"` en la **primera** pregunta de cada tema; `"auto"` en las de seguimiento.
- Modo JSON (para flashcards): `response_format: { "type": "json_object" }`.
- Parámetros usados: `temperature: 0.4`, `max_completion_tokens: 6000`, `reasoning_effort: "medium"`.
- La API **no tiene memoria**: se reenvía el historial (últimos 10 mensajes) en cada petición.
- La cuenta usa el **plan gratuito**: hay límites por minuto y por día. Manejar el 429 con un mensaje claro en español.
- Al arrancar, el Tutor IA consulta `GET /openai/v1/models` para validar que los modelos existan. Conserva ese comportamiento.

### Reglas para todas las fases
1. **Explora el repositorio primero.** Antes de escribir código, identifica: estructura del backend (rutas, controladores, servicios), cómo se conecta a PostgreSQL (`pg`, Prisma, Sequelize, Knex…), cómo se hacen las migraciones, cómo funciona la autenticación (middleware, JWT, sesión), cómo está modelada la tabla de apuntes y **cuáles son las reglas de acceso a un apunte** (públicos, privados, por equipo, etc.). Ajusta todos los nombres de este documento a lo que encuentres. Los nombres de tablas y columnas aquí son **sugerencias**.
2. **Sigue las convenciones del proyecto** (estructura de carpetas, estilo de código, librerías ya instaladas, manejo de errores, idioma de los nombres).
3. **La API key nunca llega al frontend.** `GROQ_API_KEY` vive en las variables de entorno del backend (docker-compose / `.env`), nunca en código de React.
4. **Todo endpoint del tutor requiere usuario autenticado** y usa el middleware de auth existente.
5. **Textos de la interfaz en español.**
6. **No rompas lo que existe.** Las migraciones solo agregan; no modifiques columnas actuales sin preguntar.
7. Agrega **límite de peticiones por usuario** a los endpoints de IA (por ejemplo, 10 por minuto) para proteger la cuota gratuita.
8. Al terminar cada fase: corre las pruebas existentes, verifica que `docker compose up` levante todo y actualiza la documentación del proyecto.

### Variables de entorno nuevas
```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
GROQ_MODEL_RESPALDO=openai/gpt-oss-20b
TUTOR_LIMITE_POR_MINUTO=10
```
Agrégalas a `docker-compose.yml` (o al `.env` que use el backend) y a la plantilla `.env.example`.

---

## Fase 1 — Tutor IA + flashcards dentro de Edu-Verse

**Objetivo:** llevar el Tutor IA actual (búsqueda web + flashcards) a Edu-Verse como un módulo más, con usuarios, permisos y datos guardados en PostgreSQL.

### 1.1 Base de datos (migración)
```sql
CREATE TABLE tutor_sesiones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,  -- ajustar a la tabla real
  tema        TEXT NOT NULL,
  nivel       TEXT NOT NULL DEFAULT 'intermedio' CHECK (nivel IN ('basico','intermedio','avanzado')),
  creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tutor_mensajes (
  id          SERIAL PRIMARY KEY,
  sesion_id   INT NOT NULL REFERENCES tutor_sesiones(id) ON DELETE CASCADE,
  rol         TEXT NOT NULL CHECK (rol IN ('user','assistant')),
  contenido   TEXT NOT NULL,          -- texto enviado a la IA / respuesta en Markdown
  display     TEXT,                   -- texto corto que se muestra en la burbuja del usuario
  fuentes     JSONB DEFAULT '[]',     -- [{ url, titulo, tipo: 'web' }]
  subtemas    JSONB DEFAULT '[]',
  sin_busqueda BOOLEAN DEFAULT false,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mazos (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sesion_id   INT REFERENCES tutor_sesiones(id) ON DELETE SET NULL,
  tema        TEXT NOT NULL,
  origen      TEXT NOT NULL DEFAULT 'tutor',  -- 'tutor' | 'apunte' (fase 3)
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE flashcards (
  id          SERIAL PRIMARY KEY,
  mazo_id     INT NOT NULL REFERENCES mazos(id) ON DELETE CASCADE,
  frente      TEXT NOT NULL,
  reverso     TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'concepto',
  orden       INT NOT NULL DEFAULT 0
);
CREATE INDEX ON tutor_sesiones (usuario_id, actualizado DESC);
CREATE INDEX ON tutor_mensajes (sesion_id, id);
CREATE INDEX ON flashcards (mazo_id, orden);
```

### 1.2 Backend
Crea un módulo `tutor` siguiendo la estructura del proyecto (por ejemplo `routes/tutor.js`, `services/groq.js`, `services/tutor.js`).

- **`services/groq.js`**: porta `llamarGroq()`, `revisarModelos()`, `systemPrompt()`, `procesarRespuesta()`, `resultadosBusqueda()`, `promptFlashcards()` y `validarTarjetas()` desde `server/index.js` del Tutor IA, separando la lógica de IA de la de HTTP.
- **Endpoints** (todos con auth; el usuario solo ve y modifica **sus** sesiones y mazos):

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tutor/sesiones` | Lista de sesiones del usuario (id, tema, nivel, fecha, nº de respuestas) |
| `POST` | `/api/tutor/sesiones` | Crea sesión `{ tema, nivel, preguntas? }` y genera la primera respuesta |
| `GET` | `/api/tutor/sesiones/:id` | Sesión con todos sus mensajes |
| `POST` | `/api/tutor/sesiones/:id/mensajes` | Agrega pregunta `{ contenido, display? }` y devuelve la respuesta |
| `DELETE` | `/api/tutor/sesiones/:id` | Borra sesión (y sus mensajes) |
| `POST` | `/api/tutor/sesiones/:id/flashcards` | Genera mazo con lo investigado (reemplaza el anterior de esa sesión) |
| `GET` | `/api/mazos/:id` | Mazo con sus tarjetas |
| `PATCH` | `/api/flashcards/:id` | Editar frente/reverso de una tarjeta |
| `DELETE` | `/api/flashcards/:id` | Borrar tarjeta |

- El historial para la IA se arma **desde la base de datos** (últimos 10 mensajes), no desde lo que mande el cliente.
- Guarda el mensaje del usuario y la respuesta en una **transacción**. Si la IA falla, no debe quedar guardada una pregunta sin respuesta.
- Las flashcards se generan **sin búsqueda web**, solo con las respuestas `assistant` de la sesión (máx. ~24 000 caracteres), con modo JSON, 2 intentos con el modelo principal y 1 con el de respaldo, igual que en la referencia.
- Las peticiones a Groq pueden tardar **30–60 s** con búsqueda: configura timeouts del servidor/proxy (nginx u otro) para que no corten antes (mínimo 90 s).

### 1.3 Frontend
- Nueva sección **"Tutor IA"** en la navegación de Edu-Verse, con rutas del router existente (por ejemplo `/tutor` y `/tutor/:sesionId`).
- Porta `FormularioTema`, `SesionEstudio`, `Respuesta` y `Flashcards` adaptando estilos al diseño de Edu-Verse.
- Sustituye `localStorage` por llamadas a la API. Usa el cliente HTTP que ya tenga el proyecto (con el token de auth).
- Conserva: niveles, acciones rápidas (más simple, ejemplos, quiz, resumen), subtemas clicables, citas `[n]` como superíndice, lista de fuentes, descarga de apuntes `.md`, flashcards con volteo, "Lo sabía / Repasar", atajos de teclado, exportar a Anki y edición de tarjetas.
- Indicador de carga con pasos ("Buscando fuentes…") y mensajes de error claros (sin conexión, 429, etc.).

### 1.4 Criterios de aceptación
- [ ] Un usuario autenticado crea una sesión, recibe una respuesta con fuentes web y hace preguntas de seguimiento.
- [ ] Al recargar la página o entrar desde otro dispositivo, sus sesiones y flashcards siguen ahí.
- [ ] Un usuario **no** puede leer ni borrar sesiones o mazos de otro (probar con dos cuentas → 403/404).
- [ ] Se generan flashcards, se pueden estudiar, editar, borrar y exportar.
- [ ] Si el modelo principal falla, responde el de respaldo con aviso de "sin búsqueda web".
- [ ] La API key no aparece en ningún archivo del frontend ni en las respuestas HTTP.
- [ ] `docker compose up` levanta todo con las variables nuevas.

---

## Fase 2 — El tutor busca también en la biblioteca de apuntes

**Objetivo:** indexar el contenido de los apuntes (PDF e imágenes) y darle a la IA una herramienta `buscar_apuntes` para que combine la biblioteca con la web, **respetando los permisos de cada apunte**.

### 2.1 Base de datos (migración)
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Función inmutable para poder usar unaccent en índices
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

ALTER TABLE apuntes                             -- ajustar a la tabla real
  ADD COLUMN estado_indexado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_indexado IN ('pendiente','procesando','listo','error')),
  ADD COLUMN error_indexado TEXT,
  ADD COLUMN indexado_en TIMESTAMPTZ;

CREATE TABLE apunte_fragmentos (
  id          SERIAL PRIMARY KEY,
  apunte_id   INT NOT NULL REFERENCES apuntes(id) ON DELETE CASCADE,
  pagina      INT,
  orden       INT NOT NULL,
  texto       TEXT NOT NULL,
  metodo      TEXT NOT NULL,            -- 'pdf_texto' | 'ocr'
  busqueda    TSVECTOR GENERATED ALWAYS AS (to_tsvector('spanish', f_unaccent(texto))) STORED
);
CREATE INDEX idx_frag_busqueda ON apunte_fragmentos USING GIN (busqueda);
CREATE INDEX ON apunte_fragmentos (apunte_id);
CREATE INDEX ON apuntes (estado_indexado);
```

### 2.2 Worker de indexado
Nuevo proceso `worker` (mismo código/imagen del backend, otro comando, por ejemplo `node src/worker/indexador.js`) como **servicio aparte en `docker-compose.yml`**, para que el OCR no bloquee la API.

**Ciclo del worker:**
1. Cada ~5 s toma **un** apunte `pendiente` de forma segura para varios workers:
   `UPDATE apuntes SET estado_indexado='procesando' WHERE id = (SELECT id FROM apuntes WHERE estado_indexado='pendiente' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *;`
2. Obtiene el archivo desde donde Edu-Verse lo guarda (disco, volumen o almacenamiento externo; revisar el código de subida).
3. **Extrae el texto:**
   - **PDF:** `pdfjs-dist` (build legacy para Node) → `getTextContent()` por página. Si una página tiene menos de ~30 caracteres, se considera **escaneada** y va a OCR.
   - **Páginas escaneadas:** convertir a imagen con `pdftoppm` (paquete `poppler-utils`, agregar al Dockerfile) a ~200 dpi, luego OCR.
   - **Imágenes (JPG/PNG/WebP…):** OCR directo.
   - **OCR:** `tesseract.js` con idiomas `spa+eng`. Reutiliza **un solo worker** de Tesseract para no recargar modelos. Si es posible, deja los datos de idioma dentro de la imagen de Docker para no descargarlos en cada arranque.
4. Limpia el texto (espacios repetidos, guiones de corte de línea) y lo divide en **fragmentos de ~800 palabras con ~100 de solapamiento**, guardando la página de origen.
5. En una transacción: borra fragmentos anteriores del apunte, inserta los nuevos y marca `listo` + `indexado_en`. Si falla: `error` + `error_indexado` (sin tumbar el worker).
6. Límite de tiempo por apunte (por ejemplo 3 min) y log claro de cada paso.

**Disparadores:**
- Al **subir** un apunte: queda `pendiente` (valor por defecto).
- Al **reemplazar/editar** el archivo: volver a `pendiente`.
- Script único `npm run indexar:todos` que marca como `pendiente` todos los apuntes existentes (para la biblioteca actual).
- Endpoint para administradores: reintentar los que quedaron en `error`.

### 2.3 Búsqueda en apuntes (con permisos)
`services/busquedaApuntes.js` → `buscarApuntes({ consulta, usuarioId, limite = 5 })`:
```sql
SELECT f.id, f.texto, f.pagina, a.id AS apunte_id, a.titulo,
       ts_rank(f.busqueda, q) AS relevancia
FROM apunte_fragmentos f
JOIN apuntes a ON a.id = f.apunte_id,
     websearch_to_tsquery('spanish', f_unaccent($1)) q
WHERE f.busqueda @@ q
  AND a.estado_indexado = 'listo'
  AND ( /* ⚠️ REGLAS DE ACCESO REALES DE EDU-VERSE — copiar exactamente las que usa la biblioteca */ )
ORDER BY relevancia DESC
LIMIT $3;
```
- **Crítico:** el filtro de permisos debe ser **el mismo** que usa la biblioteca para listar/ver apuntes. Si existe una función o consulta reutilizable, úsala; no inventes reglas nuevas.
- Recorta cada fragmento devuelto a ~1 500 caracteres para cuidar tokens.

### 2.4 Herramienta para la IA
En la llamada a Groq del tutor, además de `browser_search`, agrega una función:
```js
{
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
}
```
**Ciclo de herramientas** (`browser_search` lo ejecuta Groq; `buscar_apuntes` lo ejecuta **nuestro backend**):
1. Llamar a Groq con `tool_choice: 'auto'`.
2. Si `choices[0].message.tool_calls` trae `buscar_apuntes`: ejecutar `buscarApuntes()` con el **usuario autenticado** (nunca con un id que venga de la IA), agregar a `messages` el mensaje del asistente con sus `tool_calls` y un mensaje `{ role: 'tool', tool_call_id, content: JSON.stringify(resultados) }`, y volver a llamar.
3. Máximo **3 rondas** de herramientas por pregunta; después, pedir respuesta final sin herramientas.
4. **Verificar** que en esta cuenta Groq acepte combinar `browser_search` con herramientas de función en `gpt-oss-120b`. Si no lo acepta: hacer primero la búsqueda en apuntes desde el backend (con la pregunta del usuario) e inyectar los fragmentos en el prompt de sistema, y luego llamar con `browser_search` normal.

**Prompt de sistema (agregar):**
- Prioriza la información de los apuntes de la biblioteca cuando sea relevante y complétala con la web.
- Cita los apuntes como `[apunte](edu-verse://apunte/<id>?pagina=<n>)` y la web como hasta ahora.

**Procesamiento de la respuesta:** extiende `procesarRespuesta()` para reconocer los enlaces `edu-verse://apunte/...` y devolver fuentes con `tipo: 'apunte'` (id, título, página) además de `tipo: 'web'`.

### 2.5 Frontend
- En `Respuesta`, separa las fuentes en **📚 De la biblioteca** (enlace a la página del apunte en Edu-Verse, con nº de página) y **🌐 De la web**.
- Las citas `[n]` siguen funcionando para ambos tipos.
- En la biblioteca, muestra el estado de indexado de cada apunte del usuario (pendiente / listo / error) de forma discreta.

### 2.6 Criterios de aceptación
- [ ] Al subir un PDF digital, en segundos queda `listo` con fragmentos y páginas correctas.
- [ ] Una imagen o PDF escaneado con texto impreso se indexa vía OCR.
- [ ] Un apunte corrupto queda en `error` sin detener el worker.
- [ ] Preguntando por un tema presente en la biblioteca, la respuesta cita el apunte con enlace funcional a su página.
- [ ] **Permisos:** con dos usuarios, un apunte privado del usuario A **nunca** aparece en las respuestas del usuario B (prueba automatizada).
- [ ] La API sigue respondiendo con normalidad mientras el worker procesa un PDF de 10 MB.
- [ ] `npm run indexar:todos` procesa la biblioteca existente.

> **Limitación conocida:** Tesseract funciona bien con texto impreso, pero **mal con letra manuscrita**. Documentar esto en la interfaz y dejar el indexado preparado para cambiar el motor de OCR en el futuro (función `extraerTexto(archivo)` intercambiable).

---

## Fase 3 — Búsqueda semántica, flashcards desde apuntes y repaso espaciado

**Objetivo:** que la búsqueda en apuntes entienda el significado (no solo palabras exactas), poder crear flashcards directo de un apunte y convertirlas en un sistema de estudio con repetición espaciada, compartible en equipos.

### 3.1 Búsqueda semántica con pgvector
- Cambia la imagen de PostgreSQL a **`pgvector/pgvector:pg<versión actual>`** (misma versión mayor que usan hoy para no migrar datos). Verificar que el volumen de datos sea compatible.
- Migración:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE apunte_fragmentos ADD COLUMN embedding vector(384);
  CREATE INDEX ON apunte_fragmentos USING hnsw (embedding vector_cosine_ops);
  ```
- **Embeddings gratis y locales** (sin API externa): `@huggingface/transformers` con un modelo multilingüe pequeño, por ejemplo `Xenova/multilingual-e5-small` (384 dimensiones).
  - Este modelo requiere prefijos: `"passage: "` al indexar fragmentos y `"query: "` al buscar.
  - Normalizar vectores. Cachear el modelo en un volumen de Docker.
  - Verificar que funcione dentro del contenedor Linux. Si su binario nativo da problemas, documentar una alternativa.
- El worker calcula el embedding de cada fragmento al indexar. Agrega un script para rellenar los fragmentos que ya existen sin embedding.
- **Búsqueda híbrida** en `buscarApuntes()`: obtener top 20 por texto (`ts_rank`) y top 20 por vector (distancia coseno), **ambos con el mismo filtro de permisos**, y combinarlos con *Reciprocal Rank Fusion* (`puntaje = Σ 1 / (60 + posición)`). Devolver los 5 mejores.

### 3.2 Flashcards desde un apunte
- Endpoint `POST /api/apuntes/:id/flashcards` (verifica permiso de lectura del apunte).
- Usa los fragmentos ya indexados del apunte (máx. ~24 000 caracteres; si es más largo, permitir elegir rango de páginas).
- Mismo prompt, modo JSON y validación que en la fase 1, pidiendo además la **página de origen** de cada tarjeta.
- Crea un mazo con `origen = 'apunte'` y `apunte_id`. Agregar columnas:
  ```sql
  ALTER TABLE mazos ADD COLUMN apunte_id INT REFERENCES apuntes(id) ON DELETE SET NULL;
  ALTER TABLE flashcards ADD COLUMN apunte_id INT REFERENCES apuntes(id) ON DELETE SET NULL,
                         ADD COLUMN pagina INT;
  ```
- En la vista del apunte: botón **"Crear flashcards de este apunte"**. Cada tarjeta muestra el enlace "Ver en el apunte (pág. n)".

### 3.3 Repetición espaciada (sistema Leitner)
```sql
CREATE TABLE repasos (
  flashcard_id   INT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  usuario_id     INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  caja           INT NOT NULL DEFAULT 1 CHECK (caja BETWEEN 1 AND 5),
  proximo_repaso DATE NOT NULL DEFAULT CURRENT_DATE,
  aciertos       INT NOT NULL DEFAULT 0,
  fallos         INT NOT NULL DEFAULT 0,
  ultimo_repaso  TIMESTAMPTZ,
  PRIMARY KEY (flashcard_id, usuario_id)
);
CREATE INDEX ON repasos (usuario_id, proximo_repaso);
```
- Intervalos por caja: **1 → 1 día, 2 → 3 días, 3 → 7 días, 4 → 14 días, 5 → 30 días**.
- "Lo sabía": `caja = LEAST(caja + 1, 5)`. "Repasar": `caja = 1`. Recalcular `proximo_repaso`.
- `POST /api/flashcards/:id/repaso` con `{ resultado: 'sabia' | 'repasar' }`.
- `GET /api/repasos/hoy` → tarjetas con `proximo_repaso <= hoy` de todos los mazos del usuario.
- En la interfaz: sección **"Repasar hoy (N)"** en el inicio del Tutor IA o en el panel principal de Edu-Verse, y por mazo, una barra de cajas (cuántas tarjetas hay en cada nivel).

### 3.4 Mazos compartidos en equipos
- Tabla `mazo_compartido (mazo_id, equipo_id, compartido_por, creado)` (ajustar a la tabla real de equipos).
- Compartir un mazo con un equipo del que el usuario sea miembro. Los miembros lo **ven y estudian**; solo el autor lo **edita**.
- **El progreso (`repasos`) es individual** aunque el mazo sea compartido.
- Opcional: avisar en el chat del equipo que se compartió un mazo, usando el sistema de mensajes existente y su filtro de chat.

### 3.5 Criterios de aceptación
- [ ] Buscar "cómo quitar redundancia en tablas" encuentra un apunte que habla de "formas normales" aunque no comparta palabras.
- [ ] La búsqueda híbrida respeta permisos (misma prueba de dos usuarios de la fase 2).
- [ ] Se crean flashcards desde un apunte, con enlace a la página de origen.
- [ ] El repaso espaciado mueve tarjetas entre cajas y "Repasar hoy" muestra solo las que tocan.
- [ ] Un mazo compartido con un equipo es visible para sus miembros, y cada uno tiene su propio progreso.
- [ ] El rendimiento de la búsqueda sigue por debajo de ~300 ms con la biblioteca completa.

---

## Anexo — Problemas ya resueltos en el Tutor IA (no repetirlos)

| Problema | Solución aplicada |
|---|---|
| Groq devuelve marcas internas tipo `【1†L3-L5】` | Se eliminan con `/【[^】]*】/g` antes de mostrar |
| La IA no siempre cita, o cita con texto distinto | Se convierten los enlaces Markdown a `[n]` numerados; si no citó nada, se listan las páginas consultadas (`executed_tools`) |
| Modelos que desaparecen de la cuenta (`does not exist`) | Validar contra `GET /models` al arrancar y elegir respaldo disponible |
| Flashcards con JSON malformado o duplicadas | Modo JSON + `validarTarjetas()` (limpia, deduplica, mínimo 3, máximo 20) + reintentos |
| `ECONNRESET` en el proxy del frontend | Ocurre si el backend se reinicia a mitad de una petición; en producción usar timeouts ≥ 90 s |
| Subtemas en la respuesta | La IA termina con `SUBTEMAS: a \| b \| c`; el backend la separa y la devuelve como arreglo |
