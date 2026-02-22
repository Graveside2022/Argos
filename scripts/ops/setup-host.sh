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
echo "[1/23] Network configuration..."

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
echo "[2/23] System packages..."
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

# --- 3. Node.js ---
echo "[3/23] Node.js..."
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

# --- 4. Kismet ---
echo "[4/23] Kismet..."
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

# --- 5. gpsd ---
echo "[5/23] gpsd..."
if command -v gpsd &>/dev/null; then
  echo "  gpsd already installed"
else
  echo "  Installing gpsd..."
  apt-get install -y -qq gpsd gpsd-clients
fi

# --- 6. Docker (for third-party tools only) ---
echo "[6/23] Docker..."
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

# --- 7. OpenSSH Server ---
echo "[7/23] OpenSSH server..."
if dpkg -s openssh-server &>/dev/null; then
  echo "  OpenSSH server already installed"
else
  echo "  Installing OpenSSH server..."
  apt-get install -y -qq openssh-server
fi
# Ensure sshd is enabled and running
if ! systemctl is-enabled --quiet ssh 2>/dev/null; then
  systemctl enable ssh
fi
if ! systemctl is-active --quiet ssh 2>/dev/null; then
  systemctl start ssh
  echo "  SSH server started"
else
  echo "  SSH server running"
fi

# --- 8. udev rules for SDR devices ---
echo "[8/23] udev rules..."
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

# --- 9. GSM Evil (gr-gsm + kalibrate-rtl + GsmEvil2) ---
echo "[9/23] GSM Evil..."
GSMEVIL_DIR="$SETUP_HOME/gsmevil2"
ARCH="$(dpkg --print-architecture)"

# Detect platform for gr-gsm install strategy
# - Ubuntu/Debian x86_64: gr-gsm available via PPA
# - Kali/Parrot (any arch): must build gr-gsm from source
# - Already installed: skip (detect grgsm_livemon_headless binary)
install_grgsm() {
  if command -v grgsm_livemon_headless &>/dev/null; then
    echo "  gr-gsm already installed ($(which grgsm_livemon_headless))"
    return 0
  fi

  # Install SDR hardware packages (available on all distros)
  for pkg in hackrf libhackrf-dev; do
    if dpkg -s "$pkg" &>/dev/null; then
      echo "  $pkg — already installed"
    else
      echo "  $pkg — installing..."
      apt-get install -y -qq "$pkg"
    fi
  done

  if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" ]] && [[ "$ARCH" == "amd64" ]]; then
    # Ubuntu/Debian x86_64: try the PPA first
    echo "  Trying gr-gsm via PPA (Ubuntu/Debian x86_64)..."
    if ! dpkg -s gr-gsm &>/dev/null; then
      add-apt-repository -y ppa:ptrkrysik/gr-gsm 2>/dev/null || true
      apt-get update -qq
      if apt-get install -y -qq gr-gsm 2>/dev/null; then
        echo "  gr-gsm installed via PPA"
        return 0
      else
        echo "  PPA install failed — falling back to source build..."
      fi
    fi
  fi

  # Kali, Parrot, or PPA failed: build gr-gsm from source
  echo "  Building gr-gsm from source ($OS_ID, $ARCH)..."

  # Build dependencies
  local BUILD_DEPS=(
    gnuradio gnuradio-dev gr-osmosdr
    libosmocore-dev
    cmake build-essential pkg-config
    libboost-all-dev libcppunit-dev
    swig doxygen
    python3-docutils
  )
  for pkg in "${BUILD_DEPS[@]}"; do
    if dpkg -s "$pkg" &>/dev/null; then
      echo "  $pkg — already installed"
    else
      echo "  $pkg — installing..."
      apt-get install -y -qq "$pkg" || echo "  WARNING: $pkg not available, build may fail"
    fi
  done

  # Clone and build
  local GRGSM_BUILD_DIR="/tmp/gr-gsm-build"
  rm -rf "$GRGSM_BUILD_DIR"
  git clone https://github.com/ptrkrysik/gr-gsm.git "$GRGSM_BUILD_DIR"
  cd "$GRGSM_BUILD_DIR"
  mkdir -p build && cd build
  cmake .. 2>&1 | tail -5
  echo "  Compiling gr-gsm (this takes a few minutes on ARM)..."
  make -j "$(nproc)" 2>&1 | tail -3
  make install
  ldconfig
  cd "$PROJECT_DIR"

  # Verify
  if command -v grgsm_livemon_headless &>/dev/null; then
    echo "  gr-gsm built and installed successfully"
    rm -rf "$GRGSM_BUILD_DIR"
    return 0
  else
    echo "  WARNING: gr-gsm build completed but grgsm_livemon_headless not found"
    echo "  GSM Evil will not work without gr-gsm. Check build output above."
    rm -rf "$GRGSM_BUILD_DIR"
    return 1
  fi
}

