#!/usr/bin/env bash
# Install Argos systemd service files
# Usage: sudo bash scripts/ops/install-services.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/../../deployment" && pwd)"
SYSTEMD_DIR="/etc/systemd/system"

if [[ $EUID -ne 0 ]]; then
  echo "Error: Must run as root (sudo)" >&2
  exit 1
fi

echo "Installing Argos systemd services from $DEPLOY_DIR..."

for svc in "$DEPLOY_DIR"/*.service; do
  name="$(basename "$svc")"
  echo "  Installing $name"
  cp "$svc" "$SYSTEMD_DIR/$name"
  chmod 644 "$SYSTEMD_DIR/$name"
done

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling core services..."
systemctl enable argos-final.service 2>/dev/null || true
systemctl enable argos-kismet.service 2>/dev/null || true
systemctl enable argos-cpu-protector.service 2>/dev/null || true
systemctl enable argos-wifi-resilience.service 2>/dev/null || true
systemctl enable argos-process-manager.service 2>/dev/null || true

echo "Done. Services installed and enabled."
echo ""
echo "Available services:"
for svc in "$DEPLOY_DIR"/*.service; do
  name="$(basename "$svc" .service)"
  echo "  systemctl start $name"
done
