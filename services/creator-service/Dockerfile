FROM node:18-alpine

WORKDIR /app

# Copy and install shared dependencies
COPY shared ./shared
WORKDIR /app/shared
RUN npm install --omit=dev

# Copy creator data source
WORKDIR /app
COPY creators.json ./

# Setup creator service
WORKDIR /app/services/creator-service
COPY services/creator-service/package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY services/creator-service ./

# Health check using curl
RUN apk add --no-cache curl

# Setup non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S creator -u 1001 && \
    chown -R creator:nodejs /app
USER creator

# Environment variables
ENV NODE_ENV=production
ENV SERVERLESS_READY=true

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["node", "server.js"]