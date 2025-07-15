#!/usr/bin/env python3

import subprocess
import re
import time
import signal
import sys
from datetime import datetime

class IMSIHunter:
    def __init__(self):
        self.imsi_set = set()
        self.tmsi_set = set()
        self.packet_count = 0
        self.start_time = time.time()
        
    def signal_handler(self, sig, frame):
        self.print_summary()
        sys.exit(0)
        
    def print_summary(self):
        runtime = time.time() - self.start_time
        print("\n" + "="*60)
        print("IMSI Hunter Summary")
        print("="*60)
        print(f"Runtime: {runtime:.1f} seconds")
        print(f"Total packets analyzed: {self.packet_count}")
        print(f"Unique IMSIs found: {len(self.imsi_set)}")
        print(f"Unique TMSIs found: {len(self.tmsi_set)}")
        
        if self.imsi_set:
            print("\nCaptured IMSIs:")
            for imsi in sorted(self.imsi_set):
                print(f"  - {imsi}")
        else:
            print("\nNo IMSIs captured")
            
        if self.tmsi_set:
            print(f"\nSample TMSIs (first 5):")
            for tmsi in list(sorted(self.tmsi_set))[:5]:
                print(f"  - {tmsi}")
    
    def run(self):
        print("IMSI Hunter - Advanced GSM monitoring")
        print("="*60)
        print("Monitoring on localhost:4729")
        print("Press Ctrl+C to stop\n")
        
        signal.signal(signal.SIGINT, self.signal_handler)
        
        # Start tshark with specific fields
        cmd = [
            'sudo', 'tshark',
            '-i', 'lo',
            '-f', 'port 4729',
            '-Y', 'gsmtap',
            '-T', 'fields',
            '-e', 'frame.time',
            '-e', 'gsmtap.chan_type',
            '-e', 'gsm_a.imsi',
            '-e', 'gsm_a.tmsi',
            '-e', 'gsm_a.dtap.msg_rr_type',
            '-e', 'gsm_a.dtap.msg_mm_type',
            '-e', 'gsm_a.dtap.msg_cc_type',
            '-E', 'separator=|'
        ]
        
        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            
            for line in process.stdout:
                self.packet_count += 1
                parts = line.strip().split('|')
                
                if len(parts) >= 7:
                    timestamp = parts[0]
                    chan_type = parts[1]
                    imsi = parts[2]
                    tmsi = parts[3]
                    rr_type = parts[4]
                    mm_type = parts[5]
                    cc_type = parts[6]
                    
                    # Check for IMSI
                    if imsi and imsi.strip():
                        if imsi not in self.imsi_set:
                            self.imsi_set.add(imsi)
                            print(f"[{datetime.now().strftime('%H:%M:%S')}] *** NEW IMSI CAPTURED: {imsi} ***")
                            print(f"  Channel Type: {chan_type}")
                            if mm_type:
                                print(f"  MM Message Type: {mm_type}")
                    
                    # Check for TMSI
                    if tmsi and tmsi.strip() and tmsi != "0x00000000":
                        if tmsi not in self.tmsi_set:
                            self.tmsi_set.add(tmsi)
                            if len(self.tmsi_set) <= 5:  # Only print first 5
                                print(f"[{datetime.now().strftime('%H:%M:%S')}] New TMSI: {tmsi}")
                    
                    # Check for Identity Request (MM type 0x18)
                    if mm_type == "24":  # 0x18 in decimal
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Identity Request detected!")
                    
                    # Check for Identity Response (MM type 0x19)
                    if mm_type == "25":  # 0x19 in decimal
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Identity Response detected!")
                    
                    # Progress update every 1000 packets
                    if self.packet_count % 1000 == 0:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Processed {self.packet_count} packets...")
                        
        except KeyboardInterrupt:
            self.print_summary()
        except Exception as e:
            print(f"Error: {e}")
            self.print_summary()

if __name__ == "__main__":
    hunter = IMSIHunter()
    hunter.run()