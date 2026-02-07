#!/bin/bash

# Dev Server Keep-Alive Script
# Monitors and maintains the Vite development server on http://100.68.185.86:5173
# Handles Tailscale connectivity issues and zombie process cleanup

set -euo pipefail

# Configuration
PROJECT_DIR="/home/pi/projects/Argos"
LOG_FILE="$PROJECT_DIR/logs/dev-server-keepalive.log"
PID_FILE="$PROJECT_DIR/logs/dev-server.pid"
VITE_PORT=5173
TAILSCALE_IP="100.68.185.86"
LAN_IP="192.168.0.172"
CHECK_INTERVAL=30  # seconds
MAX_RETRIES=3
RESTART_DELAY=5

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/logs"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if Tailscale is connected
check_tailscale() {
    if tailscale status --json 2>/dev/null | jq -r '.BackendState' | grep -q "Running"; then
        return 0
    else
        return 1
    fi
}

# Clean up zombie Vite processes
cleanup_zombies() {
    log "Cleaning up zombie Vite processes..."
    
    # Find and kill any stale Vite processes
    local zombie_pids=$(pgrep -f "vite.*dev" || true)
    if [[ -n "$zombie_pids" ]]; then
        log "Found zombie Vite processes: $zombie_pids"
        echo "$zombie_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        # Force kill if still running
        echo "$zombie_pids" | xargs -r kill -KILL 2>/dev/null || true
        log "Zombie processes cleaned up"
    fi
    
    # Clean up stale PID file
    if [[ -f "$PID_FILE" ]]; then
        local old_pid=$(cat "$PID_FILE")
        if ! kill -0 "$old_pid" 2>/dev/null; then
            rm -f "$PID_FILE"
            log "Removed stale PID file"
        fi
    fi
}

# Check if server is responding
check_server_health() {
    local endpoint="$1"
    
    # Try HTTP health check
    if curl -s --connect-timeout 5 --max-time 10 "http://$endpoint:$VITE_PORT" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Start the development server
start_dev_server() {
    log "Starting development server..."
    
    cd "$PROJECT_DIR"
    
    # Clean up any existing processes first
    cleanup_zombies
    
    # Export environment variables
    export NODE_OPTIONS='--max-old-space-size=1024'
    export VITE_PORT=5173
    
    # Start the server in background with proper error handling
    nohup bash -c "cd '$PROJECT_DIR' && ./scripts/vite-manager.sh" > "$PROJECT_DIR/logs/vite-output.log" 2>&1 &
    local server_pid=$!
    
    # Save PID
    echo "$server_pid" > "$PID_FILE"
    log "Development server started with PID: $server_pid"
    
    # Wait for server to start with longer timeout
    local retries=0
    while [[ $retries -lt 20 ]]; do
        # Check if the process is still running
        if ! kill -0 "$server_pid" 2>/dev/null; then
            log "ERROR: Server process died during startup"
            rm -f "$PID_FILE"
            return 1
        fi
        
        if check_server_health "localhost"; then
            log "Development server is responding on localhost"
            return 0
        fi
        sleep 3
        ((retries++))
    done
    
    log "WARNING: Development server may not have started properly after 60 seconds"
    
    # Check if process is still alive
    if kill -0 "$server_pid" 2>/dev/null; then
        log "Process is still running, assuming it will start soon"
        return 0
    else
        log "ERROR: Server process is not running"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Restart Tailscale if needed
restart_tailscale() {
    log "Restarting Tailscale..."
    
    sudo systemctl restart tailscaled
    sleep 5
    
    # Wait for Tailscale to connect
    local retries=0
    while [[ $retries -lt 12 ]]; do  # 60 seconds max
        if check_tailscale; then
            log "Tailscale reconnected successfully"
            return 0
        fi
        sleep 5
        ((retries++))
    done
    
    log "ERROR: Failed to restart Tailscale"
    return 1
}

# Main monitoring loop
monitor_server() {
    log "Starting development server monitoring..."
    log "Monitoring endpoints: localhost:$VITE_PORT, $LAN_IP:$VITE_PORT, $TAILSCALE_IP:$VITE_PORT"
    
    local consecutive_failures=0
    
    while true; do
        local localhost_ok=false
        local lan_ok=false
        local tailscale_ok=false
        
        # Check localhost
        if check_server_health "localhost"; then
            localhost_ok=true
        fi
        
        # Check LAN
        if check_server_health "$LAN_IP"; then
            lan_ok=true
        fi
        
        # Check Tailscale (only if Tailscale is connected)
        if check_tailscale && check_server_health "$TAILSCALE_IP"; then
            tailscale_ok=true
        elif check_tailscale; then
            # Tailscale is connected but server not responding
            tailscale_ok=false
        else
            # Tailscale is not connected
            log "Tailscale is not connected"
        fi
        
        # Determine if intervention is needed
        if [[ "$localhost_ok" == true ]]; then
            if [[ "$consecutive_failures" -gt 0 ]]; then
                log "Server recovered after $consecutive_failures failures"
                consecutive_failures=0
            fi
            
            # Log status every 5 minutes (10 checks * 30s = 5min)
            if (( $(date +%s) % 300 < 30 )); then
                log "Status: localhost:[PASS] LAN:$([ "$lan_ok" == true ] && echo "[OK]" || echo "[FAIL]") Tailscale:$([ "$tailscale_ok" == true ] && echo "[OK]" || echo "[FAIL]")"
            fi
        else
            ((consecutive_failures++))
            log "Server not responding on localhost (failure #$consecutive_failures)"
            
            if [[ $consecutive_failures -ge $MAX_RETRIES ]]; then
                log "Maximum failures reached. Restarting server..."
                
                # Clean up and restart
                cleanup_zombies
                sleep "$RESTART_DELAY"
                
                if start_dev_server; then
                    consecutive_failures=0
                    log "Server restart successful"
                else
                    log "ERROR: Failed to restart server"
                fi
            fi
        fi
        
        # Handle Tailscale issues
        if [[ "$localhost_ok" == true && "$tailscale_ok" == false ]] && check_tailscale; then
            log "Server running but not accessible via Tailscale"
        elif [[ "$localhost_ok" == true ]] && ! check_tailscale; then
            log "Attempting to restart Tailscale..."
            restart_tailscale
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Signal handlers
cleanup_and_exit() {
    log "Received termination signal. Cleaning up..."
    exit 0
}

trap cleanup_and_exit SIGTERM SIGINT

# Main execution
main() {
    log "=== Dev Server Keep-Alive Started ==="
    log "Project: $PROJECT_DIR"
    log "Log file: $LOG_FILE"
    log "Check interval: ${CHECK_INTERVAL}s"
    
    # Initial cleanup
    cleanup_zombies
    
    # Check if server is already running
    if ! check_server_health "localhost"; then
        log "Server not running. Starting initial server..."
        start_dev_server
    else
        log "Server already running"
    fi
    
    # Start monitoring
    monitor_server
}

# Run main function
main "$@"