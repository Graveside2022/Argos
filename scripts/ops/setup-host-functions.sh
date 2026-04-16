#!/usr/bin/env bash
# Argos install function library — sourced by setup-host-ui.mjs
# Do not run directly.
#
# Required env vars (set by the Node.js caller):
#   SETUP_USER, SETUP_HOME, PROJECT_DIR, SCRIPT_DIR
#   OS_ID, NON_INTERACTIVE
#
# Optional env vars (for install_env_file):
#   STADIA_KEY
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
# PRE-FLIGHT: Clean up stale repo entries from previous failed runs
# =============================================
# A failed install_docker or install_kismet may leave broken .list files
# that cause 404 errors on every subsequent apt-get update.
_cleanup_stale_repo_entries() {
  for list_file in /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/kismet.list; do
    if [[ -f "$list_file" ]] && grep -q "echo" "$list_file" 2>/dev/null; then
      echo "  Removing stale repo entry: $list_file (contains invalid codename 'echo')"
      rm -f "$list_file"
    fi
  done
}
# Run cleanup when this library is sourced
_cleanup_stale_repo_entries 2>/dev/null || true

# =============================================
# DRY-RUN SUPPORT
# =============================================
# When DRY_RUN=true, destructive commands are logged instead of executed.
# Set by setup-host.sh --dry-run flag, passed through via CHILD_ENV.

_run() {
  if [[ "${DRY_RUN:-}" == "true" ]]; then
    echo "  [DRY-RUN] $*"
    return 0
  fi
  "$@"
}

_write_file() {
  local dest="$1"
  if [[ "${DRY_RUN:-}" == "true" ]]; then
    echo "  [DRY-RUN] Would write: $dest"
    cat > /dev/null  # consume stdin
    return 0
  fi
  cat > "$dest"
}

# =============================================
# HELPERS
# =============================================

# Resolve the upstream Debian codename for rolling-release distros (Kali, Parrot).
# Docker, NodeSource, and Kismetwireless repos don't have kali-rolling/parrot-rolling
# entries — they need the actual Debian codename (e.g. bookworm, trixie).
# Parrot 7.x sets ID=debian, VERSION_CODENAME=echo — neither maps to upstream repos.
resolve_debian_codename() {
  local codename pretty_name
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  pretty_name="$(. /etc/os-release && echo "${PRETTY_NAME:-}")"
  case "$codename" in
    kali-rolling)
      # Kali is based on Debian Testing but Docker/NodeSource repos work with bookworm
      echo "bookworm"
      ;;
    "")
      echo "bookworm"
      ;;
    *)
      # Parrot 7.x uses VERSION_CODENAME=echo and ID=debian — detect via PRETTY_NAME
      if [[ "$pretty_name" == *"Parrot"* ]]; then
        # Parrot 7.x is based on Debian 13 "trixie"
        echo "trixie"
      else
        echo "$codename"
      fi
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
    _run apt-get install -y -q "$pkg" || echo "  WARNING: $pkg not available in repos"
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

# Enable and start a systemd user service for SETUP_USER.
# When running under sudo, the user's D-Bus session bus isn't available.
# We must pass both XDG_RUNTIME_DIR and DBUS_SESSION_BUS_ADDRESS so that
# `systemctl --user` can connect to the user's systemd instance.
_enable_user_service() {
  local service="$1"
  if [[ "${DRY_RUN:-}" == "true" ]]; then
    echo "  [DRY-RUN] Would enable user service: $service"
    return 0
  fi
  local user_id
  user_id=$(id -u "$SETUP_USER")
  loginctl enable-linger "$SETUP_USER" 2>/dev/null || true
  local runtime_dir="/run/user/$user_id"
  local bus_addr="unix:path=${runtime_dir}/bus"
  sudo -u "$SETUP_USER" \
    XDG_RUNTIME_DIR="$runtime_dir" \
    DBUS_SESSION_BUS_ADDRESS="$bus_addr" \
    systemctl --user daemon-reload
  sudo -u "$SETUP_USER" \
    XDG_RUNTIME_DIR="$runtime_dir" \
    DBUS_SESSION_BUS_ADDRESS="$bus_addr" \
    systemctl --user enable "$service"
  sudo -u "$SETUP_USER" \
    XDG_RUNTIME_DIR="$runtime_dir" \
    DBUS_SESSION_BUS_ADDRESS="$bus_addr" \
    systemctl --user restart "$service"
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

# Pre-flight check: returns 0 if a component appears to be already installed.
# Used by the Node.js UI to show "already present" vs "freshly installed".
# This is a quick heuristic — the actual install functions are idempotent and
# will still verify/update configuration even if this returns 0.
check_component() {
  local id="$1"
  case "$id" in
    network)         nmcli -t -f RUNNING general 2>/dev/null | grep -q running ;;
    system_packages) dpkg -s build-essential &>/dev/null ;;
    nodejs)          command -v node &>/dev/null && command -v npm &>/dev/null ;;
    gpsd)            command -v gpsd &>/dev/null ;;
    kismet)          command -v kismet &>/dev/null && getent group kismet | grep -q "$SETUP_USER" ;;
    kismet_gps)      grep -q '^gps=gpsd:' /etc/kismet/kismet.conf 2>/dev/null ;;
    openssh)         dpkg -s openssh-server &>/dev/null && systemctl is-active --quiet ssh 2>/dev/null ;;
    udev_sdr)        [[ -f /etc/udev/rules.d/99-sdr.rules ]] ;;
    sdr_infra)       command -v SoapySDRUtil &>/dev/null ;;
    npm_deps)        [[ -d "$PROJECT_DIR/node_modules" ]] ;;
    env_file)        [[ -f "$PROJECT_DIR/.env" ]] ;;
    earlyoom)        command -v earlyoom &>/dev/null ;;
    cgroup_mem)      [[ -f /etc/systemd/system/user-1000.slice.d/memory-limit.conf ]] ;;
    mem_hardening)   [[ -f /etc/sysctl.d/99-memory.conf ]] && \
                       [[ -f /etc/systemd/system/tmp.mount.d/size-limit.conf ]] && \
                       [[ -f /etc/tmpfiles.d/argos-cleanup.conf ]] && \
                       [[ -f /etc/cron.d/argos-tmp-cleanup ]] && \
                       systemctl is-enabled --quiet argos-startup 2>/dev/null && \
                       grep -q 'psi=1' /boot/firmware/cmdline.txt 2>/dev/null ;;
    bluetooth_disable) grep -q 'dtoverlay=disable-bt' /boot/firmware/config.txt 2>/dev/null || \
                       ! systemctl is-enabled --quiet bluetooth 2>/dev/null ;;
    sudoers)         [[ -f /etc/sudoers.d/argos ]] && visudo -c -f /etc/sudoers.d/argos &>/dev/null ;;
    sparrow)         [[ -f /opt/sparrow-wifi/sparrowwifiagent.py ]] ;;
    gsm_evil)        [[ -d "$SETUP_HOME/gsmevil2/venv" ]] && \
                       "$SETUP_HOME/gsmevil2/venv/bin/python" -c 'import flask' 2>/dev/null ;;
    dev_monitor)     [[ -f "$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service" ]] ;;
    docker)          command -v docker &>/dev/null ;;
    zram)            [[ -f /etc/systemd/system/zram-swap.service ]] ;;
    textmode)        [[ "$(systemctl get-default 2>/dev/null)" == "multi-user.target" ]] ;;
    vnc)             [[ -f "$SETUP_HOME/.config/systemd/user/vnc-ondemand.socket" ]] ;;
    tailscale)       command -v tailscale &>/dev/null ;;
    claude_code)     sudo -u "$SETUP_USER" bash -c 'command -v claude' &>/dev/null ;;
    gemini_cli)      sudo -u "$SETUP_USER" bash -c 'command -v gemini' &>/dev/null ;;
    agent_browser)   sudo -u "$SETUP_USER" bash -c 'command -v agent-browser' &>/dev/null ;;
    chromadb)        sudo -u "$SETUP_USER" bash -c 'command -v bun' &>/dev/null ;;
    claude_mem)      [[ -d "$SETUP_HOME/.claude/plugins/cache/thedotmack/claude-mem" ]] && \
                       [[ -f "$SETUP_HOME/.claude-mem/settings.json" ]] ;;
    headless_debug)  [[ -f /etc/systemd/system/argos-headless.service ]] ;;
    zsh_dotfiles)    command -v zsh &>/dev/null && [[ -d "$SETUP_HOME/.oh-my-zsh" ]] ;;
    zsh_default)     [[ "$(getent passwd "$SETUP_USER" | cut -d: -f7)" == *zsh ]] ;;
    tmux_sessions)   command -v tmux &>/dev/null ;;
    *)               return 1 ;;
  esac
}