install_grgsm || true

# kalibrate-rtl — frequency scanner for finding nearby GSM base stations
echo "  Installing kalibrate-rtl..."
if command -v kal &>/dev/null; then
  echo "  kalibrate-rtl already installed ($(which kal))"
elif apt-cache show kalibrate-rtl &>/dev/null 2>&1; then
  # Available via apt (Kali has it in repos)
  apt-get install -y -qq kalibrate-rtl
  echo "  kalibrate-rtl installed via apt"
else
  # Build from source (Ubuntu/Debian/Parrot without the package)
  echo "  kalibrate-rtl not in repos — building from source..."
  apt-get install -y -qq librtlsdr-dev libfftw3-dev libtool automake autoconf 2>/dev/null || true
  KAL_BUILD_DIR="/tmp/kalibrate-rtl-build"
  rm -rf "$KAL_BUILD_DIR"
  git clone https://github.com/steve-m/kalibrate-rtl.git "$KAL_BUILD_DIR"
  cd "$KAL_BUILD_DIR"
  ./bootstrap && CXXFLAGS='-W -Wall -O3' ./configure && make -j "$(nproc)" && make install
  cd "$PROJECT_DIR"
  rm -rf "$KAL_BUILD_DIR"
  if command -v kal &>/dev/null; then
    echo "  kalibrate-rtl built and installed"
  else
    echo "  WARNING: kalibrate-rtl build failed — manual frequency entry will still work"
  fi
fi

# Clone or update GsmEvil2
if [[ -d "$GSMEVIL_DIR/.git" ]]; then
  echo "  GsmEvil2 already cloned — pulling latest..."
  sudo -u "$SETUP_USER" git -C "$GSMEVIL_DIR" pull --ff-only 2>/dev/null || true
else
  echo "  Cloning GsmEvil2..."
  sudo -u "$SETUP_USER" git clone https://github.com/ninjhacks/gsmevil2.git "$GSMEVIL_DIR"
fi

# Python virtual environment + dependencies (use upstream requirements.txt)
GSMEVIL_VENV="$GSMEVIL_DIR/venv"
if [[ -d "$GSMEVIL_VENV" ]] && "$GSMEVIL_VENV/bin/python" -c "import flask, pyshark" 2>/dev/null; then
  echo "  GsmEvil2 venv already exists with dependencies"
else
  echo "  Creating Python venv and installing dependencies..."
  sudo -u "$SETUP_USER" python3 -m venv "$GSMEVIL_VENV"
  if [[ -f "$GSMEVIL_DIR/requirements.txt" ]]; then
    sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet -r "$GSMEVIL_DIR/requirements.txt"
  else
    # Fallback if requirements.txt is missing from the clone
    sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet "flask==2.2.2" "flask_socketio==5.3.2" "pyshark==0.5.3"
  fi
  echo "  GsmEvil2 Python dependencies installed"
fi

# Set GSMEVIL_DIR in .env if not already present
if [[ -f "$PROJECT_DIR/.env" ]]; then
  if grep -q "^GSMEVIL_DIR=" "$PROJECT_DIR/.env"; then
    echo "  GSMEVIL_DIR already set in .env"
  else
    echo "GSMEVIL_DIR=$GSMEVIL_DIR" >> "$PROJECT_DIR/.env"
    echo "  GSMEVIL_DIR=$GSMEVIL_DIR added to .env"
  fi
fi

# --- 10. Kismet GPS config ---
echo "[10/23] Kismet GPS config..."
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

# --- 11. npm dependencies ---
echo "[11/23] npm dependencies..."
cd "$PROJECT_DIR"
if [[ -d node_modules ]]; then
  echo "  node_modules exists — running npm ci..."
