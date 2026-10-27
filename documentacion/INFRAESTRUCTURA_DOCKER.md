# Infraestructura — Docker & Nginx

Orquestación de 3 servicios con **Docker Compose**. Hay dos configuraciones:

| Archivo | Uso | Frontend | Backend | PostgreSQL |
|---|---|---|---|---|
| `docker-compose.yml` | Producción | Nginx :8080 | `node index.js`, solo localhost :4001 | Sin puerto público |
| `docker-compose.dev.yml` | Desarrollo | Vite :5173 (HMR) | `nodemon`, localhost :4000 | localhost :5432 |

---

## 1. `docker-compose.yml` — producción

### Servicio `postgres`
1. Imagen `postgres:16-alpine`, `restart: unless-stopped`.
2. Variables desde el `.env` raíz: `POSTGRES_PASSWORD`, `POSTGRES_DB`.
3. **No publica `5432`**: solo es accesible desde la red interna de Docker.
4. Volúmenes:
   - `pgdata:/var/lib/postgresql/data` → datos persistentes.
   - `./documentacion/backup_BASE_DE_DATOS.sql:/docker-entrypoint-initdb.d/init.sql:ro`
     → esquema inicial en el primer arranque (volumen vacío).
5. Healthcheck con `pg_isready`; el backend espera a que pase.

### Servicio `backend`
1. `build.target: production` (sin `nodemon`, con `npm ci --omit=dev`).
2. `PORT=4000` dentro de la red; se publica solo en `127.0.0.1:${BACKEND_PORT:-4001}` para depuración.
3. Variables: `DB_*`, `PORT`, `JWT_SECRET` (obligatorio, sin fallback) y `NODE_ENV=production`.
4. Volumen `uploads:/app/uploads` para que los archivos sobrevivan a los despliegues.
5. `depends_on: postgres: condition: service_healthy`.
6. Healthcheck HTTP con `fetch`; el frontend espera a que el backend esté sano.

### Servicio `frontend`
1. `build.target: production`: build estático de Vite + Nginx.
2. Publica `${FRONTEND_PORT:-8080}:80`.
3. `VITE_API_URL` vacío por defecto: el navegador usa el mismo origen y Nginx proxya.
4. `depends_on: backend: condition: service_healthy`.

### Volúmenes nombrados
```yaml
volumes:
  pgdata:   # datos de PostgreSQL
  uploads:  # archivos de apuntes y fotos
```

---

## 2. `docker-compose.dev.yml` — desarrollo

1. Backend `build.target: development`, monta `./edu-verse_backend:/app` y ejecuta
   `nodemon --legacy-watch index.js`.
2. Frontend `build.target: development`, monta `src`, `public`, `index.html`,
   `vite.config.js`, `tailwind.config.js` y `postcss.config.js`; ejecuta
   `npm run dev -- --host 0.0.0.0`.
3. PostgreSQL publica `127.0.0.1:5432` (solo localhost) para poder conectarse con
   un cliente de base de datos.

```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## 3. `Dockerfile` del backend

### Target `development`
1. `FROM node:20-alpine`.
2. `npm install` (incluye devDependencies como nodemon).
3. Copia el código y crea `uploads/perfiles`.
4. `CMD ["npx", "nodemon", "--legacy-watch", "index.js"]`.

### Target `production` (por defecto, es la última etapa)
1. `npm ci --omit=dev`.
2. Copia el código y crea `uploads/perfiles`.
3. `chown -R node:node /app` y `USER node`.
4. `CMD ["node", "index.js"]`.

## 4. `Dockerfile` del frontend

| Target | Contenido |
|---|---|
| `development` | `node:20-alpine` + Vite dev server en `5173` |
| `build` | `npm ci` + `npm run build` con `VITE_API_URL` como build arg |
| `production` (por defecto) | `nginx:1.27-alpine` + `dist/` + `nginx.conf`, puerto `80` |

---

## 5. `nginx.conf` (producción)

```nginx
client_max_body_size 12m;   # el backend acepta archivos de hasta 10 MB

# API REST (auth, apuntes, equipos, tareas, chat, admin, ...)
location ~ ^/(auth|apuntes|favoritos|usuarios|comentarios|valoraciones|equipos|tareas|chat|admin)(/|$) {
    proxy_pass http://backend:4000;
}

location /uploads/ { proxy_pass http://backend:4000; }

location /socket.io/ {
    proxy_pass http://backend:4000;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}

location / { try_files $uri $uri/ /index.html; }
```

- Las rutas del SPA caen a `index.html` (React Router).
- `/uploads/*` sirve PDFs/fotos desde el backend.
- `/socket.io/*` permite WebSocket para chat y tablero en tiempo real.
- Todas las rutas de API usan el mismo origen, así que no hace falta CORS ni
  `VITE_API_URL` en producción.

---

## 6. Comandos útiles

```bash
# Producción
docker compose up -d --build
docker compose logs -f

# Desarrollo
docker compose -f docker-compose.dev.yml up --build

# Recrear desde cero (borra volúmenes de datos)
docker compose down -v
```

| Servicio | Producción | Desarrollo |
|----------|------------|------------|
| Frontend | http://localhost:8080 | http://localhost:5173 |
| Backend API | http://localhost:4001 (solo localhost) | http://localhost:4000 |
| PostgreSQL | red interna | localhost:5432 |

---

## 7. Variables de entorno (`.env` raíz)

| Variable | Uso | Default |
|----------|-----|---------|
| `DB_PASSWORD` | Contraseña de PostgreSQL | obligatoria en producción |
| `DB_NAME` | Nombre de la base de datos | `Edu-verseDB` |
| `JWT_SECRET` | Secreto para firmar tokens | **obligatorio**, sin fallback |
| `BACKEND_PORT` | Puerto local del backend | `4001` (prod) / `4000` (dev) |
| `FRONTEND_PORT` | Puerto público del frontend | `8080` |
| `VITE_API_URL` | URL de API compilada | vacío (mismo origen) |

> El backend además lee `edu-verse_backend/.env` para la conexión local fuera
> de Docker. Parte de `edu-verse_backend/.env.example`.

---

## 8. Flujo de la red

### Producción
```
Navegador ──> :8080 (Nginx)
                 │  /auth, /apuntes, ..., /socket.io, /uploads
                 ▼
        backend:4000 (Express + Socket.IO)
                 │  pg
                 ▼
        postgres:5432 (PostgreSQL 16, red interna)
```

### Desarrollo
```
Navegador ──> :5173 (Vite dev server)
                 │  proxy de API + /socket.io
                 ▼
        backend:4000 (Express + Socket.IO)
                 │  pg
                 ▼
        postgres:5432 (PostgreSQL 16)
```

- En desarrollo, Vite resuelve todo vía proxy → el frontend usa rutas relativas.
- En producción, Nginx hace el mismo trabajo y no se publica PostgreSQL.
