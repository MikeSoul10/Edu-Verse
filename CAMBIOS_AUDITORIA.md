# Edu-Verse — Auditoría y Corrección Completa del Codebase

**Fecha:** 18 de julio de 2026
**Rama:** `fixeo` (27 archivos, 429 inserciones, 439 eliminaciones)
**Stack:** React 19 + Vite + Tailwind CSS | Node.js + Express + PostgreSQL | Docker Compose

---

## Resumen Ejecutivo

Se realizó una auditoría completa del codebase de Edu-Verse identificando **21 problemas** clasificados por severidad. Todos fueron corregidos en esta rama.

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| CRITICAL | 5 | Resueltos |
| HIGH | 6 | Resueltos |
| MEDIUM | 10 | Resueltos |
| LOW | 6 | Resueltos |
| **Total** | **27** | **100%** |

---

## CRITICAL (5)

### 1. JWT_SECRET hardcodeado
- **Archivo:** `edu-verse_backend/index.js`
- **Problema:** El secret para firmar tokens JWT estaba en el código fuente, expuesto en el repositorio.
- **Corrección:** Se movió a `edu-verse_backend/.env`. El servidor ahora hace `process.exit()` si no existe la variable.

### 2. DB credentials hardcodeadas en docker-compose.yml
- **Archivo:** `docker-compose.yml`
- **Problema:** Usuario, contraseña y nombre de base de datos estaban en texto plano.
- **Corrección:** Se creó archivo raíz `.env` con variables `${DB_PASSWORD}`, `${DB_NAME}`, `${JWT_SECRET}`. Docker Compose las resuelve automáticamente.

### 3. DELETE /favoritos: variable shadowing de usuario_id
- **Archivo:** `edu-verse_backend/index.js`
- **Problema:** La ruta usaba `req.body.usuario_id` en vez de `req.usuario.id` del JWT, permitiendo eliminar favoritos de otros usuarios.
- **Corrección:** Se usa `req.usuario.id` del middleware de autenticación.

### 4. Multer sin límites de tamaño o tipo
- **Archivo:** `edu-verse_backend/index.js`
- **Problema:** Cualquier archivo de cualquier tamaño podía subirse.
- **Corrección:** Se configuró `limits: { fileSize: 10MB }` para apuntes y `5MB` para fotos de perfil. Se agregó `fileFilter` que solo acepta PDF/PNG/JPG.

### 5. Sin sanitización de inputs (XSS)
- **Problema:** Texto de chat, comentarios, tareas y equipos se insertaba sin escapar.
- **Corrección:** Se creó `middleware/sanitize.js` con función `escapeHtml()`. Se aplica a: texto de chat, comentarios, título/descripción de tareas, nombre de equipos.

---

## HIGH (6)

### 1. Navbar no se re-renderiza al hacer login
- **Archivo:** `edu-verse/src/components/Navbar.jsx`
- **Problema:** El Navbar leía `localStorage` directamente al renderizar. Al hacer login, no se actualizaba sin recargar la página.
- **Corrección:** Se implementó `AuthContext` (`src/context/AuthContext.jsx`) con `useAuth()`. Navbar, Login y Profile ahora usan el context para reactividad.

### 2. `window.location.reload()` en Login
- **Archivo:** `edu-verse/src/pages/Login.jsx`
- **Problema:** Se usaba `window.location.reload()` para actualizar el Navbar después del login.
- **Corrección:** Reemplazado por `AuthContext.login()` que actualiza el state reactivo.

### 3. Socket.IO se conecta al importar, nunca se desconecta
- **Archivo:** `edu-verse/src/pages/GestorEquipos.jsx`
- **Problema:** `const socket = io(API_URL)` estaba a nivel de módulo (línea 7). Al importar el archivo se abría una conexión permanente.
- **Corrección:** Socket se crea dentro de `useEffect` con `return () => socket.disconnect()` en el cleanup. Se usa `socketRef` para mantener la referencia.

