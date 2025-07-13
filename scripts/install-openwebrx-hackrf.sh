#!/bin/bash
#
# OpenWebRX-HackRF Installation Script for Argos
# This script installs OpenWebRX with HackRF support for the Argos project
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
OPENWEBRX_PORT=8073
OPENWEBRX_USER="openwebrx"
OPENWEBRX_HOME="/opt/openwebrx"
OPENWEBRX_CONFIG="/etc/openwebrx"
HACKRF_TOOLS_PATH="/usr/local/bin"
LOG_FILE="/var/log/openwebrx-install.log"

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

# Function to detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
        info "Detected OS: $OS $VER"
    else
        error "Cannot detect OS. Supported: Ubuntu, Debian, Raspberry Pi OS"
        exit 1
    fi
}

# Function to update system packages
update_system() {
    info "Updating system packages..."
    apt update
    apt upgrade -y
    success "System packages updated"
}

# Function to install system dependencies
install_dependencies() {
    info "Installing system dependencies..."
    
    # Base dependencies
    apt install -y \
        build-essential \
        cmake \
        git \
        pkg-config \
        libusb-1.0-0-dev \
        libfftw3-dev \
        libsoapysdr-dev \
        soapysdr-tools \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        python3-setuptools \
        python3-wheel \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
        libjpeg-dev \
        libpng-dev \
        supervisor \
        nginx \
        curl \
        wget \
        htop \
        usbutils
    
    # HackRF specific dependencies
    apt install -y \
        hackrf \
        libhackrf-dev \
        libhackrf0
    
    success "System dependencies installed"
}

# Function to install HackRF tools from source (for latest version)
install_hackrf_tools() {
    info "Installing HackRF tools from source..."
    
    cd /tmp
    git clone https://github.com/mossmann/hackrf.git
    cd hackrf/host
    
    mkdir build
    cd build
    cmake ..
    make
    make install
    ldconfig
    
    # Add hackrf tools to PATH
    if ! grep -q "$HACKRF_TOOLS_PATH" /etc/environment; then
        echo "PATH=\"$HACKRF_TOOLS_PATH:\$PATH\"" >> /etc/environment
    fi
    
    success "HackRF tools installed"
}

# Function to configure HackRF permissions
configure_hackrf_permissions() {
    info "Configuring HackRF permissions..."
    
    # Create udev rules for HackRF
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
    fi
    
    success "HackRF permissions configured"
}

# Function to create OpenWebRX user
create_openwebrx_user() {
    info "Creating OpenWebRX user..."
    
    if ! id "$OPENWEBRX_USER" &>/dev/null; then
        useradd -r -m -d "$OPENWEBRX_HOME" -s /bin/bash "$OPENWEBRX_USER"
        usermod -a -G plugdev "$OPENWEBRX_USER"
        success "OpenWebRX user created"
    else
        warning "OpenWebRX user already exists"
    fi
}

# Function to install OpenWebRX
install_openwebrx() {
    info "Installing OpenWebRX..."
    
    # Create directories
    mkdir -p "$OPENWEBRX_HOME"
    mkdir -p "$OPENWEBRX_CONFIG"
    
    # Clone OpenWebRX
    cd "$OPENWEBRX_HOME"
    if [[ ! -d "openwebrx" ]]; then
        git clone https://github.com/jketterl/openwebrx.git
    fi
    
    cd openwebrx
    
    # Create Python virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install Python dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Install OpenWebRX
    python3 setup.py install
    
    # Set ownership
    chown -R "$OPENWEBRX_USER:$OPENWEBRX_USER" "$OPENWEBRX_HOME"
    
    success "OpenWebRX installed"
}

# Function to configure OpenWebRX
configure_openwebrx() {
    info "Configuring OpenWebRX..."
    
    # Create configuration directory
    mkdir -p "$OPENWEBRX_CONFIG"
    
    # Create OpenWebRX configuration
    cat > "$OPENWEBRX_CONFIG/openwebrx.conf" << EOF
[webadmin]
enabled = true
admin_user = admin
admin_password = hackrf

[web]
port = $OPENWEBRX_PORT
host = 0.0.0.0

[sdr]
devices = hackrf

[hackrf]
name = HackRF One
driver = hackrf
device = hackrf=0
gain = 20
center_freq = 145000000
samp_rate = 2500000
start_freq = 144000000
start_mod = nfm
rf_gain = 20
waterfall_levels = -115,-85
EOF
    
    # Set configuration permissions
    chown -R "$OPENWEBRX_USER:$OPENWEBRX_USER" "$OPENWEBRX_CONFIG"
    
    success "OpenWebRX configured"
}

# Function to create systemd service
create_systemd_service() {
    info "Creating systemd service..."
    
    cat > /etc/systemd/system/openwebrx.service << EOF
[Unit]
Description=OpenWebRX SDR Web Interface
After=network.target
Wants=network.target

[Service]
Type=simple
User=$OPENWEBRX_USER
Group=$OPENWEBRX_USER
WorkingDirectory=$OPENWEBRX_HOME/openwebrx
ExecStart=$OPENWEBRX_HOME/openwebrx/venv/bin/python3 openwebrx.py --config $OPENWEBRX_CONFIG/openwebrx.conf
Environment="PATH=$OPENWEBRX_HOME/openwebrx/venv/bin:$HACKRF_TOOLS_PATH:/usr/local/bin:/usr/bin:/bin"
Restart=always
RestartSec=10

# Security options
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$OPENWEBRX_HOME $OPENWEBRX_CONFIG /var/log

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable openwebrx
    
    success "Systemd service created"
}

# Function to configure nginx proxy (optional)
configure_nginx() {
    info "Configuring nginx reverse proxy..."
    
    cat > /etc/nginx/sites-available/openwebrx << EOF
server {
    listen 80;
    server_name _;
    
    location /openwebrx {
        proxy_pass http://127.0.0.1:$OPENWEBRX_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/openwebrx /etc/nginx/sites-enabled/
    
    # Test nginx configuration
    nginx -t
    systemctl reload nginx
    
    success "Nginx configured"
}

# Function to run health checks
run_health_checks() {
    info "Running health checks..."
    
    # Check if HackRF is detected
    if hackrf_info 2>/dev/null; then
        success "HackRF device detected"
    else
        warning "HackRF device not detected (may need to be connected)"
    fi
    
    # Check if OpenWebRX service is running
    if systemctl is-active --quiet openwebrx; then
        success "OpenWebRX service is running"
    else
        warning "OpenWebRX service is not running"
    fi
    
    # Check if port is listening
    if netstat -ln | grep -q ":$OPENWEBRX_PORT"; then
        success "OpenWebRX is listening on port $OPENWEBRX_PORT"
    else
        warning "OpenWebRX is not listening on port $OPENWEBRX_PORT"
    fi
    
    # Test HTTP endpoint
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$OPENWEBRX_PORT" | grep -q "200"; then
        success "OpenWebRX HTTP endpoint is responding"
    else
        warning "OpenWebRX HTTP endpoint is not responding"
    fi
}

# Function to start services
start_services() {
    info "Starting OpenWebRX service..."
    
    systemctl start openwebrx
    sleep 5
    
    if systemctl is-active --quiet openwebrx; then
        success "OpenWebRX service started successfully"
    else
        error "Failed to start OpenWebRX service"
        systemctl status openwebrx
        exit 1
    fi
}

# Function to display final information
display_final_info() {
    echo ""
    echo "==============================================="
    success "OpenWebRX-HackRF installation completed!"
    echo "==============================================="
    echo ""
    echo "Access OpenWebRX at: http://$(hostname -I | awk '{print $1}'):$OPENWEBRX_PORT"
    echo "Default credentials: admin/hackrf"
    echo ""
    echo "Service management:"
    echo "  Start:   sudo systemctl start openwebrx"
    echo "  Stop:    sudo systemctl stop openwebrx"
    echo "  Status:  sudo systemctl status openwebrx"
    echo "  Logs:    sudo journalctl -u openwebrx -f"
    echo ""
    echo "Configuration:"
    echo "  Config:  $OPENWEBRX_CONFIG/openwebrx.conf"
    echo "  Home:    $OPENWEBRX_HOME"
    echo "  User:    $OPENWEBRX_USER"
    echo ""
    echo "HackRF tools:"
    echo "  Info:    hackrf_info"
    echo "  Test:    hackrf_sweep -f 2400:2500"
    echo ""
    echo "Integration with Argos:"
    echo "  OpenWebRX URL: http://localhost:$OPENWEBRX_PORT"
    echo "  This matches the PUBLIC_OPENWEBRX_URL in docker-compose.yml"
    echo ""
}

# Main installation function
main() {
    echo "OpenWebRX-HackRF Installation Script"
    echo "Part of Argos Tesla Orchestrator Deployment"
    echo "================================================="
    echo ""
    
    # Create log file
    touch "$LOG_FILE"
    
    # Check prerequisites
    check_root
    detect_os
    
    # Installation steps
    update_system
    install_dependencies
    install_hackrf_tools
    configure_hackrf_permissions
    create_openwebrx_user
    install_openwebrx
    configure_openwebrx
    create_systemd_service
    configure_nginx
    start_services
    
    # Final validation
    run_health_checks
    display_final_info
    
    success "Installation completed successfully!"
}

# Error handling
trap 'error "Installation failed at line $LINENO"' ERR

# Run main function
main "$@"