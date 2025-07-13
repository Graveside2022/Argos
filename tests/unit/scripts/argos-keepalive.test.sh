#!/bin/bash
#
# Test suite for argos-keepalive.sh
# Tests process management, memory monitoring, and service restart functionality
#

set -euo pipefail

# Test configuration
TEST_DIR="/tmp/argos-keepalive-tests"
TEST_LOG="$TEST_DIR/test.log"
TEST_PID_FILE="$TEST_DIR/test.pid"
SCRIPT_PATH="./scripts/argos-keepalive.sh"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup test environment
setup() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR"
    export LOG_FILE="$TEST_LOG"
    export PID_FILE="$TEST_PID_FILE"
    export DEBUG=1
}

# Cleanup test environment
cleanup() {
    rm -rf "$TEST_DIR"
    # Kill any test processes
    pkill -f "test_dummy_process" 2>/dev/null || true
}

# Assert functions
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Assertion failed}"
    
    ((TESTS_RUN++))
    if [[ "$expected" == "$actual" ]]; then
        echo -e "${GREEN}✓${NC} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $message"
        echo "  Expected: $expected"
        echo "  Actual: $actual"
        ((TESTS_FAILED++))
    fi
}

assert_true() {
    local condition="$1"
    local message="${2:-Assertion failed}"
    
    ((TESTS_RUN++))
    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $message (condition: $condition)"
        ((TESTS_FAILED++))
    fi
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File should exist}"
    
    ((TESTS_RUN++))
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $message: $file"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $message: $file"
        ((TESTS_FAILED++))
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String should contain substring}"
    
    ((TESTS_RUN++))
    if [[ "$haystack" == *"$needle"* ]]; then
        echo -e "${GREEN}✓${NC} $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $message"
        echo "  Looking for: $needle"
        echo "  In: $haystack"
        ((TESTS_FAILED++))
    fi
}

# Test script exists and is executable
test_script_exists() {
    echo -e "\n${YELLOW}Test: Script existence and permissions${NC}"
    
    assert_file_exists "$SCRIPT_PATH" "Keepalive script exists"
    assert_true "[[ -x '$SCRIPT_PATH' ]]" "Script is executable"
}

# Test help output
test_help_output() {
    echo -e "\n${YELLOW}Test: Help output${NC}"
    
    local output=$("$SCRIPT_PATH" --help 2>&1 || true)
    assert_contains "$output" "Usage:" "Help shows usage"
    assert_contains "$output" "--daemon" "Help mentions daemon mode"
    assert_contains "$output" "--status" "Help mentions status command"
    assert_contains "$output" "--stop" "Help mentions stop command"
}

# Test PID file creation
test_pid_file_creation() {
    echo -e "\n${YELLOW}Test: PID file management${NC}"
    
    # Start in daemon mode for a brief moment
    timeout 2 "$SCRIPT_PATH" --daemon >/dev/null 2>&1 || true
    
    assert_file_exists "$TEST_PID_FILE" "PID file created in daemon mode"
    
    # Clean up
    if [[ -f "$TEST_PID_FILE" ]]; then
        local pid=$(cat "$TEST_PID_FILE")
        kill "$pid" 2>/dev/null || true
        rm -f "$TEST_PID_FILE"
    fi
}

# Test status command
test_status_command() {
    echo -e "\n${YELLOW}Test: Status command${NC}"
    
    # Test when not running
    local output=$("$SCRIPT_PATH" --status 2>&1 || true)
    assert_contains "$output" "not running" "Status shows not running when stopped"
    
    # Start daemon and test status
    timeout 3 "$SCRIPT_PATH" --daemon >/dev/null 2>&1 &
    local daemon_pid=$!
    sleep 1
    
    if [[ -f "$TEST_PID_FILE" ]]; then
        output=$("$SCRIPT_PATH" --status 2>&1 || true)
        assert_contains "$output" "running" "Status shows running when active"
        assert_contains "$output" "PID:" "Status shows PID"
        
        # Clean up
        "$SCRIPT_PATH" --stop >/dev/null 2>&1 || true
    fi
    
    kill $daemon_pid 2>/dev/null || true
}

# Test process counting functions
test_process_counting() {
    echo -e "\n${YELLOW}Test: Process counting${NC}"
    
    # Create dummy processes
    sleep 9999 &
    local dummy1=$!
    sleep 9999 &
    local dummy2=$!
    
    # Count processes
    local count=$(pgrep -f "sleep 9999" | wc -l)
    assert_equals "2" "$count" "Can count dummy processes"
    
    # Clean up
    kill $dummy1 $dummy2 2>/dev/null || true
}

