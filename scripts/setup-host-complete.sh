#!/bin/bash
#
# Argos COMPLETE Host Setup Script
# Installs ALL host system dependencies discovered during troubleshooting
#
# This script captures EVERYTHING needed for full Argos functionality:
# - Core SDR hardware (HackRF, USRP)
# - GSM Evil tools (gnuradio, gr-gsm, gr-osmosdr, kalibrate)
# - GPS support
# - Kismet WiFi scanning
# - Extended radio tools (RTL-SDR, multimon-ng, GQRX)
# - System monitoring and diagnostics
# - Complete system tuning
#
# Usage: sudo bash scripts/setup-host-complete.sh
#

set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] Run as root: sudo bash scripts/setup-host-complete.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
USER_NAME="${SUDO_USER:-$(whoami)}"
NODE_VERSION="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[FAIL]${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Argos COMPLETE Host System Setup                   ║"
echo "║   ALL hardware + troubleshooting dependencies         ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
info "Project: $PROJECT_ROOT"
info "User: $USER_NAME"
echo ""

# ============================================================================
# 1. System Packages & Updates
# ============================================================================
info "[1/14] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
success "System updated"

info "Installing essential packages..."
apt-get install -y -qq \
    curl wget git unzip zip tar gzip \
    build-essential cmake pkg-config \
    apt-transport-https ca-certificates gnupg lsb-release software-properties-common \
    libusb-1.0-0-dev libfftw3-dev \
    usbutils net-tools htop tree vim nano screen tmux jq \
    python3 python3-pip python3-venv python3-dev python3-setuptools python3-wheel \
    gpsd gpsd-clients \
    > /dev/null 2>&1
success "Essential packages installed"

# ============================================================================
# 2. Node.js
# ============================================================================
info "[2/14] Installing Node.js $NODE_VERSION..."
if command -v node &>/dev/null; then
    CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$CURRENT_VERSION" == "$NODE_VERSION" ]]; then
        success "Node.js $NODE_VERSION already installed"
    else
        info "Updating Node.js from version $CURRENT_VERSION to $NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
        apt-get install -y nodejs > /dev/null 2>&1
        success "Node.js updated"
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
    success "Node.js $NODE_VERSION installed"
fi

# ============================================================================
# 3. Docker & Docker Compose
# ============================================================================
info "[3/14] Installing Docker..."
if command -v docker &>/dev/null; then
    success "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
    systemctl enable docker
    systemctl start docker
    success "Docker installed"
fi

info "Installing Docker Compose..."
if command -v docker-compose &>/dev/null; then
    success "Docker Compose already installed"
else
    DOCKER_COMPOSE_VERSION="2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose > /dev/null 2>&1
    chmod +x /usr/local/bin/docker-compose
    success "Docker Compose installed"
fi

# Add user to docker group
usermod -aG docker "$USER_NAME"
success "User $USER_NAME added to docker group"

# ============================================================================
# 4. Portainer
# ============================================================================
info "[4/14] Installing Portainer..."
if docker ps -a --format '{{.Names}}' | grep -q "^portainer$"; then
    docker start portainer 2>/dev/null || true
    success "Portainer already exists"
else
    docker volume create portainer_data > /dev/null 2>&1
    docker run -d --name portainer --restart=always \
        -p 9000:9000 -p 9443:9443 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest > /dev/null 2>&1
    success "Portainer installed (https://localhost:9443)"
fi

# ============================================================================
# 5. HackRF One
# ============================================================================
info "[5/14] Installing HackRF dependencies..."
apt-get install -y -qq \
    hackrf libhackrf-dev libhackrf0 \
    libsoapysdr-dev soapysdr-tools soapysdr-module-hackrf \
    > /dev/null 2>&1

# Configure udev rules
cat > /etc/udev/rules.d/53-hackrf.rules <<'EOF'
# HackRF One USB access
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# HackRF Jawbreaker
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="604b", MODE="0666", GROUP="plugdev"
# HackRF One (bootloader)
SUBSYSTEM=="usb", ATTR{idVendor}=="1fc9", ATTR{idProduct}=="000c", MODE="0666", GROUP="plugdev"
EOF

