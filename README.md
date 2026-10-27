# EduVerse

Plataforma web para el intercambio de apuntes académicos entre estudiantes universitarios. Los usuarios pueden registrarse con correos institucionales `@alumnos.udg.mx`, subir apuntes, explorar los de otros estudiantes, guardar favoritos, comentar y valorar contenido.

---

## Stack Tecnológico

| Capa       | Tecnologías                                      |
| ---------- | ------------------------------------------------ |
| Frontend   | React 19, Vite 8, Tailwind CSS 4, React Router  |
| Backend    | Node.js, Express 5, JWT, bcrypt, Multer          |
| Base de datos | PostgreSQL 16                                  |
| Infra      | Docker, Docker Compose, Nginx (reverse proxy)    |

---

## Características

- **Registro/Login** solo con correos `@alumnos.udg.mx`
- **Autenticación JWT** con expiración de 24h
- **Subida de apuntes** con archivos adjuntos
- **Búsqueda** de apuntes por título, materia o descripción
- **Detalle de apunte** con información del autor
- **Mis apuntes** — gestión de los propios
- **Favoritos** — guardar y administrar apuntes guardados
- **Comentarios** y **valoraciones con estrellas** (sistema de comunidad)
- **Perfil de usuario** con foto de perfil y edición de datos
- **Rutas protegidas** — solo usuarios autenticados acceden a ciertas secciones
- **Administración** — la ruta `/admin` requiere sesión y rol `admin`; el backend también valida los permisos

La exploración de materiales se concentra en `/biblioteca`. La ruta antigua
`/apuntes` se conserva como redirección a la biblioteca.

---

## Prerrequisitos

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) y Docker Compose (opcional, para el setup con contenedores)

---

## Setup con Docker

1. Clonar el repositorio y entrar a la carpeta:

```bash
git clone <url-del-repositorio>
cd proyecto
```

2. Crear el archivo `.env` de la raíz a partir de la plantilla:

```bash
cp .env.example .env
```

Completa al menos `JWT_SECRET` (obligatorio). Puedes generarlo con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

3. Levantar los servicios.

**Producción** (Nginx sirve el build, backend con `node`, PostgreSQL sin puerto público):

```bash
docker compose up -d --build
```

| Servicio | URL / puerto | Descripción |
| -------- | ------------ | ----------- |
| frontend | http://localhost:8080 | Nginx: SPA + proxy de API, uploads y Socket.IO |
| backend  | http://localhost:4001 (solo localhost) | API REST para depuración |
| postgres | red interna de Docker | No se publica en el host |

**Desarrollo** (hot-reload con Vite + nodemon):

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Servicio | Puerto | Descripción |
| -------- | ------ | ----------- |
| frontend | 5173 | Vite dev server (HMR) |
| backend  | 4000 | Express con nodemon |
| postgres | 5432 (solo localhost) | PostgreSQL |

La base de datos se inicializa automáticamente con
`documentacion/backup_BASE_DE_DATOS.sql` la primera vez que se crea el volumen.
Ese dump ya incluye `mensajes_chat.respuesta_a`, `moderacion_logs.accion/detalle`
y `password_hash` nullable, así que no hay que ejecutar migraciones manuales
para una instalación limpia.

> **Nota**: Si necesitas reinstalar dependencias o recrear la base, ejecuta
> `docker compose down -v` (o `docker compose -f docker-compose.dev.yml down -v`)
> y vuelve a levantar.

---

## Setup Manual (Desarrollo Local)

### 1. Base de datos

Necesitas una instancia de PostgreSQL corriendo. Puedes usar Docker solo para la DB:

```bash
docker run -d --name eduverse-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=tu_password -e POSTGRES_DB=Edu-verseDB -p 5432:5432 postgres:16-alpine
```

O usar tu propia instalación de PostgreSQL y crear la base de datos `Edu-verseDB`.

Importa el esquema inicial:

