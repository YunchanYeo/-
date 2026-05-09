FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ musl-dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build:docker

FROM node:20-alpine AS runtime
RUN apk add --no-cache python3 make g++ musl-dev
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]

