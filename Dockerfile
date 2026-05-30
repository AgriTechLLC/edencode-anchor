# EdenCode Anchor — hash-only weather anchoring web service
FROM node:22-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Render/most platforms inject PORT; default app port is 10000
EXPOSE 10000

CMD ["node", "dist/server.js"]
