#!/usr/bin/env bash
# Argos Host Provisioning Script
# Idempotent setup for Kali Linux or Parrot OS on Raspberry Pi 5
# Usage: sudo bash scripts/ops/setup-host.sh [--all]
#   --all  Install everything without prompts (shows summary first)
set -euo pipefail

# --- Parse arguments ---
INSTALL_ALL=false
for arg in "$@"; do
  case "$arg" in
    --all) INSTALL_ALL=true ;;
    --help|-h)
      echo "Usage: sudo bash scripts/ops/setup-host.sh [--all]"
      echo ""
      echo "Options:"
      echo "  --all   Install all optional components without individual prompts"
      echo "          (still shows a summary and asks for one confirmation)"
      echo ""
      echo "Without --all, you'll be prompted for each optional component."
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$arg'" >&2
      echo "Usage: sudo bash scripts/ops/setup-host.sh [--all]" >&2
      exit 1
      ;;
  esac
done

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

# --- Interactive prompt helper ---
# Asks the user whether to install an optional component.
# Usage: if prompt_install "short_name" "description"; then ... fi
# Returns 0 (yes) or 1 (no). Respects INSTALL_ALL flag.
# Tracks choices in INSTALLED_COMPONENTS array for the final summary.
declare -A SKIP_COMPONENTS=()
INSTALLED_COMPONENTS=()
SKIPPED_COMPONENTS=()

prompt_install() {
  local name="$1"
  local description="$2"

  echo ""
  echo "  $description"
  echo ""

  if [[ "$INSTALL_ALL" == "true" ]]; then
    INSTALLED_COMPONENTS+=("$name")
    return 0
  fi

  local answer
  read -rp "  Install $name? [y/N]: " answer
  case "$answer" in
    [Yy]|[Yy]es)
      INSTALLED_COMPONENTS+=("$name")
      return 0
      ;;
    *)
      SKIPPED_COMPONENTS+=("$name")
      SKIP_COMPONENTS["$name"]=1
      echo "  Skipping $name."
      return 1
      ;;
  esac
}

# Show --all summary before starting
if [[ "$INSTALL_ALL" == "true" ]]; then
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│  FULL INSTALL MODE (--all)                   │"
  echo "├─────────────────────────────────────────────┤"
  echo "│                                              │"
  echo "│  CORE (always installed):                    │"
  echo "│   1. Network config (WiFi + DNS)             │"
  echo "│   2. System packages (build tools, SDR)      │"
  echo "│   3. Node.js 22 (app runtime)                │"
  echo "│   4. Kismet (WiFi scanner)                   │"
  echo "│   5. gpsd (GPS daemon)                       │"
  echo "│   7. OpenSSH server                          │"
  echo "│   8. SDR udev rules + infrastructure         │"
  echo "│  10. Kismet GPS link                         │"
  echo "│  11. npm dependencies                        │"
  echo "│  12. Environment file (.env)                 │"
  echo "│  14. EarlyOOM (prevents system freezes)      │"
  echo "│  15. cgroup memory limits                    │"
  echo "│                                              │"
  echo "│  OPTIONAL (included with --all):             │"
  echo "│   6. Docker (OpenWebRX + Bettercap)          │"
  echo "│   9. GSM Evil (cell tower monitoring)        │"
  echo "│  13. Dev monitor (auto-restart dev server)   │"
  echo "│  16. zram compressed swap (4 GB)             │"
  echo "│  17. Text-mode boot (disable desktop)        │"
  echo "│  18. On-demand VNC (remote desktop)          │"
  echo "│  19. Tailscale (secure remote access)        │"
  echo "│  20. Claude Code (AI coding assistant)       │"
  echo "│  21. Gemini CLI (Google AI assistant)        │"
  echo "│  22. Agent Browser (browser automation)      │"
  echo "│  23. ChromaDB (AI memory backend)            │"
  echo "│  24. Zsh + dotfiles (shell environment)      │"
  echo "│  25. Set Zsh as default shell                │"
  echo "│  26. Headless debug service (Chromium)       │"
  echo "│  27. Persistent tmux sessions                │"
  echo "│                                              │"
  echo "└─────────────────────────────────────────────┘"
  echo ""
  read -rp "Install everything listed above? [Y/n]: " CONFIRM_ALL
  case "$CONFIRM_ALL" in
    [Nn]|[Nn]o)
      echo "Switching to interactive mode (you'll be prompted for each item)."
      INSTALL_ALL=false
      ;;
    *)
      echo "Installing everything..."
      ;;
  esac
fi

TOTAL_SECTIONS=27

# =============================================
# CORE COMPONENTS (always installed)
# These are required for Argos to function.
# =============================================

# --- 1. Network Configuration ---
# Raspberry Pi OS often uses netplan to manage wlan0, which locks NetworkManager out.
# Argos needs: wlan0 = NM-managed (default WiFi), wlan1+ = unmanaged (Kismet capture).
echo ""
echo "[1/$TOTAL_SECTIONS] Network Configuration"
echo "  Sets up WiFi and DNS so Argos can talk to your radios and the internet."

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

  # --- 1c. DNS defense: NetworkManager fallback DNS ---
  # On Kali/RPi, eth0 is often managed by ifupdown (not NM). When NM has no managed
  # connections with DNS, it writes an empty /etc/resolv.conf — breaking all name
  # resolution. This fallback ensures NM always includes public DNS servers.
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
    # Give NM a moment to reconnect wlan0
    sleep 3
  fi

  echo "  Network config done."
}

configure_networking

# --- 2. System packages ---
echo ""
echo "[2/$TOTAL_SECTIONS] System Packages"
echo "  Installs radio drivers, build tools, and utilities that Argos needs to compile and run."
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
echo ""
echo "[3/$TOTAL_SECTIONS] Node.js"
echo "  Installs Node.js 22 — the JavaScript runtime that powers the Argos web app."
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
echo ""
echo "[4/$TOTAL_SECTIONS] Kismet"
echo "  Installs the Kismet WiFi scanner — detects nearby wireless networks and devices."
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
echo ""
echo "[5/$TOTAL_SECTIONS] gpsd"
echo "  Installs the GPS daemon — reads your GPS dongle so Argos can show your location on the map."
if command -v gpsd &>/dev/null; then
  echo "  gpsd already installed"
else
  echo "  Installing gpsd..."
  apt-get install -y -qq gpsd gpsd-clients
fi

# =============================================
# OPTIONAL COMPONENTS
# You'll be prompted for each of these.
# =============================================

# --- 6. Docker (for third-party tools only) ---
echo ""
echo "[6/$TOTAL_SECTIONS] Docker"
if prompt_install "Docker" \
  "Runs third-party radio tools (OpenWebRX, Bettercap) in isolated containers.
  You need this if you want the wideband radio receiver or network attack tools.
  Skip if you only need the core Argos dashboard."; then

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

fi  # end Docker prompt

# --- 7. OpenSSH Server ---
echo ""
echo "[7/$TOTAL_SECTIONS] OpenSSH Server"
echo "  Ensures you can remotely connect to this Pi over SSH from your laptop or phone."
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
echo ""
echo "[8/$TOTAL_SECTIONS] SDR udev Rules"
echo "  Allows your user account to access radio hardware (HackRF, RTL-SDR, USRP) without sudo."
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

# --- 8b. SDR Infrastructure (SoapySDR + UHD) ---
# SoapySDR provides unified device enumeration across all SDR brands.
# UHD host tools are required for Ettus USRP devices (B205-mini, B210).
# This section installs the base infrastructure; individual SoapySDR modules
# are added per-device. Full SoapySDR device management UI is a future feature.
echo ""
echo "[8b/$TOTAL_SECTIONS] SDR Infrastructure (SoapySDR + UHD)"
echo "  Installs the universal radio driver layer so Argos can talk to any supported SDR device."

SDR_INFRA_PKGS=(
  soapysdr-tools           # SoapySDRUtil CLI — unified device enumeration
  uhd-host                 # UHD CLI tools (uhd_find_devices, uhd_usrp_probe)
  soapysdr-module-hackrf   # SoapySDR ↔ HackRF bridge
  soapysdr-module-rtlsdr   # SoapySDR ↔ RTL-SDR bridge
  soapysdr0.8-module-uhd   # SoapySDR ↔ UHD/USRP bridge
)

for pkg in "${SDR_INFRA_PKGS[@]}"; do
  pkg_name="${pkg%%#*}"          # strip inline comment
  pkg_name="${pkg_name// /}"     # strip whitespace
  if dpkg -s "$pkg_name" &>/dev/null 2>&1; then
    echo "  $pkg_name — already installed"
  else
    echo "  $pkg_name — installing..."
    apt-get install -y -qq "$pkg_name" 2>/dev/null || echo "  WARNING: $pkg_name not available"
  fi
done

# Download UHD firmware images (required for B200-series USRPs to function).
# The B205-mini loads firmware from host at runtime — without these images,
# the device appears on USB but cannot be initialized.
UHD_IMAGES_DIR="/usr/share/uhd/images"
if [[ -f "$UHD_IMAGES_DIR/usrp_b200_fw.hex" ]]; then
  echo "  UHD firmware images already present"