```bash
psql -U postgres -d Edu-verseDB -f documentacion/backup_BASE_DE_DATOS.sql
```

### 2. Backend

```bash
cd edu-verse_backend
npm install
cp .env.example .env
```

Editar `.env` y completar `DB_PASSWORD` y `JWT_SECRET`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Edu-verseDB
DB_PASSWORD=tu_password
DB_PORT=5432
PORT=4000
JWT_SECRET=tu_clave_secreta_aqui
```

> El backend no arranca sin `JWT_SECRET`: el login firma y el middleware
> verifica con el mismo valor, sin fallbacks hardcodeados.

Ejecutar:

```bash
node index.js
```

El servidor arranca en `http://localhost:4000`.

### 3. Frontend

```bash
cd edu-verse
npm install
cp .env.example .env
npm run dev
```

El frontend arranca en `http://localhost:5173`. Con `VITE_API_URL` vacío usa
rutas relativas y el proxy de Vite (`vite.config.js`) hacia `backend:4000`.

---

## Variables de Entorno

### Raíz (`.env`, usado por Docker Compose)

| Variable      | Descripción | Ejemplo |
| ------------- | ----------- | ------- |
| DB_PASSWORD   | Contraseña de PostgreSQL (obligatoria) | `una_clave_larga` |
| DB_NAME       | Nombre de la base de datos | `Edu-verseDB` |
| JWT_SECRET    | Secreto para firmar tokens JWT (obligatorio) | `cadena_aleatoria_de_96_hex` |
| BACKEND_PORT  | Puerto local del backend en producción | `4001` |
| FRONTEND_PORT | Puerto público del frontend en producción | `8080` |
| VITE_API_URL  | URL de API compilada en el frontend; vacío = mismo origen | `` |

### Backend (`edu-verse_backend/.env`)

| Variable      | Descripción                        | Ejemplo                    |
| ------------- | ---------------------------------- | -------------------------- |
| DB_USER       | Usuario de PostgreSQL               | `postgres`                 |
| DB_HOST       | Host de la base de datos            | `localhost`                |
| DB_NAME       | Nombre de la base de datos          | `Edu-verseDB`             |
| DB_PASSWORD   | Contraseña de PostgreSQL            | `tu_password`              |
| DB_PORT       | Puerto de PostgreSQL                | `5432`                     |
| PORT          | Puerto del servidor Express         | `4000`                     |
| JWT_SECRET    | Secreto para firmar tokens JWT (obligatorio) | `cadena_aleatoria` |

### Frontend (`edu-verse/.env`)

| Variable      | Descripción                                  | Ejemplo                      |
| ------------- | -------------------------------------------- | ---------------------------- |
| VITE_API_URL  | URL base del backend para las peticiones API | vacío (mismo origen/proxy)   |

---

## Estructura del Proyecto

