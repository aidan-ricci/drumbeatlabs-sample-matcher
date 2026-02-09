#!/bin/bash
# Trigger embedding refresh to populate Vector DB

echo "Triggering embedding refresh on Creator Service..."
response=$(curl -s -X POST http://localhost:3002/creators/embeddings/refresh \
  -H "Content-Type: application/json" \
  -d '{"forceRefresh": true}')

echo "Response:"
echo $response
