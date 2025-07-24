#!/bin/bash
# Simple and stable Argos AP startup script
# This replaces the overcomplicated management scripts

set -e

# Configuration
INTERFACE="wlan_ap"
PHY_DEVICE=""
HOSTAPD_CONF="/etc/hostapd/hostapd.conf"
IP_ADDRESS="192.168.50.1"
IP_NETMASK="255.255.255.0"
DHCP_RANGE="192.168.50.10,192.168.50.100"
LOG_TAG="argos-ap-simple"

# Logging function
log() {
    logger -t "$LOG_TAG" "$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Find AP-capable adapter (Alfa)
find_ap_adapter() {
    log "Looking for AP-capable WiFi adapter..."
    
    # First check if wlan_ap already exists
    if ip link show "$INTERFACE" &>/dev/null; then
        # Get the phy from the existing interface
        local phy=$(iw dev "$INTERFACE" info | grep wiphy | awk '{print "phy"$2}')
        if [ -n "$phy" ]; then
            PHY_DEVICE="$phy"
            log "Found existing AP interface $INTERFACE on $PHY_DEVICE"
            return 0
        fi
    fi
    
    # Look for Alfa adapter by MAC prefix
    local phy=$(iw dev | grep -B 5 "00:c0:ca" | grep "phy" | head -1 | awk '{print $2}' | tr -d '#')
    
    if [ -z "$phy" ]; then
        # Try another method - scan all phys for Alfa MAC
        phy=$(ls /sys/class/ieee80211/ | while read p; do
            if iw phy "$p" info | grep -q "00:c0:ca"; then
                echo "$p"
                break
            fi
        done)
    fi
    
    if [ -z "$phy" ]; then
        # Last resort - find any phy that supports AP mode
        phy=$(iw phy | grep -B 1 "AP" | grep Wiphy | head -1 | awk '{print $2}')
    fi
    
    if [ -n "$phy" ]; then
        PHY_DEVICE="$phy"
        log "Found AP adapter: $PHY_DEVICE"
        return 0
    else
        log "ERROR: No AP-capable adapter found"
        return 1
    fi
}

# Start AP
start_ap() {
    log "Starting Argos AP..."
    
    # Find adapter
    if ! find_ap_adapter; then
        exit 1
    fi
    
    # Check if interface exists
    if ip link show "$INTERFACE" &>/dev/null; then
        log "Interface $INTERFACE already exists"
    else
        log "Creating interface $INTERFACE on $PHY_DEVICE"
        iw phy "$PHY_DEVICE" interface add "$INTERFACE" type __ap
    fi
    
    # Configure interface
    log "Configuring $INTERFACE with IP $IP_ADDRESS"
    ip link set "$INTERFACE" up
    ip addr flush dev "$INTERFACE"
    ip addr add "$IP_ADDRESS/24" dev "$INTERFACE"
    
    # Kill any existing hostapd
    killall hostapd 2>/dev/null || true
    sleep 1
    
    # Start hostapd
    log "Starting hostapd..."
    hostapd -B "$HOSTAPD_CONF"
    
    # Simple DHCP with dnsmasq if available
    if command -v dnsmasq &>/dev/null; then
        log "Starting dnsmasq for DHCP..."
        killall dnsmasq 2>/dev/null || true
        sleep 1
        dnsmasq --interface="$INTERFACE" \
                --bind-interfaces \
                --dhcp-range="$DHCP_RANGE,12h" \
                --dhcp-option=3,"$IP_ADDRESS" \
                --dhcp-option=6,"8.8.8.8,8.8.4.4" \
                --except-interface=lo \
                --pid-file=/var/run/dnsmasq-ap.pid \
                --conf-file=/dev/null
    fi
    
    log "Argos AP started successfully"
}

# Stop AP
stop_ap() {
    log "Stopping Argos AP..."
    
    # Stop services
    killall hostapd 2>/dev/null || true
    killall dnsmasq 2>/dev/null || true
    
    # Don't delete the interface - just bring it down
    if ip link show "$INTERFACE" &>/dev/null; then
        ip link set "$INTERFACE" down
        # Keep the interface for faster restart
        log "Interface $INTERFACE brought down but preserved"
    fi
    
    log "Argos AP stopped"
}

# Status check
status_ap() {
    echo "=== Argos AP Status ==="
    
    # Check interface
    if ip link show "$INTERFACE" &>/dev/null; then
        echo "Interface: $INTERFACE is UP"
        ip addr show "$INTERFACE" | grep inet
    else
        echo "Interface: $INTERFACE is DOWN"
    fi
    
    # Check hostapd
    if pgrep hostapd &>/dev/null; then
        echo "Hostapd: RUNNING"
        # Show SSID
        iw dev "$INTERFACE" info 2>/dev/null | grep ssid
    else
        echo "Hostapd: NOT RUNNING"
    fi
    
    # Check DHCP
    if pgrep dnsmasq &>/dev/null; then
        echo "DHCP: RUNNING"
    else
        echo "DHCP: NOT RUNNING"
    fi
}

# Main script
case "${1:-status}" in
    start)
        start_ap
        ;;
    stop)
        stop_ap
        ;;
    restart)
        stop_ap
        sleep 2
        start_ap
        ;;
    status)
        status_ap
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac