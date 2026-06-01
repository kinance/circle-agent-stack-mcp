FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV CIRCLE_API_KEY=dummy

CMD ["node", "dist/server.js"]
