# Plan de Mejora — Módulo de Gestor de Equipos

**Fecha:** 24 de septiembre de 2026
**Módulo:** `GestorEquipos.jsx` (`edu-verse/src/pages/GestorEquipos.jsx`)
**Referencia de mercado:** ClickUp (gestor de equipos/proyectos "todo-en-uno")

---

## 1. Estado actual del módulo

| Capacidad | Detalle actual |
|-----------|----------------|
| Equipos | Crear equipo con código de invitación de 6 caracteres |
| Membresía | Unirse por código, roles (`admin` / `miembro`), lista de miembros en sidebar |
| Tareas | Crear, editar, eliminar y mover tareas |
| Kanban | 3 estados fijos: `pendiente`, `en_progreso`, `completada`; drag & drop |
| Prioridades | `verde` (no urgente), `amarillo` (urgente), `rojo` (pocos días) con auto-asignación según fecha |
| Asignación | Select de miembros por tarea (un solo asignado) |
| Fechas | `fecha_entrega` con días restantes y colores |
| Chat | En tiempo real por equipo con Socket.IO y contador de no leídos |
| Tiempo real | Socket.IO: crear/mover/editar/eliminar tarea + chat |

**Limitaciones actuales:** sin subtareas, sin comentarios por tarea, sin adjuntos, sin dependencias, sin notificaciones fuera del chat, sin historial/auditoría de actividad, sin vista de calendario, sin dashboard de progreso, un solo asignado por tarea, estados fijos sin personalizar, sin límites WIP, sin búsqueda/filtros.

---

## 2. Criterios de prioridad usados

1. **Valor percibido** — cuánto mejora la experiencia del estudiante.
2. **Esfuerzo técnico** — cuánto trabajo implica dar de alta (BD, backend, frontend).
3. **Base existente** — si aprovecha código que ya está (Socket.IO, tablas `tareas`, `miembros_equipo`).
4. **Riesgo de dependencia** — si necesita primero otra fase (evitar pelearse: primero infraestructura, luego features).

Con esto dividí el plan en **5 fases ordenadas por prioridad** (de mayor a menor).

---

## 3. Fases del plan (ordenadas por prioridad)

### FASE 1 — Bases de la colaboración (PRIORIDAD MÁXIMA)

Objetivo: cerrar los huecos más usados en ClickUp sin tocar la arquitectura.

#### 1.1 Comentarios por tarea (referencia ClickUp: "Comments & Clips")
**Estado:** ✅ COMPLETADO (24/09/2026)
- **Qué:** cada tarea tiene su propio hilo de comentarios, además del chat del equipo.
- **Por qué:** los comentarios por tarea mantienen el contexto (ClickUp lo llama "work lives in DMs... and gets missed").
- **Cómo:**
  - BD: nueva tabla `comentarios_tarea (comentario_id, tarea_id, usuario_id, texto, fecha)`.
  - Backend: `POST /tareas/:id/comentarios`, `GET /tareas/:id/comentarios` (reutilizar `sanitize`).
  - Frontend: bandeja de comentarios dentro del modal de edición de tarea.
  - Tiempo real: emitir `comentario-nuevo` por sala de equipo (ya existe el sistema de salas).
- **Esfuerzo:** Media. **Impacto:** Alto.

#### 1.2 Historial de actividad del equipo (referencia ClickUp: "Activity view", "admin_logs")
- **Qué:** feed con todas las acciones (quién creó/movió/completó la tarea y cuándo).
- **Por qué:** es la mejora más barata con enorme valor educativo; ClickUp lo tiene integrado en cada lista.
- **Cómo:** tabla `actividades_equipo`; registrar en cada endpoint existente (crear/mover/editar/eliminar + chat); frontend con un panel colapsable "Actividad".
- **Esfuerzo:** Baja. **Impacto:** Alto.

#### 1.3 Notificaciones de recordatorio por fecha límite (referencia ClickUp: "Reminders", "daily summary")
- **Qué:** aviso por toast/alerta cuando una tarea está próxima (ej. 1 día antes) y bandera para "tareas vencidas".
- **Por qué:** ClickUp manda recordatorios de fechas de inicio/límite; hoy las vencidas solo se marcan en rojo dentro del tablero.
- **Cómo:** checker en frontend que recorre `tareas` en cada render/carga y muestra toasts; persistir "avisadas" en `localStorage` para no repetir.
- **Esfuerzo:** Baja. **Impacto:** Alto.

