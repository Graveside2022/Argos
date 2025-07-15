#!/usr/bin/env python3

import pyshark
import time
import signal
import sys
from collections import defaultdict

# Stats tracking
stats = defaultdict(int)
imsi_list = set()
channel_types = defaultdict(int)

def signal_handler(sig, frame):
    print("\n\nCapture Statistics:")
    print("=" * 50)
    print(f"Total packets: {stats['total']}")
    print(f"CCCH packets: {stats['ccch']}")
    print(f"Paging requests: {stats['paging']}")
    print(f"System Info: {stats['sysinfo']}")
    print(f"IMSI captures: {len(imsi_list)}")
    
    print("\nChannel Types Seen:")
    for chan_type, count in sorted(channel_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  Type {chan_type}: {count} packets")
    
    if imsi_list:
        print("\nCaptured IMSIs:")
        for imsi in sorted(imsi_list):
            print(f"  {imsi}")
    else:
        print("\nNo IMSIs captured")
    
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

print("Monitoring GSMTAP interface on localhost:4729")
print("Press Ctrl+C to stop and see statistics")
print("=" * 50)

# Create capture
try:
    capture = pyshark.LiveCapture(
        interface='lo',
        bpf_filter='port 4729',
        use_json=True,
        include_raw=True
    )
    
    # Process packets
    for packet in capture.sniff_continuously():
        stats['total'] += 1
        
        try:
            # Check if it's a GSMTAP packet
            if hasattr(packet, 'gsmtap'):
                # Track channel type
                if hasattr(packet.gsmtap, 'chan_type'):
                    chan_type = int(packet.gsmtap.chan_type)
                    channel_types[chan_type] += 1
                    
                    # CCCH is channel type 1
                    if chan_type == 1:
                        stats['ccch'] += 1
                
                # Try to extract message type and content
                if hasattr(packet, 'gsm_a'):
                    # Check for paging request
                    if hasattr(packet.gsm_a, 'dtap_msg_rr_type'):
                        msg_type = int(packet.gsm_a.dtap_msg_rr_type)
                        
                        # Paging Request Type 1 = 0x21
                        if msg_type == 0x21:
                            stats['paging'] += 1
                            print(f"[{time.strftime('%H:%M:%S')}] Paging Request Type 1")
                            
                            # Try to extract IMSI from paging
                            if hasattr(packet.gsm_a, 'imsi'):
                                imsi = packet.gsm_a.imsi
                                if imsi and imsi not in imsi_list:
                                    imsi_list.add(imsi)
                                    print(f"  *** NEW IMSI: {imsi} ***")
                        
                        # System Information messages
                        elif msg_type in [0x19, 0x1a, 0x1b, 0x1c]:
                            stats['sysinfo'] += 1
                    
                    # Look for IMSI in any part of the packet
                    if hasattr(packet.gsm_a, 'imsi'):
                        imsi = packet.gsm_a.imsi
                        if imsi and imsi not in imsi_list:
                            imsi_list.add(imsi)
                            print(f"[{time.strftime('%H:%M:%S')}] *** NEW IMSI: {imsi} ***")
                
                # Check for LAPDm frames that might contain IMSI
                if hasattr(packet, 'lapdm'):
                    if hasattr(packet.lapdm, 'payload'):
                        # Look for Identity Request/Response
                        pass
                
                # Print progress every 100 packets
                if stats['total'] % 100 == 0:
                    print(f"[{time.strftime('%H:%M:%S')}] Processed {stats['total']} packets, {len(imsi_list)} IMSIs found")
                    
        except Exception as e:
            print(f"Error processing packet: {e}")
            continue

except Exception as e:
    print(f"Capture error: {e}")
    signal_handler(None, None)