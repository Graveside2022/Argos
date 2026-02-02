#!/bin/bash
#
# Argos Complete Host Setup Script
# Installs ALL host system dependencies for Argos hardware
#
# Usage: sudo bash scripts/setup-host-complete.sh
#

set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ Run as root: sudo bash scripts/setup-host-complete.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
USER_NAME="${SUDO_USER:-$(whoami)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Argos Complete Host System Setup                   ║"
echo "║   All hardware dependencies & optimizations           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
info "Project: $PROJECT_ROOT"
info "User: $USER_NAME"
echo ""

# ============================================================================
# 1. System Packages & Updates
# ============================================================================
info "[1/10] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
success "System updated"

info "Installing essential packages..."
apt-get install -y -qq \
    curl wget git unzip build-essential cmake pkg-config \
    libusb-1.0-0-dev libfftw3-dev \
    usbutils net-tools htop tree jq \
    python3 python3-pip python3-dev \
    gpsd gpsd-clients \
    > /dev/null 2>&1
success "Essential packages installed"

# ============================================================================
# 2. Docker
# ============================================================================
info "[2/10] Installing Docker..."
if command -v docker &>/dev/null; then
    success "Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
    systemctl enable docker
    systemctl start docker
    success "Docker installed"
fi

# Add user to docker group
usermod -aG docker "$USER_NAME"
success "User $USER_NAME added to docker group"

# ============================================================================
# 3. Portainer
# ============================================================================
info "[3/10] Installing Portainer..."
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
# 4. HackRF One
# ============================================================================
info "[4/10] Installing HackRF dependencies..."
apt-get install -y -qq \
    hackrf libhackrf-dev libhackrf0 \
    libsoapysdr-dev soapysdr-tools soapysdr-module-hackrf \
    > /dev/null 2>&1

# Configure udev rules
cat > /etc/udev/rules.d/53-hackrf.rules <<'EOF'
# HackRF One USB access
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
EOF

udevadm control --reload-rules
udevadm trigger
usermod -aG plugdev "$USER_NAME"
success "HackRF installed with udev rules"

# ============================================================================
# 5. GSM Evil (gr-gsm, kalibrate)
# ============================================================================
info "[5/10] Installing GSM Evil dependencies..."
apt-get install -y -qq \
    gnuradio gr-gsm \
    kalibrate-hackrf kalibrate-rtl \
    libosmocore-dev libosmo-dsp-dev \
    > /dev/null 2>&1 || warn "Some GSM packages unavailable on this system"

# Verify gr-gsm
if command -v grgsm_scanner &>/dev/null; then
    success "gr-gsm installed successfully"
else
    warn "gr-gsm not found - GSM Evil may require manual build"
fi

# ============================================================================
# 6. USRP (Optional)
# ============================================================================
info "[6/10] Installing USRP dependencies (optional)..."
if apt-cache show libuhd-dev &>/dev/null; then
    apt-get install -y -qq libuhd-dev uhd-host soapysdr-module-uhd > /dev/null 2>&1
    # Download firmware in background
    uhd_images_downloader > /dev/null 2>&1 &
    success "USRP support installed"
else
    warn "USRP packages not available - skipping"
fi

# ============================================================================
# 7. GPS Configuration
# ============================================================================
info "[7/10] Configuring GPS..."
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
# 8. Kismet WiFi Scanning
# ============================================================================
info "[8/10] Installing Kismet..."
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
# 9. System Optimizations
# ============================================================================
info "[9/10] Applying system optimizations..."

# USB buffer sizes for SDR
echo 'vm.max_map_count=262144' >> /etc/sysctl.conf 2>/dev/null || true

# File descriptor limits
cat >> /etc/security/limits.conf <<'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

# Apply immediately
sysctl -p > /dev/null 2>&1

# USB power optimization
cat > /etc/udev/rules.d/50-usb-power.rules <<'EOF'
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
# 10. Argos Auto-Start Service
# ============================================================================
info "[10/10] Installing Argos startup service..."
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

# Verify Docker
if command -v docker &>/dev/null; then
    success "Docker: $(docker --version | head -1)"
else
    error "Docker: NOT FOUND"
fi

# Verify HackRF
if command -v hackrf_info &>/dev/null; then
    success "HackRF tools: installed"
else
    error "HackRF tools: NOT FOUND"
fi

# Verify GSM tools
if command -v grgsm_scanner &>/dev/null; then
    success "gr-gsm: installed"
else
    warn "gr-gsm: NOT FOUND (GSM Evil may not work)"
fi

# Verify GPS
if command -v gpsd &>/dev/null; then
    success "gpsd: installed"
else
    error "gpsd: NOT FOUND"
fi

# Verify Kismet
if command -v kismet &>/dev/null; then
    success "Kismet: $(kismet --version 2>&1 | head -1)"
else
    warn "Kismet: NOT FOUND"
fi

# Verify USRP (optional)
if command -v uhd_find_devices &>/dev/null; then
    success "USRP (UHD): installed"
else
    info "USRP (UHD): not installed (optional)"
fi

echo ""
info "User Groups for $USER_NAME:"
groups $USER_NAME | tr ' ' '\n' | grep -E "(docker|plugdev|kismet|dialout)" | sed 's/^/  - /'

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Next Steps                                          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "1. LOG OUT and LOG BACK IN for group changes to take effect"
echo ""
echo "2. Test hardware detection:"
echo "   - HackRF:  hackrf_info"
echo "   - GPS:     cgps"
echo "   - Kismet:  iwconfig"
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
    warn "⚠️  Bluetooth disabled - REBOOT REQUIRED for change to take effect"
fi

echo ""
info "Documentation: $PROJECT_ROOT/docs/HOST_SETUP.md"
echo ""
