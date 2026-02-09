#!/bin/bash
set -e

# Initialize Pinecone Index
echo "Initializing Vector Database Structure..."
node scripts/setup-vector-db.js

# Check if services are running to populate data
if curl -s http://localhost:3002/health > /dev/null; then
    echo "Services are running. Populating data..."
    ./scripts/populate-vector-db.sh
else
    echo "⚠️ Services are NOT running. Data population skipped."
    echo "Please start services with 'docker-compose up -d' and run './scripts/populate-vector-db.sh' manually."
fi
