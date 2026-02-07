#!/bin/bash
# Final USRP B205 Mini setup for immediate operation

set -e

echo "[FIX] Final USRP B205 Mini Setup for OpenWebRX"
echo "=============================================="

# Create a working configuration that OpenWebRX Plus can use
cat > /tmp/config_webrx.py << 'EOF'
# OpenWebRX Configuration for USRP B205 Mini
# Working configuration for immediate startup

sdrs = {
    "usrp": {
        "name": "USRP B205 Mini",
        "type": "uhd", 
        "device": "type=b200",
        "enabled": True,
        "samp_rate": 10000000,
        "center_freq": 100000000,
        "rf_gain": 40,
        "profiles": {
            "fm": {
                "name": "FM Broadcast",
                "center_freq": 100000000,
                "samp_rate": 2400000,
                "start_freq": 100300000,
                "start_mod": "wfm"
            }
        }
    }
}

# Receiver information
receiver_name = "Argos USRP B205 Mini"
receiver_location = "Tactical Operations"
receiver_admin = "admin"
start_freq = 100300000
start_mod = "wfm"

# Admin user
users = {
    "admin": {
        "password": "admin",  
        "enabled": True,
        "admin": True
    }
}

# Web port
web_port = 8073
EOF

echo "1. [OK] Configuration file created"

# Copy configuration to container
docker cp /tmp/config_webrx.py openwebrx-usrp:/etc/openwebrx/config_webrx.py
echo "2. [OK] Configuration copied to container"

# Restart container
echo "3. [RETRY] Restarting OpenWebRX..."
docker restart openwebrx-usrp
sleep 30

# Test the setup
echo "4. [TEST] Testing setup..."

if curl -s http://localhost:8073 > /dev/null; then
    echo "   [OK] OpenWebRX is running"
else
    echo "   [ERROR] OpenWebRX is not accessible"
    exit 1
fi

if curl -s http://100.79.154.94:5173/viewspectrum > /dev/null; then
    echo "   [OK] Mission card URL is accessible"  
else
    echo "   [ERROR] Mission card URL failed"
    exit 1
fi

# Check for technical issues
if curl -s http://localhost:8073 | grep -q "technical issues"; then
    echo "   [WARN]  OpenWebRX shows technical issues - checking logs..."
    docker logs openwebrx-usrp 2>&1 | tail -5
else
    echo "   [OK] No technical issues detected"
fi

echo
echo "[TARGET] SETUP COMPLETE!"
echo "===================="
echo "Mission Card URL: http://100.79.154.94:5173/viewspectrum"
echo "Admin Interface: http://localhost:8073/admin (admin/admin)"
echo "Direct OpenWebRX: http://localhost:8073"
echo
echo "[RF] USRP B205 Mini Status:"
docker exec openwebrx-usrp SoapySDRUtil --find | grep -A 6 "driver = uhd" | head -7
echo
echo "[START] Ready for operations!"