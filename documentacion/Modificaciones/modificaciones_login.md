# Historial de Modificaciones - Login y Frontend

Este documento registra todas las modificaciones, mejoras y correcciones realizadas en el Frontend de **Edu-Verse**, enfocándose en el módulo de inicio de sesión (`Login.jsx`), flujo de autenticación e integración con la API.

---

## 📌 Formato de Registro
Cada entrada en este historial incluye:
- **Fecha y Hora:** Timestamp de la modificación.
- **Componentes / Archivos Afectados:** Archivos del frontend modificados.
- **Descripción del Cambio:** Detalle técnico de lo realizado.
- **Motivo / Problema Solucionado:** Razón por la cual se implementó el cambio.

---

## 📝 Registro de Cambios

### [2026-09-22] - Actualización Visual del Login: Tipografía Redondeada, Nuevo Logo y Mascota Oficial
- **Archivos Afectados:**
  - `edu-verse/index.html`
  - `edu-verse/src/index.css`
  - `edu-verse/src/pages/Login.jsx`
  - `edu-verse/src/components/Navbar.jsx`
  - `edu-verse/public/logo-eduverse.png` *(NUEVO)*
  - `edu-verse/public/mascota-eduverse.png` *(NUEVO)*
- **Descripción:**
  - Se importó la fuente tipográfica **Fredoka** (Google Fonts) con estilos redondeados y amigables idénticos al estilo de letras de la marca en la imagen proporcionada.
  - Se aplicó la nueva tipografía globalmente en `index.css` y `Login.jsx` para títulos, campos de entrada, botones e instrucciones.
  - Se integraron los archivos de imagen oficiales de la marca (`logo-eduverse.png` y la mascota `mascota-eduverse.png`).
  - Se rediseñó la vista de inicio de sesión (`Login.jsx`) en una tarjeta moderna dividida en 2 secciones:
    - **Panel Izquierdo:** Presentación de la marca con degradado azul/índigo, el nuevo logo `EduVers`, la mascota oficial (el monstruo rojo con birrete sosteniendo el libro) con badge flotante animado (*"¡Hola! 👋"*) y efecto hover interactivo.
    - **Panel Derecho:** Formulario de inicio de sesión estilizado con inputs redondeados (`rounded-2xl`), iconos (📧, 🔒), botón toggle para visibilidad de contraseña (👁️/🙈) y botón de ingreso con animación.
  - Se actualizó el logo en la barra de navegación (`Navbar.jsx`) para mantener consistencia con la nueva marca.
- **Resultado:**
  - Vista de Login moderna, atractiva, responsiva e identificada con la nueva tipografía y mascota oficial de EduVers.

---

### [2026-09-22] - Corrección de Conexión de Servidor e Integración con Backend
- **Archivos Afectados:**
  - `docker-compose.yml`
  - `edu-verse/vite.config.js`
  - `edu-verse/src/config.js`
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se resolvió la falla de conexión HTTP proxy (`ECONNREFUSED`) entre el servidor de desarrollo Vite (`:5173`) y el backend Express (`:4000`).
  - Se verificó la integración del formulario en `Login.jsx` con el interceptor de Axios en `config.js` y el estado global de autenticación `AuthContext.jsx`.
  - Se confirmó que al iniciar sesión correctamente se almacene el token JWT y los datos del usuario en `localStorage`.
- **Resultado:**
  - Flujo de Login y Registro 100% funcional y probado con cuentas institucionales.

---

### [2026-09-22] - Ampliación de la Tarjeta Central del Login
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se ajustó el ancho máximo de la tarjeta central del Login a `max-w-6xl` como tamaño definitivo, abarcando más espacio de la pantalla sin sobresaturar el diseño.
- **Motivo:**
  - Mejorar la presencia visual del formulario en pantallas grandes aprovechando mejor el espacio disponible.
- **Resultado:**
  - La tarjeta central del Login ahora cubre un área mayor de la pantalla manteniendo la responsividad en dispositivos móviles.

---

### [2026-09-22] - Letras Pequeñas del Login Más Grandes
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se aumentó el tamaño de las tipografías más pequeñas del Login para mejorar la legibilidad:
    - Badge "¡Hola! 👋": de `text-xs` a `text-sm`.
    - Texto "Exclusivo para estudiantes universitarios": de `text-xs` a `text-sm`.
    - Link "¿La olvidaste?": de `text-xs` a `text-sm`.
- **Motivo:**
  - Los textos pequeños resultaban difíciles de leer.
- **Resultado:**
  - Todos los textos del Login mantienen una legibilidad adecuada.

---

### [2026-09-22] - Logo y Mascota del Login Más Grandes
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se aumentó el tamaño del logo `EduVers` de `h-20 sm:h-24` a `h-24 sm:h-28`.
  - Se aumentó el tamaño de la mascota oficial de `w-48 sm:w-56` a `w-56 sm:w-64`.
