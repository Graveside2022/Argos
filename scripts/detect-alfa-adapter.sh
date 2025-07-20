#!/bin/bash

# Generic Alfa WiFi Adapter Detection Script
# Supports multiple Alfa adapter models dynamically

echo "=== Alfa WiFi Adapter Detection ==="
echo "Date: $(date)"
echo ""

# Common Alfa adapter USB IDs
declare -A ALFA_ADAPTERS=(
    ["0bda:8187"]="Alfa AWUS036H (RTL8187)"
    ["148f:3070"]="Alfa AWUS036NH (RT3070)"
    ["148f:5370"]="Alfa AWUS036NEH (RT5370)"
    ["0bda:8812"]="Alfa AWUS036AC/ACH (RTL8812AU)"
    ["0bda:8813"]="Alfa AWUS036ACS (RTL8813AU)"
    ["2357:010c"]="Alfa AWUS036ACM (MT7612U)"
    ["0e8d:7612"]="Generic MT7612U (Various brands)"
    ["148f:7601"]="Alfa AWUS036N (MT7601U)"
    ["148f:5572"]="Alfa AWUS052NHS (RT5572)"
    ["0cf3:9271"]="Alfa AWUS036NHA (AR9271)"
)

# Function to check for USB devices
check_usb_devices() {
    if ! command -v lsusb &> /dev/null; then
        echo "❌ lsusb command not found. Using alternative method..."
        # Try to read from sysfs
        for device in /sys/bus/usb/devices/*/idVendor; do
            if [ -f "$device" ]; then
                vendor=$(cat "$device" 2>/dev/null)
                product=$(cat "${device%idVendor}idProduct" 2>/dev/null)
                if [ -n "$vendor" ] && [ -n "$product" ]; then
                    usb_id="${vendor}:${product}"
                    for alfa_id in "${!ALFA_ADAPTERS[@]}"; do
                        if [ "$usb_id" = "$alfa_id" ]; then
                            echo "✓ Found: ${ALFA_ADAPTERS[$alfa_id]} (USB ID: $usb_id)"
                            return 0
                        fi
                    done
                fi
            fi
        done
        return 1
    else
        # Use lsusb to check for Alfa adapters
        for usb_id in "${!ALFA_ADAPTERS[@]}"; do
            if lsusb | grep -q "$usb_id"; then
                echo "✓ Found: ${ALFA_ADAPTERS[$usb_id]} (USB ID: $usb_id)"
                USB_INFO=$(lsusb | grep "$usb_id")
                echo "   Full info: $USB_INFO"
                return 0
            fi
        done
        return 1
    fi
}

# Function to find wireless interfaces (excluding wlan0)
find_wireless_interfaces() {
    echo ""
    echo "Checking for wireless interfaces (excluding wlan0)..."
    
    found_interfaces=()
    
    # Check all network interfaces
    for iface in /sys/class/net/*; do
        iface_name=$(basename "$iface")
        
        # Skip non-wireless interfaces and wlan0
        if [ "$iface_name" = "lo" ] || [ "$iface_name" = "eth0" ] || [ "$iface_name" = "wlan0" ]; then
            continue
        fi
        
        # Check if it's a wireless interface
        if [ -d "$iface/wireless" ] || [ -d "$iface/phy80211" ]; then
            echo "✓ Found wireless interface: $iface_name"
            
            # Get MAC address
            if [ -f "$iface/address" ]; then
                mac=$(cat "$iface/address")
                echo "   MAC: $mac"
            fi
            
            # Get state
            if [ -f "$iface/operstate" ]; then
                state=$(cat "$iface/operstate")
                echo "   State: $state"
            fi
            
            found_interfaces+=("$iface_name")
        fi
    done
    
    if [ ${#found_interfaces[@]} -eq 0 ]; then
        echo "❌ No external wireless interfaces found"
        return 1
    else
        echo ""
        echo "Available interfaces for Kismet: ${found_interfaces[*]}"
        export ALFA_INTERFACE="${found_interfaces[0]}"
        echo "Primary interface selected: $ALFA_INTERFACE"
        return 0
    fi
}

# Main detection logic
echo "1. Checking for Alfa USB adapters..."
if check_usb_devices; then
    echo ""
    echo "2. Looking for corresponding network interfaces..."
    if find_wireless_interfaces; then
        echo ""
        echo "✅ Alfa adapter ready for use!"
        echo ""
        echo "To use with Kismet, add this source:"
        echo "   source=$ALFA_INTERFACE:type=linuxwifi"
        exit 0
    else
        echo ""
        echo "⚠️  Alfa adapter found but no interface detected."
        echo "   The driver might not be loaded or the device needs to be reset."
        exit 1
    fi
else
    echo "❌ No Alfa adapters detected"
    echo ""
    echo "Supported Alfa models:"
    for usb_id in "${!ALFA_ADAPTERS[@]}"; do
        echo "   - ${ALFA_ADAPTERS[$usb_id]}"
    done
    exit 1
fi