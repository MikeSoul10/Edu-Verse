# Infraestructura — Docker & Nginx

Orquestación de 3 servicios con **Docker Compose** y desarrollo con hot-reload. También se documenta la configuración de Nginx para producción.

---

## 1. `docker-compose.yml` — los 3 servicios

### Servicio `postgres`
1. Imagen `postgres:16-alpine`.
2. `restart: unless-stopped`.
3. Variables de entorno desde el `.env` raíz:
   - `POSTGRES_USER=postgres`
   - `POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}`
   - `POSTGRES_DB=${DB_NAME:-Edu-verseDB}`
4. Puerto expuesto `5432:5432`.
5. **Volúmenes:**
   - `pgdata:/var/lib/postgresql/data` → datos persistentes.
   - `./documentacion/backup_BASE_DE_DATOS.sql:/docker-entrypoint-initdb.d/init.sql` → carga el esquema automáticamente en el primer arranque (cuando el volumen está vacío).
6. **Healthcheck:** `pg_isready -U postgres` cada 5 s (5 reintentos) → el backend espera a que pase.

### Servicio `backend`
1. `build: ./edu-verse_backend` (usa su `Dockerfile`).
2. Puerto `4001:4000` (host `4001`, contenedor `4000`).
3. Variables: `DB_USER`, `DB_HOST=postgres`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT=5432`, `PORT=4000`, `JWT_SECRET` — todas resueltas del `.env` raíz.
4. **Volúmenes** (dev):
   - `uploads:/app/uploads` → archivos persistentes.
   - `./edu-verse_backend:/app` → código fuente montado (hot-reload).
   - `/app/node_modules` → anula el montaje para los node_modules del contenedor.
5. `depends_on: postgres: condition: service_healthy` → el backend NO arranca hasta que la BD responde.

### Servicio `frontend`
1. `build: ./edu-verse`.
2. Puerto `5173:5173`.
3. Volúmenes: `src`, `public`, `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js` montados → **HMR en vivo**, más `/app/node_modules` anulado.
4. `command: npm run dev -- --host 0.0.0.0`.
5. `depends_on: [backend]`.

### Volúmenes nombrados
```yaml
volumes:
  pgdata:   # datos de PostgreSQL
  uploads:  # archivos de apuntes y fotos
```

---

## 2. Booteos de desarrollo vs producción

| | Desarrollo `docker compose up -d` | Producción |
|---|---|---|
| Frontend | Vite dev server (HMR, puerto 5173) | Build estático servido por **Nginx** |
| Backend | `nodemon --legacy-watch index.js` | `node index.js` |
| Versiones | Dockerfile base `node:20-alpine` | Igual |

---

## 3. `Dockerfile` del backend (`edu-verse_backend/Dockerfile`)
1. `FROM node:20-alpine`.
2. `WORKDIR /app`.
3. `COPY package*.json ./` + `RUN npm install --include=dev` (instala también devDeps como nodemon).
4. `RUN mkdir -p uploads/perfiles` (directorio de fotos garantizado).
5. `COPY . .`.
6. `EXPOSE 4000`.
7. `CMD ["npx", "nodemon", "--legacy-watch", "index.js"]` → hot-reload en contenedor.

## 4. `Dockerfile` del frontend (`edu-verse/Dockerfile`)
1. `FROM node:20-alpine`.
2. `WORKDIR /app`.
3. `COPY package*.json ./` + `RUN npm install`.
4. `EXPOSE 5173`.
5. `CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]`.

---

## 5. `nginx.conf` (producción)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;      # SPA fallback (router de React)
    }

    location /uploads/ {
        proxy_pass http://backend:4000;        # sirve archivos desde el backend
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
- Las rutas del SPA caen a `index.html` (necesario para React Router).
- `/uploads/*` se proxya al backend para servir PDFs/fotos.

---

## 6. Comandos útiles

```bash
# Levantar todo
docker compose up -d

# Vuelta a construir con los Dockerfiles
docker compose up -d --build

# Ver logs en vivo
docker compose logs -f

# Recrear desde cero (borra volúmenes de datos)
docker compose down -v
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4001 (vía compose) |
| Postgres | localhost:5432 |

> **Tip:** como el backend estorba en `4000` dentro del contenedor y Vite proxya hacia `backend:4000`, la API también funciona por el mismo `5173` (proxy de desarrollo).

---

## 7. Variables de entorno (.env raíz)

| Variable | Uso | Default |
|----------|-----|---------|
| `DB_PASSWORD` | Contraseña de PostgreSQL | `postgres` |
| `DB_NAME` | Nombre de la base de datos | `Edu-verseDB` |
| `JWT_SECRET` | Secreto para firmar tokens | `supersecretkey_eduverse_2026` |

> El backend además lee `.env` propio (`edu-verse_backend/.env`) para la conexión local fuera de Docker.

---

## 8. Flujo de la red entre contenedores

```
Navegador ──> :5173 (Vite dev server)
                 │  proxy /api/* + /socket.io
                 ▼
        backend:4000 (Express + Socket.IO)
                 │  pg
                 ▼
        postgres:5432 (PostgreSQL 16)
```
- Vite resuelve todo vía proxy → el frontend usa rutas relativas (`API_URL = ''`).
- Socket.IO usa el proxy con `ws: true` para el chat y el kanban en tiempo real.