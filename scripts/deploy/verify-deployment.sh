#!/bin/bash
#
# Argos Deployment Verification Script
# Comprehensive testing and validation for Dragon OS deployment
#
# Usage: bash verify-deployment.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CURRENT_USER=$(whoami)
CURRENT_HOME=$(eval echo ~$CURRENT_USER)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/verification.log"

# Test configuration
ARGOS_PORT=5173
OPENWEBRX_PORT=8073
HACKRF_SWEEP_PORT=3002
WIGLETOTAK_PORT=8000
KISMET_PORT=2501

# Test results
declare -A TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

#######################################################################################
# Utility Functions
#######################################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "${LOG_FILE}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "${LOG_FILE}"
}

# Test framework functions
run_test() {
    local test_name="$1"
    local test_function="$2"
    local required="${3:-true}"
    
    ((TOTAL_TESTS++))
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    if $test_function; then
        TEST_RESULTS["$test_name"]="PASS"
        ((PASSED_TESTS++))
        success "$test_name"
    else
        TEST_RESULTS["$test_name"]="FAIL"
        ((FAILED_TESTS++))
        if [[ "$required" == "true" ]]; then
            error "$test_name (REQUIRED)"
        else
            warn "$test_name (OPTIONAL)"
        fi
    fi
}

#######################################################################################
# System Tests
#######################################################################################

test_system_info() {
    log "=== System Information ==="
    log "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '"')"
    log "User: $CURRENT_USER"
    log "Home: $CURRENT_HOME"
    log "Project: $PROJECT_DIR"
    log "Architecture: $(uname -m)"
    log "Kernel: $(uname -r)"
    log "Memory: $(free -h | grep Mem | awk '{print $2}')"
    log "Disk: $(df -h / | tail -1 | awk '{print $4}')"
    return 0
}

test_dragon_os_detection() {
    if grep -q -i "dragonos" /etc/os-release 2>/dev/null; then
        log "Dragon OS detected in /etc/os-release"
        return 0
    elif command -v hackrf_info &> /dev/null && command -v gqrx &> /dev/null; then
        log "Dragon OS detected (SDR tools present)"
        return 0
    else
        log "Standard Linux system detected"
        return 1
    fi
}

test_file_permissions() {
    local project_readable=0
    local project_writable=0
    
    if [[ -r "$PROJECT_DIR" ]]; then
        project_readable=1
    fi
    
    if [[ -w "$PROJECT_DIR" ]]; then
        project_writable=1
    fi
    
    if [[ $project_readable -eq 1 && $project_writable -eq 1 ]]; then
        log "Project directory permissions: OK"
        return 0
    else
        error "Project directory permissions: FAIL"
        return 1
    fi
}

test_required_directories() {
    local required_dirs=(
        "$PROJECT_DIR/src"
        "$PROJECT_DIR/scripts"
        "$PROJECT_DIR/docs"
        "$PROJECT_DIR/static"
        "$PROJECT_DIR/tools"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error "Missing required directory: $dir"
            return 1
        fi
    done
    
    log "All required directories present"
    return 0
}

#######################################################################################
# Dependency Tests
#######################################################################################

test_nodejs() {
    if command -v node &> /dev/null; then
        local version=$(node --version)
        log "Node.js version: $version"
        
        local major_version=$(echo "$version" | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $major_version -ge 18 ]]; then
            return 0
        else
            error "Node.js version too old: $version (need >= 18)"
            return 1
        fi
    else
        error "Node.js not found"
        return 1
    fi
}

test_npm() {
    if command -v npm &> /dev/null; then
        local version=$(npm --version)
        log "npm version: $version"
        return 0
    else
        error "npm not found"
        return 1
    fi
}

test_docker() {
    if command -v docker &> /dev/null; then
        local version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        log "Docker version: $version"
        
        if sudo docker ps &> /dev/null; then
            log "Docker daemon running"
            return 0
        else
            error "Docker daemon not running"
            return 1
        fi
    else
        error "Docker not found"
        return 1
    fi
}