# =============================================
# INSTALL FUNCTIONS
# =============================================

install_sudoers() {
  local sudoers_file="/etc/sudoers.d/argos"

  if [[ -f "$sudoers_file" ]] && visudo -c -f "$sudoers_file" &>/dev/null; then
    echo "  Sudoers already configured"
    return 0
  fi

  echo "  Writing NOPASSWD rules to $sudoers_file..."
  cat > "${sudoers_file}.tmp" << SUDOERS_EOF
# Argos — auto-generated by setup-host.sh
# GSM Evil — SDR capture and process management
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/grgsm_livemon_headless
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/setsid
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/pkill
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/kill
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/timeout
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/sbin/tcpdump
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/tshark
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/lsof
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/fuser
# Sparrow-WiFi — GUI launch (scoped to specific script)
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/python3 /opt/sparrow-wifi/sparrow-wifi.py
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/python3 /opt/sparrow-wifi/sparrowwifiagent.py *

# Kismet — WiFi discovery service
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/kismet
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop kismet
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/sbin/iw
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/sbin/ip

# HackRF — RF sweep
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/hackrf_info

# Argos process manager + CPU protector — restart critical services
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart earlyoom
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart gpsd
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart argos-final
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart argos-kismet
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-droneid
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-kismet
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-headless
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-droneid
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-kismet
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-headless

# Argos WiFi resilience — interface recovery
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlan0 *
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/nmcli device reapply wlan0
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/nmcli device disconnect wlan0
$SETUP_USER ALL=(ALL) NOPASSWD: /usr/bin/nmcli device connect wlan0
SUDOERS_EOF

  if visudo -c -f "${sudoers_file}.tmp" &>/dev/null; then
    mv "${sudoers_file}.tmp" "$sudoers_file"
    chmod 0440 "$sudoers_file"
    echo "  Sudoers rules installed and validated"
  else
    rm -f "${sudoers_file}.tmp"
    echo "  ERROR: Sudoers validation failed — rules not installed"
    return 1
  fi
}

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

  # 1b-extra. Udev rule to auto-mark future USB WiFi adapters as NM-unmanaged
  # This ensures Alfa cards plugged in AFTER setup still get excluded from NM.
  # Only wlan0 (built-in RPi WiFi) should be managed by NetworkManager.
  local NM_UDEV_RULE="/etc/udev/rules.d/99-argos-wifi-unmanaged.rules"
  if [[ ! -f "$NM_UDEV_RULE" ]]; then
    cat > "$NM_UDEV_RULE" << 'WIFI_UDEV'
# Argos: auto-mark USB WiFi adapters as unmanaged by NetworkManager
# Only wlan0 (RPi onboard Broadcom) is managed for internet connectivity.
# All USB WiFi adapters are reserved for Kismet monitor mode.
# DEVTYPE=="wlan" ensures only wireless interfaces are matched (not USB Ethernet).
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0e8d", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0bda", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="148f", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0cf3", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="2357", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="7392", ENV{NM_UNMANAGED}="1"
WIFI_UDEV
    udevadm control --reload-rules 2>/dev/null || true
    echo "  Installed udev rule to auto-unmanage USB WiFi adapters"
    changed=true
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
  # --allow-releaseinfo-change tolerates repo metadata changes;
  # || true prevents broken third-party .list files from aborting the entire install
  apt-get update -q --allow-releaseinfo-change || {
    echo "  WARNING: apt-get update had errors (broken repo entries?) — continuing anyway"
  }
  _ensure_pkgs \
    wireless-tools iw ethtool usbutils tmux zsh build-essential \
    python3 python3-venv python3-pip \
    libsqlite3-dev pkg-config \
    curl wget git \
    xvfb chromium earlyoom \
    aircrack-ng wifite \
    firmware-linux-nonfree firmware-misc-nonfree \
    firmware-mediatek firmware-realtek firmware-atheros
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
  _ensure_pkgs gpsd gpsd-clients gpsd-tools

  # Configure gpsd to use stable /dev/gps0 symlink (created by udev rule below)
  cat > /etc/default/gpsd <<'GPSD_CONF'
