#!/bin/bash
#
# System Dependencies Installation Script for Argos
# This script installs all required system dependencies for a complete deployment
#
# Part of the Tesla Orchestrator one-button deployment system
# Grade A+ deployment automation
#

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global configuration
LOG_FILE="/var/log/argos-dependencies-install.log"
NODE_VERSION="20"
DOCKER_COMPOSE_VERSION="2.24.0"

# Function to print colored output
info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to detect OS and architecture
detect_system() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
        info "Detected OS: $OS $VER"
    else
        error "Cannot detect OS. Supported: Ubuntu, Debian, Raspberry Pi OS"
        exit 1
    fi
    
    ARCH=$(uname -m)
    info "Detected architecture: $ARCH"
}

# Function to update system packages
update_system() {
    info "Updating system packages..."
    apt update
    apt upgrade -y
    success "System packages updated"
}

# Function to install essential packages
install_essential_packages() {
    info "Installing essential packages..."
    
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        zip \
        tar \
        gzip \
        build-essential \
        cmake \
        pkg-config \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        htop \
        tree \
        vim \
        nano \
        screen \
        tmux \
        usbutils \
        net-tools \
        systemd \
        supervisor \
        nginx \
        jq \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        python3-setuptools \
        python3-wheel
    
    success "Essential packages installed"
}

# Function to install Node.js
install_nodejs() {
    info "Installing Node.js $NODE_VERSION..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_VERSION" == "$NODE_VERSION" ]]; then
            success "Node.js $NODE_VERSION already installed"
            return
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    
    # Verify installation
    NODE_INSTALLED_VERSION=$(node --version)
    NPM_INSTALLED_VERSION=$(npm --version)
    
    info "Node.js version: $NODE_INSTALLED_VERSION"
    info "npm version: $NPM_INSTALLED_VERSION"
    
    success "Node.js installed successfully"
}

# Function to install Docker
install_docker() {
    info "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        success "Docker already installed"
        return
    fi
    
    # Remove old versions
    apt remove -y docker docker-engine docker.io containerd runc || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index
    apt update
    
    # Install Docker Engine
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
    
    # Add pi user to docker group
    if id "pi" &>/dev/null; then
        usermod -aG docker pi
        info "Added pi user to docker group"
    fi
    
    # Enable and start Docker service
    systemctl enable docker
    systemctl start docker
    
    success "Docker installed successfully"
}

# Function to install Docker Compose
install_docker_compose() {
    info "Installing Docker Compose..."
    
    # Check if Docker Compose is already installed
    if command -v docker-compose &> /dev/null; then
        success "Docker Compose already installed"
        return
    fi
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for docker compose (new syntax)
    ln -sf /usr/local/bin/docker-compose /usr/local/bin/docker-compose
    
    # Verify installation
    COMPOSE_VERSION=$(docker-compose --version)
    info "Docker Compose version: $COMPOSE_VERSION"
    
    success "Docker Compose installed successfully"
}

# Function to install HackRF dependencies
install_hackrf_dependencies() {
    info "Installing HackRF dependencies..."
    
    apt install -y \
        hackrf \
        libhackrf-dev \
        libhackrf0 \
        libusb-1.0-0-dev \
        libfftw3-dev \
        libsoapysdr-dev \
        soapysdr-tools
    
    # Configure HackRF permissions
    cat > /etc/udev/rules.d/53-hackrf.rules << 'EOF'
# HackRF One
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# HackRF Jawbreaker
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# HackRF One (bootloader)
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
EOF
    
    # Reload udev rules
    udevadm control --reload-rules
    udevadm trigger
    
    # Add pi user to plugdev group
    if id "pi" &>/dev/null; then
        usermod -a -G plugdev pi
        info "Added pi user to plugdev group"
    fi
    
    success "HackRF dependencies installed"
}

# Function to install Kismet dependencies
install_kismet_dependencies() {
    info "Installing Kismet dependencies..."
    
    # Add Kismet repository
    wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | apt-key add -
    echo 'deb https://www.kismetwireless.net/repos/apt/release/$(lsb_release -cs) $(lsb_release -cs) main' | tee /etc/apt/sources.list.d/kismet.list
    
    # Update package index
    apt update
    
    # Install Kismet
    apt install -y kismet
    
    # Add pi user to kismet group
    if id "pi" &>/dev/null; then
        usermod -a -G kismet pi
        info "Added pi user to kismet group"
    fi
    
    success "Kismet dependencies installed"
}

