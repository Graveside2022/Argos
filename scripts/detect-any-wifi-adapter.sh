#!/bin/bash

# Generic WiFi Adapter Detection Script
# Detects ANY WiFi adapter (not just Alfa)

echo "=== Generic WiFi Adapter Detection ==="
echo "Date: $(date)"
echo ""

# Function to check if interface supports monitor mode
supports_monitor_mode() {
    local iface=$1
    
    # Check using iw if available
    if command -v iw &> /dev/null; then
        if iw list 2>/dev/null | grep -A 10 "Wiphy.*$iface" | grep -q "monitor"; then
            return 0
        fi
    fi
    
    # Check using iwconfig if available
    if command -v iwconfig &> /dev/null; then
        if iwconfig "$iface" 2>&1 | grep -q "Mode:Monitor"; then
            return 0
        fi
    fi
    
    # Assume it might support monitor mode if we can't check
    return 0
}

# Find all wireless interfaces
echo "Scanning for WiFi adapters..."
echo ""

found_adapters=()
protected_interfaces=("wlan0")  # Interfaces to protect

# Check /sys/class/net for all network interfaces
for iface_path in /sys/class/net/*; do
    iface=$(basename "$iface_path")
    
    # Skip non-wireless interfaces
    if [ "$iface" = "lo" ] || [ "$iface" = "eth0" ]; then
        continue
    fi
    
    # Check if it's a wireless interface
    if [ -d "$iface_path/wireless" ] || [ -d "$iface_path/phy80211" ]; then
        echo "Found wireless interface: $iface"
        
        # Get details
        if [ -f "$iface_path/address" ]; then
            mac=$(cat "$iface_path/address")
            echo "   MAC Address: $mac"
        fi
        
        if [ -f "$iface_path/operstate" ]; then
            state=$(cat "$iface_path/operstate")
            echo "   State: $state"
        fi
        
        # Check if it's a USB adapter
        if readlink "$iface_path" | grep -q "usb"; then
            echo "   Type: USB WiFi Adapter"
            
            # Try to get USB info
            usb_path=$(readlink -f "$iface_path/device")
            if [ -f "$usb_path/../idVendor" ] && [ -f "$usb_path/../idProduct" ]; then
                vendor=$(cat "$usb_path/../idVendor" 2>/dev/null)
                product=$(cat "$usb_path/../idProduct" 2>/dev/null)
                echo "   USB ID: $vendor:$product"
            fi
        else
            echo "   Type: Internal WiFi"
        fi
        
        # Check if it's protected
        if [[ " ${protected_interfaces[@]} " =~ " ${iface} " ]]; then
            echo "   ⚠️  PROTECTED: This interface is reserved for system use"
        else
            # Check monitor mode support
            if supports_monitor_mode "$iface"; then
                echo "   ✓ Monitor mode capable"
            fi
            found_adapters+=("$iface")
        fi
        
        echo ""
    fi
done

echo "================================"
echo "Summary:"
echo ""

if [ ${#found_adapters[@]} -eq 0 ]; then
    echo "❌ No available WiFi adapters found for monitoring"
    echo "   (wlan0 is protected for SSH access)"
    exit 1
else
    echo "✓ Found ${#found_adapters[@]} available WiFi adapter(s):"
    for adapter in "${found_adapters[@]}"; do
        echo "   - $adapter"
    done
    echo ""
    echo "Recommended for Kismet: ${found_adapters[0]}"
    echo ""
    echo "To use with Kismet:"
    echo "   sudo kismet -c ${found_adapters[0]}:type=linuxwifi"
fi