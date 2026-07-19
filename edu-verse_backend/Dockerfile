FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

RUN mkdir -p uploads/perfiles

COPY . .

EXPOSE 4000

CMD ["npx", "nodemon", "--legacy-watch", "index.js"]