test_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        local version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        log "Docker Compose version: $version"
        return 0
    else
        warn "Docker Compose not found"
        return 1
    fi
}

test_python() {
    if command -v python3 &> /dev/null; then
        local version=$(python3 --version)
        log "Python version: $version"
        return 0
    else
        error "Python 3 not found"
        return 1
    fi
}

#######################################################################################
# Hardware Tests
#######################################################################################

test_hackrf_tools() {
    if command -v hackrf_info &> /dev/null; then
        log "HackRF tools installed"
        return 0
    else
        error "HackRF tools not found"
        return 1
    fi
}

test_hackrf_device() {
    if command -v hackrf_info &> /dev/null; then
        if hackrf_info &> /dev/null; then
            log "HackRF device detected"
            return 0
        else
            warn "HackRF device not connected"
            return 1
        fi
    else
        warn "HackRF tools not available"
        return 1
    fi
}

test_usb_permissions() {
    local user_groups=$(groups $CURRENT_USER)
    
    if echo "$user_groups" | grep -q "plugdev"; then
        log "User in plugdev group"
        return 0
    else
        error "User not in plugdev group"
        return 1
    fi
}

test_gpio_access() {
    if [[ -d "/sys/class/gpio" ]]; then
        log "GPIO access available"
        return 0
    else
        warn "GPIO access not available"
        return 1
    fi
}

#######################################################################################
# Project Tests
#######################################################################################

test_package_json() {
    if [[ -f "$PROJECT_DIR/package.json" ]]; then
        log "package.json found"
        
        if cd "$PROJECT_DIR" && npm list --depth=0 &> /dev/null; then
            log "npm dependencies satisfied"
            return 0
        else
            error "npm dependencies not satisfied"
            return 1
        fi
    else
        error "package.json not found"
        return 1
    fi
}

test_environment_file() {
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        log ".env file found"
        
        # Check for required environment variables
        local required_vars=("NODE_ENV" "PORT" "OPENWEBRX_PORT")
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" "$PROJECT_DIR/.env"; then
                error "Missing environment variable: $var"
                return 1
            fi
        done
        
        log "Environment variables configured"
        return 0
    else
        warn ".env file not found"
        return 1
    fi
}

test_build_process() {
    cd "$PROJECT_DIR"
    
    if npm run build &> /dev/null; then
        log "Build process successful"
        return 0
    else
        error "Build process failed"
        return 1
    fi
}

test_typescript_compilation() {
    cd "$PROJECT_DIR"
    
    if npm run check &> /dev/null; then
        log "TypeScript compilation successful"
        return 0
    else
        error "TypeScript compilation failed"
        return 1
    fi
}

#######################################################################################
# Service Tests
#######################################################################################

test_systemd_services() {
    local service_files=(
        "/etc/systemd/system/argos.service"
        "/etc/systemd/system/argos-openwebrx.service"
    )
    
    local services_found=0
    
    for service_file in "${service_files[@]}"; do
        if [[ -f "$service_file" ]]; then
            ((services_found++))
            log "Found systemd service: $service_file"
        fi
    done
    
    if [[ $services_found -gt 0 ]]; then
        log "Systemd services configured"
        return 0
    else
        error "No systemd services found"
        return 1
    fi
}

test_argos_service() {
    if systemctl is-enabled argos.service &> /dev/null; then
        log "Argos service enabled"
        
        if systemctl is-active argos.service &> /dev/null; then
            log "Argos service running"
            return 0
        else
            warn "Argos service not running"
            return 1
        fi
    else
        warn "Argos service not enabled"
        return 1
    fi
}

