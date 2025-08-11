#!/bin/bash

# Simple reference file that maps wlan1_kismet to your ALFA adapter
# Source this file to use the alias in scripts

# Your ALFA adapter's actual interface name
export WLAN1_KISMET="wlxbee1d69fa811"

# Alias for convenience
alias wlan1_kismet="echo wlxbee1d69fa811"

# Function to use in scripts
get_alfa_interface() {
    echo "wlxbee1d69fa811"
}

# Display current mapping
echo "=== ALFA Adapter Alias Reference ==="
echo "Alias: wlan1_kismet"
echo "Maps to: wlxbee1d69fa811"
echo ""
echo "To use in your scripts:"
echo '  source /home/ubuntu/projects/alfa-alias-reference.sh'
echo '  kismet -c $WLAN1_KISMET'
echo ""
echo "Or in Kismet config:"
echo "  # Just use the actual interface"
echo "  source=wlxbee1d69fa811:type=linuxwifi"
echo "  # Document it with a comment"
echo "  # wlxbee1d69fa811 = wlan1_kismet (ALFA monitoring card)"