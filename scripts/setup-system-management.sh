#!/bin/bash
#
# Argos System Management Setup Script
# Sets up comprehensive system monitoring and management for Raspberry Pi deployments
#
# This script:
# - Copies management scripts to /usr/local/bin
# - Creates systemd services for monitoring
# - Sets up cron jobs for periodic tasks  
# - Configures logging and rotation
# - Tests all components
#

set -e

# Configuration
ARGOS_DIR="/home/pi/projects/Argos"
SCRIPTS_DIR="${ARGOS_DIR}/scripts"
BIN_DIR="/usr/local/bin"
SYSTEMD_DIR="/etc/systemd/system"
LOG_DIR="/var/log/argos"
CONFIG_DIR="/etc/argos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Use your regular user account with sudo access."
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log "This script requires sudo privileges. You may be prompted for your password."
        sudo -v || error "Failed to obtain sudo privileges"
    fi
    
    # Check if scripts exist
    local required_scripts=(
        "argos-wifi-resilience.sh"
        "argos-cpu-protector.sh" 
        "argos-keepalive.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "${SCRIPTS_DIR}/${script}" ]]; then
            error "Required script not found: ${SCRIPTS_DIR}/${script}"
        fi
    done
    
    log "Prerequisites check passed"
}

create_directories() {
    log "Creating system directories..."
    
    sudo mkdir -p "$LOG_DIR"
    sudo mkdir -p "$CONFIG_DIR"
    sudo chown pi:pi "$LOG_DIR"
    sudo chown pi:pi "$CONFIG_DIR"
    
    log "Directories created successfully"
}

install_scripts() {
    log "Installing management scripts to $BIN_DIR..."
    
    # Copy scripts to system bin directory
    sudo cp "${SCRIPTS_DIR}/argos-wifi-resilience.sh" "${BIN_DIR}/"
    sudo cp "${SCRIPTS_DIR}/argos-cpu-protector.sh" "${BIN_DIR}/"
    sudo cp "${SCRIPTS_DIR}/argos-keepalive.sh" "${BIN_DIR}/"
    
    # Make them executable
    sudo chmod +x "${BIN_DIR}/argos-wifi-resilience.sh"
    sudo chmod +x "${BIN_DIR}/argos-cpu-protector.sh"
    sudo chmod +x "${BIN_DIR}/argos-keepalive.sh"
    
    log "Scripts installed successfully"
}

install_systemd_services() {
    log "Installing systemd services..."
    
    # Copy service files
    sudo cp "${ARGOS_DIR}/deployment/argos-wifi-resilience.service" "${SYSTEMD_DIR}/"
    sudo cp "${ARGOS_DIR}/deployment/argos-cpu-protector.service" "${SYSTEMD_DIR}/"
    
    # Create process manager service if it doesn't exist
    if [[ ! -f "${SYSTEMD_DIR}/argos-process-manager.service" ]]; then
        sudo tee "${SYSTEMD_DIR}/argos-process-manager.service" > /dev/null << 'EOF'
[Unit]
Description=Argos Process Manager
Documentation=https://github.com/yourusername/Argos
After=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/projects/Argos
ExecStart=/usr/local/bin/argos-keepalive.sh --daemon
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=argos-process-manager
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    log "Systemd services installed"
}

enable_services() {
    log "Enabling and starting system management services..."
    
    # Enable services
    sudo systemctl enable argos-wifi-resilience.service || warn "Failed to enable argos-wifi-resilience.service"
    sudo systemctl enable argos-cpu-protector.service || warn "Failed to enable argos-cpu-protector.service"
    sudo systemctl enable argos-process-manager.service || warn "Failed to enable argos-process-manager.service"
    
    # Start services
    sudo systemctl start argos-wifi-resilience.service || warn "Failed to start argos-wifi-resilience.service"
    sudo systemctl start argos-cpu-protector.service || warn "Failed to start argos-cpu-protector.service"
    sudo systemctl start argos-process-manager.service || warn "Failed to start argos-process-manager.service"
    
    log "Services enabled and started"
}

setup_log_rotation() {
    log "Setting up log rotation..."
    
    sudo tee "/etc/logrotate.d/argos" > /dev/null << 'EOF'
/var/log/argos/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 pi pi
    postrotate
        systemctl reload-or-restart argos-wifi-resilience.service || true
        systemctl reload-or-restart argos-cpu-protector.service || true
        systemctl reload-or-restart argos-process-manager.service || true
    endscript
}
EOF
    
    log "Log rotation configured"
}

