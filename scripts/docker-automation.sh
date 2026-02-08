#!/bin/bash

#######################################################################################
# Argos Docker Automation Script
# Handles HackRF container loading and OpenWebRX management
#######################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/$(whoami)/project/Argos"
DOCKER_IMAGES_DIR="${PROJECT_DIR}/docker-images"
LOG_FILE="/home/$(whoami)/project/logs/docker-automation.log"

# Docker container configurations
HACKRF_CONTAINER="hackrf-openwebrx"
HACKRF_IMAGE="argos/hackrf:latest"
OPENWEBRX_PORT="8073"
HACKRF_SWEEP_PORT="8092"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please run the main installer first."
    fi
    
    if ! docker info &> /dev/null; then
        log "Starting Docker service..."
        sudo systemctl start docker || error "Failed to start Docker"
    fi
    
    log "Docker is ready"
}

load_hackrf_image() {
    log "Loading HackRF Docker image..."
    
    # Check if image already exists
    if docker image inspect "$HACKRF_IMAGE" &> /dev/null; then
        log "HackRF image already loaded"
        return 0
    fi
    
    # Look for image file
    local image_file
    for image_file in "${DOCKER_IMAGES_DIR}"/openwebrx-hackrf*.tar "${DOCKER_IMAGES_DIR}"/hackrf*.tar; do
        if [[ -f "$image_file" ]]; then
            log "Loading image from $image_file..."
            docker load < "$image_file" || error "Failed to load Docker image"
            
            # Tag the loaded image
            local loaded_image
            loaded_image=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "(openwebrx|hackrf)" | head -1)
            if [[ -n "$loaded_image" ]]; then
                docker tag "$loaded_image" "$HACKRF_IMAGE"
                log "Tagged image as $HACKRF_IMAGE"
            fi
            
            return 0
        fi
    done
    
    # Build from Dockerfile if no image file found
    if [[ -f "${PROJECT_DIR}/docker/Dockerfile" ]]; then
        log "Building HackRF image from Dockerfile..."
        cd "${PROJECT_DIR}/docker"
        docker build -t "$HACKRF_IMAGE" . || error "Failed to build Docker image"
        cd "$PROJECT_DIR"
    else
        warn "No HackRF Docker image or Dockerfile found"
        return 1
    fi
}

start_hackrf_container() {
    log "Starting HackRF OpenWebRX container..."
    
    # Stop existing container if running
    if docker ps -q -f name="$HACKRF_CONTAINER" | grep -q .; then
        log "Stopping existing container..."
        docker stop "$HACKRF_CONTAINER" &> /dev/null || true
    fi
    
    # Remove existing container
    if docker ps -aq -f name="$HACKRF_CONTAINER" | grep -q .; then
        docker rm "$HACKRF_CONTAINER" &> /dev/null || true
    fi
    
    # Start new container
    docker run -d \
        --name "$HACKRF_CONTAINER" \
        --privileged \
        --restart unless-stopped \
        -p "${OPENWEBRX_PORT}:8073" \
        -p "${HACKRF_SWEEP_PORT}:8092" \
        -v /dev/bus/usb:/dev/bus/usb \
        "$HACKRF_IMAGE" || error "Failed to start HackRF container"
    
    log "HackRF container started successfully"
}

verify_containers() {
    log "Verifying container status..."
    
    # Wait for container to be ready
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if docker ps | grep -q "$HACKRF_CONTAINER"; then
            log "Container is running"
            break
        fi
        
        ((retries++))
        log "Waiting for container to start... ($retries/$max_retries)"
        sleep 2
    done
    
    if [ $retries -eq $max_retries ]; then
        error "Container failed to start within timeout"
    fi
    
    # Test OpenWebRX accessibility
    if curl -s "http://localhost:${OPENWEBRX_PORT}" > /dev/null; then
        log "OpenWebRX is accessible on port ${OPENWEBRX_PORT}"
    else
        warn "OpenWebRX may not be ready yet. Check logs with: docker logs $HACKRF_CONTAINER"
    fi
}

