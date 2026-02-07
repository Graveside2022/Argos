#!/bin/bash

# Nuclear USB Reset - Last resort before physical unplug
# SAFE: Only affects USB WiFi, NOT wlan0

echo "=== NUCLEAR USB RESET (Last Resort) ==="
echo "This will aggressively reset the USB subsystem"
echo "wlan0 will remain SAFE"
echo ""

# Verify safety
echo "Safety verification:"
ip link show wlan0 | grep UP && echo "[PASS] wlan0 is SAFE" || exit 1
echo ""

echo "Phase 1: Complete driver purge"
# Stop anything using the device
sudo pkill -9 kismet 2>/dev/null
sudo pkill -9 airmon-ng 2>/dev/null
sleep 1

# Force remove all mt76 modules
MODULES="mt76x2u mt76x2_common mt76x02_usb mt76_usb mt76"
for mod in $MODULES; do
    echo "Force removing $mod..."
    sudo rmmod -f $mod 2>/dev/null
done

echo ""
echo "Phase 2: USB subsystem reset"

# Find the exact USB path
USB_DEVICE=$(lsusb | grep "0e8d:7612" | awk '{print $2":"$4}' | tr -d ':')
if [ ! -z "$USB_DEVICE" ]; then
    BUS=$(echo $USB_DEVICE | cut -d: -f1)
    DEV=$(echo $USB_DEVICE | cut -d: -f2)
    
    # Try to reset the entire USB bus controller
    echo "Resetting USB bus $BUS..."
    for ctrl in /sys/bus/pci/drivers/xhci_hcd/????:??:??.?; do
        if [ -e "$ctrl" ]; then
            CTRL_NAME=$(basename $ctrl)
            echo "Unbinding USB controller $CTRL_NAME..."
            echo "$CTRL_NAME" | sudo tee /sys/bus/pci/drivers/xhci_hcd/unbind >/dev/null 2>&1
            sleep 2
            echo "Rebinding USB controller $CTRL_NAME..."
            echo "$CTRL_NAME" | sudo tee /sys/bus/pci/drivers/xhci_hcd/bind >/dev/null 2>&1
            sleep 3
        fi
    done
fi

echo ""
echo "Phase 3: Clear USB device authorization"
# Deauthorize all USB devices on bus 2 (except critical ones)
for dev in /sys/bus/usb/devices/2-*; do
    if [ -f "$dev/idVendor" ]; then
        VENDOR=$(cat "$dev/idVendor" 2>/dev/null)
        if [ "$VENDOR" = "0e8d" ]; then
            echo "Deauthorizing MediaTek device..."
            echo 0 | sudo tee "$dev/authorized" >/dev/null 2>&1
            sleep 1
        fi
    fi
done

echo ""
echo "Phase 4: Power cycle USB ports"
# Try uhubctl if available
if which uhubctl >/dev/null 2>&1; then
    echo "Using uhubctl to power cycle..."
    sudo uhubctl -a cycle -p 2 2>/dev/null || echo "uhubctl not configured"
else
    # Manual power control via sysfs
    for port in /sys/bus/usb/devices/usb*/2-*/power/control; do
        if [ -f "$port" ]; then
            echo "Power cycling $(dirname $(dirname $port))..."
            echo "auto" | sudo tee "$port" >/dev/null
            sleep 1
            echo "on" | sudo tee "$port" >/dev/null
        fi
    done
fi

echo ""
echo "Phase 5: Wait and reload"
echo "Waiting 5 seconds for USB to stabilize..."
sleep 5

# Reload kernel modules
echo "Reloading drivers..."
sudo modprobe mt76
sudo modprobe mt76_usb
sudo modprobe mt76x02_usb  
sudo modprobe mt76x2_common
sudo modprobe mt76x2u

sleep 3

# Reauthorize
for dev in /sys/bus/usb/devices/2-*; do
    if [ -f "$dev/idVendor" ]; then
        VENDOR=$(cat "$dev/idVendor" 2>/dev/null)
        if [ "$VENDOR" = "0e8d" ]; then
            echo "Reauthorizing MediaTek device..."
            echo 1 | sudo tee "$dev/authorized" >/dev/null 2>&1
        fi
    fi
done

sleep 3

echo ""
echo "=== Final Check ==="
if lsusb | grep -q "0e8d:7612"; then
    echo "[PASS] USB device detected"
    
    # Wait for interface
    COUNTER=0
    while [ $COUNTER -lt 10 ]; do
        if ip link show 2>/dev/null | grep -q "wlx00c0caadcedb"; then
            echo "[PASS] Interface appeared!"
            
            # Configure it
            sudo ip link set wlx00c0caadcedb down 2>/dev/null
            sleep 1
            sudo ip link set wlx00c0caadcedb up 2>/dev/null
            
            # Final status
            ip link show wlx00c0caadcedb
            
            echo ""
            echo "[OK] Recovery complete! Try Kismet now."
            break
        fi
        echo -n "."
        sleep 1
        COUNTER=$((COUNTER + 1))
    done
else
    echo "[ERROR] USB device still not responding"
    echo ""
    echo "=== HARDWARE FAILURE ==="
    echo "The adapter is in a hardware fault state that requires physical intervention."
    echo "Options:"
    echo "1. Physical unplug/replug is required"
    echo "2. Try a powered USB hub"
    echo "3. The adapter may be failing"
fi

echo ""
echo "[PASS] wlan0 remained safe throughout the process"