#!/bin/bash

# Setup sudoers for DroneID to work from web interface

if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Setting up sudoers for DroneID control..."

# Create sudoers file for DroneID
cat > /etc/sudoers.d/argos-droneid << EOF
# Allow web server to control DroneID backend
# Replace 'www-data' with your web server user if different (could be 'ubuntu' or 'node')
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f dronesniffer/main.py
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f \"dronesniffer/main.py\"
ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlx* down
ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlx* up
ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/iw dev wlx* set type monitor
ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/iw dev wlx* set type managed
ubuntu ALL=(ALL) NOPASSWD: /bin/kill *
ubuntu ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/python3 /home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver/backend/dronesniffer/main.py *

# Also allow node user if running as different user
node ALL=(ALL) NOPASSWD: /usr/bin/pkill -f dronesniffer/main.py
node ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlx* down
node ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlx* up
node ALL=(ALL) NOPASSWD: /usr/sbin/iw dev wlx* set type monitor
node ALL=(ALL) NOPASSWD: /usr/sbin/iw dev wlx* set type managed
node ALL=(ALL) NOPASSWD: /bin/kill *
node ALL=(ALL) NOPASSWD: /bin/bash /tmp/start-droneid-temp.sh
EOF

# Set proper permissions
chmod 0440 /etc/sudoers.d/argos-droneid

echo "[PASS] Sudoers configured for DroneID control"
echo ""
echo "The web interface should now be able to start/stop DroneID"