else
  echo "  Installing dependencies..."
fi
sudo -u "$SETUP_USER" npm ci

# Verify node-pty native addon compiled successfully (required for terminal)
if sudo -u "$SETUP_USER" node -e "require('node-pty')" 2>/dev/null; then
  echo "  node-pty native addon OK"
else
  echo "  node-pty failed to load — rebuilding native addon..."
  sudo -u "$SETUP_USER" npm rebuild node-pty
  if sudo -u "$SETUP_USER" node -e "require('node-pty')" 2>/dev/null; then
    echo "  node-pty rebuilt successfully"
  else
    echo "  WARNING: node-pty still broken — terminal will be unavailable"
    echo "  Try: npm install node-pty --build-from-source"
  fi
fi

# --- 12. .env from template ---
echo "[12/23] Environment file..."
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

# Generate MCP config (.mcp.json) with API key from .env
echo "  Generating MCP server configuration..."
sudo -u "$SETUP_USER" bash -c "cd '$PROJECT_DIR' && npm run mcp:install-b"

# --- 13. Development Monitor Service ---
echo "[13/23] Development Monitor Service..."
if [[ -f "$PROJECT_DIR/deployment/argos-dev-monitor.service" ]]; then
  echo "  Installing argos-dev-monitor.service for user $SETUP_USER..."
  
  # Create user systemd directory
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
  
  # Template service file with actual project path
  sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    "$PROJECT_DIR/deployment/argos-dev-monitor.service" \
    > "$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service"
  chown "$SETUP_USER":"$SETUP_USER" "$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service"
  
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

# --- 14. EarlyOOM Configuration ---
echo "[14/23] Configure EarlyOOM..."
if [[ -f /etc/default/earlyoom ]]; then
  # Memory threshold: 10% RAM, 50% swap, check every 60s
  # Avoid list: system-critical + development tools + headless browser
  # Prefer list: only ollama (large model, recoverable)
  cat > /etc/default/earlyoom << 'EARLYOOM'
EARLYOOM_ARGS="-m 10 -s 50 -r 60 --avoid '(^|/)(init|sshd|tailscaled|NetworkManager|dockerd|systemd|node.*vscode|vite|chroma|Xvfb|chromium)$' --prefer '(^|/)(ollama|bun)$'"
EARLYOOM
  systemctl restart earlyoom
  echo "  EarlyOOM configured (protect: system + dev tools, prefer kill: ollama + bun daemons)."
else
  echo "  Warning: /etc/default/earlyoom not found. Install earlyoom first."
fi

# --- 15. cgroup Memory Limit (defense against runaway processes) ---
echo "[15/23] cgroup memory limit..."

# Detect the primary UID (the user who will run Argos)
SETUP_UID=$(id -u "$SETUP_USER")
SLICE_DIR="/etc/systemd/system/user-${SETUP_UID}.slice.d"
SLICE_CONF="$SLICE_DIR/memory-limit.conf"

# Calculate limits dynamically based on total RAM.
# Hybrid formula: reserve max(512 MiB, 5% of RAM) for kernel+system.
# - Small machines (4-8 GB RPi): reserves 512 MiB (tight but safe)
# - Large machines (32-128 GB x86): reserves 1.6-6.4 GiB (proportional headroom)
#   MemoryHigh (soft) = MemoryMax - 512 MiB → triggers aggressive reclaim before hard limit
#   MemoryMax  (hard) = total - reserve      → OOM-kills the process
TOTAL_MEM_BYTES=$(free -b | awk '/Mem:/ {print $2}')
TOTAL_MEM_MIB=$(( TOTAL_MEM_BYTES / 1048576 ))
RESERVE_PERCENT=$(( TOTAL_MEM_MIB * 5 / 100 ))
RESERVE_MIN=512
RESERVE_MIB=$(( RESERVE_PERCENT > RESERVE_MIN ? RESERVE_PERCENT : RESERVE_MIN ))
MEM_MAX_MIB=$(( TOTAL_MEM_MIB - RESERVE_MIB ))
MEM_HIGH_MIB=$(( MEM_MAX_MIB - 512 ))      # soft limit 512 MiB below hard limit