```
proyecto/
├── docker-compose.yml          # Producción (Nginx + Node + PostgreSQL)
├── docker-compose.dev.yml      # Desarrollo con hot-reload
├── .env.example                # Plantilla de variables para Compose
├── documentacion/
│   └── backup_BASE_DE_DATOS.sql # Esquema + seed inicial
│
├── edu-verse_backend/          # Backend — Node.js + Express
│   ├── index.js                # Punto de entrada, rutas y lógica principal
│   ├── config.js               # Configuración fail-fast (JWT_SECRET)
│   ├── db.js                   # Conexión al pool de PostgreSQL
│   ├── Dockerfile              # Targets development / production
│   ├── .env.example            # Plantilla de variables del backend
│   ├── uploads/                # Archivos subidos por usuarios
│   └── package.json
│
└── edu-verse/                  # Frontend — React + Vite
    ├── src/
    │   ├── main.jsx            # Entry point de React
    │   ├── App.jsx             # Router principal y rutas
    │   ├── config.js           # Cliente Axios, URL base e interceptores de sesión
    │   ├── components/
    │   │   ├── Navbar.jsx      # Barra de navegación
    │   │   ├── ApunteCard.jsx  # Tarjeta reutilizable de la biblioteca
    │   │   └── TaskCard.jsx    # Tarjeta de tarea del tablero de equipos
    │   ├── services/
    │   │   └── api.js          # Métodos de acceso a la API sobre el cliente compartido
    │   ├── context/
    │   │   └── AuthContext.jsx # Estado de autenticación compartido
    │   └── pages/
    │       ├── Home.jsx        # Página principal
    │       ├── Login.jsx       # Inicio de sesión
    │       ├── Signup.jsx      # Registro
    │       ├── Biblioteca.jsx  # Explorar, buscar y filtrar apuntes
    │       ├── DetalleApunte.jsx # Detalle de un apunte
    │       ├── Upload.jsx      # Subir apunte
    │       ├── MyNotes.jsx     # Mis apuntes
    │       ├── Favorites.jsx   # Apuntes favoritos
    │       ├── Profile.jsx     # Perfil de usuario
    │       ├── ProtectedRoute.jsx # Protección por sesión y rol
    │       └── NotFound.jsx    # Página 404
    ├── Dockerfile              # Targets development / build / production
    ├── nginx.conf              # SPA + proxy de API, uploads y Socket.IO
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Endpoints de la API

### Autenticación

| Método | Ruta                | Descripción           | Auth |
| ------ | ------------------- | --------------------- | ---- |
| POST   | `/auth/signup`      | Registrar usuario     | No   |
| POST   | `/auth/login`       | Iniciar sesión        | No   |
| GET    | `/auth/perfil/:id`  | Obtener perfil        | Sí   |
| PUT    | `/auth/perfil/update/:id` | Actualizar perfil | Sí   |

### Apuntes

| Método | Ruta                        | Descripción                  | Auth |
| ------ | --------------------------- | ---------------------------- | ---- |
| POST   | `/apuntes/upload`           | Subir apunte (con archivo)   | Sí   |
| GET    | `/apuntes`                  | Listar todos los apuntes     | No   |
| GET    | `/apuntes/buscar?q=`        | Buscar apuntes               | No   |
| GET    | `/apuntes/:id`              | Detalle de un apunte         | No   |
| GET    | `/apuntes/mis-apuntes/:id`  | Apuntes de un usuario        | No   |
| DELETE | `/apuntes/:id`              | Eliminar apunte              | No   |

### Comunidad

| Método | Ruta                    | Descripción                     | Auth |
| ------ | ----------------------- | ------------------------------- | ---- |
| GET    | `/apuntes/detalle/:id`  | Detalle con rating promedio     | No   |
| GET    | `/comentarios/:id`      | Comentarios de un apunte        | No   |
| POST   | `/comentarios`          | Crear comentario                | No   |
| POST   | `/valoraciones`         | Crear/actualizar valoración     | No   |

### Favoritos

| Método | Ruta                   | Descripción               | Auth |
| ------ | ---------------------- | ------------------------- | ---- |
| POST   | `/favoritos`           | Agregar a favoritos        | No   |
| GET    | `/favoritos/:id`       | Listar favoritos           | No   |
| DELETE | `/favoritos`           | Eliminar de favoritos      | Sí   |

### Perfil

| Método | Ruta                  | Descripción                | Auth |
| ------ | --------------------- | -------------------------- | ---- |
| PUT    | `/usuarios/foto/:id`  | Actualizar foto de perfil  | No   |

---

## Scripts Disponibles

### Frontend (`edu-verse/`)

```bash
npm run dev      # Servidor de desarrollo (Vite)
npm run build    # Build de producción
npm run lint     # Verificar código con ESLint
npm run preview  # Vista previa del build de producción
```

### Backend (`edu-verse_backend/`)

```bash
node index.js      # Iniciar servidor (producción)
npx nodemon index.js  # Iniciar con hot-reload (desarrollo)
```

---

## Licencia

ISC
