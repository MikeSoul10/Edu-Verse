FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN mkdir -p uploads/perfiles

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
