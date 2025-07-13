#!/bin/bash

#######################################################################################
# Argos System Management Scripts Installer
# Creates process monitoring, CPU protection, and network connectivity management
#######################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPTS_DIR="/home/$(whoami)/project/Argos/scripts/management"
SYSTEMD_DIR="/etc/systemd/system"
LOG_DIR="/home/$(whoami)/project/logs"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

create_directories() {
    log "Creating management directories..."
    
    mkdir -p "${SCRIPTS_DIR}"
    mkdir -p "${LOG_DIR}"
    chmod 755 "${SCRIPTS_DIR}"
    chmod 755 "${LOG_DIR}"
}

create_process_monitor() {
    log "Creating process monitoring script..."
    
    cat > "${SCRIPTS_DIR}/process-monitor.sh" << 'EOF'
#!/bin/bash

# Argos Process Monitor
# Monitors critical processes and restarts them if they fail

LOG_FILE="/home/$(whoami)/project/logs/process-monitor.log"
PROCESSES=(
    "argos:systemctl start argos"
    "docker:systemctl start docker"
)

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_process() {
    local process_name=$1
    local restart_command=$2
    
    if ! pgrep -f "$process_name" > /dev/null; then
        log_message "ALERT: $process_name not running, attempting restart"
        eval "$restart_command"
        if [ $? -eq 0 ]; then
            log_message "SUCCESS: $process_name restarted"
        else
            log_message "ERROR: Failed to restart $process_name"
        fi
    fi
}

# Monitor each process
for process_info in "${PROCESSES[@]}"; do
    IFS=':' read -r process_name restart_command <<< "$process_info"
    check_process "$process_name" "$restart_command"
done

log_message "Process monitoring check completed"
EOF

    chmod +x "${SCRIPTS_DIR}/process-monitor.sh"
}

create_cpu_guardian() {
    log "Creating CPU protection script..."
    
    cat > "${SCRIPTS_DIR}/cpu-guardian.sh" << 'EOF'
#!/bin/bash

# Argos CPU Guardian
# Kills processes consuming more than 140% CPU to protect system stability

LOG_FILE="/home/$(whoami)/project/logs/cpu-guardian.log"
CPU_THRESHOLD=140.0

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_cpu_usage() {
    # Get processes using more than threshold CPU
    ps aux --sort=-%cpu | awk -v threshold="$CPU_THRESHOLD" '
    NR>1 && $3 > threshold {
        print $2, $11, $3
    }' | while read -r pid process cpu; do
        
        # Skip critical system processes
        if [[ "$process" =~ ^(systemd|kernel|kthread|migration|rcu_|watchdog) ]]; then
            continue
        fi
        
        log_message "KILLING: PID $pid ($process) using ${cpu}% CPU"
        
        # Try graceful termination first
        kill -TERM "$pid" 2>/dev/null
        sleep 5
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -KILL "$pid" 2>/dev/null
            log_message "FORCE KILLED: PID $pid"
        else
            log_message "GRACEFULLY TERMINATED: PID $pid"
        fi
    done
}

check_cpu_usage
log_message "CPU guardian check completed"
EOF

    chmod +x "${SCRIPTS_DIR}/cpu-guardian.sh"
}

