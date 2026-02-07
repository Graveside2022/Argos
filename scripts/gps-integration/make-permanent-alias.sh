#!/bin/bash

# Create PERMANENT system-wide alias for ALFA adapter

echo "Creating permanent system-wide alias: wlan1_kismet"

# Create systemd network link file for persistent alias
sudo tee /etc/systemd/network/10-alfa-alias.link > /dev/null << EOF
[Match]
MACAddress=be:e1:d6:9f:a8:11

[Link]
Alias=wlan1_kismet
EOF

echo "[PASS] Permanent alias configuration created"
echo ""
echo "To apply:"
echo "1. Restart networking: sudo systemctl restart systemd-networkd"
echo "2. Or just reboot"
echo ""
echo "After that, 'ip link show wlxbee1d69fa811' will show:"
echo "   alias wlan1_kismet"
echo ""
echo "The interface name remains wlxbee1d69fa811"
echo "The alias is just a label for human reference"