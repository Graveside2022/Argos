#!/bin/bash
#
# Argos One-Click Installer
# Enterprise-grade RF Analysis Platform for Raspberry Pi
#
# This installer will:
# - Create necessary directories
# - Clone the Argos repository
# - Install all dependencies (Docker, Node.js, etc.)
# - Configure the system
# - Start all services
#
# Usage: curl -sSL https://install.argos.io | bash

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation variables
INSTALL_DIR="/home/pi/projects"
ARGOS_DIR="$INSTALL_DIR/Argos"
REPO_URL="https://github.com/YourOrg/Argos.git"
NODE_VERSION="20"
DOCKER_COMPOSE_VERSION="2.23.0"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get system info
get_system_info() {
    print_status "Detecting system configuration..."
    
    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    # Detect architecture
    ARCH=$(uname -m)
    
    # Detect Raspberry Pi model
    if [ -f /proc/device-tree/model ]; then
        PI_MODEL=$(tr -d '\0' < /proc/device-tree/model)
    else
        PI_MODEL="Unknown"
    fi
    
    print_success "System: $OS $VER ($ARCH)"
    print_success "Device: $PI_MODEL"
}

# Function to install Docker
install_docker() {
    if command_exists docker; then
        print_success "Docker already installed ($(docker --version))"
        return 0
    fi
    
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    
    # Install Docker Compose
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker installed successfully"
}

# Function to install Node.js
install_nodejs() {
    if command_exists node; then
        NODE_CURRENT=$(node -v | sed 's/v\([0-9]*\).*/\1/')
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            print_success "Node.js already installed ($(node -v))"
            return 0
        fi
    fi
    
    print_status "Installing Node.js v${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    print_success "Node.js installed ($(node -v))"
}

# Function to install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."
    
    sudo apt-get update
    sudo apt-get install -y \
        git \
        curl \
        wget \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        libusb-1.0-0-dev \
        libudev-dev \
        librtlsdr-dev \
        rtl-sdr \
        gpsd \
        gpsd-clients \
        jq \
        htop \
        net-tools \
        wireless-tools \
        wpasupplicant
    
    print_success "System dependencies installed"
}

# Function to setup Argos
setup_argos() {
    print_status "Setting up Argos..."
    
    # Create project directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Clone or pull repository
    if [ -d "$ARGOS_DIR" ]; then
        print_status "Updating existing Argos installation..."
        cd "$ARGOS_DIR"
        git pull
    else
        print_status "Cloning Argos repository..."
        git clone "$REPO_URL" "$ARGOS_DIR"
        cd "$ARGOS_DIR"
    fi
    
    # Install Node.js dependencies
    print_status "Installing Node.js dependencies..."
    npm install
    
    # Setup environment
    if [ ! -f .env ]; then
        print_status "Creating environment configuration..."
        cp .env.example .env
        
        # Generate secure random keys
        SESSION_SECRET=$(openssl rand -base64 32)
        JWT_SECRET=$(openssl rand -base64 32)
        
        # Update .env with generated values
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    fi
    
    # Build the application
    print_status "Building Argos application..."
    npm run build
    
    print_success "Argos setup complete"
}

# Function to setup Docker containers
setup_docker_containers() {
    print_status "Setting up Docker containers..."
    
    cd "$ARGOS_DIR"
    
    # Pull HackRF container
    print_status "Pulling HackRF OpenWebRX container..."
    sudo docker pull hackrf/openwebrx:latest-v2
    
    # Start containers
    print_status "Starting Docker containers..."
    sudo docker-compose up -d
    
    print_success "Docker containers running"
}

# Function to install system management scripts
install_management_scripts() {
    print_status "Installing system management scripts..."
    
    # Copy scripts to system location
    sudo cp "$ARGOS_DIR/scripts/argos-process-manager.sh" /usr/local/bin/
    sudo cp "$ARGOS_DIR/scripts/argos-cpu-protector.sh" /usr/local/bin/
    sudo cp "$ARGOS_DIR/scripts/argos-wifi-resilience.sh" /usr/local/bin/
    
    # Make scripts executable
    sudo chmod +x /usr/local/bin/argos-*.sh
    
    # Install systemd services
    sudo cp "$ARGOS_DIR/scripts/systemd/"*.service /etc/systemd/system/
    sudo systemctl daemon-reload
    
    # Enable services
    sudo systemctl enable argos-main.service
    sudo systemctl enable argos-process-manager.service
    sudo systemctl enable argos-cpu-protector.service
    sudo systemctl enable argos-wifi-resilience.service
    
    print_success "Management scripts installed"
}

