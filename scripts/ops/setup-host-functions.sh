#!/usr/bin/env bash
# Argos install function library — sourced by setup-host-ui.mjs
# Do not run directly.
#
# Required env vars (set by the Node.js caller):
#   SETUP_USER, SETUP_HOME, PROJECT_DIR, SCRIPT_DIR
#   OS_ID, NON_INTERACTIVE
#
# Optional env vars (for install_env_file):
#   STADIA_KEY, OCID_KEY, DOWNLOAD_TOWERS
#
# Optional env var (for _is_selected):
#   SELECTED_COMPONENTS — comma-separated list of selected component IDs

set -euo pipefail

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Error: This file is a library. Source it, don't run it." >&2
  echo "Usage: source ${BASH_SOURCE[0]}" >&2
  exit 1
fi

# =============================================
# HELPERS
# =============================================

# Resolve the upstream Debian codename for rolling-release distros (Kali, Parrot).
# Docker, NodeSource, and Kismetwireless repos don't have kali-rolling/parrot-rolling
# entries — they need the actual Debian codename (e.g. bookworm).
resolve_debian_codename() {
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  case "$codename" in
    kali-rolling|parrot-rolling|"")
      echo "bookworm"
      ;;
    *)
      echo "$codename"
      ;;
  esac
}

# Install a package if not already installed (idempotent, single package)
_ensure_pkg() {
  local pkg="$1"
  if dpkg -s "$pkg" &>/dev/null; then
    echo "  $pkg — already installed"
  else
    echo "  $pkg — installing..."
    apt-get install -y -q "$pkg" || echo "  WARNING: $pkg not available in repos"
  fi
}

# Install a list of packages (space-separated or array)
_ensure_pkgs() {
  for pkg in "$@"; do _ensure_pkg "$pkg"; done
}

# Check if a command exists for SETUP_USER (not root)
_user_has_cmd() {
  sudo -u "$SETUP_USER" bash -c 'command -v "$1"' -- "$1" &>/dev/null
}

# Enable and start a systemd user service for SETUP_USER
_enable_user_service() {
  local service="$1"
  local user_id
  user_id=$(id -u "$SETUP_USER")
  loginctl enable-linger "$SETUP_USER" 2>/dev/null || true
  export XDG_RUNTIME_DIR="/run/user/$user_id"
  sudo -u "$SETUP_USER" systemctl --user daemon-reload
  sudo -u "$SETUP_USER" systemctl --user enable "$service"
  sudo -u "$SETUP_USER" systemctl --user restart "$service"
}

# Read/write JSON settings via python3 (avoids jq dependency)
# Usage: _json_has_key FILE "key" → exit 0 if present
_json_has_key() {
  python3 - "$1" "$2" << 'PYEOF' 2>/dev/null
import json, sys
with open(sys.argv[1]) as f:
    s = json.load(f)
sys.exit(0 if sys.argv[2] in s else 1)
PYEOF
}

# Usage: _json_set_key FILE "key" '{"nested": "value"}'
_json_set_key() {
  python3 - "$1" "$2" "$3" << 'PYEOF'
import json, sys
fpath, key, raw_val = sys.argv[1], sys.argv[2], sys.argv[3]
with open(fpath) as f:
    s = json.load(f)
s[key] = json.loads(raw_val)
with open(fpath, 'w') as f:
    json.dump(s, f, indent=2)
    f.write('\n')
PYEOF
}

# Usage: _json_deep_has FILE "path.to.key" "expected_value"
_json_deep_has() {
  python3 - "$1" "$2" "$3" << 'PYEOF' 2>/dev/null
import json, sys
fpath, path, expected = sys.argv[1], sys.argv[2], sys.argv[3]
with open(fpath) as f:
    s = json.load(f)
keys = path.split('.')
obj = s
for k in keys[:-1]:
    obj = obj.get(k, {})
sys.exit(0 if obj.get(keys[-1]) == expected else 1)
PYEOF
}

# Usage: _json_deep_set FILE "path.to.key" "value"
_json_deep_set() {
  python3 - "$1" "$2" "$3" << 'PYEOF'
import json, sys
fpath, path, value = sys.argv[1], sys.argv[2], sys.argv[3]
with open(fpath) as f:
    s = json.load(f)
keys = path.split('.')
obj = s
for k in keys[:-1]:
    obj = obj.setdefault(k, {})
obj[keys[-1]] = value
with open(fpath, 'w') as f:
    json.dump(s, f, indent=2)
    f.write('\n')
PYEOF
}

# Clone a git repo or pull latest if already cloned
_clone_or_pull() {
  local repo="$1" dir="$2"
  if [[ -d "$dir/.git" ]]; then
    echo "  $(basename "$dir") already cloned — pulling latest..."
    sudo -u "$SETUP_USER" git -C "$dir" pull --ff-only 2>/dev/null || \
      echo "  $(basename "$dir") — pull skipped (shallow clone or diverged)"
  else
    echo "  Cloning $(basename "$dir")..."
    sudo -u "$SETUP_USER" git clone ${3:+--depth=1} "$repo" "$dir"
  fi
}

# Check if a component was selected (reads SELECTED_COMPONENTS env var)
_is_selected() {
  [[ ",${SELECTED_COMPONENTS:-}," == *",$1,"* ]]
}

# =============================================
# INSTALL FUNCTIONS
# =============================================

