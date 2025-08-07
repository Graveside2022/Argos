#!/bin/bash

# GSM Evil Bulletproof Stop Script
# Comprehensive termination of ALL GSM Evil related processes and resources

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔥 GSM Evil Bulletproof Stop - Comprehensive Process Termination${NC}"

# Enhanced function to handle both sudo and non-sudo kills
try_kill_enhanced() {
    local pattern="$1"
    local signal="${2:--TERM}"
    local description="$3"
    
    echo -e "${YELLOW}Stopping $description processes...${NC}"
    
    # Find processes using multiple methods
    local pids=""
    
    # Method 1: pgrep with pattern
    pids="$pids $(pgrep -f "$pattern" 2>/dev/null | tr '\n' ' ')"
    
    # Method 2: ps aux grep (catches more variations)
    pids="$pids $(ps aux | grep -E "$pattern" | grep -v grep | awk '{print $2}' | tr '\n' ' ')"
    
    # Remove duplicates and empty entries
    pids=$(echo $pids | tr ' ' '\n' | sort -u | grep -E '^[0-9]+$' | tr '\n' ' ')
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Found PIDs: $pids${NC}"
        
        # Try with sudo first if available
        if sudo -n true 2>/dev/null; then
            for pid in $pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    echo -e "${YELLOW}Killing PID $pid with sudo${NC}"
                    sudo kill $signal $pid 2>/dev/null || true
                fi
            done
            # Also try pkill with sudo
            sudo pkill $signal -f "$pattern" 2>/dev/null || true
        else
            # Fall back to user-level kill
            for pid in $pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    echo -e "${YELLOW}Killing PID $pid${NC}"
                    kill $signal $pid 2>/dev/null || true
                fi
            done
            pkill $signal -f "$pattern" 2>/dev/null || true
        fi
    else
        echo -e "${GREEN}No $description processes found${NC}"
    fi
}

try_port_kill_enhanced() {
    local port="$1"
    local description="$2"
    
    echo -e "${YELLOW}Clearing port $port ($description)...${NC}"
    
    # Find processes using the port
    local port_pids=$(lsof -ti:$port 2>/dev/null | tr '\n' ' ')
    
    if [ -n "$port_pids" ]; then
        echo -e "${YELLOW}Found processes on port $port: $port_pids${NC}"
        
        # Kill processes using the port
        for pid in $port_pids; do
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}Killing PID $pid using port $port${NC}"
                kill -TERM $pid 2>/dev/null || true
            fi
        done
        
        sleep 1
        
        # Force kill if still using port
        port_pids=$(lsof -ti:$port 2>/dev/null | tr '\n' ' ')
        if [ -n "$port_pids" ]; then
            for pid in $port_pids; do
                echo -e "${RED}Force killing PID $pid still using port $port${NC}"
                kill -9 $pid 2>/dev/null || true
            done
        fi
        
        # Try fuser as backup
        if sudo -n true 2>/dev/null; then
            sudo fuser -k $port/tcp 2>/dev/null || true
            sudo fuser -k $port/udp 2>/dev/null || true
        else
            fuser -k $port/tcp 2>/dev/null || true
            fuser -k $port/udp 2>/dev/null || true
        fi
    else
        echo -e "${GREEN}Port $port is already free${NC}"
    fi
}

# PHASE 1: Stop GRGSM Livemon processes (all variants)
echo -e "\n${BLUE}=== PHASE 1: GRGSM Livemon Termination ===${NC}"
try_kill_enhanced "grgsm_livemon" "-TERM" "GRGSM Livemon"
try_kill_enhanced "grgsm_livemon_headless" "-TERM" "GRGSM Livemon Headless"
try_kill_enhanced "grgsm_livemon.*fixed" "-TERM" "GRGSM Livemon Fixed"
try_kill_enhanced "grgsm_livemon.*wrapper" "-TERM" "GRGSM Livemon Wrapper"
try_kill_enhanced "grgsm_livemon.*usrp" "-TERM" "GRGSM Livemon USRP"

# PHASE 2: Stop GSM Evil Python processes (all variants)
echo -e "\n${BLUE}=== PHASE 2: GSM Evil Python Process Termination ===${NC}"
try_kill_enhanced "python.*GsmEvil\.py" "-TERM" "GSM Evil Python"
try_kill_enhanced "python.*GsmEvil_auto\.py" "-TERM" "GSM Evil Auto Python"
try_kill_enhanced "GsmEvil\.py" "-TERM" "GSM Evil Direct"
try_kill_enhanced "GsmEvil_auto\.py" "-TERM" "GSM Evil Auto Direct"

# Also kill any Python processes in the gsmevil2 directory context
try_kill_enhanced "python.*gsmevil2" "-TERM" "GSM Evil2 Python"
try_kill_enhanced ".*venv.*python.*GsmEvil" "-TERM" "GSM Evil Virtual Environment"

# PHASE 3: Comprehensive Port Cleanup
echo -e "\n${BLUE}=== PHASE 3: Port Cleanup ===${NC}"
try_port_kill_enhanced "80" "GSM Evil Web Interface"
try_port_kill_enhanced "8080" "GSM Evil Alternative Port"
try_port_kill_enhanced "4729" "GSMTAP UDP Traffic"
try_port_kill_enhanced "2775" "GSM Evil Secondary Port"

