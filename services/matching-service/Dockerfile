FROM node:18-alpine

WORKDIR /app

# Copy and install shared dependencies
COPY shared ./shared
WORKDIR /app/shared
RUN npm install --omit=dev

# Copy creator data source
WORKDIR /app
COPY creators.json ./

# Setup matching service
WORKDIR /app/services/matching-service
COPY services/matching-service/package*.json ./
RUN npm install --omit=dev

# Copy service source
COPY services/matching-service ./

# Setup non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV SERVERLESS_READY=true

EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

CMD ["node", "server.js"]