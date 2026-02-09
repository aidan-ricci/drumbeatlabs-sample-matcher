# Assignment Service

A serverless-ready microservice for managing content creator assignments with comprehensive CRUD operations, validation, and error handling.

## Features

- **Serverless-Ready Architecture**: Designed for both containerized and serverless deployment
- **Comprehensive CRUD Operations**: Full assignment lifecycle management
- **Advanced Validation**: Multi-layer validation with detailed error responses
- **Connection Pooling**: Optimized database connections for serverless environments
- **Error Handling**: Comprehensive error handling with circuit breaker patterns
- **Pagination Support**: Efficient pagination for large datasets
- **Search Functionality**: Full-text search across assignment fields
- **Health Monitoring**: Detailed health checks and monitoring endpoints

## Architecture

### Serverless-Ready Design

The service is architected to work seamlessly in both containerized and serverless environments:

- **Stateless Functions**: All business logic is implemented as pure functions
- **Connection Reuse**: Optimized connection management for cold starts
- **Modular Structure**: Handlers, middleware, and utilities are separated for easy deployment
- **Environment Agnostic**: Works with Docker, AWS Lambda, Azure Functions, Vercel, etc.

### Directory Structure

```
services/assignment-service/
├── handlers/              # Business logic handlers
│   └── assignmentHandlers.js
├── middleware/            # Express middleware
│   ├── errorHandler.js
│   └── validation.js
├── utils/                 # Utility functions
│   └── connectionManager.js
├── serverless/            # Serverless function wrappers
│   └── handler.js
├── scripts/               # Database migration scripts
├── server.js              # Express server (container mode)
├── serverless.yml         # Serverless Framework config
├── Dockerfile             # Container configuration
└── package.json
```

## Deployment Options

### 1. Container Deployment (Docker)

```bash
# Build the container
npm run docker:build

# Run locally
npm run docker:run

# Or use Docker Compose
docker-compose up assignment-service
```

### 2. Serverless Deployment (AWS Lambda)

```bash
# Install serverless dependencies
npm install

# Deploy to AWS
npm run serverless:deploy

# Run locally for testing
npm run serverless:offline
```

### 3. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

## API Endpoints

### Assignment Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/assignments` | Create new assignment |
| GET | `/assignments/:id` | Get assignment by ID |
| GET | `/assignments/history/:userId` | Get user's assignment history |
| PATCH | `/assignments/:id/matches` | Update assignment with match results |
| PATCH | `/assignments/:id/status` | Update assignment status |
| DELETE | `/assignments/:id` | Delete assignment |
| GET | `/assignments` | List assignments with pagination |
| GET | `/assignments/search` | Search assignments |
| GET | `/assignments/stats/:userId?` | Get assignment statistics |

### System Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |

## Request/Response Examples

### Create Assignment

```bash
POST /assignments
Content-Type: application/json

{
  "topic": "Sustainable Fashion Trends 2024",
  "keyTakeaway": "Highlight eco-friendly materials and ethical manufacturing",
  "additionalContext": "Focus on Gen Z audience, emphasize affordability",
  "targetAudience": {
    "demographic": "18-25 years old",
    "locale": "US"
  },
  "creatorValues": ["sustainability", "authenticity"],
  "creatorNiches": ["fashion", "lifestyle"],
  "toneStyle": "casual",
  "userId": "user123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "topic": "Sustainable Fashion Trends 2024",
    "keyTakeaway": "Highlight eco-friendly materials and ethical manufacturing",
    "additionalContext": "Focus on Gen Z audience, emphasize affordability",
    "targetAudience": {
      "demographic": "18-25 years old",
      "locale": "US"
    },
    "creatorValues": ["sustainability", "authenticity"],
    "creatorNiches": ["fashion", "lifestyle"],
    "toneStyle": "casual",
    "userId": "user123",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Get Assignment History

```bash
GET /assignments/history/user123?limit=10&skip=0&sortBy=createdAt&sortOrder=desc
```

Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "count": 10,
    "total": 45,
    "limit": 10,
    "skip": 0,
    "hasMore": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://mongodb:27017/creator-assignment-matcher` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `SERVERLESS_READY` | Enable serverless optimizations | `false` |
| `LOG_LEVEL` | Logging level | `info` |

### Serverless Configuration

The service includes a `serverless.yml` configuration for AWS Lambda deployment with:

- **Memory**: 512MB (configurable per environment)
- **Timeout**: 30 seconds
- **Concurrency**: Reserved concurrency per function
- **CORS**: Enabled for all endpoints
- **Environment Variables**: Secure environment variable management

## Error Handling

The service implements comprehensive error handling:

### Error Types

- **Validation Errors** (400): Invalid input data
- **Not Found Errors** (404): Resource not found
- **Database Errors** (503): Database connectivity issues
- **Rate Limit Errors** (429): Too many requests
- **Internal Errors** (500): Unexpected server errors

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "topic",
      "message": "Topic is required"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Validation

### Input Validation

- **Assignment Data**: Comprehensive validation using Joi schemas
- **Pagination Parameters**: Limit, skip, sort validation
- **MongoDB ObjectIds**: Format validation
- **Search Queries**: Length and content validation

### Security Features

- **Input Sanitization**: XSS and injection prevention
- **Request Size Limits**: 10MB limit for request bodies
- **Security Headers**: CORS, XSS protection, content type validation
- **Rate Limiting**: Configurable rate limiting per endpoint

## Performance Optimizations

### Database Optimizations

- **Connection Pooling**: Optimized for serverless cold starts
- **Indexes**: Strategic indexing for common queries
- **Aggregation**: Efficient statistics and search operations
- **Connection Reuse**: Smart connection management

### Serverless Optimizations

- **Cold Start Mitigation**: Connection reuse between invocations
- **Memory Management**: Configurable memory allocation
- **Timeout Handling**: Graceful timeout management
- **Circuit Breaker**: Fault tolerance for external dependencies

## Monitoring and Observability

### Health Checks

The `/health` endpoint provides detailed system status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "assignment-service",
  "database": {
    "status": "healthy",
    "connected": true,
    "connectionAge": 45000
  },
  "serverless": {
    "ready": true,
    "coldStart": false
  }
}
```

### Logging

- **Structured Logging**: JSON-formatted logs with context
- **Request Tracing**: Unique request IDs for debugging
- **Error Context**: Detailed error information with stack traces
- **Performance Metrics**: Response times and database query metrics

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- assignmentHandlers.test.js
```

## Migration and Deployment

### Database Migrations

```bash
# Run database migrations
npm run migrate
```

### Deployment Scripts

```bash
# Container deployment
npm run docker:build
npm run docker:run

# Serverless deployment
npm run serverless:deploy

# View serverless logs
npm run serverless:logs -- createAssignment
```

## Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive error handling for new features
3. Include validation for all inputs
4. Write tests for new functionality
5. Update documentation for API changes

## License

MIT License - see LICENSE file for details