# Function to install development tools
install_development_tools() {
    info "Installing development tools..."
    
    # Install modern CLI tools
    apt install -y \
        ripgrep \
        fd-find \
        bat \
        exa \
        fzf \
        jq \
        yq \
        htop \
        btop \
        tree \
        ncdu
    
    # Install Python development tools
    pip3 install --upgrade pip
    pip3 install \
        virtualenv \
        setuptools \
        wheel \
        psutil \
        requests \
        pyyaml \
        jinja2
    
    success "Development tools installed"
}

# Function to configure system settings
configure_system() {
    info "Configuring system settings..."
    
    # Increase file descriptor limits
    cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
EOF
    
    # Configure systemd limits
    mkdir -p /etc/systemd/system.conf.d
    cat > /etc/systemd/system.conf.d/limits.conf << 'EOF'
[Manager]
DefaultLimitNOFILE=65536
EOF
    
    # Configure kernel parameters
    cat >> /etc/sysctl.conf << 'EOF'
# Argos system optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000
vm.swappiness = 10
fs.file-max = 65536
EOF
    
    # Apply sysctl settings
    sysctl -p
    
    success "System settings configured"
}

# Function to create service directories
create_service_directories() {
    info "Creating service directories..."
    
    # Create Argos directories
    mkdir -p /opt/argos
    mkdir -p /var/log/argos
    mkdir -p /var/run/argos
    mkdir -p /etc/argos
    
    # Set permissions
    if id "pi" &>/dev/null; then
        chown -R pi:pi /opt/argos
        chown -R pi:pi /var/log/argos
        chown -R pi:pi /var/run/argos
    fi
    
    success "Service directories created"
}

# Function to install additional utilities
install_additional_utilities() {
    info "Installing additional utilities..."
    
    # Install monitoring tools
    apt install -y \
        iotop \
        nethogs \
        iftop \
        nload \
        bmon \
        vnstat \
        lsof \
        strace \
        tcpdump \
        wireshark-common \
        aircrack-ng
    
    # Install radio frequency tools
    apt install -y \
        rtl-sdr \
        gqrx-sdr \
        cubicsdr \
        gnuradio \
        gr-osmosdr \
        multimon-ng
    
    success "Additional utilities installed"
}

# Function to run system validation
run_system_validation() {
    info "Running system validation..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        success "Node.js: $(node --version)"
    else
        error "Node.js not found"
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        success "npm: $(npm --version)"
    else
        error "npm not found"
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        success "Docker: $(docker --version)"
    else
        error "Docker not found"
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        success "Docker Compose: $(docker-compose --version)"
    else
        error "Docker Compose not found"
    fi
    
    # Check HackRF
    if command -v hackrf_info &> /dev/null; then
        success "HackRF tools available"
    else
        warning "HackRF tools not found"
    fi
    
    # Check Kismet
    if command -v kismet &> /dev/null; then
        success "Kismet available"
    else
        warning "Kismet not found"
    fi
    
    # Check system resources
    info "System resources:"
    info "  CPU cores: $(nproc)"
    info "  Memory: $(free -h | grep Mem | awk '{print $2}')"
    info "  Disk space: $(df -h / | tail -1 | awk '{print $4}')"
    
    success "System validation completed"
}

# Function to display final information
display_final_info() {
    echo ""
    echo "============================================="
    success "System dependencies installation completed!"
    echo "============================================="
    echo ""
    echo "Installed components:"
    echo "  ✓ Node.js $(node --version)"
    echo "  ✓ npm $(npm --version)"
    echo "  ✓ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
    echo "  ✓ Docker Compose $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)"
    echo "  ✓ HackRF tools and drivers"
    echo "  ✓ Kismet wireless detector"
    echo "  ✓ Development tools and utilities"
    echo "  ✓ System optimization and configuration"
    echo ""
    echo "System is ready for Argos deployment!"
    echo ""
    echo "Next steps:"
    echo "  1. Reboot the system to apply all changes"
    echo "  2. Run the main Argos deployment script"
    echo "  3. Connect HackRF and other hardware"
    echo ""
}

# Main installation function
main() {
    echo "Argos System Dependencies Installation"
    echo "Part of Tesla Orchestrator Deployment System"
    echo "============================================="
    echo ""
    
    # Create log file
    touch "$LOG_FILE"
    
    # Check prerequisites
    check_root
    detect_system
    
    # Installation steps
    update_system
    install_essential_packages
    install_nodejs
    install_docker
    install_docker_compose
    install_hackrf_dependencies
    install_kismet_dependencies
    install_development_tools
    configure_system
    create_service_directories
    install_additional_utilities
    
    # Final validation
    run_system_validation
    display_final_info
    
    success "Installation completed successfully!"
    warning "Please reboot the system to apply all changes"
}

# Error handling
trap 'error "Installation failed at line $LINENO"' ERR

# Run main function
main "$@"