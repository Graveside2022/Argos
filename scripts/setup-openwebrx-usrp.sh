#!/bin/bash
# Setup OpenWebRX with USRP B205 Mini support
# This script configures Docker container with proper UHD support

set -e

echo "=== OpenWebRX USRP B205 Mini Setup ==="
echo "This script will configure OpenWebRX to work with your USRP B205 Mini"
echo

# Stop existing HackRF container
echo "1. Stopping existing HackRF container..."
docker stop openwebrx-hackrf-only || true

# Create required directories
echo "2. Creating OpenWebRX configuration directories..."
mkdir -p /home/ubuntu/.config/openwebrx
mkdir -p /home/ubuntu/.config/openwebrx/settings
mkdir -p /home/ubuntu/.config/openwebrx/bookmarks

# Check USB permissions
echo "3. Setting up USB permissions for USRP..."
if [ ! -f /etc/udev/rules.d/uhd-usrp.rules ]; then
    echo "Installing USRP udev rules..."
    sudo bash -c 'cat > /etc/udev/rules.d/uhd-usrp.rules << EOF
# Ettus Research USRP B205 Mini
SUBSYSTEMS=="usb", ATTRS{idVendor}=="2500", ATTRS{idProduct}=="0022", MODE="0666", GROUP="dialout"
EOF'
    sudo udevadm control --reload-rules
    sudo udevadm trigger
fi

# Create Docker compose file for OpenWebRX with USRP support
echo "4. Creating Docker Compose configuration..."
cat > /home/ubuntu/projects/Argos/docker-compose-openwebrx-usrp.yml << 'EOF'
version: "3.8"

services:
  openwebrx-usrp:
    image: jketterl/openwebrx-uhd:stable
    container_name: openwebrx-usrp
    restart: unless-stopped
    devices:
      - "/dev/bus/usb:/dev/bus/usb"
    ports:
      - "8073:8073"
    volumes:
      - openwebrx-settings:/var/lib/openwebrx
      - openwebrx-config:/etc/openwebrx
      - /usr/share/uhd/images:/usr/share/uhd/images:ro
    environment:
      - UHD_IMAGES_DIR=/usr/share/uhd/images
      - UHD_LOG_LEVEL=info
    tmpfs:
      - /tmp/openwebrx:rw,noexec,nosuid,size=100m
    networks:
      - openwebrx

volumes:
  openwebrx-settings:
  openwebrx-config:

networks:
  openwebrx:
    driver: bridge
EOF

# Create initial configuration for B205 Mini
echo "5. Creating B205 Mini configuration..."
cat > /tmp/openwebrx-config.json << 'EOF'
{
  "version": 6,
  "sdrs": {
    "usrp_b205": {
      "name": "USRP B205 Mini",
      "type": "soapy_connector",
      "device": "driver=uhd,type=b200",
      "samp_rate": 20000000,
      "center_freq": 100000000,
      "gain": {
        "PGA": 40
      },
      "enabled": true,
      "profiles": {
        "wide_fm": {
          "name": "Wide FM",
          "center_freq": 100000000,
          "samp_rate": 2000000,
          "start_freq": 99000000,
          "start_mod": "wfm"
        },
        "vhf_air": {
          "name": "VHF Airband",
          "center_freq": 127000000,
          "samp_rate": 2000000,
          "start_freq": 126000000,
          "start_mod": "am"
        },
        "uhf": {
          "name": "UHF",
          "center_freq": 446000000,
          "samp_rate": 2000000,
          "start_freq": 445000000,
          "start_mod": "nfm"
        }
      }
    }
  },
  "web": {
    "port": 8073,
    "web_accessible": true
  }
}
EOF

# Start the container
echo "6. Starting OpenWebRX with USRP support..."
cd /home/ubuntu/projects/Argos
docker compose -f docker-compose-openwebrx-usrp.yml down || true
docker compose -f docker-compose-openwebrx-usrp.yml pull
docker compose -f docker-compose-openwebrx-usrp.yml up -d

# Wait for container to start
echo "7. Waiting for container to initialize..."
sleep 10

# Check container status
echo "8. Checking container status..."
docker ps | grep openwebrx-usrp

echo
echo "=== Setup Complete ==="
echo "OpenWebRX should now be accessible at http://localhost:8073"
echo "The USRP B205 Mini has been configured with the following profiles:"
echo "  - Wide FM (88-108 MHz)"
echo "  - VHF Airband (118-137 MHz)"
echo "  - UHF (430-450 MHz)"
echo
echo "To view logs: docker logs -f openwebrx-usrp"
echo "To stop: docker compose -f docker-compose-openwebrx-usrp.yml down"
echo