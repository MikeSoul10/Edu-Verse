# Frontend — `edu-verse`

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · axios · react-hot-toast · socket.io-client

SPA con enrutamiento cliente, autenticación por contexto y notificaciones por toast. Cada página y componente, paso a paso.

---

## 1. Bootstrap de la aplicación

### `main.jsx`
1. Importa `App` y `AuthProvider`.
2. Importa `./config` (para que se registren los interceptores de axios).
3. Importa `./index.css` (estilos Tailwind).
4. Renderiza en `#root`: `React.StrictMode → AuthProvider → App`.

### `App.jsx`
1. Envuelve todo en `BrowserRouter`.
2. `ErrorBoundary` captura errores de render y muestra pantalla de respaldo (evita pantalla blanca).
3. `Toaster position="top-right"` muestra los avisos de `react-hot-toast`.
4. `Navbar` siempre visible.
5. Define las rutas:

| Ruta | Componente | Protegida |
|------|------------|-----------|
| `/` | `Home` | ❌ |
| `/signup` | `Signup` | ❌ |
| `/login` | `Login` | ❌ |
| `/biblioteca` | `Biblioteca` | ❌ |
| `/perfil` | `Profile` | ✅ |
| `/upload` | `Upload` | ✅ |
| `/apunte/:id` | `DetalleApunte` | ❌ |
| `/mis-apuntes` | `MyNotes` | ✅ |
| `/favoritos` | `Favorites` | ✅ |
| `/gestor-equipos` | `GestorEquipos` | ✅ |
| `/admin` | `AdminPanel` | ✅ |
| `/apuntes` | `Apuntes` | ✅ |
| `*` | `NotFound` | ❌ |

### `ProtectedRoute.jsx`
1. Lee `localStorage.getItem('token')`.
2. Si no existe → `<Navigate to="/login" replace />`.
3. Si existe → renderiza el hijo.

---

## 2. Infraestructura transversal

### `src/config.js`
1. Exporta `API_URL = ''` → peticiones relativas, resueltas por el proxy de Vite hacia el backend.
2. **Interceptor de petición:** agrega `Authorization: Bearer <token>` a todas las llamadas si hay token en `localStorage`.
3. **Interceptor de respuesta:** si devuelve `401`, o `400` con mensaje que contiene "Token", borra `token`, `usuario_id`, `usuario` de `localStorage` y redirige a `/login`.

### `src/context/AuthContext.jsx`
Fuente única de verdad del estado de autenticación:

| Función | Paso a paso |
|---------|-------------|
| Estado inicial | Lee `usuario`, `usuario_id`, `foto_url`, `rol` de `localStorage`; si faltan, `null` |
| `login(datos)` | Guarda token + datos en `localStorage`, actualiza `user` en state, dispara `emitAuthChange()` |
| `logout()` | `localStorage.clear()`, `user = null`, dispara evento |
| `updateUser(patch)` | Mergea cambios en `user` y persiste `nombre`/`foto` en `localStorage` |

Expone `useAuth()` → `{ user, login, logout, updateUser }`.

### `src/authEvents.js`
- `emitAuthChange()` → despacha `Event('auth-change')` en `window` para sincronizar componentes que no dependen del context.

---

## 3. Componentes compartidos (`src/components/`)

### `Navbar.jsx`
1. Obtiene `user` y `logout` de `useAuth()`.
2. **Sin sesión:** muestra links a *Iniciar Sesión* y botón *Registrarse*.
3. **Con sesión:**
   - Módulos contextuales según `location.pathname`:
     - En `/` → Biblioteca, Equipos, Tutor IA (deshabilitado "Próximamente").
     - En `/biblioteca` → Favoritos, Mis Apuntes.
     - En `/gestor-equipos` → Equipos.
   - Si `user.rol === 'admin'` → link `⚡ Admin`.
   - Chip de perfil con foto (fallback a `ui-avatars.com`), rol y nombre.
   - Botón de cerrar sesión → `logout()` + `navigate('/login')`.
4. **Móvil:** botón hamburguesa que despliega menú dropdown con las mismas opciones y `closeMenu()` en cada link.

### `ErrorBoundary.jsx`
Clase React con `getDerivedStateFromError` → si un hijo lanza, renderiza pantalla de error con botón que resetea el estado y navega a `/`.

---

## 4. Páginas (`src/pages/`)

### `Signup.jsx` (registro)
1. Estado: `formData { nombre, email, password }`, `showPassword`, `fraseIdx`.
2. `useEffect` rota frases de la mascota cada 3 s.
3. Validaciones cliente antes del `POST`:
   - Regex de email.
   - Debe terminar en `@alumnos.udg.mx`.
   - Contraseña ≥ 6 caracteres.
