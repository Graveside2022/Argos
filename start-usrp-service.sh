#\!/bin/bash
# Simple USRP streaming service
echo "Starting USRP streaming service..."
python3 -m http.server 8074 &
HTTP_PID=$\!

# Run a simple USRP monitoring loop
while true; do
    python3 /home/ubuntu/projects/Argos/scripts/usrp_simple_scanner.py -f 900 -g 30
    sleep 5
done
EOF && chmod +x start-usrp-service.sh < /dev/null