else
  echo "  Downloading UHD firmware images (~100MB)..."
  if command -v uhd_images_downloader &>/dev/null; then
    uhd_images_downloader --types "b2xx" 2>&1 | tail -3
    echo "  UHD B2xx firmware images downloaded"
  else
    # Fallback: try the libexec path directly
    UHD_DOWNLOADER="/usr/libexec/uhd/utils/uhd_images_downloader.py"
    if [[ -f "$UHD_DOWNLOADER" ]]; then
      python3 "$UHD_DOWNLOADER" --types "b2xx" 2>&1 | tail -3
      echo "  UHD B2xx firmware images downloaded"
    else
      echo "  WARNING: UHD images downloader not found — USRP devices will not work"
      echo "  Try: sudo apt install uhd-host && sudo uhd_images_downloader --types b2xx"
    fi
  fi

  # UHD downloads images to a versioned path (e.g. /usr/share/uhd/4.9.0/images/)
  # but the runtime expects them at /usr/share/uhd/images/. Create symlink if needed.
  UHD_VERSIONED_DIR=$(find /usr/share/uhd -maxdepth 2 -name "images" -type d ! -path "$UHD_IMAGES_DIR" 2>/dev/null | head -1)
  if [[ -n "$UHD_VERSIONED_DIR" && ! -e "$UHD_IMAGES_DIR" ]]; then
    ln -sf "$UHD_VERSIONED_DIR" "$UHD_IMAGES_DIR"
    echo "  Symlinked $UHD_IMAGES_DIR → $UHD_VERSIONED_DIR"
  fi
fi

# --- 9. GSM Evil (gr-gsm + kalibrate-rtl + GsmEvil2) ---
echo ""
echo "[9/$TOTAL_SECTIONS] GSM Evil"
if prompt_install "GSM Evil" \
  "Monitors cell towers and intercepts GSM radio traffic near your position.
  Lets you see which towers your phone connects to and detect rogue base stations (IMSI catchers).
  Requires a HackRF or RTL-SDR radio. Skip if you don't do cellular analysis."; then
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

fi  # end GSM Evil prompt

# --- 10. Kismet GPS config ---
echo ""
echo "[10/$TOTAL_SECTIONS] Kismet GPS Config"
echo "  Links Kismet to your GPS so scanned networks appear with location data on the map."
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
echo ""
echo "[11/$TOTAL_SECTIONS] npm Dependencies"
echo "  Installs all the JavaScript libraries Argos needs (this may take a few minutes on RPi)."
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