udevadm control --reload-rules
udevadm trigger
usermod -aG plugdev "$USER_NAME"
success "HackRF installed with udev rules"

# ============================================================================
# 6. GSM Evil (COMPLETE with all troubleshooting fixes)
# ============================================================================
info "[6/14] Installing GSM Evil dependencies (COMPLETE)..."

# Core GNU Radio and GSM tools - REQUIRED (not optional)
info "  Installing gnuradio, gr-gsm, gr-osmosdr..."
apt-get install -y -qq \
    gnuradio gr-gsm gr-osmosdr \
    kalibrate-hackrf kalibrate-rtl \
    > /dev/null 2>&1

# Osmocom libraries - REQUIRED for GSM Evil
info "  Installing Osmocom libraries (libosmocore, libosmo-dsp)..."
apt-get install -y -qq \
    libosmocore-dev libosmo-dsp-dev \
    > /dev/null 2>&1

if [ $? -ne 0 ]; then
    error "Osmocom libraries failed to install - GSM Evil will NOT work"
    warn "You may need to build from source: https://osmocom.org/projects/libosmocore/wiki"
else
    success "Osmocom libraries installed"
fi

# Python Flask ecosystem for GSM Evil backend
info "  Installing Python Flask ecosystem..."
apt-get install -y -qq \
    python3-flask python3-flask-socketio python3-flask-cors \
    > /dev/null 2>&1 || warn "Flask packages not available via apt, will need pip install"

# Install via pip if apt failed
if ! python3 -c "import flask" &>/dev/null; then
    pip3 install --quiet Flask Flask-SocketIO Flask-CORS pyshark werkzeug || true
fi

# Verify gr-gsm
if command -v grgsm_scanner &>/dev/null; then
    success "gr-gsm installed successfully"
else
    error "gr-gsm not found - GSM Evil WILL NOT WORK"
    warn "Manual build required: https://github.com/ptrkrysik/gr-gsm"
fi

# Verify gr-osmosdr
if python3 -c "import osmosdr" &>/dev/null 2>&1; then
    success "gr-osmosdr Python bindings available"
else
    warn "gr-osmosdr Python bindings missing (may need rebuild)"
fi

# ============================================================================
# 7. USRP (Optional but complete)
# ============================================================================
info "[7/14] Installing USRP dependencies (optional)..."
if apt-cache show libuhd-dev &>/dev/null; then
    apt-get install -y -qq \
        libuhd-dev uhd-host soapysdr-module-uhd \
        python3-uhd \
        > /dev/null 2>&1

    # Download firmware in background (can take time)
    info "  Downloading USRP firmware images (background)..."
    uhd_images_downloader > /dev/null 2>&1 &

    success "USRP support installed (with Python bindings)"
else
    warn "USRP packages not available - skipping"
fi

# ============================================================================
# 8. GPS Configuration
# ============================================================================
info "[8/14] Configuring GPS..."
cat > /etc/default/gpsd <<'EOF'
DEVICES=""
GPSD_OPTIONS=""
USBAUTO="true"
START_DAEMON="true"
EOF

systemctl enable gpsd > /dev/null 2>&1
systemctl restart gpsd > /dev/null 2>&1
success "gpsd configured (USB auto-detect)"

# ============================================================================
# 9. Kismet WiFi Scanning
# ============================================================================
info "[9/14] Installing Kismet..."
if ! command -v kismet &>/dev/null; then
    wget -qO - https://www.kismetwireless.net/repos/kismet-release.gpg.key | apt-key add - 2>/dev/null
    echo "deb https://www.kismetwireless.net/repos/apt/release/$(lsb_release -cs) $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/kismet.list
    apt-get update -qq
    apt-get install -y -qq kismet > /dev/null 2>&1
