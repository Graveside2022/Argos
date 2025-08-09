#!/bin/bash

# USRP B205 Mini Firmware CRLF Fix for UHD 4.6.0 on ARM64
# Quick one-line fix for the ihex_reader CRLF line ending bug

set -e

ORIGINAL="/usr/share/uhd/images/usrp_b200_fw.hex"
BACKUP="$ORIGINAL.backup.$(date +%Y%m%d_%H%M%S)"

echo "USRP B205 Mini Firmware CRLF Fix"
echo "==============================="
echo "Target: UHD 4.6.0 ihex_reader ARM64 CRLF bug"
echo

# Verify the issue exists
if ! file "$ORIGINAL" | grep -q "CRLF"; then
    echo "✅ No CRLF issue detected - firmware already has LF line endings"
    echo "Testing USRP detection..."
    if timeout 10 uhd_find_devices 2>&1 | grep -q "B20"; then
        echo "✅ USRP B205 Mini already working"
        exit 0
    else
        echo "❌ USRP not detected - issue may be different"
        exit 1
    fi
fi

echo "🚨 CRLF line endings detected in firmware file"
echo "This causes UHD 4.6.0 ihex_reader to fail on ARM64"
echo

# Apply fix
echo "Creating backup: $BACKUP"
cp "$ORIGINAL" "$BACKUP"

echo "Converting CRLF → LF..."
sed -i 's/\r$//' "$ORIGINAL"

echo "Testing fix..."
if timeout 15 uhd_find_devices 2>&1 | grep -q "B20"; then
    echo "✅ SUCCESS! USRP B205 Mini now detected"
    echo "Firmware CRLF line ending bug resolved"
    echo
    echo "The device is ready for GSM scanning operations"
else
    echo "❌ FAILED: USRP still not detected"
    echo "Restoring backup..."
    cp "$BACKUP" "$ORIGINAL"
    echo "Issue may be more complex than line endings"
    exit 1
fi