# Ensure ops scripts are executable (git may strip execute bits)
chmod +x "$PROJECT_DIR"/scripts/ops/*.sh "$PROJECT_DIR"/scripts/dev/*.sh 2>/dev/null || true
echo "  Scripts marked executable"

# --- 12. .env from template ---
echo ""
echo "[12/$TOTAL_SECTIONS] Environment File (.env)"
echo "  Creates the configuration file with API keys for maps, cell towers, and security."
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
echo ""
echo "[13/$TOTAL_SECTIONS] Development Monitor Service"
if prompt_install "Dev Monitor" \
  "Watches the Argos dev server and automatically restarts it if it crashes.
  Useful during development — you won't have to manually restart after a crash.
  Skip if you only plan to run Argos in production mode."; then

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

fi  # end Dev Monitor prompt

# --- 14. EarlyOOM Configuration ---
echo ""
echo "[14/$TOTAL_SECTIONS] EarlyOOM Configuration"
echo "  Prevents the Pi from freezing when memory runs low — kills the least important process first."
if [[ -f /etc/default/earlyoom ]]; then
  # Memory threshold: 2.5% RAM free (97.5% used), 50% swap, check every 10s
  # This is the last-resort killer — other guards (Claude hook at 90%, tmux guard
  # at 90%, cgroup soft limit) intervene earlier. EarlyOOM only fires when ~200 MB free.
  # Polling at 10s (not 60s) because with only ~200MB headroom, a fast allocation spike
  # could trigger the kernel OOM killer before earlyoom notices at 60s intervals.
  # Avoid list: system-critical + development tools + headless browser
  # Prefer list: ollama (large model) and bun (claude-mem daemon workers)
  cat > /etc/default/earlyoom << 'EARLYOOM'
EARLYOOM_ARGS="-m 2 -s 50 -r 10 --avoid '(^|/)(init|sshd|tailscaled|NetworkManager|dockerd|systemd|node.*vscode|vite|chroma|Xvfb|chromium)$' --prefer '(^|/)(ollama|bun)$'"
EARLYOOM
  systemctl restart earlyoom
  echo "  EarlyOOM configured (trigger: 2.5% free, protect: system + dev tools, prefer kill: ollama + bun)."
else
  echo "  Warning: /etc/default/earlyoom not found. Install earlyoom first."
fi

# --- 15. cgroup Memory Limit (defense against runaway processes) ---
echo ""
echo "[15/$TOTAL_SECTIONS] cgroup Memory Limit"
echo "  Sets a hard cap on how much RAM your user account can use, protecting the system from runaway processes."

# Detect the primary UID (the user who will run Argos)
SETUP_UID=$(id -u "$SETUP_USER")
SLICE_DIR="/etc/systemd/system/user-${SETUP_UID}.slice.d"
SLICE_CONF="$SLICE_DIR/memory-limit.conf"

# Calculate limits dynamically based on total RAM.
# Hybrid formula: reserve max(200 MiB, 2.5% of RAM) for kernel+system.
# This allows ~97.5% of RAM for user processes before the hard kill fires.
# - RPi 5 (8 GB): reserves 200 MiB → MemoryMax ~7900M, MemoryHigh ~7700M
# - Large machines (32+ GB): reserves 2.5% (proportional headroom)
#   MemoryHigh (soft) = MemoryMax - 200 MiB → triggers aggressive reclaim before hard limit
#   MemoryMax  (hard) = total - reserve      → OOM-kills the process
TOTAL_MEM_BYTES=$(free -b | awk '/Mem:/ {print $2}')
TOTAL_MEM_MIB=$(( TOTAL_MEM_BYTES / 1048576 ))
RESERVE_PERCENT=$(( TOTAL_MEM_MIB * 25 / 1000 ))
RESERVE_MIN=200
RESERVE_MIB=$(( RESERVE_PERCENT > RESERVE_MIN ? RESERVE_PERCENT : RESERVE_MIN ))
MEM_MAX_MIB=$(( TOTAL_MEM_MIB - RESERVE_MIB ))
MEM_HIGH_MIB=$(( MEM_MAX_MIB - 200 ))      # soft limit 200 MiB below hard limit

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
fi

# --- 16. zram Compressed Swap ---
echo ""
echo "[16/$TOTAL_SECTIONS] zram Compressed Swap"
if prompt_install "zram Swap" \
  "Creates 4 GB of compressed virtual memory using your RAM (no SD card wear).
  Gives Argos extra breathing room when running multiple tools at once.
  Highly recommended on 8 GB Pi — prevents freezes during heavy workloads."; then

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

fi  # end zram prompt

# --- 17. Text-Mode Boot (disable LightDM desktop greeter) ---
echo ""
echo "[17/$TOTAL_SECTIONS] Text-Mode Boot"
if prompt_install "Text-Mode Boot" \
  "Disables the graphical desktop login screen so the Pi boots straight to a terminal.
  Saves ~300 MB of RAM that would be used by the desktop environment.
  Best for headless/remote setups. You can always re-enable it later with:
    sudo systemctl set-default graphical.target && sudo systemctl enable lightdm"; then

# Patch /etc/lightdm/Xsession with has_option() if missing.
# Some /etc/X11/Xsession.d/ scripts call has_option() which LightDM's Xsession
# doesn't define. This causes errors if lightdm is ever re-enabled.
XSESSION_FILE="/etc/lightdm/Xsession"
if [[ -f "$XSESSION_FILE" ]]; then
  if grep -q "has_option()" "$XSESSION_FILE"; then
    echo "  has_option() already patched in Xsession"
  else
    echo "  Patching $XSESSION_FILE with has_option() function..."
    # Insert the function after the errormsg() function definition
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
CURRENT_TARGET=$(systemctl get-default 2>/dev/null)
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

fi  # end Text-Mode Boot prompt

# --- 18. On-Demand VNC (socket-activated remote desktop) ---
echo ""
echo "[18/$TOTAL_SECTIONS] On-Demand VNC"
if prompt_install "On-Demand VNC" \
  "Lets you view a remote desktop on this Pi from any VNC viewer (e.g., your laptop).
  The desktop only starts when you connect, and shuts down when you disconnect — saving RAM.
  Connect to port 5901 from any VNC client. Skip if you only use SSH."; then

# Install VNC packages (only needed for this section)
for pkg in tigervnc-standalone-server tigervnc-tools socat; do
  if dpkg -s "$pkg" &>/dev/null; then
    echo "  $pkg — already installed"
  else
    echo "  $pkg — installing..."
    apt-get install -y -qq "$pkg"
  fi
done

# Create systemd user unit directory
sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"

# VNC socket unit — listens on port 5901
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

# VNC proxy service — forwards socket connections to the VNC backend
VNC_SERVICE="$SETUP_HOME/.config/systemd/user/vnc-ondemand.service"
cat > "$VNC_SERVICE" << 'VNC_SERVICE_UNIT'
[Unit]
Description=On-demand VNC proxy (triggers VNC server)
Requires=vnc-backend.service
After=vnc-backend.service

[Service]
# Wait for VNC to be ready on port 5911 before proxying (up to 15s)
ExecStartPre=/bin/bash -c 'for i in $(seq 1 30); do ss -tln | grep -q ":5911 " && exit 0; sleep 0.5; done; echo "vnc-backend port 5911 not ready after 15s" >&2; exit 1'
# Accept connection from systemd socket, forward to VNC, exit on disconnect
ExecStart=/usr/bin/socat ACCEPT-FD:3 TCP:127.0.0.1:5911
# On exit: stop backend via independent transient unit (avoids cgroup kill + deadlock)
ExecStopPost=/usr/bin/systemd-run --user --no-block systemctl --user stop vnc-backend.service
TimeoutStopSec=5
StandardOutput=journal
StandardError=journal
VNC_SERVICE_UNIT
chown "$SETUP_USER":"$SETUP_USER" "$VNC_SERVICE"

# VNC backend service — runs TigerVNC server on display :11
VNC_BACKEND="$SETUP_HOME/.config/systemd/user/vnc-backend.service"
cat > "$VNC_BACKEND" << 'VNC_BACKEND_UNIT'
[Unit]
Description=TigerVNC Server (on-demand backend)
After=syslog.target network.target
# Proxy ExecStopPost stops us on disconnect — no watcher needed

[Service]
Type=forking
PIDFile=%h/.config/tigervnc/%H:11.pid
# Bind to localhost:5911 — the socket proxy forwards external connections here
ExecStart=/usr/bin/vncserver :11 -localhost -geometry 1920x1200 -depth 24 -rfbport 5911
ExecStop=/usr/bin/vncserver -kill :11
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
# Cap memory to protect Argos from VNC bloat
MemoryMax=1200M
# VNC is expendable — let earlyoom/OOM kill it before Argos (oom_score_adj=-500)
OOMScoreAdjust=300
VNC_BACKEND_UNIT
chown "$SETUP_USER":"$SETUP_USER" "$VNC_BACKEND"

# Set VNC password if not already configured
VNC_PASSWD_FILE="$SETUP_HOME/.vnc/passwd"
if [[ -f "$VNC_PASSWD_FILE" ]]; then
  echo "  VNC password already set"
else
  echo ""
  echo "  Set a VNC password (used when connecting from your VNC viewer):"
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.vnc"
  sudo -u "$SETUP_USER" vncpasswd "$VNC_PASSWD_FILE"
fi

# Enable lingering so socket stays active without a login session
loginctl enable-linger "$SETUP_USER"

# Enable and start the socket
USER_ID=$(id -u "$SETUP_USER")
export XDG_RUNTIME_DIR="/run/user/$USER_ID"
sudo -u "$SETUP_USER" systemctl --user daemon-reload
sudo -u "$SETUP_USER" systemctl --user enable vnc-ondemand.socket
sudo -u "$SETUP_USER" systemctl --user restart vnc-ondemand.socket
echo "  On-demand VNC installed. Connect to port 5901 with any VNC viewer."
echo "  The desktop starts when you connect and stops when you disconnect."

fi  # end VNC prompt

# --- 19. Tailscale ---
echo ""
echo "[19/$TOTAL_SECTIONS] Tailscale"
if prompt_install "Tailscale" \
  "Creates a secure private network so you can access this Pi from anywhere (home, office, field).
  Works through firewalls and NAT — no port forwarding needed. Free for personal use.
  Skip if you'll only use this Pi on the local network."; then

if command -v tailscale &>/dev/null; then
  echo "  Tailscale already installed: $(tailscale version | head -1)"
else
  echo "  Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | bash
  echo "  Tailscale installed."
fi

# Configure Tailscale DNS (accept-dns) if Tailscale is authenticated.
# This is the primary DNS defense layer — Tailscale's MagicDNS resolves both
# tailnet names and public DNS, writing resolv.conf with nameserver 100.100.100.100.
# Without this, Kali's ifupdown/NetworkManager conflict leaves resolv.conf empty.
if command -v tailscale &>/dev/null; then
  TS_STATUS=$(tailscale status --json 2>/dev/null | grep -o '"BackendState":"[^"]*"' | head -1)
  if [[ "$TS_STATUS" == *"Running"* ]]; then
    echo "  Ensuring Tailscale DNS is enabled (accept-dns=true)..."
    tailscale set --accept-dns=true
    echo "  Tailscale DNS configured — resolv.conf managed by Tailscale."
  else
    echo "  Tailscale not yet authenticated. Run 'sudo tailscale up' to connect."
    echo "  Then run: sudo tailscale set --accept-dns=true"
    echo "  (Required: Tailscale DNS prevents empty resolv.conf on Kali/RPi)"
  fi
fi

# DNS health check — surface problems during provisioning, not later
if ! grep -q '^nameserver' /etc/resolv.conf 2>/dev/null; then
  echo "  ⚠ WARNING: /etc/resolv.conf has no nameservers!"
  echo "  DNS will not work. Ensure Tailscale is authenticated and accept-dns is enabled."
  echo "  Fallback: echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf"
else
  echo "  DNS health check: OK ($(grep -c '^nameserver' /etc/resolv.conf) nameservers)"
fi

fi  # end Tailscale prompt

# --- 20. Claude Code ---
echo ""
echo "[20/$TOTAL_SECTIONS] Claude Code"
if prompt_install "Claude Code" \
  "Installs Anthropic's AI coding assistant that can read and write code on this Pi.
  Useful for development, debugging, and building new features for Argos.
  Skip if you don't plan to develop or modify the Argos codebase."; then

if sudo -u "$SETUP_USER" bash -c 'command -v claude' &>/dev/null; then
  echo "  Claude Code already installed"
else
  echo "  Installing Claude Code (native installer, no sudo)..."
  sudo -u "$SETUP_USER" bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
  echo "  Claude Code installed. Run 'claude' to authenticate."
fi

fi  # end Claude Code prompt

# --- 21. Gemini CLI ---
echo ""
echo "[21/$TOTAL_SECTIONS] Gemini CLI"
if prompt_install "Gemini CLI" \
  "Installs Google's AI coding assistant as an alternative to Claude Code.
  Provides a second AI option for development work on the Pi.
  Skip if you don't use Google's Gemini AI."; then

if sudo -u "$SETUP_USER" bash -c 'command -v gemini' &>/dev/null; then
  echo "  Gemini CLI already installed"
else
  echo "  Installing Gemini CLI..."
  sudo -u "$SETUP_USER" npm install -g @google/gemini-cli
  echo "  Gemini CLI installed. Run 'gemini' to authenticate."
fi

fi  # end Gemini CLI prompt

# --- 22. Agent Browser (Playwright-based browser automation for Claude Code) ---
echo ""
echo "[22/$TOTAL_SECTIONS] Agent Browser"
if prompt_install "Agent Browser" \
  "Gives AI assistants (Claude, Gemini) the ability to control a web browser on this Pi.
  Used for automated testing and visual verification of the Argos dashboard.
  Skip if you don't use AI coding assistants for development."; then

if sudo -u "$SETUP_USER" bash -c 'command -v agent-browser' &>/dev/null; then
  echo "  agent-browser already installed"
else
  echo "  Installing agent-browser..."
  sudo -u "$SETUP_USER" npm install -g agent-browser
fi
# Always ensure Chromium is available (handles partial installs)
echo "  Ensuring Chromium for agent-browser..."
sudo -u "$SETUP_USER" agent-browser install

fi  # end Agent Browser prompt

# --- 23. ChromaDB (claude-mem vector search backend) ---
echo ""
echo "[23/$TOTAL_SECTIONS] ChromaDB"
if prompt_install "ChromaDB" \
  "Installs a vector database that gives AI assistants long-term memory across sessions.
  Claude Code uses this to remember past conversations and project context.
  Skip if you don't use Claude Code or don't need AI memory."; then

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
# Four layers ensure the env var reaches chroma-mcp regardless of launch method:
#   1. /etc/environment — PAM-level, read on any SSH/Termius/local login
#   2. ~/.config/environment.d/ — systemd user services and spawned processes
#   3. ~/.zshenv — interactive zsh sessions (belt-and-suspenders)
#   4. ~/.claude/settings.json env field — Claude Code spawned processes (MCP servers, workers)
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

# Layer 4: Claude Code settings.json env field
# Claude Code's Node.js runtime doesn't source /etc/environment or ~/.zshenv.
# The env field in settings.json is the only way to inject vars into its process tree.
CLAUDE_SETTINGS="$SETUP_HOME/.claude/settings.json"
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  if python3 -c "
import json, sys
with open('$CLAUDE_SETTINGS') as f:
    s = json.load(f)
env = s.get('env', {})
if env.get('CHROMA_SSL') == 'false':
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
    echo "  CHROMA_SSL=false already in Claude Code settings.json env"
  else
    echo "  Adding CHROMA_SSL=false to Claude Code settings.json env..."
    python3 -c "
import json
with open('$CLAUDE_SETTINGS') as f:
    s = json.load(f)
s.setdefault('env', {})['CHROMA_SSL'] = 'false'
with open('$CLAUDE_SETTINGS', 'w') as f:
    json.dump(s, f, indent=2)
    f.write('\n')
"
    chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
  fi
else
  echo "  Claude Code settings.json not found (will be created on first run)"
fi

# Install claude-mem orphan cleanup hook
CLAUDE_HOOKS_DIR="$SETUP_HOME/.claude/hooks"
HOOK_SCRIPT="$CLAUDE_HOOKS_DIR/ensure-chroma-env.sh"
sudo -u "$SETUP_USER" mkdir -p "$CLAUDE_HOOKS_DIR"
sudo -u "$SETUP_USER" tee "$HOOK_SCRIPT" > /dev/null << 'HOOK_CONTENT'
#!/usr/bin/env bash
set -u
# Ensure running claude-mem worker has CHROMA_SSL=false.
# Also cleans up stale orphaned workers (>30s old) to prevent memory bloat.
#
# IMPORTANT: The 30-second age check prevents a race condition where this hook
# fires AFTER claude-mem's own SessionStart hook has spawned a fresh worker.
# Without it, the freshly-started worker gets killed immediately, breaking
# observations for the entire Claude Code session.

MIN_AGE_SECS=30
NOW=$(date +%s)

# Kill orphaned claude-mem workers older than MIN_AGE_SECS
for pid in $(pgrep -f 'worker-service.cjs --daemon' 2>/dev/null); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    parent_comm=$(ps -o comm= -p "$ppid" 2>/dev/null | tr -d ' ')
    if [ "$ppid" = "1" ] || [ "$parent_comm" = "systemd" ]; then
        start_time=$(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$NOW")
        age=$((NOW - start_time))
        if [ "$age" -ge "$MIN_AGE_SECS" ]; then
            kill "$pid" 2>/dev/null
        fi
    fi
done

# Check if running worker has CHROMA_SSL=false; kill to trigger auto-restart if not
WORKER_PID=$(pgrep -f 'worker-service.cjs --daemon' 2>/dev/null | head -1)
if [ -n "${WORKER_PID:-}" ]; then
    if ! tr '\0' '\n' < "/proc/$WORKER_PID/environ" 2>/dev/null | grep -q '^CHROMA_SSL=false$'; then
        kill "$WORKER_PID" 2>/dev/null
    fi
fi

exit 0
HOOK_CONTENT
chmod +x "$HOOK_SCRIPT"
echo "  Installed $HOOK_SCRIPT"

# Register hook in Claude Code settings if not already present
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  if python3 -c "
import json, sys
with open('$CLAUDE_SETTINGS') as f:
    s = json.load(f)
hooks = s.get('hooks', {})
for entry in hooks.get('SessionStart', []):
    for h in entry.get('hooks', []):
        if 'ensure-chroma-env' in h.get('command', ''):
            sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    echo "  SessionStart hook already registered"
  else
    echo "  Registering ensure-chroma-env.sh as SessionStart hook..."
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

echo "  ChromaDB service installed and running on port 8000."

fi  # end ChromaDB prompt

# --- 24. Zsh + Dotfiles ---
echo ""
echo "[24/$TOTAL_SECTIONS] Zsh + Dotfiles"
if prompt_install "Zsh + Dotfiles" \
  "Installs a customized shell environment with autocompletions, syntax highlighting, and a nice prompt.
  Includes Oh My Zsh, Powerlevel10k theme, tmux plugin manager, and FiraCode Nerd Font.
  Also configures tmux auto-attach so SSH sessions reconnect to your work automatically.
  Skip if you prefer to keep your current shell setup."; then
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

# Inject tmux auto-attach for SSH dev sessions
# Must be placed ABOVE the Powerlevel10k instant prompt block in .zshrc
# (P10k captures the TTY, which prevents tmux attach from working)
ZSHRC="$SETUP_HOME/.zshrc"
TMUX_MARKER="# Tmux auto-attach for SSH sessions"
if [[ -f "$ZSHRC" ]] && ! grep -qF "$TMUX_MARKER" "$ZSHRC"; then
  echo "  Injecting tmux auto-attach block into .zshrc..."
  # Build the block to inject
  TMUX_BLOCK="$(cat << 'TMUX_EOF'

# ========================================
# Tmux auto-attach for SSH sessions
# ========================================
# Must run BEFORE Powerlevel10k instant prompt (tmux needs raw TTY access).
# Guards: skip if already in tmux, non-interactive, VS Code Remote SSH,
# or high memory pressure (>90% used). Prevents OOM loop on SSH reconnect.
if [[ -n "$SSH_CONNECTION" ]] && [[ -z "$TMUX" ]] && [[ $- == *i* ]] \
   && [[ -z "$VSCODE_INJECTION" ]] && [[ -z "$VSCODE_GIT_ASKPASS_NODE" ]]; then
    # Memory pressure guard: skip tmux if >90% RAM used
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
  # Insert before the P10k instant prompt block (or at line 5 if P10k not found)
  if grep -qn "Enable Powerlevel10k instant prompt" "$ZSHRC"; then
    P10K_LINE=$(grep -n "Enable Powerlevel10k instant prompt" "$ZSHRC" | head -1 | cut -d: -f1)
    # Insert before the comment line (which is typically 1 line above the `if` block)
    INSERT_LINE=$(( P10K_LINE - 1 ))
    [[ "$INSERT_LINE" -lt 1 ]] && INSERT_LINE=1
    # Use sed to insert the block at the target line
    sudo -u "$SETUP_USER" sed -i "${INSERT_LINE}r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
  else
    # No P10k found — prepend after the first few PATH/profile lines
    sudo -u "$SETUP_USER" sed -i "5r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
  fi
  echo "  Tmux auto-attach configured (SSH → dev1 session)"
else
  echo "  Tmux auto-attach already present in .zshrc"
fi

fi  # end Zsh + Dotfiles prompt

# --- 25. Set Zsh as default shell ---
echo ""
echo "[25/$TOTAL_SECTIONS] Set Zsh as Default Shell"
if prompt_install "Zsh as Default" \
  "Changes your login shell from bash to zsh (requires Zsh + Dotfiles above).
  Next time you SSH in, you'll get the fancy zsh prompt instead of plain bash.
  Skip if you installed Zsh above but want to switch manually later."; then

if [[ "${SKIP_COMPONENTS[Zsh + Dotfiles]+_}" ]]; then
  echo "  Skipping — Zsh + Dotfiles was not installed (required dependency)."
else

CURRENT_SHELL="$(getent passwd "$SETUP_USER" | cut -d: -f7)"
if [[ "$CURRENT_SHELL" == */zsh ]]; then
  echo "  $SETUP_USER already using zsh"
