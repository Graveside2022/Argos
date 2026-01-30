#!/bin/bash
# Check if HackRF is in use by another process

# Check for OpenWebRX container
OPENWEBRX_RUNNING=$(docker ps --filter "name=openwebrx" --format "{{.Names}}" 2>/dev/null | head -1)
if [ -n "$OPENWEBRX_RUNNING" ]; then
    echo "BUSY:OpenWebRX"
    exit 1
fi

# Check for hackrf_sweep
SWEEP_PID=$(pgrep -x "hackrf_sweep" | head -1)
if [ -n "$SWEEP_PID" ]; then
    echo "BUSY:hackrf_sweep"
    exit 1
fi

# Check for hackrf_transfer
TRANSFER_PID=$(pgrep -x "hackrf_transfer" | head -1)
if [ -n "$TRANSFER_PID" ]; then
    echo "BUSY:hackrf_transfer"
    exit 1
fi

# Check for grgsm_livemon (GSM Evil)
GRGSM_PID=$(pgrep -f "grgsm_livemon" | head -1)
if [ -n "$GRGSM_PID" ]; then
    echo "BUSY:GSM_Evil"
    exit 1
fi

# Check for btle_rx
BTLE_PID=$(pgrep -x "btle_rx" | head -1)
if [ -n "$BTLE_PID" ]; then
    echo "BUSY:BTLE"
    exit 1
fi

# Check for soapy_connector
SOAPY_PID=$(pgrep -f "soapy_connector" | head -1)
if [ -n "$SOAPY_PID" ]; then
    echo "BUSY:SoapyConnector"
    exit 1
fi

# Check for URH
URH_PID=$(pgrep -x "urh" | head -1)
if [ -n "$URH_PID" ]; then
    echo "BUSY:URH"
    exit 1
fi

# Check for TempestSDR
TEMPEST_PID=$(pgrep -f "TempestSDR" | head -1)
if [ -n "$TEMPEST_PID" ]; then
    echo "BUSY:TempestSDR"
    exit 1
fi

echo "FREE"
exit 0
