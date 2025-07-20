#!/usr/bin/env python3
"""
Simple RTL_433 test to verify it works without web interface interference
"""
import subprocess
import time
import json
import signal
import sys

def signal_handler(sig, frame):
    print('Stopping RTL_433...')
    if 'rtl_process' in globals():
        rtl_process.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Start RTL_433 process
rtl_process = subprocess.Popen([
    'rtl_433',
    '-f', '868M',
    '-F', 'json',
    '-M', 'time:iso',
    '-M', 'protocol',
    '-M', 'level'
], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)

print("RTL_433 started successfully")
print("Monitoring 868 MHz for signals...")
print("Press Ctrl+C to stop")
print("-" * 50)

try:
    while True:
        line = rtl_process.stdout.readline()
        if line:
            line = line.strip()
            try:
                # Try to parse as JSON signal
                signal_data = json.loads(line)
                print(f"SIGNAL: {signal_data}")
            except json.JSONDecodeError:
                # Regular console output
                print(f"CONSOLE: {line}")
        
        # Check if process is still running
        if rtl_process.poll() is not None:
            print("RTL_433 process ended")
            break
            
except KeyboardInterrupt:
    print("\nStopping...")
    rtl_process.terminate()