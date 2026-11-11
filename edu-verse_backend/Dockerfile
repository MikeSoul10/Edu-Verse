# Etapa de desarrollo: hot-reload con nodemon (se usa desde docker-compose.dev.yml).
FROM node:20-alpine AS development

# poppler-utils aporta pdftoppm: el worker del Tutor IA convierte a imagen
# las páginas escaneadas de los PDF para pasarlas por OCR.
RUN apk add --no-cache poppler-utils

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads/perfiles

EXPOSE 4000

CMD ["npx", "nodemon", "--legacy-watch", "index.js"]

# Etapa de producción: solo dependencias necesarias y proceso Node normal.
FROM node:20-alpine AS production

ENV NODE_ENV=production

# poppler-utils aporta pdftoppm: el worker del Tutor IA convierte a imagen
# las páginas escaneadas de los PDF para pasarlas por OCR.
RUN apk add --no-cache poppler-utils

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p uploads/perfiles && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["node", "index.js"]
