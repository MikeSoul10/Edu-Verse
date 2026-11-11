# Base Debian (glibc), no Alpine: el modelo de embeddings del Tutor IA usa
# onnxruntime-node, cuyo binario nativo no carga en Alpine (musl).

# Etapa de desarrollo: hot-reload con nodemon (se usa desde docker-compose.dev.yml).
FROM node:20-bookworm-slim AS development

# poppler-utils aporta pdftoppm: el worker del Tutor IA convierte a imagen
# las páginas escaneadas de los PDF para pasarlas por OCR.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*

# Caché del modelo de embeddings (volumen en docker-compose). Se crea con dueño
# `node` para que el volumen nuevo herede el permiso de escritura.
ENV MODELOS_CACHE=/modelos
RUN mkdir -p /modelos && chown node:node /modelos

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads/perfiles

EXPOSE 4000

CMD ["npx", "nodemon", "--legacy-watch", "index.js"]

# Etapa de producción: solo dependencias necesarias y proceso Node normal.
FROM node:20-bookworm-slim AS production

ENV NODE_ENV=production

# poppler-utils aporta pdftoppm: el worker del Tutor IA convierte a imagen
# las páginas escaneadas de los PDF para pasarlas por OCR.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*

# Caché del modelo de embeddings (volumen en docker-compose). Se crea con dueño
# `node` para que el volumen nuevo herede el permiso de escritura.
ENV MODELOS_CACHE=/modelos
RUN mkdir -p /modelos && chown node:node /modelos

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p uploads/perfiles && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["node", "index.js"]
