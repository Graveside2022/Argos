#!/usr/bin/env python3
"""Test if pyshark can capture GSMTAP packets from grgsm_livemon"""

import pyshark
import time

def test_gsmtap_capture():
    print("Testing GSMTAP packet capture on loopback interface...")
    
    # Create capture on loopback interface, port 4729
    try:
        capture = pyshark.LiveCapture(
            interface='lo',
            bpf_filter='udp port 4729',
            display_filter='gsmtap'
        )
        
        print("Starting packet capture for 10 seconds...")
        packets_found = 0
        
        # Capture packets for 10 seconds
        timeout = time.time() + 10
        for packet in capture.sniff_continuously():
            packets_found += 1
            print(f"\nPacket {packets_found} captured:")
            print(f"  Timestamp: {packet.sniff_time}")
            
            # Check if it's a GSMTAP packet
            if hasattr(packet, 'gsmtap'):
                print("  GSMTAP packet detected!")
                if hasattr(packet.gsmtap, 'type'):
                    print(f"  Type: {packet.gsmtap.type}")
                if hasattr(packet.gsmtap, 'channel_type'):
                    print(f"  Channel: {packet.gsmtap.channel_type}")
                    
            # Check for GSM_A or GSM_SMS layers
            if hasattr(packet, 'gsm_a'):
                print("  GSM_A layer detected!")
                if hasattr(packet.gsm_a, 'dtap'):
                    print(f"  DTAP: {packet.gsm_a.dtap}")
                    
            if hasattr(packet, 'gsm_sms'):
                print("  GSM_SMS layer detected!")
                
            if time.time() > timeout:
                break
                
        print(f"\nTotal packets captured: {packets_found}")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure grgsm_livemon_headless is running")
        print("2. Check if you have permission to capture on loopback")
        print("3. Try running with sudo if needed")

if __name__ == "__main__":
    test_gsmtap_capture()