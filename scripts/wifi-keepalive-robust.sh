#!/bin/bash
# Robust WiFi Keepalive Script - Prevents SSH disconnections
# Runs every 30 seconds with proper locking and fast recovery

INTERFACE="wlan0"
LOG_FILE="/var/log/wifi-keepalive.log"
LOCK_FILE="/var/run/wifi-keepalive.lock"
MAX_LOG_SIZE=5242880  # 5MB
PING_HOST="8.8.8.8"
PING_TIMEOUT=2
RECONNECT_DELAY=1

# Ensure only one instance runs
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another instance is already running" >> "$LOG_FILE"
    exit 1
fi

# Log with rotation
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "$LOG_FILE.old"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Log rotated" > "$LOG_FILE"
    fi
}

# First, always disable power management
disable_power_management() {
    # Method 1: iw
    sudo iw "$INTERFACE" set power_save off 2>/dev/null
    
    # Method 2: iwconfig
    sudo iwconfig "$INTERFACE" power off 2>/dev/null
    
    # Method 3: Direct sysfs
    echo -1 | sudo tee "/sys/class/net/$INTERFACE/device/power/autosuspend" >/dev/null 2>&1
    
    # Log current state
    local pm_state=$(iwconfig "$INTERFACE" 2>/dev/null | grep "Power Management" | awk -F: '{print $2}')
    log_message "Power management state: $pm_state"
}

# Get saved WiFi connection profile
get_wifi_profile() {
    # First try to get active connection
    local profile=$(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | grep ":$INTERFACE$" | cut -d: -f1)
    
    # If no active connection, get any WiFi profile
    if [ -z "$profile" ]; then
        profile=$(nmcli -t -f NAME,TYPE con show 2>/dev/null | grep ":802-11-wireless$" | cut -d: -f1 | head -1)
    fi
    
    echo "$profile"
}

# Fast reconnect function
reconnect_wifi() {
    local profile="$1"
    log_message "Reconnecting WiFi profile: $profile"
    
    # First ensure interface is up
    sudo ip link set "$INTERFACE" up
    
    # Use nmcli to reconnect
    nmcli con up "$profile" 2>&1 | while read line; do
        log_message "NMCLI: $line"
    done
    
    # Wait briefly for connection
    sleep "$RECONNECT_DELAY"
}

# Main monitoring loop
main() {
    log_message "Starting robust WiFi keepalive monitor"
    
    while true; do
        # Always disable power management first
        disable_power_management
        
        # Check if interface exists
        if ! ip link show "$INTERFACE" &>/dev/null; then
            log_message "ERROR: Interface $INTERFACE does not exist"
            sleep 30
            continue
        fi
        
        # Get interface state
        local if_state=$(cat "/sys/class/net/$INTERFACE/operstate" 2>/dev/null)
        
        # Quick connectivity test
        if [ "$if_state" = "up" ]; then
            # Do a quick ping test
            if ! ping -c 1 -W "$PING_TIMEOUT" -I "$INTERFACE" "$PING_HOST" &>/dev/null; then
                log_message "WARNING: No connectivity, reconnecting immediately"
                
                # Get WiFi profile
                local profile=$(get_wifi_profile)
                if [ -n "$profile" ]; then
                    reconnect_wifi "$profile"
                else
                    log_message "ERROR: No WiFi profile found"
                fi
            fi
        else
            log_message "WARNING: Interface is $if_state, bringing up"
            
            # Bring interface up
            sudo ip link set "$INTERFACE" up
            sleep 1
            
            # Get WiFi profile and connect
            local profile=$(get_wifi_profile)
            if [ -n "$profile" ]; then
                reconnect_wifi "$profile"
            else
                log_message "ERROR: No WiFi profile found"
            fi
        fi
        
        # Short sleep - 30 seconds
        sleep 30
    done
}

# Trap to clean up lock file
trap 'rm -f "$LOCK_FILE"' EXIT

# Run main function
main