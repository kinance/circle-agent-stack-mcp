FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

ENV CIRCLE_API_KEY=dummy

CMD ["node", "dist/server.js"]
