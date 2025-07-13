#!/bin/bash
#
# Argos CPU Protector
# Prevents system overload by managing high CPU processes
#
# This script:
# - Monitors CPU usage per process
# - Kills processes exceeding threshold
# - Protects critical system processes
# - Maintains system stability

set -e

# Configuration
CPU_THRESHOLD=140  # Kill processes using more than 140% CPU
CRITICAL_CPU_THRESHOLD=180  # Emergency threshold
CHECK_INTERVAL=5  # Seconds between checks in monitor mode
LOG_FILE="/var/log/argos-cpu-protector.log"
WHITELIST_FILE="/etc/argos/cpu-whitelist.conf"

# Protected processes (never kill these)
PROTECTED_PROCESSES=(
    "systemd"
    "kernel"
    "init"
    "sshd"
    "argos-main"
    "gpsd"
    "NetworkManager"
    "wpa_supplicant"
)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if process is protected
is_protected() {
    local process_name=$1
    
    # Check built-in protected list
    for protected in "${PROTECTED_PROCESSES[@]}"; do
        if [[ "$process_name" == *"$protected"* ]]; then
            return 0
        fi
    done
    
    # Check whitelist file
    if [ -f "$WHITELIST_FILE" ]; then
        while IFS= read -r line; do
            if [[ "$process_name" == *"$line"* ]]; then
                return 0
            fi
        done < "$WHITELIST_FILE"
    fi
    
    return 1
}

# Function to get top CPU consuming processes
get_high_cpu_processes() {
    # Get processes with CPU > threshold
    # Format: PID %CPU COMMAND
    ps aux --sort=-%cpu | awk -v threshold="$CPU_THRESHOLD" '
        NR>1 && $3 > threshold {
            pid=$2
            cpu=$3
            cmd=""
            for(i=11; i<=NF; i++) cmd=cmd" "$i
            printf "%s %.1f %s\n", pid, cpu, cmd
        }
    '
}

# Function to analyze process before killing
analyze_process() {
    local pid=$1
    local cpu=$2
    local cmd=$3
    
    # Get additional process info
    local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs || echo "unknown")
    local memory=$(ps -o pmem= -p "$pid" 2>/dev/null | xargs || echo "0")
    local user=$(ps -o user= -p "$pid" 2>/dev/null | xargs || echo "unknown")
    
    log "High CPU process detected:"
    log "  PID: $pid"
    log "  CPU: ${cpu}%"
    log "  Memory: ${memory}%"
    log "  User: $user"
    log "  Command: $cmd"
    log "  Started: $start_time"
    
    # Check if it's a recurring offender
    local offense_count=$(grep -c "Killing process $pid" "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$offense_count" -gt 3 ]; then
        log "  Warning: This process has been killed $offense_count times before"
    fi
}

# Function to safely kill a process
safe_kill() {
    local pid=$1
    local signal=${2:-TERM}
    
    if kill -0 "$pid" 2>/dev/null; then
        log "Sending $signal signal to process $pid"
        kill -"$signal" "$pid" 2>/dev/null || return 1
        
        # Wait for graceful termination
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
            sleep 1
            ((count++))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log "Process $pid didn't terminate gracefully, forcing kill"
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        return 0
    else
        log "Process $pid no longer exists"
        return 1
    fi
}

# Function to handle runaway processes
handle_runaway_process() {
    local pid=$1
    local cpu=$2
    local cmd=$3
    
    # Check if protected
    if is_protected "$cmd"; then
        log "Process $pid is protected, attempting nice reduction instead"
        renice -n 19 -p "$pid" 2>/dev/null || true
        return
    fi
    
    # Analyze before killing
    analyze_process "$pid" "$cpu" "$cmd"
    
    # Try graceful termination first
    if safe_kill "$pid" "TERM"; then
        log "Successfully terminated process $pid"
        
        # Log to metrics file
        echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ"),kill,$pid,$cpu,$cmd" >> /var/log/argos-cpu-kills.csv
    else
        log "Failed to terminate process $pid"
    fi
}

# Function to check system load
check_system_load() {
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cores=$(nproc)
    local load_per_core=$(echo "scale=2; $load / $cores" | bc)
    
    # If load is very high, be more aggressive
    if (( $(echo "$load_per_core > 2.0" | bc -l) )); then
        log "High system load detected: $load (${load_per_core} per core)"
        return 0
    fi
    
    return 1
}

