#!/bin/bash

# Setup script for Creator Assignment Matcher
echo "Setting up Creator Assignment Matcher..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file with your API keys before running the application."
fi

# Create necessary directories
mkdir -p logs
mkdir -p data/mongodb

# Set permissions for scripts
chmod +x scripts/*.sh

# Build and start services
echo "Building Docker images..."
docker-compose build

echo "Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service health
echo "Checking service health..."
curl -f http://localhost:3000/health || echo "API Gateway not ready"
curl -f http://localhost:3001/health || echo "Assignment Service not ready"
curl -f http://localhost:3002/health || echo "Creator Service not ready"
curl -f http://localhost:3003/health || echo "Matching Service not ready"

echo "Setup completed! Services are starting up."
echo "Frontend: http://localhost"
echo "API Gateway: http://localhost:3000"
echo "MongoDB: localhost:27017"
echo ""
echo "Run 'docker-compose logs -f' to view logs"
echo "Run 'docker-compose down' to stop services"