FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json vite.config.js ./
RUN npm ci
COPY public/ ./public/
RUN npx vite build

FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY public/ ./public/
COPY server/ ./server/
COPY package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 3000
ENV NODE_ENV=production
USER node
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD []
