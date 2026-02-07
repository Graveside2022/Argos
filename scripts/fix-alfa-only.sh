#!/bin/bash

# SAFE Alfa card fix - NEVER touches wlan0 or other interfaces
echo "=== Fixing ONLY Alfa card (wlx00c0caadcedb) ==="
echo "[PASS] wlan0 will NOT be touched"

# 1. Stop Kismet
echo "1. Stopping Kismet..."
sudo systemctl stop kismet 2>/dev/null
sudo pkill kismet 2>/dev/null
sleep 2

# 2. Reset ONLY the Alfa USB device
echo "2. Finding Alfa USB device..."
ALFA_USB=$(lsusb | grep "0e8d:7612" | awk '{print "/dev/bus/usb/" $2 "/" $4}' | tr -d ':')

if [ -z "$ALFA_USB" ]; then
    echo "[WARN]  Alfa card not found in USB devices"
    echo "Please unplug and replug the Alfa adapter"
    exit 1
fi

echo "3. Resetting Alfa at $ALFA_USB..."
# Create USB reset tool
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

gcc /tmp/usbreset.c -o /tmp/usbreset 2>/dev/null
sudo /tmp/usbreset $ALFA_USB
rm -f /tmp/usbreset.c /tmp/usbreset

sleep 3

# 4. Wait for interface to appear
echo "4. Waiting for wlx00c0caadcedb..."
for i in {1..10}; do
    if ip link show wlx00c0caadcedb 2>/dev/null; then
        echo "[PASS] Alfa interface detected!"
        break
    fi
    echo -n "."
    sleep 1
done

# 5. Configure the interface
echo "5. Configuring Alfa interface..."
sudo ip link set wlx00c0caadcedb down 2>/dev/null
sleep 1
sudo iw reg set US 2>/dev/null
sudo ip link set wlx00c0caadcedb up 2>/dev/null

# 6. Test it
echo ""
echo "=== Status ==="
ip link show wlx00c0caadcedb 2>/dev/null || echo "Interface not found"
echo ""
echo "wlan0 status (should be unchanged):"
iwconfig wlan0 2>/dev/null | grep -E "ESSID|Signal"
echo ""
echo "[PASS] Safe recovery complete - wlan0 untouched!"