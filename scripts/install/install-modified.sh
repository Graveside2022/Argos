#!/bin/bash

#######################################################################################
# Argos Professional Installation Script
# One-click installation for Raspberry Pi and Debian/Ubuntu systems
# Creates complete working environment with all dependencies
#######################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/Graveside2022/Argos.git"
INSTALL_DIR="/home/$(whoami)/projects"
PROJECT_DIR="${INSTALL_DIR}/Argos"
LOG_FILE="${INSTALL_DIR}/argos-install.log"

# Docker image for HackRF
HACKRF_IMAGE="argos/hackrf:latest"
OPENWEBRX_PORT="8073"
ARGOS_PORT="5173"

# Node.js version
NODE_VERSION="18"

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

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

check_system() {
    log "Checking system compatibility..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        error "Unsupported operating system. This script requires Debian/Ubuntu or Raspberry Pi OS."
    fi
    
    . /etc/os-release
    case "$ID" in
        ubuntu|debian|raspbian)
            log "Detected compatible OS: $PRETTY_NAME"
            ;;
        *)
            error "Unsupported OS: $PRETTY_NAME. This script supports Ubuntu, Debian, and Raspberry Pi OS."
            ;;
    esac
    
    # Check architecture
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|aarch64|armv7l)
            log "Detected architecture: $ARCH"
            ;;
        *)
            warn "Untested architecture: $ARCH. Installation may fail."
            ;;
    esac
    
    # Check available space (minimum 2GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2{print $4}')
    if [[ $AVAILABLE_SPACE -lt 2097152 ]]; then
        error "Insufficient disk space. At least 2GB free space required."
    fi
    
    # Check memory (minimum 1GB)
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [[ $TOTAL_MEM -lt 1024 ]]; then
        warn "Low memory detected ($TOTAL_MEM MB). 2GB+ recommended for optimal performance."
    fi
}

create_directories() {
    log "Creating directory structure..."
    
    # Create project directory
    mkdir -p "${INSTALL_DIR}"
    mkdir -p "${PROJECT_DIR}"
    mkdir -p "${INSTALL_DIR}/logs"
    mkdir -p "${INSTALL_DIR}/backup"
    
    # Set proper permissions
    chmod 755 "${INSTALL_DIR}"
    chmod 755 "${PROJECT_DIR}"
    
    log "Created directory structure at ${PROJECT_DIR}"
}

install_system_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt update &> "${LOG_FILE}" || error "Failed to update package list"
    
    # Install essential packages
    local packages=(
        "curl"
        "wget" 
        "git"
        "build-essential"
        "python3"
        "python3-pip"
        "software-properties-common"
        "apt-transport-https"
        "ca-certificates"
        "gnupg"
        "lsb-release"
        "ufw"
        "htop"
        "unzip"
        "gpsd"
        "gpsd-clients"
        "python3-gps"
    )
    
    log "Installing essential packages..."
    sudo apt install -y "${packages[@]}" &> "${LOG_FILE}" || error "Failed to install essential packages"
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
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - &> "${LOG_FILE}"
    sudo apt install -y nodejs &> "${LOG_FILE}" || error "Failed to install Node.js"
    
    # Verify installation
    local installed_version=$(node -v)
    log "Node.js ${installed_version} installed successfully"
    
    # Install global npm packages
    log "Installing global npm packages..."
    sudo npm install -g pm2 &> "${LOG_FILE}" || warn "Failed to install PM2"
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
    sudo sh get-docker.sh &> "${LOG_FILE}" || error "Failed to install Docker"
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    log "Docker installed successfully"
}

clone_repository() {
    log "Using existing Argos repository..."
    
    # We already have the repository, just change to project directory
    cd "${PROJECT_DIR}"
    
    log "Repository ready"
}

install_hackrf_container() {
    log "Skipping HackRF Docker container setup for now..."
    warn "HackRF Docker container will need to be set up manually later"
    log "Continuing with installation..."
}

