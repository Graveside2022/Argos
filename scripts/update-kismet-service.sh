#!/bin/bash
# Update Kismet systemd service with graceful stop

cat << 'EOF' | sudo tee /etc/systemd/system/kismet-auto-wlan1.service
[Unit]
Description=Kismet with automatic wlan1 WiFi monitoring
ConditionPathExists=/usr/bin/kismet
After=network.target auditd.service

[Service]
User=root
Group=root
Type=simple
ExecStartPre=/usr/local/bin/kismet-wlan1-prepare.sh
ExecStart=/usr/bin/kismet --no-ncurses-wrapper
ExecStartPost=/usr/local/bin/kismet-wlan1-enable.sh
ExecStop=/home/ubuntu/projects/Argos/scripts/kismet-graceful-stop.sh
KillMode=process
TimeoutStopSec=15
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

echo "Kismet service updated with graceful stop mechanism"