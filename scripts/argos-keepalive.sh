#!/bin/bash

#######################################################################################
# Argos Process Keepalive and Management Script
# Monitors Node.js processes, prevents duplicates, manages memory
# Designed for Raspberry Pi and resource-constrained environments
#######################################################################################

set -euo pipefail

# Configuration
SCRIPT_NAME="Argos Keepalive"
LOG_FILE="/var/log/argos-keepalive.log"
PID_FILE="/var/run/argos-keepalive.pid"
ARGOS_DIR="/home/$(whoami)/projects/Argos"
ARGOS_SERVICE="argos.service"
MEMORY_THRESHOLD_MB=1500  # Kill processes using more than 1.5GB
MAX_VITE_PROCESSES=1      # Maximum allowed vite processes
MAX_NODE_PROCESSES=3      # Maximum allowed node processes
CHECK_INTERVAL=30         # Check every 30 seconds

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#######################################################################################
# Utility Functions
#######################################################################################

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

debug() {
    if [[ "${DEBUG:-0}" == "1" ]]; then
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        echo -e "${BLUE}[$timestamp] DEBUG:${NC} $1" | tee -a "$LOG_FILE"
    fi
}

# Check if running as daemon
is_daemon() {
    [[ "${1:-}" == "--daemon" ]]
}

# Create PID file
create_pid_file() {
    echo $$ > "$PID_FILE"
    log "Created PID file: $PID_FILE"
}

# Remove PID file
cleanup_pid_file() {
    if [[ -f "$PID_FILE" ]]; then
        rm -f "$PID_FILE"
        log "Removed PID file: $PID_FILE"
    fi
}

# Check if already running
check_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            error "Keepalive already running with PID $pid"
            exit 1
        else
            warn "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi
}

#######################################################################################
# Process Management Functions
#######################################################################################

get_process_memory() {
    local pid=$1
    # Get memory usage in MB
    ps -o pid,rss --no-headers -p "$pid" 2>/dev/null | awk '{print $2/1024}' || echo "0"
}

kill_process_safely() {
    local pid=$1
    local name=$2
    local signal=${3:-TERM}
    
    debug "Attempting to kill process $pid ($name) with signal $signal"
    
    if kill -0 "$pid" 2>/dev/null; then
        log "Killing process $pid ($name) with signal $signal"
        kill -"$signal" "$pid"
        
        # Wait for graceful termination
        local count=0
        while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
            sleep 1
            ((count++))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            warn "Process $pid ($name) didn't terminate gracefully, force killing..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        log "Process $pid ($name) terminated"
        return 0
    else
        debug "Process $pid ($name) not running"
        return 1
    fi
}

#######################################################################################
# Argos Specific Management
#######################################################################################

check_argos_service() {
    if systemctl is-active --quiet "$ARGOS_SERVICE"; then
        debug "Argos service is active"
        return 0
    else
        warn "Argos service is not active"
        return 1
    fi
}

restart_argos_service() {
    log "Restarting Argos service..."
    systemctl restart "$ARGOS_SERVICE" || {
        error "Failed to restart Argos service"
        return 1
    }
    sleep 5
    
    if check_argos_service; then
        log "Argos service restarted successfully"
        return 0
    else
        error "Argos service failed to start after restart"
        return 1
    fi
}

