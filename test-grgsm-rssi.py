#!/usr/bin/env python3
"""Extract RSSI information from grgsm_livemon GSMTAP packets"""

import pyshark
import time
import json
from datetime import datetime

def extract_rssi_from_gsmtap():
    print("Extracting RSSI from GSMTAP packets...")
    
    try:
        # Create capture on loopback interface for GSMTAP
        capture = pyshark.LiveCapture(
            interface='lo',
            bpf_filter='udp port 4729',
            display_filter='gsmtap'
        )
        
        print("Starting RSSI extraction for 10 seconds...")
        rssi_data = []
        
        timeout = time.time() + 10
        for packet in capture.sniff_continuously():
            if time.time() > timeout:
                break
                
            try:
                # GSMTAP packets contain signal strength info
                if hasattr(packet, 'gsmtap'):
                    packet_info = {
                        'timestamp': str(packet.sniff_time),
                        'type': packet.gsmtap.type if hasattr(packet.gsmtap, 'type') else None,
                    }
                    
                    # Try to get signal strength (RSSI) - it might be in different fields
                    if hasattr(packet.gsmtap, 'signal_dbm'):
                        packet_info['rssi'] = int(packet.gsmtap.signal_dbm)
                    elif hasattr(packet.gsmtap, 'signal_level'):
                        packet_info['rssi'] = int(packet.gsmtap.signal_level)
                    elif hasattr(packet.gsmtap, 'signal_strength'):
                        packet_info['rssi'] = int(packet.gsmtap.signal_strength)
                    
                    # Try to get frequency/ARFCN
                    if hasattr(packet.gsmtap, 'arfcn'):
                        packet_info['arfcn'] = int(packet.gsmtap.arfcn)
                    if hasattr(packet.gsmtap, 'frequency'):
                        packet_info['frequency'] = float(packet.gsmtap.frequency)
                    
                    # Try to get frame number
                    if hasattr(packet.gsmtap, 'frame_number'):
                        packet_info['frame_number'] = int(packet.gsmtap.frame_number)
                    
                    # Print all available fields for debugging
                    if len(rssi_data) == 0:  # Only print fields for first packet
                        print("\nAvailable GSMTAP fields:")
                        for field in dir(packet.gsmtap):
                            if not field.startswith('_'):
                                try:
                                    value = getattr(packet.gsmtap, field)
                                    print(f"  {field}: {value}")
                                except:
                                    pass
                    
                    # Only add if we got RSSI
                    if 'rssi' in packet_info:
                        rssi_data.append(packet_info)
                        print(f"RSSI: {packet_info['rssi']} dBm at {packet_info['timestamp']}")
                    
            except Exception as e:
                continue
        
        print(f"\nTotal packets with RSSI: {len(rssi_data)}")
        
        # Save to JSON file
        if rssi_data:
            with open('/tmp/grgsm_rssi_data.json', 'w') as f:
                json.dump(rssi_data, f, indent=2)
            print(f"RSSI data saved to /tmp/grgsm_rssi_data.json")
            
            # Print summary
            rssi_values = [p['rssi'] for p in rssi_data if 'rssi' in p]
            if rssi_values:
                print(f"\nRSSI Summary:")
                print(f"  Min: {min(rssi_values)} dBm")
                print(f"  Max: {max(rssi_values)} dBm")
                print(f"  Avg: {sum(rssi_values)/len(rssi_values):.1f} dBm")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure grgsm_livemon_headless is running")
        print("2. Run with sudo if permission denied")

if __name__ == "__main__":
    extract_rssi_from_gsmtap()