#### 1.4 Búsqueda y filtros del tablero (referencia ClickUp: "letters", listas largas)
- **Qué:** campo de búsqueda + checkbox de filtro por asignado y por prioridad sobre las tarjetas.
- **Por qué:** los tableros crecen; ClickUp permite filtrar sin abrir cada tarea.
- **Cómo:** solo frontend (filtro client-side sobre `tareas`).
- **Esfuerzo:** Baja. **Impacto:** Media.

#### 1.5 Estados personalizables por equipo (referencia ClickUp: "Custom statuses")
- **Qué:** permitir al admin del equipo renombrar o agregar estados (ej. `revision`, `bloqueada`).
- **Por qué:** ClickUp parte de que cada flujo de trabajo es distinto; hoy los 3 estados están fijos en el código.
- **Cómo:** tabla `estados_equipo (equipo_id, nombre, color, orden)`; el kanban se renderiza desde la BD con fallback a los 3 por defecto.
- **Esfuerzo:** Media-alta. **Impacto:** Alta.

---

### FASE 2 — Control fino de las tareas (PRIORIDAD ALTA)

#### 2.1 Subtareas y checklists (referencia ClickUp: "Subtasks & Checklists", "Nested subtasks")
- **Qué:** dividir una tarea en subtareas con su propio `completado` y barra de progreso en la tarjeta.
- **Por qué:** es una de las features más usadas de ClickUp para proyectos académicos (desglosar "proyecto" en pasos).
- **Cómo:** tabla `subtareas (subtarea_id, tarea_id, titulo, completada, creado_por)`; COUNT en la tarjeta (ej. `2/5`).
- **Esfuerzo:** Media. **Impacto:** Alta.

#### 2.2 Múltiples asignados por tarea (referencia ClickUp: "Multiple Assignees")
- **Qué:** permitir asignar la tarea a varios miembros.
- **Por qué:** en equipos de estudio una tarea suele ser de 2+ personas.
- **Cómo:** tabla puente `tarea_asignados (tarea_id, usuario_id)` (hoy `asignado_a` es un solo id).
- **Esfuerzo:** Media (migrar consultas de `tareas`).
- **Impacto:** Alta.

#### 2.3 Etiquetas (tags) por tarea (referencia ClickUp: "Tags")
- **Qué:** tags como `examen`, `trabajo-final`, `práctica` para agrupar.
- **Por qué:** filtrado rápido y reconocimiento visual.
- **Cómo:** tabla `tags` + `tarea_tags`; UI con chips de colores en la tarjeta.
- **Esfuerzo:** Media. **Impacto:** Media.

#### 2.4 Adjuntos a tareas (referencia ClickUp: "Attach files")
- **Qué:** subir archivos (PDF/imágenes) a una tarea, reutilizando multer de `uploads/`.
- **Por qué:** adjuntar la "evidencia" del trabajo directamente a la tarea.
- **Cómo:** endpoint `POST /tareas/:id/adjuntos` usando el `storage` de multer ya existente.
- **Esfuerzo:** Media. **Impacto:** Media.

#### 2.5 Estimación y seguimiento de tiempo (referencia ClickUp: "Time Estimates", "Time Tracking")
- **Qué:** campo `estimado_min` y botón "iniciar temporizador".
- **Por qué:** da idea de carga real de trabajo (ClickUp lo integra con timesheets).
- **Cómo:** dos columnas en `tareas` (`estimado_min`, `registrado_min`); timer client-side que acumula en la BD.
- **Esfuerzo:** Media. **Impacto:** Media-baja (depende de disciplina del usuario).

---

### FASE 3 — Visibilidad y planificación (PRIORIDAD MEDIA)

#### 3.1 Vista de calendario (referencia ClickUp: "Calendar view")
- **Qué:** switch de vista Kanban ↔ Calendario con las `fecha_entrega`.
- **Por qué:** visualizar "qué entregar y cuándo" es la vista favorita para plazos académicos.
- **Cómo:** reutilizar los mismos datos; renderizar un mes simple (no necesita librería, o usar `date-fns`).
- **Esfuerzo:** Media-alta. **Impacto:** Alta.

#### 3.2 Vista de lista / tabla (referencia ClickUp: "List view", "Table view")
- **Qué:** ver todas las tareas en tabla con columnas (título, asignado, prioridad, fecha), ordenable y filtrable.
- **Por qué:** en tableros largos la tabla es más rápida de escanear.
- **Cómo:** solo frontend; versionar los mismos datos del tablero.
- **Esfuerzo:** Media. **Impacto:** Media.

#### 3.3 Dashboard del equipo con métricas (referencia ClickUp: "Dashboards & Reporting", "Goals")
- **Qué:** tarjetas con total de tareas por estado, % de completadas, tareas por miembro y por prioridad.
- **Por qué:** saber de un vistazo el progreso del equipo.
- **Cómo:** endpoint `GET /equipos/:id/stats` agregando el mismo patrón de `/admin/stats`.
- **Esfuerzo:** Media. **Impacto:** Alta para docentes/equipos.

#### 3.4 Progreso visual en la tarjeta (referencia ClickUp: "Progress tracking")
- **Qué:** barra de progreso derivada de subtareas completadas / estado.
- **Por qué:** feedback visual inmediato.
- **Cómo:** agregar `%` calculado en el backend al listar tareas.
- **Esfuerzo:** Baja (si ya existe Fase 2.1). **Impacto:** Media.

---

### FASE 4 — Flujos avanzados (PRIORIDAD MEDIA-BAJA)

#### 4.1 Dependencias entre tareas (referencia ClickUp: "Dependencies")
- **Qué:** marcar que la tarea B "depende de" la tarea A; impedir/advertir mover B a completada si A está en pendiente.
- **Por qué:** ClickUp mapea "blockers" y avisa cuando algo se atasca.
- **Cómo:** tabla `dependencias (tarea_id, bloqueada_por)`, validación en el endpoint `mover`.
- **Esfuerzo:** Media-alta. **Impacto:** Media (avanzado).

#### 4.2 Diagrama de Gantt simple (referencia ClickUp: "Gantt charts", "Timeline")
- **Qué:** vista timeline con inicio/fin por tarea.
- **Por qué:** planificación tipo cronograma (muy usado para entregas finales).
- **Cómo:** requeriría `fecha_inicio` (nueva columna) y render de barras; librería opcional.
- **Esfuerzo:** Alta. **Impacto:** Media. **Depende:** conveniente tras 3.1/3.2.

#### 4.3 Automatizaciones simples (referencia ClickUp: "Automations")
- **Qué:** reglas tipo "si fecha ≤ 2 días → prioridad roja" (¡ya existe esa lógica!) o "si la tarea se mueve a completada → notificar al creador".
- **Cómo:** un mini-motor de reglas (condición → acción) usando los eventos de Socket.IO que ya existen.
- **Esfuerzo:** Media. **Impacto:** Media.

#### 4.4 Límites WIP por columna (referencia ClickUp: "WIP limits")
- **Qué:** cap max de tareas en `en_progreso` y avisar al pasarse.
- **Por qué:** evita saturación (ClickUp lo recomienda explícitamente para kanban).
- **Cómo:** columna `wip_limit` en estados + check en `mover`.
- **Esfuerzo:** Baja-media. **Impacto:** Media.

#### 4.5 Notificaciones in-app / email (referencia ClickUp: "Smart notifications", "Inbox")
- **Qué:** centralizar avisos (tarea asignada, comentario recibido, fecha próxima) en una campana en la Navbar.
- **Por qué:** hoy la única notificación es el contador del chat.
- **Cómo:** tabla `notificaciones (usuario_id, tipo, referencia, leida)`; cereza opcional: copiar a email.
- **Esfuerzo:** Media-alta. **Impacto:** Alta.

---

### FASE 5 — Experiencia y rozamiento (PRIORIDAD BAJA / pulido)

#### 5.1 Plantillas de equipo y de tareas (referencia ClickUp: "Templates", "Proven templates")
- **Qué:** plantillas prediseñadas ("proyecto de investigación", "trabajo en grupo") que precargan tareas.
- **Cómo:** tabla `plantillas` + botón "crear equipo desde plantilla".
- **Esfuerzo:** Media. **Impacto:** Media.

#### 5.2 Menciones (@usuario) (referencia ClickUp: "@mentions")
- **Qué:** escribir `@` en comentarios/chat → notificar al mencionado (enlazar con 4.5).
- **Cómo:** parsear `@` en backend, generar notificación.
- **Esfuerzo:** Media. **Impacto:** Media.

#### 5.3 Papelera / recuperación (referencia ClickUp: "Trash")
- **Qué:** eliminar tareas de forma soft (columna `deleted_at`), con opción de restaurar por el admin.
- **Por qué:** evita borrados accidentales.
- **Esfuerzo:** Baja-media. **Impacto:** Media.

#### 5.4 Mejora del chat: reacciones e imágenes
- **Qué:** emojis de reacción en mensajes y envío de imágenes.
- **Cómo:** extender `mensajes_chat` y el payload de Socket.IO.
- **Esfuerzo:** Media. **Impacto:** Baja-media (cosmético).