else
  echo "  Changing default shell for $SETUP_USER to zsh..."
  chsh -s "$(command -v zsh)" "$SETUP_USER"
  echo "  Default shell set to zsh (takes effect on next login)"
fi

fi  # end Zsh + Dotfiles dependency check

fi  # end Zsh default prompt

# --- 26. Headless Debug Service ---
echo ""
echo "[26/$TOTAL_SECTIONS] Headless Debug Service"
if prompt_install "Headless Debug" \
  "Runs a hidden Chromium browser on port 9224 for automated testing and screenshots.
  AI assistants use this to visually verify the Argos dashboard without a monitor.
  Skip if you don't use AI coding assistants or automated testing."; then

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

fi  # end Headless Debug prompt

# --- 27. Persistent Tmux Dev Sessions ---
echo ""
echo "[27/$TOTAL_SECTIONS] Persistent Tmux Dev Sessions"
if prompt_install "Tmux Sessions" \
  "Creates 3 pre-built terminal workspaces (dev1, dev2, dev3) that survive SSH disconnects.
  When you SSH in, you'll auto-attach to dev1 where you left off — no lost work.
  Skip if you don't use tmux or prefer to manage your own sessions."; then
# Pre-create detached tmux sessions for SSH development work.
# dev1/dev2/dev3: SSH dev workspaces (auto-attach on SSH login goes to dev1)
# argos-logs, tmux-0, tmux-1: web terminal sessions (managed by npm run dev / web UI)
#
# These sessions survive across SSH disconnects. The .zshrc auto-attach block
# (injected in step 21) connects SSH logins to dev1 automatically.
USER_ID=$(id -u "$SETUP_USER")
export XDG_RUNTIME_DIR="/run/user/$USER_ID"
for sess in dev1 dev2 dev3 argos-logs; do
  if sudo -u "$SETUP_USER" tmux has-session -t "$sess" 2>/dev/null; then
    echo "  $sess — already running"
  else
    sudo -u "$SETUP_USER" tmux new-session -d -s "$sess" -c "$PROJECT_DIR"
    echo "  $sess — created (cwd: $PROJECT_DIR)"
  fi