- **Motivo:**
  - Dar mayor protagonismo visual a la marca dentro de la tarjeta ahora más amplia.
- **Resultado:**
  - Logo y mascota se ven más grandes y equilibrados con el nuevo tamaño de la tarjeta.

---

### [2026-09-22] - Aumento General del Tamaño de Letras en el Login
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se incrementó el tamaño tipográfico de todos los textos del Login para mejorar la visibilidad con la nueva tarjeta más amplia:
    - Título "¡Hola de nuevo!": `text-3xl/4xl` → `text-4xl/5xl`.
    - Subtítulo "Ingresa a tu cuenta": `text-base` → `text-lg`.
    - Labels "Correo Institucional"/"Contraseña": `text-sm` → `text-base`.
    - Inputs de texto: ahora `text-lg`.
    - Iconos 📧 y 🔒: `text-lg` → `text-xl`.
    - Link "¿La olvidaste?": `text-sm` → `text-base`.
    - Botón "Entrar a mi cuenta": `text-lg` → `text-xl` (🚀 a `text-2xl`).
    - Texto comunidad académica (panel izquierdo): `text-base/lg` → `text-lg/xl`.
    - "Exclusivo para estudiantes universitarios": `text-sm` → `text-base`.
    - Badge "¡Hola! 👋": `text-sm` → `text-base`.
    - "¿No tienes cuenta? / Regístrate gratis": `text-sm` → `text-base`.
- **Motivo:**
  - El usuario solicitó que todas las letras del Login se vean más grandes.
- **Resultado:**
  - Toda la tipografía del Login aumentó de tamaño manteniendo el equilibrio visual.

---

### [2026-09-22] - Frases Rotativas en el Badge de la Mascota
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - El mensaje del badge de la mascota ("¡Hola! 👋") ahora rota entre 3 frases que cambian automáticamente cada 3 segundos:
    - "¡Hola! 👋"
    - "¡Estudia conmigo! ✨"
    - "¡Comparte tus apuntes! 📚"
  - Se implementó con estado local (`fraseIdx`), un `useEffect` con `setInterval` que avanza el índice en ciclo, y la prop `key={fraseIdx}` para re-trigger de la animación al cambiar de frase.
- **Motivo:**
  - El usuario solicitó que la mascota diga dos frases adicionales y que cambien con el tiempo.
- **Resultado:**
  - La mascota muestra una frase distinta cada 3 segundos con animación al cambiar.

---

### [2026-09-22] - Registro Alineado Visualmente con el Login
- **Archivos Afectados:**
  - `edu-verse/src/pages/Signup.jsx`
- **Descripción:**
  - Se rediseñó la página de Registro con el mismo estilo visual del Login:
    - Misma tarjeta central (`rounded-3xl`, `shadow-2xl`, `max-w-6xl`) dividida en paneles izquierdo (marca) y derecho (formulario).
    - Panel izquierdo con logo y mascota oficial, badge de frases rotativas y textos de marca idénticos al Login.
    - Formulario con inputs `rounded-2xl` con iconos (👤, 📧, 🔒), toggle de visibilidad de contraseña (👁️/🙈), botón grande con 🚀 y tipografía Fredoka con los mismos tamaños.
    - Se conservan todas las validaciones client-side existentes del registro.
- **Motivo:**
  - El usuario solicitó que el registro se vea igual que el inicio de sesión.
- **Resultado:**
  - Login y Registro comparten exactamente el mismo diseño y experiencia visual.

---

### [2026-09-22] - Patrón de Puntitos en el Fondo Blanco del Login
- **Archivos Afectados:**
  - `edu-verse/src/pages/Login.jsx`
- **Descripción:**
  - Se añadió un patrón decorativo de puntitos en el fondo blanco que rodea la tarjeta central del Login (área exterior), implementado con un `div` superpuesto (`absolute inset-0`) que usa `radial-gradient` (puntos azules `rgba(59,130,246,0.5)` de 3px) con espaciado de `36px` vía `backgroundSize`.
  - El contenedor mantiene el degradado original (`from-blue-50 via-white to-amber-50`) y la tarjeta queda por encima de los puntitos con `relative z-10`.
- **Motivo:**
  - El usuario solicitó puntitos en el fondo alrededor de la tarjeta (no dentro del panel blanco del formulario) para decorar la página de login sin quitar legibilidad.
- **Resultado:**
  - El fondo alrededor de la tarjeta del Login muestra puntitos azules espaciados, sin puntitos dentro del panel del formulario.

---

*(Las futuras modificaciones al Login y Frontend se irán añadiendo en este archivo).*
