# Multi-stage build for Fly.io
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY index.html ./
COPY index.tsx ./
COPY App.tsx ./
COPY constants.ts ./
COPY types.ts ./
COPY components ./components
COPY utils ./utils
COPY public ./public
COPY services ./services

# Build frontend
RUN npm run build

# Stage 2: Server with built frontend
FROM node:18-alpine

WORKDIR /app

# Copy server package.json and install dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy built frontend from builder
COPY --from=frontend-builder /app/dist ./dist

# Copy public assets (images, etc.)
COPY --from=frontend-builder /app/public ./public

# Copy server code
COPY server/server.js ./

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]