done

# Install tmux.service so dev sessions auto-create on boot.
# Install custom tmux.service that pre-creates named dev sessions on boot.
# @continuum-boot is OFF in tmux.conf to prevent continuum from overwriting this.
TMUX_SERVICE_DIR="$SETUP_HOME/.config/systemd/user"
sudo -u "$SETUP_USER" mkdir -p "$TMUX_SERVICE_DIR"
sudo -u "$SETUP_USER" cp "$PROJECT_DIR/scripts/tmux/tmux.service" "$TMUX_SERVICE_DIR/tmux.service"
# Ensure user lingering so tmux sessions start at boot, not first login
loginctl enable-linger "$SETUP_USER" 2>/dev/null || true
sudo -u "$SETUP_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user daemon-reload
sudo -u "$SETUP_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user enable tmux.service
echo "  tmux.service installed — dev1/dev2/dev3/argos-logs auto-create on boot"

echo "  SSH login will auto-attach to dev1."
echo "  Switch sessions: Ctrl-b then :switch-client -t dev2"

fi  # end Tmux Sessions prompt

echo ""
echo "==========================================="
echo "  Provisioning Complete!"
echo "==========================================="
echo ""

# Show summary of what was installed vs skipped
if [[ ${#INSTALLED_COMPONENTS[@]} -gt 0 ]]; then
  echo "Installed: ${INSTALLED_COMPONENTS[*]}"
fi
if [[ ${#SKIPPED_COMPONENTS[@]} -gt 0 ]]; then
  echo "Skipped:   ${SKIPPED_COMPONENTS[*]}"
  echo ""
  echo "To install skipped components later, re-run:"
  echo "  sudo bash scripts/ops/setup-host.sh"
fi

echo ""
echo "Next steps:"
echo "  1. Edit .env to set service passwords"
echo "  2. npm run dev          — start development server"
echo "  3. Open http://<pi-ip>:5173 in your browser"
echo ""
echo "Production deployment:"
echo "  sudo bash scripts/ops/install-services.sh"
echo "  sudo systemctl start argos-final"
echo ""
echo "API keys (can be set later in .env):"
echo "  STADIA_MAPS_API_KEY  — vector map tiles (https://stadiamaps.com)"
echo "  OPENCELLID_API_KEY   — cell tower database (https://opencellid.org)"
echo ""
echo "Cell tower database:"
echo "  bash scripts/ops/import-celltowers.sh"
echo ""

# VNC instructions (only if installed)
if [[ ! "${SKIP_COMPONENTS[On-Demand VNC]+_}" ]]; then
  echo "Remote desktop (VNC):"
  echo "  Connect any VNC viewer to <pi-ip>:5901"
  echo "  Desktop starts on connect, stops on disconnect (saves RAM)"
  echo "  To change password: vncpasswd ~/.vnc/passwd"
  echo ""
fi
