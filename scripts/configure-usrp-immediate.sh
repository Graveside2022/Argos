#!/bin/bash
# Configure USRP B205 Mini in OpenWebRX for immediate operation

set -e

echo "=== Configuring USRP B205 Mini for Immediate Operation ==="

# Wait for OpenWebRX to be fully ready
echo "1. Waiting for OpenWebRX to initialize..."
sleep 10

# Create admin user and configure USRP device
echo "2. Setting up admin user and USRP device..."
docker exec openwebrx-usrp python3 << 'EOF'
import json
import os
import sys
from owrx.users import UserList
from owrx.config import Config

# Create admin user
print("Creating admin user...")
try:
    userlist = UserList()
    if 'admin' not in userlist:
        userlist.addUser('admin', 'admin')
        print("Admin user created: admin/admin")
    else:
        print("Admin user already exists")
except Exception as e:
    print(f"User creation error: {e}")

# Configure USRP device
print("Configuring USRP B205 Mini...")
try:
    config = Config.get()
    
    # Add USRP SDR configuration
    if 'sdrs' not in config:
        config['sdrs'] = {}
    
    config['sdrs']['usrp_b205'] = {
        "name": "USRP B205 Mini",
        "type": "soapy_connector",
        "device": "driver=uhd,type=b200",
        "enabled": True,
        "always_up": True,
        "gain": {
            "PGA": 40
        },
        "samp_rate": 10000000,
        "center_freq": 100000000,
        "rf_gain": 40,
        "profiles": {
            "wide": {
                "name": "Wide Spectrum",
                "center_freq": 100000000,
                "samp_rate": 10000000,
                "start_freq": 100300000,
                "start_mod": "wfm"
            }
        }
    }
    
    # Set receiver info
    config['receiver_name'] = "Argos USRP B205 Mini"
    config['receiver_location'] = "Tactical Operations"
    config['receiver_admin'] = "admin"
    config['photo_title'] = "Argos Tactical SDR"
    config['photo_desc'] = "USRP B205 Mini Software Defined Radio"
    
    # Set default frequency and mode
    config['start_freq'] = 100300000
    config['start_mod'] = "wfm"
    
    # Save configuration
    config.store()
    print("USRP B205 Mini configured successfully!")
    
except Exception as e:
    print(f"Configuration error: {e}")
    sys.exit(1)

print("Configuration complete!")
EOF

# Restart to apply configuration
echo "3. Restarting OpenWebRX to apply configuration..."
docker restart openwebrx-usrp
sleep 15

# Verify the setup
echo "4. Verifying setup..."
if curl -s http://localhost:8073 > /dev/null; then
    echo "[OK] OpenWebRX is accessible at http://localhost:8073"
else
    echo "[ERROR] OpenWebRX is not accessible"
    exit 1
fi

if curl -s http://localhost:5173/viewspectrum > /dev/null; then
    echo "[OK] Argos spectrum viewer is accessible at http://localhost:5173/viewspectrum"
else
    echo "[ERROR] Argos spectrum viewer is not accessible"
    exit 1
fi

echo
echo "=== Setup Complete! ==="
echo "[TARGET] Mission Card URL Ready: http://100.79.154.94:5173/viewspectrum"
echo "[KEY] Admin Access: admin/admin at http://localhost:8073/admin"
echo "[RF] USRP B205 Mini: Configured and ready for immediate operation"
echo "[START] Click the mission card - it should start listening immediately!"
echo