install_network() {
  local changed=false

  # 1a. Move WiFi from netplan to NetworkManager
  if [[ -d /etc/netplan ]]; then
    for conf in /etc/netplan/*.yaml; do
      [[ -f "$conf" ]] || continue
      if grep -q 'wlan\|wifis' "$conf" 2>/dev/null; then
        echo "  Found netplan WiFi config in $(basename "$conf") — migrating to NetworkManager..."
        cp "$conf" "${conf}.bak.argos"
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

  # 1b. Mark secondary WiFi adapters as unmanaged (for Kismet)
  local NM_UNMANAGED_CONF="/etc/NetworkManager/conf.d/99-argos-kismet-unmanaged.conf"
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

  # 1c. DNS defense: NetworkManager fallback DNS
  local NM_DNS_CONF="/etc/NetworkManager/conf.d/01-argos-dns-fallback.conf"
  local NM_DNS_MODE
  NM_DNS_MODE=$(grep -s 'dns=' /etc/NetworkManager/NetworkManager.conf | head -1 || true)
  echo "  NM DNS plugin: ${NM_DNS_MODE:-default}"
  if [[ ! -f "$NM_DNS_CONF" ]]; then
    echo "  Installing NetworkManager DNS fallback (8.8.8.8, 1.1.1.1)..."
    mkdir -p /etc/NetworkManager/conf.d
    cat > "$NM_DNS_CONF" << 'DNSCONF'
# Argos: Fallback DNS servers for NetworkManager
# Ensures resolv.conf always has nameservers even when no NM-managed
# connection provides DNS (e.g., eth0 managed by ifupdown, not NM).
# These are only used when Tailscale DNS (accept-dns) is disabled.
[global-dns-domain-*]
servers=8.8.8.8,1.1.1.1
DNSCONF
    changed=true
  else
    echo "  NetworkManager DNS fallback already configured."
  fi

  # Restart NM if we changed anything
  if [[ "$changed" == "true" ]] && systemctl is-active --quiet NetworkManager; then
    echo "  Restarting NetworkManager..."
    systemctl restart NetworkManager
    sleep 3
  fi

  echo "  Network config done."
}

install_system_packages() {
  apt-get update -q
  _ensure_pkgs \
    wireless-tools iw ethtool usbutils tmux zsh build-essential \
    python3 python3-venv python3-pip \
    libsqlite3-dev pkg-config \
    curl wget git \
    xvfb chromium earlyoom
}

install_nodejs() {
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
    apt-get install -y -q nodejs
    echo "  Installed Node.js $(node --version), npm $(npm --version)"
  fi
}

install_gpsd() {
  _ensure_pkgs gpsd gpsd-clients
}

install_openssh() {
  _ensure_pkg openssh-server
  systemctl is-enabled --quiet ssh 2>/dev/null || systemctl enable ssh
  if systemctl is-active --quiet ssh 2>/dev/null; then
    echo "  SSH server running"
  else
    systemctl start ssh
    echo "  SSH server started"
  fi
}

install_udev_sdr() {
  UDEV_FILE="/etc/udev/rules.d/99-sdr.rules"
  UDEV_CONTENT='# HackRF One
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
# RTL-SDR (RTL2832U / RTL2838)
ATTR{idVendor}=="0bda", ATTR{idProduct}=="2838", MODE="0666", GROUP="plugdev"
ATTR{idVendor}=="0bda", ATTR{idProduct}=="2832", MODE="0666", GROUP="plugdev"
# Ettus Research USRP B200/B205mini/B210
ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666", GROUP="plugdev"
ATTR{idVendor}=="2500", ATTR{idProduct}=="0022", MODE="0666", GROUP="plugdev"
ATTR{idVendor}=="2500", ATTR{idProduct}=="0023", MODE="0666", GROUP="plugdev"'

  if [[ -f "$UDEV_FILE" ]] && grep -q "2500" "$UDEV_FILE"; then
    echo "  SDR udev rules already include USRP"
  else
    echo "  Installing SDR udev rules..."
    echo "$UDEV_CONTENT" > "$UDEV_FILE"
    udevadm control --reload-rules
    udevadm trigger
    usermod -aG plugdev "$SETUP_USER" 2>/dev/null || true
  fi
}

install_sdr_infra() {
  _ensure_pkgs soapysdr-tools uhd-host soapysdr-module-hackrf soapysdr-module-rtlsdr soapysdr0.8-module-uhd

  # Download UHD firmware images (required for B200-series USRPs)
  UHD_IMAGES_DIR="/usr/share/uhd/images"
  if [[ -f "$UHD_IMAGES_DIR/usrp_b200_fw.hex" ]]; then
    echo "  UHD firmware images already present"
  else
    echo "  Downloading UHD firmware images (~100MB)..."
    if command -v uhd_images_downloader &>/dev/null; then
      uhd_images_downloader --types "b2xx" 2>&1 | tail -3
      echo "  UHD B2xx firmware images downloaded"
    else
      UHD_DOWNLOADER="/usr/libexec/uhd/utils/uhd_images_downloader.py"
      if [[ -f "$UHD_DOWNLOADER" ]]; then
        python3 "$UHD_DOWNLOADER" --types "b2xx" 2>&1 | tail -3
        echo "  UHD B2xx firmware images downloaded"
      else
        echo "  WARNING: UHD images downloader not found — USRP devices will not work"
        echo "  Try: sudo apt install uhd-host && sudo uhd_images_downloader --types b2xx"
      fi
    fi

    # Symlink versioned path to expected location
    UHD_VERSIONED_DIR=$(find /usr/share/uhd -maxdepth 2 -name "images" -type d ! -path "$UHD_IMAGES_DIR" 2>/dev/null | head -1)
    if [[ -n "${UHD_VERSIONED_DIR:-}" && ! -e "$UHD_IMAGES_DIR" ]]; then
      ln -sf "$UHD_VERSIONED_DIR" "$UHD_IMAGES_DIR"
      echo "  Symlinked $UHD_IMAGES_DIR → $UHD_VERSIONED_DIR"
    fi
  fi
}

install_npm_deps() {
  cd "$PROJECT_DIR"
  if [[ -d node_modules ]]; then
    echo "  node_modules exists — running npm ci..."
  else
    echo "  Installing dependencies..."
  fi
  sudo -u "$SETUP_USER" npm ci

  # Verify node-pty native addon
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

  # Ensure ops scripts are executable
  chmod +x "$PROJECT_DIR"/scripts/ops/*.sh "$PROJECT_DIR"/scripts/dev/*.sh 2>/dev/null || true
  echo "  Scripts marked executable"
}

install_env_file() {
  if [[ -f "$PROJECT_DIR/.env" ]]; then
    echo "  .env already exists — not overwriting"
  else
    echo "  Creating .env from template..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    API_KEY="$(openssl rand -hex 32)"
    # API_KEY is hex-only (safe for sed). Use | delimiter for user-entered keys.
    sed -i "s|^ARGOS_API_KEY=.*|ARGOS_API_KEY=$API_KEY|" "$PROJECT_DIR/.env"
    # Verify the key was actually written (guards against .env.example format changes)
    if ! grep -q "^ARGOS_API_KEY=" "$PROJECT_DIR/.env"; then
      echo "ARGOS_API_KEY=$API_KEY" >> "$PROJECT_DIR/.env"
    fi
    chown "$SETUP_USER":"$SETUP_USER" "$PROJECT_DIR/.env"
    chmod 600 "$PROJECT_DIR/.env"
    echo "  .env created with auto-generated ARGOS_API_KEY"

    # API keys — injected by Node.js UI via env vars (empty = skip)
    # Use python3 for safe substitution (user-entered keys may contain sed metacharacters)
    if [[ -n "${STADIA_KEY:-}" ]]; then
      python3 - "$PROJECT_DIR/.env" "STADIA_MAPS_API_KEY" "$STADIA_KEY" << 'PYEOF'
import re, sys
fpath, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(fpath).read()
content = re.sub(rf'^{re.escape(key)}=.*', f'{key}={val}', content, flags=re.M)
open(fpath, 'w').write(content)
PYEOF
      echo "  STADIA_MAPS_API_KEY configured."
    fi
    if [[ -n "${OCID_KEY:-}" ]]; then
      python3 - "$PROJECT_DIR/.env" "OPENCELLID_API_KEY" "$OCID_KEY" << 'PYEOF'
import re, sys
fpath, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(fpath).read()
content = re.sub(rf'^{re.escape(key)}=.*', f'{key}={val}', content, flags=re.M)
open(fpath, 'w').write(content)
PYEOF
      echo "  OPENCELLID_API_KEY configured."
      if [[ "${DOWNLOAD_TOWERS:-}" == "true" ]]; then
        echo "  Downloading cell tower database..."
        sudo -u "$SETUP_USER" bash "$PROJECT_DIR/scripts/ops/import-celltowers.sh"
      fi
    fi

    echo "  IMPORTANT: Edit .env to set Kismet, Bettercap, and OpenWebRX passwords"
  fi

  # Generate MCP config (.mcp.json) with API key from .env
  echo "  Generating MCP server configuration..."
  sudo -u "$SETUP_USER" bash -c "cd '$PROJECT_DIR' && npm run mcp:install-b" || echo "  WARNING: MCP config generation failed (non-fatal)"
}

install_earlyoom() {
  _ensure_pkg earlyoom
  # Create config file if the package didn't provide one
  [[ -f /etc/default/earlyoom ]] || touch /etc/default/earlyoom
  cat > /etc/default/earlyoom << 'EARLYOOM'
EARLYOOM_ARGS="-m 10 -s 50 -r 60 --avoid '(^|/)(init|sshd|tailscaled|NetworkManager|dockerd|systemd|node.*vscode|vite|chroma|Xvfb|chromium)$' --prefer '(^|/)(ollama|bun)$'"
EARLYOOM
  systemctl enable earlyoom
  systemctl restart earlyoom
  echo "  EarlyOOM configured (trigger: 10% free, protect: system + dev tools, prefer kill: ollama + bun)."
}

install_cgroup_mem() {
  SETUP_UID=$(id -u "$SETUP_USER")
  SLICE_DIR="/etc/systemd/system/user-${SETUP_UID}.slice.d"
  SLICE_CONF="$SLICE_DIR/memory-limit.conf"

  TOTAL_MEM_BYTES=$(free -b | awk '/Mem:/ {print $2}')
  TOTAL_MEM_MIB=$(( TOTAL_MEM_BYTES / 1048576 ))
  RESERVE_PERCENT=$(( TOTAL_MEM_MIB * 25 / 1000 ))
  RESERVE_MIN=200
  RESERVE_MIB=$(( RESERVE_PERCENT > RESERVE_MIN ? RESERVE_PERCENT : RESERVE_MIN ))
  MEM_MAX_MIB=$(( TOTAL_MEM_MIB - RESERVE_MIB ))
  MEM_HIGH_MIB=$(( MEM_MAX_MIB - 200 ))

  if [[ "$TOTAL_MEM_MIB" -lt 2048 ]]; then
    echo "  Skipping cgroup limits — only ${TOTAL_MEM_MIB} MiB RAM detected (need >= 2 GiB)"
  elif [[ -f "$SLICE_CONF" ]]; then
    echo "  cgroup memory limit already configured at $SLICE_CONF"
    echo "  Current: $(grep 'MemoryHigh\|MemoryMax' "$SLICE_CONF" | tr '\n' ' ')"
  else
    echo "  Total RAM: ${TOTAL_MEM_MIB} MiB"
    echo "  Setting MemoryHigh=${MEM_HIGH_MIB}M (soft), MemoryMax=${MEM_MAX_MIB}M (hard)"
    echo "  Reserving ${RESERVE_MIB} MiB for kernel/system (max of 200M or 2.5%)"
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
}

install_docker() {
  if command -v docker &>/dev/null; then
    echo "  Docker already installed: $(docker --version)"
  else
    echo "  Installing Docker..."
    DEBIAN_CODENAME="$(resolve_debian_codename)"
    ARCH="$(dpkg --print-architecture)"
    echo "  Using Debian codename: $DEBIAN_CODENAME, arch: $ARCH"
    apt-get install -y -q ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/debian/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $DEBIAN_CODENAME stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -q
    apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker "$SETUP_USER"
    echo "  Docker installed. User $SETUP_USER added to docker group."
  fi
}

_install_grgsm() {
  if command -v grgsm_livemon_headless &>/dev/null; then
    echo "  gr-gsm already installed"
    return 0
  fi

  _ensure_pkgs hackrf libhackrf-dev

  local ARCH
  ARCH="$(dpkg --print-architecture)"
  if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" ]] && [[ "$ARCH" == "amd64" ]]; then
    if ! dpkg -s gr-gsm &>/dev/null; then
      add-apt-repository -y ppa:ptrkrysik/gr-gsm 2>/dev/null || true
      apt-get update -q
      apt-get install -y -q gr-gsm 2>/dev/null && return 0
      echo "  PPA install failed — falling back to source build..."
    fi
  fi

  echo "  Building gr-gsm from source ($OS_ID, $ARCH)..."
  _ensure_pkgs gnuradio gnuradio-dev gr-osmosdr libosmocore-dev \
    cmake build-essential pkg-config libboost-all-dev libcppunit-dev swig doxygen python3-docutils

  local GRGSM_BUILD_DIR="/tmp/gr-gsm-build"
  rm -rf "$GRGSM_BUILD_DIR"
  git clone https://github.com/ptrkrysik/gr-gsm.git "$GRGSM_BUILD_DIR"
  cd "$GRGSM_BUILD_DIR" && mkdir -p build && cd build
  cmake .. 2>&1 | tail -5
  echo "  Compiling gr-gsm (this takes a few minutes on ARM)..."
  make -j "$(nproc)" 2>&1 | tail -3
  make install && ldconfig
  cd "$PROJECT_DIR"
  rm -rf "$GRGSM_BUILD_DIR"

  command -v grgsm_livemon_headless &>/dev/null || {
    echo "  WARNING: gr-gsm build failed — GSM Evil will not work"
    return 1
  }
}

_install_kalibrate() {
  if command -v kal &>/dev/null; then
    echo "  kalibrate-rtl already installed"
    return 0
  fi
  if apt-cache show kalibrate-rtl &>/dev/null 2>&1; then
    apt-get install -y -q kalibrate-rtl
    return 0
  fi
  echo "  Building kalibrate-rtl from source..."
  _ensure_pkgs librtlsdr-dev libfftw3-dev libtool automake autoconf
  local KAL_BUILD_DIR="/tmp/kalibrate-rtl-build"
  rm -rf "$KAL_BUILD_DIR"
  git clone https://github.com/steve-m/kalibrate-rtl.git "$KAL_BUILD_DIR"
  cd "$KAL_BUILD_DIR"
  ./bootstrap && CXXFLAGS='-W -Wall -O3' ./configure && make -j "$(nproc)" && make install
  cd "$PROJECT_DIR"
  rm -rf "$KAL_BUILD_DIR"
  command -v kal &>/dev/null || echo "  WARNING: kalibrate-rtl build failed — manual frequency entry still works"
}

install_gsm_evil() {
  local GSMEVIL_DIR="$SETUP_HOME/gsmevil2"

  _install_grgsm || true
  _install_kalibrate || true

  _clone_or_pull "https://github.com/ninjhacks/gsmevil2.git" "$GSMEVIL_DIR"

  # Python virtual environment + dependencies
  local GSMEVIL_VENV="$GSMEVIL_DIR/venv"
  if [[ -d "$GSMEVIL_VENV" ]] && "$GSMEVIL_VENV/bin/python" -c "import flask, pyshark" 2>/dev/null; then
    echo "  GsmEvil2 venv OK"
  else
    echo "  Creating Python venv and installing dependencies..."
    sudo -u "$SETUP_USER" python3 -m venv "$GSMEVIL_VENV"
    if [[ -f "$GSMEVIL_DIR/requirements.txt" ]]; then
      sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet -r "$GSMEVIL_DIR/requirements.txt"
    else
      sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet "flask==2.2.2" "flask_socketio==5.3.2" "pyshark==0.5.3"
    fi
  fi

  # Set GSMEVIL_DIR in .env
  if [[ -f "$PROJECT_DIR/.env" ]] && ! grep -q "^GSMEVIL_DIR=" "$PROJECT_DIR/.env"; then
    echo "GSMEVIL_DIR=$GSMEVIL_DIR" >> "$PROJECT_DIR/.env"
    echo "  GSMEVIL_DIR=$GSMEVIL_DIR added to .env"
  fi
}

install_dev_monitor() {
  if [[ -f "$PROJECT_DIR/deployment/argos-dev-monitor.service" ]]; then
    echo "  Installing argos-dev-monitor.service for user $SETUP_USER..."
    sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
    sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
      "$PROJECT_DIR/deployment/argos-dev-monitor.service" \
      > "$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service"
    chown "$SETUP_USER":"$SETUP_USER" "$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service"
    _enable_user_service argos-dev-monitor
    echo "  Dev monitor service installed and started."
  else
    echo "  Warning: deployment/argos-dev-monitor.service not found. Skipping."
  fi
}

install_zram() {
  if systemctl is-active --quiet zram-swap 2>/dev/null; then
    echo "  zram-swap already active"
  else
    echo "  Installing zram-swap systemd service..."
    cat > /etc/systemd/system/zram-swap.service << 'ZRAM_UNIT'
[Unit]
Description=Configure zram swap device
After=local-fs.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'modprobe zram && DEV=$(zramctl --find --size 4G --algorithm zstd) && mkswap "$DEV" && swapon -p 100 "$DEV" && echo "$DEV" > /run/zram-swap-device'
ExecStop=/bin/bash -c 'DEV=$(cat /run/zram-swap-device 2>/dev/null || echo /dev/zram0); swapoff "$DEV" 2>/dev/null; zramctl --reset "$DEV" 2>/dev/null; rm -f /run/zram-swap-device; true'

[Install]
WantedBy=multi-user.target
ZRAM_UNIT
    systemctl daemon-reload
    systemctl enable zram-swap
    systemctl start zram-swap
    echo "  zram-swap installed and active (4 GB zstd compressed)."
  fi
}

install_textmode() {
  # Patch /etc/lightdm/Xsession with has_option() if missing
  XSESSION_FILE="/etc/lightdm/Xsession"
  if [[ -f "$XSESSION_FILE" ]]; then
    if grep -q "has_option()" "$XSESSION_FILE"; then
      echo "  has_option() already patched in Xsession"
    else
      echo "  Patching $XSESSION_FILE with has_option() function..."
      sed -i '/^errormsg () {/,/^}/{
        /^}$/a\
\
# has_option() - required by /etc/X11/Xsession.d/ scripts\
# Reads OPTIONFILE and checks if an option is present\
has_option() {\
    if [ -f "$OPTIONFILE" ]; then\
        grep -qs "^$1" "$OPTIONFILE"\
        return $?\
    fi\
    return 1\
}
      }' "$XSESSION_FILE"
      echo "  has_option() patched into Xsession"
    fi
  else
    echo "  No /etc/lightdm/Xsession found (LightDM may not be installed)"
  fi

  # Disable lightdm and switch to text-mode boot
  local CURRENT_TARGET
  CURRENT_TARGET=$(systemctl get-default 2>/dev/null || true)
  if [[ "$CURRENT_TARGET" == "multi-user.target" ]]; then
    echo "  Already booting in text mode (multi-user.target)"
  else
    echo "  Switching from $CURRENT_TARGET to multi-user.target..."
    systemctl set-default multi-user.target
    if systemctl is-enabled --quiet lightdm 2>/dev/null; then
      systemctl disable lightdm
      echo "  LightDM disabled."
    fi
    echo "  Text-mode boot configured. Desktop will not start on next reboot."
  fi
}

install_vnc() {
  _ensure_pkgs tigervnc-standalone-server tigervnc-tools socat

  # Ensure parent dirs are user-owned (not root)
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config"
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd"
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"

  # VNC socket unit
  VNC_SOCKET="$SETUP_HOME/.config/systemd/user/vnc-ondemand.socket"
  echo "  Installing vnc-ondemand.socket (port 5901)..."
  cat > "$VNC_SOCKET" << 'VNC_SOCKET_UNIT'
[Unit]
Description=On-demand VNC socket (port 5901)

[Socket]
ListenStream=5901
Accept=false
FreeBind=true
ReusePort=true

[Install]
WantedBy=sockets.target
VNC_SOCKET_UNIT
  chown "$SETUP_USER":"$SETUP_USER" "$VNC_SOCKET"

  # VNC proxy service
  VNC_SERVICE="$SETUP_HOME/.config/systemd/user/vnc-ondemand.service"
  cat > "$VNC_SERVICE" << 'VNC_SERVICE_UNIT'
[Unit]
Description=On-demand VNC proxy (triggers VNC server)
Requires=vnc-backend.service
After=vnc-backend.service

[Service]
ExecStartPre=/bin/bash -c 'for i in $(seq 1 30); do ss -tln | grep -q ":5911 " && exit 0; sleep 0.5; done; echo "vnc-backend port 5911 not ready after 15s" >&2; exit 1'
ExecStart=/usr/bin/socat ACCEPT-FD:3 TCP:127.0.0.1:5911
ExecStopPost=/usr/bin/systemd-run --user --no-block systemctl --user stop vnc-backend.service
TimeoutStopSec=5
StandardOutput=journal
StandardError=journal
VNC_SERVICE_UNIT
  chown "$SETUP_USER":"$SETUP_USER" "$VNC_SERVICE"

  # VNC backend service
  VNC_BACKEND="$SETUP_HOME/.config/systemd/user/vnc-backend.service"
  cat > "$VNC_BACKEND" << 'VNC_BACKEND_UNIT'
[Unit]
Description=TigerVNC Server (on-demand backend)
After=syslog.target network.target

[Service]
Type=forking
PIDFile=%h/.config/tigervnc/%H:11.pid
ExecStart=/usr/bin/vncserver :11 -localhost -geometry 1920x1200 -depth 24 -rfbport 5911
ExecStop=/usr/bin/vncserver -kill :11
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
MemoryMax=1200M
OOMScoreAdjust=300
VNC_BACKEND_UNIT
  chown "$SETUP_USER":"$SETUP_USER" "$VNC_BACKEND"

  # VNC password — skip in non-interactive/Node.js mode
  VNC_PASSWD_FILE="$SETUP_HOME/.vnc/passwd"
  if [[ -f "$VNC_PASSWD_FILE" ]]; then
    echo "  VNC password already set"
  else
    echo "  NOTE: VNC password not set. Run manually: vncpasswd ~/.vnc/passwd"
  fi

  _enable_user_service vnc-ondemand.socket
  echo "  On-demand VNC installed. Connect to port 5901 with any VNC viewer."
  echo "  The desktop starts when you connect and stops when you disconnect."
}

install_tailscale() {
  if command -v tailscale &>/dev/null; then
    echo "  Tailscale already installed: $(tailscale version | head -1)"
  else
    echo "  Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | bash
    echo "  Tailscale installed."
  fi

  if command -v tailscale &>/dev/null; then
    local TS_STATUS
    TS_STATUS=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | head -1 || true)
    if [[ "$TS_STATUS" == *"Running"* ]]; then
      echo "  Ensuring Tailscale DNS is enabled (accept-dns=true)..."
      tailscale set --accept-dns=true
      echo "  Tailscale DNS configured — resolv.conf managed by Tailscale."
    else
      echo "  Tailscale not yet authenticated. Run 'sudo tailscale up' to connect."
      echo "  Then run: sudo tailscale set --accept-dns=true"
    fi
  fi

  # DNS health check
  if ! grep -q '^nameserver' /etc/resolv.conf 2>/dev/null; then
    echo "  WARNING: /etc/resolv.conf has no nameservers!"
    echo "  Fallback: echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf"
  else
    echo "  DNS health check: OK ($(grep -c '^nameserver' /etc/resolv.conf) nameservers)"
  fi
}

install_claude_code() {
  if _user_has_cmd claude; then
    echo "  Claude Code already installed"
  else
    echo "  Installing Claude Code (native installer, no sudo)..."
    sudo -u "$SETUP_USER" bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
    echo "  Claude Code installed. Run 'claude' to authenticate."
  fi

  # Configure ccstatusline (shows context usage + git info in Claude Code UI)
  local CLAUDE_SETTINGS="$SETUP_HOME/.claude/settings.json"
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.claude"
  local STATUSLINE_VAL='{"type": "command", "command": "npx -y ccstatusline@latest", "padding": 0}'
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if _json_has_key "$CLAUDE_SETTINGS" statusLine; then
      echo "  ccstatusline already configured"
    else
      echo "  Adding ccstatusline to Claude Code settings..."
      _json_set_key "$CLAUDE_SETTINGS" statusLine "$STATUSLINE_VAL"
      chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
    fi
  else
    echo "  Creating Claude Code settings with ccstatusline..."
    sudo -u "$SETUP_USER" tee "$CLAUDE_SETTINGS" > /dev/null <<< "{\"statusLine\": $STATUSLINE_VAL}"
  fi
}

install_gemini_cli() {
  if _user_has_cmd gemini; then
    echo "  Gemini CLI already installed"
  else
    echo "  Installing Gemini CLI..."
    sudo -u "$SETUP_USER" npm install -g @google/gemini-cli
    echo "  Gemini CLI installed. Run 'gemini' to authenticate."
  fi
}

install_agent_browser() {
  if _user_has_cmd agent-browser; then
    echo "  agent-browser already installed"
  else
    echo "  Installing agent-browser..."
    sudo -u "$SETUP_USER" npm install -g agent-browser
  fi
  echo "  Ensuring Chromium for agent-browser..."
  sudo -u "$SETUP_USER" bash -lc 'agent-browser install'
}

_install_chroma_runtimes() {
  if _user_has_cmd bun; then
    echo "  Bun already installed"
  else
    echo "  Installing Bun..."
    sudo -u "$SETUP_USER" bash -c 'curl -fsSL https://bun.sh/install | bash'
  fi
  if _user_has_cmd uv; then
    echo "  uv already installed"
  else
    echo "  Installing uv..."
    sudo -u "$SETUP_USER" bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
  fi
  _user_has_cmd pipx || _ensure_pkg pipx
  if _user_has_cmd chroma; then
    echo "  ChromaDB already installed"
  else
    echo "  Installing ChromaDB via pipx..."
    sudo -u "$SETUP_USER" pipx install chromadb
  fi
}

_install_chroma_service() {
  local CHROMA_DATA_DIR="$SETUP_HOME/.claude-mem/chroma"
  sudo -u "$SETUP_USER" mkdir -p "$CHROMA_DATA_DIR"

  local CHROMA_SERVICE="$SETUP_HOME/.config/systemd/user/chroma-server.service"
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
OOMScoreAdjust=-200

[Install]
WantedBy=default.target
EOF
  chown "$SETUP_USER":"$SETUP_USER" "$CHROMA_SERVICE"
  _enable_user_service chroma-server
}

_propagate_chroma_ssl() {
  # Layer 1: /etc/environment (PAM-level, all logins)
  if grep -q "^CHROMA_SSL=false$" /etc/environment 2>/dev/null; then
    echo "  CHROMA_SSL=false already in /etc/environment"
  else
    sed -i '/^CHROMA_SSL=/d' /etc/environment 2>/dev/null || true
    echo 'CHROMA_SSL=false' >> /etc/environment
    echo "  Set CHROMA_SSL=false in /etc/environment"
  fi

  # Layer 2: systemd environment.d
  local ENVD_DIR="$SETUP_HOME/.config/environment.d"
  sudo -u "$SETUP_USER" mkdir -p "$ENVD_DIR"
  sudo -u "$SETUP_USER" tee "$ENVD_DIR/chroma.conf" > /dev/null <<< 'CHROMA_SSL=false'
  sudo -u "$SETUP_USER" bash -c "CHROMA_SSL=false systemctl --user import-environment CHROMA_SSL" 2>/dev/null || true

  # Layer 3: .zshenv (interactive shells)
  local ZSHENV="$SETUP_HOME/.zshenv"
  if [[ -f "$ZSHENV" ]] && grep -q "^export CHROMA_SSL=" "$ZSHENV"; then
    echo "  CHROMA_SSL already in .zshenv"
  else
    echo 'export CHROMA_SSL=false' >> "$ZSHENV"
    chown "$SETUP_USER":"$SETUP_USER" "$ZSHENV"
  fi

  # Layer 4: Claude Code settings.json env field
  local CLAUDE_SETTINGS="$SETUP_HOME/.claude/settings.json"
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if _json_deep_has "$CLAUDE_SETTINGS" "env.CHROMA_SSL" "false"; then
      echo "  CHROMA_SSL already in Claude Code settings.json"
    else
      echo "  Adding CHROMA_SSL=false to Claude Code settings.json..."
      _json_deep_set "$CLAUDE_SETTINGS" "env.CHROMA_SSL" "false"
      chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
    fi
  fi

  # claude-mem: switch from local to remote mode
  local CLAUDE_MEM_SETTINGS="$SETUP_HOME/.claude-mem/settings.json"
  if [[ -f "$CLAUDE_MEM_SETTINGS" ]] && grep -q '"CLAUDE_MEM_CHROMA_MODE": "local"' "$CLAUDE_MEM_SETTINGS"; then
    sed -i 's/"CLAUDE_MEM_CHROMA_MODE": "local"/"CLAUDE_MEM_CHROMA_MODE": "remote"/' "$CLAUDE_MEM_SETTINGS"
    echo "  Switched claude-mem chroma mode to remote"
  fi
}

_install_chroma_cleanup_hook() {
  local CLAUDE_SETTINGS="$SETUP_HOME/.claude/settings.json"
  local CLAUDE_HOOKS_DIR="$SETUP_HOME/.claude/hooks"
  local HOOK_SCRIPT="$CLAUDE_HOOKS_DIR/ensure-chroma-env.sh"
  sudo -u "$SETUP_USER" mkdir -p "$CLAUDE_HOOKS_DIR"
  sudo -u "$SETUP_USER" tee "$HOOK_SCRIPT" > /dev/null << 'HOOK_CONTENT'
#!/usr/bin/env bash
set -u
# Kill stale orphaned claude-mem workers (>30s old) to prevent memory bloat.
# Ensure surviving worker has CHROMA_SSL=false.
MIN_AGE_SECS=30
NOW=$(date +%s)
for pid in $(pgrep -f 'worker-service.cjs --daemon' 2>/dev/null); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    parent_comm=$(ps -o comm= -p "$ppid" 2>/dev/null | tr -d ' ')
    if [ "$ppid" = "1" ] || [ "$parent_comm" = "systemd" ]; then
        start_time=$(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$NOW")
        age=$((NOW - start_time))
        [ "$age" -ge "$MIN_AGE_SECS" ] && kill "$pid" 2>/dev/null
    fi
done
WORKER_PID=$(pgrep -f 'worker-service.cjs --daemon' 2>/dev/null | head -1)
if [ -n "${WORKER_PID:-}" ]; then
    tr '\0' '\n' < "/proc/$WORKER_PID/environ" 2>/dev/null | grep -q '^CHROMA_SSL=false$' || kill "$WORKER_PID" 2>/dev/null
fi
exit 0
HOOK_CONTENT
  chmod +x "$HOOK_SCRIPT"

  # Register as SessionStart hook in Claude Code settings
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if python3 -c "
import json, sys
with open('$CLAUDE_SETTINGS') as f:
    s = json.load(f)
for entry in s.get('hooks', {}).get('SessionStart', []):
    for h in entry.get('hooks', []):
        if 'ensure-chroma-env' in h.get('command', ''):
            sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
      echo "  SessionStart hook already registered"
    else
      echo "  Registering cleanup hook..."
      python3 -c "
import json
with open('$CLAUDE_SETTINGS') as f:
    s = json.load(f)
s.setdefault('hooks', {}).setdefault('SessionStart', []).append({
    'hooks': [{'type': 'command', 'command': '$HOOK_SCRIPT', 'timeout': 10}]
})
with open('$CLAUDE_SETTINGS', 'w') as f:
    json.dump(s, f, indent=2)
    f.write('\n')
"
      chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
    fi
  fi
}

install_chromadb() {
  _install_chroma_runtimes
  _install_chroma_service
  _propagate_chroma_ssl
  _install_chroma_cleanup_hook
  echo "  ChromaDB service installed and running on port 8000."
}

_install_zsh_plugins() {
  local ZSH_CUSTOM="$SETUP_HOME/.oh-my-zsh/custom"

  # Oh My Zsh
  if [[ ! -d "$SETUP_HOME/.oh-my-zsh" ]]; then
    echo "  Installing Oh My Zsh..."
    sudo -u "$SETUP_USER" sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
  fi

  _clone_or_pull "https://github.com/romkatv/powerlevel10k.git" "$ZSH_CUSTOM/themes/powerlevel10k" shallow
  _clone_or_pull "https://github.com/zsh-users/zsh-autosuggestions" "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
  _clone_or_pull "https://github.com/zsh-users/zsh-syntax-highlighting.git" "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
  _clone_or_pull "https://github.com/zsh-users/zsh-completions" "$ZSH_CUSTOM/plugins/zsh-completions"
}

_install_tmux_config() {
  local TPM_DIR="$SETUP_HOME/.tmux/plugins/tpm"
  _clone_or_pull "https://github.com/tmux-plugins/tpm" "$TPM_DIR"
  sudo -u "$SETUP_USER" cp "$PROJECT_DIR/scripts/tmux/tmux.conf" "$SETUP_HOME/.tmux.conf"
  echo "  Installing tmux plugins..."
  sudo -u "$SETUP_USER" "$TPM_DIR/bin/install_plugins" || true
}

_install_firacode_font() {
  local FONT_DIR="$SETUP_HOME/.local/share/fonts/FiraCode"
  if [[ -d "$FONT_DIR" ]] && sudo -u "$SETUP_USER" fc-list 2>/dev/null | grep -qi "FiraCode Nerd Font"; then
    echo "  FiraCode Nerd Font already installed"
    return 0
  fi
  echo "  Installing FiraCode Nerd Font..."
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.local/share/fonts"
  local FIRA_ZIP
  FIRA_ZIP="$(mktemp /tmp/FiraCode.XXXXXX.zip)"
  curl -fsSL -o "$FIRA_ZIP" https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/FiraCode.zip
  sudo -u "$SETUP_USER" unzip -o "$FIRA_ZIP" -d "$FONT_DIR"
  rm -f "$FIRA_ZIP"
  sudo -u "$SETUP_USER" fc-cache -f "$SETUP_HOME/.local/share/fonts"
}

_inject_tmux_autoattach() {
  local ZSHRC="$SETUP_HOME/.zshrc"
  local TMUX_MARKER="# Tmux auto-attach for SSH sessions"
  if [[ ! -f "$ZSHRC" ]]; then
    echo "  Skipping tmux auto-attach — .zshrc not found"
    return 0
  fi
  if grep -qF "$TMUX_MARKER" "$ZSHRC"; then
    echo "  Tmux auto-attach already present in .zshrc"
    return 0
  fi
  echo "  Injecting tmux auto-attach block into .zshrc..."
  local TMUX_BLOCK
  TMUX_BLOCK="$(cat << 'TMUX_EOF'

# ========================================
# Tmux auto-attach for SSH sessions
# ========================================
if [[ -n "$SSH_CONNECTION" ]] && [[ -z "$TMUX" ]] && [[ $- == *i* ]] \
   && [[ -z "$VSCODE_INJECTION" ]] && [[ -z "$VSCODE_GIT_ASKPASS_NODE" ]]; then
    _mem_pct=$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (t-a)*100/t}' /proc/meminfo 2>/dev/null)
    if (( _mem_pct < 90 )); then
        if tmux has-session -t dev1 2>/dev/null; then
            exec tmux attach-session -t dev1
        else
            exec tmux new-session -s dev1 -c "$HOME/Documents/Argos/Argos"
        fi
    else
        echo "[tmux skip] Memory at ${_mem_pct}% (>90%) — attaching to tmux skipped to avoid OOM"
    fi
    unset _mem_pct
fi

TMUX_EOF
)"
  if grep -qn "Enable Powerlevel10k instant prompt" "$ZSHRC"; then
    local P10K_LINE
    P10K_LINE=$(grep -n "Enable Powerlevel10k instant prompt" "$ZSHRC" | head -1 | cut -d: -f1)
    local INSERT_LINE=$(( P10K_LINE - 1 ))
    [[ "$INSERT_LINE" -lt 1 ]] && INSERT_LINE=1
    sudo -u "$SETUP_USER" sed -i "${INSERT_LINE}r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
  else
    sudo -u "$SETUP_USER" sed -i "5r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
  fi
  echo "  Tmux auto-attach configured (SSH -> dev1 session)"
}

install_zsh_dotfiles() {
  local DOTFILES_REPO="https://github.com/Graveside2022/raspberry-pi-dotfiles.git"
  local DOTFILES_DIR="$SETUP_HOME/.dotfiles"

  _clone_or_pull "$DOTFILES_REPO" "$DOTFILES_DIR"
  _install_zsh_plugins
  _install_tmux_config
  _install_firacode_font

  # Atuin (shell history)
  if ! _user_has_cmd atuin; then
    echo "  Installing Atuin..."
    sudo -u "$SETUP_USER" bash -c 'curl --proto "=https" --tlsv1.2 -LsSf https://setup.atuin.sh | sh'
  fi

  # Copy dotfiles config
  if [[ -f "$DOTFILES_DIR/zshrc" ]]; then
    sudo -u "$SETUP_USER" cp "$DOTFILES_DIR/zshrc" "$SETUP_HOME/.zshrc"
    [[ -f "$DOTFILES_DIR/p10k.zsh" ]] && sudo -u "$SETUP_USER" cp "$DOTFILES_DIR/p10k.zsh" "$SETUP_HOME/.p10k.zsh"
  else
    echo "  Warning: dotfiles repo missing zshrc. Skipping config copy."
  fi

  _inject_tmux_autoattach
}

install_zsh_default() {
  # Check if zsh_dotfiles was selected (it's a dependency)
  if ! _is_selected "zsh_dotfiles"; then
    echo "  Skipping — Zsh + Dotfiles was not selected (required dependency)."
    return 0
  fi

  local CURRENT_SHELL
  CURRENT_SHELL="$(getent passwd "$SETUP_USER" | cut -d: -f7)"
  if [[ "$CURRENT_SHELL" == */zsh ]]; then
    echo "  $SETUP_USER already using zsh"
  else
    echo "  Changing default shell for $SETUP_USER to zsh..."
    chsh -s "$(command -v zsh)" "$SETUP_USER"
    echo "  Default shell set to zsh (takes effect on next login)"
  fi
}