prune_duplicate_vite_processes() {
    debug "Checking for duplicate vite processes..."
    
    # Get all vite processes
    local vite_pids=($(pgrep -f "vite.*dev" || true))
    local vite_count=${#vite_pids[@]}
    
    if [[ $vite_count -gt $MAX_VITE_PROCESSES ]]; then
        warn "Found $vite_count vite processes, maximum allowed: $MAX_VITE_PROCESSES"
        
        # Sort by CPU time (oldest first) and kill extras
        local sorted_pids=($(printf '%s\n' "${vite_pids[@]}" | xargs -I {} ps -o pid,etime --no-headers -p {} | sort -k2 | awk '{print $1}'))
        
        # Keep the newest process, kill the rest
        for ((i=0; i<$((vite_count-MAX_VITE_PROCESSES)); i++)); do
            local pid=${sorted_pids[i]}
            warn "Killing duplicate vite process: $pid"
            kill_process_safely "$pid" "vite-dev"
        done
    else
        debug "Vite process count OK: $vite_count/$MAX_VITE_PROCESSES"
    fi
}

prune_excessive_node_processes() {
    debug "Checking for excessive node processes..."
    
    # Get all node processes (excluding this script)
    local node_pids=($(pgrep -f "node" | grep -v $$ || true))
    local node_count=${#node_pids[@]}
    
    if [[ $node_count -gt $MAX_NODE_PROCESSES ]]; then
        warn "Found $node_count node processes, maximum allowed: $MAX_NODE_PROCESSES"
        
        # Identify and kill processes by memory usage (highest first)
        local processes=()
        for pid in "${node_pids[@]}"; do
            local memory=$(get_process_memory "$pid")
            local cmdline=$(ps -o cmd --no-headers -p "$pid" 2>/dev/null | head -c 50 || echo "unknown")
            processes+=("$memory:$pid:$cmdline")
        done
        
        # Sort by memory usage (descending)
        IFS=$'\n' sorted_processes=($(sort -rn <<<"${processes[*]}"))
        unset IFS
        
        # Kill processes above threshold
        local killed=0
        for process in "${sorted_processes[@]}"; do
            if [[ $killed -ge $((node_count-MAX_NODE_PROCESSES)) ]]; then
                break
            fi
            
            IFS=':' read -r memory pid cmdline <<< "$process"
            
            # Don't kill essential processes
            if [[ "$cmdline" =~ systemd|kernel|init ]]; then
                continue
            fi
            
            warn "Killing excessive node process: $pid (${memory}MB) - $cmdline"
            kill_process_safely "$pid" "node-process"
            ((killed++))
        done
    else
        debug "Node process count OK: $node_count/$MAX_NODE_PROCESSES"
    fi
}

check_memory_usage() {
    debug "Checking process memory usage..."
    
    # Get all processes using more than threshold
    local high_memory_pids=($(ps -eo pid,rss,cmd --no-headers | awk -v threshold=$((MEMORY_THRESHOLD_MB*1024)) '$2 > threshold {print $1}' || true))
    
    for pid in "${high_memory_pids[@]}"; do
        local memory=$(get_process_memory "$pid")
        local cmdline=$(ps -o cmd --no-headers -p "$pid" 2>/dev/null | head -c 50 || echo "unknown")
        
        # Don't kill essential system processes
        if [[ "$cmdline" =~ systemd|kernel|init|ssh ]]; then
            debug "Skipping essential process: $pid ($cmdline)"
            continue
        fi
        
        warn "High memory usage detected: $pid (${memory}MB) - $cmdline"
        
        # Kill if it's a node/vite process
        if [[ "$cmdline" =~ node|vite ]]; then
            warn "Killing high-memory process: $pid"
            kill_process_safely "$pid" "high-memory-process"
        fi
    done
}

#######################################################################################
# Main Monitoring Loop
#######################################################################################

monitor_loop() {
    log "Starting monitoring loop (check interval: ${CHECK_INTERVAL}s)"
    
    while true; do
        debug "Running process checks..."
        
        # Check if Argos service is running
        if ! check_argos_service; then
            warn "Argos service not running, attempting restart..."
            restart_argos_service
        fi
        
        # Prune duplicate processes
        prune_duplicate_vite_processes
        prune_excessive_node_processes
        
        # Check memory usage
        check_memory_usage
        
        # Log system status
        local total_mem=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
        local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
        debug "System status - Memory: ${total_mem}%, Load: ${load_avg}"
        
        sleep "$CHECK_INTERVAL"
    done
}

#######################################################################################
# Signal Handlers
#######################################################################################

cleanup() {
    log "Received termination signal, cleaning up..."
    cleanup_pid_file
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

#######################################################################################
# Main Function
#######################################################################################

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --daemon          Run as daemon"
    echo "  --debug           Enable debug logging"
    echo "  --help            Show this help"
    echo "  --status          Show current status"
    echo "  --stop            Stop running daemon"
    echo ""
    echo "Environment Variables:"
    echo "  DEBUG=1           Enable debug mode"
    echo "  CHECK_INTERVAL    Check interval in seconds (default: 30)"
    echo ""
}

show_status() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Argos Keepalive is running (PID: $pid)"
            
            # Show process counts
            local vite_count=$(pgrep -f "vite.*dev" | wc -l || echo "0")
            local node_count=$(pgrep -f "node" | wc -l || echo "0")
            
            echo "Current process counts:"
            echo "  Vite processes: $vite_count/$MAX_VITE_PROCESSES"
            echo "  Node processes: $node_count/$MAX_NODE_PROCESSES"
            
            # Show Argos service status
            if systemctl is-active --quiet "$ARGOS_SERVICE"; then
                echo "  Argos service: ACTIVE"
            else
                echo "  Argos service: INACTIVE"
            fi
            
            return 0
        else
            echo "Argos Keepalive is not running (stale PID file)"
            return 1
        fi
    else
        echo "Argos Keepalive is not running"
        return 1
    fi
}

stop_daemon() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping Argos Keepalive (PID: $pid)..."
            kill "$pid"
            
            # Wait for termination
            local count=0
            while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
                sleep 1
                ((count++))
            done
            
            if kill -0 "$pid" 2>/dev/null; then
                echo "Force killing..."
                kill -KILL "$pid"
            fi
            
            cleanup_pid_file
            echo "Argos Keepalive stopped"
            return 0
        else
            echo "Argos Keepalive is not running (stale PID file)"
            cleanup_pid_file
            return 1
        fi
    else
        echo "Argos Keepalive is not running"
        return 1
    fi
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --daemon)
                DAEMON_MODE=1
                shift
                ;;
            --debug)
                DEBUG=1
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            --status)
                show_status
                exit $?
                ;;
            --stop)
                stop_daemon
                exit $?
                ;;
            *)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Check if running as daemon
    if [[ "${DAEMON_MODE:-0}" == "1" ]]; then
        check_running
        create_pid_file
        
        log "$SCRIPT_NAME starting as daemon (PID: $$)"
        monitor_loop
    else
        # Run once
        log "$SCRIPT_NAME running single check"
        prune_duplicate_vite_processes
        prune_excessive_node_processes
        check_memory_usage
        
        if ! check_argos_service; then
            restart_argos_service
        fi
        
        log "Single check completed"
    fi
}

# Run main function
main "$@"