4. `POST ${API_URL}/auth/signup` → toast de éxito → `navigate('/login')` tras 1.5 s.
5. UI: tarjeta dividida, panel izquierdo con logo, mascota y frase; panel derecho con formulario e **iconos de imagen** (`/Iconos/usuario.png`, `gmail.png`, `candado.png`, ojo mostrar/ocultar `ojo.png` / `ojo_cerrado.png`) y fondo de puntos (radial-gradient).

### `Login.jsx` (inicio de sesión)
1. Estado: `formData { email, password }`, `showPassword`, `fraseIdx`.
2. `useEffect` rota frases de la mascota cada 5 s.
3. `POST ${API_URL}/auth/login` → toast de bienvenida con icono `cohete.png`.
4. Según `response.data.usuario.rol`: `admin` → `/admin`, resto → `/`.
5. Botón ojo alterna `ojo.png` / `ojo_cerrado.png`; iconos en campos `gmail.png` y `candado.png`.

### `Home.jsx`
1. Lee `localStorage.usuario` para el saludo.
2. Array `modulos` con 3 tarjetas: Biblioteca (activo), Gestor de Equipos (activo), Tutor IA (`activo: false`).
3. Renderiza grid; las activas envuelven en `<Link>`, las inactivas muestran badge "Próximamente" y no navegan.

### `Biblioteca.jsx` (explorar apuntes)
1. `cargarApuntes()` con `useCallback` → `GET /apuntes`, estado `cargando` para skeletons.
2. `guardarFavorito(id)` → `POST /favoritos` con `usuario_id` de `localStorage`; exige sesión.
3. `handleSearch()` → `GET /apuntes/buscar?q=`.
4. Render: header con botón *Subir Material*, buscador, grid con 3 estados → skeleton (6 tarjetas), vacío con botón "Ver todos", o tarjetas reales con botón favorito y link a detalle.

### `Upload.jsx` (subir apunte)
1. Validación cliente de archivo: tipo (`pdf/png/jpeg`) y tamaño (≤ 10 MB) con toast de error.
2. `handleSubmit` construye `FormData` (archivo, título, materia, descripción, `usuario_id`).
3. `POST /apuntes/upload` con header `multipart/form-data`.
4. Toast de éxito → `navigate('/biblioteca')`.

### `Apuntes.jsx` (repositorio)
1. `GET /apuntes` → grid de 4 columnas.
2. Cada tarjeta: título link a `/apunte/:id`, botón *Valorar*, y enlace directo al PDF.

### `DetalleApunte.jsx` (detalle + comunidad)
1. `useParams()` obtiene `id`.
2. Carga en paralelo `GET /apuntes/detalle/${id}` (incluye `promedio_rating`) y `GET /comentarios/${id}`.
3. Estado: `rating` (estrellas 1-5), `comentario`, `comentarios`.
4. `enviarComentario()`:
   - Valida sesión y que `rating !== 0`.
   - `POST /comentarios` y luego `POST /valoraciones`.
   - Limpia campos y recarga datos.
5. UI: cabecera con botón *Abrir PDF*, columna de formulario (estrellas + textarea) y columna de lista de comentarios.

### `MyNotes.jsx` (mis apuntes)
1. `GET /apuntes/mis-apuntes/${usuarioId}`.
2. `eliminarApunte(id)` → confirm → `DELETE /apuntes/${id}` → recarga lista.
3. 3 estados: spinner, vacío, lista con *Ver* y *Eliminar*.

### `Favorites.jsx` (favoritos)
1. `GET /favoritos/${usuarioId}`.
2. `quitarFavorito(id)` → `DELETE /favoritos` con `data: { usuario_id, apunte_id }` (body en `data` porque es `DELETE`).
3. Tarjetas con *Abrir PDF* y *Eliminar*.

### `Profile.jsx` (perfil)
1. `GET /auth/perfil/${usuarioId}` → `nombre`, `email`, `foto_url`.
2. **Foto:** input oculto → `handleFotoChange` genera preview con `URL.createObjectURL` → botón *Confirmar Nueva Foto* → `PUT /usuarios/foto/${id}` con `FormData` → `updateUser({ foto })`.
3. **Formulario:** valida nombre ≥ 3 → `PUT /auth/perfil/update/${id}` → `updateUser({ nombre })`. El email va `disabled`.
4. Arriba: 3 accesos rápidos a módulos (Biblioteca, Equipos, Tutor IA deshabilitado).

### `GestorEquipos.jsx` (módulo de equipos — el más complejo)

**Socket.IO:**
1. `useEffect` crea `io(API_URL)` dentro del hook (no a nivel módulo) y lo guarda en `socketRef`.
2. Cleanup → `socket.disconnect()`.
3. Listeners: `tarea-creada` (con deduplicación por `tarea_id`), `tarea-movida`, `tarea-editada`, `tarea-eliminada`, `nuevo-mensaje`.
4. `nuevo-mensaje` incrementa `mensajesNoLeidos` si el chat está cerrado (usa `chatAbiertoRef` para leer el valor actual).

