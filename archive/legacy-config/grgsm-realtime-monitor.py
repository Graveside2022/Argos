#!/usr/bin/env python3
"""
Real-time monitor for grgsm_livemon GSMTAP data stream
Shows how to tap into the data stream and extract information
"""

import pyshark
import time
import signal
import sys
from datetime import datetime
import threading

class GrgsmMonitor:
    def __init__(self):
        self.running = True
        self.packet_count = 0
        self.rssi_readings = []
        self.arfcn_set = set()
        
    def signal_handler(self, sig, frame):
        print('\nStopping monitor...')
        self.running = False
        sys.exit(0)
        
    def process_packet(self, packet):
        """Process a single GSMTAP packet"""
        try:
            if hasattr(packet, 'gsmtap'):
                self.packet_count += 1
                
                # Extract RSSI
                if hasattr(packet.gsmtap, 'signal_dbm'):
                    rssi = int(packet.gsmtap.signal_dbm)
                    self.rssi_readings.append(rssi)
                    
                # Extract ARFCN (frequency channel)
                if hasattr(packet.gsmtap, 'arfcn'):
                    arfcn = int(packet.gsmtap.arfcn)
                    self.arfcn_set.add(arfcn)
                    
                # Extract frame number
                frame_nr = None
                if hasattr(packet.gsmtap, 'frame_nr'):
                    frame_nr = int(packet.gsmtap.frame_nr)
                    
                # Check for specific GSM layers
                layer_info = ""
                if hasattr(packet, 'gsm_a'):
                    layer_info = "GSM_A"
                elif hasattr(packet, 'gsm_sms'):
                    layer_info = "GSM_SMS"
                elif hasattr(packet, 'gsm_ccch'):
                    layer_info = "GSM_CCCH"
                    
                # Print real-time info every 10 packets
                if self.packet_count % 10 == 0:
                    avg_rssi = sum(self.rssi_readings[-100:]) / len(self.rssi_readings[-100:]) if self.rssi_readings else 0
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                          f"Packets: {self.packet_count} | "
                          f"RSSI: {rssi} dBm (avg: {avg_rssi:.1f}) | "
                          f"ARFCN: {arfcn} | "
                          f"Frame: {frame_nr} | "
                          f"Layer: {layer_info}")
                    
        except Exception as e:
            pass  # Silently ignore packet processing errors
            
    def print_summary(self):
        """Print summary statistics"""
        print("\n" + "="*60)
        print("GRGSM Monitor Summary")
        print("="*60)
        print(f"Total packets captured: {self.packet_count}")
        
        if self.rssi_readings:
            print(f"\nRSSI Statistics:")
            print(f"  Min: {min(self.rssi_readings)} dBm")
            print(f"  Max: {max(self.rssi_readings)} dBm")
            print(f"  Avg: {sum(self.rssi_readings)/len(self.rssi_readings):.1f} dBm")
            print(f"  Samples: {len(self.rssi_readings)}")
            
        if self.arfcn_set:
            print(f"\nARFCN channels detected: {sorted(self.arfcn_set)}")
            
    def start_monitoring(self):
        """Start monitoring GSMTAP packets"""
        print("="*60)
        print("GRGSM Real-time Monitor")
        print("="*60)
        print("Monitoring GSMTAP packets on localhost:4729")
        print("Press Ctrl+C to stop\n")
        
        # Set up signal handler
        signal.signal(signal.SIGINT, self.signal_handler)
        
        try:
            # Create capture on loopback interface for GSMTAP
            capture = pyshark.LiveCapture(
                interface='lo',
                bpf_filter='udp port 4729',
                display_filter='gsmtap'
            )
            
            # Start capturing packets
            for packet in capture.sniff_continuously():
                if not self.running:
                    break
                self.process_packet(packet)
                
        except Exception as e:
            print(f"Error: {e}")
            print("\nTroubleshooting:")
            print("1. Make sure grgsm_livemon_headless is running")
            print("2. Check if running with correct permissions (may need sudo)")
            print("3. Verify no other program is using port 4729")
            
        finally:
            self.print_summary()

def main():
    # Check if grgsm_livemon is running
    import subprocess
    try:
        result = subprocess.run(['pgrep', '-f', 'grgsm_livemon'], 
                              capture_output=True, text=True)
        if not result.stdout:
            print("Warning: grgsm_livemon_headless doesn't appear to be running!")
            print("Start it with: grgsm_livemon_headless -f 947.2M -g 40 --collector 127.0.0.1 --collectorport 4729")
            print()
    except:
        pass
        
    # Start monitoring
    monitor = GrgsmMonitor()
    monitor.start_monitoring()

if __name__ == "__main__":
    main()