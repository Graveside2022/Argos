#!/bin/bash
# Argos Host Setup — run once after cloning on a fresh Raspberry Pi
# Usage: sudo bash scripts/setup-host.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo bash scripts/setup-host.sh"
    exit 1
fi

ARGOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="${SUDO_USER:-$(whoami)}"

echo "=== Argos Host Setup ==="
echo "Project: $ARGOS_DIR"
echo "User:    $USER_NAME"
echo ""

# --- Write .env for Docker Compose (Portainer needs absolute paths) ---
echo "ARGOS_DIR=$ARGOS_DIR" > "$ARGOS_DIR/docker/.env"
chown "$USER_NAME" "$ARGOS_DIR/docker/.env"

# --- Docker ---
echo "[1/5] Installing Docker..."
if command -v docker &>/dev/null; then
    echo "  Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$USER_NAME"
    systemctl enable docker
    echo "  Docker installed"
fi

# --- Portainer ---
echo "[2/5] Installing Portainer..."
if docker ps -a --format '{{.Names}}' | grep -q portainer; then
    echo "  Portainer already exists"
    docker start portainer 2>/dev/null || true
else
    docker volume create portainer_data
    docker run -d --name portainer --restart=always \
        -p 9000:9000 -p 9443:9443 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest
    echo "  Portainer installed (https://localhost:9443)"
fi

# --- Build Docker images ---
echo "[3/5] Building Argos Docker images..."
echo "  Building argos:dev..."
docker build -t argos:dev -f "$ARGOS_DIR/docker/Dockerfile" --target builder "$ARGOS_DIR"
echo "  Building argos-hackrf-backend:dev..."
docker build -t argos-hackrf-backend:dev -f "$ARGOS_DIR/hackrf_emitter/backend/Dockerfile" "$ARGOS_DIR/hackrf_emitter/backend"
echo "  Images built"

# --- gpsd ---
echo "[4/5] Configuring gpsd..."
apt-get update -qq && apt-get install -y -qq gpsd gpsd-clients >/dev/null 2>&1
# Enable USB auto-detection
cat > /etc/default/gpsd <<EOF
DEVICES=""
GPSD_OPTIONS=""
USBAUTO="true"
START_DAEMON="true"
EOF
systemctl enable gpsd
systemctl restart gpsd
echo "  gpsd configured (USB auto-detect enabled)"

# --- Boot service ---
echo "[5/5] Installing boot startup service..."
chmod +x "$ARGOS_DIR/scripts/startup-check.sh"
cat > /etc/systemd/system/argos-startup.service <<EOF
[Unit]
Description=Argos Startup Check
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=$ARGOS_DIR/scripts/startup-check.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable argos-startup.service
echo "  Boot service installed"

# --- Disable Bluetooth (frees USB power on Pi) ---
if ! grep -q "dtoverlay=disable-bt" /boot/firmware/config.txt 2>/dev/null; then
    echo "dtoverlay=disable-bt" >> /boot/firmware/config.txt
    systemctl disable hciuart 2>/dev/null || true
    systemctl disable bluetooth 2>/dev/null || true
    echo "  Bluetooth disabled (takes effect after reboot)"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Open Portainer:  https://<your-pi-ip>:9443"
echo "  2. Create admin account on first login"
echo "  3. Go to Stacks > Add Stack"
echo "  4. Paste contents of: docker/docker-compose.portainer-dev.yml"
echo "  5. Deploy the stack"
echo ""
echo "The app will be at: http://<your-pi-ip>:5173"
echo ""
echo "If you added your user to the docker group, log out and back in."