**Vista 1 — Sin equipo activo:**
1. Carga equipos con `GET /equipos/mis-equipos/${usuario}`.
2. Botón *Crear Equipo* → `POST /equipos/crear` → añade al state y selecciona.
3. Botón *Unirse con Código* → `POST /equipos/unirse` → recarga y selecciona.
4. Grid de tarjetas con código de invitación y rol.

**Vista 2 — Equipo activo (layout 3 columnas):**
1. **Sidebar:** clave del equipo, lista de miembros; plegable (`sidebarMinimizado`) y con overlay en móvil (`sidebarMovil`).
2. **Kanban:** 3 columnas por `ESTADOS` (`pendiente`, `en_progreso`, `completada`) con drag-and-drop nativo (`onDragStart` / `onDrop` / `onDragOver`).
3. **Tarjeta de tarea:** prioridad (`verde`/`amarillo`/`rojo`), días restantes calculados, asignado, botones rápidos de cambio de estado, botón eliminar (abre modal).
4. **Crear tarea:** formulario con título, descripción, fecha (que **auto-asigna prioridad** según días: ≤2 rojo, ≤5 amarillo, resto verde), prioridad manual y select de miembros. Al crear → `POST` + `emit('nueva-tarea')`.
5. **Editar tarea** (clic en tarjeta): modal con todos los campos → `PUT /tareas/:id` + `emit('editar-tarea')`.
6. **Eliminar tarea:** modal de confirmación → `DELETE` + `emit('eliminar-tarea')`.
7. **Chat:** panel con historial (`GET /chat/:equipo_id`), auto-scroll, `POST /chat/enviar` + `emit('mensaje-chat')`, contador de no leídos.

### `AdminPanel.jsx` (panel de administración)
1. Guard 1 (`useEffect`): si no es `admin` → `navigate('/')`.
2. Guard 2 (render): si no es `admin` → `return null`.
3. 7 pestañas: Estadísticas, Usuarios, Apuntes, Comentarios, Equipos, Baneados, Actividad.
4. Cada pestaña trae sus datos con `fetch*` (stats, usuarios+baneados en `Promise.all`, logs, apuntes, comentarios, equipos).
5. **Estadísticas:** `StatCard` (9 tarjetas de conteo) + `ChartCard` (3 gráficas de barras de 7 días).
6. **Tablas reutilizables** `ContentTable` con buscador que filtra por campos clave.
7. **Acciones:** banear (modal con motivo), desbanear, eliminar usuario/apunte/comentario/equipo — todas con confirmación y toast.
8. Badge de rol detecta si el usuario además está en `baneados`.

### `NotFound.jsx`
Página 404 con número grande, mensaje y botón *Volver al Inicio*.

---

## 5. Configuración de build y estilo

| Archivo | Función |
|---------|---------|
| `vite.config.js` | Server en `0.0.0.0:5173`, `watch.usePolling` (para Docker), y **proxy** de todas las rutas de API (`/auth`, `/apuntes`, `/favoritos`, `/usuarios`, `/comentarios`, `/valoraciones`, `/equipos`, `/tareas`, `/chat`, `/admin`, `/uploads`, `/socket.io` con `ws: true`) hacia `http://backend:4000` |
| `tailwind.config.js` | Config de Tailwind |
| `postcss.config.js` | Integra `@tailwindcss/postcss` |
| `index.html` | Carga Google Fonts **Fredoka** y **Nunito**, título "EduVers - Plataforma Académica" |
| `src/index.css` | `@import "tailwindcss"` + `@layer base` que aplica Fredoka/Nunito a `body, button, input, select, textarea` |
| `src/App.css` | Solo `@import "tailwindcss"` |
| `nginx.conf` | SPA fallback + proxy de `/uploads/` al backend (producción) |

### Assets en `public/`
- `logo-eduverse.png`, `mascota-eduverse.png`, `favicon.svg`, `icons.svg`.
- `Iconos/` → `candado.png`, `cohete.png`, `cohete_rojo.png`, `estrella.png`, `gmail.png`, `libro.png`, `ojo.png`, `ojo_cerrado.png`, `usuario.png`.
- `modulos/` → `biblioteca.png`, `gestor-equipos.png`.

---

## 6. Scripts disponibles

```bash
cd edu-verse
npm run dev      # servidor de desarrollo Vite
npm run build    # build de producción
npm run lint     # ESLint
npm run preview  # vista previa del build
```

Docker: `npm run dev -- --host 0.0.0.0` en el puerto 5173.
