#!/usr/bin/env python3
import pyshark
import time
from datetime import datetime

print("=" * 60)
print("REAL-TIME IMSI MONITOR")
print("=" * 60)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("Monitoring GSMTAP on localhost:4729")
print("-" * 60)

# Statistics
stats = {
    'total_packets': 0,
    'ccch_packets': 0,
    'paging_requests': 0,
    'identity_requests': 0,
    'imsi_found': 0,
    'tmsi_found': 0,
    'no_identity': 0
}

capture = pyshark.LiveCapture(interface='lo', bpf_filter='port 4729')

print("Packet# | Time     | Type              | Identity Info")
print("-" * 60)

try:
    for packet in capture:
        stats['total_packets'] += 1
        
        # Check if it's a CCCH packet
        if hasattr(packet, 'gsmtap') and hasattr(packet, 'gsm_a_ccch'):
            stats['ccch_packets'] += 1
            
            # Get message type
            msg_type = None
            identity_info = "No identity"
            
            if hasattr(packet.gsm_a_ccch, 'msg_rr_type'):
                msg_type_val = int(packet.gsm_a_ccch.msg_rr_type)
                
                if msg_type_val == 0x21:  # Paging Request Type 1
                    msg_type = "Paging Request"
                    stats['paging_requests'] += 1
                elif msg_type_val == 0x18:  # Identity Request
                    msg_type = "Identity Request"
                    stats['identity_requests'] += 1
                else:
                    msg_type = f"RR Msg ({hex(msg_type_val)})"
            
            # Check for IMSI
            if hasattr(packet.gsm_a_ccch, 'e212_imsi'):
                identity_info = f"IMSI: {packet.gsm_a_ccch.e212_imsi}"
                stats['imsi_found'] += 1
                print(f"\n*** IMSI CAPTURED: {packet.gsm_a_ccch.e212_imsi} ***\n")
            # Check for TMSI
            elif hasattr(packet.gsm_a_ccch, 'gsm_a_tmsi'):
                identity_info = f"TMSI: {packet.gsm_a_ccch.gsm_a_tmsi}"
                stats['tmsi_found'] += 1
            # Check mobile identity type
            elif hasattr(packet.gsm_a_ccch, 'gsm_a_mobile_id_type'):
                id_type = int(packet.gsm_a_ccch.gsm_a_mobile_id_type)
                if id_type == 0:
                    stats['no_identity'] += 1
                    identity_info = "No Identity"
                elif id_type == 1:
                    identity_info = "IMSI (encrypted?)"
                elif id_type == 4:
                    identity_info = "TMSI/P-TMSI"
            
            if msg_type:
                timestamp = datetime.now().strftime('%H:%M:%S')
                print(f"{stats['total_packets']:6d} | {timestamp} | {msg_type:17s} | {identity_info}")
        
        # Print statistics every 100 packets
        if stats['total_packets'] % 100 == 0:
            print("\n--- Statistics ---")
            print(f"Total packets: {stats['total_packets']}")
            print(f"CCCH packets: {stats['ccch_packets']}")
            print(f"Paging requests: {stats['paging_requests']}")
            print(f"IMSIs found: {stats['imsi_found']}")
            print(f"TMSIs found: {stats['tmsi_found']}")
            print("-" * 60 + "\n")
            
except KeyboardInterrupt:
    print("\n\nMonitoring stopped.")
    print("\n=== Final Statistics ===")
    print(f"Total packets analyzed: {stats['total_packets']}")
    print(f"CCCH packets: {stats['ccch_packets']}")
    print(f"Paging requests: {stats['paging_requests']}")
    print(f"Identity requests: {stats['identity_requests']}")
    print(f"IMSIs captured: {stats['imsi_found']}")
    print(f"TMSIs seen: {stats['tmsi_found']}")
    print(f"No identity packets: {stats['no_identity']}")