# GPS daemon configuration — managed by setup-host
DEVICES="/dev/gps0"
GPSD_OPTIONS="-n"
USBAUTO="true"
GPSD_CONF

  # Udev rules: create /dev/gps0 symlink for common GPS USB adapters
  cat > /etc/udev/rules.d/99-gps.rules <<'GPS_UDEV'
# Stable symlink for USB GPS adapters — creates /dev/gps0 regardless of enumeration order
# Prolific PL2303 (common GPS puck)
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", ATTRS{idProduct}=="23a3", SYMLINK+="gps0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="gpsd.service"
# Silicon Labs CP210x (u-blox, Adafruit, SparkFun GPS)
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", SYMLINK+="gps0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="gpsd.service"
# FTDI FT232R (many GPS adapters)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", SYMLINK+="gps0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="gpsd.service"
# CH340/CH341 (cheap USB-serial GPS adapters)
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="gps0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="gpsd.service"
# u-blox direct USB (u-blox 7/8/9/10)
SUBSYSTEM=="tty", ATTRS{idVendor}=="1546", ATTRS{idProduct}=="01a8", SYMLINK+="gps0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="gpsd.service"
GPS_UDEV

  udevadm control --reload-rules 2>/dev/null || true
  systemctl enable gpsd.socket 2>/dev/null || true
  _ok "gpsd configured with /dev/gps0 symlink and udev rule"
}

# Add Kismet from the official kismetwireless.net repo
# Args: $1=distro (e.g. "kali", "bookworm"), $2=codename (e.g. "kali-rolling", "bookworm")
# Cleans up .list file on failure to prevent poisoning future apt-get runs.
_install_kismet_from_repo() {
  local distro="$1" codename="$2"
  echo "  Using Kismet repo: release/$distro $codename"
  # Remove stale entries from previous failed runs
  rm -f /etc/apt/sources.list.d/kismet.list
  rm -f /usr/share/keyrings/kismet-archive-keyring.gpg
  wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key --quiet \
    | gpg --dearmor | tee /usr/share/keyrings/kismet-archive-keyring.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release/$distro $codename main" \
    > /etc/apt/sources.list.d/kismet.list
  if ! apt-get update -q; then
    echo "  WARNING: Kismet repo at release/$distro $codename not reachable — removing broken entry"
    rm -f /etc/apt/sources.list.d/kismet.list
    rm -f /usr/share/keyrings/kismet-archive-keyring.gpg
    return 1
  fi
  if ! apt-get install -y -q kismet; then
    echo "  WARNING: Kismet install from repo failed — removing repo entry"
    rm -f /etc/apt/sources.list.d/kismet.list
    rm -f /usr/share/keyrings/kismet-archive-keyring.gpg
    return 1
  fi
}

_install_kismet_from_source() {
  echo "  Building Kismet from source (this takes several minutes on ARM)..."
  _ensure_pkgs build-essential git libmicrohttpd-dev pkg-config zlib1g-dev \
    libpcap-dev libsqlite3-dev libprotobuf-dev libprotobuf-c-dev protobuf-compiler \
    protobuf-c-compiler libsensors-dev libusb-1.0-0-dev python3-setuptools \
    python3-protobuf python3-numpy librtlsdr-dev libubertooth-dev libbtbb-dev \
    libwebsockets-dev libcap-dev
  local BUILD_DIR="/tmp/kismet-build"
  rm -rf "$BUILD_DIR"
  git clone --depth 1 https://github.com/kismetwireless/kismet.git "$BUILD_DIR"
  cd "$BUILD_DIR"
  ./configure --prefix=/usr/local
  make -j"$(nproc)"
  make install
  make suidinstall
  cd /
  rm -rf "$BUILD_DIR"
  # Create kismet group if it doesn't exist
  if ! getent group kismet &>/dev/null; then
    groupadd kismet
  fi
}

install_kismet() {
  if command -v kismet &>/dev/null; then
    echo "  Kismet already installed: $(kismet --version 2>&1 | head -1)"
  else
    echo "  Installing Kismet..."
    if [[ "$OS_ID" == "kali" ]]; then
      # Kali carries Kismet in its own repos
      apt-get install -y -q kismet
    elif [[ "$OS_ID" == "parrot" ]]; then
      # Parrot may carry Kismet; try native repos first
      if apt-get install -y -q kismet 2>/dev/null; then
        echo "  Kismet installed from Parrot repos"
      else
        # Prebuilt packages require libwebsockets17 which Parrot 7.x doesn't have
        # (ships libwebsockets19). Build from source instead.
        echo "  Kismet packages have unmet deps (libwebsockets17) — building from source..."
        _install_kismet_from_source
      fi
    else
      # Add kismetwireless repo for other Debian-based distros
      local DEBIAN_CODENAME
      DEBIAN_CODENAME="$(resolve_debian_codename)"
      if ! _install_kismet_from_repo "$DEBIAN_CODENAME" "$DEBIAN_CODENAME"; then
        echo "  Repo install failed — building from source..."
        _install_kismet_from_source
      fi
    fi
  fi

  # Ensure user is in the 'kismet' group for non-root capture
  if getent group kismet &>/dev/null; then
    if ! getent group kismet | grep -q "$SETUP_USER"; then
      echo "  Adding $SETUP_USER to kismet group (non-root capture)..."
      usermod -aG kismet "$SETUP_USER"
    else
      echo "  $SETUP_USER already in kismet group"
    fi
  else
    echo "  WARNING: kismet group not created by package — non-root capture may fail"
  fi

  # Verify Kismet can run
  if command -v kismet &>/dev/null; then
    echo "  Kismet OK: $(kismet --version 2>&1 | head -1)"
  else
    echo "  ERROR: Kismet binary not found after install"
    return 1
  fi
}

install_kismet_gps() {
  local KISMET_CONF="/etc/kismet/kismet.conf"
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
}

