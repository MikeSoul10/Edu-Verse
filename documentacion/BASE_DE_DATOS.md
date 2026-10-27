# Base de Datos — PostgreSQL

**Contenedor:** `edu-verse-postgres-1` · **Imagen:** `postgres:16-alpine` · **Base:** `Edu-verseDB`

El esquema vive en el dump `documentacion/backup_BASE_DE_DATOS.sql`, que se carga automáticamente al primer arranque del contenedor (`docker-entrypoint-initdb.d/init.sql`).

---

## 1. Tablas (12)

| Tabla | Campos principales | Propósito |
|-------|--------------------|-----------|
| `usuarios` | `usuario_id`, `nombre`, `email`, `password_hash`, `fecha_registro`, `foto_url`, `rol` | Cuentas; `email` UNIQUE, `rol` por defecto `user`; `password_hash` admite NULL para cuentas de Google |
| `apuntes` | `apunte_id`, `titulo`, `materia`, `descripcion`, `archivo_url`, `usuario_id`, `fecha_subida` | Material compartido |
| `comentarios` | `comentario_id`, `apunte_id`, `usuario_id`, `texto`, `fecha_creacion` | Comentarios por apunte |
| `favoritos` | `favorito_id`, `usuario_id`, `apunte_id`, `fecha_guardado` | UNIQUE `(usuario_id, apunte_id)` → un favorito por apunte |
| `valoraciones` | `valoracion_id`, `apunte_id`, `usuario_id`, `estrellas` | Calificación 1-5 (CHECK), UNIQUE `(apunte_id, usuario_id)` → una por usuario |
| `equipos` | `equipo_id`, `nombre`, `codigo_invitacion`, `creado_por`, `fecha_creacion` | Equipos de estudio; código UNIQUE de 6 chars |
| `miembros_equipo` | `equipo_id`, `usuario_id`, `rol` | Relación muchos-a-muchos; PK compuesta `(equipo_id, usuario_id)`; rol por defecto `miembro` |
| `tareas` | `tarea_id`, `equipo_id`, `titulo`, `descripcion`, `estado`, `prioridad`, `fecha_entrega`, `asignado_a`, `creado_por`, `fecha_creacion` | Kanban por equipo; `estado` por defecto `pendiente`, `prioridad` por defecto `verde` |
| `mensajes_chat` | `mensaje_id`, `equipo_id`, `usuario_id`, `texto`, `fecha_envio`, `respuesta_a` | Chat por equipo; `respuesta_a` cita otro mensaje (`ON DELETE SET NULL`) |
| `baneados` | `baneo_id`, `email`, `motivo`, `baneado_por`, `fecha_baneo` | Correos suspendidos; `email` UNIQUE |
| `admin_logs` | `log_id`, `admin_id`, `accion`, `detalle`, `fecha` | Auditoría de acciones de admin |
| `moderacion_logs` | `moderacion_id`, `usuario_id`, `equipo_id`, `palabras_bloqueadas`, `sustituciones`, `fecha`, `accion`, `detalle` | Censuras del filtro de chat y vaciados de historial |

---

## 2. Dependencias (foreign keys)

```
usuarios ───────────────┐
   │ pk usuario_id      │
   ▼                    │
apuntes ──usuario_id──> │ (CASCADE)
comentarios ──usuario_id/──── apunte_id (CASCADE, CASCADE)
favoritos ──usuario_id/──── apunte_id (CASCADE, CASCADE)
valoraciones ──usuario_id/── apunte_id (CASCADE, CASCADE)
baneados ──baneado_por──>    (SET NULL)
admin_logs ──admin_id──>      (SET NULL)

equipos ──creado_por──> usuarios (SET NULL)
miembros_equipo ──equipo_id/──usuario_id → equipos/usuarios (CASCADE, CASCADE)
tareas ──equipo_id──> equipos (CASCADE)
tareas ──asignado_a ──> usuarios (SET NULL)
tareas ──creado_por──> usuarios (SET NULL)
mensajes_chat ──equipo_id──> equipos (CASCADE)
mensajes_chat ──usuario_id──> usuarios (SET NULL)
mensajes_chat ──respuesta_a──> mensajes_chat (SET NULL)
moderacion_logs ──usuario_id/──equipo_id → usuarios/equipos (SET NULL)
```

**Regla de borrado:**
- Los hijos de `apuntes`/`equipos` usan `ON DELETE CASCADE` (se borra todo lo relacionado).
- Los referentes a `usuarios` usan `ON DELETE SET NULL` o `CASCADE` según cuánto sentido tenga conservar el registro (mensajes, tareas, equipos como creador → `SET NULL`; apuntes/comentarios/favoritos/valoraciones del usuario → `CASCADE`).

---

## 3. Índices

Se crearon índices para todas las columnas con `FOREIGN KEY` con el fin de acelerar los `JOIN` y los `WHERE`:

```sql
idx_apuntes_usuario_id, idx_comentarios_apunte_id, idx_comentarios_usuario_id,
idx_favoritos_usuario_id, idx_favoritos_apunte_id, idx_valoraciones_apunte_id,
idx_valoraciones_usuario_id, idx_equipos_creado_por, idx_miembros_equipo_equipo_id,
idx_miembros_equipo_usuario_id, idx_tareas_equipo_id, idx_tareas_asignado_a,
idx_tareas_creado_por, idx_mensajes_chat_equipo_id, idx_mensajes_chat_usuario_id,
idx_mensajes_chat_respuesta, idx_baneados_baneado_por, idx_admin_logs_admin_id,
idx_moderacion_logs_fecha, idx_moderacion_logs_accion
```

---

## 4. Datos iniciales (seed)

| Tabla | Registros |
|-------|-----------|
| `usuarios` | 4 (1 admin: `Miguel` / `test@alumnos.udg.mx`; 3 `user`) |
| `apuntes` | 0 |
| `comentarios` | 0 |
| `favoritos` | 0 |
| `valoraciones` | 0 |

> Las cuentas de demostración usan el dominio `@alumnos.udg.mx` que valida el
> backend. No se siembran apuntes: sus archivos viven en `uploads/` y un volumen
> Docker vacío los ocultaría, dejando enlaces rotos en una instalación limpia.
>
> Las contraseñas están hasheadas con **bcrypt** (`$2b$10$...`) — no hay contraseñas en texto plano.

---

## 5. Compatibilidad con migraciones manuales

El dump ya crea el esquema completo, pero al final re-ejecuta de forma idempotente
las columnas que antes solo existían en migraciones manuales. Así también sirve
para actualizar una base creada con una versión anterior:

1. `usuarios.rol` (`ADD COLUMN IF NOT EXISTS`).
2. `usuarios.password_hash DROP NOT NULL` (cuentas de Google).
3. `mensajes_chat.respuesta_a` + índice.
4. `moderacion_logs.accion` y `moderacion_logs.detalle` + índices.
5. `UPDATE usuarios SET rol = 'admin' WHERE usuario_id = 1 ...`.
6. Índice único `lower(email)` para evitar duplicados por mayúsculas.

> Las migraciones de `documentacion/migracion_*.sql` siguen disponibles para
> bases existentes que no se puedan recrear, y también son idempotentes.

---

## 6. Restauración

```bash
# Desde dump local
psql -U postgres -d Edu-verseDB -f documentacion/backup_BASE_DE_DATOS.sql

# En Docker (automático al crear el volumen por primera vez)
docker compose up -d postgres

# Backup manual del contenedor
docker exec edu-verse-postgres-1 pg_dump -U postgres Edu-verseDB > backup_BASE_DE_DATOS.sql
```