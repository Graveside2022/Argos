#!/usr/bin/env python3
"""Simple test to verify USRP can receive GSM signals"""

import subprocess
import time
import sys

def test_frequency(freq_mhz, gain=50):
    """Test a single frequency with grgsm_livemon_headless"""
    print(f"\nTesting {freq_mhz} MHz with gain {gain}...")
    
    # Start grgsm_livemon_headless (it will use RTL-SDR mode but that's ok for testing)
    cmd = f"sudo grgsm_livemon_headless -f {freq_mhz}M -g {gain}"
    print(f"Command: {cmd}")
    
    proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Wait for initialization
    print("Waiting for initialization...")
    time.sleep(3)
    
    # Check if process is still running
    if proc.poll() is not None:
        print("ERROR: Process crashed!")
        return 0
    
    # Count GSMTAP packets
    print("Counting GSMTAP packets for 5 seconds...")
    try:
        result = subprocess.run(
            "sudo timeout 5 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l",
            shell=True,
            capture_output=True,
            text=True
        )
        frames = int(result.stdout.strip())
        print(f"Captured {frames} frames")
    except Exception as e:
        print(f"Error counting frames: {e}")
        frames = 0
    
    # Kill the process
    proc.terminate()
    time.sleep(0.5)
    if proc.poll() is None:
        proc.kill()
    
    return frames

def main():
    print("=== GSM Scanner Test ===")
    print("This will test if grgsm_livemon_headless can detect GSM signals")
    
    # Test common GSM frequencies
    frequencies = [935.2, 937.8, 942.4, 944.0, 947.2, 949.0, 952.6, 957.8]
    gains = [30, 40, 50, 60]
    
    best_freq = None
    best_frames = 0
    
    for gain in gains:
        print(f"\n--- Testing with gain {gain} ---")
        for freq in frequencies:
            frames = test_frequency(freq, gain)
            if frames > best_frames:
                best_frames = frames
                best_freq = freq
            
            if frames > 10:
                print(f"✓ FOUND GSM SIGNAL: {freq} MHz with {frames} frames!")
            
            time.sleep(1)
    
    print("\n=== RESULTS ===")
    if best_freq:
        print(f"Best frequency: {best_freq} MHz with {best_frames} frames")
    else:
        print("No GSM signals detected")
        print("\nTroubleshooting:")
        print("1. Check antenna is connected")
        print("2. Try different gain values")
        print("3. Ensure you're in an area with GSM coverage")
        print("4. Try GSM1800 frequencies (1805-1880 MHz)")

if __name__ == "__main__":
    main()