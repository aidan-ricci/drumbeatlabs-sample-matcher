#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Drumbeat Labs - E2E Smoke Tests${NC}"
echo "======================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi

# Check if services are already running
if [ -z "$(docker-compose ps -q)" ]; then
  echo -e "${YELLOW}Starting services...${NC}"
  docker-compose up -d --build
else
  echo -e "${GREEN}Services are already running${NC}"
fi

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
# Simple wait loop for API Gateway
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
  if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}API Gateway is up!${NC}"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo -e "${RED}Timeout waiting for API Gateway${NC}"
    docker-compose logs api-gateway
    exit 1
  fi
  echo -n "."
  sleep 2
done
echo ""

# Run the tests
echo -e "${YELLOW}Running E2E tests...${NC}"
cd tests && npm run test -- e2e/smoke.test.js

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ E2E Tests Passed!${NC}"
else
  echo -e "${RED}❌ E2E Tests Failed!${NC}"
fi

# Cleanup option
if [ "$1" == "--cleanup" ]; then
  echo -e "${YELLOW}Stopping services...${NC}"
  docker-compose down
fi

exit $TEST_EXIT_CODE