# Sanity check: don't set limits on machines with < 2 GiB
if [[ "$TOTAL_MEM_MIB" -lt 2048 ]]; then
  echo "  Skipping cgroup limits — only ${TOTAL_MEM_MIB} MiB RAM detected (need ≥ 2 GiB)"
else
  if [[ -f "$SLICE_CONF" ]]; then
    echo "  cgroup memory limit already configured at $SLICE_CONF"
    echo "  Current: $(grep 'MemoryHigh\|MemoryMax' "$SLICE_CONF" | tr '\n' ' ')"
  else
    echo "  Total RAM: ${TOTAL_MEM_MIB} MiB"
    echo "  Setting MemoryHigh=${MEM_HIGH_MIB}M (soft), MemoryMax=${MEM_MAX_MIB}M (hard)"
    echo "  Reserving ${RESERVE_MIB} MiB for kernel/system (max of 512M or 5%)"
    mkdir -p "$SLICE_DIR"
    cat > "$SLICE_CONF" << EOF
# Argos: Prevent user processes from consuming all system memory.
# Applies to ALL processes under user ${SETUP_UID} (${SETUP_USER}).
# Total RAM: ${TOTAL_MEM_MIB} MiB — reserves ${RESERVE_MIB} MiB for kernel/system.
#
# MemoryHigh = soft limit (kernel reclaims aggressively above this)
# MemoryMax  = hard limit (OOM-kills the process)
[Slice]
MemoryHigh=${MEM_HIGH_MIB}M
MemoryMax=${MEM_MAX_MIB}M
EOF
    systemctl daemon-reload
    echo "  cgroup memory limit installed. Active for new user sessions."
  fi
fi

# --- 16. Tailscale ---
echo "[16/23] Tailscale..."
if command -v tailscale &>/dev/null; then
  echo "  Tailscale already installed: $(tailscale version | head -1)"
else
  echo "  Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | bash
  echo "  Tailscale installed. Run 'sudo tailscale up' to authenticate."
fi

# --- 17. Claude Code ---
echo "[17/23] Claude Code..."
if sudo -u "$SETUP_USER" bash -c 'command -v claude' &>/dev/null; then
  echo "  Claude Code already installed"
else
  echo "  Installing Claude Code (native installer, no sudo)..."
  sudo -u "$SETUP_USER" bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
  echo "  Claude Code installed. Run 'claude' to authenticate."
fi

# --- 18. Gemini CLI ---
echo "[18/23] Gemini CLI..."
if sudo -u "$SETUP_USER" bash -c 'command -v gemini' &>/dev/null; then
  echo "  Gemini CLI already installed"
else
  echo "  Installing Gemini CLI..."
  sudo -u "$SETUP_USER" npm install -g @google/gemini-cli
  echo "  Gemini CLI installed. Run 'gemini' to authenticate."
fi

# --- 19. Agent Browser (Playwright-based browser automation for Claude Code) ---
echo "[19/23] Agent Browser..."
if sudo -u "$SETUP_USER" bash -c 'command -v agent-browser' &>/dev/null; then
  echo "  agent-browser already installed"
else
  echo "  Installing agent-browser..."
  sudo -u "$SETUP_USER" npm install -g agent-browser
fi
# Always ensure Chromium is available (handles partial installs)
echo "  Ensuring Chromium for agent-browser..."
sudo -u "$SETUP_USER" agent-browser install

# --- 20. ChromaDB (claude-mem vector search backend) ---
echo "[20/23] ChromaDB for claude-mem..."

# claude-mem runtime dependencies:
#   - bun: runs the worker daemon (worker-service.cjs)
#   - uv/uvx: spawns chroma-mcp subprocess for vector search
#   - pipx: installs chromadb CLI in isolated venv
#   - chromadb: the vector database server itself

# Install Bun (JavaScript runtime for claude-mem worker)
if sudo -u "$SETUP_USER" bash -c 'command -v bun' &>/dev/null; then
  echo "  Bun already installed: $(sudo -u "$SETUP_USER" bash -c 'bun --version' 2>/dev/null)"
