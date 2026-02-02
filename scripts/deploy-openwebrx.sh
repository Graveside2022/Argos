#!/bin/bash
#
# OpenWebRX Deployment Script for Argos
# Deploys jketterl/openwebrx-hackrf:stable with HackRF configuration
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/openwebrx/settings.json"
CONTAINER_NAME="openwebrx-hackrf"
IMAGE="jketterl/openwebrx-hackrf:stable"
VOLUME_NAME="openwebrx-hackrf-settings"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if HackRF is connected
if ! lsusb | grep -q "HackRF"; then
    warn "HackRF One not detected via USB. Container will deploy but SDR won't be available."
fi

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "Container '$CONTAINER_NAME' already exists."
    read -p "Do you want to remove and redeploy? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Stopping and removing existing container..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
    else
        info "Keeping existing container. Updating configuration only..."
        if [ -f "$CONFIG_FILE" ]; then
            docker cp "$CONFIG_FILE" "$CONTAINER_NAME:/var/lib/openwebrx/settings.json"
            info "Configuration updated. Restarting container..."
            docker restart "$CONTAINER_NAME"
            info "OpenWebRX configuration updated successfully!"
            exit 0
        else
            error "Configuration file not found: $CONFIG_FILE"
            exit 1
        fi
    fi
fi

# Create volume if it doesn't exist
if ! docker volume ls --format '{{.Name}}' | grep -q "^${VOLUME_NAME}$"; then
    info "Creating Docker volume: $VOLUME_NAME"
    docker volume create "$VOLUME_NAME"
fi

# Deploy container
info "Deploying OpenWebRX container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --device /dev/bus/usb:/dev/bus/usb \
  --privileged \
  -p 8073:8073 \
  -v "${VOLUME_NAME}:/var/lib/openwebrx" \
  --restart unless-stopped \
  "$IMAGE"

# Wait for container to start
info "Waiting for container to initialize..."
sleep 5

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    info "Container started successfully!"
else
    error "Container failed to start. Check logs: docker logs $CONTAINER_NAME"
    exit 1
fi

# Copy configuration
if [ -f "$CONFIG_FILE" ]; then
    info "Installing HackRF preset configuration..."
    docker cp "$CONFIG_FILE" "$CONTAINER_NAME:/var/lib/openwebrx/settings.json"

    info "Restarting container to load configuration..."
    docker restart "$CONTAINER_NAME"
    sleep 5

    # Verify HackRF detection
    info "Verifying HackRF detection..."
    if docker exec "$CONTAINER_NAME" hackrf_info >/dev/null 2>&1; then
        info "HackRF One detected successfully!"
    else
        warn "HackRF not detected. Ensure device is connected and has adequate power."
    fi

    info "OpenWebRX deployed successfully!"
    echo ""
    info "Access OpenWebRX at: http://localhost:8073"
    info "Default credentials: admin / admin"
    echo ""
    info "Available preset profiles:"
    echo "  - FM Broadcast (88-108 MHz)"
    echo "  - AM Radio (530-1710 kHz)"
    echo "  - Aviation Band (118-137 MHz)"
    echo "  - NOAA Weather Radio (162 MHz)"
    echo "  - Marine VHF (156-162 MHz)"
    echo "  - 2m Ham Band (144-148 MHz)"
    echo "  - 70cm Ham Band (420-450 MHz)"
    echo "  - Shortwave Bands (3-30 MHz)"
    echo "  - ISM 433 MHz (IoT/RC)"
    echo "  - PMR446 (Personal Mobile Radio)"
    echo "  - GMRS/FRS (462-467 MHz)"
    echo "  - Public Safety (150-174 MHz)"
    echo "  - Wideband Scan"
else
    error "Configuration file not found: $CONFIG_FILE"
    warn "Container deployed but configuration not installed."
    warn "You can manually configure OpenWebRX through the web interface."
fi
