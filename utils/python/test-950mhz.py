#!/usr/bin/env python3
"""
Test 950.0 MHz specifically for GSM traffic type
"""

import subprocess
import time
import sys
import pyshark
from datetime import datetime

def test_950_mhz():
    """Test 950.0 MHz to identify traffic type"""
    print("Testing 950.0 MHz for GSM traffic type...")
    print("="*60)
    
    # Kill existing processes
    subprocess.run(['sudo', 'pkill', '-9', 'grgsm'], capture_output=True)
    time.sleep(1)
    
    # Start grgsm_livemon_headless with RTL-SDR (fallback to default)
    cmd = ['sudo', 'grgsm_livemon_headless', '-f', '950.0M', '-g', '45']
    print(f"Starting: {' '.join(cmd)}")
    
    grgsm_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(5)  # Give it time to start
    
    # Counters for different channel types
    channel_types = {}
    message_types = {}
    bcch_info = []
    ccch_info = []
    
    try:
        print("\nCapturing packets for 20 seconds...")
        capture = pyshark.LiveCapture(
            interface='lo',
            bpf_filter='port 4729',
            use_json=True,
            include_raw=True
        )
        
        packet_count = 0
        start_time = time.time()
        
        timeout_time = start_time + 20
        
        for packet in capture.sniff_continuously():
            if time.time() > timeout_time:
                break
            packet_count += 1
            
            try:
                # Check GSMTAP layer
                if hasattr(packet, 'gsmtap'):
                    # Channel type
                    if hasattr(packet.gsmtap, 'channel_type'):
                        chan_type = str(packet.gsmtap.channel_type)
                        channel_types[chan_type] = channel_types.get(chan_type, 0) + 1
                        
                        # Log BCCH packets
                        if 'BCCH' in chan_type:
                            bcch_info.append(f"BCCH at {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
                            if len(bcch_info) <= 3:  # Show first 3
                                print(f"  [BCCH] Broadcast Control Channel detected")
                        
                        # Log CCCH packets
                        elif 'CCCH' in chan_type:
                            ccch_info.append(f"CCCH at {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
                            if len(ccch_info) <= 3:  # Show first 3
                                print(f"  [CCCH] Common Control Channel detected - THIS CAN CARRY IMSI!")
                    
                    # Frame number and timeslot
                    if hasattr(packet.gsmtap, 'frame_number'):
                        if packet_count == 1:
                            print(f"  Frame number: {packet.gsmtap.frame_number}")
                    
                    if hasattr(packet.gsmtap, 'timeslot'):
                        if packet_count == 1:
                            print(f"  Timeslot: {packet.gsmtap.timeslot}")
                
                # Check GSM_A layer for message types
                if hasattr(packet, 'gsm_a'):
                    if hasattr(packet.gsm_a, 'dtap_msg_rr_type'):
                        msg_type = str(packet.gsm_a.dtap_msg_rr_type)
                        message_types[msg_type] = message_types.get(msg_type, 0) + 1
                        
                        # Check for paging
                        if '0x21' in msg_type:
                            print(f"  [PAGING TYPE 1] Detected - checking for IMSI...")
                        elif '0x22' in msg_type:
                            print(f"  [PAGING TYPE 2] Detected")
                    
                    # Look for IMSI
                    if hasattr(packet.gsm_a, 'imsi'):
                        print(f"  [*** IMSI FOUND ***] {packet.gsm_a.imsi}")
                
                # Check GSM_A_CCCH layer
                if hasattr(packet, 'gsm_a_ccch'):
                    print(f"  [GSM_A_CCCH] Layer present")
                
                # Print progress
                if packet_count % 100 == 0:
                    elapsed = time.time() - start_time
                    print(f"  Processed {packet_count} packets in {elapsed:.1f}s...")
                    
            except Exception as e:
                pass
                
        print(f"\nCapture complete. Total packets: {packet_count}")
        
    except Exception as e:
        print(f"\nCapture ended: {e}")
    
    finally:
        # Stop grgsm
        grgsm_proc.terminate()
        try:
            grgsm_proc.wait(timeout=2)
        except:
            grgsm_proc.kill()
    
    # Print analysis
    print("\n" + "="*60)
    print("TRAFFIC ANALYSIS FOR 950.0 MHz")
    print("="*60)
    
    print("\nChannel Type Distribution:")
    for chan_type, count in sorted(channel_types.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / packet_count * 100) if packet_count > 0 else 0
        print(f"  {chan_type}: {count} packets ({percentage:.1f}%)")
    
    print(f"\nMessage Type Distribution:")
    for msg_type, count in sorted(message_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {msg_type}: {count} messages")
    
    print(f"\nChannel Analysis:")
    print(f"  BCCH (Broadcast) packets: {len(bcch_info)}")
    print(f"  CCCH (Common Control) packets: {len(ccch_info)}")
    
    print("\nDIAGNOSIS:")
    if len(bcch_info) > len(ccch_info) * 10:
        print("  - This appears to be primarily a BROADCAST channel (BCCH)")
        print("  - BCCH carries system information but NOT paging with IMSI")
        print("  - This is likely why no IMSI captures are occurring")
        print("  - You need to find the CCCH channel for this cell")
    elif len(ccch_info) > 0:
        print("  - CCCH traffic detected - this SHOULD carry paging with IMSI")
        print("  - If no IMSI found, possible reasons:")
        print("    1. No active paging at this moment")
        print("    2. Network using TMSI instead of IMSI")
        print("    3. Need longer capture duration")
    else:
        print("  - No clear GSM control channels detected")
        print("  - This might be a data-only channel or different standard")
    
    print("\nRECOMMENDATIONS:")
    print("  1. Try scanning nearby frequencies (±0.2 MHz)")
    print("  2. Use grgsm_scanner to find all active cells")
    print("  3. Look for frequencies with high CCCH activity")
    print("  4. Consider that some networks minimize IMSI usage")

if __name__ == "__main__":
    test_950_mhz()