test_docker_services() {
    if command -v docker &> /dev/null && [[ -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        cd "$PROJECT_DIR"
        
        if sudo docker-compose ps &> /dev/null; then
            log "Docker services configured"
            return 0
        else
            warn "Docker services not running"
            return 1
        fi
    else
        warn "Docker or docker-compose.yml not found"
        return 1
    fi
}

#######################################################################################
# Network Tests
#######################################################################################

test_port_availability() {
    local ports=($ARGOS_PORT $OPENWEBRX_PORT $HACKRF_SWEEP_PORT $WIGLETOTAK_PORT $KISMET_PORT)
    
    for port in "${ports[@]}"; do
        if netstat -ln 2>/dev/null | grep -q ":$port "; then
            log "Port $port is in use"
        else
            log "Port $port is available"
        fi
    done
    
    return 0
}

test_argos_web_interface() {
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ARGOS_PORT" | grep -q "200"; then
        log "Argos web interface responding"
        return 0
    else
        error "Argos web interface not responding"
        return 1
    fi
}

test_openwebrx_interface() {
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$OPENWEBRX_PORT" | grep -q "200"; then
        log "OpenWebRX interface responding"
        return 0
    else
        warn "OpenWebRX interface not responding"
        return 1
    fi
}

test_firewall_configuration() {
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            log "UFW firewall active"
            
            # Check if required ports are allowed
            local required_ports=($ARGOS_PORT $OPENWEBRX_PORT)
            
            for port in "${required_ports[@]}"; do
                if ufw status | grep -q "$port"; then
                    log "Port $port allowed in firewall"
                else
                    warn "Port $port not allowed in firewall"
                fi
            done
            
            return 0
        else
            warn "UFW firewall not active"
            return 1
        fi
    else
        warn "UFW not installed"
        return 1
    fi
}

#######################################################################################
# Performance Tests
#######################################################################################

test_memory_usage() {
    local available_mem=$(free -m | awk 'NR==2{print $7}')
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    
    log "Available memory: ${available_mem}MB / ${total_mem}MB"
    
    if [[ $available_mem -gt 512 ]]; then
        log "Memory usage acceptable"
        return 0
    else
        warn "Low memory available"
        return 1
    fi
}

test_disk_usage() {
    local available_disk=$(df / | awk 'NR==2{print $4}')
    
    log "Available disk: $(df -h / | tail -1 | awk '{print $4}')"
    
    if [[ $available_disk -gt 1048576 ]]; then  # 1GB in KB
        log "Disk usage acceptable"
        return 0
    else
        warn "Low disk space available"
        return 1
    fi
}

test_cpu_load() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | cut -d',' -f1)
    
    log "CPU load average: $load_avg"
    
    if (( $(echo "$load_avg < 2.0" | bc -l) )); then
        log "CPU load acceptable"
        return 0
    else
        warn "High CPU load detected"
        return 1
    fi
}

#######################################################################################
# Integration Tests
#######################################################################################

test_database_connectivity() {
    if [[ -f "$PROJECT_DIR/src/lib/db/database.js" ]]; then
        cd "$PROJECT_DIR"
        
        if npm run db:test &> /dev/null; then
            log "Database connectivity OK"
            return 0
        else
            warn "Database connectivity failed"
            return 1
        fi
    else
        warn "Database test script not found"
        return 1
    fi
}

