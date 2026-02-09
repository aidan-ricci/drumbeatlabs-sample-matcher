#!/bin/bash
set -e

# Run load tests using the defined node script
echo "Drumbeat Labs - Load Tests"
echo "Starting load test suite..."

# Ensure dependencies installed in tests/
if [ ! -d "node_modules" ] && [ ! -d "tests/node_modules" ]; then
    echo "Installing test dependencies..."
    cd tests && npm install && cd ..
fi

# Run the load test script
# Use environment variables if needed
TARGET_URL=${TARGET_URL:-http://localhost:3000} node tests/load/run-load-test.js
