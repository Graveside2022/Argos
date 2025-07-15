#!/bin/bash

# Nuclear GSMEvil2 Stop Script
# Last resort when normal stop doesn't work

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}☢️  NUCLEAR STOP - Forcefully terminating ALL GSM Evil processes ☢️${NC}"

# 1. Kill by exact process names with SIGKILL
echo "Force killing by process names..."
killall -9 grgsm_livemon_headless 2>/dev/null || true
killall -9 grgsm_livemon 2>/dev/null || true
killall -9 python3 2>/dev/null || true  # Dangerous but effective

# 2. Kill anything Python running GsmEvil
echo "Killing Python processes running GsmEvil..."
for pid in $(ps aux | grep -E "python.*GsmEvil" | grep -v grep | awk '{print $2}'); do
    echo -e "${RED}SIGKILL to PID $pid${NC}"
    kill -9 $pid 2>/dev/null || true
done

# 3. Kill anything using GNU Radio
echo "Killing GNU Radio related processes..."
for pid in $(ps aux | grep -E "gnuradio|gr-gsm|grgsm" | grep -v grep | awk '{print $2}'); do
    echo -e "${RED}SIGKILL to PID $pid${NC}"
    kill -9 $pid 2>/dev/null || true
done

# 4. Kill everything on port 8080 and 4729 (GSM Evil ports)
echo "Killing processes on GSM Evil ports..."
for port in 8080 4729; do
    for pid in $(lsof -ti:$port 2>/dev/null); do
        echo -e "${RED}SIGKILL to process on port $port: $pid${NC}"
        kill -9 $pid 2>/dev/null || true
    done
done

# 5. Kill parent bash scripts that started GSM Evil
echo "Killing launcher scripts..."
for pid in $(ps aux | grep -E "start-gsmevil|start-gsm-evil" | grep -v grep | awk '{print $2}'); do
    echo -e "${RED}SIGKILL to launcher PID $pid${NC}"
    kill -9 $pid 2>/dev/null || true
done

# 6. Clean up all temporary files
echo "Cleaning up all temporary files..."
rm -rf /tmp/gsmevil2.* /tmp/grgsm.* /tmp/gsm-evil-* 2>/dev/null || true
rm -f /var/run/gsmevil* /var/run/grgsm* 2>/dev/null || true

# 7. Kill orphaned processes that might be holding resources
echo "Looking for orphaned processes..."
for pid in $(ps aux | grep defunct | grep -E "grgsm|GsmEvil" | awk '{print $2}'); do
    parent=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' ')
    if [ -n "$parent" ] && [ "$parent" != "1" ]; then
        echo -e "${RED}Killing parent $parent of defunct process $pid${NC}"
        kill -9 $parent 2>/dev/null || true
    fi
done

# 8. Reset USB devices if HackRF might be stuck
echo "Checking for stuck HackRF..."
if lsusb | grep -q "Great Scott Gadgets HackRF"; then
    echo -e "${YELLOW}Found HackRF, attempting USB reset...${NC}"
    # Get HackRF USB device
    HACKRF_DEV=$(lsusb | grep "Great Scott Gadgets HackRF" | awk '{print "/dev/bus/usb/" $2 "/" substr($4,1,3)}')
    if [ -n "$HACKRF_DEV" ] && [ -e "$HACKRF_DEV" ]; then
        echo -e "${YELLOW}Resetting $HACKRF_DEV${NC}"
        # Use existing USB reset script if available
        if [ -x "/home/ubuntu/projects/Argos/scripts/nuclear-usb-reset.sh" ]; then
            /home/ubuntu/projects/Argos/scripts/nuclear-usb-reset.sh
        fi
    fi
fi

# 9. Final cleanup sweep
sleep 1
echo "Final cleanup sweep..."
pkill -9 -f "gsmevil" 2>/dev/null || true
pkill -9 -f "grgsm" 2>/dev/null || true
pkill -9 -f "4729" 2>/dev/null || true  # Kill anything using the GSM port

# 10. Verification
sleep 1
echo -e "\n${YELLOW}=== VERIFICATION ===${NC}"
REMAINING=$(ps aux | grep -E "(grgsm|GsmEvil)" | grep -v grep | wc -l)
if [ $REMAINING -eq 0 ]; then
    echo -e "${GREEN}✓ ALL GSM Evil processes terminated!${NC}"
    echo -e "${GREEN}✓ System is clean${NC}"
else
    echo -e "${RED}⚠ WARNING: $REMAINING processes may still be running${NC}"
    echo -e "${RED}Remaining processes:${NC}"
    ps aux | grep -E "(grgsm|GsmEvil)" | grep -v grep
fi

# Show port status
echo -e "\n${YELLOW}Port status:${NC}"
lsof -i:8080 2>/dev/null || echo "Port 8080: FREE"
lsof -i:4729 2>/dev/null || echo "Port 4729: FREE"

exit 0