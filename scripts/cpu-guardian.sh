#!/bin/bash

#######################################################################################
# CPU Guardian Script
# Monitors and kills processes exceeding CPU thresholds
# Protects Raspberry Pi from runaway processes
#######################################################################################

set -euo pipefail

# Configuration
SCRIPT_NAME="CPU Guardian"
LOG_FILE="/var/log/cpu-guardian.log"
PID_FILE="/var/run/cpu-guardian.pid"
CPU_THRESHOLD=140        # Kill processes using more than 140% CPU
GRACE_PERIOD=60          # Seconds to wait before killing
CHECK_INTERVAL=15        # Check every 15 seconds
WHITELIST_PROCESSES=(    # Processes to never kill
    "systemd"
    "kernel"
    "init"
    "ssh"
    "sshd"
    "NetworkManager"
    "dbus"
    "cpu-guardian"
    "argos-keepalive"
)

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
            error "CPU Guardian already running with PID $pid"
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

is_whitelisted() {
    local cmdline="$1"
    
    for whitelist_item in "${WHITELIST_PROCESSES[@]}"; do
        if [[ "$cmdline" =~ $whitelist_item ]]; then
            return 0
        fi
    done
    return 1
}

get_process_info() {
    local pid=$1
    local info
    
    # Get process info: PID CPU COMMAND
    info=$(ps -p "$pid" -o pid,pcpu,comm --no-headers 2>/dev/null || echo "")
    
    if [[ -n "$info" ]]; then
        echo "$info"
        return 0
    else
        return 1
    fi
}

get_process_cmdline() {
    local pid=$1
    ps -p "$pid" -o cmd --no-headers 2>/dev/null || echo "unknown"
}

kill_process_gracefully() {
    local pid=$1
    local name="$2"
    local cpu="$3"
    
    log "Attempting graceful termination of PID $pid ($name) - CPU: ${cpu}%"
    
    # Send SIGTERM
    if kill -TERM "$pid" 2>/dev/null; then
        # Wait for graceful termination
        local count=0
        while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
            sleep 1
            ((count++))
        done
        
        # Check if process terminated
        if ! kill -0 "$pid" 2>/dev/null; then
            log "Process $pid ($name) terminated gracefully"
            return 0
        else
            warn "Process $pid ($name) didn't respond to SIGTERM, sending SIGKILL"
            kill -KILL "$pid" 2>/dev/null || true
            
            # Final check
            sleep 1
            if ! kill -0 "$pid" 2>/dev/null; then
                log "Process $pid ($name) force-killed"
                return 0
            else
                error "Failed to kill process $pid ($name)"
                return 1
            fi
        fi
    else
        warn "Failed to send SIGTERM to process $pid ($name)"
        return 1
    fi
}

#######################################################################################
# CPU Monitoring
#######################################################################################

# Store process CPU tracking
declare -A process_start_times
declare -A process_high_cpu_start

monitor_cpu_usage() {
    debug "Scanning for high CPU processes..."
    
    # Get all processes with their CPU usage
    local high_cpu_processes=()
    
    # Use ps to get current CPU percentages
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local pid=$(echo "$line" | awk '{print $1}')
            local cpu=$(echo "$line" | awk '{print $2}')
            local comm=$(echo "$line" | awk '{print $3}')
            
            # Convert CPU to integer for comparison
            local cpu_int=$(echo "$cpu" | cut -d'.' -f1)
            
            if [[ $cpu_int -gt $CPU_THRESHOLD ]]; then
                high_cpu_processes+=("$pid:$cpu:$comm")
            fi
        fi
    done < <(ps -eo pid,pcpu,comm --no-headers | grep -v "^ *PID")
    
    debug "Found ${#high_cpu_processes[@]} processes above ${CPU_THRESHOLD}% CPU"
    
    # Process high CPU usage processes
    for process_info in "${high_cpu_processes[@]}"; do
        IFS=':' read -r pid cpu comm <<< "$process_info"
        
        # Get full command line
        local cmdline=$(get_process_cmdline "$pid")
        
        # Skip whitelisted processes
        if is_whitelisted "$cmdline"; then
            debug "Skipping whitelisted process: $pid ($comm) - $cmdline"
            continue
        fi
        
        # Track when high CPU usage started
        local current_time=$(date +%s)
        
        if [[ -z "${process_high_cpu_start[$pid]:-}" ]]; then
            # First time seeing this process with high CPU
            process_high_cpu_start[$pid]=$current_time
            warn "High CPU detected: PID $pid ($comm) - ${cpu}% CPU - Grace period started"
            debug "Command line: $cmdline"
        else
            # Check if grace period has expired
            local start_time=${process_high_cpu_start[$pid]}
            local elapsed=$((current_time - start_time))
            
            if [[ $elapsed -gt $GRACE_PERIOD ]]; then
                warn "Grace period expired for PID $pid ($comm) - ${cpu}% CPU for ${elapsed}s"
                
                # Attempt to kill the process
                if kill_process_gracefully "$pid" "$comm" "$cpu"; then
                    log "Successfully terminated high CPU process: $pid ($comm)"
                    # Remove from tracking
                    unset process_high_cpu_start[$pid]
                else
                    error "Failed to terminate process: $pid ($comm)"
                fi
            else
                local remaining=$((GRACE_PERIOD - elapsed))
                debug "Process $pid ($comm) still high CPU (${cpu}%), ${remaining}s remaining in grace period"
            fi
        fi
    done
    
    # Clean up tracking for processes that are no longer high CPU
    for tracked_pid in "${!process_high_cpu_start[@]}"; do
        local found=0
        for process_info in "${high_cpu_processes[@]}"; do
            local current_pid=$(echo "$process_info" | cut -d':' -f1)
            if [[ "$tracked_pid" == "$current_pid" ]]; then
                found=1
                break
            fi
        done
        
        if [[ $found -eq 0 ]]; then
            debug "Process $tracked_pid no longer high CPU, removing from tracking"
            unset process_high_cpu_start[$tracked_pid]
        fi
    done
}