#### 5.5 Carga de trabajo por miembro (referencia ClickUp: "Workload / Box view")
- **Qué:** gráfico de "cuántas tareas abiertas tiene cada uno".
- **Por qué:** ClickUp muestra bandwith para repartir mejor.
- **Cómo:** endpooint agregado sobre las mismas tareas.
- **Esfuerzo:** Baja (si ya existe 3.3). **Impacto:** Media.

---

## 4. Qué tomar específicamente de ClickUp (resumen curado)

De la investigación de ClickUp, lo **más valioso y trasladable a Edu-Verse** es:

1. **"Do the work right from the card"** → comentarios + adjuntos + subtareas dentro del modal de la tarea, sin salir del tablero. *(→ Fase 1.1 y Fase 2)*
2. **WIP limits** → limitar tareas en curso por columna. *(→ 4.4)*
3. **Custom statuses** → estados definidos por cada equipo, no fijos. *(→ 1.5)*
4. **Multiple assignees** → una tarea para varias personas. *(→ 2.2)*
5. **Recurring tasks** → tareas que se repiten (ej. "reunión semanal"). *(→ recomendación extra, ver §5)*
6. **Reminders / Smart notifications** → avisos de fechas próximas y bandeja de notificaciones. *(→ 1.3 y 4.5)*
7. **Dashboards & reporting** → resumen de progreso con métricas. *(→ 3.3)*
8. **Views (Board/List/Calendar/Gantt)** → mismos datos, varias vistas. *(→ Fase 3)*
9. **Dependencies** → blockers entre tareas. *(→ 4.1)*
10. **Templates** → arrancar rápido con estructuras pre-cargadas. *(→ 5.1)*

> Lo que **NO** tiene sentido copiar tal cual en un proyecto escolar: la jerarquía completa Spaces/Folders/Lists, integraciones externas (Zapier/Google Drive), IA/agentes, whitepapers/mind maps y permisos granulares. Harían el módulo más grande que la propia plataforma.

---

## 5. Otras recomendaciones generales (no de ClickUp)

1. **Permisos por rol real**: hoy el rol `admin` del equipo existe en BD pero no se valida (cualquiera del equipo puede borrar tareas). Hacer valer "solo admin edita/elimina".
2. **Copiar una tarea** (duplicar) — útil para repetir patrón.
3. **Tareas recurrentes** (`cada_semana`, etc.) — muy usado en ClickUp y en vida académica.
4. **Exportar el tablero a PDF/CSV** — entregable de equipo.
5. **Modo oscuro / accesibilidad**: contraste y navegación por teclado de las tarjetas.
6. **Onboarding del equipo**: primera vista con "crear o unirse" ya existe; agregar mini-tutorial.
7. **Progreso guardado en BD de "avisos vistos"** — evitar notificaciones repetidas.
8. **Permitir cambiar el creador/admin del equipo** y salirse de un equipo.

---

## 6. Roadmap sugerido (orden de implementación)

| Orden | Fase | Entregable al terminar |
|-------|------|------------------------|
| 1 | **Fase 1** | Módulo "usable de verdad": comentarios, actividad, recordatorios, filtros, estados |
| 2 | **Fase 2** | Tareas finas: subtareas, múltiples asignados, tags, adjuntos |
| 3 | **Fase 3** | Vistas: calendario, lista, dashboard con métricas |
| 4 | **Fase 4** | Flujos avanzados: dependencias, Gantt, automatizaciones, notificaciones |
| 5 | **Fase 5** | Pulido: plantillas, menciones, papelera, carga de trabajo |

**Recomendación de ruta rápida de alto impacto con poco código:**
`1.2 Historial` → `1.3 Recordatorios` → `1.4 Filtros` → `3.3 Dashboard` → `2.1 Subtareas` → `1.5 Estados` → `3.1 Calendario`.

---

## 7. Notas técnicas para arrancar (referencias del código actual)

- Las salas de Socket.IO por equipo ya existen → casi todas las features de tiempo real se agregan sin tocar infraestructura.
- La lógica de auto-prioridad por días (`autoAsignarPrioridad`) ya existe y puede reutilizarse para automatizaciones.
- El patrón de puntos de acceso ya está en `routes/tareas.js`, `routes/equipos.js` y `routes/chat.js`.
- Las notificaciones y el historial podrían apoyarse en la infraestructura mental de `admin_logs` (auditoría) y `mensajes_chat`.
- Muchas fases requieren **migraciones de BD** → agregarlas al dump `backup_BASE_DE_DATOS.sql` (ver `documentacion/BASE_DE_DATOS.md`).