#!/bin/bash
# Kismet Clean Restart Script
# Fixes the "works after reboot but not after restart" issue

echo "🔄 Stopping Kismet cleanly..."
sudo pkill -TERM kismet
sleep 3
sudo pkill -KILL kismet

echo "🗑️  Removing monitor interface..."
sudo iw dev kismon0 del 2>/dev/null || true

echo "🔧 Resetting USB wireless adapter..."
# Reset the MT7612U USB adapter
sudo ip link set wlx00c0caadcedb down
sleep 2

# Force USB device reset by rebinding driver
USB_DEVICE=$(lsusb | grep "0e8d:7612" | cut -d' ' -f2,4 | tr -d ':')
if [ ! -z "$USB_DEVICE" ]; then
    BUS=$(echo $USB_DEVICE | cut -d' ' -f1)
    DEV=$(echo $USB_DEVICE | cut -d' ' -f2)
    echo "Found MT7612U at Bus $BUS Device $DEV"
    
    # Unbind and rebind the USB device
    sudo sh -c "echo '$BUS-$DEV' > /sys/bus/usb/drivers/usb/unbind" 2>/dev/null || true
    sleep 2
    sudo sh -c "echo '$BUS-$DEV' > /sys/bus/usb/drivers/usb/bind" 2>/dev/null || true
    sleep 3
fi

echo "⬆️  Bringing interface back up..."
sudo ip link set wlx00c0caadcedb up
sleep 2

echo "🚀 Starting Kismet..."
sudo kismet --no-ncurses-wrapper &

echo "✅ Kismet restart complete!"
echo "Monitor interface should be recreated as kismon0"