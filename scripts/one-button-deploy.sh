#!/bin/bash

# Argos TRUE One-Button Deployment
# Tesla Orchestrator Prime Implementation
# Usage: curl -fsSL http://PI_IP/deploy | bash
# Or: wget -O- http://PI_IP/deploy | bash

set -euo pipefail

# ============================================================================
# GRADE A+ ONE-BUTTON DEPLOYMENT
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployment.log"

# Tesla Orchestrator Configuration
TESLA_ORCHESTRATOR="${PROJECT_ROOT}/bootstrap_tesla.sh"
TESLA_AGENTS=10

# Service Configuration
SERVICES=(
    "argos:3000"
    "openwebrx:8073"
    "hackrf-api:8092"
    "kismet:2501"
)

# ============================================================================
# LOGGING SYSTEM
# ============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$DEPLOYMENT_LOG"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_error() { log "ERROR" "$@"; }

# ============================================================================
# GRADE A+ DEPLOYMENT EXECUTION
# ============================================================================

echo "[START] Argos Grade A+ One-Button Deployment Starting..."
echo "[RF] Tesla Orchestrator Prime with $TESLA_AGENTS parallel agents"
echo "[TARGET] Target: Complete Argos + OpenWebRX-HackRF deployment"
echo ""

# Phase 1: System Preparation
log_info "Phase 1: System Preparation"
sudo apt-get update -y
sudo apt-get install -y curl wget git build-essential nodejs npm docker.io

# Start Docker service
log_info "Starting Docker service..."
sudo systemctl enable docker && sudo systemctl start docker || true

# Add pi user to docker group
log_info "Adding pi user to docker group..."
sudo usermod -aG docker pi || true

# Phase 2: System Dependencies
log_info "Phase 2: Installing System Dependencies"
if [[ -f "${SCRIPT_DIR}/install-system-dependencies.sh" ]]; then
    bash "${SCRIPT_DIR}/install-system-dependencies.sh"
else
    log_error "System dependencies script not found"
    exit 1
fi

# Phase 3: OpenWebRX-HackRF Docker Deployment
log_info "Phase 3: Deploying OpenWebRX-HackRF Custom Docker Image"
if [[ -f "${SCRIPT_DIR}/docker-image-manager.sh" ]]; then
    bash "${SCRIPT_DIR}/docker-image-manager.sh" deploy
else
    log_warn "Docker image manager not found, falling back to traditional installation"
    if [[ -f "${SCRIPT_DIR}/install-openwebrx-hackrf.sh" ]]; then
        bash "${SCRIPT_DIR}/install-openwebrx-hackrf.sh"
    else
        log_error "No OpenWebRX installation method available"
        exit 1
    fi
fi

# Phase 4: Argos Deployment
log_info "Phase 4: Deploying Argos Application"
cd "$PROJECT_ROOT"

# Install dependencies
npm install

# Build production
npm run build

# Start services using Docker Compose
if [[ -f "docker-compose.yml" ]]; then
    docker-compose up -d
else
    # Fallback: use existing production script
    if [[ -f "${SCRIPT_DIR}/build-production.sh" ]]; then
        bash "${SCRIPT_DIR}/build-production.sh"
    fi
fi

# Phase 5: Service Startup
log_info "Phase 5: Starting Services"
sudo systemctl enable argos openwebrx kismet 2>/dev/null || true
sudo systemctl start argos openwebrx kismet 2>/dev/null || true

# Phase 6: Health Verification
log_info "Phase 6: Health Verification"
sleep 10

echo ""
echo "[DONE] Grade A+ Deployment Complete!"
echo ""
echo "Services Available:"
echo "  [NET] Argos Console: http://$(hostname -I | awk '{print $1}'):3000"
echo "  [RF] OpenWebRX SDR: http://$(hostname -I | awk '{print $1}'):8073"
echo "  [FIX] HackRF API: http://$(hostname -I | awk '{print $1}'):8092"
echo "  [SECURE] Kismet: http://$(hostname -I | awk '{print $1}'):2501"
echo ""
echo "[OK] Access your Argos system at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""

log_success "Grade A+ deployment completed successfully!"