install_headless_debug() {
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
}

install_tmux_sessions() {
  local user_id
  user_id=$(id -u "$SETUP_USER")
  export XDG_RUNTIME_DIR="/run/user/$user_id"
  for sess in dev1 dev2 dev3 argos-logs; do
    if sudo -u "$SETUP_USER" tmux has-session -t "$sess" 2>/dev/null; then
      echo "  $sess — already running"
    else
      sudo -u "$SETUP_USER" tmux new-session -d -s "$sess" -c "$PROJECT_DIR"
      echo "  $sess — created"
    fi
  done

  local TMUX_UNIT="$PROJECT_DIR/scripts/tmux/tmux.service"
  if [[ -f "$TMUX_UNIT" ]]; then
    sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
    sudo -u "$SETUP_USER" cp "$TMUX_UNIT" "$SETUP_HOME/.config/systemd/user/tmux.service"
    _enable_user_service tmux.service
    echo "  tmux.service installed — sessions auto-create on boot"
  else
    echo "  Warning: scripts/tmux/tmux.service not found. Skipping systemd unit."
  fi
}

# =============================================
# DTED ELEVATION TILES
# =============================================

extract_dted() {
  local DTED_ZIP="$PROJECT_DIR/docs/dtedlevel0.zip"
  local DTED_DIR="$PROJECT_DIR/data/dted"

  if [[ -f "$DTED_ZIP" ]] && [[ -z "$(ls -A "$DTED_DIR" 2>/dev/null)" ]]; then
    echo "Extracting DTED Level 0 elevation tiles..."
    mkdir -p "$DTED_DIR"
    unzip -qo "$DTED_ZIP" -d "$DTED_DIR/"
    TILE_COUNT=$(find "$DTED_DIR" -name '*.dt0' | wc -l)
    echo "  Extracted ${TILE_COUNT} DTED tiles to data/dted/"
  elif [[ -d "$DTED_DIR" ]] && [[ -n "$(ls -A "$DTED_DIR" 2>/dev/null)" ]]; then
    TILE_COUNT=$(find "$DTED_DIR" -name '*.dt0' | wc -l)
    echo "  DTED tiles already present: ${TILE_COUNT} tiles"
  else
    echo "  No DTED zip found at docs/dtedlevel0.zip — skipping"
  fi
}

