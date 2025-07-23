#!/bin/bash
#
# Dragon OS Deployment Script for Argos
# Universal deployment script that works on ANY Dragon OS system
# Automatically detects user, paths, and system configuration
#
# Usage: bash deploy-dragon-os.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Auto-detect system configuration
CURRENT_USER=$(whoami)
CURRENT_HOME=$(eval echo ~$CURRENT_USER)
INSTALL_DIR="${CURRENT_HOME}/projects"
PROJECT_DIR="${INSTALL_DIR}/Argos"
LOG_FILE="${INSTALL_DIR}/argos-dragon-deploy.log"

# Dragon OS detection
DRAGON_OS_DETECTED=false
NODE_VERSION="20"
OPENWEBRX_PORT="8073"
ARGOS_PORT="5173"

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
    exit 1
}

detect_dragon_os() {
    log "Detecting Dragon OS..."
    
    # Check for Dragon OS specific markers
    if grep -q -i "dragonos" /etc/os-release 2>/dev/null; then
        DRAGON_OS_DETECTED=true
        log "Dragon OS detected!"
    elif command -v hackrf_info &> /dev/null && command -v gqrx &> /dev/null; then
        DRAGON_OS_DETECTED=true
        log "Dragon OS detected (SDR tools present)"
    else
        log "Standard Debian/Ubuntu detected"
    fi
    
    log "Current user: $CURRENT_USER"
    log "Home directory: $CURRENT_HOME"
    log "Project directory: $PROJECT_DIR"
}

check_system_compatibility() {
    log "Checking system compatibility..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        error "Unsupported operating system"
    fi
    
    . /etc/os-release
    case "$ID" in
        ubuntu|debian|raspbian)
            log "Compatible OS detected: $PRETTY_NAME"
            ;;
        *)
            log "Unknown OS: $PRETTY_NAME - attempting Debian-compatible installation"
            ;;
    esac
    
    # Check architecture
    ARCH=$(uname -m)
    log "Architecture: $ARCH"
    
    # Check available space (minimum 3GB for Dragon OS)
    AVAILABLE_SPACE=$(df / | awk 'NR==2{print $4}')
    if [[ $AVAILABLE_SPACE -lt 3145728 ]]; then
        error "Insufficient disk space. At least 3GB required for Dragon OS deployment."
    fi
    
    # Check memory
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [[ $TOTAL_MEM -lt 2048 ]]; then
        warn "Low memory detected ($TOTAL_MEM MB). 4GB+ recommended for Dragon OS."
    fi
}

install_base_dependencies() {
    log "Installing base dependencies..."
    
    # Update package list
    sudo apt update || error "Failed to update package list"
    
    # Install essential packages (skip if already present in Dragon OS)
    local packages=(
        "curl"
        "wget"
        "git"
        "build-essential"
        "cmake"
        "pkg-config"
        "python3"
        "python3-pip"
        "python3-venv"
        "software-properties-common"
        "apt-transport-https"
        "ca-certificates"
        "gnupg"
        "lsb-release"
        "ufw"
        "htop"
        "unzip"
        "jq"
        "screen"
        "tmux"
    )
    
    log "Installing essential packages..."
    sudo apt install -y "${packages[@]}" || error "Failed to install essential packages"
    
    # Dragon OS specific: Skip SDR tools installation if already present
    if [[ "$DRAGON_OS_DETECTED" == "true" ]]; then
        log "Dragon OS detected - skipping SDR tools installation (already present)"
    else
        log "Installing SDR tools..."
        sudo apt install -y hackrf libhackrf-dev libhackrf0 libusb-1.0-0-dev libfftw3-dev || warn "Some SDR tools failed to install"
    fi
}

install_nodejs() {
    log "Installing Node.js ${NODE_VERSION}..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        local current_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $current_version -ge $NODE_VERSION ]]; then
            log "Node.js ${current_version} already installed"
            return 0
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs || error "Failed to install Node.js"
    
    # Verify installation
    local installed_version=$(node -v)
    log "Node.js ${installed_version} installed successfully"
}

install_docker() {
    log "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log "Docker already installed"
        return 0
    fi
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh || error "Failed to install Docker"
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $CURRENT_USER
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log "Docker installed successfully"
}

setup_project_directory() {
    log "Setting up project directory..."
    
    # Create directory structure
    mkdir -p "${INSTALL_DIR}"
    mkdir -p "${PROJECT_DIR}"
    mkdir -p "${INSTALL_DIR}/logs"
    mkdir -p "${INSTALL_DIR}/backup"
    
    # Ensure current directory is the project root
    if [[ ! -f "${PROJECT_DIR}/package.json" ]]; then
        error "Project not found at ${PROJECT_DIR}. Please copy the Argos project first."
    fi
    
    cd "${PROJECT_DIR}"
    log "Project directory ready at ${PROJECT_DIR}"
}

