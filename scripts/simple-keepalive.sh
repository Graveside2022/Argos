#!/bin/bash

# Simple Dev Server Keep-Alive Script
# Keeps npm run dev running and restarts it if it fails

set -euo pipefail

PROJECT_DIR="/home/pi/projects/Argos"
LOG_FILE="$PROJECT_DIR/logs/simple-keepalive.log"
CHECK_INTERVAL=30  # seconds
TAILSCALE_IP="100.68.185.86"
PORT=5173

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/logs"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if server is responding
check_server() {
    curl -s --connect-timeout 3 --max-time 5 "http://localhost:$PORT" >/dev/null 2>&1
}

# Start the development server
start_server() {
    log "Starting development server..."
    cd "$PROJECT_DIR"
    
    # Kill any existing npm/vite processes more thoroughly
    pkill -9 -f "npm.*dev" || true
    pkill -9 -f "vite.*dev" || true
    pkill -9 -f "node.*vite" || true
    pkill -9 -f "vitest" || true
    sleep 3
    
    # Start direct vite script in background
    nohup ./scripts/direct-vite-start.sh > "$LOG_FILE.output" 2>&1 &
    local pid=$!
    log "Started direct vite script with PID: $pid"
    
    # Wait for server to be ready (up to 3 minutes for Vite build)
    local retries=0
    while [[ $retries -lt 60 ]]; do
        if check_server; then
            log "Server is responding at http://localhost:$PORT"
            log "Also available at http://$TAILSCALE_IP:$PORT"
            return 0
        fi
        sleep 3
        ((retries++))
    done
    
    log "ERROR: Server failed to start within 3 minutes"
    # Don't exit completely, just return failure but continue monitoring
    return 1
}

# Main monitoring loop
main() {
    log "=== Simple Keep-Alive Started ==="
    log "Monitoring: http://localhost:$PORT"
    log "Tailscale access: http://$TAILSCALE_IP:$PORT"
    
    while true; do
        if check_server; then
            # Server is healthy, just log status every 5 minutes
            if (( $(date +%s) % 300 < 30 )); then
                log "Status: Server is healthy and responding"
            fi
        else
            log "Server not responding! Attempting restart..."
            start_server
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Signal handlers
cleanup_and_exit() {
    log "Received termination signal. Stopping..."
    pkill -9 -f "npm.*dev" || true
    pkill -9 -f "vite.*dev" || true
    pkill -9 -f "node.*vite" || true
    exit 0
}

trap cleanup_and_exit SIGTERM SIGINT

# Start the server initially
if ! check_server; then
    if ! start_server; then
        log "Initial server start failed, but continuing to monitor..."
    fi
fi

# Start monitoring - this must run indefinitely
main "$@"