# =============================================
# CELL TOWER DATABASE
# =============================================

extract_celltowers() {
  local CT_ZIP="$PROJECT_DIR/docs/celltowers.zip"
  local CT_DIR="$PROJECT_DIR/data/celltowers"
  local CT_DB="$CT_DIR/towers.db"

  if [[ -f "$CT_ZIP" ]] && [[ ! -f "$CT_DB" ]]; then
    echo "Extracting cell tower database..."
    mkdir -p "$CT_DIR"
    unzip -qo "$CT_ZIP" -d "$CT_DIR/"
    local ROW_COUNT
    ROW_COUNT=$(sqlite3 "$CT_DB" "SELECT COUNT(*) FROM towers;" 2>/dev/null || echo "unknown")
    echo "  Extracted towers.db ($ROW_COUNT towers) to data/celltowers/"
  elif [[ -f "$CT_DB" ]]; then
    local ROW_COUNT
    ROW_COUNT=$(sqlite3 "$CT_DB" "SELECT COUNT(*) FROM towers;" 2>/dev/null || echo "unknown")
    echo "  Cell tower database already present: $ROW_COUNT towers"
  else
    echo "  No celltowers.zip found at docs/celltowers.zip — skipping"
    echo "  To download, run: bash scripts/ops/import-celltowers.sh"
  fi
}
