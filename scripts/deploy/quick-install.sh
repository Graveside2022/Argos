#!/bin/bash

#######################################################################################
# Argos One-Click Installer
# Professional deployment script for Raspberry Pi and Debian/Ubuntu systems
# Usage: curl -sSL https://raw.githubusercontent.com/Graveside2022/Argos/main/quick-install.sh | bash
#######################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://raw.githubusercontent.com/Graveside2022/Argos/main"
INSTALL_SCRIPT_URL="${REPO_URL}/install.sh"
MANAGEMENT_SCRIPT_URL="${REPO_URL}/scripts/install-management.sh"
TEMP_DIR="/tmp/argos-quick-install"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

check_requirements() {
    log "Checking system requirements..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log "This script requires sudo privileges. You may be prompted for your password."
        sudo -v || error "Failed to obtain sudo privileges"
    fi
    
    # Check internet connectivity
    if ! ping -c 1 github.com &> /dev/null; then
        error "Internet connection required. Please check your network connection."
    fi
    
    # Check available tools
    local required_tools=("curl" "bash" "whoami")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "Installing required tool: $tool"
            sudo apt update &> /dev/null
            sudo apt install -y "$tool" &> /dev/null || error "Failed to install $tool"
        fi
    done
    
    log "System requirements satisfied"
}

setup_workspace() {
    log "Setting up installation workspace..."
    
    # Create temporary directory
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Ensure project directory exists
    mkdir -p "/home/$(whoami)/project"
    
    log "Workspace prepared"
}

download_and_run_installer() {
    log "Downloading and executing main installer..."
    
    # Download the main installer
    curl -sSL "$INSTALL_SCRIPT_URL" -o install.sh || error "Failed to download main installer"
    
    # Make executable
    chmod +x install.sh
    
    # Execute main installer
    log "Starting comprehensive installation process..."
    bash install.sh || error "Main installation failed"
    
    log "Main installation completed successfully"
}

install_management_scripts() {
    log "Installing system management and monitoring scripts..."
    
    # Download and run management installer
    curl -sSL "$MANAGEMENT_SCRIPT_URL" | bash || warn "Management scripts installation had issues"
    
    log "Management scripts installation completed"
}

verify_installation() {
    log "Performing final verification..."
    
    local project_dir="/home/$(whoami)/projects/Argos"
    local errors=0
    
    # Check if project directory exists
    if [[ ! -d "$project_dir" ]]; then
        warn "Project directory not found"
        ((errors++))
    fi
    
    # Check if Argos service is running
    if ! systemctl is-active --quiet argos.service; then
        warn "Argos service is not running"
        ((errors++))
    fi
    
    # Check if Docker is running
    if ! sudo docker ps &> /dev/null; then
        warn "Docker not running properly"
        ((errors++))
    fi
    
    # Check web interfaces
    local ports=("5173" "8073")
    for port in "${ports[@]}"; do
        if ! curl -s --connect-timeout 5 "http://localhost:$port" > /dev/null; then
            warn "Service on port $port not accessible"
            ((errors++))
        fi
    done
    
    if [[ $errors -eq 0 ]]; then
        log "Installation verification successful"
        return 0
    else
        warn "Installation verification found $errors issues"
        return 1
    fi
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
}

print_final_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# [DONE] Argos Installation Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}[NET] Access Your Argos System:${NC}"
    echo -e "  • Main Console:      ${YELLOW}http://localhost:5173${NC}"
    echo -e "  • Spectrum Analyzer: ${YELLOW}http://localhost:8073${NC} (admin/<from OPENWEBRX_PASSWORD env var>)"
    echo -e "  • Project Location:  ${YELLOW}/home/$(whoami)/projects/Argos${NC}"
    echo ""
    echo -e "${BLUE}[FIX] System Management:${NC}"
    echo -e "  • Start Services:    ${YELLOW}sudo systemctl start argos${NC}"
    echo -e "  • Stop Services:     ${YELLOW}sudo systemctl stop argos${NC}"
    echo -e "  • View Logs:         ${YELLOW}sudo journalctl -u argos -f${NC}"
    echo -e "  • System Status:     ${YELLOW}sudo systemctl status argos${NC}"
    echo ""
    echo -e "${BLUE}[AUTO] Automated Management:${NC}"
    echo -e "  • Process monitoring and CPU protection (every 5 minutes)"
    echo -e "  • Network connectivity monitoring and auto-recovery"
    echo -e "  • Container health checks and restart automation"
    echo -e "  • System resource optimization and cleanup"
    echo ""
    echo -e "${BLUE}[RF] Ready for Professional RF Analysis!${NC}"
    echo -e "  • HackRF SDR integration enabled"
    echo -e "  • Kismet WiFi monitoring ready"
    echo -e "  • OpenWebRX spectrum analysis active"
    echo -e "  • TAK tactical messaging configured"
    echo ""
    echo -e "${GREEN}Your Argos system is now fully operational and professionally managed!${NC}"
    echo ""
}

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# [START] Argos One-Click Professional Installer${NC}"
    echo -e "${BLUE}# Complete SDR and RF Analysis Platform for Raspberry Pi${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    echo -e "${YELLOW}This installer will:${NC}"
    echo -e "  [OK] Install all system dependencies (Node.js, Docker, etc.)"
    echo -e "  [OK] Set up complete Argos application with HackRF support"
    echo -e "  [OK] Configure Docker containers for OpenWebRX spectrum analysis"
    echo -e "  [OK] Install automated monitoring and management scripts"
    echo -e "  [OK] Configure firewall and security settings"
    echo -e "  [OK] Set up systemd services for automatic startup"
    echo ""
    echo -e "${YELLOW}Installation requires sudo privileges and will take 5-10 minutes.${NC}"
    echo ""
    
    # Trap for cleanup
    trap cleanup EXIT
    
    # Installation process
    check_requirements
    setup_workspace
    download_and_run_installer
    install_management_scripts
    
    # Final verification and summary
    if verify_installation; then
        print_final_summary
        log "[DONE] Argos installation completed successfully!"
    else
        warn "Installation completed with some issues. Your system should still be functional."
        print_final_summary
        warn "Check system logs if you experience any issues: sudo journalctl -u argos"
    fi
}

# Run main installation
main "$@"