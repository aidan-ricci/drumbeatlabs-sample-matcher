# Creator Assignment Matcher

An intelligent web application that matches content assignments with the most suitable creators using semantic similarity and rule-based filtering.

## Architecture

The system is built as containerized microservices:

- **Frontend**: React SPA served by Nginx
- **API Gateway**: Express.js gateway with rate limiting and service routing
- **Assignment Service**: Handles assignment CRUD operations
- **Creator Service**: Manages creator data and embeddings
- **Matching Service**: Core matching logic with AI-powered recommendations
- **MongoDB**: Document database for assignments and user data
- **Pinecone**: Vector database for semantic similarity search

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- API keys for Pinecone and OpenAI

### Setup

1. Clone the repository
2. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` with your API keys
4. Run the setup script:
   ```bash
   npm run setup
   ```

### Development

Start all services:
```bash
npm run dev
```

Access the application:
- Frontend: http://localhost
- API Gateway: http://localhost:3000
- MongoDB: localhost:27017

### Available Commands

- `npm run start` - Start services in detached mode
- `npm run stop` - Stop all services
- `npm run logs` - View service logs
- `npm run clean` - Stop services and remove volumes
- `npm run test` - Run all service tests
- `npm run health` - Check API Gateway health

## Project Structure

```
├── frontend/                 # React frontend application
├── services/
│   ├── api-gateway/         # API Gateway service
│   ├── assignment-service/  # Assignment management service
│   ├── creator-service/     # Creator data and embeddings service
│   └── matching-service/    # Core matching logic service
├── shared/
│   ├── types/              # Shared TypeScript interfaces
│   └── utils/              # Shared utility functions
├── scripts/                # Setup and utility scripts
├── docker-compose.yml      # Local development orchestration
└── .env                   # Environment configuration
```

## Environment Variables

Key environment variables (see `.env.example` for complete list):

- `PINECONE_API_KEY` - Pinecone vector database API key
- `OPENAI_API_KEY` - OpenAI API key for embeddings
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment (development/production)

## Health Checks

All services include health check endpoints:
- API Gateway: http://localhost:3000/health
- Assignment Service: http://localhost:3001/health
- Creator Service: http://localhost:3002/health
- Matching Service: http://localhost:3003/health

## Serverless Ready

The architecture is designed for easy migration to serverless platforms:
- Stateless service design
- Environment-based configuration
- Connection pooling optimization
- Cold start optimization flags

## Development Workflow

1. Make changes to service code
2. Services auto-reload in development mode
3. Run tests: `npm run test`
4. Check logs: `npm run logs`
5. Health check: `npm run health`

## Production Deployment

The system is containerized and ready for deployment to:
- Kubernetes clusters
- Docker Swarm
- Cloud container services (ECS, Cloud Run, etc.)
- Serverless platforms (with minor modifications)

## Contributing

1. Follow the existing code structure
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all health checks pass