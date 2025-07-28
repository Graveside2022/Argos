#!/usr/bin/env python3
import pyshark
import time

print("Testing pyshark IMSI detection on GSMTAP interface...")

# Create capture
capture = pyshark.LiveCapture(interface='lo', bpf_filter='port 4729 and not icmp and udp')

packet_count = 0
imsi_count = 0
start_time = time.time()

try:
    for packet in capture.sniff_continuously(packet_count=100):
        packet_count += 1
        
        # Check highest layer
        if packet.highest_layer == "GSM_A.CCCH":
            # Check for IMSI in this packet
            try:
                # Method 1: Direct attribute
                if hasattr(packet, 'e212') and hasattr(packet.e212, 'imsi'):
                    print(f"\nPacket {packet_count}: IMSI found via e212: {packet.e212.imsi}")
                    imsi_count += 1
            except:
                pass
                
            try:
                # Method 2: Check gsm_a.ccch layer
                if hasattr(packet, 'gsm_a.ccch'):
                    ccch_layer = packet['gsm_a.ccch']
                    # Print all attributes
                    attrs = dir(ccch_layer)
                    imsi_attrs = [a for a in attrs if 'imsi' in a.lower() or 'mobile_id' in a.lower()]
                    if imsi_attrs:
                        print(f"\nPacket {packet_count}: GSM_A.CCCH attributes with IMSI/mobile_id: {imsi_attrs}")
                        for attr in imsi_attrs:
                            try:
                                val = getattr(ccch_layer, attr)
                                print(f"  {attr}: {val}")
                            except:
                                pass
            except Exception as e:
                print(f"Error checking gsm_a.ccch: {e}")
                
            # Method 3: Check all layers for IMSI
            for layer in packet.layers:
                try:
                    if hasattr(layer, 'field_names'):
                        for field in layer.field_names:
                            if 'imsi' in field.lower():
                                print(f"\nPacket {packet_count}: Found IMSI field in layer {layer.layer_name}: {field}")
                                try:
                                    val = getattr(layer, field)
                                    print(f"  Value: {val}")
                                    imsi_count += 1
                                except:
                                    pass
                except:
                    pass
        
        if time.time() - start_time > 30:
            break
            
except KeyboardInterrupt:
    print("\nStopped by user")
except Exception as e:
    print(f"\nError: {e}")

print(f"\nTotal packets captured: {packet_count}")
print(f"Total IMSIs found: {imsi_count}")