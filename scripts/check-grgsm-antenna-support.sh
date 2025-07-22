#!/bin/bash
# Check grgsm_livemon_headless parameters

echo "Checking grgsm_livemon_headless supported parameters..."
echo

grgsm_livemon_headless --help 2>&1 | grep -E "antenna|args|gain|frequency|sample" -A1 -B1 | head -30

echo
echo "Testing if --antenna parameter works:"
sudo timeout 3 grgsm_livemon_headless --antenna=RX2 -f 947.2M -g 50 2>&1 | head -10

echo
echo "Testing USRP with RX2 antenna in args:"
sudo timeout 3 grgsm_livemon_headless --args="type=b200,antenna=RX2" -f 947.2M -g 50 2>&1 | head -10