create_network_monitor() {
    log "Creating network connectivity monitor..."
    
    cat > "${SCRIPTS_DIR}/network-monitor.sh" << 'EOF'
#!/bin/bash

# Argos Network Monitor
# Monitors WiFi/Ethernet connectivity and attempts recovery

LOG_FILE="/home/$(whoami)/project/logs/network-monitor.log"
TEST_HOSTS=("8.8.8.8" "1.1.1.1" "google.com")
INTERFACE_PRIORITY=("eth0" "wlan0")

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

test_connectivity() {
    for host in "${TEST_HOSTS[@]}"; do
        if ping -c 2 -W 5 "$host" > /dev/null 2>&1; then
            return 0
        fi
    done
    return 1
}

restart_network_interface() {
    local interface=$1
    
    log_message "Attempting to restart interface: $interface"
    
    # Take interface down and up
    sudo ip link set "$interface" down
    sleep 2
    sudo ip link set "$interface" up
    sleep 5
    
    # For WiFi, try to reconnect
    if [[ "$interface" == wlan* ]]; then
        sudo wpa_cli -i "$interface" reconnect > /dev/null 2>&1
        sleep 10
    fi
    
    # Request new DHCP lease
    sudo dhclient "$interface" > /dev/null 2>&1
    sleep 5
}

restart_network_service() {
    log_message "Restarting NetworkManager service"
    sudo systemctl restart NetworkManager
    sleep 15
}

check_network() {
    if test_connectivity; then
        log_message "Network connectivity OK"
        return 0
    fi
    
    log_message "ALERT: Network connectivity lost, attempting recovery"
    
    # Try restarting interfaces in priority order
    for interface in "${INTERFACE_PRIORITY[@]}"; do
        if ip link show "$interface" > /dev/null 2>&1; then
            restart_network_interface "$interface"
            
            if test_connectivity; then
                log_message "SUCCESS: Connectivity restored via $interface"
                return 0
            fi
        fi
    done
    
    # If interface restart fails, try service restart
    restart_network_service
    
    if test_connectivity; then
        log_message "SUCCESS: Connectivity restored via service restart"
    else
        log_message "ERROR: Failed to restore network connectivity"
    fi
}

check_network
log_message "Network monitoring check completed"
EOF

    chmod +x "${SCRIPTS_DIR}/network-monitor.sh"
}

create_system_health_check() {
    log "Creating system health check script..."
    
    cat > "${SCRIPTS_DIR}/system-health.sh" << 'EOF'
#!/bin/bash

# Argos System Health Check
# Comprehensive system monitoring and reporting

LOG_FILE="/home/$(whoami)/project/logs/system-health.log"

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_disk_space() {
    local usage
    usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -gt 90 ]; then
        log_message "CRITICAL: Disk usage at ${usage}%"
    elif [ "$usage" -gt 80 ]; then
        log_message "WARNING: Disk usage at ${usage}%"
    else
        log_message "OK: Disk usage at ${usage}%"
    fi
}

check_memory() {
    local mem_usage
    mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$mem_usage" -gt 90 ]; then
        log_message "CRITICAL: Memory usage at ${mem_usage}%"
    elif [ "$mem_usage" -gt 80 ]; then
        log_message "WARNING: Memory usage at ${mem_usage}%"
    else
        log_message "OK: Memory usage at ${mem_usage}%"
    fi
}

check_temperature() {
    if command -v vcgencmd > /dev/null 2>&1; then
        local temp
        temp=$(vcgencmd measure_temp | sed 's/temp=//' | sed 's/°C//')
        
        if (( $(echo "$temp > 70" | bc -l) )); then
            log_message "CRITICAL: CPU temperature at ${temp}°C"
        elif (( $(echo "$temp > 60" | bc -l) )); then
            log_message "WARNING: CPU temperature at ${temp}°C"
        else
            log_message "OK: CPU temperature at ${temp}°C"
        fi
    fi
}

check_services() {
    local services=("argos" "docker")
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            log_message "OK: Service $service is running"
        else
            log_message "ERROR: Service $service is not running"
        fi
    done
}

# Run all health checks
log_message "=== System Health Check Started ==="
check_disk_space
check_memory
check_temperature
check_services
log_message "=== System Health Check Completed ==="
EOF

    chmod +x "${SCRIPTS_DIR}/system-health.sh"
}

