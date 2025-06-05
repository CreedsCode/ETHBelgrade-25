FROM node:14.4.0-alpine3.11
WORKDIR /appAdd commentMore actions
COPY package*.json ./
RUN npm ci
COPY . .
ENTRYPOINT ["node", "/app/src/app.js"]