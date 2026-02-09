#!/bin/bash

# Drumbeat Labs - Comprehensive Test Runner
# This script runs all tests across the entire project

set -e  # Exit on any error

echo "🧪 Drumbeat Labs - Running All Tests"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_SUITES=()

# Function to run tests in a directory
run_tests() {
    local dir=$1
    local name=$2
    
    echo -e "${YELLOW}Testing: $name${NC}"
    echo "Location: $dir"
    echo "---"
    
    if [ -f "$dir/package.json" ]; then
        cd "$dir"
        if npm test 2>&1 | tee /tmp/test_output.txt; then
            echo -e "${GREEN}✓ $name tests passed${NC}"
            TOTAL_PASSED=$((TOTAL_PASSED + 1))
        else
            echo -e "${RED}✗ $name tests failed${NC}"
            TOTAL_FAILED=$((TOTAL_FAILED + 1))
            FAILED_SUITES+=("$name")
        fi
        cd - > /dev/null
    else
        echo -e "${YELLOW}⊘ No package.json found, skipping${NC}"
    fi
    echo ""
}

# Get the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Project Root: $PROJECT_ROOT"
echo ""

# Run tests for each component
run_tests "$PROJECT_ROOT/tests" "Core Property Tests"
run_tests "$PROJECT_ROOT/services/assignment-service" "Assignment Service"
run_tests "$PROJECT_ROOT/services/matching-service" "Matching Service"
run_tests "$PROJECT_ROOT/services/creator-service" "Creator Service"
run_tests "$PROJECT_ROOT/services/api-gateway" "API Gateway"
run_tests "$PROJECT_ROOT/shared" "Shared Components"

# Summary
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo -e "Passed: ${GREEN}$TOTAL_PASSED${NC}"
echo -e "Failed: ${RED}$TOTAL_FAILED${NC}"

if [ $TOTAL_FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed Test Suites:${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo "  - $suite"
    done
    echo ""
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
fi
