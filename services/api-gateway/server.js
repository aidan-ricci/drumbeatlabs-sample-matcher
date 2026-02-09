const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway'
  });
});

// Service proxy configurations
const services = {
  assignment: process.env.ASSIGNMENT_SERVICE_URL || 'http://assignment-service:3001',
  creator: process.env.CREATOR_SERVICE_URL || 'http://creator-service:3002',
  matching: process.env.MATCHING_SERVICE_URL || 'http://matching-service:3003'
};

const onProxyReq = (proxyReq, req, res) => {
  if (req.body) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
};

// Proxy middleware for each service
app.use('/api/assignments', createProxyMiddleware({
  target: services.assignment,
  changeOrigin: true,
  pathRewrite: {
    '^/api/assignments': '/assignments'
  },
  onProxyReq,
  onError: (err, req, res) => {
    console.error('Assignment service proxy error:', err);
    res.status(503).json({ error: 'Assignment service unavailable' });
  }
}));

app.use('/api/creators', createProxyMiddleware({
  target: services.creator,
  changeOrigin: true,
  pathRewrite: {
    '^/api/creators': '/creators'
  },
  onProxyReq,
  onError: (err, req, res) => {
    console.error('Creator service proxy error:', err);
    res.status(503).json({ error: 'Creator service unavailable' });
  }
}));

app.use('/api/matches', createProxyMiddleware({
  target: services.matching,
  changeOrigin: true,
  pathRewrite: {
    '^/api/matches': '/matches'
  },
  onProxyReq,
  onError: (err, req, res) => {
    console.error('Matching service proxy error:', err);
    res.status(503).json({ error: 'Matching service unavailable' });
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log('Service endpoints:', services);
});