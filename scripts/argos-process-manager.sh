#!/bin/bash
#
# Argos Process Manager
# Maintains single instance of Argos and prevents memory leaks
#
# This script:
# - Ensures only one instance of Argos is running
# - Kills duplicate Vite processes
# - Monitors memory usage
# - Restarts services if needed

set -e

# Configuration
ARGOS_PORT=8006
API_PORT=8005
MAX_MEMORY_PERCENT=80
LOG_FILE="/var/log/argos-process-manager.log"
PID_FILE="/var/run/argos.pid"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to get memory usage percentage
get_memory_usage() {
    free | grep Mem | awk '{print int($3/$2 * 100)}'
}

# Function to kill duplicate processes
kill_duplicates() {
    local process_name=$1
    local keep_pid=$2
    
    # Find all PIDs for the process
    local pids=$(pgrep -f "$process_name" | grep -v "^$keep_pid$" || true)
    
    if [ -n "$pids" ]; then
        log "Found duplicate $process_name processes: $pids"
        for pid in $pids; do
            log "Killing duplicate process $pid"
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
}

# Function to check if Argos is healthy
check_argos_health() {
    # Check if main process exists
    if [ -f "$PID_FILE" ]; then
        local main_pid=$(cat "$PID_FILE")
        if ! kill -0 "$main_pid" 2>/dev/null; then
            log "Main Argos process (PID: $main_pid) is dead"
            return 1
        fi
    else
        log "PID file not found"
        return 1
    fi
    
    # Check if port is responding
    if ! curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ARGOS_PORT/health" | grep -q "200"; then
        log "Argos health check failed"
        return 1
    fi
    
    return 0
}

# Function to clean up zombie processes
cleanup_zombies() {
    # Find and kill zombie node processes
    local zombies=$(ps aux | grep -E 'node.*defunct' | awk '{print $2}' || true)
    
    if [ -n "$zombies" ]; then
        log "Found zombie processes: $zombies"
        for pid in $zombies; do
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
}

# Function to manage Vite processes
manage_vite_processes() {
    # Count Vite dev server processes
    local vite_count=$(pgrep -f "vite.*dev" | wc -l)
    
    if [ "$vite_count" -gt 1 ]; then
        log "Found $vite_count Vite processes, cleaning up..."
        
        # Keep the newest Vite process
        local newest_vite=$(pgrep -f "vite.*dev" -n)
        kill_duplicates "vite.*dev" "$newest_vite"
    fi
    
    # Check for orphaned Vite processes
    local orphaned_vite=$(pgrep -f "vite" -a | grep -v "dev\|build" | awk '{print $1}' || true)
    if [ -n "$orphaned_vite" ]; then
        log "Killing orphaned Vite processes: $orphaned_vite"
        echo "$orphaned_vite" | xargs -r kill -9 2>/dev/null || true
    fi
}

# Function to manage Node processes
manage_node_processes() {
    # Find all Node processes related to Argos
    local argos_nodes=$(pgrep -f "node.*argos" | wc -l)
    
    if [ "$argos_nodes" -gt 2 ]; then
        log "Too many Argos Node processes ($argos_nodes), cleaning up..."
        
        # Keep only the main process and API
        if [ -f "$PID_FILE" ]; then
            local main_pid=$(cat "$PID_FILE")
            local api_pid=$(pgrep -f "node.*api" -n || echo "")
            
            # Kill all except main and API
            pgrep -f "node.*argos" | while read pid; do
                if [ "$pid" != "$main_pid" ] && [ "$pid" != "$api_pid" ]; then
                    log "Killing excess Node process: $pid"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            done
        fi
    fi
}

# Function to check and manage memory
manage_memory() {
    local mem_usage=$(get_memory_usage)
    
    if [ "$mem_usage" -gt "$MAX_MEMORY_PERCENT" ]; then
        log "High memory usage detected: ${mem_usage}%"
        
        # Kill non-essential processes first
        pkill -f "npm.*install" 2>/dev/null || true
        pkill -f "npm.*audit" 2>/dev/null || true
        
        # Force garbage collection by restarting if still high
        sleep 5
        mem_usage=$(get_memory_usage)
        
        if [ "$mem_usage" -gt "$MAX_MEMORY_PERCENT" ]; then
            log "Memory still high after cleanup: ${mem_usage}%. Restarting Argos..."
            systemctl restart argos-main
        fi
    fi
}

# Function to ensure single instance
ensure_single_instance() {
    # Check for lock file
    local LOCK_FILE="/var/lock/argos-process-manager.lock"
    
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE")
        if kill -0 "$lock_pid" 2>/dev/null; then
            log "Process manager already running (PID: $lock_pid)"
            exit 0
        else
            log "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # Create lock file
    echo $$ > "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT
}

# Function to clean up old logs
cleanup_logs() {
    # Keep only last 7 days of logs
    find /var/log -name "argos-*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Truncate current log if too large (>100MB)
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt 104857600 ]; then
        log "Truncating large log file"
        tail -n 10000 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
}

# Main monitoring loop
main() {
    ensure_single_instance
    
    log "Starting Argos process management"
    
    # Initial cleanup
    cleanup_zombies
    manage_vite_processes
    manage_node_processes
    cleanup_logs
    
    # Check Argos health
    if ! check_argos_health; then
        log "Argos is not healthy, restarting..."
        systemctl restart argos-main
        sleep 10
    fi
    
    # Monitor memory
    manage_memory
    
    # Report status
    local mem_usage=$(get_memory_usage)
    local node_count=$(pgrep -c node || echo 0)
    local vite_count=$(pgrep -c -f vite || echo 0)
    
    log "Status - Memory: ${mem_usage}%, Node processes: $node_count, Vite processes: $vite_count"
    
    # Write status file for monitoring
    cat > /var/run/argos-status.json <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "memory_percent": $mem_usage,
    "node_processes": $node_count,
    "vite_processes": $vite_count,
    "health": "$(check_argos_health && echo "healthy" || echo "unhealthy")"
}
EOF
}

# Run main function
main "$@"