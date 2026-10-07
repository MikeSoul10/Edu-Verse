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
| `logout()` | Borra **solo** `token`, `usuario`, `usuario_id`, `foto_url`, `rol`; `user = null`, dispara evento |
| `updateUser(patch)` | Mergea cambios en `user` y persiste `nombre`/`foto` en `localStorage` |

Expone `useAuth()` → `{ user, login, logout, updateUser }`.

### `src/authEvents.js`
- `emitAuthChange()` → despacha `Event('auth-change')` en `window` para sincronizar componentes que no dependen del context.

---

## 3. Componentes compartidos (`src/components/`)

### `Navbar.jsx`
1. Obtiene `user` y `logout` de `useAuth()`, y `{ oscuro, alternar }` de `useTema()`.
2. Lado izquierdo: logo y el chip *UDG Comunidad* en login/signup.
3. Lado derecho — **sin sesión:** muestra links a *Iniciar Sesión* y botón *Registrarse*.
4. Lado derecho — **con sesión:**
   - Módulos contextuales según `location.pathname` (ver tabla de `MODULOS`).
   - Si `user.rol === 'admin'` → link `⚡ Admin`.
   - Chip de perfil con foto (fallback a `ui-avatars.com`), rol y nombre.
   - Botón de cerrar sesión → `logout()` + `navigate('/login')`.