install_bluetooth_disable() {
  # Disable Bluetooth on Raspberry Pi to prevent USB power interference.
  # On RPi, BT and USB share a power rail — BT can starve USB devices
  # (HackRF, Alfa WiFi adapters, GPS) of current, causing dropouts.
  # Safe to skip on non-RPi systems.

  local BOOT_CONFIG="/boot/firmware/config.txt"
  local CHANGED=false

  # RPi-specific: add dtoverlay to boot config
  if [[ -f "$BOOT_CONFIG" ]]; then
    if grep -q 'dtoverlay=disable-bt' "$BOOT_CONFIG"; then
      echo "  Bluetooth already disabled in $BOOT_CONFIG"
    else
      echo "  Disabling Bluetooth in $BOOT_CONFIG..."
      echo "" >> "$BOOT_CONFIG"
      echo "# Argos: disable Bluetooth to avoid USB power issues with RF hardware" >> "$BOOT_CONFIG"
      echo "dtoverlay=disable-bt" >> "$BOOT_CONFIG"
      CHANGED=true
    fi
  elif [[ -f "/boot/config.txt" ]]; then
    # Older RPi OS uses /boot/config.txt
    local OLD_CONFIG="/boot/config.txt"
    if grep -q 'dtoverlay=disable-bt' "$OLD_CONFIG"; then
      echo "  Bluetooth already disabled in $OLD_CONFIG"
    else
      echo "  Disabling Bluetooth in $OLD_CONFIG..."
      echo "" >> "$OLD_CONFIG"
      echo "# Argos: disable Bluetooth to avoid USB power issues with RF hardware" >> "$OLD_CONFIG"
      echo "dtoverlay=disable-bt" >> "$OLD_CONFIG"
      CHANGED=true
    fi
  else
    echo "  No RPi boot config found — skipping dtoverlay (non-RPi system)"
  fi

  # Stop and disable Bluetooth services on all systems
  if systemctl is-enabled --quiet bluetooth 2>/dev/null; then
    echo "  Disabling bluetooth.service..."
    systemctl stop bluetooth 2>/dev/null || true
    systemctl disable bluetooth 2>/dev/null || true
    CHANGED=true
  else
    echo "  bluetooth.service already disabled"
  fi

  if systemctl is-enabled --quiet hciuart 2>/dev/null; then
    echo "  Disabling hciuart.service..."
    systemctl stop hciuart 2>/dev/null || true
    systemctl disable hciuart 2>/dev/null || true
    CHANGED=true
  fi

  if $CHANGED; then
    echo "  Bluetooth disabled (reboot required for full effect on RPi)"
  else
    echo "  Bluetooth already fully disabled"
  fi
}

install_openssh() {
  # Pre-check: is openssh-server already installed and running?
  if dpkg -s openssh-server &>/dev/null && systemctl is-active --quiet ssh 2>/dev/null; then
    echo "  OpenSSH server already installed and running"
    return 0
  fi

  # Install if missing
  if ! dpkg -s openssh-server &>/dev/null; then
    echo "  Installing openssh-server..."
    apt-get install -y -q openssh-server
    if ! dpkg -s openssh-server &>/dev/null; then
      echo "  ERROR: openssh-server failed to install"
      return 1
    fi
  else
    echo "  openssh-server package present"
  fi

  # Enable and start
  systemctl is-enabled --quiet ssh 2>/dev/null || systemctl enable ssh
  if systemctl is-active --quiet ssh 2>/dev/null; then
    echo "  SSH server running"
  else
    echo "  Starting SSH server..."
    systemctl start ssh
    # Verify it actually started
    sleep 1
    if systemctl is-active --quiet ssh 2>/dev/null; then
      echo "  SSH server started"
    else
      echo "  WARNING: SSH service failed to start — check: systemctl status ssh"
    fi
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
  fi

  # Ensure user is in all required hardware groups
  for grp in plugdev dialout kismet; do
    if getent group "$grp" >/dev/null 2>&1; then
      usermod -aG "$grp" "$SETUP_USER" 2>/dev/null || true
    fi
  done
  echo "  User $SETUP_USER added to hardware groups: plugdev, dialout, kismet"
}