configure_environment() {
    log "Configuring environment..."
    
    # Copy environment file
    if [[ -f "${PROJECT_DIR}/config/.env.example" ]]; then
        cp "${PROJECT_DIR}/config/.env.example" "${PROJECT_DIR}/.env"
        log "Environment file created"
    else
        warn "Environment example file not found"
    fi
    
    # Install project dependencies
    log "Installing project dependencies..."
    cd "${PROJECT_DIR}"
    npm install &> "${LOG_FILE}" || error "Failed to install project dependencies"
    
    # Build the application
    log "Building application..."
    npm run build &> "${LOG_FILE}" || error "Failed to build application"
    
    log "Environment configuration complete"
}

setup_services() {
    log "Setting up system services..."
    
    # Create systemd service for Argos
    sudo tee /etc/systemd/system/argos.service > /dev/null <<EOF
[Unit]
Description=Argos SDR Console
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${ARGOS_PORT}

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable argos.service
    
    log "Argos service configured"
}

start_services() {
    log "Starting services..."
    
    # Start Docker containers with HackRF automation
    if [[ -f "${PROJECT_DIR}/docker-compose.yml" ]]; then
        cd "${PROJECT_DIR}"
        
        # Run Docker automation script if available
        if [[ -f "${PROJECT_DIR}/scripts/docker-automation.sh" ]]; then
            log "Running Docker automation setup..."
            bash "${PROJECT_DIR}/scripts/docker-automation.sh" &> "${LOG_FILE}" || warn "Docker automation had issues"
        else
            # Fallback to basic docker-compose
            sudo docker-compose up -d &> "${LOG_FILE}" || warn "Failed to start Docker containers"
        fi
    fi
    
    # Start Argos service
    sudo systemctl start argos.service || warn "Failed to start Argos service"
    
    # Wait for services to start
    sleep 10
    
    log "Services started"
}

configure_gps_kismet() {
    log "Configuring GPS and Kismet integration..."
    
    # Configure gpsd for GPS receivers
    if [ -f /etc/default/gpsd ]; then
        log "Configuring gpsd for automatic GPS detection..."
        sudo bash -c 'cat > /etc/default/gpsd << EOF
# Devices gpsd should collect to at boot time.
DEVICES="/dev/ttyUSB0"

# Other options you want to pass to gpsd
GPSD_OPTIONS="-n -G"

# Automatically hot add/remove USB GPS devices via gpsdctl
USBAUTO="true"
EOF'
        
        # Create udev rules for GPS auto-detection
        sudo bash -c 'cat > /etc/udev/rules.d/99-gps.rules << EOF
# GPS Receivers (Prolific USB-Serial)
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", SYMLINK+="gps%n", MODE="0666", GROUP="dialout"
EOF'
        
        sudo udevadm control --reload-rules
        sudo systemctl enable gpsd gpsd.socket &> "${LOG_FILE}"
        log "GPS daemon configured"
    else
        warn "gpsd not installed, skipping GPS configuration"
    fi
    
    # Configure Kismet for automatic source and GPS
    if command -v kismet &> /dev/null; then
        log "Configuring Kismet for automatic WiFi source and GPS..."
        sudo bash -c 'cat > /etc/kismet/kismet_site.conf << EOF
# Argos GPS Configuration
gps=true
gpstype=gpsd
gpshost=localhost:2947
gpsreconnect=true
gps_log=true
gps_accuracy=10

# Auto-add WiFi source on startup (will be customized per system)
# source=wlan0:type=linuxwifi
EOF'
        log "Kismet GPS integration configured"
    else
        warn "Kismet not installed, skipping Kismet configuration"
    fi
    
    # Create GPS diagnostics script
    cat > "${PROJECT_DIR}/scripts/gps-diagnostics.sh" << 'EOF'
#!/bin/bash
echo "=== GPS Diagnostics ==="
echo "USB GPS devices:"
lsusb | grep -E "067b|GPS|Prolific" || echo "No GPS devices found"
echo ""
echo "Device nodes:"
ls -la /dev/ttyUSB* /dev/gps* 2>/dev/null || echo "No GPS device nodes"
echo ""
echo "GPSD status:"
systemctl is-active gpsd || echo "gpsd not running"
echo ""
echo "GPS data test:"
timeout 5 gpspipe -r -n 5 2>/dev/null || echo "No GPS data"
EOF
    chmod +x "${PROJECT_DIR}/scripts/gps-diagnostics.sh"
    
    log "GPS and Kismet configuration complete"
}

