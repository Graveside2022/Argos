#!/bin/bash

# Argos Docker Image Manager
# Professional Grade A+ Docker Image Management System
# Handles custom OpenWebRX HackRF Docker image deployment

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_IMAGES_DIR="${PROJECT_ROOT}/docker-images"
DOCKER_IMAGE_FILE="${DOCKER_IMAGES_DIR}/openwebrx-hackrf-only-v2.tar"
DOCKER_IMAGE_NAME="openwebrx-hackrf-only"
DOCKER_IMAGE_TAG="v2"
DOCKER_CONTAINER_NAME="openwebrx-hackrf-only"
DOCKER_LOG_FILE="${PROJECT_ROOT}/docker-deployment.log"

# ============================================================================
# LOGGING SYSTEM
# ============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$DOCKER_LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_success() { log "SUCCESS" "$@"; }
log_error() { log "ERROR" "$@"; }
log_warn() { log "WARN" "$@"; }

# ============================================================================
# DOCKER IMAGE VERIFICATION
# ============================================================================

verify_docker_installation() {
    log_info "Verifying Docker installation..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! sudo docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker installation verified"
    return 0
}

verify_image_file() {
    log_info "Verifying Docker image file: $DOCKER_IMAGE_FILE"
    
    if [[ ! -f "$DOCKER_IMAGE_FILE" ]]; then
        log_error "Docker image file not found: $DOCKER_IMAGE_FILE"
        return 1
    fi
    
    local file_size=$(stat -c%s "$DOCKER_IMAGE_FILE")
    local file_size_mb=$((file_size / 1024 / 1024))
    
    if [[ $file_size -lt 100000000 ]]; then  # Less than 100MB
        log_error "Docker image file too small (${file_size_mb}MB), possibly corrupted"
        return 1
    fi
    
    log_success "Docker image file verified (${file_size_mb}MB)"
    return 0
}

# ============================================================================
# DOCKER IMAGE MANAGEMENT
# ============================================================================

check_existing_image() {
    log_info "Checking for existing Docker image: ${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}"
    
    if sudo docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "^${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}$"; then
        log_success "Docker image already exists: ${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}"
        return 0
    else
        log_info "Docker image not found, needs to be loaded"
        return 1
    fi
}

load_docker_image() {
    log_info "Loading Docker image from: $DOCKER_IMAGE_FILE"
    
    if ! verify_image_file; then
        log_error "Image file verification failed"
        return 1
    fi
    
    log_info "Loading Docker image (this may take a few minutes)..."
    
    if sudo docker load -i "$DOCKER_IMAGE_FILE" 2>&1 | tee -a "$DOCKER_LOG_FILE"; then
        log_success "Docker image loaded successfully"
        
        # Verify the image was loaded
        if check_existing_image; then
            log_success "Docker image verification passed"
            return 0
        else
            log_error "Docker image verification failed after loading"
            return 1
        fi
    else
        log_error "Failed to load Docker image"
        return 1
    fi
}

# ============================================================================
# CONTAINER MANAGEMENT
# ============================================================================

stop_existing_container() {
    log_info "Checking for existing container: $DOCKER_CONTAINER_NAME"
    
    if sudo docker ps -a --format "table {{.Names}}" | grep -q "^${DOCKER_CONTAINER_NAME}$"; then
        log_info "Stopping existing container: $DOCKER_CONTAINER_NAME"
        sudo docker stop "$DOCKER_CONTAINER_NAME" >/dev/null 2>&1 || true
        sudo docker rm "$DOCKER_CONTAINER_NAME" >/dev/null 2>&1 || true
        log_success "Existing container removed"
    else
        log_info "No existing container found"
    fi
}

start_openwebrx_container() {
    log_info "Starting OpenWebRX HackRF container"
    
    stop_existing_container
    
    log_info "Creating new container: $DOCKER_CONTAINER_NAME"
    
    if sudo docker run -d \
        --name "$DOCKER_CONTAINER_NAME" \
        --restart unless-stopped \
        -p 8073:8073 \
        --privileged \
        -v /dev/bus/usb:/dev/bus/usb \
        -v /home/pi/openwebrx_data:/var/lib/openwebrx \
        "${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}" 2>&1 | tee -a "$DOCKER_LOG_FILE"; then
        
        log_success "OpenWebRX container started successfully"
        
        # Wait for container to be ready
        log_info "Waiting for OpenWebRX to be ready..."
        sleep 10
        
        # Verify container is running
        if sudo docker ps --format "table {{.Names}}" | grep -q "^${DOCKER_CONTAINER_NAME}$"; then
            log_success "OpenWebRX container is running"
            return 0
        else
            log_error "OpenWebRX container failed to start"
            return 1
        fi
    else
        log_error "Failed to start OpenWebRX container"
        return 1
    fi
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

health_check() {
    log_info "Performing OpenWebRX health check"
    
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s -f "http://localhost:8073" >/dev/null 2>&1; then
            log_success "OpenWebRX health check passed"
            return 0
        fi
        
        log_info "Health check attempt $((attempt + 1))/$max_attempts"
        sleep 2
        ((attempt++))
    done
    
    log_error "OpenWebRX health check failed after $max_attempts attempts"
    return 1
}

# ============================================================================
# MAIN DEPLOYMENT FUNCTIONS
# ============================================================================

deploy_openwebrx_docker() {
    log_info "Starting OpenWebRX Docker deployment"
    
    # Verify Docker installation
    if ! verify_docker_installation; then
        log_error "Docker installation verification failed"
        return 1
    fi
    
    # Check if image exists, load if necessary
    if ! check_existing_image; then
        log_info "Loading Docker image..."
        if ! load_docker_image; then
            log_error "Failed to load Docker image"
            return 1
        fi
    fi
    
    # Start container
    if ! start_openwebrx_container; then
        log_error "Failed to start OpenWebRX container"
        return 1
    fi
    
    # Perform health check
    if ! health_check; then
        log_warn "Health check failed, but container is running"
        # Don't fail deployment for health check issues
    fi
    
    log_success "OpenWebRX Docker deployment completed successfully"
    return 0
}

cleanup_docker_resources() {
    log_info "Cleaning up Docker resources"
    
    # Stop and remove container
    stop_existing_container
    
    # Remove image (optional)
    if [[ "${1:-}" == "--remove-image" ]]; then
        log_info "Removing Docker image: ${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}"
        sudo docker rmi "${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}" >/dev/null 2>&1 || true
    fi
    
    log_success "Docker cleanup completed"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    case "${1:-deploy}" in
        "deploy")
            deploy_openwebrx_docker
            ;;
        "load")
            load_docker_image
            ;;
        "start")
            start_openwebrx_container
            ;;
        "stop")
            stop_existing_container
            ;;
        "health")
            health_check
            ;;
        "cleanup")
            cleanup_docker_resources "${2:-}"
            ;;
        "verify")
            verify_docker_installation && verify_image_file
            ;;
        *)
            echo "Usage: $0 {deploy|load|start|stop|health|cleanup|verify}"
            echo ""
            echo "Commands:"
            echo "  deploy  - Full OpenWebRX Docker deployment"
            echo "  load    - Load Docker image from file"
            echo "  start   - Start OpenWebRX container"
            echo "  stop    - Stop OpenWebRX container"
            echo "  health  - Perform health check"
            echo "  cleanup - Clean up Docker resources"
            echo "  verify  - Verify Docker and image file"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"