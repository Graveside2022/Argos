#!/bin/bash

# ArgosFinal Comprehensive Test Runner
# Ensures all test suites run with proper configuration

set -e

echo "🧪 ArgosFinal Test Suite Runner"
echo "==============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if test server is needed
if ! lsof -i:8093 > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting test server on port 8093...${NC}"
    node tests/helpers/test-server.ts &
    TEST_SERVER_PID=$!
    sleep 2
fi

# Function to run test suite
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "\n${YELLOW}Running $suite_name...${NC}"
    if $command; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        FAILED=true
    fi
}

# Ensure test directories exist
mkdir -p tests/reports
mkdir -p tests/visual/{baselines,screenshots,diffs}

# Run test suites
FAILED=false

# Unit tests
run_test_suite "Unit Tests" "npm run test:unit"

# Integration tests
export TEST_URL=http://localhost:8093
export WS_URL=ws://localhost:8093
run_test_suite "Integration Tests" "npm run test:integration"

# Visual regression tests
run_test_suite "Visual Regression Tests" "npm run test:visual"

# Performance benchmarks
run_test_suite "Performance Benchmarks" "npm run test:performance"

# E2E tests (if server is running)
if lsof -i:5173 > /dev/null 2>&1; then
    run_test_suite "End-to-End Tests" "npm run test:e2e"
else
    echo -e "${YELLOW}Skipping E2E tests - dev server not running${NC}"
fi

# Coverage report
echo -e "\n${YELLOW}Generating coverage report...${NC}"
npm run test:coverage

# Clean up test server if we started it
if [ ! -z "$TEST_SERVER_PID" ]; then
    echo -e "\n${YELLOW}Stopping test server...${NC}"
    kill $TEST_SERVER_PID 2>/dev/null || true
fi

# Summary
echo -e "\n==============================="
if [ "$FAILED" = true ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    echo -e "\nReports available at:"
    echo "  - Coverage: tests/reports/coverage/index.html"
    echo "  - Visual: tests/visual/report.html"
    echo "  - E2E: tests/reports/playwright/index.html"
fi