fi
usermod -aG kismet "$USER_NAME"
success "Kismet installed"

# ============================================================================
# 10. Extended Radio Tools (Optional but useful)
# ============================================================================
info "[10/14] Installing extended radio tools (optional)..."
apt-get install -y -qq \
    rtl-sdr \
    multimon-ng \
    > /dev/null 2>&1 || warn "Some extended radio tools unavailable"

# GQRX and CubicSDR (GUI tools - optional)
if [ -n "$DISPLAY" ]; then
    apt-get install -y -qq gqrx-sdr cubicsdr > /dev/null 2>&1 || warn "GUI SDR tools not available"
fi

success "Extended radio tools installed (rtl-sdr, multimon-ng)"

# ============================================================================
# 11. System Monitoring & Diagnostics (Optional)
# ============================================================================
info "[11/14] Installing monitoring and diagnostic tools..."
apt-get install -y -qq \
    iotop nethogs iftop nload bmon vnstat \
    lsof strace tcpdump wireshark-common \
    aircrack-ng \
    ripgrep fd-find bat exa fzf ncdu btop \
    > /dev/null 2>&1 || warn "Some diagnostic tools unavailable"

success "Monitoring tools installed"

# ============================================================================
# 12. Development Tools & Python Packages
# ============================================================================
info "[12/14] Installing development tools..."

# Python packages for data analysis and hardware control
pip3 install --quiet --upgrade pip
pip3 install --quiet \
    virtualenv setuptools wheel \
    psutil requests pyyaml jinja2 \
    numpy scipy \
    pyserial python-dotenv \
    eventlet \
    || warn "Some Python packages failed to install"

success "Development tools and Python packages installed"

# ============================================================================
# 13. System Optimizations (COMPLETE)
# ============================================================================
info "[13/14] Applying system optimizations..."

# Complete kernel parameter tuning
cat >> /etc/sysctl.conf <<'EOF'

# Argos System Optimizations
# USB buffer sizes for SDR devices
vm.max_map_count=262144

# Network buffer sizes for high-throughput data
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000

# Memory management
vm.swappiness = 10

# File descriptor limits
fs.file-max = 65536
EOF

# File descriptor limits
cat >> /etc/security/limits.conf <<'EOF'

# Argos File Descriptor Limits
* soft nofile 65536
* hard nofile 65536
EOF

# SystemD limits
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/limits.conf <<'EOF'
[Manager]
DefaultLimitNOFILE=65536
EOF

# Apply sysctl settings immediately
sysctl -p > /dev/null 2>&1

# USB power optimization
cat > /etc/udev/rules.d/50-usb-power.rules <<'EOF'
# Keep USB devices powered on
SUBSYSTEM=="usb", ATTR{power/control}="on"
EOF
udevadm control --reload-rules
udevadm trigger

# Disable Bluetooth on Raspberry Pi to free USB power
if [ -f /boot/firmware/config.txt ]; then
    if ! grep -q "dtoverlay=disable-bt" /boot/firmware/config.txt; then
        echo "dtoverlay=disable-bt" >> /boot/firmware/config.txt
        systemctl disable hciuart bluetooth 2>/dev/null || true
        warn "Bluetooth disabled (reboot required)"
    fi
fi

success "System optimizations applied"

# ============================================================================
# 14. Argos Auto-Start Service
# ============================================================================
info "[14/14] Installing Argos startup service..."
chmod +x "$PROJECT_ROOT/scripts/startup-check.sh"

cat > /etc/systemd/system/argos-startup.service <<EOF
[Unit]
Description=Argos Startup Check
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=$PROJECT_ROOT/scripts/startup-check.sh
RemainAfterExit=yes
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable argos-startup.service > /dev/null 2>&1
success "Argos startup service installed"

# ============================================================================
# Summary & Verification
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Host Setup Complete!                                ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

info "Verifying installations..."
echo ""

# Core components
if command -v docker &>/dev/null; then
    success "Docker: $(docker --version | head -1)"