# PHASE 4: USRP Device Release and UHD Cleanup
echo -e "\n${BLUE}=== PHASE 4: USRP Device Release ===${NC}"
try_kill_enhanced "uhd.*b200" "-TERM" "UHD B200 Processes"
try_kill_enhanced ".*usrp.*b205" "-TERM" "USRP B205 Processes"

# Reset USRP if detected
if lsusb | grep -q "2500:0022"; then
    echo -e "${YELLOW}USRP B205 Mini detected, attempting device reset...${NC}"
    if which uhd_usrp_probe >/dev/null 2>&1; then
        timeout 5 uhd_usrp_probe --args="type=b200" >/dev/null 2>&1 || true
    fi
fi

# PHASE 5: PID File and Temporary File Cleanup
echo -e "\n${BLUE}=== PHASE 5: File System Cleanup ===${NC}"
echo -e "${YELLOW}Cleaning PID files and temporary files...${NC}"

# PID files (try both sudo and non-sudo)
PID_FILES="/tmp/grgsm.pid /tmp/gsmevil.pid /tmp/gsmevil2.pid /var/run/grgsm.pid /var/run/gsmevil.pid"

for pid_file in $PID_FILES; do
    if [ -f "$pid_file" ]; then
        if sudo -n true 2>/dev/null; then
            sudo rm -f "$pid_file" 2>/dev/null || true
        else
            rm -f "$pid_file" 2>/dev/null || true
        fi
        echo -e "${GREEN}Removed $pid_file${NC}"
    fi
done

# Clean up temporary GSM Evil files
if sudo -n true 2>/dev/null; then
    sudo rm -rf /tmp/gsmevil2.* /tmp/grgsm.* /tmp/gsm-evil-* 2>/dev/null || true
    sudo rm -f /var/run/gsmevil* /var/run/grgsm* 2>/dev/null || true
else
    rm -rf /tmp/gsmevil2.* /tmp/grgsm.* /tmp/gsm-evil-* 2>/dev/null || true
    rm -f /var/run/gsmevil* /var/run/grgsm* 2>/dev/null || true
fi

# PHASE 6: Wait and Verification
echo -e "\n${BLUE}=== PHASE 6: Process Termination Verification ===${NC}"
echo -e "${YELLOW}Waiting for graceful termination...${NC}"
sleep 3

# Check for remaining processes
remaining_grgsm=$(ps aux | grep -E "grgsm_livemon" | grep -v grep | wc -l)
remaining_gsmevil=$(ps aux | grep -E "GsmEvil" | grep -v grep | wc -l)
total_remaining=$((remaining_grgsm + remaining_gsmevil))

if [ "$total_remaining" -gt 0 ]; then
    echo -e "${RED}Warning: $total_remaining processes still running. Initiating force termination...${NC}"
    
    # PHASE 7: Force Kill (SIGKILL) 
    echo -e "\n${BLUE}=== PHASE 7: Force Termination ===${NC}"
    try_kill_enhanced "grgsm_livemon" "-9" "GRGSM (Force)"
    try_kill_enhanced "GsmEvil" "-9" "GSM Evil (Force)"
    try_kill_enhanced "python.*GsmEvil" "-9" "GSM Evil Python (Force)"
    try_kill_enhanced "python.*gsmevil" "-9" "GSM Evil Python Alt (Force)"
    
    sleep 2
    
    # Final verification
    final_remaining=$(ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep | wc -l)
    if [ "$final_remaining" -gt 0 ]; then
        echo -e "${RED}=== CRITICAL: $final_remaining processes could not be terminated ===${NC}"
        echo -e "${RED}Remaining processes:${NC}"
        ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep
        echo -e "${YELLOW}Consider running nuclear-stop-gsmevil.sh for extreme cases${NC}"
        exit 1
    fi
fi

# PHASE 8: Final Status Report
echo -e "\n${BLUE}=== FINAL STATUS REPORT ===${NC}"

# Process verification
if ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep >/dev/null; then
    echo -e "${RED}✗ Some processes may still be running${NC}"
    ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep
else
    echo -e "${GREEN}✓ All GSM Evil processes terminated${NC}"
fi

# Port verification
ports_in_use=""
for port in 80 8080 4729 2775; do
    if lsof -i:$port >/dev/null 2>&1; then
        ports_in_use="$ports_in_use $port"
    fi
done

if [ -n "$ports_in_use" ]; then
    echo -e "${RED}✗ Ports still in use:$ports_in_use${NC}"
    for port in $ports_in_use; do
        lsof -i:$port 2>/dev/null || true
    done
else
    echo -e "${GREEN}✓ All GSM Evil ports are free${NC}"
fi

# USRP status
if lsusb | grep -q "2500:0022"; then
    echo -e "${GREEN}✓ USRP B205 Mini device available${NC}"
else
    echo -e "${YELLOW}ℹ USRP B205 Mini not detected${NC}"
fi

echo -e "${GREEN}🔥 GSM Evil Bulletproof Stop completed!${NC}"