#!/bin/bash
# Check if USRP is in use by another process

# Check for OpenWebRX or soapy_connector using USRP
OPENWEBRX_PID=$(pgrep -f "openwebrx" | head -1)
SOAPY_PID=$(pgrep -f "soapy_connector.*uhd" | head -1)
GRGSM_PID=$(pgrep -f "grgsm_livemon" | head -1)

if [ -n "$OPENWEBRX_PID" ] || [ -n "$SOAPY_PID" ]; then
    echo "BUSY:OpenWebRX"
    exit 1
elif [ -n "$GRGSM_PID" ]; then
    echo "BUSY:GSM_Evil"
    exit 1
else
    echo "FREE"
    exit 0
fi