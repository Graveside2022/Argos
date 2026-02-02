#!/bin/bash
#
# Argos Container Deployment Script
# Automatically deploys all Argos containers with proper configuration
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

success() {
    echo -e "${BLUE}[SUCCESS]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Deploy Argos main container
deploy_argos() {
    info "Deploying Argos main container..."

    if docker ps -a --format '{{.Names}}' | grep -q "^argos-dev$"; then
        warn "argos-dev container already exists. Skipping..."
        return 0
    fi

    # Check if image exists locally or needs to be built
    if ! docker images | grep -q "argos-dev"; then
        warn "argos-dev image not found. You need to build it first."
        warn "Run: docker build -t argos-dev ."
        return 1
    fi

    docker run -d \
      --name argos-dev \
      --network host \
      -v "$PROJECT_ROOT:/app" \
      -v /var/run/docker.sock:/var/run/docker.sock \
      --restart unless-stopped \
      argos-dev

    success "Argos main container deployed"
}

# Deploy HackRF backend container
deploy_hackrf_backend() {
    info "Deploying HackRF backend container..."

    if docker ps -a --format '{{.Names}}' | grep -q "^hackrf-backend-dev$"; then
        warn "hackrf-backend-dev container already exists. Skipping..."
        return 0
    fi

    # Check if image exists
    if ! docker images | grep -q "hackrf-backend"; then
        warn "hackrf-backend image not found. Building from hackrf_emitter directory..."
        if [ -d "$PROJECT_ROOT/hackrf_emitter" ]; then
            docker build -t hackrf-backend "$PROJECT_ROOT/hackrf_emitter"
        else
            error "hackrf_emitter directory not found"
            return 1
        fi
    fi

    docker run -d \
      --name hackrf-backend-dev \
      --device /dev/bus/usb:/dev/bus/usb \
      --privileged \
      -p 3002:3002 \
      -p 8092:8092 \
      --restart unless-stopped \
      hackrf-backend

    success "HackRF backend container deployed"
}

# Deploy OpenWebRX container
deploy_openwebrx() {
    info "Deploying OpenWebRX HackRF container..."

    if docker ps -a --format '{{.Names}}' | grep -q "^openwebrx-hackrf$"; then
        warn "openwebrx-hackrf container already exists."
        read -p "Update configuration only? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            update_openwebrx_config
            return 0
        else
            warn "Skipping OpenWebRX deployment..."
            return 0
        fi
    fi

    # Create volume if it doesn't exist
    if ! docker volume ls --format '{{.Name}}' | grep -q "^openwebrx-hackrf-settings$"; then
        info "Creating Docker volume: openwebrx-hackrf-settings"
        docker volume create openwebrx-hackrf-settings
    fi

    # Deploy container
    docker run -d \
      --name openwebrx-hackrf \
      --device /dev/bus/usb:/dev/bus/usb \
      --privileged \
      -p 8073:8073 \
      -v openwebrx-hackrf-settings:/var/lib/openwebrx \
      --restart unless-stopped \
      jketterl/openwebrx-hackrf:stable

    success "OpenWebRX container deployed"

    # Wait for container to initialize
    info "Waiting for OpenWebRX to initialize..."
    sleep 5

    # Install configuration
    update_openwebrx_config
}

# Update OpenWebRX configuration
update_openwebrx_config() {
    local config_file="$CONFIG_DIR/openwebrx/settings.json"

    if [ ! -f "$config_file" ]; then
        error "OpenWebRX configuration file not found: $config_file"
        return 1
    fi

    info "Installing OpenWebRX preset configuration..."
    docker cp "$config_file" openwebrx-hackrf:/var/lib/openwebrx/settings.json

    info "Restarting OpenWebRX to load configuration..."
    docker restart openwebrx-hackrf
    sleep 5

    # Verify HackRF detection
    info "Verifying HackRF detection..."
    if docker exec openwebrx-hackrf hackrf_info >/dev/null 2>&1; then
        success "HackRF One detected successfully!"
    else
        warn "HackRF not detected. Ensure device is connected with adequate power."
    fi

    success "OpenWebRX configuration installed with 13 preset profiles"
}

# Verify deployment
verify_deployment() {
    info "Verifying deployment..."
    echo ""

    local all_running=true

    for container in argos-dev hackrf-backend-dev openwebrx-hackrf; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            success "✓ $container is running"
        else
            error "✗ $container is not running"
            all_running=false
        fi
    done

    echo ""

    if [ "$all_running" = true ]; then
        success "All containers deployed successfully!"
        echo ""
        info "Access your services:"
        echo "  🌐 Argos Dashboard: http://localhost:5173"
        echo "  📡 OpenWebRX: http://localhost:8073"
        echo "  🔧 HackRF API: http://localhost:8092"
        echo ""
        info "OpenWebRX Preset Profiles:"
        echo "  📻 FM Broadcast, AM Radio"
        echo "  ✈️  Aviation, Weather, Marine VHF"
        echo "  📡 Ham Radio (2m, 70cm), Shortwave"
        echo "  🚨 Public Safety, ISM 433, PMR446, GMRS/FRS"
        echo ""
    else
        error "Some containers failed to deploy. Check logs with: docker logs <container-name>"
        return 1
    fi
}

# Main deployment
main() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║   Argos Container Deployment System       ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""

    check_docker

    info "Deploying Argos containers..."
    echo ""

    # Deploy containers
    deploy_argos || warn "Argos main container deployment skipped or failed"
    echo ""

    deploy_hackrf_backend || warn "HackRF backend deployment skipped or failed"
    echo ""

    deploy_openwebrx || error "OpenWebRX deployment failed"
    echo ""

    # Verify
    verify_deployment
}

# Parse arguments
case "${1:-}" in
    openwebrx-only)
        info "Deploying OpenWebRX only..."
        check_docker
        deploy_openwebrx
        ;;
    update-config)
        info "Updating OpenWebRX configuration only..."
        check_docker
        update_openwebrx_config
        ;;
    verify)
        check_docker
        verify_deployment
        ;;
    *)
        main
        ;;
esac
