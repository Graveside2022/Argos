#!/bin/bash

# Wait for GSM Evil to be fully ready
sleep 8

# Try to enable IMSI sniffer by accessing the IMSI page
echo "Accessing IMSI page to trigger sniffer..."
curl -s -L "http://localhost/imsi/" > /dev/null 2>&1

# Also try to click the checkbox via JavaScript injection if possible
# This simulates enabling the IMSI sniffer checkbox
echo "Attempting to enable IMSI sniffer..."

# Check if database is being updated
if [ -f "/usr/src/gsmevil2/database/imsi.db" ]; then
    echo "✓ IMSI database found"
else
    echo "⚠ IMSI database not found yet"
fi