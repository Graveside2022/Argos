#!/bin/bash
# Configure USB settings to prevent power management issues

echo "Configuring USB persistence settings..."

# Disable USB autosuspend for all USB devices
echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend

# Disable USB power management for the wireless adapter
for device in /sys/bus/usb/devices/*/product; do
    if grep -q "Wireless\|WiFi\|802.11" "$device" 2>/dev/null; then
        device_path=$(dirname "$device")
        echo on | sudo tee "$device_path/power/control" 2>/dev/null
        echo "Disabled power management for: $(cat "$device")"
    fi
done

# Add persistent udev rule
cat << 'EOF' | sudo tee /etc/udev/rules.d/99-usb-wifi-power.rules
# Disable USB power management for WiFi adapters
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="0e8d", ATTR{idProduct}=="7961", ATTR{power/control}="on"
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="0e8d", ATTR{idProduct}=="7612", ATTR{power/control}="on"
EOF

echo "USB persistence configured. Changes will persist across reboots."