### 4. Frontend incluía bcrypt y multer en package.json
- **Archivo:** `edu-verse/package.json`
- **Problema:** Dependencias del backend estaban en el frontend.
- **Corrección:** Eliminadas de `package.json`.

### 5. Auth middleware no existía compartido
- **Problema:** La verificación de JWT no estaba en un archivo compartido.
- **Corrección:** Se creó `middleware/auth.js` con `verificarToken`. Se aplicó a: upload, delete apuntes, update perfil, foto perfil, comentarios, valoraciones, crear/unirse equipo, tareas (crear/mover/eliminar), chat enviar.

### 6. Login no retornaba foto_url
- **Archivo:** `edu-verse_backend/index.js`
- **Problema:** La respuesta de login no incluía la URL de la foto de perfil.
- **Corrección:** Se agregó `foto_url` a la consulta del endpoint de login.

---

## MEDIUM (10)

### 1. Código muerto en query de búsqueda
- **Archivo:** `edu-verse_backend/index.js:247`
- **Problema:** `valores = [`%${q}%` || '%%']` — el `|| '%%'` nunca se ejecuta.
- **Corrección:** Simplificado a `valores = [`%${q}%`]`.

### 2. Ruta `/Home` duplicada
- **Archivo:** `edu-verse/src/App.jsx`
- **Problema:** Existían rutas `/` y `/Home` apuntando al mismo componente.
- **Corrección:** Eliminada la ruta `/Home`.

### 3. Rutas sin protección
- **Archivo:** `edu-verse/src/App.jsx`
- **Problema:** `/upload`, `/mis-apuntes`, `/favoritos`, `/perfil` no usaban `ProtectedRoute`.
- **Corrección:** Todas envueltas en `<ProtectedRoute>`.

### 4. Links externos sin `rel="noopener noreferrer"`
- **Archivo:** `edu-verse/src/pages/Favorites.jsx`, `MyNotes.jsx`
- **Problema:** Links a PDFs abrían en nueva pestaña sin proteger contra tab-nabbing.
- **Corrección:** Agregado `rel="noopener noreferrer"`.

### 5. Sin estado de autenticación compartido
- **Problema:** Cada componente leía localStorage independientemente. No había una fuente única de verdad.
- **Corrección:** Se creó `src/context/AuthContext.jsx` con `AuthProvider`, `useAuth()`, `login()`, `logout()`, `updateUser()`.

### 6. Race condition en GestorEquipos
- **Archivo:** `edu-verse/src/pages/GestorEquipos.jsx`
- **Problema:** Al crear una tarea, la UI dependía del evento socket que podía no llegar. También no había deduplicación.
- **Corrección:** `crearTarea` ahora agrega la tarea al state inmediatamente después del POST. El listener `tarea-creada` deduplica por `tarea_id`.

### 7. Sin Error Boundary
- **Problema:** Un error en cualquier componente causaba pantalla blanca sin información.
- **Corrección:** Se creó `src/components/ErrorBoundary.jsx` y se envolvió toda la app en `App.jsx`.

### 8. App.css con 184 líneas de estilos no usados
- **Archivo:** `edu-verse/src/App.css`
- **Problema:** Template de Vite con estilos para `.counter`, `.hero`, `#center`, `#next-steps`, etc. que no se usaban.
- **Corrección:** Limpiado a solo `@import "tailwindcss";`.

### 9. useEffect con dependencias faltantes
- **Archivos:** `Biblioteca.jsx`, `MyNotes.jsx`, `DetalleApunte.jsx`
- **Problema:** Funciones de carga de datos no estaban en las dependencias de useEffect.
- **Corrección:** Se envolvieron en `useCallback` y se agregaron a las dependencias.

### 10. Chat messages usaban array index como key
- **Archivo:** `edu-verse/src/pages/GestorEquipos.jsx:615`
- **Problema:** `key={i}` causaba problemas de rendering con mensajes dinámicos.
- **Corrección:** Cambiado a `key={msg.mensaje_id || msg.fecha_envio}`.

---

## LOW (6)