configure_hardware_permissions() {
    log "Configuring hardware permissions..."
    
    # HackRF permissions
    sudo tee /etc/udev/rules.d/53-hackrf.rules > /dev/null <<'EOF'
# HackRF One
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# HackRF Jawbreaker
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# HackRF One (bootloader)
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
EOF

    # GPS device permissions
    sudo tee /etc/udev/rules.d/99-gps.rules > /dev/null <<'EOF'
# GPS devices
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", SYMLINK+="gps0", GROUP="dialout", MODE="0666"
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", SYMLINK+="gps0", GROUP="dialout", MODE="0666"
EOF

    # WiFi adapter permissions
    sudo tee /etc/udev/rules.d/99-wifi.rules > /dev/null <<'EOF'
# MediaTek WiFi adapters
SUBSYSTEM=="usb", ATTR{idVendor}=="0e8d", ATTR{idProduct}=="7612", MODE="0666", GROUP="plugdev"
EOF

    # Coral TPU permissions
    sudo tee /etc/udev/rules.d/99-coral.rules > /dev/null <<'EOF'
# Coral TPU
SUBSYSTEM=="usb", ATTR{idVendor}=="1a6e", MODE="0666", GROUP="plugdev"
EOF

    # Reload udev rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger
    
    # Add current user to required groups
    sudo usermod -aG plugdev,dialout,docker $CURRENT_USER
    
    log "Hardware permissions configured for user: $CURRENT_USER"
}

build_native_components() {
    log "Building native components..."
    
    cd "${PROJECT_DIR}"
    
    # Build kalibrate-hackrf
    if [[ -d "tools/kalibrate-hackrf" ]]; then
        log "Building kalibrate-hackrf..."
        cd tools/kalibrate-hackrf
        make clean || true
        make || warn "kalibrate-hackrf build failed"
        cd "${PROJECT_DIR}"
    fi
    
    # Install Node.js dependencies and rebuild native modules
    log "Installing Node.js dependencies..."
    npm install --no-optional || error "Failed to install Node.js dependencies"
    
    # Rebuild native modules for current architecture
    log "Rebuilding native modules..."
    npm rebuild || warn "Some native modules failed to rebuild"
    
    log "Native components built successfully"
}

install_docker_images() {
    log "Installing Docker images..."
    
    # Check if OpenWebRX image exists
    local image_file="${PROJECT_DIR}/docker-images/openwebrx-hackrf-only-v2.tar"
    
    if [[ -f "$image_file" ]]; then
        log "Loading OpenWebRX container from local image..."
        sudo docker load < "$image_file" || error "Failed to load Docker image"
    else
        warn "OpenWebRX Docker image not found. Building from source..."
        if [[ -f "${PROJECT_DIR}/docker/Dockerfile" ]]; then
            cd "${PROJECT_DIR}/docker"
            sudo docker build -t openwebrx-hackrf:latest . || error "Failed to build Docker image"
            cd "${PROJECT_DIR}"
        else
            warn "No Docker configuration found. OpenWebRX features may not work."
        fi
    fi
}

configure_environment() {
    log "Configuring environment..."
    
    cd "${PROJECT_DIR}"
    
    # Create environment file
    if [[ -f "config/.env.example" ]]; then
        cp "config/.env.example" ".env"
        log "Environment file created"
    else
        # Create basic .env file
        cat > .env <<EOF
# Argos Configuration
NODE_ENV=production
PORT=${ARGOS_PORT}
OPENWEBRX_PORT=${OPENWEBRX_PORT}
PUBLIC_OPENWEBRX_URL=http://localhost:${OPENWEBRX_PORT}
PROJECT_ROOT=${PROJECT_DIR}
USER=${CURRENT_USER}
EOF
        log "Basic environment file created"
    fi
    
    # Update paths in environment file
    sed -i "s|/home/pi|${CURRENT_HOME}|g" .env
    sed -i "s|USER=pi|USER=${CURRENT_USER}|g" .env
    
    # Build the application
    log "Building application..."
    npm run build || error "Failed to build application"
}

create_systemd_services() {
    log "Creating systemd services..."
    
    # Create Argos service
    sudo tee /etc/systemd/system/argos.service > /dev/null <<EOF
[Unit]
Description=Argos SDR Console
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${ARGOS_PORT}
Environment=USER=${CURRENT_USER}

[Install]
WantedBy=multi-user.target
EOF

    # Create OpenWebRX service (if not using Docker)
    if [[ "$DRAGON_OS_DETECTED" == "true" ]]; then
        sudo tee /etc/systemd/system/argos-openwebrx.service > /dev/null <<EOF
[Unit]
Description=Argos OpenWebRX Integration
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/openwebrx --port ${OPENWEBRX_PORT}
Restart=always
RestartSec=10
Environment=USER=${CURRENT_USER}

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    # Reload systemd
    sudo systemctl daemon-reload
    sudo systemctl enable argos.service
    
    log "Systemd services created"
}

