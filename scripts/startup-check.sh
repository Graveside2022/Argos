#!/bin/bash
# Argos Startup Check - ensures all services are running after boot
# Usage: sudo ./scripts/startup-check.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

echo "=== Argos Startup Check ==="
echo ""

# --- Tailscale ---
echo "Checking Tailscale..."
if systemctl is-active --quiet tailscaled; then
    ok "tailscaled is running"
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
    [ -n "$TAILSCALE_IP" ] && ok "Tailscale IP: $TAILSCALE_IP"
else
    fail "tailscaled is not running - starting..."
    systemctl start tailscaled && ok "tailscaled started" || fail "could not start tailscaled"
fi

# --- Docker ---
echo ""
echo "Checking Docker..."
if systemctl is-active --quiet docker; then
    ok "Docker is running"
else
    fail "Docker is not running - starting..."
    systemctl start docker && ok "Docker started" || fail "could not start Docker"
fi

# --- Portainer (port 9000) ---
echo ""
echo "Checking Portainer..."
if docker ps --format '{{.Names}}' | grep -q portainer; then
    ok "Portainer container is running"
else
    warn "Portainer not running - starting..."
    docker start portainer 2>/dev/null \
        || docker run -d --name portainer --restart=always \
            -p 9000:9000 -p 9443:9443 \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v portainer_data:/data \
            portainer/portainer-ce:latest
    ok "Portainer started"
fi

# --- Argos containers (argos-dev + hackrf-backend-dev) ---
echo ""
echo "Checking Argos containers..."
COMPOSE_FILE="/home/kali/Documents/Argos/Argos/docker/docker-compose.dev-full.yml"

for CONTAINER in argos-dev hackrf-backend-dev; do
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        ok "$CONTAINER is running"
    else
        warn "$CONTAINER not running - starting via compose..."
        docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null && ok "$CONTAINER started" || fail "could not start $CONTAINER"
    fi
done

# --- gpsd ---
echo ""
echo "Checking GPS..."
GPS_DEV=$(ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | head -1)
if [ -n "$GPS_DEV" ]; then
    ok "GPS device found: $GPS_DEV"
    if pgrep -x gpsd > /dev/null; then
        ok "gpsd is running"
    else
        gpsd "$GPS_DEV" -F /var/run/gpsd.sock && ok "gpsd started on $GPS_DEV" || fail "could not start gpsd"
    fi
else
    warn "No GPS device detected - plug in GPS module to enable"
fi

# --- Summary ---
echo ""
echo "=== Status Summary ==="
echo "  Tailscale:  $(systemctl is-active tailscaled 2>/dev/null)"
echo "  Docker:     $(systemctl is-active docker 2>/dev/null)"
echo "  Portainer:  $(docker ps --format '{{.Status}}' --filter name=portainer 2>/dev/null || echo 'not running')"
echo "  Argos:      $(docker ps --format '{{.Status}}' --filter name=argos-dev 2>/dev/null || echo 'not running')"
echo "  HackRF:     $(docker ps --format '{{.Status}}' --filter name=hackrf-backend-dev 2>/dev/null || echo 'not running')"
echo "  gpsd:       $(pgrep -x gpsd > /dev/null && echo 'running' || echo 'not running')"
echo ""
echo "Done."
