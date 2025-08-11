#!/bin/bash

# Comprehensive ALFA AWUS036AXML Boot Reliability Script
# Ensures the MT7921U adapter is detected and working after every boot

echo "=== ALFA Boot Reliability Configuration ==="
echo "Setting up multiple safeguards for reliable ALFA detection"
echo ""

# 1. Ensure kernel modules load at boot
echo "Step 1: Configuring kernel modules to load at boot..."
sudo tee /etc/modules-load.d/mt7921u.conf > /dev/null << 'EOF'
# MediaTek MT7921U modules for ALFA AWUS036AXML
mt76
mt76_usb
mt76_connac_lib
mt792x_lib
mt792x_usb
mt7921_common
mt7921u
EOF
echo "✓ Kernel modules configured"

# 2. Create modprobe configuration for module options
echo ""
echo "Step 2: Setting module parameters..."
sudo tee /etc/modprobe.d/mt7921u-options.conf > /dev/null << 'EOF'
# Options for MT7921U adapter reliability
options mt7921u disable_usb_sg=1
options mt76_usb disable_usb_sg=1
# Disable power management for stability
options mt7921_common power_save=0
EOF
echo "✓ Module parameters set"

# 3. Create udev rule for adapter detection
echo ""
echo "Step 3: Creating udev rule for ALFA detection..."
sudo tee /etc/udev/rules.d/90-alfa-mt7921u.rules > /dev/null << 'EOF'
# ALFA AWUS036AXML (MT7921U) detection and configuration
# MediaTek MT7921U chipset
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="mt7921u", ATTR{address}=="be:e1:d6:9f:a8:11", RUN+="/usr/local/bin/alfa-detected.sh"

# Generic rule for any MT7921U device
SUBSYSTEM=="usb", ATTRS{idVendor}=="0e8d", ATTRS{idProduct}=="7961", RUN+="/usr/local/bin/alfa-usb-detected.sh"

# Set permissions and power
SUBSYSTEM=="usb", ATTRS{idVendor}=="0e8d", ATTRS{idProduct}=="7961", TEST=="power/control", ATTR{power/control}="on"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0e8d", ATTRS{idProduct}=="7961", TEST=="power/autosuspend", ATTR{power/autosuspend}="-1"
EOF
echo "✓ Udev rules created"

# 4. Create detection scripts
echo ""
echo "Step 4: Creating detection notification scripts..."

sudo tee /usr/local/bin/alfa-detected.sh > /dev/null << 'EOF'
#!/bin/bash
# Script run when ALFA network interface is detected
echo "$(date): ALFA AWUS036AXML network interface detected" >> /var/log/alfa-boot.log
# Disable power management on the interface
iw dev wlxbee1d69fa811 set power_save off 2>/dev/null
EOF
sudo chmod +x /usr/local/bin/alfa-detected.sh

sudo tee /usr/local/bin/alfa-usb-detected.sh > /dev/null << 'EOF'
#!/bin/bash
# Script run when ALFA USB device is detected
echo "$(date): ALFA AWUS036AXML USB device detected" >> /var/log/alfa-boot.log
# Give kernel time to initialize the device
sleep 2
# Force module reload if interface doesn't appear
if ! ip link show | grep -q "wlxbee1d69fa811"; then
    echo "$(date): Interface not found, reloading modules" >> /var/log/alfa-boot.log
    modprobe -r mt7921u mt792x_usb mt7921_common mt792x_lib mt76_connac_lib mt76_usb mt76
    sleep 1
    modprobe mt7921u
fi
EOF
sudo chmod +x /usr/local/bin/alfa-usb-detected.sh

echo "✓ Detection scripts created"

# 5. Create systemd service for boot-time verification
echo ""
echo "Step 5: Creating boot verification service..."

sudo tee /etc/systemd/system/alfa-boot-verify.service > /dev/null << 'EOF'
[Unit]
Description=ALFA AWUS036AXML Boot Verification
After=network-pre.target usb.target
Before=network.target
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/verify-alfa-boot.sh
TimeoutSec=30

[Install]
WantedBy=multi-user.target
EOF

sudo tee /usr/local/bin/verify-alfa-boot.sh > /dev/null << 'EOF'
#!/bin/bash
# Verify ALFA adapter is detected and ready at boot

LOG="/var/log/alfa-boot.log"
MAX_ATTEMPTS=10
ATTEMPT=0

echo "$(date): Starting ALFA boot verification" >> $LOG

# Wait for USB device
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if lsusb | grep -q "0e8d:7961"; then
        echo "$(date): USB device found on attempt $((ATTEMPT+1))" >> $LOG
        break
    fi
    ATTEMPT=$((ATTEMPT+1))
    sleep 2
done

# Check if modules are loaded
if ! lsmod | grep -q "mt7921u"; then
    echo "$(date): Loading MT7921U modules" >> $LOG
    modprobe mt7921u
    sleep 3
fi

