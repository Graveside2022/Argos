#!/usr/bin/env bash
# Install DragonSync + droneid-go on Raspberry Pi 5 (Kali ARM64)
# Usage: sudo ./scripts/ops/install-dragonsync.sh
set -euo pipefail

INSTALL_DIR="/opt/dragonsync"
DRONEID_DIR="/opt/droneid-go"
ARGOS_USER="kali"
WIFI_IFACE="wlan1"

info()  { printf '\033[1;32m[+]\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m[!]\033[0m %s\n' "$1"; }
error() { printf '\033[1;31m[-]\033[0m %s\n' "$1"; exit 1; }

[[ $EUID -eq 0 ]] || error "Run as root: sudo $0"

# ── System dependencies ──
info "Installing system dependencies..."
apt-get update -qq
apt-get install -y -q iproute2 iw libpcap0.8 libzmq5 lm-sensors gpsd gpsd-clients python3-pip git

# ── droneid-go (prebuilt ARM64 binary) ──
info "Installing droneid-go..."
mkdir -p "$DRONEID_DIR"

if [[ ! -f "$DRONEID_DIR/droneid" ]]; then
    TMPDIR=$(mktemp -d)
    git clone --depth 1 https://github.com/alphafox02/droneid-go.git "$TMPDIR"
    cp "$TMPDIR/bin/droneid-linux-arm64" "$DRONEID_DIR/droneid"
    chmod +x "$DRONEID_DIR/droneid"
    rm -rf "$TMPDIR"
    info "droneid-go binary installed to $DRONEID_DIR/droneid"
else
    info "droneid-go binary already exists, skipping"
fi

# ── DragonSync (Python) ──
info "Installing DragonSync..."
if [[ ! -d "$INSTALL_DIR" ]]; then
    git clone https://github.com/alphafox02/DragonSync.git "$INSTALL_DIR"
else
    info "DragonSync directory exists, pulling latest..."
    git -C "$INSTALL_DIR" pull --ff-only || warn "git pull failed, using existing"
fi

pip3 install --break-system-packages -q -r "$INSTALL_DIR/requirements.txt"

# ── DragonSync config.ini ──
if [[ ! -f "$INSTALL_DIR/config.ini" ]]; then
    warn "No config.ini found — copying default"
fi

# Ensure API is enabled in config
if grep -q "api_enabled" "$INSTALL_DIR/config.ini" 2>/dev/null; then
    sed -i 's/^api_enabled\s*=.*/api_enabled = true/' "$INSTALL_DIR/config.ini"
    sed -i 's/^api_port\s*=.*/api_port = 8088/' "$INSTALL_DIR/config.ini"
else
    info "config.ini API settings look default (enabled on 8088)"
fi

# ── zmq-decoder.service (droneid-go) ──
info "Creating zmq-decoder.service..."
cat > /etc/systemd/system/zmq-decoder.service << SVCEOF
[Unit]
Description=DroneID ZMQ Decoder (droneid-go)
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$DRONEID_DIR
ExecStart=$DRONEID_DIR/droneid -i $WIFI_IFACE -g -z -zmqsetting 0.0.0.0:4224
Restart=on-failure
RestartSec=5

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes
ReadWritePaths=/sys/class/net

[Install]
WantedBy=multi-user.target
SVCEOF

# ── dragonsync.service ──
info "Creating dragonsync.service..."
cat > /etc/systemd/system/dragonsync.service << SVCEOF
[Unit]
Description=DragonSync Service
After=network.target zmq-decoder.service

[Service]
Type=simple
User=$ARGOS_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/dragonsync.py -c config.ini
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# ── Sudoers for Argos ──
info "Configuring sudoers for Argos..."
cat > /etc/sudoers.d/argos-dragonsync << SUDOEOF
# Allow Argos to manage DragonSync services
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start zmq-decoder.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop zmq-decoder.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active dragonsync.service
$ARGOS_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active zmq-decoder.service
SUDOEOF
chmod 0440 /etc/sudoers.d/argos-dragonsync

# ── Reload and enable ──
systemctl daemon-reload
systemctl enable zmq-decoder.service
systemctl enable dragonsync.service

info "Installation complete!"
info ""
info "  droneid-go: $DRONEID_DIR/droneid"
info "  DragonSync: $INSTALL_DIR"
info "  WiFi iface: $WIFI_IFACE (change in zmq-decoder.service if different)"
info "  API:        http://127.0.0.1:8088/drones"
info ""
info "To start manually:"
info "  sudo systemctl start zmq-decoder"
info "  sudo systemctl start dragonsync"
info ""
info "Or use the Start button in the Argos UAS tab."
