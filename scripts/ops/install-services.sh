#!/usr/bin/env bash
# Install Argos systemd service files
# Templates __PROJECT_DIR__, __SETUP_USER__, and __DRONEID_DIR__ placeholders
# Usage: sudo bash scripts/ops/install-services.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deployment"
SYSTEMD_DIR="/etc/systemd/system"

if [[ $EUID -ne 0 ]]; then
  echo "Error: Must run as root (sudo)" >&2
  exit 1
fi

# Detect user (who invoked sudo)
SETUP_USER="${SUDO_USER:-$(whoami)}"
SETUP_HOME="$(eval echo ~"$SETUP_USER")"

# DroneID directory (sibling to project)
DRONEID_DIR="$(cd "$PROJECT_DIR/.." && pwd)/RemoteIDReceiver"

echo "Installing Argos systemd services..."
echo "  Project:   $PROJECT_DIR"
echo "  User:      $SETUP_USER"
echo "  DroneID:   $DRONEID_DIR"
echo ""

# Install operational monitor scripts to /usr/local/bin/
echo "Installing operational scripts..."
MONITOR_SCRIPTS=(argos-cpu-protector.sh argos-wifi-resilience.sh argos-process-manager.sh)
for script in "${MONITOR_SCRIPTS[@]}"; do
  src="$SCRIPT_DIR/$script"
  if [[ -f "$src" ]]; then
    cp "$src" "/usr/local/bin/$script"
    chmod 755 "/usr/local/bin/$script"
    echo "  Installed /usr/local/bin/$script"
  else
    echo "  [SKIP] $script (not found in $SCRIPT_DIR)"
  fi
done
echo ""

# Pre-flight checks
echo "Running pre-flight checks..."
if [[ ! -d "$PROJECT_DIR/build" ]]; then
  echo "  [WARN] build/ not found — run 'npm run build' before starting argos-final.service"
fi
echo ""

# System-level services (installed to /etc/systemd/system/)
SYSTEM_SERVICES=(
  argos-startup.service
  argos-final.service
  argos-kismet.service
  argos-cpu-protector.service
  argos-wifi-resilience.service
  argos-process-manager.service
  argos-headless.service
  argos-droneid.service
  gsmevil-patch.service
)

for name in "${SYSTEM_SERVICES[@]}"; do
  svc="$DEPLOY_DIR/$name"
  if [[ ! -f "$svc" ]]; then
    echo "  [SKIP] $name (not found)"
    continue
  fi
  # Skip DroneID if sibling directory doesn't exist
  if [[ "$name" == "argos-droneid.service" && ! -d "$DRONEID_DIR" ]]; then
    echo "  [SKIP] $name (DRONEID_DIR not found: $DRONEID_DIR)"
    continue
  fi
  echo "  Installing $name"
  sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
      -e "s|__SETUP_USER__|$SETUP_USER|g" \
      -e "s|__DRONEID_DIR__|$DRONEID_DIR|g" \
      "$svc" > "$SYSTEMD_DIR/$name"
  chmod 644 "$SYSTEMD_DIR/$name"
done

# User-level service (argos-dev-monitor) — installed to user systemd
USER_SERVICE="argos-dev-monitor.service"
if [[ -f "$DEPLOY_DIR/$USER_SERVICE" ]]; then
  echo "  Installing $USER_SERVICE (user service for $SETUP_USER)"
  USER_SYSTEMD_DIR="$SETUP_HOME/.config/systemd/user"
  sudo -u "$SETUP_USER" mkdir -p "$USER_SYSTEMD_DIR"
  sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
      "$DEPLOY_DIR/$USER_SERVICE" > "$USER_SYSTEMD_DIR/$USER_SERVICE"
  chown "$SETUP_USER":"$SETUP_USER" "$USER_SYSTEMD_DIR/$USER_SERVICE"
fi

# argos-dev.service — dev server (optional, not enabled by default)
DEV_SERVICE="argos-dev.service"
if [[ -f "$DEPLOY_DIR/$DEV_SERVICE" ]]; then
  echo "  Installing $DEV_SERVICE (not enabled by default)"
  sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
      -e "s|__SETUP_USER__|$SETUP_USER|g" \
      "$DEPLOY_DIR/$DEV_SERVICE" > "$SYSTEMD_DIR/$DEV_SERVICE"
  chmod 644 "$SYSTEMD_DIR/$DEV_SERVICE"
fi

echo ""
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling core services..."
systemctl enable argos-startup.service 2>/dev/null || true
systemctl enable argos-final.service 2>/dev/null || true
systemctl enable argos-kismet.service 2>/dev/null || true
# Enable monitor services only if their binaries were installed
for bin in argos-cpu-protector argos-wifi-resilience argos-process-manager; do
  if [[ -x "/usr/local/bin/${bin}.sh" ]]; then
    systemctl enable "${bin}.service" 2>/dev/null || true
  fi
done

# =============================================
# Network boot optimizations
# =============================================
echo ""
echo "Applying network boot optimizations..."

# Mask systemd-networkd-wait-online — Argos uses NetworkManager, not systemd-networkd.
# This service waits 2min then fails on every boot, blocking docker + argos-startup.
if systemctl is-enabled systemd-networkd-wait-online.service &>/dev/null 2>&1; then
  if [[ "$(systemctl is-enabled systemd-networkd-wait-online.service 2>/dev/null)" != "masked" ]]; then
    systemctl mask systemd-networkd-wait-online.service 2>/dev/null || true
    echo "  Masked systemd-networkd-wait-online.service (saves ~2min boot)"
  else
    echo "  systemd-networkd-wait-online.service already masked"
  fi
fi

# Reduce NetworkManager-wait-online timeout from 30s to 10s
NM_OVERRIDE_DIR="/etc/systemd/system/NetworkManager-wait-online.service.d"
NM_OVERRIDE="$NM_OVERRIDE_DIR/timeout.conf"
if [[ ! -f "$NM_OVERRIDE" ]]; then
  mkdir -p "$NM_OVERRIDE_DIR"
  cat > "$NM_OVERRIDE" <<'NMEOF'
[Service]
ExecStart=
ExecStart=/usr/bin/nm-online -s -q --timeout=10
NMEOF
  echo "  Reduced NetworkManager-wait-online timeout to 10s"
else
  echo "  NetworkManager-wait-online timeout override already exists"
fi

# Install WiFi power-save disable dispatcher (fixes brcmfmac latency spikes on RPi 5)
NM_DISPATCH="/etc/NetworkManager/dispatcher.d/99-wifi-powersave-off"
if [[ ! -f "$NM_DISPATCH" ]]; then
  cat > "$NM_DISPATCH" <<'DISPEOF'
#!/bin/bash
# Disable WiFi power save on connect — fixes latency spikes on brcmfmac (RPi 5)
if [ "$2" = "up" ] && [ "$(nmcli -t -f TYPE device show "$1" 2>/dev/null | grep -c wifi)" -gt 0 ]; then
    iw dev "$1" set power_save off
fi
DISPEOF
  chmod +x "$NM_DISPATCH"
  echo "  Installed WiFi power-save disable dispatcher"
else
  echo "  WiFi power-save dispatcher already exists"
fi

echo ""
echo "Done. Services installed and enabled."
echo ""
echo "Available services:"
for name in "${SYSTEM_SERVICES[@]}"; do
  svc_name="${name%.service}"
  echo "  systemctl start $svc_name"
done
echo "  systemctl --user start argos-dev-monitor  (as $SETUP_USER)"
