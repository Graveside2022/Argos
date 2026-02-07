#!/bin/bash
# Update system configurations to use descriptive interface names
# This must be run BEFORE rebooting after setting up udev rules

echo "Updating system configurations for descriptive interface names..."

# Backup original configs
echo "Creating backups..."
sudo cp /etc/hostapd/hostapd.conf /etc/hostapd/hostapd.conf.backup 2>/dev/null || echo "hostapd.conf not found, skipping backup"
sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup 2>/dev/null || echo "dnsmasq.conf not found, skipping backup"

# Update hostapd configuration
if [ -f /etc/hostapd/hostapd.conf ]; then
    echo "Updating hostapd.conf..."
    sudo sed -i 's/interface=wlx00c0cab684ad/interface=wlan_ap/g' /etc/hostapd/hostapd.conf
    echo "[PASS] Updated hostapd.conf to use wlan_ap"
else
    echo "[WARN] hostapd.conf not found - you may need to update it manually"
fi

# Update dnsmasq configuration
if [ -f /etc/dnsmasq.conf ]; then
    echo "Updating dnsmasq.conf..."
    sudo sed -i 's/interface=wlx00c0cab684ad/interface=wlan_ap/g' /etc/dnsmasq.conf
    echo "[PASS] Updated dnsmasq.conf to use wlan_ap"
else
    echo "[WARN] dnsmasq.conf not found - you may need to update it manually"
fi

# Update NetworkManager configuration to ignore our interfaces
echo "Updating NetworkManager configuration..."
sudo tee /etc/NetworkManager/conf.d/99-unmanaged-argos.conf << 'EOF'
[keyfile]
unmanaged-devices=interface-name:wlan_ap;interface-name:wlan_monitor
EOF
echo "[PASS] Updated NetworkManager to ignore Argos interfaces"

echo ""
echo "System configuration update complete!"
echo ""
echo "Next steps:"
echo "1. Reboot the system to activate interface renaming"
echo "2. After reboot, verify interfaces have new names with 'ip link show'"
echo "3. Update Argos code to use new interface names"
echo ""
echo "The following services will be updated automatically:"
echo "  - hostapd (Access Point)"
echo "  - dnsmasq (DHCP/DNS)"
echo "  - NetworkManager (will ignore our interfaces)"