else
  echo "  Installing Bun..."
  sudo -u "$SETUP_USER" bash -c 'curl -fsSL https://bun.sh/install | bash'
  echo "  Bun installed: $(sudo -u "$SETUP_USER" bash -c '$HOME/.bun/bin/bun --version' 2>/dev/null)"
fi

# Install uv (Python package runner — provides uvx for chroma-mcp)
if sudo -u "$SETUP_USER" bash -c 'command -v uv' &>/dev/null; then
  echo "  uv already installed: $(sudo -u "$SETUP_USER" bash -c 'uv --version' 2>/dev/null)"
else
  echo "  Installing uv..."
  sudo -u "$SETUP_USER" bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
  echo "  uv installed: $(sudo -u "$SETUP_USER" bash -c '$HOME/.local/bin/uv --version' 2>/dev/null)"
fi

# pipx is needed to install chromadb in an isolated venv
if ! sudo -u "$SETUP_USER" bash -c 'command -v pipx' &>/dev/null; then
  echo "  Installing pipx..."
  apt-get install -y -qq pipx
fi

# Install chromadb via pipx (provides the `chroma` CLI)
if sudo -u "$SETUP_USER" bash -c 'command -v chroma' &>/dev/null; then
  echo "  ChromaDB already installed: $(sudo -u "$SETUP_USER" bash -c 'chroma --version' 2>/dev/null)"
else
  echo "  Installing ChromaDB via pipx..."
  sudo -u "$SETUP_USER" pipx install chromadb
  echo "  ChromaDB installed: $(sudo -u "$SETUP_USER" bash -c 'chroma --version' 2>/dev/null)"
fi

# Create data directory
CHROMA_DATA_DIR="$SETUP_HOME/.claude-mem/chroma"
sudo -u "$SETUP_USER" mkdir -p "$CHROMA_DATA_DIR"

# Install systemd user service for ChromaDB
CHROMA_SERVICE="$SETUP_HOME/.config/systemd/user/chroma-server.service"
sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
cat > "$CHROMA_SERVICE" << EOF
[Unit]
Description=ChromaDB Vector Database Server (claude-mem)
After=network.target

[Service]
Type=simple
ExecStart=$SETUP_HOME/.local/bin/chroma run --path $CHROMA_DATA_DIR --host 127.0.0.1 --port 8000
ExecStartPost=/bin/sh -c 'for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://127.0.0.1:8000/api/v2/heartbeat && exit 0; sleep 2; done; exit 1'
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5
StandardOutput=journal
StandardError=journal

# OOM protection: earlyoom --avoid matches comm=chroma, so earlyoom won't kill this.
# OOMScoreAdjust=-200 requires CAP_SYS_NICE (unavailable in user services),
# so the actual oom_score_adj remains at the inherited value.
# The earlyoom avoid list is the real protection mechanism.
OOMScoreAdjust=-200

[Install]
WantedBy=default.target
EOF
chown "$SETUP_USER":"$SETUP_USER" "$CHROMA_SERVICE"

# Enable linger so user services survive logout (required for headless reboots)
loginctl enable-linger "$SETUP_USER"

# Enable and start
sudo -u "$SETUP_USER" systemctl --user daemon-reload
sudo -u "$SETUP_USER" systemctl --user enable chroma-server
sudo -u "$SETUP_USER" systemctl --user restart chroma-server

# Set CHROMA_SSL=false for chroma-mcp client (defaults to SSL=true in 0.2.6+)
# See: https://github.com/chroma-core/chroma-mcp/issues/49
# Three layers ensure the env var reaches chroma-mcp regardless of login method:
#   1. /etc/environment — PAM-level, read on any SSH/Termius/local login
#   2. ~/.config/environment.d/ — systemd user services and spawned processes
#   3. ~/.zshenv — interactive zsh sessions (belt-and-suspenders)
if grep -q "^CHROMA_SSL=false$" /etc/environment 2>/dev/null; then
  echo "  CHROMA_SSL=false already set in /etc/environment"
else
  # Remove any stale CHROMA_SSL line (e.g. CHROMA_SSL=true) before appending
  sed -i '/^CHROMA_SSL=/d' /etc/environment 2>/dev/null || true
  echo "  Setting CHROMA_SSL=false in /etc/environment..."
  echo 'CHROMA_SSL=false' >> /etc/environment
fi

ENVD_DIR="$SETUP_HOME/.config/environment.d"
sudo -u "$SETUP_USER" mkdir -p "$ENVD_DIR"
sudo -u "$SETUP_USER" tee "$ENVD_DIR/chroma.conf" > /dev/null << 'ENVD_CONTENT'
# ChromaDB MCP client: disable SSL for local server connections
# Required because chroma-mcp 0.2.6+ defaults to SSL=true
# See: https://github.com/chroma-core/chroma-mcp/issues/49
CHROMA_SSL=false
ENVD_CONTENT
# Import into running systemd user session immediately (environment.d is only read at login)
sudo -u "$SETUP_USER" bash -c "CHROMA_SSL=false systemctl --user import-environment CHROMA_SSL" 2>/dev/null || true
echo "  Created $ENVD_DIR/chroma.conf"

ZSHENV="$SETUP_HOME/.zshenv"
if [[ -f "$ZSHENV" ]] && grep -q "^export CHROMA_SSL=" "$ZSHENV"; then
  echo "  CHROMA_SSL already set in .zshenv"
else
  echo "  Setting CHROMA_SSL=false in .zshenv..."
  cat >> "$ZSHENV" << 'ZSHENV_CONTENT'

# ChromaDB MCP client: disable SSL for local server connections
# Required because chroma-mcp 0.2.6+ defaults to SSL=true
export CHROMA_SSL=false
ZSHENV_CONTENT
  chown "$SETUP_USER":"$SETUP_USER" "$ZSHENV"
fi

# Update claude-mem settings if they exist
CLAUDE_MEM_SETTINGS="$SETUP_HOME/.claude-mem/settings.json"
if [[ -f "$CLAUDE_MEM_SETTINGS" ]]; then
  if grep -q '"CLAUDE_MEM_CHROMA_MODE": "local"' "$CLAUDE_MEM_SETTINGS"; then
    echo "  Switching claude-mem chroma mode to remote..."
    sed -i 's/"CLAUDE_MEM_CHROMA_MODE": "local"/"CLAUDE_MEM_CHROMA_MODE": "remote"/' "$CLAUDE_MEM_SETTINGS"
  else
    echo "  claude-mem chroma mode already set"
  fi
else
  echo "  claude-mem settings not found (will be created on first run)"
fi

echo "  ChromaDB service installed and running on port 8000."

# --- 21. Zsh + Dotfiles ---
echo "[21/23] Zsh + Dotfiles..."
DOTFILES_REPO="https://github.com/Graveside2022/raspberry-pi-dotfiles.git"
DOTFILES_DIR="$SETUP_HOME/.dotfiles"

# Clone or update the dotfiles repo
if [[ -d "$DOTFILES_DIR/.git" ]]; then
  echo "  Dotfiles repo already cloned — pulling latest..."
  sudo -u "$SETUP_USER" git -C "$DOTFILES_DIR" pull --ff-only 2>/dev/null || true
else
  echo "  Cloning dotfiles from $DOTFILES_REPO..."
  sudo -u "$SETUP_USER" git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
fi

# Oh My Zsh
if [[ -d "$SETUP_HOME/.oh-my-zsh" ]]; then
  echo "  Oh My Zsh already installed"
else
  echo "  Installing Oh My Zsh..."
  sudo -u "$SETUP_USER" sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

ZSH_CUSTOM="$SETUP_HOME/.oh-my-zsh/custom"

# Powerlevel10k theme
if [[ -d "$ZSH_CUSTOM/themes/powerlevel10k" ]]; then
  echo "  Powerlevel10k already installed"
else
  echo "  Installing Powerlevel10k theme..."
  sudo -u "$SETUP_USER" git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$ZSH_CUSTOM/themes/powerlevel10k"
fi

# Zsh plugins
for plugin in zsh-autosuggestions zsh-syntax-highlighting zsh-completions; do
  if [[ -d "$ZSH_CUSTOM/plugins/$plugin" ]]; then
    echo "  $plugin already installed"
  else
    echo "  Installing $plugin..."
    case "$plugin" in
      zsh-autosuggestions)
        sudo -u "$SETUP_USER" git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/$plugin" ;;
      zsh-syntax-highlighting)
        sudo -u "$SETUP_USER" git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$ZSH_CUSTOM/plugins/$plugin" ;;
      zsh-completions)
        sudo -u "$SETUP_USER" git clone https://github.com/zsh-users/zsh-completions "$ZSH_CUSTOM/plugins/$plugin" ;;
    esac
  fi
