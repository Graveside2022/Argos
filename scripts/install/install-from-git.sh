#!/bin/bash
#
# Argos Git-Clone Installation Script
# Complete installation from fresh git clone to working system
# Designed for Dragon OS - works on any Debian/Ubuntu system
#
# Usage: git clone repo && cd Argos && bash install-from-git.sh
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
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/install-from-git.log"

# Configuration
DRAGON_OS_DETECTED=false
NODE_VERSION="20"
OPENWEBRX_PORT="8073"
ARGOS_PORT="5173"
DOCKER_IMAGE_URL="https://github.com/Graveside2022/Argos/releases/download/v1.0/openwebrx-hackrf-only-v2.tar"

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

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "${LOG_FILE}"
}

print_banner() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Git-Clone Installation${NC}"
    echo -e "${BLUE}# From fresh git clone to complete working system${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
}

print_pre_install_info() {
    echo -e "${BLUE}Installation Information:${NC}"
    echo -e "  • Current User: ${YELLOW}${CURRENT_USER}${NC}"
    echo -e "  • Project Directory: ${YELLOW}${PROJECT_DIR}${NC}"
    echo -e "  • Log File: ${YELLOW}${LOG_FILE}${NC}"
    echo ""
    echo -e "${BLUE}What will be installed:${NC}"
    echo -e "  • System dependencies (Node.js, Docker, SDR tools)"
    echo -e "  • Hardware permissions (HackRF, GPS, WiFi)"
    echo -e "  • Project dependencies (npm packages)"
    echo -e "  • Systemd services"
    echo -e "  • Firewall configuration"
    echo ""
    echo -e "${YELLOW}Items requiring manual setup:${NC}"
    echo -e "  • OpenCellID API key (setup wizard will run)"
    echo -e "  • Docker image (download instructions provided)"
    echo -e "  • Cell tower CSV (optional, for offline use)"
    echo ""
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
}

#######################################################################################
# Detection Functions
#######################################################################################

detect_system() {
    log "Detecting system configuration..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        error "Unsupported operating system"
    fi
    
    . /etc/os-release
    log "OS: $PRETTY_NAME"
    
    # Check for Dragon OS
    if grep -q -i "dragonos" /etc/os-release 2>/dev/null; then
        DRAGON_OS_DETECTED=true
        log "Dragon OS detected!"
    elif command -v hackrf_info &> /dev/null && command -v gqrx &> /dev/null; then
        DRAGON_OS_DETECTED=true
        log "Dragon OS detected (SDR tools present)"
    else
        log "Standard Debian/Ubuntu system detected"
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    log "Architecture: $ARCH"
    
    # Check available space (minimum 3GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2{print $4}')
    if [[ $AVAILABLE_SPACE -lt 3145728 ]]; then
        error "Insufficient disk space. At least 3GB required."
    fi
    
    # Check memory
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [[ $TOTAL_MEM -lt 2048 ]]; then
        warn "Low memory detected ($TOTAL_MEM MB). 4GB+ recommended."
    fi
    
    log "System detection complete"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Ensure running as non-root user
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Please run as a regular user with sudo privileges."
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log "This script requires sudo privileges. You may be prompted for your password."
        sudo -v || error "Failed to obtain sudo privileges"
    fi
    
    # Check internet connectivity
    if ! ping -c 1 google.com &> /dev/null; then
        error "No internet connection available. Required for downloading dependencies."
    fi
    
    # Check git (should be available if user got here)
    if ! command -v git &> /dev/null; then
        error "Git not found. How did you clone the repository?"
    fi
    
    log "Prerequisites check complete"
}

#######################################################################################
# Installation Functions
#######################################################################################

install_system_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt update || error "Failed to update package list"
    
    # Install essential packages
    local packages=(
        "curl" "wget" "git" "build-essential" "cmake" "pkg-config"
        "python3" "python3-pip" "python3-venv" "python3-dev"
        "software-properties-common" "apt-transport-https" "ca-certificates"
        "gnupg" "lsb-release" "ufw" "htop" "unzip" "jq" "screen" "tmux"
        "libusb-1.0-0-dev" "libfftw3-dev" "libsoapysdr-dev" "soapysdr-tools"
    )
    
    log "Installing essential packages..."
    sudo apt install -y "${packages[@]}" || error "Failed to install essential packages"
    
    # Install SDR tools if not on Dragon OS
    if [[ "$DRAGON_OS_DETECTED" == "true" ]]; then
        log "Dragon OS detected - SDR tools already available"
    else
        log "Installing SDR tools..."
        sudo apt install -y hackrf libhackrf-dev libhackrf0 gnuradio gr-osmosdr || warn "Some SDR tools failed to install"
    fi
    
    success "System dependencies installed"
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
    
    success "Node.js installation complete"
}

