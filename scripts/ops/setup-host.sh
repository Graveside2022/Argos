#!/usr/bin/env bash
# Argos Host Provisioning Script
# Idempotent setup for Kali Linux or Parrot OS on Raspberry Pi 5
# Usage: sudo bash scripts/ops/setup-host.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Detect OS
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_NAME="${PRETTY_NAME:-Unknown}"
else
  echo "Error: Cannot detect OS (no /etc/os-release)" >&2
  exit 1
fi

# Detect user (who invoked sudo)
SETUP_USER="${SUDO_USER:-$(whoami)}"
SETUP_HOME="$(eval echo ~"$SETUP_USER")"

echo "=== Argos Host Provisioning ==="
echo "OS:      $OS_NAME"
echo "User:    $SETUP_USER"
echo "Home:    $SETUP_HOME"
echo "Project: $PROJECT_DIR"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo "Error: Must run as root (sudo)" >&2
  exit 1
fi

# --- 1. System packages ---
echo "[1/12] System packages..."
PACKAGES=(
  wireless-tools iw usbutils tmux zsh build-essential
  python3 python3-venv python3-pip
  libsqlite3-dev pkg-config
  curl wget git
  xvfb chromium chromium-driver earlyoom
)
apt-get update -qq
for pkg in "${PACKAGES[@]}"; do
  if dpkg -s "$pkg" &>/dev/null; then
    echo "  $pkg — already installed"
  else
    echo "  $pkg — installing..."
    apt-get install -y -qq "$pkg"
  fi
done

# --- 2. Node.js ---
echo "[2/12] Node.js..."
if command -v node &>/dev/null; then
  NODE_VER="$(node --version)"
  echo "  Node.js $NODE_VER already installed"
else
  echo "  Installing Node.js 22.x via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  echo "  Installed Node.js $(node --version)"
fi

# --- 3. Kismet ---
echo "[3/12] Kismet..."
if command -v kismet &>/dev/null; then
  echo "  Kismet already installed: $(kismet --version 2>&1 | head -1)"
else
  echo "  Installing Kismet from official repo..."
  if [[ "$OS_ID" == "kali" ]]; then
    # Kismet is in Kali repos
    apt-get install -y -qq kismet
  else
    # Add kismetwireless repo for other Debian-based distros
    wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | gpg --dearmor -o /usr/share/keyrings/kismet-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release.$(lsb_release -cs) $(lsb_release -cs) main" > /etc/apt/sources.list.d/kismet.list
    apt-get update -qq
    apt-get install -y -qq kismet
  fi
fi

# --- 4. gpsd ---
echo "[4/12] gpsd..."
if command -v gpsd &>/dev/null; then
  echo "  gpsd already installed"
else
  echo "  Installing gpsd..."
  apt-get install -y -qq gpsd gpsd-clients
fi

# --- 5. Docker (for third-party tools only) ---
echo "[5/12] Docker..."
if command -v docker &>/dev/null; then
  echo "  Docker already installed: $(docker --version)"
else
  echo "  Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$SETUP_USER"
  echo "  Docker installed. User $SETUP_USER added to docker group."
fi

# --- 6. udev rules for SDR devices ---
echo "[6/12] udev rules..."
UDEV_FILE="/etc/udev/rules.d/99-sdr.rules"
if [[ -f "$UDEV_FILE" ]]; then
  echo "  SDR udev rules already exist"
else
  echo "  Installing SDR udev rules..."
  cat > "$UDEV_FILE" << 'UDEV'
# HackRF One
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# RTL-SDR
ATTR{idVendor}=="0bda", ATTR{idProduct}=="2838", MODE="0666", GROUP="plugdev"
ATTR{idVendor}=="0bda", ATTR{idProduct}=="2832", MODE="0666", GROUP="plugdev"
UDEV
  udevadm control --reload-rules
  udevadm trigger
  usermod -aG plugdev "$SETUP_USER" 2>/dev/null || true
fi

# --- 7. Kismet GPS config ---
echo "[7/12] Kismet GPS config..."
KISMET_CONF="/etc/kismet/kismet.conf"
if [[ -f "$KISMET_CONF" ]]; then
  if grep -q "gps=gpsd:host=localhost" "$KISMET_CONF"; then
    echo "  Kismet GPS already configured"
  else
    echo "  Adding GPS config to kismet.conf..."
    echo "gps=gpsd:host=localhost,port=2947" >> "$KISMET_CONF"
  fi
