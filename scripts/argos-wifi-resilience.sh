#!/bin/bash
#
# Argos WiFi Resilience Manager
# Ensures reliable WiFi connectivity for Raspberry Pi deployments
#
# This script:
# - Monitors WiFi connection status
# - Automatically reconnects when connection drops
# - Handles Kismet WiFi interface management
# - Prioritizes ethernet when available
# - Maintains SSH accessibility
#

set -e

# Configuration
WIFI_INTERFACE=""  # Auto-detect if empty
ETHERNET_INTERFACE=""  # Auto-detect if empty
WIFI_CHECK_INTERVAL=30  # Seconds between WiFi checks
CONNECTION_TIMEOUT=15  # Seconds to wait for connection
MAX_RETRY_ATTEMPTS=3  # Maximum reconnection attempts per cycle
LOG_FILE="/var/log/argos-wifi-resilience.log"
CONFIG_FILE="/etc/argos/wifi-resilience.conf"
KISMET_INTERFACE_FILE="/tmp/kismet_wifi_interface"

# WiFi credentials (will be loaded from config)
WIFI_SSID=""
WIFI_PASSWORD=""
WIFI_COUNTRY="US"

# Protected WiFi processes (don't interfere with these)
PROTECTED_WIFI_PROCESSES=(
    "wpa_supplicant"
    "NetworkManager"
    "kismet"
    "hostapd"
    "dhcpcd"
)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WiFi-Resilience: $1" | tee -a "$LOG_FILE"
}

# Load configuration
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        log "Configuration loaded from $CONFIG_FILE"
    else
        log "No configuration file found at $CONFIG_FILE, using defaults"
    fi
}

# Auto-detect network interfaces
detect_interfaces() {
    if [ -z "$WIFI_INTERFACE" ]; then
        # Find wireless interface (usually wlan0, but could be wlp2s0, etc.)
        WIFI_INTERFACE=$(iw dev | grep Interface | head -1 | awk '{print $2}' 2>/dev/null || echo "")
        if [ -z "$WIFI_INTERFACE" ]; then
            # Fallback: look for interfaces starting with 'w'
            WIFI_INTERFACE=$(ip link show | grep -E "^[0-9]+: w" | head -1 | cut -d: -f2 | tr -d ' ' 2>/dev/null || echo "wlan0")
        fi
    fi
    
    if [ -z "$ETHERNET_INTERFACE" ]; then
        # Find ethernet interface (usually eth0, but could be enp1s0, etc.)
        ETHERNET_INTERFACE=$(ip link show | grep -E "^[0-9]+: e" | head -1 | cut -d: -f2 | tr -d ' ' 2>/dev/null || echo "eth0")
    fi
    
    log "Detected interfaces - WiFi: $WIFI_INTERFACE, Ethernet: $ETHERNET_INTERFACE"
}

# Check if ethernet is connected and working
is_ethernet_connected() {
    if [ -z "$ETHERNET_INTERFACE" ] || ! ip link show "$ETHERNET_INTERFACE" &>/dev/null; then
        return 1
    fi
    
    # Check if interface is up and has an IP
    if ip addr show "$ETHERNET_INTERFACE" | grep -q "inet " && \
       ip link show "$ETHERNET_INTERFACE" | grep -q "state UP"; then
        return 0
    fi
    
    return 1
}

# Check if WiFi interface is being used by Kismet
is_kismet_using_wifi() {
    # Check if Kismet is running and using the WiFi interface
    if pgrep -x "kismet" > /dev/null; then
        # Check Kismet configuration or process list for WiFi interface usage
        if ps aux | grep kismet | grep -q "$WIFI_INTERFACE" 2>/dev/null; then
            return 0
        fi
        
        # Check if Kismet interface file exists
        if [ -f "$KISMET_INTERFACE_FILE" ] && grep -q "$WIFI_INTERFACE" "$KISMET_INTERFACE_FILE" 2>/dev/null; then
            return 0
        fi
    fi
    
    return 1
}

# Check WiFi connection status
is_wifi_connected() {
    if [ -z "$WIFI_INTERFACE" ] || ! ip link show "$WIFI_INTERFACE" &>/dev/null; then
        return 1
    fi
    
    # Check if interface is up and has an IP
    if ip addr show "$WIFI_INTERFACE" | grep -q "inet " && \
       ip link show "$WIFI_INTERFACE" | grep -q "state UP"; then
        # Test actual connectivity with a quick ping
        if timeout 5 ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
            return 0
        fi
    fi
    
    return 1
}

