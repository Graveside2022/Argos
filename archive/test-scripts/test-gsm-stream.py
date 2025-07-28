#!/usr/bin/env python3
"""Test script to analyze GSM stream and understand why no IMSIs are captured"""

import pyshark
import signal
import sys

def signal_handler(sig, frame):
    print('\nStopping capture...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

print("Analyzing GSM stream on localhost:4729...")
print("Press Ctrl+C to stop\n")

# Statistics
stats = {
    'total_packets': 0,
    'gsm_a_ccch': 0,
    'paging_requests': 0,
    'mobile_id_types': {},
    'imsi_found': 0,
    'tmsi_found': 0,
    'messages': {}
}

try:
    capture = pyshark.LiveCapture(interface='lo', bpf_filter='port 4729 and udp')
    
    for packet in capture:
        stats['total_packets'] += 1
        
        # Check layers
        for layer in packet.layers:
            if layer.layer_name == 'gsm_a.ccch':
                stats['gsm_a_ccch'] += 1
                
                # Check for message type
                if hasattr(layer, 'gsm_a_dtap_msg_rr_type'):
                    msg_type = layer.gsm_a_dtap_msg_rr_type
                    msg_name = layer.get_field_value('gsm_a_dtap_msg_rr_type')
                    
                    if msg_name not in stats['messages']:
                        stats['messages'][msg_name] = 0
                    stats['messages'][msg_name] += 1
                    
                    # Check for paging request (0x21)
                    if msg_type == '0x21':
                        stats['paging_requests'] += 1
                
                # Check for mobile identity type
                if hasattr(layer, 'gsm_a_mobile_id_type'):
                    id_type = layer.gsm_a_mobile_id_type
                    if id_type not in stats['mobile_id_types']:
                        stats['mobile_id_types'][id_type] = 0
                    stats['mobile_id_types'][id_type] += 1
                
                # Check for IMSI
                if hasattr(layer, 'e212_imsi'):
                    stats['imsi_found'] += 1
                    print(f"IMSI found: {layer.e212_imsi}")
                
                # Check for TMSI
                if hasattr(layer, 'gsm_a_rr_tmsi_ptmsi') or hasattr(layer, 'gsm_a_tmsi'):
                    stats['tmsi_found'] += 1
        
        # Print stats every 100 packets
        if stats['total_packets'] % 100 == 0:
            print(f"\n--- Stats after {stats['total_packets']} packets ---")
            print(f"GSM A CCCH packets: {stats['gsm_a_ccch']}")
            print(f"Paging requests: {stats['paging_requests']}")
            print(f"IMSIs found: {stats['imsi_found']}")
            print(f"TMSIs found: {stats['tmsi_found']}")
            print(f"Mobile ID types: {stats['mobile_id_types']}")
            print(f"Message types: {stats['messages']}")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\nFinal statistics:")
for key, value in stats.items():
    print(f"{key}: {value}")