FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev=false

COPY server ./server
COPY public ./public

RUN cd server && npm run build

WORKDIR /app/server
EXPOSE 4000
CMD ["npm", "start"]
