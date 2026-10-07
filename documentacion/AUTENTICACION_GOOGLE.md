# Autenticación con Google (Google Sign-In) — PLAN A FUTURO

> ## ⚠️ Estado: NO IMPLEMENTADO
>
> **Este documento describe un plan de trabajo, no una funcionalidad existente.**
>
> La implementación se reversó por decisión del equipo el 6 de octubre de 2026.
> El código de Google Sign-In **no está en el repositorio**: no existe
> `BotonGoogle.jsx`, no existe el endpoint `POST /auth/google`, y no está la
> dependencia `google-auth-library`.
>
> Este documento se conserva íntegro como guía de implementación para cuando se
> retome el trabajo. **Todo el código de ejemplo que aparece más abajo está
> extraído de una implementación que existió y fue deshecha**: sirve como
> referencia, no como descripción del estado actual.
>
> **Estado actual del login:** únicamente formulario manual con correo y
> contraseña, restringido a `@alumnos.udg.mx`, validado en `Login.jsx`,
> `Signup.jsx` y los endpoints `/auth/login` y `/auth/signup` del backend.
>
> Para retomar este plan, seguí la sección
> [3. Configuración en Google Cloud](#3-configuración-en-google-cloud) y luego
> [5. Instalación de dependencias](#5-instalación-de-dependencias). La sección
> [13. Deshacer el cambio](#13-deshacer-el-cambio) ya se ejecutó y sirve de
> referencia para el camino inverso.

---

Documento completo del proceso: desde cómo se configura en Google Cloud hasta
cómo quedó implementado en el código, con las decisiones de diseño tomadas.

**Alcance:** Login y Signup aceptarían una vía alternativa con Google que
**convive** con el formulario manual de correo y contraseña. Solo se admiten
correos institucionales `@alumnos.udg.mx`.

---

## Índice

1. [Qué hace y qué no hace](#1-qué-hace-y-qué-no-hace)
2. [Requisitos previos](#2-requisitos-previos)
3. [Configuración en Google Cloud](#3-configuración-en-google-cloud)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Instalación de dependencias](#5-instalación-de-dependencias)
6. [Flujo de autenticación](#6-flujo-de-autenticación)
7. [Implementación backend](#7-implementación-backend)
8. [Implementación frontend](#8-implementación-frontend)
9. [Decisiones de diseño](#9-decisiones-de-diseño)
10. [Manejo de errores](#10-manejo-de-errores)
11. [Pruebas manuales](#11-pruebas-manuales)
12. [Troubleshooting](#12-troubleshooting)
13. [Deshacer el cambio](#13-deshacer-el-cambio)

---

## Resumen rápido

> Este resumen **no aplica al estado actual del proyecto**: la funcionalidad
> está revertida. Sirve como checklist de arranque si se retoma el plan.

Si ya tenés el Client ID de Google y solo querés levantarlo:

```bash
# 1. Frontend: pegar el Client ID
#    Crear edu-verse/.env.local con:
#    VITE_GOOGLE_CLIENT_ID=123456789-...apps.googleusercontent.com

# 2. Backend: pegar el MISMO valor
#    Crear edu-verse_backend/.env con:
#    JWT_SECRET=<64 caracteres aleatorios>
#    GOOGLE_CLIENT_ID=123456789-...apps.googleusercontent.com

# 3. Instalar la dependencia nueva
cd edu-verse_backend && npm install google-auth-library

# 4. Reiniciar ambos servidores
```

---

## 1. Qué hace y qué no hace

**Hace:**

- Muestra el botón oficial "Continuar con Google" en `/login` y `/signup`.
- Abre el popup nativo de selección de cuenta de Google.
- Verifica el `id_token` en el **backend**.
- Rechaza cualquier correo que no termine en `@alumnos.udg.mx`.
- Crea la cuenta automáticamente en el primer ingreso con Google.
- Si la cuenta ya existía (registro manual previo), solo inicia sesión.
- Devuelve el mismo JWT que usa el login manual, así el resto de la app no
  distingue un método de otro.

**No hace:**

- No reemplaza al formulario manual. Ambos conviven.
- No pide permisos extra: solo email y perfil básico.
- No crea contraseña para las cuentas de Google. `password_hash` queda en
  `NULL` y esa cuenta solo entra por Google.
- No permite registrarse con Google desde la pantalla de Login; el botón está
  en ambas, pero el flujo es el mismo.

---

## 2. Requisitos previos

| Requisito | Detalle |
|---|---|
| Cuenta de Google | Cualquiera, incluso una personal, para crear el proyecto |
| Acceso al proyecto | Cualquiera de los proyectos de la UDG (autorización del administrador del proyecto) |
| Node.js | Misma versión que el resto del proyecto |
| Navegador | Cualquiera moderno; en pruebas, sin bloqueadores de scripts de terceros |

---

## 3. Configuración en Google Cloud

Paso a paso desde cero.

### 3.1 Crear el proyecto

1. Entrá a <https://console.cloud.google.com>
2. Arriba a la izquierda, junto al nombre del proyecto, tocá el selector
   **"Seleccionar un proyecto"**.
3. Clic en **"Nuevo proyecto"**.
4. Nombre: `Edu-Verse` (o el que prefieras).
5. Ubicación: elegí la que corresponda a tu organización.
6. Clic en **Crear**.

### 3.2 Habilitar la API

1. Con el proyecto seleccionado, entrá a
   <https://console.cloud.google.com/apis/library>
2. Buscá **"Google Identity Services API"**.
3. Clic en el resultado y después en **Habilitar**.

> También podés ir directo desde
> <https://console.cloud.google.com/apis/identity-platform.googleapis.com>

### 3.3 Configurar la pantalla de consentimiento OAuth

Esto es lo que el usuario ve la primera vez. Necesario para pasar de "prueba"
a producción.

1. Entrá a <https://console.cloud.google.com/auth/branding>
2. Pestaña **Branding**:
   - **App name**: `Edu-Verse`
   - **User support email**: tu correo
   - **App logo**: opcional, pero mejora la pantalla de consentimiento
3. Pestaña **Audience**: elegí **External**.
   - Esto permite cuentas de cualquier dominio, que es justamente lo que
     queremos validar después contra `@alumnos.udg.mx`.
   - Con "Internal" Google solo dejaría pasar cuentas del propio dominio de
     Google Workspace de la UDG, lo cual podría ser más restrictivo de lo que
     el proyecto necesita.
4. En **Clients**, agregá los correos de los testers que no estén en el
   dominio, si vas a probar con cuentas personales durante el desarrollo.

> Mientras la app esté en estado **Testing**, Google limita a 100 usuarios de
> prueba y muestra una advertencia en pantalla. Para producción hay que
> pasar el botón **"Publish app"**.

### 3.4 Crear el OAuth Client ID

1. Entrá a <https://console.cloud.google.com/auth/clients>
2. Clic en **"Create client"**.
3. Tipo: **Web application**.
4. **Name**: `Edu-Verse Web`
5. **Authorized JavaScript origins**: los orígenes desde donde se sirve el
   frontend. Sin la barra final.

   ```
   http://localhost:5173
   ```

   Si tu Vite corre en otro puerto, ajustá acá. Para producción, sumá el
   dominio real:

   ```
   https://eduverse.udg.mx
   ```

6. **Authorized redirect URIs**: dejalo vacío. Google Identity Services usa
   popup, no redirecciones, así que no aplica.
7. Clic en **Create**.
8. Copiá el **Client ID**. Tiene esta forma:

   ```
   123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
   ```

   Este valor **no es un secreto**. Se puede exponer en el frontend. Lo que sí
   es secreto es el *Client Secret*, y **esta implementación no lo usa**
   justamente porque la verificación se hace del lado del servidor validando
   el token firmado por Google.

---

## 4. Variables de entorno

### 4.1 Frontend

El archivo **`edu-verse/.env.local` ya existe** en el repositorio con la
variable declarada y vacía. Solo hay que pegarle el Client ID real:

```bash
VITE_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

Contenido completo del archivo:

```bash
# URL del backend.
# OJO: config.js hoy tiene API_URL = '' hardcodeado y NO lee esta variable.
VITE_API_URL=http://localhost:4000

VITE_GOOGLE_CLIENT_ID=
```

También está la plantilla `edu-verse/.env.example`, que sirve de referencia si
alguien necesita reconstruir el archivo.

> **Por qué `.env.local` y no `.env`:** el proyecto ya tiene un `.env` que se
> versiona y contiene `VITE_API_URL`. Los secretos y los valores por máquina
> van en `.env.local`, que Vite y `.gitignore` tratan como local.

> Vite solo expone al bundle las variables que empiezan con `VITE_`. Por eso
> el prefijo es obligatorio. Sin él, `import.meta.env.VITE_GOOGLE_CLIENT_ID`
> sería `undefined`.

### 4.1.1 Nota sobre `VITE_API_URL`

El `.env` y el `.env.local` declaran `VITE_API_URL`, pero **`config.js` no la
lee**: tiene `export const API_URL = '';` hardcodeado. Es decir, la variable
está definida y no se usa. No es un problema introducido por Google Sign-In;
queda anotado acá para que nadie se confunda al debuggear de dónde sale la URL
del backend. Si querés que `API_URL` sea configurable, hay que cambiar
`src/config.js` para que lea `import.meta.env.VITE_API_URL` con fallback a `''`.

### 4.2 Backend

Creá `edu-verse_backend/.env`:

```bash
JWT_SECRET=<cadena aleatoria de 64 caracteres>
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

Trae una plantilla en `edu-verse_backend/.env.example`.

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **El `GOOGLE_CLIENT_ID` tiene que ser idéntico en los dos archivos.** Si
> difieren, el backend rechaza el token con `Invalid token` porque el campo
> `aud` del token no coincide con el cliente esperado.

---

## 5. Instalación de dependencias

### Backend

Se agregó `google-auth-library`:

```bash
cd edu-verse_backend
npm install google-auth-library
```

El `package.json` ya quedó actualizado con:

```json
"google-auth-library": "^10.5.0"
```

### Frontend

**Ninguna.** Google Identity Services se carga desde el CDN
(`https://accounts.google.com/gsi/client`) inyectando un `<script>` en tiempo de
ejecución. No se usa npm para esto, y es intencional: el SDK oficial de Google
para React (`@react-oauth/google`) está pensado para otro flujo y obligaría a
manejar el script aparte.

---

## 6. Flujo de autenticación

```
 Usuario                Frontend (Login/Signup)        Google GIS         Backend
   |                            |                        |                  |
   | clic "Continuar con Google"|                        |                  |
   |--------------------------->|                        |                  |
   |                            | abre popup             |                  |
   |<-------------------------------------------------|                  |
   |                            |                        |                  |
   | elige cuenta @alumnos.udg.mx                       |                  |
   |---------------------------->|                       |                  |
   |                            | recibe id_token        |                  |
   |                            |<-----------------------|                  |
   |                            |                        |                  |
   |                            | POST /auth/google {token}                  |
   |                            |--------------------------------------------->|
   |                            |                        |   verifyIdToken()
   |                            |                        |   - firma
   |                            |                        |   - audience
   |                            |                        |   - emisor
   |                            |                        |   - expiración
   |                            |                        |                  |
   |                            |                        |   ¿email termina
   |                            |                        |    en @alumnos.udg.mx?
   |                            |                        |   ¿está baneado?
   |                            |                        |   ¿existe el usuario?
   |                            |                        |      no -> INSERT
   |                            |                        |                  |
   |                            | {token JWT propio, usuario}                 |
   |                            |<---------------------------------------------|
   |                            |                        |                  |
   |                            | login() -> localStorage, navigate('/')     |
   |<---------------------------|                        |                  |
```

**Punto clave:** el frontend nunca decide si un correo es institucional. Solo
manda el token y muestra lo que el backend responda. Si la regla viviera en el
cliente, cualquiera podría mandarlo directo por `curl` y saltearse el filtro.

---

## 7. Implementación backend

Archivo: `edu-verse_backend/index.js`

### 7.1 Dependencia e inicialización

```js
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Se instancia una sola vez. Si falta el CLIENT_ID se deja en null y el
// endpoint responde 503 en vez de reventar al cargar el módulo.
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Único dominio admitido. Google no garantiza el dominio, así que el filtro
// real es "termina en"; y el prefijo evita que alguien use alu**no@evil.com.mx.
const DOMINIO_INSTITUCIONAL = '@alumnos.udg.mx';
```

### 7.2 El endpoint

```js
app.post('/auth/google', async (req, res) => {
    if (!googleClient) {
        return res.status(503).json("Google Sign-In no está configurado en el servidor.");
    }

    try {
        const { token } = req.body;
        if (!token) return res.status(400).json("Falta el token de Google.");

        // verifyIdToken comprueba firma, audience, emisor y expiración.
        // Si cualquiera falla, lanza. No se decodifica en ningún momento.
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = (payload.email || '').toLowerCase();

        if (!email) return res.status(401).json("Google no devolvió un correo válido.");
        if (payload.email_verified !== true) {
            return res.status(401).json("El correo de Google no está verificado.");
        }
        if (!email.endsWith(DOMINIO_INSTITUCIONAL)) {
            return res.status(403).json("Solo se admiten correos de @alumnos.udg.mx.");
        }

        const baneado = await pool.query("SELECT * FROM baneados WHERE email = $1", [email]);
        if (baneado.rows.length > 0) {
            return res.status(403).json("Tu cuenta ha sido suspendida. Contacta al administrador.");
        }

        let usuario = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);

        // Primer ingreso con Google: se crea la cuenta con el nombre y la
        // foto que entregó Google. password_hash queda nulo porque esta
        // cuenta solo entra por Google.
        if (usuario.rows.length === 0) {
            const nombre = (payload.name || email.split('@')[0]).slice(0, 100);
            const foto = (payload.picture || null);
            const creado = await pool.query(
                "INSERT INTO usuarios (nombre, email, foto_url) VALUES ($1, $2, $3) RETURNING *",
                [nombre, email, foto]
            );
            usuario = creado;
        } else if (payload.picture && usuario.rows[0].foto_url !== payload.picture) {
            // Si el usuario cambió la foto en Google, se refleja.
            const actualizado = await pool.query(
                "UPDATE usuarios SET foto_url = $1 WHERE usuario_id = $2 RETURNING *",
                [payload.picture, usuario.rows[0].usuario_id]
            );
            usuario = actualizado;
        }

        const u = usuario.rows[0];
        const tokenPropio = jwt.sign(
            { id: u.usuario_id, nombre: u.nombre, rol: u.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            mensaje: "Autenticación con Google exitosa.",
            token: tokenPropio,
            usuario: { id: u.usuario_id, nombre: u.nombre, email: u.email, foto_url: u.foto_url, rol: u.rol }
        });
    } catch (err) {
        // ...
    }
});
```

### 7.3 Contrato de la API

**Request**

```http
POST /auth/google
Content-Type: application/json

{ "token": "eyJhbGciOiJSUzI1NiIs..." }
```

**Responses**

| Código | Cuándo | Cuerpo |
|---|---|---|
| `200` | Éxito | `{ mensaje, token, usuario }` |
| `400` | Falta el token | `"Falta el token de Google."` |
| `401` | Token inválido / expirado / email sin verificar | `"Credenciales de Google inválidas."` |
| `403` | Correo no institucional, o usuario baneado | `"Solo se admiten correos de @alumnos.udg.mx."` |
| `503` | `GOOGLE_CLIENT_ID` no configurado en el servidor | `"Google Sign-In no está configurado..."` |

---

## 8. Implementación frontend

### 8.1 Componente reutilizable

Archivo: `edu-verse/src/components/BotonGoogle.jsx`

Se hizo un componente aparte y no lógica duplicada en `Login.jsx` y
`Signup.jsx`, porque el flujo de GIS tiene estado propio (carga del script,
espera de disponibilidad, callback) y dos copias se desincronizan solas.

**Carga del script**

```js
let promesaScript = null;

const cargarScript = () => {
  // Si dos formularios se montan en el mismo tick, se comparte la misma
  // promesa en vez de inyectar dos <script>.
  if (promesaScript) return promesaScript;

  promesaScript = new Promise((resolve, reject) => {
    if (document.getElementById(ID_GOOGLE)) {
      if (window.google?.accounts?.id) {
        resolve();
      } else {
        window.addEventListener('load', () => resolve());
      }
      return;
    }

    const script = document.createElement('script');
    script.id = ID_GOOGLE;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });

  return promesaScript;
};
```

**Inicialización y render del botón**

```js
useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let vigente = true;

    cargarScript()
      .then(() => {
        if (!vigente || !window.google?.accounts?.id) return;
        const cliente = window.google.accounts.id;

        // initialize solo puede llamarse una vez por gapiClientId: repetirlo
        // con el mismo id lanza InvalidClientId, así que se marca el DOM.
        if (!document.getElementById(ID_CLIENTE)) {
          cliente.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse,
            ux_mode: 'popup',
            context: 'signin',
            auto_select: false,
          });
          const marca = document.createElement('div');
          marca.id = ID_CLIENTE;
          marca.style.display = 'none';
          document.body.appendChild(marca);
        }

        if (contenedorRef.current && contenedorRef.current.childElementCount === 0) {
          const ancho = contenedorRef.current.offsetWidth || 320;
          cliente.renderButton(contenedorRef.current, {
            theme: 'outline',
            size: 'large',
            width: Math.min(360, ancho),
            text: 'continue_with',
            shape: 'rectangular',
            locale: 'es',
          });
        }

        setListo(true);
      })
      .catch(() => {
        if (vigente) setListo(false);
      });

    return () => {
      vigente = false;
    };
  }, [handleCredentialResponse]);

  if (!CLIENT_ID) {
    if (!ES_DEV) return null;
    return (
      <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
        Google Sign-In sin configurar.
        <br />
        <span className="text-xs">
          Definí <code className="font-bold">VITE_GOOGLE_CLIENT_ID</code> en{' '}
          <code className="font-bold">.env.local</code> y reiniciá Vite.
        </span>
      </p>
    );
  }
```

**Exports**

```js
// Lo consumen Login y Signup para no dibujar el separador "o entra con"
// cuando no hay botón debajo. Sin esto queda un título colgado.
export const GOOGLE_CONFIGURADO = CLIENT_ID !== '';

// Si el bloque entero (separador incluido) se dibuja. En desarrollo siempre,
// para que el aviso de "falta configurarlo" sea alcanzable: si se gateara
// solo por GOOGLE_CONFIGURADO, el componente no se montaría y el aviso
// quedaría dentro de un componente que nunca se renderiza.
export const GOOGLE_VISIBLE = GOOGLE_CONFIGURADO || ES_DEV;
export { CLIENT_ID as GOOGLE_CLIENT_ID };
```

**Envío del token**

```js
const handleCredentialResponse = useCallback(async (respuesta) => {
    if (!respuesta?.credential) return;
    setCargando(true);

    try {
      const res = await axios.post(`${API_URL}/auth/google`, { token: respuesta.credential });
      toast.success(res.data.mensaje || 'Sesión iniciada con Google');
      onExitoRef.current?.(res.data);
    } catch (err) {
      const mensaje = err.response?.data;
      toast.error(typeof mensaje === 'string' ? mensaje : 'No se pudo iniciar sesión con Google');
      setCargando(false);
    }
  }, []);
```

**El botón de Google se dibuja dentro de un `<div>` vacío**, no se escribe en
JSX. Google exige que el botón oficial se renderice con `renderButton()`; hacer
un `<button>` propio con el logo de Google viola los términos de servicio y
Google puede bloquear el Client ID.

### 8.2 Integración en Login

Archivo: `edu-verse/src/pages/Login.jsx`

```jsx
import BotonGoogle, { GOOGLE_VISIBLE } from '../components/BotonGoogle';

// Google devuelve el mismo payload que /auth/login, así que se reutiliza
// la redirección por rol en vez de duplicar el setTimeout.
const entrarConGoogle = (data) => {
  login(data);
  toast.success(`¡Bienvenido de nuevo, ${data.usuario.nombre}!`, { /* cohete */ });
  setTimeout(() => navigate(data.usuario.rol === 'admin' ? '/admin' : '/'), 1000);
};
```

En el JSX, después del `<form>`:

```jsx
{GOOGLE_VISIBLE && (
  <div className="mt-6 ev-enter ev-d-5">
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
        o entra con
      </span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
    <div className="mt-4">
      <BotonGoogle onExito={entrarConGoogle} />
    </div>
    <p className="mt-3 text-center text-xs font-medium text-gray-400">
      Solo para correos @alumnos.udg.mx
    </p>
  </div>
)}
```

### 8.3 Integración en Signup

Archivo: `edu-verse/src/pages/Signup.jsx`

```jsx
{GOOGLE_VISIBLE && (
  <div className="mt-6 ev-enter ev-d-6">
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
        o regístrate con
      </span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
    <div className="mt-4">
      <BotonGoogle
        onExito={(data) => {
          toast.success(`¡Cuenta creada! Bienvenido, ${data.usuario.nombre}`);
          setTimeout(() => navigate('/'), 1200);
        }}
      />
    </div>
    <p className="mt-3 text-center text-xs font-medium text-gray-400">
      Tu cuenta se crea sola con tu correo @alumnos.udg.mx
    </p>
  </div>
)}
```

No hay formulario de registro en este flujo: el backend crea la cuenta en el
primer ingreso. La diferencia con Login está solo en el texto y en a dónde
navega después.

---

## 9. Decisiones de diseño

**La verificación va en el backend, nunca en el frontend.** El `id_token` está
firmado por Google, pero eso no sirve de nada si lo decodifica el navegador. Si
el filtro `@alumnos.udg.mx` estuviera en el cliente, cualquiera podría llamar a
`/auth/google` por `curl` con un token de `ejemplo@gmail.com` y se saltaría el
control.

**No se usa el Client Secret.** Con Google Identity Services, el backend valida
el token firmado usando solo el Client ID público. El Client Secret se usaría
si el backend pidiera tokens contra Google (flujo OAuth de código), que no es el
caso acá.

**El componente retorna `null` en producción si falta `VITE_GOOGLE_CLIENT_ID`.**
Es preferible no ofrecer la opción a mostrar un botón que falla al hacer clic.
Un placeholder en pantalla para el usuario final no le explica nada.

**En desarrollo, en cambio, muestra un aviso.** Si la variable está vacía, el
componente renderiza un recuadro ámbar que dice exactamente qué definir y
dónde, en vez de desaparecer en silencio. Un developers que abre `/login` y no
ve el botón tiene una duda real; darle la respuesta en pantalla es más útil que
un `return null` que no explica nada.

**El bloque completo (separador + botón + nota) se gatea con `GOOGLE_VISIBLE`,
no con `GOOGLE_CONFIGURADO`.** Hay dos exportaciones distintas y la diferencia
importa:

| Export | Significado | Quién lo usa |
|---|---|---|
| `GOOGLE_CONFIGURADO` | Hay un Client ID válido para renderizar el botón oficial | Lógica interna del componente |
| `GOOGLE_VISIBLE` | El bloque entero se dibuja: hay Client ID **o** estamos en desarrollo | Login y Signup |

Gatear con `GOOGLE_CONFIGURADO` fue un bug real. Cuando la variable está vacía
el componente no se montaba, y el aviso de "falta configurarlo" quedaba dentro
de un componente que nunca se renderizaba: código muerto. El síntoma era que no
aparecía ni el botón ni la explicación, que es justo lo que confunde a quien
intenta configurarlo. Con `GOOGLE_VISIBLE` el bloque se dibuja siempre en
desarrollo, así que el aviso es alcanzable.

**No se inventó un Client ID de ejemplo.** La variable queda vacía a propósito.
Poner un placeholder haría que el botón se dibuje pero Google lo rechace con
`invalid_client` al hacer clic, que es un error más difícil de diagnosticar que
un botón que claramente no está.

**Los dos métodos conviven en vez de reemplazar.** El formulario manual sigue
funcionando exactamente igual. Quitarlo sería una regresión para quien ya tiene
contraseña.

**`password_hash` queda en `NULL` para cuentas de Google.** El `INSERT` no
incluye ese campo. Un usuario de Google que intente hacer login manual con
contraseña va a fallar en `bcrypt.compare` porque el hash no existe, y eso es
lo correcto: esa cuenta no tiene contraseña.

**La foto se sincroniza desde Google.** Si el usuario cambia su foto en Google,
se refleja en la app. Es un detalle chico pero evita que la foto quede vieja.

**El filtro es `endsWith`, no `includes`.** Con `includes` alguien podría usar
`cuenta@alumnos.udg.mx.evil.com` y pasar el filtro.

---

## 10. Manejo de errores

| Situación | Qué ve el usuario |
|---|---|
| Cuenta de Google no institucional | Toast: "Solo se admiten correos de @alumnos.udg.mx." |
| Cuenta baneada en la tabla `baneados` | Toast: "Tu cuenta ha sido suspendida..." |
| Popup cerrado sin elegir cuenta | Nada. No se dispara el callback, es el comportamiento esperado |
| Token expirado (más de 1 h de antigüedad) | Toast: "El token de Google expiró. Intentá de nuevo." |
| Sin internet al cargar GIS | Texto: "Cargando opción de Google…" quedaLoader, hay que recargar |
| `GOOGLE_CLIENT_ID` sin definir en backend | Toast: "Google Sign-In no está configurado en el servidor." |
| `VITE_GOOGLE_CLIENT_ID` vacía, **en desarrollo** | Recuadro ámbar: "Google Sign-In sin configurar. Definí VITE_GOOGLE_CLIENT_ID en .env.local y reiniciá Vite." |
| `VITE_GOOGLE_CLIENT_ID` vacía, **en producción** | Nada. El bloque completo no se renderiza |

Todos los errores pasan por `react-hot-toast`, igual que el resto de la app.

---

## 11. Pruebas manuales

### Caso 1: Cuenta institucional nueva

1. Levantar backend y frontend.
2. Ir a `/signup`.
3. Verificar que aparece el botón "Continuar con Google".
4. Iniciar sesión con un `@alumnos.udg.mx` que no exista en la base.
5. **Esperado:** se crea la cuenta, se ve el toast de bienvenida, redirige a
   `/`. Al revisar la base, el usuario existe con `password_hash` en `NULL` y
   `foto_url` con la foto de Google.

### Caso 2: Cuenta institucional ya existente

1. Repetir con un `@alumnos.udg.mx` que ya tenga cuenta creada por el
   formulario manual.
2. **Esperado:** inicia sesión, no da error de duplicado, conserva el `rol`
   original (admin sigue siendo admin).

### Caso 3: Cuenta no institucional

1. Iniciar sesión con un `gmail.com`.
2. **Esperado:** toast "Solo se admiten correos de @alumnos.udg.mx." y no se
   crea nada en la base.

### Caso 4: Cuenta institutional baneada

1. Insertar el correo en la tabla `baneados`.
2. Intentar entrar con Google.
3. **Esperado:** toast de suspensión. La comprobación del baneo está antes de
   la creación de cuenta.

### Caso 5: El formulario manual sigue funcionando

1. Completar email y contraseña en `/login`.
2. **Esperado:** entra igual que antes del cambio.

### Caso 6: Google sin configurar

1. Vaciar `VITE_GOOGLE_CLIENT_ID` en `.env.local` y reiniciar Vite.
2. Ir a `/login`.
3. **Esperado (desarrollo):** aparece el recuadro ámbar que dice que falta
   definir la variable. No aparece el separador "o entra con".
4. **Esperado (producción, `npm run build` + `npm run preview`):** no aparece
   nada, ni el recuadro ni el separador. El bloque se oculta completo.

---

## 12. Troubleshooting

**El botón no aparece**

Lo primero: en **desarrollo** tiene que aparecer un recuadro ámbar diciendo
"Google Sign-In sin configurar". Si no aparece ni eso, el problema no es el
Client ID sino que el módulo no está importando bien o hay un error de
sintaxis. Revisá la consola del navegador.

Si el recuadro ámbar aparece, el Client ID está vacío. Causas, en orden de
probabilidad:

- La línea sigue vacía: `VITE_GOOGLE_CLIENT_ID=` en `.env.local` sin valor.
- Falta el prefijo `VITE_`. Vite solo expone al bundle las variables que
  empiezan así; sin el prefijo, `import.meta.env.VITE_GOOGLE_CLIENT_ID` sería
  `undefined`.
- No reiniciaste el dev server. Vite lee los `.env` **solo al arrancar**; si
  tocaste el archivo con el server corriendo, el cambio no toma efecto.
- Hay espacios alrededor del valor. El componente hace `.trim()`, pero un
  salto de línea pegado al `=` puede confundir; dejalo pegado.

Verificación directa desde la consola del navegador:

```js
// Chrome DevTools, en la pestaña Console
import.meta.env.VITE_GOOGLE_CLIENT_ID
```

Si devuelve `undefined`, el problema es el nombre de la variable, el prefijo o
que Vite no arrancó después del cambio.

**`Invalid token` o `Token used too late`**

- El `GOOGLE_CLIENT_ID` del backend tiene que ser **idéntico** al del frontend.
  Es el error más común al copy-pear.
- Verificá que el Client ID sea de tipo **Web application**. Si es de tipo
  "Desktop app" o "iOS app", la verificación falla.
- Verificá que `http://localhost:5173` esté exacto en **Authorized JavaScript
  origins**, sin barra final.

**`origin_mismatch` en el popup**

- El dominio del que venís no está en la lista de orígenes autorizados.
- agregalo en Google Cloud Console → Clients → tu cliente Web.
- También puede pasar si abrís la app por `127.0.0.1:5173` en vez de
  `localhost:5173`. Son orígenes distintos para Google. Agregá ambos.

**`403: access_denied` o pantalla de consentimiento sin botón**

- La app está en modo **Testing** y superaste los 100 usuarios, o el correo
  con el que probás no está en la lista de test users.
- Agregá el correo en Google Cloud Console → OAuth consent screen → Test users.
- O publicá la app con el botón **"Publish app"**.

**El popup se abre y se cierra solo**

- Bloqueadores de privacidad (uBlock, Privacy Badger) interceptan
  `accounts.google.com`.
- Probá en ventana incógnito sin extensiones.

**CORS en la consola**

- El endpoint `/auth/google` está en el backend. Verificá que el frontend esté
  apuntando al puerto correcto.
- Revisá la configuración de CORS del backend en `index.js`.

**`npm install google-auth-library` falla**

- Verificá estar parado en `edu-verse_backend/`, no en la raíz del repo. El
  backend y el frontend son paquetes npm separados.

---

## 13. Deshacer el cambio

> **Ya se ejecutó** el 6 de octubre de 2026. Se conserva como referencia del
> camino inverso por si el plan se retoma y vuelve a hacer falta revertir.

Si hay que revertirlo:

1. **Backend:** borrar el bloque `app.post('/auth/google', ...)` y los
   `require` de `google-auth-library` y `OAuth2Client`.
2. **Frontend:** borrar `edu-verse/src/components/BotonGoogle.jsx` y los
   `<BotonGoogle ... />` de `Login.jsx` y `Signup.jsx`, más sus imports.
3. **CSS:** quitar `.ev-gis-boton` de `index.css`.
4. **Dependencias:** `npm uninstall google-auth-library` en el backend.

Los usuarios creados por Google quedan en la base. Hay que borrarlos a mano
si no deben existir:

```sql
DELETE FROM usuarios WHERE password_hash IS NULL;
```

---

## Referencias

- Google Identity Services: <https://developers.google.com/identity/gsi/web>
- Verificar tokens en el backend:
  <https://developers.google.com/identity/gsi/web/guides/verify-google-id-token>
- OAuth consent screen: <https://console.cloud.google.com/auth/branding>
- Crear clientes OAuth: <https://console.cloud.google.com/auth/clients>
- `google-auth-library` en npm:
  <https://www.npmjs.com/package/google-auth-library>