# Function to prevent CPU frequency scaling issues
manage_cpu_governor() {
    # Check if we can manage CPU governor
    if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
        local current_governor=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "unknown")
        
        # If system is under stress and in powersave mode, switch to performance
        if check_system_load && [ "$current_governor" = "powersave" ]; then
            log "Switching CPU governor from powersave to performance"
            echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor >/dev/null 2>&1 || true
        fi
    fi
}

# Function to generate report
generate_report() {
    local report_file="/var/log/argos-cpu-report-$(date +%Y%m%d).txt"
    
    {
        echo "=== Argos CPU Protection Report ==="
        echo "Generated: $(date)"
        echo
        echo "Top CPU Consumers:"
        ps aux --sort=-%cpu | head -20
        echo
        echo "Processes Killed Today:"
        grep "$(date +%Y-%m-%d)" /var/log/argos-cpu-kills.csv 2>/dev/null | tail -20 || echo "None"
        echo
        echo "System Stats:"
        uptime
        free -h
        df -h /
    } > "$report_file"
    
    log "Report generated: $report_file"
}

# Function to monitor mode (continuous monitoring)
monitor_mode() {
    log "Starting continuous CPU monitoring (threshold: ${CPU_THRESHOLD}%)"
    
    while true; do
        # Check for high CPU processes
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                local pid=$(echo "$line" | awk '{print $1}')
                local cpu=$(echo "$line" | awk '{print $2}')
                local cmd=$(echo "$line" | cut -d' ' -f3-)
                
                handle_runaway_process "$pid" "$cpu" "$cmd"
            fi
        done < <(get_high_cpu_processes)
        
        # Check CPU governor
        manage_cpu_governor
        
        sleep "$CHECK_INTERVAL"
    done
}

# Function to clean old logs
cleanup_logs() {
    # Keep only last 30 days of kill logs
    if [ -f /var/log/argos-cpu-kills.csv ]; then
        local temp_file=$(mktemp)
        local cutoff_date=$(date -d "30 days ago" +%Y-%m-%d)
        
        # Keep header and recent entries
        echo "timestamp,action,pid,cpu,command" > "$temp_file"
        awk -F',' -v cutoff="$cutoff_date" '$1 >= cutoff' /var/log/argos-cpu-kills.csv >> "$temp_file" 2>/dev/null || true
        
        mv "$temp_file" /var/log/argos-cpu-kills.csv
    fi
    
    # Rotate main log if too large
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 52428800 ]; then
        log "Rotating large log file"
        mv "$LOG_FILE" "${LOG_FILE}.old"
        tail -n 5000 "${LOG_FILE}.old" > "$LOG_FILE"
        rm -f "${LOG_FILE}.old"
    fi
}

# Main function
main() {
    # Create directories if needed
    mkdir -p /etc/argos /var/log
    
    # Initialize CSV log if not exists
    if [ ! -f /var/log/argos-cpu-kills.csv ]; then
        echo "timestamp,action,pid,cpu,command" > /var/log/argos-cpu-kills.csv
    fi
    
    log "CPU Protector starting (threshold: ${CPU_THRESHOLD}%)"
    
    # Parse command line arguments
    case "${1:-}" in
        --monitor|-m)
            monitor_mode
            ;;
        --report|-r)
            generate_report
            ;;
        *)
            # Single run mode (for cron)
            cleanup_logs
            
            # Check for high CPU processes
            local found_high_cpu=false
            while IFS= read -r line; do
                if [ -n "$line" ]; then
                    found_high_cpu=true
                    local pid=$(echo "$line" | awk '{print $1}')
                    local cpu=$(echo "$line" | awk '{print $2}')
                    local cmd=$(echo "$line" | cut -d' ' -f3-)
                    
                    handle_runaway_process "$pid" "$cpu" "$cmd"
                fi
            done < <(get_high_cpu_processes)
            
            if [ "$found_high_cpu" = false ]; then
                log "No processes exceeding CPU threshold"
            fi
            
            # Check and adjust CPU governor if needed
            manage_cpu_governor
            ;;
    esac
}

# Run main function
main "$@"