create_systemd_services() {
    log "Creating systemd services and timers..."
    
    # Process Monitor Timer
    sudo tee "${SYSTEMD_DIR}/argos-process-monitor.service" > /dev/null << EOF
[Unit]
Description=Argos Process Monitor
After=multi-user.target

[Service]
Type=oneshot
ExecStart=${SCRIPTS_DIR}/process-monitor.sh
User=$(whoami)
EOF

    sudo tee "${SYSTEMD_DIR}/argos-process-monitor.timer" > /dev/null << EOF
[Unit]
Description=Argos Process Monitor Timer
Requires=argos-process-monitor.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # CPU Guardian Timer  
    sudo tee "${SYSTEMD_DIR}/argos-cpu-guardian.service" > /dev/null << EOF
[Unit]
Description=Argos CPU Guardian
After=multi-user.target

[Service]
Type=oneshot
ExecStart=${SCRIPTS_DIR}/cpu-guardian.sh
User=$(whoami)
EOF

    sudo tee "${SYSTEMD_DIR}/argos-cpu-guardian.timer" > /dev/null << EOF
[Unit]
Description=Argos CPU Guardian Timer
Requires=argos-cpu-guardian.service

[Timer]
OnCalendar=*:0/2
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Network Monitor Timer
    sudo tee "${SYSTEMD_DIR}/argos-network-monitor.service" > /dev/null << EOF
[Unit]
Description=Argos Network Monitor
After=network.target

[Service]
Type=oneshot
ExecStart=${SCRIPTS_DIR}/network-monitor.sh
User=$(whoami)
EOF

    sudo tee "${SYSTEMD_DIR}/argos-network-monitor.timer" > /dev/null << EOF
[Unit]
Description=Argos Network Monitor Timer
Requires=argos-network-monitor.service

[Timer]
OnCalendar=*:0/1
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # System Health Timer
    sudo tee "${SYSTEMD_DIR}/argos-system-health.service" > /dev/null << EOF
[Unit]
Description=Argos System Health Check
After=multi-user.target

[Service]
Type=oneshot
ExecStart=${SCRIPTS_DIR}/system-health.sh
User=$(whoami)
EOF

    sudo tee "${SYSTEMD_DIR}/argos-system-health.timer" > /dev/null << EOF
[Unit]
Description=Argos System Health Timer
Requires=argos-system-health.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
EOF
}

enable_services() {
    log "Enabling systemd timers..."
    
    sudo systemctl daemon-reload
    
    # Enable and start all timers
    sudo systemctl enable --now argos-process-monitor.timer
    sudo systemctl enable --now argos-cpu-guardian.timer  
    sudo systemctl enable --now argos-network-monitor.timer
    sudo systemctl enable --now argos-system-health.timer
    
    log "All timers enabled and started"
}

print_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Argos System Management Scripts Installed!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}Management Scripts:${NC}"
    echo -e "  • Process Monitor:    ${YELLOW}Every 5 minutes${NC}"
    echo -e "  • CPU Guardian:       ${YELLOW}Every 2 minutes (kills >140% CPU)${NC}"
    echo -e "  • Network Monitor:    ${YELLOW}Every 1 minute${NC}"
    echo -e "  • System Health:      ${YELLOW}Every 15 minutes${NC}"
    echo ""
    echo -e "${BLUE}Log Files:${NC}"
    echo -e "  • Process Monitor:    ${YELLOW}${LOG_DIR}/process-monitor.log${NC}"
    echo -e "  • CPU Guardian:       ${YELLOW}${LOG_DIR}/cpu-guardian.log${NC}"
    echo -e "  • Network Monitor:    ${YELLOW}${LOG_DIR}/network-monitor.log${NC}"
    echo -e "  • System Health:      ${YELLOW}${LOG_DIR}/system-health.log${NC}"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo -e "  • Check Timer Status: ${YELLOW}systemctl list-timers argos-*${NC}"
    echo -e "  • View Logs:          ${YELLOW}tail -f ${LOG_DIR}/*.log${NC}"
    echo -e "  • Manual Run:         ${YELLOW}sudo systemctl start argos-<service>.service${NC}"
    echo ""
    echo -e "${GREEN}System monitoring active and protecting your Argos installation!${NC}"
    echo ""
}

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos System Management Scripts Installation${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        log "This script requires sudo privileges. You may be prompted for your password."
        sudo -v || error "Failed to obtain sudo privileges"
    fi
    
    create_directories
    create_process_monitor
    create_cpu_guardian
    create_network_monitor
    create_system_health_check
    create_systemd_services
    enable_services
    
    print_summary
    log "Management scripts installation completed successfully!"
}

# Run main installation
main "$@"