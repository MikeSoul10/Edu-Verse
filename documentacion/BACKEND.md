# Backend — `edu-verse_backend`

**Stack:** Node.js · Express 5 · PostgreSQL (pg) · JWT · bcrypt · Multer · Socket.IO

API REST que expone todos los servicios de Edu-Verse. Cada endpoint paso a paso.

---

## 1. Punto de entrada — `index.js`

### 1.1 Configuración inicial
1. Importa `express`, `http` (para crear el servidor), `socket.io`, `cors`, `bcrypt`, `multer`, `jsonwebtoken` y `dotenv`.
2. Crea la app de Express y un servidor HTTP aparte (`http.createServer(app)`), necesario para montar Socket.IO sobre el mismo puerto.
3. Inicializa `JWT_SECRET` desde `process.env.JWT_SECRET` (con fallback `supersecretkey_eduverse_2026`).

### 1.2 Middleware globales
| Orden | Middleware | Función |
|-------|------------|---------|
| 1 | `cors()` | Permite peticiones desde cualquier origen |
| 2 | `express.json()` | Parsea cuerpos JSON |
| 3 | `express.static('uploads/')` | Sirve los archivos subidos (debe ir **antes** de las rutas) |
| 4 | `verificarToken` | Middleware de autenticación (importado de `middleware/auth.js`) |
| 5 | `sanitize` | Utilidad de escape HTML (importado de `middleware/sanitize.js`) |

### 1.3 Rutas montadas
```js
app.use('/equipos',  require('./routes/equipos'));
app.use('/tareas',   require('./routes/tareas'));
app.use('/chat',     require('./routes/chat'));
```
El resto de rutas (`auth`, `apuntes`, `favoritos`, `comentarios`, `valoraciones`, `admin`) está definido directamente en `index.js`.

### 1.4 Configuración de Multer
Dos instancias separadas con límites y filtros de tipo:

| Instancia | Destino | Límite | Tipos permitidos |
|-----------|---------|--------|------------------|
| `upload` | `uploads/` | 10 MB | `application/pdf`, `image/png`, `image/jpeg`, `image/jpg` |
| `uploadPerfil` | `uploads/perfiles/` | 5 MB | `image/png`, `image/jpeg`, `image/jpg` |

Ambas renombran el archivo con `Date.now() + '-' + nombreOriginal`.

---

## 2. Socket.IO (tiempo real)

Se inicializa sobre el servidor HTTP y maneja las salas por equipo:

| Evento entrante | Acción |
|-----------------|--------|
| `connection` | Log del `socket.id` |
| `unirse-equipo` | `socket.join('equipo-{id}')` |
| `salir-equipo` | `socket.leave('equipo-{id}')` |
| `nueva-tarea` | Emite `tarea-creada` a la sala del equipo |
| `mover-tarea` | Emite `tarea-movida` a la sala del equipo |
| `editar-tarea` | Emite `tarea-editada` a la sala del equipo |
| `eliminar-tarea` | Emite `tarea-eliminada` a la sala del equipo |
| `mensaje-chat` | Emite `nuevo-mensaje` a la sala del equipo |
| `disconnect` | Log de desconexión |

---

## 3. Autenticación (JWT)

### Flujo paso a paso — `POST /auth/signup`
1. Valida campos obligatorios (`nombre`, `email`, `password`).
2. Valida formato de email con regex.
3. **Exige** que termine en `@alumnos.udg.mx`.
4. Valida longitud de contraseña (mínimo 6).
5. Consulta tabla `baneados` → si el correo está baneado, devuelve `403`.
6. Hashea la contraseña con `bcrypt` (salt 10).
7. Inserta en `usuarios` y devuelve `201` con `{ mensaje, usuario }`.
8. Si hay error `23505` (email duplicado) → `400 "El correo ya existe"`.

### Flujo paso a paso — `POST /auth/login`
1. Verifica si el email está en `baneados` → `403` si lo está.
2. Busca el usuario por email.
3. Compara contraseña con `bcrypt.compare`.
4. **Crea token** con payload `{ id, nombre, rol }`, expiración `24h`.
5. Devuelve `{ mensaje, token, usuario: { id, nombre, foto_url, rol } }`.

### 4. Rutas de perfil
- `GET /auth/perfil/:id` → devuelve `nombre`, `email`, `foto_url`.
- `PUT /auth/perfil/update/:id` → **requiere token**, valida que `req.usuario.id === id`, exige dominio `@alumnos.udg.mx`.

---

## 5. Rutas de apuntes

| Método | Ruta | Auth | Flujo |
|--------|------|------|-------|
| `POST` | `/apuntes/upload` | ✅ | `upload.single('archivo')` → inserta `archivo_url = /uploads/{filename}` + metadatos |
| `GET` | `/apuntes` | ❌ | `SELECT apuntes.*, usuarios.nombre AS autor` con `JOIN`, ordenado por `fecha_subida DESC` |
| `GET` | `/apuntes/buscar?q=` | ❌ | `ILIKE` sobre `titulo`, `materia`, `descripcion` (si `q` vacío → trae todo) |
| `GET` | `/apuntes/:id` | ❌ | Detalle con `JOIN` de autor |
| `GET` | `/apuntes/mis-apuntes/:usuario_id` | ❌ | Apuntes de un usuario específico |
| `DELETE` | `/apuntes/:id` | ✅ | Elimina por `apunte_id` |
| `GET` | `/apuntes/detalle/:id` | ❌ | Detalle + `AVG(estrellas)` + `COUNT(*)` de valoraciones |

---

## 6. Favoritos

