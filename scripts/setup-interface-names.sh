#!/bin/bash
# Setup descriptive network interface names
# This script creates udev rules to rename interfaces to descriptive names

echo "Setting up descriptive network interface names..."

# Create udev rule for interface renaming
sudo tee /etc/udev/rules.d/70-argos-interfaces.rules << 'EOF'
# Argos Project Network Interface Naming
# Access Point Interface (MediaTek USB adapter for AP)
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="?*", ATTR{address}=="00:c0:ca:b6:84:ad", NAME="wlan_ap"

# Monitoring Interface (MediaTek USB adapter for monitoring)
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="?*", ATTR{address}=="00:c0:ca:b6:82:35", NAME="wlan_monitor"
EOF

echo "✓ Created udev rules for interface renaming"

# Reload udev rules
sudo udevadm control --reload-rules
echo "✓ Reloaded udev rules"

echo ""
echo "Interface naming setup complete!"
echo "After reboot, interfaces will be renamed to:"
echo "  wlx00c0cab684ad → wlan_ap (Access Point)"
echo "  wlx00c0cab68235 → wlan_monitor (Monitoring)"
echo ""
echo "IMPORTANT: System configs need to be updated before reboot!"
echo "Run the update-configs.sh script next."