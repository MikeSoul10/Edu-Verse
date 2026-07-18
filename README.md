# EduVerse

Plataforma web para el intercambio de apuntes académicos entre estudiantes universarios. Los usuarios pueden registrarse con correos institucionales `.edu`, subir apuntes, explorar los de otros estudiantes, guardar favoritos, comentar y valorar contenido.

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

- **Registro/Login** solo con correos `.edu`
- **Autenticación JWT** con expiración de 24h
- **Subida de apuntes** con archivos adjuntos
- **Búsqueda** de apuntes por título, materia o descripción
- **Detalle de apunte** con información del autor
- **Mis apuntes** — gestión de los propios
- **Favoritos** — guardar y administrar apuntes guardados
- **Comentarios** y **valoraciones con estrellas** (sistema de comunidad)
- **Perfil de usuario** con foto de perfil y edición de datos
- **Rutas protegidas** — solo usuarios autenticados acceden a ciertas secciones

---

## Prerrequisitos

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) y Docker Compose (opcional, para el setup con contenedores)

---

## Setup con Docker (Producción)

1. Clonar el repositorio:

```bash
git clone <url-del-repositorio>
cd proyecto
```

2. Crear un archivo `.env` en la raíz con la variable de entorno para JWT:

```env
JWT_SECRET=tu_clave_secreta_aqui
```

3. Levantar todos los servicios:

```bash
docker compose up --build
```

Esto arrancará:

| Servicio  | Puerto | Descripción                     |
| --------- | ------ | ------------------------------- |
| postgres  | 5432   | Base de datos PostgreSQL        |
| backend   | 4000   | API REST con Express            |
| frontend  | 80     | Frontend servido con Nginx      |

4. Abrir en el navegador: `http://localhost`

> La base de datos se inicializa automáticamente con el archivo `backup.sql` incluido en el repositorio.

---

## Setup Manual (Desarrollo Local)

### 1. Base de datos

Necesitas una instancia de PostgreSQL corriendo. Puedes usar Docker solo para la DB:

```bash
docker run -d --name eduverse-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=tu_password -e POSTGRES_DB=Edu-verseDB -p 5432:5432 postgres:16-alpine
```

O usar tu propia instalación de PostgreSQL y crear la base de datos `Edu-verseDB`.

Opcionalmente importa el esquema inicial:

```bash
psql -U postgres -d Edu-verseDB -f backup.sql
```

### 2. Backend

```bash
cd edu-verse_backend
npm install
```

Crear archivo `.env`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Edu-verseDB
DB_PASSWORD=tu_password
DB_PORT=5432
PORT=4000
JWT_SECRET=tu_clave_secreta_aqui
```

Ejecutar:

```bash
node index.js
```

El servidor arranca en `http://localhost:4000`.

### 3. Frontend

```bash
cd edu-verse
npm install
npm run dev
```

El frontend arranca en `http://localhost:5173`.

---

## Variables de Entorno

### Backend (`edu-verse_backend/.env`)

| Variable      | Descripción                        | Ejemplo                    |
| ------------- | ---------------------------------- | -------------------------- |
| DB_USER       | Usuario de PostgreSQL               | `postgres`                 |
| DB_HOST       | Host de la base de datos            | `localhost`                |
| DB_NAME       | Nombre de la base de datos          | `Edu-verseDB`             |
| DB_PASSWORD   | Contraseña de PostgreSQL            | `tu_password`              |
| DB_PORT       | Puerto de PostgreSQL                | `5432`                     |
| PORT          | Puerto del servidor Express         | `4000`                     |
| JWT_SECRET    | Secreto para firmar tokens JWT      | `tu_clave_secreta_aqui`   |

### Frontend (`edu-verse/.env`)

| Variable      | Descripción                                  | Ejemplo                      |
| ------------- | -------------------------------------------- | ---------------------------- |
| VITE_API_URL  | URL base del backend para las peticiones API | `http://localhost:4000`      |

---

## Estructura del Proyecto

```
proyecto/
├── docker-compose.yml          # Orquestación de servicios
├── backup.sql                  # Dump de la base de datos inicial
│
├── edu-verse_backend/          # Backend — Node.js + Express
│   ├── index.js                # Punto de entrada, rutas y lógica principal
│   ├── db.js                   # Conexión al pool de PostgreSQL
│   ├── Dockerfile
│   ├── .env                    # Variables de entorno (no incluido en git)
│   ├── uploads/                # Archivos subidos por usuarios
│   └── package.json
│
└── edu-verse/                  # Frontend — React + Vite
    ├── src/
    │   ├── main.jsx            # Entry point de React
    │   ├── App.jsx             # Router principal y rutas
    │   ├── config.js           # URL base de la API
    │   ├── components/
    │   │   └── Navbar.jsx      # Barra de navegación
    │   └── pages/
    │       ├── Home.jsx        # Página principal
    │       ├── Login.jsx       # Inicio de sesión
    │       ├── Signup.jsx      # Registro
    │       ├── Apuntes.jsx     # Explorar apuntes
    │       ├── DetalleApunte.jsx # Detalle de un apunte
    │       ├── Upload.jsx      # Subir apunte
    │       ├── MyNotes.jsx     # Mis apuntes
    │       ├── Favorites.jsx   # Apuntes favoritos
    │       ├── Profile.jsx     # Perfil de usuario
    │       ├── ProtectedRoute.jsx # Ruta protegida (auth)
    │       └── NotFound.jsx    # Página 404
    ├── Dockerfile
    ├── nginx.conf              # Configuración Nginx para producción
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
| GET    | `/auth/perfil/:id`  | Obtener perfil        | No   |
| PUT    | `/auth/perfil/update/:id` | Actualizar perfil | No   |

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
node index.js    # Iniciar servidor
```

---

## Licencia

ISC