# Wait for network interface
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if ip link show | grep -q "wlx"; then
        INTERFACE=$(ip link show | grep "wlx" | cut -d: -f2 | tr -d ' ')
        echo "$(date): Network interface found: $INTERFACE" >> $LOG
        
        # Disable power management
        iw dev $INTERFACE set power_save off 2>/dev/null
        
        # Apply alias if configured
        if [ -f /etc/systemd/network/10-alfa-alias.link ]; then
            ip link set $INTERFACE alias wlan1_kismet 2>/dev/null
        fi
        
        echo "$(date): ALFA adapter ready" >> $LOG
        exit 0
    fi
    ATTEMPT=$((ATTEMPT+1))
    sleep 2
done

echo "$(date): WARNING - ALFA adapter not detected after $MAX_ATTEMPTS attempts" >> $LOG
exit 1
EOF
sudo chmod +x /usr/local/bin/verify-alfa-boot.sh

echo "✓ Boot verification service created"

# 6. Create NetworkManager configuration to ignore the adapter
echo ""
echo "Step 6: Configuring NetworkManager to ignore ALFA..."

sudo tee /etc/NetworkManager/conf.d/99-alfa-unmanaged.conf > /dev/null << 'EOF'
[keyfile]
# Ignore ALFA adapter - let Kismet manage it
unmanaged-devices=mac:be:e1:d6:9f:a8:11
EOF
echo "✓ NetworkManager configured"

# 7. Ensure USB autosuspend is disabled globally
echo ""
echo "Step 7: Disabling USB autosuspend..."

# Kernel parameter method
if ! grep -q "usbcore.autosuspend=-1" /boot/firmware/cmdline.txt 2>/dev/null; then
    sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.backup
    sudo sed -i 's/$/ usbcore.autosuspend=-1/' /boot/firmware/cmdline.txt
    echo "✓ Added kernel parameter (requires reboot)"
else
    echo "✓ Kernel parameter already set"
fi

# 8. Create fallback reset script
echo ""
echo "Step 8: Creating fallback USB reset script..."

sudo tee /usr/local/bin/alfa-emergency-reset.sh > /dev/null << 'EOF'
#!/bin/bash
# Emergency reset for ALFA adapter if it fails

echo "Performing emergency ALFA adapter reset..."

# Method 1: Module reload
echo "Reloading kernel modules..."
modprobe -r mt7921u mt792x_usb mt7921_common mt792x_lib mt76_connac_lib mt76_usb mt76 2>/dev/null
sleep 2
modprobe mt7921u

# Method 2: USB reset via sysfs
echo "Resetting USB device..."
for device in /sys/bus/usb/devices/*/idVendor; do
    if [ -f "$device" ] && grep -q "0e8d" "$device" 2>/dev/null; then
        DEV_PATH=$(dirname "$device")
        if [ -f "$DEV_PATH/idProduct" ] && grep -q "7961" "$DEV_PATH/idProduct" 2>/dev/null; then
            echo "Found ALFA at $DEV_PATH"
            echo 0 > "$DEV_PATH/authorized" 2>/dev/null
            sleep 1
            echo 1 > "$DEV_PATH/authorized" 2>/dev/null
            echo "USB reset completed"
        fi
    fi
done

# Wait for interface
sleep 5
if ip link show | grep -q "wlx"; then
    echo "ALFA adapter recovered successfully"
else
    echo "ALFA adapter still not detected - may need physical reconnection"
fi
EOF
sudo chmod +x /usr/local/bin/alfa-emergency-reset.sh

echo "✓ Emergency reset script created"

# 9. Enable and reload services
echo ""
echo "Step 9: Enabling services..."

sudo systemctl daemon-reload
sudo systemctl enable alfa-boot-verify.service
sudo udevadm control --reload-rules

echo "✓ Services enabled"

# 10. Summary
echo ""
echo "=== CONFIGURATION COMPLETE ==="
echo ""
echo "Boot reliability measures implemented:"
echo "1. ✓ Kernel modules load at boot (/etc/modules-load.d/mt7921u.conf)"
echo "2. ✓ Module parameters optimized (/etc/modprobe.d/mt7921u-options.conf)"
echo "3. ✓ Udev rules for detection (/etc/udev/rules.d/90-alfa-mt7921u.rules)"
echo "4. ✓ Boot verification service (alfa-boot-verify.service)"
echo "5. ✓ NetworkManager exclusion"
echo "6. ✓ USB autosuspend disabled"
echo "7. ✓ Emergency reset script (/usr/local/bin/alfa-emergency-reset.sh)"
echo ""
echo "The ALFA adapter will now:"
echo "• Load required modules at boot"
echo "• Be detected via udev rules"
echo "• Be verified by systemd service"
echo "• Have power management disabled"
echo "• Be protected from NetworkManager interference"
echo "• Have fallback recovery options"
echo ""
echo "To test: sudo reboot"
echo "To check logs: tail -f /var/log/alfa-boot.log"
echo "For emergency reset: sudo /usr/local/bin/alfa-emergency-reset.sh"