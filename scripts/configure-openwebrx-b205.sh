#!/bin/bash
# Configure OpenWebRX for USRP B205 Mini

set -e

# Read credentials from environment (fail if not set)
OPENWEBRX_PASSWORD="${OPENWEBRX_PASSWORD:?Error: OPENWEBRX_PASSWORD not set. Set in .env or export before running.}"

echo "=== Configuring OpenWebRX for USRP B205 Mini ==="

# Wait for OpenWebRX to be fully ready
echo "1. Waiting for OpenWebRX to initialize..."
sleep 15

# Check if we can reach the admin interface
echo "2. Checking OpenWebRX admin interface..."
if ! curl -s http://localhost:8073/admin >/dev/null; then
    echo "Warning: Admin interface not accessible. Creating admin user..."

    # Create admin user inside container
    docker exec -e OPENWEBRX_PASSWORD="$OPENWEBRX_PASSWORD" openwebrx-usrp python3 -c "
import os
owrx_pass = os.environ.get('OPENWEBRX_PASSWORD', '')
os.environ['OWRX_ADMIN_USER'] = 'admin'
os.environ['OWRX_ADMIN_PASSWORD'] = owrx_pass
from owrx.users import UserList
from owrx.config import Config
userlist = UserList()
if 'admin' not in userlist:
    userlist.addUser('admin', owrx_pass)
    print('Admin user created: admin/<from OPENWEBRX_PASSWORD env var>')
else:
    print('Admin user already exists')
"

    # Restart container to apply changes
    echo "3. Restarting container to apply admin user..."
    docker restart openwebrx-usrp
    sleep 20
fi

# Create USRP device configuration
echo "4. Creating USRP B205 Mini device configuration..."
cat > /tmp/usrp_config.py << 'EOF'
#!/usr/bin/env python3
import json
import os
import sys

# Configuration for USRP B205 Mini
usrp_config = {
    "usrp_b205": {
        "name": "USRP B205 Mini",
        "type": "sdrplay_soapy",
        "driver": "uhd",
        "device": "driver=uhd,type=b200",
        "enabled": True,
        "gain": {
            "PGA": 40
        },
        "samp_rate": 20000000,
        "center_freq": 100000000,
        "start_freq": 100000000,
        "start_mod": "wfm",
        "rf_gain": 40,
        "profiles": {
            "fm_broadcast": {
                "name": "FM Broadcast",
                "center_freq": 100000000,
                "samp_rate": 2400000,
                "start_freq": 100300000,
                "start_mod": "wfm"
            },
            "vhf_air": {
                "name": "VHF Airband",
                "center_freq": 127000000,
                "samp_rate": 2400000,
                "start_freq": 126000000,
                "start_mod": "am"
            },
            "uhf": {
                "name": "UHF",
                "center_freq": 446000000,
                "samp_rate": 2400000,
                "start_freq": 445000000,
                "start_mod": "nfm"
            }
        }
    }
}

print(json.dumps(usrp_config, indent=2))
EOF

python3 /tmp/usrp_config.py > /tmp/usrp_device.json

# Copy configuration to container
echo "5. Applying USRP configuration to OpenWebRX..."
docker cp /tmp/usrp_device.json openwebrx-usrp:/tmp/usrp_device.json

# Apply configuration using Python script inside container
docker exec openwebrx-usrp python3 -c "
import json
import os
from owrx.config import Config

# Load the USRP configuration
with open('/tmp/usrp_device.json', 'r') as f:
    usrp_config = json.load(f)

# Get current config
config = Config.get()

# Initialize sdrs section if it doesn't exist
if 'sdrs' not in config:
    config['sdrs'] = {}

# Add USRP configuration
config['sdrs'].update(usrp_config)

# Save configuration
config.store()
print('USRP B205 Mini configuration applied successfully')
"

# Restart to apply new configuration
echo "6. Restarting OpenWebRX to apply USRP configuration..."
docker restart openwebrx-usrp
sleep 20

# Check if USRP is detected
echo "7. Checking USRP device detection..."
docker logs openwebrx-usrp 2>&1 | tail -20

echo
echo "=== Configuration Complete ==="
echo "OpenWebRX is now configured for USRP B205 Mini"
echo
echo "Admin credentials: admin / (set via OPENWEBRX_PASSWORD env var)"
echo "Web interface: http://localhost:8073"
echo "Admin interface: http://localhost:8073/admin"
echo
echo "Available profiles:"
echo "  - FM Broadcast (88-108 MHz)"
echo "  - VHF Airband (118-137 MHz)"
echo "  - UHF (430-450 MHz)"
echo