done

# TPM (Tmux Plugin Manager)
TPM_DIR="$SETUP_HOME/.tmux/plugins/tpm"
if [[ -d "$TPM_DIR/.git" ]]; then
  echo "  TPM already installed"
else
  echo "  Installing TPM (Tmux Plugin Manager)..."
  sudo -u "$SETUP_USER" git clone https://github.com/tmux-plugins/tpm "$TPM_DIR"
fi

# Copy project tmux.conf as user default (contains plugin declarations)
echo "  Installing tmux.conf..."
sudo -u "$SETUP_USER" cp "$PROJECT_DIR/scripts/tmux/tmux.conf" "$SETUP_HOME/.tmux.conf"

# Install tmux plugins non-interactively (resurrect + continuum)
echo "  Installing tmux plugins (resurrect, continuum)..."
sudo -u "$SETUP_USER" "$TPM_DIR/bin/install_plugins" || true

# FiraCode Nerd Font
FONT_DIR="$SETUP_HOME/.local/share/fonts/FiraCode"
if [[ -d "$FONT_DIR" ]] && sudo -u "$SETUP_USER" fc-list 2>/dev/null | grep -qi "FiraCode Nerd Font"; then
  echo "  FiraCode Nerd Font already installed"
else
  echo "  Installing FiraCode Nerd Font..."
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.local/share/fonts"
  FIRA_ZIP="$(mktemp /tmp/FiraCode.XXXXXX.zip)"
  curl -fsSL -o "$FIRA_ZIP" https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/FiraCode.zip
  sudo -u "$SETUP_USER" unzip -o "$FIRA_ZIP" -d "$FONT_DIR"
  rm -f "$FIRA_ZIP"
  sudo -u "$SETUP_USER" fc-cache -f "$SETUP_HOME/.local/share/fonts"
  echo "  FiraCode Nerd Font installed"
fi

# Atuin (shell history)
if sudo -u "$SETUP_USER" bash -c 'command -v atuin' &>/dev/null; then
  echo "  Atuin already installed"
else
  echo "  Installing Atuin..."
  sudo -u "$SETUP_USER" bash -c 'curl --proto "=https" --tlsv1.2 -LsSf https://setup.atuin.sh | sh'
  echo "  Atuin installed"
fi

# Copy dotfiles config
if [[ -f "$DOTFILES_DIR/zshrc" ]]; then
  echo "  Installing .zshrc and .p10k.zsh..."
  sudo -u "$SETUP_USER" cp "$DOTFILES_DIR/zshrc" "$SETUP_HOME/.zshrc"
  [[ -f "$DOTFILES_DIR/p10k.zsh" ]] && sudo -u "$SETUP_USER" cp "$DOTFILES_DIR/p10k.zsh" "$SETUP_HOME/.p10k.zsh"
else
  echo "  Warning: dotfiles repo missing zshrc. Skipping config copy."
fi

# --- 22. Set Zsh as default shell ---
echo "[22/23] Default shell..."
CURRENT_SHELL="$(getent passwd "$SETUP_USER" | cut -d: -f7)"
if [[ "$CURRENT_SHELL" == */zsh ]]; then
  echo "  $SETUP_USER already using zsh"
else
  echo "  Changing default shell for $SETUP_USER to zsh..."
  chsh -s "$(command -v zsh)" "$SETUP_USER"
  echo "  Default shell set to zsh (takes effect on next login)"
fi

# --- 23. Headless Debug Service ---
echo "[23/23] Headless Debug Service..."
if [[ -f "$PROJECT_DIR/deployment/argos-headless.service" ]]; then
    echo "  Installing argos-headless.service..."
    sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__SETUP_USER__|$SETUP_USER|g" \
        "$PROJECT_DIR/deployment/argos-headless.service" \
        > "/etc/systemd/system/argos-headless.service"
    systemctl daemon-reload
    systemctl enable argos-headless.service
    systemctl start argos-headless.service
    echo "  Headless debug service installed and started on port 9224."
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
