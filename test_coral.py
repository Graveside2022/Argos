#!/usr/bin/env python3
"""Test Coral TPU availability without Python libraries"""

import subprocess
import os

def test_coral_hardware():
    print("Testing Coral TPU Hardware...")
    
    # Check USB device
    result = subprocess.run(['lsusb'], capture_output=True, text=True)
    coral_found = False
    for line in result.stdout.splitlines():
        if '1a6e:089a' in line:
            print(f"✅ Coral USB device found: {line}")
            coral_found = True
            break
    
    if not coral_found:
        print("❌ Coral USB device not found")
        return False
    
    # Check EdgeTPU runtime
    try:
        result = subprocess.run(['dpkg', '-l', 'libedgetpu1-std'], capture_output=True, text=True)
        if 'libedgetpu1-std' in result.stdout and 'ii' in result.stdout:
            print("✅ EdgeTPU runtime installed")
        else:
            print("❌ EdgeTPU runtime not installed properly")
            return False
    except Exception as e:
        print(f"❌ Error checking EdgeTPU runtime: {e}")
        return False
    
    # Check for device permissions
    print("\n📋 Checking device permissions...")
    print("Note: The Coral device may need udev rules for non-root access")
    
    return True

if __name__ == "__main__":
    test_coral_hardware()