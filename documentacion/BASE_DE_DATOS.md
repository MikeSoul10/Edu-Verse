# Base de Datos — PostgreSQL

**Contenedor:** `edu-verse-postgres-1` · **Imagen:** `postgres:16-alpine` · **Base:** `Edu-verseDB`

El esquema vive en el dump `documentacion/backup_BASE_DE_DATOS.sql`, que se carga automáticamente al primer arranque del contenedor (`docker-entrypoint-initdb.d/init.sql`).

---

## 1. Tablas (11)

| Tabla | Campos principales | Propósito |
|-------|--------------------|-----------|
| `usuarios` | `usuario_id`, `nombre`, `email`, `password_hash`, `fecha_registro`, `foto_url`, `rol` | Cuentas; `email` UNIQUE, `rol` por defecto `user` |
| `apuntes` | `apunte_id`, `titulo`, `materia`, `descripcion`, `archivo_url`, `usuario_id`, `fecha_subida` | Material compartido |
| `comentarios` | `comentario_id`, `apunte_id`, `usuario_id`, `texto`, `fecha_creacion` | Comentarios por apunte |
| `favoritos` | `favorito_id`, `usuario_id`, `apunte_id`, `fecha_guardado` | UNIQUE `(usuario_id, apunte_id)` → un favorito por apunte |
| `valoraciones` | `valoracion_id`, `apunte_id`, `usuario_id`, `estrellas` | Calificación 1-5 (CHECK), UNIQUE `(apunte_id, usuario_id)` → una por usuario |
| `equipos` | `equipo_id`, `nombre`, `codigo_invitacion`, `creado_por`, `fecha_creacion` | Equipos de estudio; código UNIQUE de 6 chars |
| `miembros_equipo` | `equipo_id`, `usuario_id`, `rol` | Relación muchos-a-muchos; PK compuesta `(equipo_id, usuario_id)`; rol por defecto `miembro` |
| `tareas` | `tarea_id`, `equipo_id`, `titulo`, `descripcion`, `estado`, `prioridad`, `fecha_entrega`, `asignado_a`, `creado_por`, `fecha_creacion` | Kanban por equipo; `estado` por defecto `pendiente`, `prioridad` por defecto `verde` |
| `mensajes_chat` | `mensaje_id`, `equipo_id`, `usuario_id`, `texto`, `fecha_envio` | Chat por equipo |
| `baneados` | `baneo_id`, `email`, `motivo`, `baneado_por`, `fecha_baneo` | Correos suspendidos; `email` UNIQUE |
| `admin_logs` | `log_id`, `admin_id`, `accion`, `detalle`, `fecha` | Auditoría de acciones de admin |

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
idx_baneados_baneado_por, idx_admin_logs_admin_id
```

---

## 4. Datos iniciales (seed)

| Tabla | Registros |
|-------|-----------|
| `usuarios` | 4 (1 admin: `Miguel` / `test@edu.mx`, función `admin`; 3 `user`) |
| `apuntes` | 3 |
| `comentarios` | 2 |
| `favoritos` | 3 |
| `valoraciones` | 2 |

> Las contraseñas están hasheadas con **bcrypt** (`$2b$10$...`) — no hay contraseñas en texto plano.

---

## 5. Migración de administración (al final del dump)

Por compatibilidad con `migracion_admin.sql`, el dump re-ejecuta de forma idempotente:

1. `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'user'`.
2. `CREATE TABLE IF NOT EXISTS baneados` e `admin_logs`.
3. `UPDATE usuarios SET rol = 'admin' WHERE usuario_id = 1 ...` → garantiza que el **primer usuario quede como admin**.

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