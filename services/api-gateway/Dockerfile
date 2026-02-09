FROM node:18-alpine

WORKDIR /app

# Setup gateway service
WORKDIR /app/services/api-gateway
COPY services/api-gateway/package*.json ./
RUN npm install --omit=dev

# Copy service source
COPY services/api-gateway ./

# Setup non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Environment variables
ENV NODE_ENV=production

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]