configure_firewall() {
    log "Configuring firewall..."
    
    # Enable UFW if not already enabled
    sudo ufw --force enable &> "${LOG_FILE}"
    
    # Allow SSH
    sudo ufw allow ssh &> "${LOG_FILE}"
    
    # Allow Argos ports
    sudo ufw allow ${ARGOS_PORT}/tcp &> "${LOG_FILE}"
    sudo ufw allow ${OPENWEBRX_PORT}/tcp &> "${LOG_FILE}"
    sudo ufw allow 3002/tcp &> "${LOG_FILE}"  # HackRF Sweep
    sudo ufw allow 8000/tcp &> "${LOG_FILE}"  # WigleToTAK
    sudo ufw allow 2501/tcp &> "${LOG_FILE}"  # Kismet
    
    log "Firewall configured"
}

verify_installation() {
    log "Verifying installation..."
    
    local errors=0
    
    # Check if Argos service is running
    if ! systemctl is-active --quiet argos.service; then
        warn "Argos service is not running"
        ((errors++))
    fi
    
    # Check if ports are accessible
    if ! curl -s http://localhost:${ARGOS_PORT} > /dev/null; then
        warn "Argos web interface not accessible"
        ((errors++))
    fi
    
    # Check Docker
    if ! sudo docker ps &> /dev/null; then
        warn "Docker not running properly"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        log "Installation verification successful"
        return 0
    else
        warn "Installation verification found $errors issues"
        return 1
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Argos Installation Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}Access Points:${NC}"
    echo -e "  • Main Console:      ${YELLOW}http://localhost:${ARGOS_PORT}${NC}"
    echo -e "  • Spectrum Analyzer: ${YELLOW}http://localhost:${OPENWEBRX_PORT}${NC} (admin/<from OPENWEBRX_PASSWORD env var>)"
    echo -e "  • Project Directory: ${YELLOW}${PROJECT_DIR}${NC}"
    echo ""
    echo -e "${BLUE}System Management:${NC}"
    echo -e "  • Start Argos:       ${YELLOW}sudo systemctl start argos${NC}"
    echo -e "  • Stop Argos:        ${YELLOW}sudo systemctl stop argos${NC}"
    echo -e "  • View Logs:         ${YELLOW}sudo journalctl -u argos -f${NC}"
    echo -e "  • Install Log:       ${YELLOW}${LOG_FILE}${NC}"
    echo ""
    echo -e "${BLUE}System Management Scripts:${NC}"
    echo -e "  Install with: ${YELLOW}curl -sSL https://raw.githubusercontent.com/Graveside2022/Argos/main/scripts/install-management.sh | bash${NC}"
    echo -e "  • Process monitoring (every 5 min)"
    echo -e "  • CPU protection (kills >140% CPU processes)"  
    echo -e "  • Network connectivity monitoring"
    echo -e "  • System health reporting"
    echo ""
    echo -e "${GREEN}Ready for professional SDR and network analysis!${NC}"
    echo ""
}

#######################################################################################
# Main Installation Process
#######################################################################################

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Professional Installation${NC}"
    echo -e "${BLUE}# One-click setup for Raspberry Pi and Debian/Ubuntu systems${NC}"
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
    
    log "Starting Argos installation..."
    log "Installation directory: ${PROJECT_DIR}"
    log "Log file: ${LOG_FILE}"
    
    # Installation steps
    check_system
    create_directories
    install_system_dependencies
    install_nodejs
    install_docker
    clone_repository
    install_hackrf_container
    configure_environment
    setup_services
    configure_gps_kismet
    start_services
    configure_firewall
    
    # Verify installation
    if verify_installation; then
        print_summary
        log "Installation completed successfully!"
    else
        warn "Installation completed with warnings. Check the log file for details."
        print_summary
    fi
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Installation interrupted. Check ${LOG_FILE} for details.${NC}"' INT TERM

# Run main installation
main "$@"