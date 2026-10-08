FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY public ./public
COPY server.js ./server.js
COPY app.config.ts ./app.config.ts
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