### 1. Sin validación de archivo en cliente
- **Archivo:** `edu-verse/src/pages/Upload.jsx`
- **Problema:** El formulario no validaba tipo ni tamaño del archivo antes de enviar.
- **Corrección:** Se validan tipo (PDF/PNG/JPG) y tamaño (10MB) en el cliente con toast de error.

### 2. Sin loading states
- **Archivos:** `MyNotes.jsx`, `Favorites.jsx`
- **Problema:** No mostraban indicador de carga al iniciar.
- **Corrección:** Se agregó spinner animado durante la carga inicial.

### 3. Sin labels de accesibilidad
- **Archivo:** `edu-verse/src/pages/GestorEquipos.jsx`
- **Problema:** Inputs de formulario sin `aria-label`.
- **Corrección:** Agregado `aria-label` a los 5 inputs principales (equipo, código, título, descripción, chat).

### 4. Console.error innecesarios
- **Archivos:** Todas las páginas React
- **Problema:** `console.error` en catch blocks sin valor diagnóstico.
- **Corrección:** Eliminados. Solo se mantiene el de `ErrorBoundary.jsx` (necesario para debugging).

### 5. Navbar sin responsive
- **Archivo:** `edu-verse/src/components/Navbar.jsx`
- **Problema:** En móvil los links del nav se desbordaban.
- **Corrección:** Se agregó hamburger menu con dropdown en móvil, manteniendo el layout original en desktop.

### 6. alert() nativo del navegador
- **Archivos:** `Upload.jsx`, `Signup.jsx`
- **Problema:** Se usaba `alert()` en vez de toasts.
- **Corrección:** Reemplazado por `toast.error()` de react-hot-toast.

---

## Archivos Creados (nuevos)

| Archivo | Propósito |
|---------|-----------|
| `.env` (raíz) | Variables de Docker Compose (`DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`) |
| `edu-verse_backend/middleware/auth.js` | Middleware compartido `verificarToken` |
| `edu-verse_backend/middleware/sanitize.js` | Utilidad `escapeHtml()` para prevenir XSS |
| `edu-verse/src/context/AuthContext.jsx` | Context de autenticación reactivo |
| `edu-verse/src/authEvents.js` | Custom event `auth-change` para sincronización |
| `edu-verse/src/components/ErrorBoundary.jsx` | Error boundary global |

## Archivos Eliminados

| Archivo | Razón |
|---------|-------|
| `edu-verse_backend/migrate_equipos.sql` | Tablas incluidas en `backup.sql` |

## Infraestructura

| Cambio | Detalle |
|--------|---------|
| Dockerfile backend | `CMD ["npx", "nodemon", "--legacy-watch", "index.js"]` + `npm install --include=dev` |
| docker-compose.yml | Variables de entorno referencian `.env` raíz |
| backup.sql | Incluye tablas: usuarios, apuntes, comentarios, favoritos, valoraciones, equipos, miembros_equipo, tareas, mensajes_chat |
| DB emails | Todos actualizados a `@alumnos.udg.mx` |

---

## Dependencias Agregadas/Eliminadas

### Frontend (`edu-verse/package.json`)
- **Eliminadas:** `bcrypt`, `multer` (no correspondían al frontend)
- **Existentes mantenidas:** `react-hot-toast`, `socket.io-client`, `axios`

### Backend (`edu-verse_backend/package.json`)
- **Mantenidas:** `nodemon` (devDependency, ahora se instala con `--include=dev`)

---

## Instrucciones de Conversión a PDF

### Desde VS Code:
1. Abrir este archivo (`CAMBIOS_AUDITORIA.md`)
2. `Ctrl + Shift + P` → "Markdown: Open Preview to the Side"
3. En la previsualización, click derecho → "Print"
4. Seleccionar "Save as PDF"

### Desde GitHub:
1. Ir a la rama `fixeo`
2. Abrir `CAMBIOS_AUDITORIA.md`
3. GitHub lo renderiza automáticamente
4. `Ctrl + P` → "Save as PDF"