install_sdr_infra() {
  # HackRF CLI tools (hackrf_info, hackrf_sweep, hackrf_transfer) + dev library
  _ensure_pkgs hackrf libhackrf-dev
  # SoapySDR abstraction layer + device modules
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
  [[ -f /etc/default/earlyoom ]] || touch /etc/default/earlyoom
  # Memory threshold: 5% RAM free (~400 MB on 8 GB), 20% swap, check every 10s.
  # Debug logging (-g) writes to journal for post-mortem analysis.
  # Avoid: system-critical + dev tools. Prefer: expendable heavy processes.
  # Xvfb/chromium removed from avoid — they're expendable and recoverable.
  cat > /etc/default/earlyoom << 'EARLYOOM'
EARLYOOM_ARGS="-m 5 -s 20 -r 10 -g --avoid '(^|/)(init|sshd|tailscaled|NetworkManager|dockerd|systemd|node.*vscode|vite|chroma)$' --prefer '(^|/)(ollama|bun|svelte-check|tshark|wireshark|jaeger|puppeteer)$'"
EARLYOOM
  systemctl enable earlyoom
  systemctl restart earlyoom
  echo "  EarlyOOM configured (trigger: 5% free, poll: 10s, debug log, prefer kill: ollama+bun+svelte-check+tshark+jaeger)."
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

install_mem_hardening() {
  # ── 1. sysctl tuning ──
  cat > /etc/sysctl.d/99-memory.conf << 'SYSCTL'
# Argos memory hardening — RPi 5 (8 GB)
vm.swappiness = 80
vm.min_free_kbytes = 131072
vm.dirty_ratio = 5
vm.dirty_background_ratio = 2
vm.overcommit_memory = 0
vm.panic_on_oom = 0
vm.vfs_cache_pressure = 150
vm.zone_reclaim_mode = 0
SYSCTL
  sysctl -p /etc/sysctl.d/99-memory.conf > /dev/null 2>&1
  echo "  sysctl tuning applied (swappiness=80, min_free=128MB, vfs_pressure=150)."

  # ── 2. /tmp size cap (512 MB) ──
  local TMP_DROPIN_DIR="/etc/systemd/system/tmp.mount.d"
  mkdir -p "$TMP_DROPIN_DIR"
  cat > "$TMP_DROPIN_DIR/size-limit.conf" << 'TMPMOUNT'
[Mount]
Options=mode=1777,strictatime,nosuid,nodev,size=512m
TMPMOUNT
  echo "  /tmp capped at 512 MB via systemd drop-in."

  # ── 3. tmpfiles.d auto-cleanup rules ──
  cat > /etc/tmpfiles.d/argos-cleanup.conf << 'TMPFILES'
# Argos tmpfiles.d cleanup rules
# Type 'e': adjust/clean existing files/dirs matching path (supports globs)
# Format: type path mode uid gid age

# pcap/capture files — age out after 30 minutes
e /tmp/*.pcap     - - - 30m
e /tmp/*.pcapng   - - - 30m
e /tmp/*.cap      - - - 30m

# puppeteer Chrome profiles — age out after 2 hours
e /tmp/puppeteer_*  - - - 2h

# Chromium temp dirs — age out after 2 hours
e /tmp/.org.chromium.Chromium*  - - - 2h

# Argos lock files — age out after 1 hour
e /tmp/argos-*.lock  - - - 1h

# npm temp dirs — age out after 6 hours
e /tmp/npm-*  - - - 6h
TMPFILES
  echo "  tmpfiles.d cleanup rules installed."

  # ── 4. tmpreaper + 15-min cron ──
  _ensure_pkg tmpreaper
  cat > /etc/cron.d/argos-tmp-cleanup << 'CRON'
# Argos: clean stale pcap/chromium temps every 15 minutes
*/15 * * * * root find /tmp \( -name '*.pcap' -o -name '*.pcapng' -o -name '*.cap' \) -mmin +30 -delete 2>/dev/null; true
*/15 * * * * root find /tmp -maxdepth 2 -name 'puppeteer_*' -mmin +120 -exec rm -rf {} + 2>/dev/null; true
CRON
  echo "  tmpreaper installed, 15-min cron cleanup active."

  # ── 5. argos-startup.service ──
  # NOTE: startup service is now installed by install-services.sh from
  # deployment/argos-startup.service (templated). The install_argos_services
  # component handles this. We just ensure the script is executable here.
  local STARTUP_SCRIPT="$PROJECT_DIR/scripts/startup-check.sh"
  if [[ -f "$STARTUP_SCRIPT" ]]; then
    chmod +x "$STARTUP_SCRIPT"
    echo "  startup-check.sh marked executable (service installed by install_argos_services)."
  fi

  # ── 6. Kernel boot parameters (PSI + cgroup memory controller) ──
  local CMDLINE="/boot/firmware/cmdline.txt"
  if [[ -f "$CMDLINE" ]]; then
    local cmdline_changed=false
    # PSI (Pressure Stall Information) — needed for memory pressure monitoring
    if ! grep -q 'psi=1' "$CMDLINE"; then
      sed -i 's/$/ psi=1/' "$CMDLINE"
      echo "  psi=1 added to kernel cmdline."
      cmdline_changed=true
    fi
    # cgroup memory controller — required for cgroup_mem MemoryHigh/MemoryMax limits
    if ! grep -q 'cgroup_enable=memory' "$CMDLINE"; then
      sed -i 's/$/ cgroup_enable=memory cgroup_memory=1/' "$CMDLINE"
      echo "  cgroup_enable=memory cgroup_memory=1 added to kernel cmdline."
      cmdline_changed=true
    fi
    if [[ "$cmdline_changed" == true ]]; then
      echo "  Kernel cmdline updated (active after next reboot)."
    else
      echo "  Kernel boot params already configured (psi=1, cgroup memory)."
    fi
  fi

  # ── 7. NODE_COMPILE_CACHE on NVMe ──
  local CACHE_DIR="$SETUP_HOME/.cache/node-compile-cache"
  sudo -u "$SETUP_USER" mkdir -p "$CACHE_DIR"

  local ENVD_DIR="$SETUP_HOME/.config/environment.d"
  sudo -u "$SETUP_USER" mkdir -p "$ENVD_DIR"
  echo "NODE_COMPILE_CACHE=$CACHE_DIR" > "$ENVD_DIR/argos-node.conf"
  chown "$SETUP_USER":"$SETUP_USER" "$ENVD_DIR/argos-node.conf"

  local ZSHENV="$SETUP_HOME/.zshenv"
  if ! grep -q 'NODE_COMPILE_CACHE' "$ZSHENV" 2>/dev/null; then
    echo "export NODE_COMPILE_CACHE=$CACHE_DIR" >> "$ZSHENV"
    chown "$SETUP_USER":"$SETUP_USER" "$ZSHENV"
  fi
  echo "  NODE_COMPILE_CACHE redirected to NVMe ($CACHE_DIR)."

  # ── 8. Wireshark capture directory ──
  local CAPTURES_DIR="$SETUP_HOME/captures"
  sudo -u "$SETUP_USER" mkdir -p "$CAPTURES_DIR"
  local WS_RECENT="$SETUP_HOME/.config/wireshark/recent"
  sudo -u "$SETUP_USER" mkdir -p "$(dirname "$WS_RECENT")"
  cat > "$WS_RECENT" << EOF
recent.gui.fileopen_dir: $CAPTURES_DIR
recent.capture_file_save_dir: $CAPTURES_DIR
EOF
  chown "$SETUP_USER":"$SETUP_USER" "$WS_RECENT"
  echo "  Wireshark capture directory set to $CAPTURES_DIR."

  echo "  Memory hardening complete (8 layers installed)."
}

install_argos_services() {
  # Build the production app and install all systemd services.
  # This is the final core component — runs after npm_deps, env_file, and mem_hardening.
  if [[ "${DRY_RUN:-}" == "true" ]]; then
    echo "  [DRY-RUN] Would run: npm run build"
    echo "  [DRY-RUN] Would run: npm run db:migrate"
    echo "  [DRY-RUN] Would run: install-services.sh (installs 9 systemd services)"
    echo "  [DRY-RUN] Would copy 3 monitor scripts to /usr/local/bin/"
    echo "  [DRY-RUN] Would enable: argos-startup, argos-final, argos-kismet"
    echo "  [DRY-RUN] Would enable: argos-cpu-protector, argos-wifi-resilience, argos-process-manager"
    return 0
  fi

  # Ensure log directory exists
  local LOG_DIR="$PROJECT_DIR/logs"
  sudo -u "$SETUP_USER" mkdir -p "$LOG_DIR"

  echo "  Building production app (log: logs/setup-build.log)..."
  if sudo -u "$SETUP_USER" bash -c "cd '$PROJECT_DIR' && npm run build > '$LOG_DIR/setup-build.log' 2>&1"; then
    echo "  Production build created (build/)."
  else
    echo "  [ERROR] npm run build failed — see logs/setup-build.log"
    echo "  Skipping service installation. Fix the build and re-run:"
    echo "    cd $PROJECT_DIR && npm run build && sudo bash scripts/ops/install-services.sh"
    return 1
  fi

  # Run database migrations
  echo "  Running database migrations (log: logs/setup-migrate.log)..."
  if sudo -u "$SETUP_USER" bash -c "cd '$PROJECT_DIR' && npm run db:migrate > '$LOG_DIR/setup-migrate.log' 2>&1"; then
    echo "  Database migrations applied."
  else
    echo "  [WARN] Database migration failed — see logs/setup-migrate.log"
    echo "  Will retry on first app start."
  fi

  # Install systemd services via the service installer
  echo "  Installing systemd services..."
  bash "$SCRIPT_DIR/install-services.sh"

  echo "  Argos services installed. After reboot:"
  echo "    - argos-startup (boot health check)"
  echo "    - argos-final (production app on port 5173)"
  echo "    - argos-kismet (WiFi scanner)"
  echo "    - argos-cpu-protector (thermal monitor)"
  echo "    - argos-wifi-resilience (WiFi watchdog)"
  echo "    - argos-process-manager (process lifecycle)"
}

install_docker() {
  if command -v docker &>/dev/null; then
    echo "  Docker already installed: $(docker --version)"
  else
    echo "  Installing Docker..."
    DEBIAN_CODENAME="$(resolve_debian_codename)"
    ARCH="$(dpkg --print-architecture)"
    echo "  Using Debian codename: $DEBIAN_CODENAME, arch: $ARCH"
    # Remove stale entries from previous failed runs
    rm -f /etc/apt/sources.list.d/docker.list
    apt-get install -y -q ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/debian/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $DEBIAN_CODENAME stable" > /etc/apt/sources.list.d/docker.list
    if ! apt-get update -q; then
      echo "  WARNING: Docker repo for $DEBIAN_CODENAME not reachable — removing broken entry"
      rm -f /etc/apt/sources.list.d/docker.list
      rm -f /etc/apt/keyrings/docker.asc
      return 1
    fi
    if ! apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
      echo "  WARNING: Docker install failed — removing repo entry"
      rm -f /etc/apt/sources.list.d/docker.list
      rm -f /etc/apt/keyrings/docker.asc
      return 1
    fi
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

  # Pre-check: is GsmEvil2 already fully installed?
  if [[ -d "$GSMEVIL_DIR/venv" ]] && \
     "$GSMEVIL_DIR/venv/bin/python" -c 'import flask, pyshark' 2>/dev/null && \
     [[ -f "$GSMEVIL_DIR/GsmEvil.py" ]]; then
    echo "  GsmEvil2 already installed at $GSMEVIL_DIR"
    # Still verify dependencies are present
    command -v grgsm_livemon_headless &>/dev/null && echo "  gr-gsm OK" || echo "  WARNING: gr-gsm not installed (GSM capture won't work)"
    command -v kal &>/dev/null && echo "  kalibrate-rtl OK" || echo "  WARNING: kalibrate-rtl not installed (use manual frequency entry)"
    return 0
  fi

  # Install gr-gsm (required for GSM packet capture)
  _install_grgsm || true
  # Install kalibrate-rtl (required for frequency scanning)
  _install_kalibrate || true

  # Clone or update GsmEvil2 repo
  _clone_or_pull "https://github.com/ninjhacks/gsmevil2.git" "$GSMEVIL_DIR"

  # Verify the main script exists
  if [[ ! -f "$GSMEVIL_DIR/GsmEvil.py" ]]; then
    echo "  ERROR: GsmEvil.py not found in $GSMEVIL_DIR — repo may have changed"
    return 1
  fi

  # Python virtual environment + dependencies
  local GSMEVIL_VENV="$GSMEVIL_DIR/venv"
  if [[ -d "$GSMEVIL_VENV" ]] && "$GSMEVIL_VENV/bin/python" -c 'import flask, pyshark' 2>/dev/null; then
    echo "  GsmEvil2 venv OK"
  else
    echo "  Creating Python venv and installing dependencies..."
    sudo -u "$SETUP_USER" python3 -m venv "$GSMEVIL_VENV"
    if [[ -f "$GSMEVIL_DIR/requirements.txt" ]]; then
      sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet -r "$GSMEVIL_DIR/requirements.txt"
    else
      # Fallback: install known dependencies from GsmEvil2 README
      sudo -u "$SETUP_USER" "$GSMEVIL_VENV/bin/pip" install --quiet \
        "flask==2.2.2" "flask_socketio==5.3.2" "pyshark==0.5.3"
    fi
    # Verify venv works
    if "$GSMEVIL_VENV/bin/python" -c 'import flask, pyshark' 2>/dev/null; then
      echo "  GsmEvil2 Python dependencies installed"
    else
      echo "  WARNING: GsmEvil2 venv creation succeeded but imports failed"
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

    # cgroup memory limits for Vite dev server (soft 1228M, hard 1536M)
    local DROPIN_DIR="$SETUP_HOME/.config/systemd/user/argos-dev-monitor.service.d"
    sudo -u "$SETUP_USER" mkdir -p "$DROPIN_DIR"
    cat > "$DROPIN_DIR/memory.conf" << 'DEVMEM'
[Service]
MemoryHigh=1228M
MemoryMax=1536M
MemorySwapMax=256M
DEVMEM
    chown -R "$SETUP_USER":"$SETUP_USER" "$DROPIN_DIR"
    echo "  Dev monitor cgroup limits: MemoryHigh=1228M, MemoryMax=1536M."

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

install_sparrow() {
  if [[ -f /opt/sparrow-wifi/sparrowwifiagent.py ]]; then
    echo "  Sparrow-WiFi already installed"
    return 0
  fi

  _ensure_pkgs python3-pip python3-dateutil python3-requests

  echo "  Cloning Sparrow-WiFi to /opt/sparrow-wifi..."
  git clone https://github.com/ghostop14/sparrow-wifi.git /opt/sparrow-wifi || {
    echo "  ERROR: Failed to clone Sparrow-WiFi repository"
    return 1
  }

  echo "  Installing Python dependencies..."
  pip3 install --break-system-packages flask flask-cors gps3 manuf scapy 2>/dev/null || \
    pip3 install flask flask-cors gps3 manuf scapy

  chown -R "$SETUP_USER":"$SETUP_USER" /opt/sparrow-wifi

  echo "  Sparrow-WiFi installed at /opt/sparrow-wifi"
  echo "  To enable: sudo systemctl enable --now sparrow-wifi-agent"
}

install_vnc() {
  _ensure_pkgs tigervnc-standalone-server tigervnc-tools socat

  # Ensure parent dirs are user-owned (not root)
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.config/systemd/user"
  sudo -u "$SETUP_USER" mkdir -p "$SETUP_HOME/.vnc"

  # xstartup — launches XFCE4 desktop inside VNC
  VNC_XSTARTUP="$SETUP_HOME/.vnc/xstartup"
  cat > "$VNC_XSTARTUP" << 'VNC_XSTARTUP_SCRIPT'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_SESSION_TYPE=x11
[ -r "$HOME/.Xresources" ] && xrdb "$HOME/.Xresources"
exec startxfce4
VNC_XSTARTUP_SCRIPT
  chmod +x "$VNC_XSTARTUP"
  chown "$SETUP_USER":"$SETUP_USER" "$VNC_XSTARTUP"

  # Socket unit — listens on 5901, triggers the proxy on first connection
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

  # Proxy service — bridges socket FD to backend on internal port 5911
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

  # Backend service — Xtigervnc + XFCE4 desktop (Type=simple, no PID file issues)
  VNC_BACKEND="$SETUP_HOME/.config/systemd/user/vnc-backend.service"
  cat > "$VNC_BACKEND" << 'VNC_BACKEND_UNIT'
[Unit]
Description=TigerVNC Server (on-demand backend)
After=syslog.target network.target

[Service]
Type=simple
Environment=HOME=%h
Environment=DISPLAY=:11
ExecStart=/bin/sh -c '/usr/bin/Xtigervnc :11 -localhost -geometry 1920x1200 -depth 24 -SecurityTypes None -rfbport 5911 & sleep 2 && %h/.vnc/xstartup'
ExecStop=/bin/sh -c 'kill $(cat /tmp/.X11-lock 2>/dev/null) 2>/dev/null; true'
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

install_claude_mem() {
  # Requires: Claude Code installed + ChromaDB component
  if ! _user_has_cmd claude; then
    echo "  Skipping — Claude Code not installed (required for claude-mem)"
    return 0
  fi

  local CLAUDE_DIR="$SETUP_HOME/.claude"
  local CLAUDE_MEM_DIR="$SETUP_HOME/.claude-mem"
  local CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"
  local HOOKS_DIR="$CLAUDE_DIR/hooks"

  # 1. Install claude-mem plugin (if not already installed)
  local PLUGIN_CACHE="$CLAUDE_DIR/plugins/cache/thedotmack/claude-mem"
  if [[ -d "$PLUGIN_CACHE" ]]; then
    echo "  claude-mem plugin already installed"
  else
    echo "  Installing claude-mem plugin..."
    if sudo -u "$SETUP_USER" bash -c 'claude plugin install claude-mem@thedotmack' 2>/dev/null; then
      echo "  claude-mem plugin installed"
    else
      echo "  WARNING: claude-mem install requires authenticated Claude Code."
      echo "  Run manually after authenticating: claude plugin install claude-mem@thedotmack"
      return 0
    fi
  fi

  # 2. Write claude-mem settings.json (remote chroma mode)
  sudo -u "$SETUP_USER" mkdir -p "$CLAUDE_MEM_DIR"
  local MEM_SETTINGS="$CLAUDE_MEM_DIR/settings.json"
  if [[ -f "$MEM_SETTINGS" ]]; then
    echo "  claude-mem settings already exist"
  else
    echo "  Writing claude-mem settings (remote chroma, claude-opus-4-6)..."
    sudo -u "$SETUP_USER" tee "$MEM_SETTINGS" > /dev/null << 'MEMSETTINGS'
{
  "CLAUDE_MEM_MODEL": "claude-opus-4-6",
  "CLAUDE_MEM_CONTEXT_OBSERVATIONS": "50",
  "CLAUDE_MEM_WORKER_PORT": "37777",
  "CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
  "CLAUDE_MEM_SKIP_TOOLS": "ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion",
  "CLAUDE_MEM_PROVIDER": "claude",
  "CLAUDE_MEM_CLAUDE_AUTH_METHOD": "cli",
  "CLAUDE_MEM_DATA_DIR": "",
  "CLAUDE_MEM_LOG_LEVEL": "INFO",
  "CLAUDE_MEM_MODE": "code",
  "CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS": "true",
  "CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS": "true",
  "CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT": "true",
  "CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT": "true",
  "CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES": "bugfix,feature,refactor,discovery,decision,change",
  "CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS": "how-it-works,why-it-exists,what-changed,problem-solution,gotcha,pattern,trade-off",
  "CLAUDE_MEM_CONTEXT_FULL_COUNT": "5",
  "CLAUDE_MEM_CONTEXT_FULL_FIELD": "narrative",
  "CLAUDE_MEM_CONTEXT_SESSION_COUNT": "10",
  "CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY": "true",
  "CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE": "false",
  "CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED": "false",
  "CLAUDE_MEM_EXCLUDED_PROJECTS": "",
  "CLAUDE_MEM_FOLDER_MD_EXCLUDE": "[]",
  "CLAUDE_MEM_CHROMA_MODE": "remote",
  "CLAUDE_MEM_CHROMA_HOST": "127.0.0.1",
  "CLAUDE_MEM_CHROMA_PORT": "8000",
  "CLAUDE_MEM_CHROMA_SSL": "false",
  "CLAUDE_MEM_CHROMA_API_KEY": "",
  "CLAUDE_MEM_CHROMA_TENANT": "default_tenant",
  "CLAUDE_MEM_CHROMA_DATABASE": "default_database"
}
MEMSETTINGS
    # Patch DATA_DIR with actual home path
    sed -i "s|\"CLAUDE_MEM_DATA_DIR\": \"\"|\"CLAUDE_MEM_DATA_DIR\": \"$CLAUDE_MEM_DIR\"|" "$MEM_SETTINGS"
  fi

  # 3. Enable claude-mem in global settings.json
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if _json_deep_has "$CLAUDE_SETTINGS" "enabledPlugins.claude-mem@thedotmack" "true" 2>/dev/null; then
      echo "  claude-mem already enabled in settings"
    else
      echo "  Enabling claude-mem plugin in settings..."
      _json_deep_set "$CLAUDE_SETTINGS" "enabledPlugins.claude-mem@thedotmack" "true"
      chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
    fi
  fi

  # 4. Install ensure-chroma-env.sh global hook
  sudo -u "$SETUP_USER" mkdir -p "$HOOKS_DIR"
  local HOOK_SCRIPT="$HOOKS_DIR/ensure-chroma-env.sh"
  if [[ -f "$HOOK_SCRIPT" ]]; then
    echo "  ensure-chroma-env hook already installed"
  else
    echo "  Installing ensure-chroma-env hook..."
    sudo -u "$SETUP_USER" tee "$HOOK_SCRIPT" > /dev/null << 'HOOKEOF'
#!/usr/bin/env bash
set -u
# Ensure running claude-mem worker has CHROMA_SSL=false.
# Restarts any worker spawned before the env fix was in place.
WORKER_PID=$(pgrep -f 'worker-service.cjs --daemon' 2>/dev/null | head -1)
if [ -n "${WORKER_PID:-}" ]; then
    if ! tr '\0' '\n' < "/proc/$WORKER_PID/environ" 2>/dev/null | grep -q '^CHROMA_SSL=false$'; then
        kill "$WORKER_PID" 2>/dev/null
    fi
fi
exit 0
HOOKEOF
    chmod +x "$HOOK_SCRIPT"
  fi

  # 5. Register SessionStart hook in global settings (if not already present)
  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if grep -q "ensure-chroma-env" "$CLAUDE_SETTINGS" 2>/dev/null; then
      echo "  SessionStart hook already registered"
    else
      echo "  Registering SessionStart hook in global settings..."
      python3 - "$CLAUDE_SETTINGS" "$HOOK_SCRIPT" << 'PYEOF'
import json, sys
fpath, hook_cmd = sys.argv[1], sys.argv[2]
with open(fpath) as f:
    s = json.load(f)
hooks = s.setdefault("hooks", {})
ss = hooks.setdefault("SessionStart", [])
ss.append({"hooks": [{"type": "command", "command": hook_cmd, "timeout": 10}]})
with open(fpath, "w") as f:
    json.dump(s, f, indent=2)
    f.write("\n")
PYEOF
      chown "$SETUP_USER":"$SETUP_USER" "$CLAUDE_SETTINGS"
    fi
  fi

  echo "  claude-mem configured (remote chroma on port 8000)"
}

install_gemini_cli() {
  if _user_has_cmd gemini; then
    echo "  Gemini CLI already installed"
  else
    echo "  Installing Gemini CLI..."
    # Install as root (script runs via sudo) so binary lands in /usr/bin
    npm install -g @google/gemini-cli
    echo "  Gemini CLI installed. Run 'gemini' to authenticate."
  fi
}

install_agent_browser() {
  if _user_has_cmd agent-browser; then
    echo "  agent-browser already installed"
  else
    echo "  Installing agent-browser..."
    # Install as root so binary lands in /usr/bin
    npm install -g agent-browser
  fi
  # Always ensure Chromium is available (handles partial installs)
  echo "  Ensuring Chromium for agent-browser..."
  sudo -u "$SETUP_USER" agent-browser install
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

  # cgroup memory limits for ChromaDB (soft 400M, hard 512M)
  local CHROMA_DROPIN_DIR="$SETUP_HOME/.config/systemd/user/chroma-server.service.d"
  sudo -u "$SETUP_USER" mkdir -p "$CHROMA_DROPIN_DIR"
  cat > "$CHROMA_DROPIN_DIR/memory.conf" << 'CHROMAMEM'
[Service]
MemoryHigh=400M
MemoryMax=512M
MemorySwapMax=64M
CHROMAMEM
  chown -R "$SETUP_USER":"$SETUP_USER" "$CHROMA_DROPIN_DIR"
  echo "  ChromaDB cgroup limits: MemoryHigh=400M, MemoryMax=512M."

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
  local chroma_uid
  chroma_uid=$(id -u "$SETUP_USER")
  sudo -u "$SETUP_USER" \
    XDG_RUNTIME_DIR="/run/user/$chroma_uid" \
    DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$chroma_uid/bus" \
    CHROMA_SSL=false \
    systemctl --user import-environment CHROMA_SSL 2>/dev/null || true

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
  sudo -u "$SETUP_USER" mkdir -p "$FONT_DIR"
  local FIRA_ZIP
  FIRA_ZIP="$(mktemp /tmp/FiraCode.XXXXXX.zip)"
  curl -fsSL -o "$FIRA_ZIP" https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/FiraCode.zip
  # mktemp creates root-owned file; make it readable for the unzip as SETUP_USER
  chmod a+r "$FIRA_ZIP"
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
  # tmux itself doesn't need DBUS, but we export XDG_RUNTIME_DIR so
  # the _enable_user_service call later works correctly
  export XDG_RUNTIME_DIR="/run/user/$user_id"
  export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$user_id/bus"
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

  # Inject tmux auto-attach for SSH sessions into .zshrc.
  # Must be placed ABOVE the Powerlevel10k instant prompt block
  # (P10k captures the TTY, which prevents tmux attach from working).
  local ZSHRC="$SETUP_HOME/.zshrc"
  local TMUX_MARKER="# Tmux auto-attach for SSH sessions"
  if [[ -f "$ZSHRC" ]] && ! grep -qF "$TMUX_MARKER" "$ZSHRC"; then
    echo "  Injecting tmux auto-attach block into .zshrc..."
    local TMUX_BLOCK
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
      local P10K_LINE INSERT_LINE
      P10K_LINE=$(grep -n "Enable Powerlevel10k instant prompt" "$ZSHRC" | head -1 | cut -d: -f1)
      INSERT_LINE=$(( P10K_LINE - 1 ))
      [[ "$INSERT_LINE" -lt 1 ]] && INSERT_LINE=1
      sudo -u "$SETUP_USER" sed -i "${INSERT_LINE}r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
    else
      # No P10k found — prepend after the first few PATH/profile lines
      sudo -u "$SETUP_USER" sed -i "5r /dev/stdin" "$ZSHRC" <<< "$TMUX_BLOCK"
    fi
    echo "  Tmux auto-attach configured (SSH -> dev1 session)"
  elif [[ -f "$ZSHRC" ]]; then
    echo "  Tmux auto-attach already present in .zshrc"
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
