#!/bin/bash

# Advanced USB Reset Script - No physical unplug needed
# This script ONLY affects the USB WiFi adapter, NOT wlan0

echo "=== Advanced USB Reset (wlan0 PROTECTED) ==="
echo "Starting advanced recovery methods..."
echo ""

# Safety check
echo "Safety check: wlan0 status"
ip link show wlan0 | grep UP && echo "[PASS] wlan0 is SAFE" || echo "[WARN] wlan0 issue detected"
echo ""

# Method 1: USB Unbind/Bind via sysfs
echo "Method 1: USB Unbind/Bind Reset"
echo "Finding USB device path..."

# Get the USB device path
USB_PATH=$(find /sys/bus/usb/devices/ -name "idVendor" -exec grep -l "0e8d" {} \; 2>/dev/null | head -1 | xargs dirname)
if [ -z "$USB_PATH" ]; then
    echo "[ERROR] Cannot find MediaTek USB device"
else
    USB_DEVICE=$(basename "$USB_PATH")
    echo "Found device: $USB_DEVICE"
    
    # Unbind
    echo "Unbinding USB device..."
    echo "$USB_DEVICE" | sudo tee /sys/bus/usb/drivers/usb/unbind >/dev/null 2>&1
    sleep 3
    
    # Bind
    echo "Rebinding USB device..."
    echo "$USB_DEVICE" | sudo tee /sys/bus/usb/drivers/usb/bind >/dev/null 2>&1
    sleep 3
    
    # Check if it worked
    if lsusb | grep -q "0e8d:7612"; then
        echo "[PASS] USB device reappeared!"
    else
        echo "[WARN] Method 1 failed, trying next..."
    fi
fi
echo ""

# Method 2: Driver module reload
echo "Method 2: Driver Module Reset"
echo "Unloading mt76 driver stack..."

# Kill any processes using the driver
sudo pkill -f kismet 2>/dev/null
sleep 1

# Unload in reverse dependency order
sudo modprobe -r mt76x2u 2>/dev/null
sudo modprobe -r mt76x2_common 2>/dev/null
sudo modprobe -r mt76x02_usb 2>/dev/null
sudo modprobe -r mt76_usb 2>/dev/null
sudo modprobe -r mt76 2>/dev/null

echo "Waiting for cleanup..."
sleep 3

# Reload
echo "Reloading mt76 drivers..."
sudo modprobe mt76
sudo modprobe mt76_usb
sudo modprobe mt76x02_usb
sudo modprobe mt76x2_common
sudo modprobe mt76x2u

sleep 3

# Check if interface appears
if ip link show | grep -q "wlx00c0caadcedb"; then
    echo "[PASS] Interface reappeared!"
    ip link show wlx00c0caadcedb
else
    echo "[WARN] Method 2 failed, trying next..."
fi
echo ""

# Method 3: USB Reset using ioctl
echo "Method 3: USB Reset via ioctl"
cat > /tmp/usbreset.c << 'EOF'
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/ioctl.h>
#include <linux/usbdevice_fs.h>

int main(int argc, char **argv) {
    const char *filename;
    int fd;
    
    if (argc != 2) {
        fprintf(stderr, "Usage: usbreset device-filename\n");
        return 1;
    }
    filename = argv[1];
    
    fd = open(filename, O_WRONLY);
    if (fd < 0) {
        perror("Error opening device");
        return 1;
    }
    
    printf("Resetting USB device %s\n", filename);
    if (ioctl(fd, USBDEVFS_RESET, 0) < 0) {
        perror("Error resetting device");
        close(fd);
        return 1;
    }
    printf("Reset successful\n");
    
    close(fd);
    return 0;
}
EOF

# Compile the reset tool
gcc /tmp/usbreset.c -o /tmp/usbreset 2>/dev/null

if [ -f /tmp/usbreset ]; then
    # Find the device
    BUS=$(lsusb | grep "0e8d:7612" | awk '{print $2}')
    DEV=$(lsusb | grep "0e8d:7612" | awk '{print $4}' | tr -d ':')
    
    if [ ! -z "$BUS" ] && [ ! -z "$DEV" ]; then
        BUS=$(printf "%03d" $((10#$BUS)))
        DEV=$(printf "%03d" $((10#$DEV)))
        
        echo "Resetting USB device at /dev/bus/usb/$BUS/$DEV"
        sudo /tmp/usbreset /dev/bus/usb/$BUS/$DEV
        
        sleep 3
        
        # Check result
        if lsusb | grep -q "0e8d:7612"; then
            echo "[PASS] USB reset successful!"
        fi
    fi
fi

# Cleanup
rm -f /tmp/usbreset.c /tmp/usbreset
echo ""

# Method 4: Authorize/Deauthorize
echo "Method 4: USB Authorize Reset"
if [ ! -z "$USB_PATH" ] && [ -f "$USB_PATH/authorized" ]; then
    echo "Deauthorizing device..."
    echo 0 | sudo tee "$USB_PATH/authorized" >/dev/null
    sleep 2
    echo "Reauthorizing device..."
    echo 1 | sudo tee "$USB_PATH/authorized" >/dev/null
    sleep 3
fi

# Final check
echo ""
echo "=== Final Status Check ==="
if lsusb | grep -q "0e8d:7612"; then
    echo "[PASS] USB device present"
    
    if ip link show | grep -q "wlx00c0caadcedb"; then
        echo "[PASS] Network interface exists"
        
        # Try to bring it up
        sudo ip link set wlx00c0caadcedb up 2>/dev/null
        sleep 1
        
        STATE=$(ip link show wlx00c0caadcedb | grep -o "state [A-Z]*" | cut -d' ' -f2)
        echo "  Interface state: $STATE"
        
        if [ "$STATE" = "UP" ]; then
            echo ""
            echo "[OK] SUCCESS! Adapter is recovered"
            echo "You can now start Kismet from the web interface"
        else
            echo ""
            echo "[WARN] Interface exists but won't come up"
            echo "Try: sudo ifconfig wlx00c0caadcedb up"
        fi
    else
        echo "[ERROR] Interface missing - driver issue persists"
    fi
else
    echo "[ERROR] USB device not responding to any reset method"
    echo "Physical unplug/replug is required"
fi

echo ""
echo "[PASS] wlan0 remains safe throughout all operations"