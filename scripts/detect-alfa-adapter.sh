#!/bin/bash

# External WiFi Adapter Detection Script
# Detects USB WiFi adapters (Alfa, etc.) for Kismet
#
# SAFETY: wlan0 is the Pi's built-in Broadcom WiFi (brcmfmac).
# Kismet must NEVER run on wlan0 — putting it in monitor mode kills
# network connectivity and can crash the system.
# Only external USB adapters (wlan1, wlan2, etc.) are valid targets.

echo "=== External WiFi Adapter Detection ==="
echo "Date: $(date)"
echo ""

# Built-in interface that must NEVER be used for Kismet
BUILTIN_INTERFACE="wlan0"

# Known external WiFi adapter USB IDs
declare -A KNOWN_ADAPTERS=(
    ["0e8d:7961"]="Alfa AWUS036AXML (MediaTek MT7921U)"
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

# Function to check for known USB WiFi adapters
check_usb_devices() {
    if ! command -v lsusb &> /dev/null; then
        echo "lsusb not available, skipping USB check"
        return 1
    fi

    for usb_id in "${!KNOWN_ADAPTERS[@]}"; do
        if lsusb | grep -q "$usb_id"; then
            echo "Found USB adapter: ${KNOWN_ADAPTERS[$usb_id]} ($usb_id)"
            return 0
        fi
    done
    return 1
}

# Function to find EXTERNAL wireless interfaces (never wlan0)
find_external_wifi() {
    echo ""
    echo "Scanning for external wireless interfaces..."
    echo "(wlan0 = Pi built-in WiFi, always skipped)"

    found_interfaces=()

    for iface in /sys/class/net/*; do
        iface_name=$(basename "$iface")

        # Skip everything that isn't a wireless interface
        [ -d "$iface/wireless" ] || [ -d "$iface/phy80211" ] || continue

        # SAFETY: Never use the built-in WiFi or its monitor interface
        if [ "$iface_name" = "$BUILTIN_INTERFACE" ] || [ "$iface_name" = "${BUILTIN_INTERFACE}mon" ]; then
            echo "   Skipping $iface_name (built-in WiFi - protected)"
            continue
        fi

        # Skip other monitor mode interfaces (e.g. wlan1mon)
        echo "$iface_name" | grep -q "mon$" && continue

        driver=$(readlink "/sys/class/net/$iface_name/device/driver" 2>/dev/null | xargs basename 2>/dev/null)
        mac=$(cat "$iface/address" 2>/dev/null)
        state=$(cat "$iface/operstate" 2>/dev/null)
        echo "   Found: $iface_name (driver: $driver, MAC: $mac, state: $state)"
        found_interfaces+=("$iface_name")
    done

    # If KISMET_INTERFACE is set, validate it's not the built-in
    if [ -n "$KISMET_INTERFACE" ]; then
        if [ "$KISMET_INTERFACE" = "$BUILTIN_INTERFACE" ]; then
            echo ""
            echo "BLOCKED: KISMET_INTERFACE=$KISMET_INTERFACE is the built-in WiFi."
            echo "   Refusing to use it. Set KISMET_INTERFACE to an external adapter."
            return 1
        fi
        if printf '%s\n' "${found_interfaces[@]}" | grep -qx "$KISMET_INTERFACE"; then
            export ALFA_INTERFACE="$KISMET_INTERFACE"
            echo ""
            echo "Primary interface selected: $ALFA_INTERFACE (from KISMET_INTERFACE env)"
            return 0
        fi
    fi

    if [ ${#found_interfaces[@]} -eq 0 ]; then
        return 1
    fi

    export ALFA_INTERFACE="${found_interfaces[0]}"
    echo ""
    echo "Primary interface selected: $ALFA_INTERFACE"
    return 0
}

# --- Main ---
echo "1. Checking for USB WiFi adapters..."
check_usb_devices || echo "   No known USB WiFi adapter detected"

echo ""
echo "2. Looking for external wireless interface..."
if find_external_wifi; then
    echo ""
    echo "Adapter ready: source=$ALFA_INTERFACE:type=linuxwifi"
    exit 0
else
    echo ""
    echo "ERROR: No external WiFi adapter found."
    echo ""
    echo "   The Alfa card is not plugged in or not recognized."
    echo "   - Check USB connections"
    echo "   - Run 'lsusb' to see connected devices"
    echo "   - The adapter should appear as wlan1"
    echo ""
    echo "   wlan0 is the Pi's built-in WiFi and will NOT be used."
    exit 1
fi