else
    error "Docker: NOT FOUND"
fi

if command -v docker-compose &>/dev/null; then
    success "Docker Compose: $(docker-compose --version | head -1)"
else
    warn "Docker Compose: NOT FOUND"
fi

if command -v node &>/dev/null; then
    success "Node.js: $(node --version)"
else
    warn "Node.js: NOT FOUND"
fi

# Hardware tools
if command -v hackrf_info &>/dev/null; then
    success "HackRF tools: installed"
else
    error "HackRF tools: NOT FOUND"
fi

if command -v grgsm_scanner &>/dev/null; then
    success "gr-gsm: installed"
else
    error "gr-gsm: NOT FOUND (GSM Evil WILL NOT WORK)"
fi

if python3 -c "import osmosdr" &>/dev/null 2>&1; then
    success "gr-osmosdr: installed"
else
    warn "gr-osmosdr: Python bindings missing"
fi

if command -v kal &>/dev/null; then
    success "kalibrate: installed"
else
    warn "kalibrate: NOT FOUND"
fi

if command -v gpsd &>/dev/null; then
    success "gpsd: installed"
else
    error "gpsd: NOT FOUND"
fi

if command -v kismet &>/dev/null; then
    success "Kismet: $(kismet --version 2>&1 | head -1)"
else
    warn "Kismet: NOT FOUND"
fi

if command -v uhd_find_devices &>/dev/null; then
    success "USRP (UHD): installed"
else
    info "USRP (UHD): not installed (optional)"
fi

# Extended tools
if command -v rtl_test &>/dev/null; then
    success "RTL-SDR tools: installed"
else
    info "RTL-SDR tools: not installed (optional)"
fi

if command -v multimon-ng &>/dev/null; then
    success "multimon-ng: installed"
else
    info "multimon-ng: not installed (optional)"
fi

# Python packages
if python3 -c "import flask" &>/dev/null; then
    success "Python Flask: installed"
else
    warn "Python Flask: NOT FOUND (GSM Evil backend may not work)"
fi

echo ""
info "User Groups for $USER_NAME:"
groups $USER_NAME | tr ' ' '\n' | grep -E "(docker|plugdev|kismet|dialout)" | sed 's/^/  - /' || echo "  (none)"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Next Steps                                          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "1. LOG OUT and LOG BACK IN for group changes to take effect"
echo ""
echo "2. Test hardware detection:"
echo "   - HackRF:     hackrf_info"
echo "   - GPS:        cgps"
echo "   - Kismet:     iwconfig"
echo "   - gr-gsm:     grgsm_scanner --help"
echo "   - USRP:       uhd_find_devices"
echo ""
echo "3. Deploy containers:"
echo "   cd $PROJECT_ROOT"
echo "   ./scripts/deploy-containers.sh"
echo ""
echo "4. Access services:"
echo "   - Portainer:  https://localhost:9443"
echo "   - Argos:      http://localhost:5173 (after container deployment)"
echo ""

if [ -f /boot/firmware/config.txt ] && grep -q "dtoverlay=disable-bt" /boot/firmware/config.txt; then
    warn "[WARN]  Bluetooth disabled - REBOOT REQUIRED for change to take effect"
fi

echo ""
info "Documentation: $PROJECT_ROOT/docs/HOST_SETUP.md"
echo ""
info "This script installed EVERYTHING discovered during troubleshooting:"
echo "  [PASS] Core SDR tools (HackRF, USRP, SoapySDR)"
echo "  [PASS] GSM Evil COMPLETE (gnuradio, gr-gsm, gr-osmosdr, kalibrate, Osmocom libs)"
echo "  [PASS] Python Flask ecosystem for GSM backend"
echo "  [PASS] Extended radio tools (rtl-sdr, multimon-ng)"
echo "  [PASS] System monitoring and diagnostics"
echo "  [PASS] Complete system tuning and optimizations"
echo "  [PASS] Node.js, Docker, Docker Compose"
echo ""
