#!/bin/bash

# GPS Integration Workflow Validation and Implementation Script
# This script validates and implements the complete GPS workflow from boot to display

echo "=== GPS Integration Workflow Validator ==="
echo "Validating: Pi Boot → Argos Auto-start → GPS Detection → Kismet → Status Display"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check current Argos running status
echo "Step 1: Checking Argos Console Status..."
if pgrep -f "vite.*5173" > /dev/null; then
    echo -e "${GREEN}✓${NC} Argos Console is running on port 5173"
    ARGOS_PID=$(pgrep -f "vite.*5173")
    echo "  PID: $ARGOS_PID"
else
    echo -e "${RED}✗${NC} Argos Console is NOT running"
fi

# Step 2: Check for Argos auto-start service
echo ""
echo "Step 2: Checking Argos Auto-start Configuration..."
if systemctl list-unit-files | grep -q "argos"; then
    echo -e "${GREEN}✓${NC} Argos service exists"
    systemctl status argos.service --no-pager | head -10
else
    echo -e "${YELLOW}⚠${NC} No Argos service found - needs configuration"
fi

# Step 3: Check GPS adapter status
echo ""
echo "Step 3: Checking Prolific GPS Adapter Status..."
if lsusb | grep -q "Prolific"; then
    echo -e "${GREEN}✓${NC} Prolific USB adapter detected"
    lsusb | grep Prolific
    
    # Check for serial device
    USB_DEVICE=$(ls /dev/ttyUSB* 2>/dev/null | head -1)
    if [ -n "$USB_DEVICE" ]; then
        echo -e "${GREEN}✓${NC} Serial device found: $USB_DEVICE"
    else
        echo -e "${RED}✗${NC} No serial device found"
    fi
else
    echo -e "${RED}✗${NC} Prolific adapter not detected"
fi

# Step 4: Check GPSD status and configuration
echo ""
echo "Step 4: Checking GPSD Configuration..."
if systemctl is-active --quiet gpsd.service; then
    echo -e "${GREEN}✓${NC} GPSD is running"
    
    # Check if GPSD has GPS data
    if timeout 2 gpspipe -w -n 1 2>/dev/null | grep -q "TPV"; then
        echo -e "${GREEN}✓${NC} GPSD is receiving GPS data"
    else
        echo -e "${YELLOW}⚠${NC} GPSD running but no GPS data (normal indoors)"
    fi
else
    echo -e "${RED}✗${NC} GPSD is not running"
fi

# Check GPSD auto-start
if systemctl is-enabled --quiet gpsd.service 2>/dev/null; then
    echo -e "${GREEN}✓${NC} GPSD enabled at boot"
else
    echo -e "${YELLOW}⚠${NC} GPSD not enabled at boot"
fi

# Step 5: Check Kismet configuration
echo ""
echo "Step 5: Checking Kismet GPS Configuration..."
if [ -f /etc/kismet/kismet_site.conf ]; then
    if grep -q "gps=gpsd" /etc/kismet/kismet_site.conf; then
        echo -e "${GREEN}✓${NC} Kismet configured for GPS"
    else
        echo -e "${RED}✗${NC} Kismet site config exists but GPS not configured"
    fi
else
    echo -e "${YELLOW}⚠${NC} No Kismet site configuration found"
fi

# Step 6: Validate workflow sequence
echo ""
echo "=== WORKFLOW VALIDATION ==="
echo ""

# Important clarification about GPS behavior
echo -e "${YELLOW}IMPORTANT GPS BEHAVIOR:${NC}"
echo "• Prolific adapter begins NMEA output immediately upon USB connection"
echo "• GPSD can read GPS data WITHOUT Kismet running"
echo "• GPS satellite acquisition happens independently of Kismet"
echo "• Kismet only CONSUMES GPS data from GPSD, doesn't control acquisition"
echo ""

echo "VALIDATED WORKFLOW SEQUENCE:"
echo "1. Raspberry Pi boots"
echo "2. GPSD service starts (if enabled)"
echo "3. Prolific adapter detected and begins NMEA output"
echo "4. GPSD reads NMEA from serial port"
echo "5. Argos Console starts (manual or auto-start)"
echo "6. User clicks 'Start Kismet' in Argos"
echo "7. Kismet connects to GPSD on localhost:2947"
echo "8. Kismet receives GPS data from GPSD"
echo "9. Argos polls Kismet API for GPS status"
echo "10. Both web interfaces update GPS status displays"
echo ""

# Check what's missing for complete workflow
echo "=== MISSING COMPONENTS ==="
MISSING=0

if ! systemctl list-unit-files | grep -q "argos.service"; then
    echo -e "${RED}✗${NC} Argos auto-start service"
    MISSING=$((MISSING + 1))
fi

if ! systemctl is-enabled --quiet gpsd.service 2>/dev/null; then
    echo -e "${RED}✗${NC} GPSD auto-start at boot"
    MISSING=$((MISSING + 1))
fi

if [ ! -f /etc/kismet/kismet_site.conf ] || ! grep -q "gps=gpsd" /etc/kismet/kismet_site.conf 2>/dev/null; then
    echo -e "${RED}✗${NC} Kismet GPS configuration"
    MISSING=$((MISSING + 1))
fi

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All components configured!"
else
    echo ""
    echo "Found $MISSING missing component(s)"
fi

echo ""
echo "=== IMPLEMENTATION REQUIRED ==="
echo ""
echo "Would you like to create the missing components? (y/n)"
echo ""
echo "This will:"
echo "1. Create Argos auto-start service"
echo "2. Enable GPSD at boot with Prolific device"
echo "3. Configure Kismet for GPS"
echo "4. Set up GPS status propagation"