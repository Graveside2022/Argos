#!/bin/bash

# Wrapper script to start GSM Evil with CORS support

cd /usr/src/gsmevil2

# Apply the patch to the main file directly
sed -i 's/socketio = SocketIO(app)/socketio = SocketIO(app, cors_allowed_origins="*")/' GsmEvil_auto.py

# Start GSM Evil with CORS enabled
exec sudo bash -c "source venv/bin/activate && python3 GsmEvil_auto.py --host 0.0.0.0 --port 80"