install_docker() {
    log "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log "Docker already installed"
        return 0
    fi
    
    # Install Docker using convenience script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh || error "Failed to install Docker"
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $CURRENT_USER
    
    # Enable and start Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    success "Docker installation complete"
}

configure_hardware_permissions() {
    log "Configuring hardware permissions..."
    
    # HackRF permissions
    sudo tee /etc/udev/rules.d/53-hackrf.rules > /dev/null <<'EOF'
# HackRF One
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
    
    success "Hardware permissions configured"
}

install_project_dependencies() {
    log "Installing project dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Install Node.js dependencies
    log "Installing npm packages..."
    npm install --no-optional || error "Failed to install npm dependencies"
    
    # Rebuild native modules for current architecture
    log "Rebuilding native modules..."
    npm rebuild || warn "Some native modules failed to rebuild"
    
    # Build kalibrate-hackrf if present
    if [[ -d "tools/kalibrate-hackrf" ]]; then
        log "Building kalibrate-hackrf..."
        cd tools/kalibrate-hackrf
        make clean || true
        make || warn "kalibrate-hackrf build failed"
        cd "$PROJECT_DIR"
    fi
    
    success "Project dependencies installed"
}

setup_environment() {
    log "Setting up environment..."
    
    cd "$PROJECT_DIR"
    
    # Create environment file
    cat > .env <<EOF
# Argos Environment Configuration (Auto-generated)
NODE_ENV=production
PORT=${ARGOS_PORT}
OPENWEBRX_PORT=${OPENWEBRX_PORT}
PUBLIC_OPENWEBRX_URL=http://localhost:${OPENWEBRX_PORT}
PROJECT_ROOT=${PROJECT_DIR}
USER=${CURRENT_USER}
DRAGON_OS_DETECTED=${DRAGON_OS_DETECTED}
EOF
    
    # Build the application
    log "Building application..."
    npm run build || error "Failed to build application"
    
    success "Environment setup complete"
}

setup_systemd_services() {
    log "Setting up systemd services..."
    
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

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable argos.service
    
    success "Systemd services configured"
}

configure_firewall() {
    log "Configuring firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow Argos ports
    sudo ufw allow ${ARGOS_PORT}/tcp
    sudo ufw allow ${OPENWEBRX_PORT}/tcp
    sudo ufw allow 3002/tcp  # HackRF Sweep
    sudo ufw allow 8000/tcp  # WigleToTAK
    sudo ufw allow 2501/tcp  # Kismet
    
    success "Firewall configured"
}

handle_docker_image() {
    log "Handling Docker image..."
    
    local image_file="${PROJECT_DIR}/docker-images/openwebrx-hackrf-only-v2.tar"
    
    if [[ -f "$image_file" ]]; then
        log "Loading OpenWebRX container from local image..."
        sudo docker load < "$image_file" || error "Failed to load Docker image"
        success "Docker image loaded successfully"
    else
        warn "Docker image not found locally"
        echo ""
        echo -e "${YELLOW}Docker Image Setup Required:${NC}"
        echo -e "The OpenWebRX Docker image is not included in the repository."
        echo -e "You have a few options:"
        echo ""
        echo -e "1. Download from releases:"
        echo -e "   ${BLUE}wget ${DOCKER_IMAGE_URL}${NC}"
        echo -e "   ${BLUE}mkdir -p docker-images && mv openwebrx-hackrf-only-v2.tar docker-images/${NC}"
        echo ""
        echo -e "2. Build from source (if Dockerfile exists):"
        echo -e "   ${BLUE}sudo docker build -t openwebrx-hackrf:latest docker/${NC}"
        echo ""
        echo -e "3. Skip for now (OpenWebRX features will be disabled)"
        echo ""
        
        read -p "Choose option (1/2/3): " -n 1 -r
        echo
        
        case $REPLY in
            1)
                log "Downloading Docker image..."
                wget -O docker-images/openwebrx-hackrf-only-v2.tar "$DOCKER_IMAGE_URL" || warn "Download failed"
                if [[ -f "docker-images/openwebrx-hackrf-only-v2.tar" ]]; then
                    sudo docker load < docker-images/openwebrx-hackrf-only-v2.tar
                    success "Docker image downloaded and loaded"
                fi
                ;;
            2)
                if [[ -f "docker/Dockerfile" ]]; then
                    log "Building Docker image from source..."
                    sudo docker build -t openwebrx-hackrf:latest docker/ || warn "Docker build failed"
                else
                    warn "Dockerfile not found in docker/ directory"
                fi
                ;;
            3)
                warn "Skipping Docker image setup"
                ;;
            *)
                warn "Invalid choice, skipping Docker image setup"
                ;;
        esac
    fi
}