| Método | Ruta | Auth | Flujo |
|--------|------|------|-------|
| `POST` | `/favoritos` | ❌ | Inserta; si `23505` (duplicado) devuelve `400 "Ya tienes este apunte en favoritos"` |
| `GET` | `/favoritos/:usuario_id` | ❌ | `JOIN favoritos → apuntes → usuarios` |
| `DELETE` | `/favoritos` | ✅ | Usa `req.usuario.id` del JWT (no el body) para evitar eliminar favoritos de otros |

---

## 7. Comunidad

- `GET /comentarios/:apunte_id` → lista comentarios con nombre del autor, `ORDER BY fecha_creacion DESC`.
- `POST /comentarios` → **requiere token**, aplica `sanitize(texto)` antes de insertar (prevención XSS).
- `POST /valoraciones` → **requiere token**, `INSERT ... ON CONFLICT (apunte_id, usuario_id) DO UPDATE` → un usuario solo puede dar una valoración por apunte, puede cambiarla.

---

## 8. Panel de administrador

Todas las rutas exigen **token + rol `admin`** (doble middleware `verificarToken`, `verificarAdmin`).

| Método | Ruta | Función |
|--------|------|---------|
| `GET` | `/admin/stats` | `Promise.all` con 9 `COUNT` + 3 queries de 7 días (`apuntesPorDia`, `usuariosPorDia`, `equiposPorDia`) |
| `GET` | `/admin/usuarios` | Lista todos los usuarios con rol |
| `DELETE` | `/admin/usuarios/:id` | **Transacción** (`BEGIN`/`COMMIT`/`ROLLBACK`): borra mensajes → tareas → comentarios → apuntes → equipos → usuario, y registra en `admin_logs`. No permite autodescuento |
| `POST` | `/admin/ban` | **Transacción**: inserta/actualiza `baneados` + log. No permite auto-baneo |
| `GET` | `/admin/baneados` | Lista baneados con nombre del admin que baneó |
| `DELETE` | `/admin/baneados/:email` | Desbanea + log |
| `DELETE` | `/admin/apuntes/:id` | Elimina apunte + log |
| `DELETE` | `/admin/comentarios/:id` | Elimina comentario + log |
| `DELETE` | `/admin/tareas/:id` | Elimina tarea + log |
| `DELETE` | `/admin/equipos/:id` | Elimina equipo + log |
| `GET` | `/admin/apuntes` | Lista todos los apuntes con autor |
| `GET` | `/admin/comentarios` | Lista todos los comentarios con autor y apunte |
| `GET` | `/admin/equipos` | Lista equipos con `total_miembros` y `total_tareas` (subqueries) |
| `GET` | `/admin/logs` | Últimos 50 registros de `admin_logs` |

> Todas las operaciones destructivas del admin quedan auditadas en `admin_logs`.

---

## 9. Conexión a base de datos — `db.js`

1. Crea un `Pool` de `pg` con variables de entorno (`DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`).
2. Intenta `pool.connect()` al arrancar e imprime en consola el resultado (éxito o stack del error).
3. Exporta el `pool` para que todas las rutas lo compartan.

---

## 10. Rutas modularizadas (`routes/`)

### `routes/equipos.js`
- `generarCodigo()` → genera código de 6 caracteres usando `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin `I`, `O`, `0`, `1` para evitar confusiones), verificando unicidad.
- `POST /equipos/crear` → genera código único, inserta equipo, luego inserta al creador como `admin` en `miembros_equipo`.
- `POST /equipos/unirse` → valida código, valida que no sea ya miembro, inserta como `miembro`.
- `GET /equipos/mis-equipos/:usuario_id` → `JOIN miembros_equipo` para traer equipos con rol.
- `GET /equipos/:equipo_id/miembros` → lista miembros con nombre, foto y rol.
- `GET /equipos/:equipo_id` → detalle del equipo.

### `routes/tareas.js`
- `POST /tareas/crear` → inserta con sanitización; prioridad por defecto `verde`.
- `GET /tareas/equipo/:equipo_id` → lista con nombre del asignado (`LEFT JOIN`).
- `PUT /tareas/:id` → actualización parcial usando `COALESCE($, columna)`.
- `PUT /tareas/:id/mover` → cambio de estado (kanban drag-and-drop).
- `DELETE /tareas/:id` → elimina.

### `routes/chat.js`
- `GET /chat/:equipo_id` → últimos 100 mensajes (`LIMIT 100`), orden cronológico, con `autor_nombre`.
- `POST /chat/enviar` → inserta con `sanitize(texto)`.

---

## 11. Middlewares (`middleware/`)

| Archivo | Exporta | Lógica |
|---------|---------|--------|
| `auth.js` | `verificarToken` | Lee header `Authorization: Bearer <token>`, verifica con `jwt.verify`, adjunta `req.usuario` |
| `admin.js` | `verificarAdmin` | Comprueba `req.usuario.rol === 'admin'`, si no → `403` |
| `sanitize.js` | `sanitize` | Escapa `& < > " '` para prevenir XSS |

---

## 12. Arranque

```js
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Servidor de Edu-Verse corriendo en el puerto ${PORT}`));
```

En Docker se levanta con **nodemon** (`npx nodemon --legacy-watch index.js`) para hot-reload.

---

## Cómo ejecutarlo

```bash
# Con Docker (recomendado, levanta todo)
docker compose up -d

# Manual
cd edu-verse_backend
npm install
node index.js        # producción
npx nodemon index.js # desarrollo
```

Servidor: `http://localhost:4000` · Docker mapea `4001 → 4000`.