# Get current WiFi signal strength
get_wifi_signal() {
    if [ -z "$WIFI_INTERFACE" ]; then
        echo "N/A"
        return
    fi
    
    local signal=$(iw "$WIFI_INTERFACE" link 2>/dev/null | grep "signal:" | awk '{print $2}' | tr -d '-')
    if [ -n "$signal" ]; then
        echo "${signal}dBm"
    else
        echo "Unknown"
    fi
}

# Connect to WiFi
connect_wifi() {
    if [ -z "$WIFI_SSID" ] || [ -z "$WIFI_PASSWORD" ]; then
        log "ERROR: WiFi credentials not configured. Please set WIFI_SSID and WIFI_PASSWORD in $CONFIG_FILE"
        return 1
    fi
    
    log "Attempting to connect to WiFi network: $WIFI_SSID"
    
    # Bring interface up
    sudo ip link set "$WIFI_INTERFACE" up 2>/dev/null || true
    
    # Kill any existing wpa_supplicant for this interface
    sudo pkill -f "wpa_supplicant.*$WIFI_INTERFACE" 2>/dev/null || true
    sleep 2
    
    # Create temporary wpa_supplicant configuration
    local temp_conf="/tmp/wpa_supplicant_argos.conf"
    cat > "$temp_conf" << EOF
country=$WIFI_COUNTRY
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="$WIFI_SSID"
    psk="$WIFI_PASSWORD"
    key_mgmt=WPA-PSK
}
EOF
    
    # Start wpa_supplicant
    sudo wpa_supplicant -B -i "$WIFI_INTERFACE" -c "$temp_conf" -D nl80211,wext 2>/dev/null || {
        log "ERROR: Failed to start wpa_supplicant"
        rm -f "$temp_conf"
        return 1
    }
    
    # Wait for connection
    local attempts=0
    while [ $attempts -lt $CONNECTION_TIMEOUT ]; do
        if iw "$WIFI_INTERFACE" link 2>/dev/null | grep -q "Connected"; then
            log "WiFi connected successfully"
            break
        fi
        sleep 1
        ((attempts++))
    done
    
    # Get IP address via DHCP
    sudo dhclient "$WIFI_INTERFACE" 2>/dev/null || true
    
    # Verify connection
    sleep 3
    if is_wifi_connected; then
        local signal=$(get_wifi_signal)
        log "WiFi connection established successfully (Signal: $signal)"
        rm -f "$temp_conf"
        return 0
    else
        log "ERROR: WiFi connection failed"
        rm -f "$temp_conf"
        return 1
    fi
}

# Restart WiFi interface
restart_wifi_interface() {
    log "Restarting WiFi interface: $WIFI_INTERFACE"
    
    # Don't restart if Kismet is using it
    if is_kismet_using_wifi; then
        log "WARNING: Kismet is using WiFi interface, skipping restart"
        return 1
    fi
    
    sudo ip link set "$WIFI_INTERFACE" down 2>/dev/null || true
    sleep 2
    sudo ip link set "$WIFI_INTERFACE" up 2>/dev/null || true
    sleep 3
    
    return 0
}

# Main monitoring function
monitor_connectivity() {
    log "Starting WiFi resilience monitoring"
    log "WiFi Interface: $WIFI_INTERFACE"
    log "Ethernet Interface: $ETHERNET_INTERFACE"
    log "Check Interval: ${WIFI_CHECK_INTERVAL}s"
    
    while true; do
        # If ethernet is connected and working, we don't need WiFi urgently
        if is_ethernet_connected; then
            log "Ethernet connection active, WiFi monitoring in background mode"
            sleep $((WIFI_CHECK_INTERVAL * 2))
            continue
        fi
        
        # Check if Kismet is using the WiFi interface
        if is_kismet_using_wifi; then
            log "Kismet is using WiFi interface for monitoring, skipping connection management"
            sleep $WIFI_CHECK_INTERVAL
            continue
        fi
        
        # Check WiFi connectivity
        if ! is_wifi_connected; then
            local signal=$(get_wifi_signal)
            log "WiFi disconnected (Signal: $signal), attempting reconnection"
            
            local retry_count=0
            while [ $retry_count -lt $MAX_RETRY_ATTEMPTS ]; do
                ((retry_count++))
                log "Reconnection attempt $retry_count of $MAX_RETRY_ATTEMPTS"
                
                # Try to reconnect
                if connect_wifi; then
                    log "WiFi reconnection successful on attempt $retry_count"
                    break
                else
                    log "Reconnection attempt $retry_count failed"
                    if [ $retry_count -lt $MAX_RETRY_ATTEMPTS ]; then
                        log "Waiting 10 seconds before next attempt..."
                        sleep 10
                    fi
                fi
            done
            
            # If all attempts failed, restart the interface
            if [ $retry_count -eq $MAX_RETRY_ATTEMPTS ] && ! is_wifi_connected; then
                log "All reconnection attempts failed, restarting WiFi interface"
                restart_wifi_interface
                sleep 15
                connect_wifi || log "ERROR: WiFi recovery failed after interface restart"
            fi
        else
            local signal=$(get_wifi_signal)
            log "WiFi connected and stable (Signal: $signal)"
        fi
        
        sleep $WIFI_CHECK_INTERVAL
    done
}

# Create default configuration file
create_default_config() {
    sudo mkdir -p "$(dirname "$CONFIG_FILE")"
    
    if [ ! -f "$CONFIG_FILE" ]; then
        cat > /tmp/wifi-resilience.conf << 'EOF'
# Argos WiFi Resilience Configuration
# Copy this file to /etc/argos/wifi-resilience.conf and modify as needed

# WiFi Credentials
WIFI_SSID="YourNetworkName"
WIFI_PASSWORD="YourNetworkPassword"
WIFI_COUNTRY="US"

# Interface Configuration (leave empty for auto-detection)
WIFI_INTERFACE=""
ETHERNET_INTERFACE=""

# Timing Configuration
WIFI_CHECK_INTERVAL=30
CONNECTION_TIMEOUT=15
MAX_RETRY_ATTEMPTS=3
EOF
        
        sudo mv /tmp/wifi-resilience.conf "$CONFIG_FILE"
        sudo chmod 600 "$CONFIG_FILE"  # Secure the config file
        log "Default configuration created at $CONFIG_FILE"
        log "Please edit $CONFIG_FILE with your WiFi credentials"
    fi
}

# Print status information
print_status() {
    echo "=== Argos WiFi Resilience Status ==="
    echo "WiFi Interface: $WIFI_INTERFACE"
    echo "Ethernet Interface: $ETHERNET_INTERFACE"
    echo
    
    if is_ethernet_connected; then
        echo "Ethernet: Connected [OK]"
    else
        echo "Ethernet: Disconnected [FAIL]"
    fi
    
    if is_wifi_connected; then
        local signal=$(get_wifi_signal)
        echo "WiFi: Connected [PASS] (Signal: $signal)"
    else
        echo "WiFi: Disconnected [FAIL]"
    fi
    
    if is_kismet_using_wifi; then
        echo "Kismet: Using WiFi interface for monitoring"
    else
        echo "Kismet: Not using WiFi interface"
    fi
    
    echo
    echo "Recent log entries:"
    tail -n 5 "$LOG_FILE" 2>/dev/null || echo "No log entries found"
}

# Show usage information
show_usage() {
    cat << 'EOF'
Argos WiFi Resilience Manager

Usage: argos-wifi-resilience.sh [COMMAND]

Commands:
    monitor     Start continuous WiFi monitoring (default)
    connect     Attempt single WiFi connection
    status      Show current connectivity status
    restart     Restart WiFi interface
    config      Create default configuration file
    help        Show this help message

Configuration:
    Edit /etc/argos/wifi-resilience.conf to set WiFi credentials
    and customize behavior.

Examples:
    argos-wifi-resilience.sh monitor    # Start monitoring daemon
    argos-wifi-resilience.sh status     # Check current status
    argos-wifi-resilience.sh connect    # Manual connection attempt
EOF
}

# Main execution
main() {
    # Create log directory
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    
    # Load configuration
    load_config
    
    # Detect interfaces
    detect_interfaces
    
    # Handle command line arguments
    case "${1:-monitor}" in
        "monitor")
            monitor_connectivity
            ;;
        "connect")
            connect_wifi
            ;;
        "status")
            print_status
            ;;
        "restart")
            restart_wifi_interface
            ;;
        "config")
            create_default_config
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            echo "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Error handling
trap 'log "Script interrupted, cleaning up..."; exit 130' INT TERM

# Run main function
main "$@"