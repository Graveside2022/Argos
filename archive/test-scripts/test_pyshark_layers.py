#!/usr/bin/env python3
import pyshark
import time

print("Testing pyshark layer detection on GSMTAP interface...")

# Create capture
capture = pyshark.LiveCapture(interface='lo', bpf_filter='port 4729 and not icmp and udp')

# Set timeout for capture
capture.set_debug()

packet_count = 0
start_time = time.time()

try:
    for packet in capture.sniff_continuously(packet_count=20):
        packet_count += 1
        print(f"\nPacket {packet_count}:")
        
        # Print all layers
        print(f"  Layers: {[layer.layer_name for layer in packet.layers]}")
        
        # Print highest layer
        print(f"  Highest layer: {packet.highest_layer}")
        
        # Check for specific layers
        for layer in packet.layers:
            if hasattr(layer, 'layer_name'):
                print(f"  - Layer: {layer.layer_name}")
                
        # Check for IMSI
        try:
            if hasattr(packet, 'e212'):
                print(f"  *** IMSI FOUND: {packet.e212.imsi}")
        except:
            pass
            
        # Check for GSM_A
        try:
            if 'gsm_a' in str(packet).lower():
                print("  *** Contains GSM_A reference")
        except:
            pass
        
        if time.time() - start_time > 30:
            break
            
except KeyboardInterrupt:
    print("\nStopped by user")
except Exception as e:
    print(f"\nError: {e}")

print(f"\nTotal packets captured: {packet_count}")