create_wifi_config() {
    log "Creating WiFi resilience configuration..."
    
    if [[ ! -f "${CONFIG_DIR}/wifi-resilience.conf" ]]; then
        "${BIN_DIR}/argos-wifi-resilience.sh" config || warn "Failed to create WiFi config"
        log "WiFi configuration created at ${CONFIG_DIR}/wifi-resilience.conf"
        log "Please edit this file with your WiFi credentials"
    else
        log "WiFi configuration already exists"
    fi
}

test_services() {
    log "Testing system management services..."
    
    # Test script execution
    local test_results=()
    
    # Test WiFi resilience
    if "${BIN_DIR}/argos-wifi-resilience.sh" status &>/dev/null; then
        test_results+=("WiFi Resilience: [OK]")
    else
        test_results+=("WiFi Resilience: [FAIL]")
    fi
    
    # Test CPU protector
    if "${BIN_DIR}/argos-cpu-protector.sh" --help &>/dev/null; then
        test_results+=("CPU Protector: [OK]")
    else
        test_results+=("CPU Protector: [FAIL]")
    fi
    
    # Test service status
    local services=("argos-wifi-resilience" "argos-cpu-protector" "argos-process-manager")
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "${service}.service"; then
            test_results+=("${service} service: [OK]")
        else
            test_results+=("${service} service: [FAIL]")
        fi
    done
    
    echo
    echo -e "${BLUE}=== Test Results ===${NC}"
    for result in "${test_results[@]}"; do
        echo -e "  $result"
    done
    echo
}

print_summary() {
    echo
    echo -e "${GREEN}===============================================================================${NC}"
    echo -e "${GREEN}Argos System Management Setup Complete!${NC}"
    echo -e "${GREEN}===============================================================================${NC}"
    echo
    echo -e "${BLUE}Installed Components:${NC}"
    echo -e "  • WiFi Resilience Manager    - Ensures WiFi connectivity"
    echo -e "  • CPU Protection Monitor     - Kills runaway processes (>140% CPU)"
    echo -e "  • Process Keepalive Manager  - Monitors and restarts critical processes"
    echo
    echo -e "${BLUE}Service Status:${NC}"
    systemctl --no-pager status argos-wifi-resilience.service | grep "Active:" || echo "  argos-wifi-resilience: Not running"
    systemctl --no-pager status argos-cpu-protector.service | grep "Active:" || echo "  argos-cpu-protector: Not running"
    systemctl --no-pager status argos-process-manager.service | grep "Active:" || echo "  argos-process-manager: Not running"
    echo
    echo -e "${BLUE}Configuration:${NC}"
    echo -e "  • WiFi Config: ${YELLOW}${CONFIG_DIR}/wifi-resilience.conf${NC}"
    echo -e "  • Log Directory: ${YELLOW}${LOG_DIR}/${NC}"
    echo -e "  • Scripts Location: ${YELLOW}${BIN_DIR}/${NC}"
    echo
    echo -e "${BLUE}Management Commands:${NC}"
    echo -e "  • Check service status: ${YELLOW}systemctl status argos-*${NC}"
    echo -e "  • View logs: ${YELLOW}journalctl -u argos-wifi-resilience -f${NC}"
    echo -e "  • Manual WiFi test: ${YELLOW}argos-wifi-resilience.sh status${NC}"
    echo -e "  • View system logs: ${YELLOW}tail -f ${LOG_DIR}/*.log${NC}"
    echo
    echo -e "${GREEN}Your Raspberry Pi now has comprehensive system monitoring and management!${NC}"
    echo
}

main() {
    echo -e "${BLUE}===============================================================================${NC}"
    echo -e "${BLUE}Argos System Management Setup${NC}"
    echo -e "${BLUE}===============================================================================${NC}"
    echo
    
    check_prerequisites
    create_directories
    install_scripts
    install_systemd_services
    enable_services
    setup_log_rotation
    create_wifi_config
    test_services
    print_summary
    
    log "System management setup completed successfully!"
}

# Error handling
trap 'error "Script interrupted"' INT TERM

# Run main function
main "$@"