test_api_endpoints() {
    local endpoints=(
        "http://localhost:$ARGOS_PORT/api/health"
        "http://localhost:$ARGOS_PORT/api/system/status"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200"; then
            log "API endpoint responding: $endpoint"
        else
            warn "API endpoint not responding: $endpoint"
        fi
    done
    
    return 0
}

#######################################################################################
# Test Summary and Reporting
#######################################################################################

print_test_summary() {
    echo ""
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Deployment Verification Summary${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    echo -e "${GREEN}Test Results:${NC}"
    echo -e "  • Total Tests: ${YELLOW}$TOTAL_TESTS${NC}"
    echo -e "  • Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  • Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "  • Success Rate: ${YELLOW}$(( PASSED_TESTS * 100 / TOTAL_TESTS ))%${NC}"
    echo ""
    
    echo -e "${GREEN}Test Details:${NC}"
    for test_name in "${!TEST_RESULTS[@]}"; do
        local result="${TEST_RESULTS[$test_name]}"
        if [[ "$result" == "PASS" ]]; then
            echo -e "  ✅ $test_name"
        else
            echo -e "  ❌ $test_name"
        fi
    done
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed! Your Argos deployment is ready for use.${NC}"
    elif [[ $FAILED_TESTS -le 3 ]]; then
        echo -e "${YELLOW}⚠️  Some tests failed, but deployment may still be functional.${NC}"
    else
        echo -e "${RED}❌ Multiple critical tests failed. Deployment needs attention.${NC}"
    fi
    echo ""
    
    echo -e "${BLUE}Next Steps:${NC}"
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "  • Access Argos: ${YELLOW}http://localhost:$ARGOS_PORT${NC}"
        echo -e "  • Access OpenWebRX: ${YELLOW}http://localhost:$OPENWEBRX_PORT${NC}"
        echo -e "  • Check logs: ${YELLOW}sudo journalctl -u argos -f${NC}"
    else
        echo -e "  • Review failed tests above"
        echo -e "  • Check deployment logs: ${YELLOW}$LOG_FILE${NC}"
        echo -e "  • Re-run deployment: ${YELLOW}bash deploy-dragon-os.sh${NC}"
    fi
    echo ""
}

#######################################################################################
# Main Test Execution
#######################################################################################

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Deployment Verification${NC}"
    echo -e "${BLUE}# Comprehensive testing for Dragon OS compatibility${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    # Initialize log file
    touch "${LOG_FILE}"
    
    log "Starting Argos deployment verification..."
    
    # System Information
    run_test "System Information" test_system_info false
    
    # System Tests
    run_test "Dragon OS Detection" test_dragon_os_detection false
    run_test "File Permissions" test_file_permissions true
    run_test "Required Directories" test_required_directories true
    
    # Dependency Tests
    run_test "Node.js" test_nodejs true
    run_test "npm" test_npm true
    run_test "Docker" test_docker true
    run_test "Docker Compose" test_docker_compose false
    run_test "Python 3" test_python true
    
    # Hardware Tests
    run_test "HackRF Tools" test_hackrf_tools false
    run_test "HackRF Device" test_hackrf_device false
    run_test "USB Permissions" test_usb_permissions true
    run_test "GPIO Access" test_gpio_access false
    
    # Project Tests
    run_test "Package.json" test_package_json true
    run_test "Environment File" test_environment_file false
    run_test "Build Process" test_build_process true
    run_test "TypeScript Compilation" test_typescript_compilation false
    
    # Service Tests
    run_test "Systemd Services" test_systemd_services false
    run_test "Argos Service" test_argos_service false
    run_test "Docker Services" test_docker_services false
    
    # Network Tests
    run_test "Port Availability" test_port_availability true
    run_test "Argos Web Interface" test_argos_web_interface false
    run_test "OpenWebRX Interface" test_openwebrx_interface false
    run_test "Firewall Configuration" test_firewall_configuration false
    
    # Performance Tests
    run_test "Memory Usage" test_memory_usage true
    run_test "Disk Usage" test_disk_usage true
    run_test "CPU Load" test_cpu_load false
    
    # Integration Tests
    run_test "Database Connectivity" test_database_connectivity false
    run_test "API Endpoints" test_api_endpoints false
    
    # Print summary
    print_test_summary
    
    log "Verification completed. Check $LOG_FILE for detailed results."
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    elif [[ $FAILED_TESTS -le 3 ]]; then
        exit 1
    else
        exit 2
    fi
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Verification interrupted. Check ${LOG_FILE} for details.${NC}"' INT TERM

# Run main verification
main "$@"