configure_firewall() {
    log "Configuring firewall..."
    
    # Enable UFW if not already enabled
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow Argos ports
    sudo ufw allow ${ARGOS_PORT}/tcp
    sudo ufw allow ${OPENWEBRX_PORT}/tcp
    sudo ufw allow 3002/tcp  # HackRF Sweep
    sudo ufw allow 8000/tcp  # WigleToTAK
    sudo ufw allow 2501/tcp  # Kismet
    
    log "Firewall configured"
}

start_services() {
    log "Starting services..."
    
    # Start Docker containers if available
    if [[ -f "${PROJECT_DIR}/docker-compose.yml" ]]; then
        cd "${PROJECT_DIR}"
        if [[ -f "scripts/docker-automation.sh" ]]; then
            bash "scripts/docker-automation.sh" || warn "Docker automation had issues"
        else
            sudo docker-compose up -d || warn "Failed to start Docker containers"
        fi
    fi
    
    # Start Argos service
    sudo systemctl start argos.service || warn "Failed to start Argos service"
    
    # Wait for services to start
    sleep 10
    
    log "Services started"
}

verify_deployment() {
    log "Verifying deployment..."
    
    local errors=0
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        warn "Node.js not found"
        ((errors++))
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        warn "Docker not found"
        ((errors++))
    fi
    
    # Check HackRF
    if ! command -v hackrf_info &> /dev/null; then
        warn "HackRF tools not found"
        ((errors++))
    fi
    
    # Check Argos service
    if ! systemctl is-active --quiet argos.service; then
        warn "Argos service not running"
        ((errors++))
    fi
    
    # Check web interface
    if ! curl -s "http://localhost:${ARGOS_PORT}" > /dev/null; then
        warn "Argos web interface not accessible"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        log "Deployment verification successful!"
        return 0
    else
        warn "Deployment verification found $errors issues"
        return 1
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Argos Dragon OS Deployment Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}System Information:${NC}"
    echo -e "  • User: ${YELLOW}${CURRENT_USER}${NC}"
    echo -e "  • Dragon OS: ${YELLOW}${DRAGON_OS_DETECTED}${NC}"
    echo -e "  • Project Path: ${YELLOW}${PROJECT_DIR}${NC}"
    echo ""
    echo -e "${BLUE}Access Points:${NC}"
    echo -e "  • Main Console: ${YELLOW}http://localhost:${ARGOS_PORT}${NC}"
    echo -e "  • OpenWebRX: ${YELLOW}http://localhost:${OPENWEBRX_PORT}${NC}"
    echo ""
    echo -e "${BLUE}Service Management:${NC}"
    echo -e "  • Start: ${YELLOW}sudo systemctl start argos${NC}"
    echo -e "  • Stop: ${YELLOW}sudo systemctl stop argos${NC}"
    echo -e "  • Status: ${YELLOW}sudo systemctl status argos${NC}"
    echo -e "  • Logs: ${YELLOW}sudo journalctl -u argos -f${NC}"
    echo ""
    echo -e "${BLUE}Hardware Status:${NC}"
    echo -e "  • HackRF: ${YELLOW}hackrf_info${NC}"
    echo -e "  • GPS: ${YELLOW}ls -la /dev/gps*${NC}"
    echo -e "  • WiFi: ${YELLOW}iwconfig${NC}"
    echo ""
    echo -e "${GREEN}Ready for SDR operations on Dragon OS!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: You may need to logout/reboot for group permissions to take effect${NC}"
    echo ""
}

#######################################################################################
# Main Deployment Process
#######################################################################################

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Dragon OS Universal Deployment${NC}"
    echo -e "${BLUE}# Compatible with any Dragon OS system and user configuration${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    # Ensure running as non-root user
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log "This script requires sudo privileges. You may be prompted for your password."
        sudo -v || error "Failed to obtain sudo privileges"
    fi
    
    # Create log file
    mkdir -p "$(dirname "${LOG_FILE}")"
    touch "${LOG_FILE}"
    
    log "Starting Argos Dragon OS deployment..."
    
    # Deployment steps
    detect_dragon_os
    check_system_compatibility
    install_base_dependencies
    install_nodejs
    install_docker
    setup_project_directory
    configure_hardware_permissions
    build_native_components
    install_docker_images
    configure_environment
    create_systemd_services
    configure_firewall
    start_services
    
    # Verify deployment
    if verify_deployment; then
        print_summary
        log "Deployment completed successfully!"
    else
        warn "Deployment completed with warnings. Check the log file for details."
        print_summary
    fi
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Deployment interrupted. Check ${LOG_FILE} for details.${NC}"' INT TERM

# Run main deployment
main "$@"