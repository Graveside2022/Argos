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

# Resolve the upstream Debian codename for rolling-release distros (Kali, Parrot).
# Docker, NodeSource, and Kismetwireless repos don't have kali-rolling/parrot-rolling
# entries — they need the actual Debian codename (e.g. bookworm).
resolve_debian_codename() {
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  case "$codename" in
    kali-rolling|parrot-rolling|"")
      # Map to the Debian release these rolling distros are based on.
      # Kali 2024-2026+ and Parrot 6.x are based on Debian 12 (bookworm).
      echo "bookworm"
      ;;
    *)
      echo "$codename"
      ;;
  esac
}

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

# --- 1. Network Configuration ---
# Raspberry Pi OS often uses netplan to manage wlan0, which locks NetworkManager out.
# Argos needs: wlan0 = NM-managed (default WiFi), wlan1+ = unmanaged (Kismet capture).
echo "[1/13] Network configuration..."

configure_networking() {
  local changed=false

  # --- 1a. Move WiFi from netplan to NetworkManager ---
  if [[ -d /etc/netplan ]]; then
    for conf in /etc/netplan/*.yaml; do
      [[ -f "$conf" ]] || continue
      if grep -q 'wlan\|wifis' "$conf" 2>/dev/null; then
        echo "  Found netplan WiFi config in $(basename "$conf") — migrating to NetworkManager..."
        cp "$conf" "${conf}.bak.argos"
        # Rewrite to ethernets-only with NM renderer
        cat > "$conf" << 'NETPLAN'
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    eth0:
      optional: true
      dhcp4: true
      dhcp6: true
NETPLAN
        changed=true
        echo "  Backed up original to $(basename "$conf").bak.argos"
      fi
    done
    if [[ "$changed" == "true" ]]; then
      echo "  Applying netplan changes..."
      netplan apply 2>/dev/null || true
    fi
  fi

  # --- 1b. Mark secondary WiFi adapters as unmanaged (for Kismet) ---
  local NM_UNMANAGED_CONF="/etc/NetworkManager/conf.d/99-argos-kismet-unmanaged.conf"
  # Find all WiFi interfaces except the onboard one (wlan0)
  local secondary_macs=()
  for iface in /sys/class/net/wlan*; do
    [[ -e "$iface" ]] || continue
    local name
    name="$(basename "$iface")"
    [[ "$name" == "wlan0" ]] && continue
    local mac
    mac="$(ethtool -P "$name" 2>/dev/null | awk '{print $NF}')" || continue
    [[ -n "$mac" && "$mac" != "00:00:00:00:00:00" ]] && secondary_macs+=("$mac")
  done

  if [[ ${#secondary_macs[@]} -gt 0 ]]; then
    local mac_list
    mac_list=$(printf "mac:%s;" "${secondary_macs[@]}")
    # Remove trailing semicolon
    mac_list="${mac_list%;}"
    if [[ -f "$NM_UNMANAGED_CONF" ]] && grep -qF "$mac_list" "$NM_UNMANAGED_CONF" 2>/dev/null; then
      echo "  Secondary WiFi adapters already unmanaged: ${secondary_macs[*]}"
    else
      echo "  Marking secondary WiFi adapters as unmanaged (Kismet-only): ${secondary_macs[*]}"
      cat > "$NM_UNMANAGED_CONF" << EOF
# Argos: secondary WiFi adapters reserved for Kismet capture
# Do not let NetworkManager manage these — Kismet talks directly to nl80211
[keyfile]
unmanaged-devices=${mac_list}
EOF
      changed=true
    fi
  else
    echo "  No secondary WiFi adapters detected (plug in a USB WiFi for Kismet)"
  fi

  # Restart NM if we changed anything
  if [[ "$changed" == "true" ]] && systemctl is-active --quiet NetworkManager; then
    echo "  Restarting NetworkManager..."
    systemctl restart NetworkManager
    # Give NM a moment to reconnect wlan0
    sleep 3
  fi

  echo "  Network config done."
}

configure_networking

# --- 2. System packages ---
echo "[2/13] System packages..."
PACKAGES=(
  wireless-tools iw ethtool usbutils tmux zsh build-essential
  python3 python3-venv python3-pip
  libsqlite3-dev pkg-config
  curl wget git
  xvfb chromium earlyoom
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
echo "[3/13] Node.js..."
if command -v node &>/dev/null && command -v npm &>/dev/null; then
  NODE_VER="$(node --version)"
  echo "  Node.js $NODE_VER already installed (npm $(npm --version))"
else
  if command -v node &>/dev/null; then
    echo "  Node.js found but npm missing — installing from NodeSource..."
  else
    echo "  Installing Node.js 22.x via NodeSource..."
  fi
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  echo "  Installed Node.js $(node --version), npm $(npm --version)"
fi

# --- 3. Kismet ---
echo "[4/13] Kismet..."
if command -v kismet &>/dev/null; then
  echo "  Kismet already installed: $(kismet --version 2>&1 | head -1)"
else
  echo "  Installing Kismet..."
  if [[ "$OS_ID" == "kali" || "$OS_ID" == "parrot" ]]; then
    # Kali and Parrot carry Kismet in their own repos
    apt-get install -y -qq kismet
  else
    # Add kismetwireless repo for other Debian-based distros
    DEBIAN_CODENAME="$(resolve_debian_codename)"
    echo "  Using Debian codename: $DEBIAN_CODENAME"
    wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | gpg --dearmor -o /usr/share/keyrings/kismet-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release.$DEBIAN_CODENAME $DEBIAN_CODENAME main" > /etc/apt/sources.list.d/kismet.list
    apt-get update -qq
    apt-get install -y -qq kismet
  fi
fi

# --- 4. gpsd ---
echo "[5/13] gpsd..."
if command -v gpsd &>/dev/null; then
  echo "  gpsd already installed"
else
  echo "  Installing gpsd..."
  apt-get install -y -qq gpsd gpsd-clients
fi

# --- 5. Docker (for third-party tools only) ---
echo "[6/13] Docker..."
if command -v docker &>/dev/null; then
  echo "  Docker already installed: $(docker --version)"
else
  echo "  Installing Docker..."
  # get.docker.com fails on rolling-release distros (Kali, Parrot) because it writes
  # "kali-rolling" or "parrot-rolling" into the apt repo URL, which Docker doesn't have.
  # Fix: install Docker's GPG key + repo manually with the resolved Debian codename.
  DEBIAN_CODENAME="$(resolve_debian_codename)"
  ARCH="$(dpkg --print-architecture)"
  echo "  Using Debian codename: $DEBIAN_CODENAME, arch: $ARCH"

  # Install prerequisites
  apt-get install -y -qq ca-certificates curl gnupg

  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/debian/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repo with the correct Debian codename (not kali-rolling)
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $DEBIAN_CODENAME stable" > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  usermod -aG docker "$SETUP_USER"
  echo "  Docker installed. User $SETUP_USER added to docker group."
fi

# --- 6. udev rules for SDR devices ---
echo "[7/13] udev rules..."
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
echo "[8/13] Kismet GPS config..."
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
echo "[9/13] npm dependencies..."
cd "$PROJECT_DIR"
if [[ -d node_modules ]]; then
  echo "  node_modules exists — running npm ci..."
else
  echo "  Installing dependencies..."
fi
sudo -u "$SETUP_USER" npm ci

# --- 9. .env from template ---
echo "[10/13] Environment file..."
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
  echo ""
  echo "  Stadia Maps provides vector map tiles for the tactical display."
  echo "  Get a free key at: https://stadiamaps.com/"
  echo "  (Without it, Argos will fall back to Google satellite tiles.)"
  echo ""
  read -rp "  Enter STADIA_MAPS_API_KEY (or press Enter to skip): " STADIA_KEY
  if [[ -n "$STADIA_KEY" ]]; then
    sed -i "s/^STADIA_MAPS_API_KEY=.*/STADIA_MAPS_API_KEY=$STADIA_KEY/" "$PROJECT_DIR/.env"
    echo "  STADIA_MAPS_API_KEY configured."
  else
    echo "  Skipped — map will use Google satellite fallback."
  fi
  echo ""
  echo "  OpenCellID provides a global cell tower database for the map display."
  echo "  Get a free key at: https://opencellid.org/"
  echo "  (Without it, cell tower overlay will not work.)"
  echo ""
  read -rp "  Enter OPENCELLID_API_KEY (or press Enter to skip): " OCID_KEY
  if [[ -n "$OCID_KEY" ]]; then
    sed -i "s/^OPENCELLID_API_KEY=.*/OPENCELLID_API_KEY=$OCID_KEY/" "$PROJECT_DIR/.env"
    echo "  OPENCELLID_API_KEY configured."
    echo ""
    echo "  Download the global cell tower database now? (~500MB download, takes a few minutes)"
    read -rp "  [Y/n]: " DL_TOWERS
    DL_TOWERS="${DL_TOWERS:-Y}"
    if [[ "$DL_TOWERS" =~ ^[Yy]$ ]]; then
      echo ""
      sudo -u "$SETUP_USER" bash "$PROJECT_DIR/scripts/ops/import-celltowers.sh"
    else
      echo ""
      echo "  To download later, run:"
      echo "    bash scripts/ops/import-celltowers.sh"
    fi
  else
    echo "  Skipped — cell tower overlay disabled."
  fi
  echo ""
  echo "  IMPORTANT: Edit .env to set Kismet, Bettercap, and OpenWebRX passwords"
fi

# --- 10. Development Monitor Service ---
echo "[11/13] Development Monitor Service..."
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
echo "[12/13] Configure EarlyOOM..."
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
echo "[13/13] Headless Debug Service..."
if [[ -f "$PROJECT_DIR/deployment/argos-headless.service" ]]; then
    echo "  Installing argos-headless.service..."
    cp "$PROJECT_DIR/deployment/argos-headless.service" "/etc/systemd/system/"
    systemctl daemon-reload
    systemctl enable argos-headless.service
    systemctl start argos-headless.service
    echo "  Headless debug service installed and started on port 9222."
else
    echo "  Warning: deployment/argos-headless.service not found. Skipping."
fi

echo ""
echo "=== Provisioning Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env to set service passwords"
echo "  2. npm run dev          — start development server"
echo "  3. sudo bash scripts/ops/install-services.sh  — install systemd services"
echo "  4. sudo systemctl start argos-final           — start production server"
echo ""
echo "To update API keys later:"
echo "  Edit .env and set STADIA_MAPS_API_KEY and/or OPENCELLID_API_KEY"
echo "  Then restart: npm run dev"
echo ""
echo "To import/refresh cell tower database:"
echo "  bash scripts/ops/import-celltowers.sh"