run_opencellid_setup() {
    log "Running OpenCellID setup wizard..."
    
    # Check if config already exists
    if [[ -f "${PROJECT_DIR}/config/opencellid.json" ]]; then
        log "OpenCellID configuration already exists"
        read -p "Update existing configuration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi
    
    echo ""
    echo -e "${BLUE}OpenCellID API Setup${NC}"
    echo -e "To use cell tower lookup features, you need an OpenCellID API key."
    echo -e "Get one free at: ${YELLOW}https://opencellid.org/register${NC}"
    echo ""
    
    read -p "Do you have an OpenCellID API key? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your OpenCellID API key: " api_key
        
        if [[ -n "$api_key" ]]; then
            # Create config directory
            mkdir -p "${PROJECT_DIR}/config"
            
            # Create OpenCellID config file
            cat > "${PROJECT_DIR}/config/opencellid.json" <<EOF
{
  "apiKey": "$api_key",
  "apiUrl": "https://opencellid.org/cell/get",
  "enabled": true,
  "cacheTimeout": 3600
}
EOF
            
            success "OpenCellID API key configured"
        else
            warn "Empty API key provided, skipping configuration"
        fi
    else
        warn "OpenCellID setup skipped - cell tower features will be limited"
        echo -e "You can run the setup wizard later: ${YELLOW}bash setup-opencellid.sh${NC}"
    fi
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
    
    success "Services started"
}

run_verification() {
    log "Running post-installation verification..."
    
    if [[ -f "${PROJECT_DIR}/verify-deployment.sh" ]]; then
        bash "${PROJECT_DIR}/verify-deployment.sh" || warn "Some verification tests failed"
    else
        # Basic verification
        local errors=0
        
        # Check Node.js
        if ! command -v node &> /dev/null; then
            warn "Node.js not found"
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
            success "Basic verification passed"
        else
            warn "Verification found $errors issues"
        fi
    fi
}

print_completion_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Argos Installation Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}System Information:${NC}"
    echo -e "  • User: ${YELLOW}${CURRENT_USER}${NC}"
    echo -e "  • Dragon OS: ${YELLOW}${DRAGON_OS_DETECTED}${NC}"
    echo -e "  • Project: ${YELLOW}${PROJECT_DIR}${NC}"
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
    echo -e "${BLUE}Hardware Commands:${NC}"
    echo -e "  • HackRF Info: ${YELLOW}hackrf_info${NC}"
    echo -e "  • GPS Status: ${YELLOW}ls -la /dev/gps*${NC}"
    echo -e "  • WiFi Status: ${YELLOW}iwconfig${NC}"
    echo ""
    echo -e "${BLUE}Configuration:${NC}"
    echo -e "  • Environment: ${YELLOW}${PROJECT_DIR}/.env${NC}"
    echo -e "  • OpenCellID: ${YELLOW}${PROJECT_DIR}/config/opencellid.json${NC}"
    echo -e "  • Logs: ${YELLOW}${LOG_FILE}${NC}"
    echo ""
    echo -e "${GREEN}🎉 Your Argos system is ready for SDR operations!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: You may need to logout/login for group permissions to take effect${NC}"
    echo -e "${YELLOW}⚠️  Connect your hardware (HackRF, GPS, WiFi adapter) and test functionality${NC}"
    echo ""
}

#######################################################################################
# Main Installation Process
#######################################################################################

main() {
    # Initialize
    print_banner
    touch "${LOG_FILE}"
    log "Starting Argos installation from git clone..."
    
    # Pre-installation
    detect_system
    check_prerequisites
    print_pre_install_info
    
    # Core installation
    install_system_dependencies
    install_nodejs
    install_docker
    configure_hardware_permissions
    install_project_dependencies
    setup_environment
    setup_systemd_services
    configure_firewall
    
    # Asset handling
    handle_docker_image
    run_opencellid_setup
    
    # Finalization
    start_services
    run_verification
    print_completion_summary
    
    success "Installation completed successfully!"
    log "Installation log saved to: ${LOG_FILE}"
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Installation interrupted. Check ${LOG_FILE} for details.${NC}"' INT TERM

# Run main installation
main "$@"