else
  echo "  Kismet config not found at $KISMET_CONF — configure after installation"
fi

# --- 8. npm dependencies ---
echo "[8/12] npm dependencies..."
cd "$PROJECT_DIR"
if [[ -d node_modules ]]; then
  echo "  node_modules exists — running npm ci..."
else
  echo "  Installing dependencies..."
fi
sudo -u "$SETUP_USER" npm ci

# --- 9. .env from template ---
echo "[9/12] Environment file..."
if [[ -f "$PROJECT_DIR/.env" ]]; then
  echo "  .env already exists — not overwriting"
else
  echo "  Creating .env from template..."
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  # Generate API key
  API_KEY="$(openssl rand -hex 32)"
  sed -i "s/^ARGOS_API_KEY=.*/ARGOS_API_KEY=$API_KEY/" "$PROJECT_DIR/.env"
  chown "$SETUP_USER":"$SETUP_USER" "$PROJECT_DIR/.env"
  chmod 600 "$PROJECT_DIR/.env"
  echo "  .env created with auto-generated ARGOS_API_KEY"
  echo "  IMPORTANT: Edit .env to set Kismet, Bettercap, and OpenWebRX passwords"
fi

# --- 10. Development Monitor Service ---
echo "[10/12] Development Monitor Service..."
if [[ -f "$PROJECT_DIR/deployment/argos-dev-monitor.service" ]]; then
  echo "  Installing argos-dev-monitor.service for user $SETUP_USER..."
  
  # Create user systemd directory
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
  
  # Copy service file
  sudo -u "$SETUP_USER" cp "$PROJECT_DIR/deployment/argos-dev-monitor.service" "$SETUP_HOME/.config/systemd/user/"
  
  # Enable and start service
  # We use sudo -u to run systemctl as the target user
  # XDG_RUNTIME_DIR is needed for user systemd interaction
  USER_ID=$(id -u "$SETUP_USER")
  export XDG_RUNTIME_DIR="/run/user/$USER_ID"
  
  sudo -u "$SETUP_USER" systemctl --user daemon-reload
  sudo -u "$SETUP_USER" systemctl --user enable argos-dev-monitor
  sudo -u "$SETUP_USER" systemctl --user restart argos-dev-monitor
  
  echo "  Dev monitor service installed and started."
else
  echo "  Warning: deployment/argos-dev-monitor.service not found. Skipping."
fi

# --- 11. EarlyOOM Configuration ---
echo "[11/12] Configure EarlyOOM..."
if [[ -f /etc/default/earlyoom ]]; then
  # Memory threshold: 10% RAM, 50% swap, check every 60s
  # Avoid list: system-critical + development tools + headless browser
  # Prefer list: only ollama (large model, recoverable)
  cat > /etc/default/earlyoom << 'EARLYOOM'
EARLYOOM_ARGS="-m 10 -s 50 -r 60 --avoid '(^|/)(init|sshd|tailscaled|NetworkManager|dockerd|systemd|node.*vscode|claude|vite|chroma|Xvfb|chromium)$' --prefer '(^|/)(ollama)$'"
EARLYOOM
  systemctl restart earlyoom
  echo "  EarlyOOM configured (protect: system + dev tools + headless browser, prefer kill: ollama)."
else
  echo "  Warning: /etc/default/earlyoom not found. Install earlyoom first."
fi

# --- 12. Headless Debug Service ---
echo "[12/12] Headless Debug Service..."
if [[ -f "$PROJECT_DIR/deployment/argos-headless.service" ]]; then
    echo "  Installing argos-headless.service..."
    sudo cp "$PROJECT_DIR/deployment/argos-headless.service" "/etc/systemd/system/"
    sudo systemctl daemon-reload
    sudo systemctl enable argos-headless.service
    sudo systemctl start argos-headless.service
    echo "  Headless debug service installed and started on port 9222."
fi

echo ""
echo "=== Provisioning Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env to set service passwords"
echo "  2. npm run dev          — start development server"
echo "  3. sudo bash scripts/ops/install-services.sh  — install systemd services"
echo "  4. sudo systemctl start argos-final           — start production server"
