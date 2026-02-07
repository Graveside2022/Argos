#!/bin/bash

# Advanced MT76x2u adapter recovery script
echo "=== MT76x2u Adapter Recovery ==="

# Stop all services that might be using the adapter
echo "1. Stopping services..."
sudo systemctl stop kismet 2>/dev/null
sudo systemctl stop NetworkManager 2>/dev/null
sudo pkill -f airmon-ng 2>/dev/null
sudo pkill -f airodump-ng 2>/dev/null

# Remove the kernel module
echo "2. Removing mt76 modules..."
sudo modprobe -r mt76x2u 2>/dev/null
sudo modprobe -r mt76x2_common 2>/dev/null
sudo modprobe -r mt76x02_usb 2>/dev/null
sudo modprobe -r mt76_usb 2>/dev/null
sudo modprobe -r mt76 2>/dev/null

sleep 2

# Reset USB device using usbreset
echo "3. Resetting USB device..."
# Create a simple USB reset program
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
        return 1;
    }
    printf("Reset successful\n");
    
    close(fd);
    return 0;
}
EOF

# Compile the reset tool
gcc /tmp/usbreset.c -o /tmp/usbreset 2>/dev/null

# Find and reset the device
BUS=$(lsusb | grep "0e8d:7612" | awk '{print $2}')
DEV=$(lsusb | grep "0e8d:7612" | awk '{print $4}' | tr -d ':')

if [ ! -z "$BUS" ] && [ ! -z "$DEV" ]; then
    # Ensure proper formatting
    BUS=$(printf "%03d" $((10#$BUS)))
    DEV=$(printf "%03d" $((10#$DEV)))
    
    echo "Resetting USB device at /dev/bus/usb/$BUS/$DEV"
    sudo /tmp/usbreset /dev/bus/usb/$BUS/$DEV 2>/dev/null || echo "USB reset tool failed, trying alternate method..."
    
    # Alternative: unbind and rebind
    echo "4. Unbinding and rebinding USB device..."
    for usbdev in /sys/bus/usb/devices/*; do
        if [ -e "$usbdev/idVendor" ] && [ -e "$usbdev/idProduct" ]; then
            vendor=$(cat "$usbdev/idVendor" 2>/dev/null)
            product=$(cat "$usbdev/idProduct" 2>/dev/null)
            if [ "$vendor" = "0e8d" ] && [ "$product" = "7612" ]; then
                device=$(basename "$usbdev")
                echo "Found device at $device"
                echo "$device" | sudo tee /sys/bus/usb/drivers/usb/unbind >/dev/null 2>&1
                sleep 2
                echo "$device" | sudo tee /sys/bus/usb/drivers/usb/bind >/dev/null 2>&1
                break
            fi
        fi
    done
fi

sleep 3

# Reload the driver with specific parameters
echo "5. Loading mt76 driver with parameters..."
sudo modprobe mt76
sudo modprobe mt76_usb
sudo modprobe mt76x02_usb
sudo modprobe mt76x2_common
sudo modprobe mt76x2u

sleep 2

# Wait for interface
echo "6. Waiting for interface..."
for i in {1..15}; do
    if ip link show 2>/dev/null | grep -q "wlx00c0caadcedb"; then
        echo "[PASS] Interface detected!"
        
        # Try to configure it
        echo "7. Configuring interface..."
        sudo ip link set wlx00c0caadcedb down
        sleep 1
        
        # Set regulatory domain
        sudo iw reg set US 2>/dev/null
        
        # Try to bring it up
        sudo ip link set wlx00c0caadcedb up
        sleep 2
        
        # Check status
        if iwconfig wlx00c0caadcedb 2>/dev/null | grep -q "Mode:"; then
            echo "[PASS] Adapter is responding!"
            iwconfig wlx00c0caadcedb 2>/dev/null | head -5
            
            # Test scanning
            echo ""
            echo "8. Testing WiFi scanning..."
            sudo iw dev wlx00c0caadcedb scan 2>&1 | head -5 || echo "Scanning failed, but adapter is up"
        else
            echo "[WARN]  Adapter not fully functional"
        fi
        
        break
    fi
    echo -n "."
    sleep 1
done

# Cleanup
rm -f /tmp/usbreset.c /tmp/usbreset

# Check final status
echo ""
echo "=== Final Status ==="
ip link show wlx00c0caadcedb 2>/dev/null || echo "Interface not found"
echo ""
echo "Recent kernel messages:"
sudo dmesg | grep -E "(mt76|wlx00c0caadcedb)" | tail -5

echo ""
echo "Recovery complete. You can now try starting Kismet."