get_system_load() {
    uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ','
}

log_system_status() {
    local load_avg=$(get_system_load)
    local cpu_count=$(nproc)
    local memory_usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
    local high_cpu_count=${#process_high_cpu_start[@]}
    
    debug "System Status - Load: $load_avg/$cpu_count, Memory: ${memory_usage}%, High CPU processes tracked: $high_cpu_count"
}

#######################################################################################
# Main Monitoring Loop
#######################################################################################

monitor_loop() {
    log "Starting CPU monitoring loop (threshold: ${CPU_THRESHOLD}%, grace period: ${GRACE_PERIOD}s, interval: ${CHECK_INTERVAL}s)"
    
    while true; do
        monitor_cpu_usage
        log_system_status
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
    echo "  --test            Test mode (no killing)"
    echo ""
    echo "Configuration:"
    echo "  CPU_THRESHOLD     CPU percentage threshold (default: $CPU_THRESHOLD%)"
    echo "  GRACE_PERIOD      Grace period in seconds (default: $GRACE_PERIOD)"
    echo "  CHECK_INTERVAL    Check interval in seconds (default: $CHECK_INTERVAL)"
    echo ""
}

show_status() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "CPU Guardian is running (PID: $pid)"
            echo "Configuration:"
            echo "  CPU Threshold: $CPU_THRESHOLD%"
            echo "  Grace Period: $GRACE_PERIOD seconds"
            echo "  Check Interval: $CHECK_INTERVAL seconds"
            
            # Show current high CPU processes
            local high_cpu_count=${#process_high_cpu_start[@]}
            echo "  High CPU processes tracked: $high_cpu_count"
            
            if [[ $high_cpu_count -gt 0 ]]; then
                echo "Tracked processes:"
                for pid in "${!process_high_cpu_start[@]}"; do
                    local start_time=${process_high_cpu_start[$pid]}
                    local current_time=$(date +%s)
                    local elapsed=$((current_time - start_time))
                    local comm=$(ps -p "$pid" -o comm --no-headers 2>/dev/null || echo "unknown")
                    echo "  PID $pid ($comm): ${elapsed}s elapsed"
                done
            fi
            
            return 0
        else
            echo "CPU Guardian is not running (stale PID file)"
            return 1
        fi
    else
        echo "CPU Guardian is not running"
        return 1
    fi
}

stop_daemon() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping CPU Guardian (PID: $pid)..."
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
            echo "CPU Guardian stopped"
            return 0
        else
            echo "CPU Guardian is not running (stale PID file)"
            cleanup_pid_file
            return 1
        fi
    else
        echo "CPU Guardian is not running"
        return 1
    fi
}

test_mode() {
    log "Running in test mode - no processes will be killed"
    
    # Override kill function for test mode
    kill_process_gracefully() {
        local pid=$1
        local name="$2"
        local cpu="$3"
        log "TEST MODE: Would kill PID $pid ($name) - CPU: ${cpu}%"
        return 0
    }
    
    # Run one monitoring cycle
    monitor_cpu_usage
    log_system_status
    log "Test mode completed"
}

main() {
    local DAEMON_MODE=0
    local TEST_MODE=0
    
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
            --test)
                TEST_MODE=1
                shift
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
    
    # Test mode
    if [[ $TEST_MODE == 1 ]]; then
        test_mode
        exit 0
    fi
    
    # Check if running as daemon
    if [[ $DAEMON_MODE == 1 ]]; then
        check_running
        create_pid_file
        
        log "$SCRIPT_NAME starting as daemon (PID: $$)"
        log "Configuration: Threshold=${CPU_THRESHOLD}%, Grace=${GRACE_PERIOD}s, Interval=${CHECK_INTERVAL}s"
        monitor_loop
    else
        # Run once
        log "$SCRIPT_NAME running single check"
        monitor_cpu_usage
        log_system_status
        log "Single check completed"
    fi
}

# Run main function
main "$@"