# Function to setup cronjobs
setup_cronjobs() {
    print_status "Setting up cronjobs..."
    
    # Add cronjobs for system maintenance
    (crontab -l 2>/dev/null || true; echo "*/5 * * * * /usr/local/bin/argos-process-manager.sh") | crontab -
    (crontab -l 2>/dev/null || true; echo "*/2 * * * * /usr/local/bin/argos-cpu-protector.sh") | crontab -
    (crontab -l 2>/dev/null || true; echo "*/1 * * * * /usr/local/bin/argos-wifi-resilience.sh") | crontab -
    
    print_success "Cronjobs configured"
}

# Function to start services
start_services() {
    print_status "Starting Argos services..."
    
    # Start systemd services
    sudo systemctl start argos-main.service
    sudo systemctl start argos-process-manager.service
    sudo systemctl start argos-cpu-protector.service
    sudo systemctl start argos-wifi-resilience.service
    
    # Start GPSD if available
    if command_exists gpsd; then
        sudo systemctl enable gpsd
        sudo systemctl start gpsd
    fi
    
    # Start Kismet if available
    if command_exists kismet; then
        sudo systemctl enable kismet
        sudo systemctl start kismet
    fi
    
    print_success "All services started"
}

# Function to verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    ERRORS=0
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js not installed"
        ((ERRORS++))
    fi
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker not installed"
        ((ERRORS++))
    fi
    
    # Check Argos directory
    if [ ! -d "$ARGOS_DIR" ]; then
        print_error "Argos directory not found"
        ((ERRORS++))
    fi
    
    # Check services
    if ! systemctl is-active --quiet argos-main.service; then
        print_warning "Argos main service not running"
    fi
    
    # Check Docker containers
    if ! sudo docker ps | grep -q openwebrx; then
        print_warning "OpenWebRX container not running"
    fi
    
    if [ $ERRORS -eq 0 ]; then
        print_success "Installation verified successfully"
        return 0
    else
        print_error "Installation verification failed with $ERRORS errors"
        return 1
    fi
}

# Function to display final instructions
display_completion() {
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  Argos Installation Complete!                 ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}Access Points:${NC}"
    echo -e "  • Argos Console:    ${GREEN}http://$(hostname -I | awk '{print $1}'):8006${NC}"
    echo -e "  • Argos API:        ${GREEN}http://$(hostname -I | awk '{print $1}'):8005${NC}"
    echo -e "  • OpenWebRX:        ${GREEN}http://$(hostname -I | awk '{print $1}'):8073${NC}"
    echo
    echo -e "${BLUE}Service Status:${NC}"
    systemctl status argos-main.service --no-pager | grep "Active:"
    echo
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  • View logs:        ${YELLOW}sudo journalctl -u argos-main -f${NC}"
    echo -e "  • Restart Argos:    ${YELLOW}sudo systemctl restart argos-main${NC}"
    echo -e "  • Check status:     ${YELLOW}sudo systemctl status argos-main${NC}"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Connect your HackRF device"
    echo -e "  2. Configure WiFi adapters for Kismet"
    echo -e "  3. Access the Argos Console at the URL above"
    echo
    echo -e "${GREEN}Installation log saved to:${NC} /var/log/argos-install.log"
    echo
}

# Main installation function
main() {
    # Clear screen and show banner
    clear
    echo -e "${BLUE}"
    echo "     _    ____   ____  ___  ____  "
    echo "    / \  |  _ \ / ___|/ _ \/ ___| "
    echo "   / _ \ | |_) | |  _| | | \___ \ "
    echo "  / ___ \|  _ <| |_| | |_| |___) |"
    echo " /_/   \_\_| \_\\____|\___/|____/ "
    echo -e "${NC}"
    echo "Enterprise RF Analysis Platform"
    echo "One-Click Installer v1.0"
    echo
    
    # Start logging
    exec > >(tee -a /var/log/argos-install.log)
    exec 2>&1
    
    print_status "Starting Argos installation..."
    echo
    
    # Run installation steps
    get_system_info
    install_dependencies
    install_nodejs
    install_docker
    setup_argos
    setup_docker_containers
    install_management_scripts
    setup_cronjobs
    start_services
    
    # Verify installation
    if verify_installation; then
        display_completion
    else
        print_error "Installation completed with errors. Check /var/log/argos-install.log"
        exit 1
    fi
}

# Run main function
main "$@"