setup_container_monitoring() {
    log "Setting up container monitoring..."
    
    # Create container health check script
    mkdir -p "${PROJECT_DIR}/scripts/management"
    
    cat > "${PROJECT_DIR}/scripts/management/container-monitor.sh" << 'EOF'
#!/bin/bash

# Monitor HackRF container and restart if needed
CONTAINER_NAME="hackrf-openwebrx"
LOG_FILE="/home/$(whoami)/project/logs/container-monitor.log"

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log_message "ALERT: $CONTAINER_NAME not running, attempting restart"
    docker start "$CONTAINER_NAME" 2>&1 >> "$LOG_FILE"
    
    if docker ps | grep -q "$CONTAINER_NAME"; then
        log_message "SUCCESS: $CONTAINER_NAME restarted"
    else
        log_message "ERROR: Failed to restart $CONTAINER_NAME"
    fi
else
    log_message "OK: $CONTAINER_NAME is running"
fi
EOF
    
    chmod +x "${PROJECT_DIR}/scripts/management/container-monitor.sh"
    
    # Add to systemd timer
    sudo tee /etc/systemd/system/argos-container-monitor.service > /dev/null << EOF
[Unit]
Description=Argos Container Monitor
After=docker.service

[Service]
Type=oneshot
ExecStart=${PROJECT_DIR}/scripts/management/container-monitor.sh
User=$(whoami)
EOF

    sudo tee /etc/systemd/system/argos-container-monitor.timer > /dev/null << EOF
[Unit]
Description=Argos Container Monitor Timer
Requires=argos-container-monitor.service

[Timer]
OnCalendar=*:0/3
Persistent=true

[Install]
WantedBy=timers.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable --now argos-container-monitor.timer
    
    log "Container monitoring enabled"
}

create_docker_compose_automation() {
    log "Creating Docker Compose automation..."
    
    # Add HackRF service to docker-compose.yml
    cat >> "${PROJECT_DIR}/docker-compose.yml" << 'EOF'

  hackrf-openwebrx:
    image: argos/hackrf:latest
    container_name: hackrf-openwebrx
    ports:
      - "8073:8073"
      - "8092:8092"
    privileged: true
    volumes:
      - /dev/bus/usb:/dev/bus/usb
    restart: unless-stopped
    networks:
      - argos-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8073"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
EOF

    log "Docker Compose configuration updated"
}

print_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Argos Docker Automation Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}Container Services:${NC}"
    echo -e "  • HackRF OpenWebRX:   ${YELLOW}http://localhost:${OPENWEBRX_PORT}${NC} (admin/<from OPENWEBRX_PASSWORD env var>)"
    echo -e "  • HackRF Sweep API:   ${YELLOW}http://localhost:${HACKRF_SWEEP_PORT}${NC}"
    echo ""
    echo -e "${BLUE}Container Management:${NC}"
    echo -e "  • Status Check:       ${YELLOW}docker ps${NC}"
    echo -e "  • View Logs:          ${YELLOW}docker logs $HACKRF_CONTAINER${NC}"
    echo -e "  • Restart Container:  ${YELLOW}docker restart $HACKRF_CONTAINER${NC}"
    echo -e "  • Stop All:           ${YELLOW}docker-compose down${NC}"
    echo -e "  • Start All:          ${YELLOW}docker-compose up -d${NC}"
    echo ""
    echo -e "${BLUE}Monitoring:${NC}"
    echo -e "  • Container Monitor:  ${YELLOW}Every 3 minutes${NC}"
    echo -e "  • Monitor Logs:       ${YELLOW}tail -f ${LOG_FILE}${NC}"
    echo ""
    echo -e "${GREEN}HackRF and OpenWebRX containers are ready for use!${NC}"
    echo ""
}

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Docker Automation Setup${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    # Create log directory
    mkdir -p "$(dirname "${LOG_FILE}")"
    
    check_docker
    load_hackrf_image
    start_hackrf_container
    verify_containers
    setup_container_monitoring
    create_docker_compose_automation
    
    print_summary
    log "Docker automation setup completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    "start")
        start_hackrf_container
        ;;
    "stop")
        docker stop "$HACKRF_CONTAINER" 2>/dev/null || true
        ;;
    "restart")
        docker restart "$HACKRF_CONTAINER" 2>/dev/null || true
        ;;
    "logs")
        docker logs -f "$HACKRF_CONTAINER"
        ;;
    *)
        main "$@"
        ;;
esac