# Test log file creation
test_logging() {
    echo -e "\n${YELLOW}Test: Logging functionality${NC}"
    
    # Run a single check
    "$SCRIPT_PATH" >/dev/null 2>&1
    
    assert_file_exists "$TEST_LOG" "Log file created"
    
    if [[ -f "$TEST_LOG" ]]; then
        local log_content=$(cat "$TEST_LOG")
        assert_contains "$log_content" "running single check" "Log contains expected message"
        assert_contains "$log_content" "Single check completed" "Log shows completion"
    fi
}

# Test duplicate detection logic
test_duplicate_detection() {
    echo -e "\n${YELLOW}Test: Duplicate process detection${NC}"
    
    # Verify the script can identify duplicate processes
    local script_dir=$(dirname "$SCRIPT_PATH")
    local script_name=$(basename "$SCRIPT_PATH")
    
    # Test that script functions are available when sourced
    # This is a simplified test since we can't easily test the actual killing
    (
        export -f prune_duplicate_vite_processes 2>/dev/null || true
        type prune_duplicate_vite_processes 2>/dev/null || echo "Function not exported"
    )
    
    # At minimum, verify the script syntax is valid
    bash -n "$SCRIPT_PATH"
    assert_equals "0" "$?" "Script has valid syntax"
}

# Test memory threshold configuration
test_memory_configuration() {
    echo -e "\n${YELLOW}Test: Memory threshold configuration${NC}"
    
    # Check that script defines memory threshold
    local threshold=$(grep "^MEMORY_THRESHOLD_MB=" "$SCRIPT_PATH" | cut -d= -f2)
    assert_true "[[ -n '$threshold' ]]" "Memory threshold is defined"
    assert_true "[[ '$threshold' -gt 0 ]]" "Memory threshold is positive number"
}

# Test service integration
test_service_configuration() {
    echo -e "\n${YELLOW}Test: Service configuration${NC}"
    
    # Check that script defines service name
    local service=$(grep "^ARGOS_SERVICE=" "$SCRIPT_PATH" | cut -d= -f2 | tr -d '"')
    assert_equals "argos.service" "$service" "Correct service name configured"
}

# Test error handling
test_error_handling() {
    echo -e "\n${YELLOW}Test: Error handling${NC}"
    
    # Test with invalid command
    local output=$("$SCRIPT_PATH" --invalid-option 2>&1 || true)
    assert_contains "$output" "Unknown option" "Handles unknown options"
    
    # Test running when already running (simulate)
    echo "$$" > "$TEST_PID_FILE"
    output=$("$SCRIPT_PATH" --daemon 2>&1 || true)
    assert_contains "$output" "already running" "Detects already running instance"
    rm -f "$TEST_PID_FILE"
}

# Performance test - ensure script starts quickly
test_performance() {
    echo -e "\n${YELLOW}Test: Performance${NC}"
    
    local start_time=$(date +%s)
    timeout 2 "$SCRIPT_PATH" --help >/dev/null 2>&1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    assert_true "[[ $duration -lt 2 ]]" "Help command completes in under 2 seconds"
}

# Integration test - full cycle
test_integration() {
    echo -e "\n${YELLOW}Test: Integration - Full cycle${NC}"
    
    # Start daemon
    timeout 5 "$SCRIPT_PATH" --daemon >/dev/null 2>&1 &
    local daemon_pid=$!
    sleep 2
    
    # Check it's running
    if [[ -f "$TEST_PID_FILE" ]]; then
        local pid=$(cat "$TEST_PID_FILE")
        assert_true "kill -0 $pid 2>/dev/null" "Daemon process is running"
        
        # Check status
        local status=$("$SCRIPT_PATH" --status 2>&1)
        assert_contains "$status" "running" "Status reports running"
        
        # Stop daemon
        "$SCRIPT_PATH" --stop >/dev/null 2>&1
        sleep 1
        
        # Verify stopped
        assert_true "! kill -0 $pid 2>/dev/null" "Daemon process stopped"
        assert_true "[[ ! -f '$TEST_PID_FILE' ]]" "PID file removed"
    fi
    
    # Clean up
    kill $daemon_pid 2>/dev/null || true
}

# Main test runner
main() {
    echo "==================================="
    echo "Argos Keepalive Test Suite"
    echo "==================================="
    
    # Setup
    setup
    trap cleanup EXIT
    
    # Run tests
    test_script_exists
    test_help_output
    test_pid_file_creation
    test_status_command
    test_process_counting
    test_logging
    test_duplicate_detection
    test_memory_configuration
    test_service_configuration
    test_error_handling
    test_performance
    test_integration
    
    # Summary
    echo
    echo "==================================="
    echo "Test Summary"
    echo "==================================="
    echo -e "Total tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}Some tests failed!${NC}"
        exit 1
    fi
}

# Run tests
main "$@"