5. Botón de tema: en escritorio, primera posición del grupo de acciones (a la izquierda de los links, del chip de perfil y del logout); en móvil, al borde derecho junto al hamburger. Es el componente `BotonTema` en sus dos instancias.
6. En móvil, hamburguesa que despliega menú dropdown con las mismas opciones y `closeMenu()` en cada link.
7. Estilos: `.ev-navbar` (gradiente por tema), `.ev-logo` (inversión en oscuro), `.ev-nav-menu` (dropdown). Ver [Tema claro / oscuro](#tema-claro--oscuro).

#### Los links de módulo son datos, no JSX

`MODULOS` es una lista, y tanto la versión de escritorio como la de móvil la
consumen. Antes eran dos funciones `getModuleLinks()` / `getMobileModuleLinks()`
con JSX duplicado.

Con datos, el estado activo se resuelve en un solo lugar (`location.pathname ===
m.to`) y las dos versiones no pueden desincronizarse. El enlace activo lleva
`aria-current="page"` y un ámbar con `drop-shadow` tenue.

Si se agrega una sección, se agrega **una fila a `MODULOS`**, no dos bloques de
JSX.

#### Cierre del menú móvil

Tres vías, en un solo `useEffect` que depende de `menuOpen`:

| Vía | Implementación |
|---|---|
| `Escape` | `keydown` en `document` |
| Clic fuera | `pointerdown` + `navRef.current.contains(e.target)` |
| Cambio de ruta |Ajuste de estado **durante el render**, no `useEffect` |

El clic fuera se mide contra el `<nav>` completo, no contra el panel del menú: así
un clic en el botón que lo abrió no lo cierra dos veces en el mismo tick.

El `overflow: hidden` del `body` se restaura al valor previo en la cleanup, no a
`''` a secas: si otro componente había puesto algo ahí, restaurarlo a vacío lo
rompe.

El cambio de ruta **no** va en un `useEffect`. Un `setState` dentro de un effect
cascada un render extra y ESLint lo marca como error
(`react-hooks/set-state-in-effect`). El patrón correcto es comparar contra un
estado previo durante el render y ajustarlo ahí:

```jsx
const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
if (rutaPrevia !== location.pathname) {
  setRutaPrevia(location.pathname);
  setMenuOpen(false);
}
```

#### Color del cierre de sesión

El botón de cerrar sesión del menú móvil **no es rojo**. En este proyecto el rojo
está reservado para urgencia (vencimientos, errores de validación). Un botón rojo
ahí hace pensar que algo va mal. Es ámbar, el mismo color de hover del navbar.

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
4. El fondo va en `.ev-home-fondo` (no en `style`) para que pueda tener versión oscura.

#### Jerarquía de superficies del Home

En claro las tarjetas son **más claras** que el contenedor. En oscuro hay que
**invertir la relación**: si las tarjetas quedan más oscuras que el contenedor,
se leen como agujeros y la página pierde profundidad.

| Capa | Claro | Oscuro |
|---|---|---|
| Página | `#f0f6ff` + halos | `var(--ev-bg)` sólido |
| Contenedor | `bg-white/60` | `dark:bg-slate-900/70` |
| Tarjeta de módulo | `bg-white` | `dark:bg-slate-800` |
| Tarjeta inactiva | `bg-slate-50/80` | `dark:bg-slate-800/60` |
| Tarjeta de actividad | `bg-white/70` | `dark:bg-slate-800/70` |

`border-white/80` no sirve en oscuro: un borde blanco al 80% sobre fondo oscuro
es una línea brillante. Las tarjetas y el contenedor usan
`dark:border-slate-700/60`.

### `Biblioteca.jsx` (explorar apuntes)
1. `cargarApuntes()` con `useCallback` → `GET /apuntes`, estado `cargando` para skeletons.
2. `cargarFavoritos()` → `GET /favoritos/:usuario_id`; guarda un `Set` de `apunte_id` (para el estado de cada estrella) y `listaFavoritos` (los apuntes completos, para el panel lateral). Si no hay sesión, vacía ambos.
3. `alternarFavorito(apunte)` → alterna entre `POST /favoritos` y `DELETE /favoritos` según el estado actual. Actualización optimista con reversión si el backend rechaza.
4. `handleSearch()` → `GET /apuntes/buscar?q=`.
5. Filtro por materia: se aplica en el cliente sobre `apuntes`, no va al backend (el endpoint de búsqueda no acepta ese parámetro).
6. Carrusel "Recién subidos": `scroll-snap` nativo, flechas y puntos de navegación, auto-avance cada 6 s que se pausa al hover. Solo se renderiza con 4 apuntes o más.
7. Tarjeta "Último visto": se lee de `localStorage` (`eduverse_ultimo_apunte`), que escribe `DetalleApunte.jsx` al abrir un apunte. Solo aparece si ese apunte sigue existiendo en la lista actual.
8. **Vista previa de PDF**: dos lugares de acceso, ambos con un modal `ev-modal` compartido en `apuntePreview`.
   - **Opción B — en el carrusel**: las tarjetas grandes (`w-64 sm:w-72`) embeben un `<iframe>` con `#page=1&view=FitH` en lugar del degradado de la materia. Al hacer hover se oscurece y aparece el rótulo "Ver vista previa".
     - `loading="lazy"` es obligatorio: el carrusel monta hasta 8 iframes de PDF y sin lazy se descargan varios MB que el usuario ni está mirando.
     - `pointer-events-none` sobre el iframe: si no, el scroll interno del visor de PDF captura el hover y el clic nunca llega al botón.
   - **Opción C — en el grid chico**: las tarjetas de `sm:grid-cols-2 xl:grid-cols-3` no embeden nada (serían 20+ iframes). En su lugar hay un botón con ícono de documento que abre el mismo modal.
   - El modal muestra el documento completo con scroll interno, más dos salidas: "Abrir en pestaña nueva" (`<a target="_blank">`) y "Ver detalle completo" (link al `DetalleApunte`).
   - `esPdfUrl(url)` detecta el PDF por la extensión de `archivo_url` (`/uploads/<nombre>`), sin pedir el MIME type. Los PNG/JPG caen a un `<img>` y cualquier otro formato a la portada con degradado.
   - Cierra con la X, con clic en el overlay o con `Escape`. El scroll del body se congela y el foco entra al diálogo.
9. **Botón "Mis favoritos"**: vive en la barra de acciones, junto a *Subir
   material* y *Explorar apuntes*. Muestra el total en una píldora ámbar y abre
   el modal con la lista completa. Solo aparece con sesión iniciada y con al
   menos un favorito.
   - El modal reutiliza las clases `ev-modal` / `ev-overlay` que ya existían para los modales de tareas.
   - Cierra con la X, con el botón "Cerrar", con clic en el overlay o con `Escape`.
10. **Panel lateral**: dos tarjetas, "Tu biblioteca" con las cifras (apuntes,
   materias, autores, subidos hoy) y "Materias con más apuntes" con barras
   horizontales ordenadas por volumen.
   - Ya **no** hay un panel de favoritos en el lateral. El acceso a favoritos
     vive únicamente en el botón de la barra de acciones y en el modal.
11. Render: header con contador de "subiste hoy" e ilustración, barra de acciones, buscador con filtros, grid de apuntes con 3 estados → skeleton, vacío con CTA, o tarjetas reales.

#### Dos modales, un solo listener de Escape

Favoritos y preview comparten `ev-modal` y `ev-overlay`. El teclado tiene **un**
listener global registrado una vez que cierra los dos; el efecto que congela el
scroll es el único que mira `modalFavoritos || apuntePreview`. Si cada modal
registrara su propio listener de Escape, con dos modales abiertos un solo
Escape dispararía dos handlers.

#### Por qué el botón está en la barra y no en el panel lateral

El acceso a los favoritos es una acción frecuente, no un dato de relleno. Dentro
del panel lateral quedaba condicionado a tener más de 6 favoritos guardados, así
que con 2 o 3 no había forma de llegar al listado completo. En la barra de
acciones se ve siempre, sin scroll. El panel lateral se quitó para no duplicar
la función en dos lugares.

#### Modal de favoritos: por qué existe

El panel lateral es `lg:sticky`. Con 20 favoritos la lista completa lo estiraría
y empujaría las barras de materias y el CTA fuera de la vista, dejando un hueco
incomodo en una columna que debería quedar fija mientras se hace scroll. Por eso
el panel muestra un tope de 6 y el resto vive en el modal.

### `Upload.jsx` (subir apunte)
1. Validación de archivo en `recibirArchivo()`: tipo (`pdf/png/jpeg`) y tamaño (≤ 10 MB). Además del toast, guarda el motivo en `errorArchivo` y lo muestra dentro de la dropzone, porque un toast se va solo y el usuario puede no ver por qué no se acepta.
2. **Dropzone con drag and drop**: `onDragOver` / `onDragLeave` / `onDrop`. También responde a `Enter` y `Espacio` porque es un `div` con `role="button"` y sin tabulador no sería usable por teclado.
3. **Vista previa** en dos columnas junto a la dropzone:
   - PDF → `<iframe>` con la URL de objetos creada por `URL.createObjectURL(file)`.
   - Imagen → `<img>`.
   - La URL del blob se revoca en el cleanup del `useEffect` cuando cambia de archivo; sin eso el objeto queda retenido y la memoria filtra en cada carga.
4. Al elegir archivo válido aparece una fila con nombre, tamaño (`formatoBytes()`) y botón para quitar. Ese botón también limpia `inputRef.current.value`: sin eso, elegir de nuevo **el mismo** archivo no dispara `onChange` y la vista previa no se regenera.
5. `handleSubmit` construye `FormData` (archivo, título, materia, descripción, `usuario_id`).
6. `POST /apuntes/upload` con header `multipart/form-data`. El error se muestra con el mensaje del backend si viene como string.
7. Toast de éxito → `navigate('/biblioteca')`.
8. El botón de publicar queda deshabilitado sin archivo o durante el envío, en lugar de dejar enviar y fallar.

### `Apuntes.jsx` (repositorio)
1. `GET /apuntes` → grid de 4 columnas.
2. Cada tarjeta: título link a `/apunte/:id`, botón *Valorar*, y enlace directo al PDF.

### `DetalleApunte.jsx` (detalle + comunidad)
1. `useParams()` obtiene `id`.
2. Carga en paralelo `GET /apuntes/detalle/${id}` (incluye `promedio_rating`) y `GET /comentarios/${id}`.
3. Al cargar el apunte, escribe en `localStorage` bajo `eduverse_ultimo_apunte` el `apunte_id`, `titulo`, `materia` y `autor`. Lo consume `Biblioteca.jsx` para la tarjeta "Último visto", sin necesidad de otra petición.
4. Estado: `rating` (estrellas 1-5 del usuario), `comentario`, `comentarios`.
   - Ojo: el promedio del apunte va en una variable aparte (`promedio`). Si se declarara como `const rating = parseFloat(...)` dentro del render, sombrearía el estado y las estrellas se pintarían según el promedio en vez de la selección actual.
5. `enviarComentario()`:
   - Valida sesión y que `rating !== 0`.
   - `POST /comentarios` y luego `POST /valoraciones`.
   - Limpia campos y recarga datos.
6. UI: header `ev-mesh` con glow que sigue al mouse, botón *Abrir PDF*, columna de descripción + comentarios y columna lateral con el formulario (estrellas SVG + textarea), `lg:sticky`.

### `Apuntes.jsx` (repositorio de apuntes)
1. `GET /apuntes` al montar. Estados separados: `cargando`, `fallo` y lista vacía son tres pantallas distintas.
2. Filtro por texto (título, materia o autor) y por materia, ambos en el cliente. Las materias salen ordenadas por cantidad y se muestran las 8 primeras.
3. Header `ev-mesh` con cifras (apuntes, materias, autores), buscador y chips de materia.
4. Tarjetas con portada degradada por materia, tiempo relativo, avatar de iniciales y enlace directo al archivo.

### `MyNotes.jsx` (mis apuntes)
1. `GET /apuntes/mis-apuntes/${usuarioId}`. Ojo: ese endpoint hace `SELECT * FROM apuntes` **sin** el JOIN de usuarios, así que estos apuntes **no traen `autor`**. La UI no lo usa.
2. `confirmarEliminar()` → `DELETE /apuntes/${id}` y quita el item de la lista en vez de recargar. La recarga completa se siente lenta para algo tan simple.
3. **La confirmación va en un modal `ev-modal` propio, no con `window.confirm`.** Antes usaba `window.confirm`, que es un diálogo del navegador: no se puede estilar, se ve fuera del sistema de diseño y en algunos navegadores bloquea el hilo.
4. Cuatro estados: skeleton, error con reintentar, vacío con CTA, y lista.

### `Favorites.jsx` (favoritos)
1. `GET /favoritos/${usuarioId}`; si no hay `usuario_id` no dispara la petición.
2. `quitarFavorito(apunte)` → `DELETE /favoritos` con `data: { apunte_id }`. El body va en `data` porque es un `DELETE`.
   - **No se manda `usuario_id`**: el endpoint lo toma del token (`req.usuario.id`), mandarlo sugería que se usaba y no se usa.
   - Actualización optimista con reversión si el backend rechaza.
3. Header con contador de guardados, materias y autores. Tarjetas con insignia de estrella y degradado por materia.

### `Profile.jsx` (perfil)
1. `GET /auth/perfil/${usuarioId}` → `nombre`, `email`, `foto_url`.
2. **Foto:** input oculto → `handleFotoChange` valida tipo (PNG/JPG) y tamaño (≤ 5 MB) → preview con `URL.createObjectURL` → `PUT /usuarios/foto/${id}` con `FormData` → `updateUser({ foto })`.
   - **La URL de objetos se revoca** al reemplazarla y al descartarla. Antes nunca se revocaba y cada cambio de foto dejaba el blob retenido en memoria.
   - Hay opción de *Descartar*, que revoca la URL y limpia el input. Sin limpiar `input.value`, volver a elegir el mismo archivo no dispara `onChange`.
3. **El avatar de respaldo son iniciales generadas localmente** con `tonoDesdeNombre()`. Antes pegaba a `ui-avatars.com`: rompe sin internet y manda el nombre del usuario a un servicio de terceros.
4. **Formulario:** valida nombre ≥ 3 → `PUT /auth/perfil/update/${id}` → `updateUser({ nombre })`. El email va `disabled` con una explicación de por qué.
5. Header `ev-mesh` con avatar, nombre, correo y botón *Cerrar sesión*. Abajo, grid con los accesos a módulos.

### `NotFound.jsx` (404)
Header con el 404 en degradado de marca (`bg-clip-text`), mensaje y botón al inicio, más un grid con tres atajos a módulos. Un 404 es un callejón sin salida: sin atajos, el retroceso del navegador es la única opción.

### Tema claro / oscuro

**`src/hooks/useTema.js`** — hook `useTema()` que devuelve `{ oscuro, alternar }`.

- El atributo `dark` se pone en `<html>`, no en `<body>`.
- **El script inline de `index.html` aplica el tema antes de que React monte.** Si se hiciera en un `useEffect`, la página se pintaría en claro un instante y después saltaría a oscuro: un destello blanco en cada recarga.
- Persistencia en `localStorage`, clave `eduverse_tema`.
- Si el usuario nunca eligió tema, se sigue a `prefers-color-scheme` **en vivo**: el hook escucha el `change` de la media query y se desuscribe al desmontar.
- El toggle vive en el `Navbar`, en el **grupo del logo, a la izquierda**: es una preferencia de la aplicación, no una acción de cuenta, y así queda siempre visible sin abrir el menú en móvil.
- El fondo de `<html>` se pinta con `var(--ev-bg)`, así que el script inline cubre el fondo antes de que exista siquiera el `<body>`.

#### Tokens semánticos de superficie

La paleta oscura **no** se implementó con `dark:` de Tailwind clase por clase. Hay
~40 superficies distintas y varias páginas con colores inline; hacerlo clase por
clase es un cambio mecánico gigante y muy fácil de dejar a medias.

En su lugar, `index.css` declara **variables semánticas** en `:root` y las
redefine en `.dark`. Las clases `ev-*` las consumen:

| Token | Para qué |
|---|---|
| `--ev-bg`, `--ev-bg-halo-1/2` | Fondo de página y sus degradados |
| `--ev-surface`, `--ev-surface-solid`, `--ev-surface-raised`, `--ev-surface-sunken` | Tarjetas, paneles, filas |
| `--ev-border`, `--ev-border-strong`, `--ev-border-accent` | Bordes |
| `--ev-text`, `--ev-text-muted`, `--ev-text-soft` | Texto principal, de apoyo y suave |
| `--ev-shadow` | Sombra de panel |
| `--ev-progress-track`, `--ev-bar-track` | Rieles de barras y progreso |

Con esto el tema oscuro cubre automáticamente el fondo de página, los paneles de
vidrio, las barras y los bordes de **todas** las páginas.

#### El detalle que más se olvida

En oscuro el texto de apoyo tiene que **subir** de claridad, no bajar. Sobre
fondo claro un gris claro se lee bien; sobre fondo oscuro desaparece. Por eso
`--ev-text-muted` pasa de `#475569` a `#cbd5e1`, y `--ev-text-soft` de `#64748b`
a `#94a3b8`.

Las superficies en oscuro usan azul muy oscuro translúcido
(`rgba(15, 23, 42, 0.72)`) y no gris: el gris puro junto al azul de marca queda
sucio.

#### El `@custom-variant`: lo que hacía que nada funcionara

En **Tailwind v4** la variante `dark:` viene definida contra
`@media (prefers-color-scheme: dark)`, no contra una clase. Eso está bien para
una landing pública, pero acá el tema lo elige el usuario con el botón de la
navbar, así que tiene que depender de la clase.

Sin esto, `dark:bg-slate-900` se activaba por la preferencia del sistema
operativo y no por el toggle: dos fuentes de verdad que se contradicen, y el
botón que "no hacía nada".

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Es la primera línea de `index.css` después del `@import`. **Si se borra, el modo
oscuro deja de funcionar de golpe**, sin error de build: el CSS sigue
compilando, simplemente las reglas nunca aplican.

#### El logo: azul marino sobre barra blanca

`logo-eduverse.png` es azul marino. En claro la barra arranca en blanco y se
lee bien; en oscuro la barra arranca en `#0b1220` y el logo se volvería
**invisible**. No es un PNG con fondo blanco opaco (es transparente, alfa 0), así
que el filtro correcto es invertirlo:

```css
.dark .ev-logo { filter: brightness-0 invert; }
```

`brightness-0` primero lleva todos los píxeles a negro **conservando el alfa**,
y `invert` los da vuelta. El resultado es un logo blanco con la misma silueta
(la parte rellena de "Edu" sigue rellena, la de "Vers" sigue siendo solo
contorno). Un `invert(1)` a secas también funcionaba, pero dejaba el azul en un
tono amarillento sucio y se comía el ámbar de la marca.

#### La navbar

El gradiente vive en CSS y no en una clase arbitraria, porque cada tema tiene
el suyo:

| | Claro | Oscuro |
|---|---|---|
| Gradiente | `#fff 0% → #fff 31% → #2563eb 75% → #1e1b4b` | `#0b1220 0% → #0f172a 31% → #1d4ed8 78% → #1e1b4b` |

En oscuro el blanco inicial se convierte en manchas glaring que rompen la barra.
Clases: `.ev-navbar`, `.ev-nav-menu`, `.ev-logo`.

El botón de tema tiene **dos instancias** de un solo componente, `BotonTema`,
definido en `Navbar.jsx`:

| Instancia | Dónde | Visibilidad |
|---|---|---|
| Escritorio | Primera del grupo de acciones, antes de los links de módulo, el chip de perfil y el logout | Visible solo en `md+` (hereda `hidden md:flex` del grupo) |
| Móvil | Último hijo del `<nav>`, pegado al borde derecho junto al hamburger | `md:hidden` |

No es duplicación: es la misma pieza con dos puntos de montaje, porque cada grupo
del nav se oculta según el breakpoint. Un botón único no puede estar "a la
izquierda del perfil en escritorio" y "en el borde en móvil" sin una de esas dos
cosas.

`BotonTema` existe para que el SVG, el `aria-label` y el `title` vivan en un
solo lugar. Con dos `<button>` escritos a mano, el día que cambie el ícono es
fácil olvidar uno y quedan estados distintos en cada ancho.

#### Fondos con `style` inline: no tienen tema posible

`Home.jsx` tenía el fondo en un atributo `style`:

```jsx
style={{ backgroundColor: '#f0f6ff', backgroundImage: 'radial-gradient(...)' }}
```

Tailwind no puede aplicarle `dark:` a un atributo `style`. Por más variantes que
se agreguen en las clases vecinas, ese fondo **nunca** cambia: en oscuro quedaba
un rectángulo claro gigante, que era exactamente lo que se veía mal.

La regla general: **el fondo de una página va en una clase de `index.css`, no en
`style`.**

| Clase | Claro | Oscuro |
|---|---|---|
| `.ev-home-fondo` | `#f0f6ff` + 2 halos azules | `var(--ev-bg)` **sólido, sin halos** |
| `.ev-bg-nexo` | `#eef4fb` + 3 halos | `var(--ev-bg)` + halos al 24% / 20% |
| `.ev-mesh-bg` | `var(--ev-bg)` | `var(--ev-bg)` |

En el Home el oscuro va **sin halos** a propósito. Los degradados claros están
calibrados para leerse sobre blanco; sobre casi negro no dan profundidad, dan
ruido, y compiten con las tarjetas. El header azul degradado queda como único
elemento con relieve de la página.

Un `style` inline sí es válido para lo que **depende de los datos**: el color de
una prioridad, los tramos de un donut, el punto de una materia. Eso no es tema,
es contenido.

#### Variantes `dark:` en las clases inline

Los colores sueltos de Tailwind sí se adaptaron, con reglas que hay que
respetar al escribir más código:

| En claro | En oscuro | Regla |
|---|---|---|
| `bg-white`, `bg-slate-50`, `bg-gray-50` | `dark:bg-slate-900` | Superficie principal |
| `bg-slate-100`, `bg-gray-100` | `dark:bg-slate-800` | Superficie hundida, skeleton |
| `bg-slate-200`, `bg-gray-200` | `dark:bg-slate-700` | Riel, avatar sin foto |
| `bg-white/60`…`bg-white/95` | `dark:bg-slate-800/60`…`/95` | Cristal: conserva la opacidad |
| `text-slate-900` / `800` / `700` | `dark:text-slate-100` / `200` / `300` | **Sube** de claridad |
| `text-slate-600` / `500` / `400` | `dark:text-slate-400` | Se aplana a un solo tono |
| `bg-blue-50`, `bg-amber-50`, … | `dark:bg-<hue>-500/15` | Tinte de chip |
| `text-blue-700` sobre tinte | `dark:text-blue-300` | accompanying del tinte |
| `border-slate-200` | `dark:border-slate-700` | Hairline |

Cuatro excepciones donde **no** se toca, porque el blanco o el tinte bajo es
decorativo y no superficie:

- `bg-white/10` a `bg-white/30` - realce sobre gradiente de color (iconos,
  anillos, estados vacíos). Oscurecerlo apaga el elemento.
- `hover:bg-*-50/100` sin su `dark:hover:` - el hover pone un fondo casi blanco
  en modo oscuro y el texto claro desaparece. No es una excepción: es un bug.
  Ver [`hover:bg-*-50` sin `dark: hover`](#hoverbg-50-sin-dark-hover--el-bug-de-los-botones-ilegibles).
- `bg-white` con texto de color (`text-blue-700`, `text-amber-800`) - es un
  **botón blanco** sobre header azul. Ahí el blanco es la marca, no una
  superficie: invertirlo deja texto claro sobre fondo claro. Su hover tampoco
  lleva `dark:`, porque aclarar un blanco no depende del tema. Ver
  [`Botones claros`](#botones-claros-nunca-darkhover-con-tinte-translúcido).
- `text-white`, `text-blue-100`, `text-amber-200` — ya son claros sobre fondo
  de color.
- `bg-white` en la etiqueta de vista activa del header de equipo — el tablero
  oscuro sobre el header claro es el contraste que hace legible la pestaña.

Las paletas de materia y prioridad (`MATERIAS`, `PRIORIDADES`, `ESTADOS`,
`TONO_OTRAS`) son **strings sueltos**, no atributos `className`. Los procesa
cualquier script que busque `className="..."` y los deja intactos: hay que
revisarlos a mano. Cada entrada lleva su par `dark:` en los tres campos:

```js
{ fondo: 'from-blue-500 to-indigo-600',
  chip:  'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' }
```

#### `hover:bg-*-50` sin `dark: hover` — el bug de los botones ilegibles

Un patrón rompe el modo oscuro de una forma muy concreta:

```jsx
className="hover:bg-slate-50 dark:bg-slate-800"
```

`hover:bg-slate-50` es `#f8fafc`: casi blanco. Al pasar el cursor, el fondo salta
de oscuro a casi blanco y el texto claro desaparece. El botón queda ilegible.

Lo que no lo hace evidente es **por qué** funciona en unos sitios y en otros no:
`.dark .x` y `.x:hover` tienen **la misma especificidad** (0,2,0). Sin
`dark:hover:`, gana el que Tailwind escribió último en el CSS, y eso depende del
orden de generación de variantes. Es un empate que se decide por escritorio.

La regla: **todo `hover:bg-*-50/100` lleva su `dark:hover:` explícito.** No es
redundante, es lo que rompe el empate.

| En claro | En oscuro |
|---|---|
| `hover:bg-slate-50` | `dark:hover:bg-slate-700` |
| `hover:bg-gray-100` | `dark:hover:bg-slate-700` |
| `hover:bg-gray-50` | `dark:hover:bg-slate-800` |

El hover en oscuro aclara **un tono**, no vuelve al blanco. Se aplicó a los 15
sitios afectados (tablas del panel de admin, items de lista del gestor, botones
de la biblioteca, cerrar detalle del calendario).

Verificación: `hover:bg-(gray|slate|blue|...)-(50|100)` sin `dark:hover` en la
misma línea → no debe salir nada.

#### `.ev-btn:hover` NO puede declarar `background-color` — la causa raíz

Esta es la razón real de "el botón se pone completamente azul y ya no se ve qué
dice". No es un `dark:` mal puesto: es que `index.css` tenía esto:

```css
@media (hover: hover) and (pointer: fine) {
  .ev-btn:hover {
    background-color: #1d4ed8;   /* azul oscuro, forzado */
    box-shadow: ...;
  }
}
```

**Por qué gana siempre, sin importar qué ponga el botón:**

`@import "tailwindcss"` mete las utilidades de Tailwind en `@layer utilities`.
Las clases `ev-*` de `index.css` están escritas **fuera de cualquier capa**, y en
CSS **lo que no tiene capa gana a lo que sí la tiene**, sin importar la
especificidad. Un `(0,1,0)` sin capa le gana a un `(0,2,0)` dentro de
`@layer utilities`.

Entonces ese `background-color` pisaba:

- su propio `hover:bg-blue-50`
- su `dark:bg-*`
- su `dark:hover:bg-*`
- el `bg-white` de la base

Un botón blanco con texto azul se volvía azul oscuro al hover, con texto azul
encima. Los tres que más se veían eran *Explorar apuntes*, *Mis favoritos* y
*Volver al inicio* en la Biblioteca: los tres llevan `ev-btn`.

**La regla:** en las clases `ev-*` nunca se declara `background-color` en un
estado `:hover`. `.ev-btn:hover` aporta **solo** la elevación (`box-shadow`); el
color lo declara cada botón con `hover:bg-*`, que es lo único donde se puede
distinguir "en claro y en oscuro son distintos".

Los ~10 botones sólidos de marca que dependían del fondo forzado
(`bg-blue-600 text-white`) ahora declaran su propio `hover:bg-blue-700`.

**Cómo verificar que no volvió:** en el CSS compilado, `.ev-btn:hover` debe
contener únicamente `box-shadow`. Si aparece `background-color`, el bug está de
vuelta.

> Nota: este bug convivió con el de los `hover:bg-*-50` sin `dark:`, y tapaba
> al anterior. Arreglar el `dark:` sin tocar `.ev-btn` **no produce ningún
> cambio visible** — se probó y no funcionó. Cuando dos reglas compiten por la
> misma propiedad, gana la que está fuera de capa.

#### El par `bg` + `text` se escribe siempre completo

El modo oscuro se rompe con más frecuencia de lo que parece por **escribir la
mitad del par**:

```jsx
// MALO: el texto se aclara pero el fondo se queda blanco
bg-white text-slate-600 dark:text-slate-300

// BIEN
bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300
```

En claro el primero se ve bien, así que **nada falla de forma visible**: es el
tema oscuro el que aparece con fondo blanco y texto gris claro encima. Solo se
detecta mirando esa pantalla, no leyendo el código.

La regla: si el texto tiene `dark:text-*`, el fondo tiene `dark:bg-*`. Y al
 revés. No es que ambos sean opcionales - es que van juntos.

#### Salir del gestor

`GestorEquipos.jsx` ofrece la salida a `/` en las **tres** pantallas del módulo,
con el ícono `inicio`:

| Pantalla | Dónde | Estilo |
|---|---|---|
| Selector con equipos | Barra de acciones del hero, junto a "Crear equipo" | Botón claro con borde, como el de la Biblioteca |
| Selector sin equipos | Junto a "Crear mi primer equipo" | Ídem |
| Vista de equipo | Header azul, junto a "Equipos" | Fantasma sobre azul: `bg-white/15`, `hover:bg-white/30` |

Son dos salidas distintas y conviene no confundirlas:

- **"Equipos"** (`salirDeEquipo`) → cierra el equipo y vuelve al **selector** de
  equipos. El socket emite `salir-equipo` y se vacían tareas, mensajes y miembros.
- **"Inicio"** (`<Link to="/">`) → sale del módulo a la pantalla principal.

El de la vista de equipo vive en el header y no en el sidebar, porque el botón
"Equipos" del sidebar **solo existe cuando el panel no está minimizado**: con el
panel colapsado no había forma de salir del equipo.

#### Botones claros: nunca `dark:hover` con tinte translúcido

Este sigue siendo un bug real, en botones **sin** `ev-btn`, que no tienen la
regla anterior encima:

```jsx
// MALO
bg-white hover:bg-blue-50 dark:hover:bg-blue-500/15 text-blue-700
```

El `dark:hover:bg-blue-500/15` es un `rgba(59,130,246,0.15)`. Como es
translúcido, **reemplaza** el blanco del botón y deja ver el fondo oscuro de la
página: texto azul oscuro sobre azul oscuro.

Un tinte translúcido solo funciona si hay un fondo **opaco** detrás del cual
compositar. Un botón blanco no lo tiene.

**Regla:** si el fondo base es opaco e independiente del tema (`bg-white`), el
hover también debe serlo — `hover:bg-blue-50` y nada más.

| Fondo base | Hover en oscuro |
|---|---|
| Opaco e independiente del tema (`bg-white`) | Ninguno: aclara el mismo blanco |
| Opaco y temático (`dark:bg-slate-900`) | `dark:hover:bg-slate-800`, un tono más claro |
| Translúcido (`dark:bg-blue-500/15`) | Tinte más fuerte del mismo color, **con** `dark:text-*` |

#### Botón de inicio

`BotonInicio` es un `Link` a `/` con ícono de casa, y sigue la misma regla de
dos instancias que `BotonTema`: una en el grupo de acciones de escritorio (después
del toggle de tema) y otra en móvil al borde derecho.

El logo ya es un `Link` a `/`, pero no se lee como "volver al home": es el logo de
la marca. Este sí lo dice, con ícono y `aria-label`.

Se oculta en estas rutas, declaradas en `RUTAS_SIN_INICIO`:

| Ruta | Por qué |
|---|---|
| `/` | No hay a dónde volver |
| `/login` | Pantalla de autenticación |
| `/signup` | Ídem: ofrecer "volver al inicio" a medio camino de registrarse confunde más de lo que ayuda |

#### Transición de tema

`body` y `.ev-tema-suave` transicionan `background-color`, `border-color` y
`color` durante `--ev-t-slow` (380 ms). Suficiente para que el cambio se lea
como intencional, sin que el botón se sienta lento.

Está en el bloque `prefers-reduced-motion: reduce` con `transition: none`. El
cambio de tema cruza la pantalla entera: animado elemento por elemento se
percibe como una ola de color que puede llegar a marear.

---

### Precedencias de `localStorage`

| Clave | Se borra al cerrar sesión |
|---|---|
| `token`, `usuario`, `usuario_id`, `foto_url`, `rol` | Sí |
| `eduverse_racha` | No |
| `eduverse_tema` | No |
| `eduverse_calendario_visible` | No |
| `eduverse_ultimo_apunte` | No |

**`logout()` ya no usa `localStorage.clear()`.** Hacía eso, y borraba también la
racha: al volver a iniciar sesión no quedaba con qué comparar y la racha
reiniciaba en 1. Ahora quita solo las claves de sesión, listadas en
`CLAVES_SESION`. El interceptor de 401 de `src/config.js` ya hacía lo correcto,
quitando claves específicas.

---

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
2. **Calendario de vencimientos** (`components/CalendarioVencimientos.jsx`), en el header `ev-mesh`: inline a la derecha del nombre en `lg+`, y en una fila propia encima en móvil. Se alimenta de `tareas`, ya cargadas: no hace peticiones propias.
   - El color del punto en cada día codifica **urgencia**, no estado: rojo = vencida o vence hoy, ámbar = 1 a 3 días, azul = 4+ días. Reutiliza los tres colores que el usuario ya aprendió a leer en las tarjetas y en el resumen; no introduce un color nuevo.
   - Las tareas completadas y las que no tienen fecha no aparecen en la grilla.
   - Los puntos rojos laten (`ev-punto-critico`) para que el ojo los encuentre sin leer los números.
   - Al hacer clic en un día con vencimientos se abre un popover con las tareas, su prioridad, el plazo ("Vence hoy", "Mañana", "En 3 d") y el responsable.
     - **El popover se monta en un portal (`createPortal` a `document.body`).** El header que lo contiene tiene `overflow: hidden` para recortar sus círculos decorativos: si el popover quedara en el árbol normal, el navegador lo cortaría a la altura del header y nunca se vería. Al ser `position: fixed`, hay que recalcular su posición en `scroll` y `resize`, y limitar el borde izquierdo con `window.innerWidth` para que no se salga en móvil.
     - "Ver en el tablero" salta a la vista `tablero` con el filtro por fecha aplicado. El filtro se marca con un chip en la barra del tablero que lo quita.
     - Cierra con `Escape` o clic fuera. El listener de clic fuera ignora los eventos que caen dentro de `[data-calendario]`: se registra en el mismo tick del clic que lo abrió y cerraría el popover de inmediato.
     - **Se puede ocultar** con el botón de calendario del header. La preferencia se guarda en `eduverse_calendario_visible` (por defecto visible). El botón queda siempre visible, también con el calendario oculto, para poder volver a mostrarlo sin cambiar de equipo.
2. **Kanban:** 3 columnas por `ESTADOS` (`pendiente`, `en_progreso`, `completada`) con drag-and-drop nativo (`onDragStart` / `onDrop` / `onDragOver`).
3. **Tarjeta de tarea:** prioridad (`verde`/`amarillo`/`rojo`), días restantes calculados, asignado, botones rápidos de cambio de estado, botón eliminar (abre modal).
4. **Crear tarea:** formulario con título, descripción, fecha (que **auto-asigna prioridad** según días: ≤2 rojo, ≤5 amarillo, resto verde), prioridad manual y select de miembros. Al crear → `POST` + `emit('nueva-tarea')`.
5. **Editar tarea** (clic en tarjeta): modal con todos los campos → `PUT /tareas/:id` + `emit('editar-tarea')`.
6. **Eliminar tarea:** modal de confirmación → `DELETE` + `emit('eliminar-tarea')`.
7. **Chat:** panel con historial (`GET /chat/:equipo_id`), auto-scroll, `POST /chat/enviar` + `emit('mensaje-chat')`, contador de no leídos.

#### Filtros del tablero

`filtroPrioridad` (`todas` | `verde` | `amarillo` | `rojo` | `vencidas`),
`filtroMiembro`, `busqueda` y `filtroFecha` (clave `YYYY-MM-DD`, la inyecta el
calendario). `limpiarFiltros()` los revierte todos y se invoca también al
cambiar de equipo.

El chip "Todas" queda activo solo cuando **no** hay ningún filtro puesto, no
cuando `filtroPrioridad === 'todas'` a secas: si el calendario filtró por una
fecha y el chip se viera activo, el tablero parecería sin filtros cuando no lo
está.

#### Comparación de fechas: dos detalles que importan

- `claveDiaLocal()` construye `YYYY-MM-DD` en hora local. Usar
  `toISOString().slice(0, 10)` correría el cálculo a UTC y podría corrimiento
  un día el vencimiento. El calendario genera las claves con la misma función
  para que ambas coincidan.
- El calendario no usa `Math.ceil((a - b) / 86400000)` para los días
  restantes: con cambio de hora el redondeo se va un día. Compara las fechas a
  medianoche local con `Math.round`.

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
| `index.html` | Carga Google Fonts **Fredoka** y **Nunito**, título "EduVers - Plataforma Académica", y el **script inline anti-FOUC** que aplica el tema antes de que monte React |
| `src/index.css` | `@custom-variant dark` + `@import "tailwindcss"` + `@layer base` con los tokens de superficie, y el sistema de clases `ev-*` (fondos, paneles, animaciones, foco de teclado, reduced-motion) |

### El sistema de clases `ev-*`

Todo el diseño del proyecto se apoya en clases propias de `index.css` en vez de
estilos sueltos. Las familias principales:

| Prefijo | Para qué |
|---|---|
| `ev-mesh`, `ev-mesh-bg`, `ev-dotfield`, `ev-gridfield` | Fondos: degradado azul, puntos, grilla técnica |
| `ev-panel-glass`, `ev-panel`, `ev-card-dash`, `ev-esquina` | Superficies: glassmorphism, paneles, tarjetas con hover |
| `ev-enter`, `ev-d-0`…`ev-d-6`, `ev-slide-right`, `ev-sr-0`…`ev-sr-3` | Entradas: fade, escalonado y lateral |
| `ev-float`, `ev-rebote-suave`, `ev-flama`, `ev-punto-critico` | Animaciones de escena |
| `ev-shimmer`, `ev-shimmer-claro` | Brillo que recorre el botón al hover |
| `ev-progress-track` / `-fill`, `ev-bar-track` / `-fill` | Barras de progreso y de charts |
| `ev-btn`, `ev-chip`, `ev-tab`, `ev-field`, `ev-focusable` | Componentes e interacción |
| `ev-modal`, `ev-overlay`, `ev-burbuja` | Modales, backdrop y popovers |
| `ev-navbar`, `ev-logo`, `ev-nav-menu` | Navbar: gradiente por tema, inversión del logo en oscuro, dropdown móvil |

Sobre `ev-focusable`: da el anillo de foco por teclado (`outline: 2px solid
#2563eb`, `outline-offset: 3px`). **Todo elemento interactivo de la navbar lo
lleva** — links, botones de icono, toggle de tema. Los botones que solo tienen
ícono necesitan además `aria-label` o `title`: sin texto visible, un lector de
pantalla anuncia literalmente "botón".
| `ev-home-fondo` | Fondo de la portada, con versión propia por tema |
| `ev-divisor`, `ev-track-brillo`, `ev-favorito`, `ev-estrella`, `ev-stat-icon` | Detalles de tablas y tarjetas |

Dos reglas que se respetan en todo el proyecto:

- **`prefers-reduced-motion`**: toda animación nueva se agrega al bloque del
  final de `index.css`. Una animación fuera de ese bloque es un fallo de
  accesibilidad.
- **`ev-shimmer-claro` en botones claros**: el brillo de `ev-shimmer` es blanco
  al 28% y sobre un botón blanco no se ve — la animación corre pero es
  invisible. Los botones con `bg-white` usan la variante con tinte azul.
- **Ningún color de superficie hardcodeado en CSS**: lo que se usa son
  `var(--ev-*)`. Si aparece un `#fff` suelto en `index.css`, ese elemento se
  queda claro en modo oscuro sin que nada lo avise. Ya se corrigieron los dos
  casos que existían (`.ev-field:focus` y `.ev-donut-hueco`).
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
