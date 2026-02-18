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

# System-level services (installed to /etc/systemd/system/)
SYSTEM_SERVICES=(
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
systemctl enable argos-final.service 2>/dev/null || true
systemctl enable argos-kismet.service 2>/dev/null || true
systemctl enable argos-cpu-protector.service 2>/dev/null || true
systemctl enable argos-wifi-resilience.service 2>/dev/null || true
systemctl enable argos-process-manager.service 2>/dev/null || true

echo ""
echo "Done. Services installed and enabled."
echo ""
echo "Available services:"
for name in "${SYSTEM_SERVICES[@]}"; do
  svc_name="${name%.service}"
  echo "  systemctl start $svc_name"
done
echo "  systemctl --user start argos-dev-monitor  (as $SETUP_USER)"
