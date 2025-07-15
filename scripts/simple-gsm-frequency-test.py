#!/usr/bin/env python3
"""
Simple GSM frequency scanner for IMSI activity
"""

import subprocess
import time
import signal
import sys
import pyshark
from datetime import datetime

# Frequencies to test (in MHz)
FREQUENCIES = [948.6, 949.0, 957.6]
TEST_DURATION = 10  # seconds per frequency

def kill_existing_grgsm():
    """Kill any existing grgsm processes"""
    print("Killing existing grgsm processes...")
    subprocess.run(['sudo', 'pkill', '-9', 'grgsm'], capture_output=True)
    subprocess.run(['sudo', 'pkill', '-9', 'gr-gsm'], capture_output=True)
    time.sleep(1)

def test_frequency(freq):
    """Test a single frequency for IMSI activity"""
    print(f"\n{'='*60}")
    print(f"Testing frequency: {freq} MHz")
    print(f"Start time: {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}")
    
    # Start grgsm_livemon_headless
    cmd = ['sudo', 'grgsm_livemon_headless', '-f', f'{freq}M', '-g', '45']
    print(f"Starting: {' '.join(cmd)}")
    
    grgsm_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(3)  # Give it more time to start
    
    # Initialize counters
    results = {
        'frequency': freq,
        'paging_requests': 0,
        'identity_requests': 0,
        'imsi_found': [],
        'tmsi_found': [],
        'total_packets': 0,
        'ccch_packets': 0
    }
    
    try:
        # Simple capture without saving to file
        print("Starting packet capture (no file saving)...")
        capture = pyshark.LiveCapture(
            interface='lo',
            display_filter='gsmtap'
        )
        
        # Capture packets for the duration
        start_time = time.time()
        timeout_time = start_time + TEST_DURATION
        
        def packet_callback(packet):
            results['total_packets'] += 1
            
            try:
                # Check if it's a CCCH packet
                if hasattr(packet, 'gsmtap') and hasattr(packet.gsmtap, 'channel_type'):
                    if 'CCCH' in str(packet.gsmtap.channel_type):
                        results['ccch_packets'] += 1
                
                # Look for GSM_A layer
                if hasattr(packet, 'gsm_a'):
                    # Check message type
                    if hasattr(packet.gsm_a, 'dtap_msg_rr_type'):
                        msg_type = str(packet.gsm_a.dtap_msg_rr_type)
                        if '0x21' in msg_type or 'Paging Request Type 1' in str(packet):
                            results['paging_requests'] += 1
                            print(f"  [PAGING] Type 1 detected at {datetime.now().strftime('%H:%M:%S')}")
                        elif '0x22' in msg_type or 'Paging Request Type 2' in str(packet):
                            results['paging_requests'] += 1
                            print(f"  [PAGING] Type 2 detected at {datetime.now().strftime('%H:%M:%S')}")
                    
                    # Look for IMSI
                    if hasattr(packet.gsm_a, 'imsi'):
                        imsi = str(packet.gsm_a.imsi)
                        if imsi and imsi not in results['imsi_found']:
                            results['imsi_found'].append(imsi)
                            print(f"  [*** IMSI FOUND ***] {imsi}")
                    
                    # Look for identity in any field
                    for field in ['id_digit', 'identity_digit', 'mobile_identity']:
                        if hasattr(packet.gsm_a, field):
                            print(f"  [IDENTITY FIELD] {field}: {getattr(packet.gsm_a, field)}")
                
            except Exception as e:
                # Continue on errors
                pass
        
        # Use apply_on_packets with timeout
        capture.apply_on_packets(packet_callback, timeout=TEST_DURATION)
            
    except Exception as e:
        print(f"Capture completed or error: {e}")
    
    finally:
        # Stop grgsm process
        grgsm_proc.terminate()
        try:
            grgsm_proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            grgsm_proc.kill()
    
    # Print results summary
    print(f"\nResults for {freq} MHz:")
    print(f"  Total packets captured: {results['total_packets']}")
    print(f"  CCCH packets: {results['ccch_packets']}")
    print(f"  Paging requests: {results['paging_requests']}")
    print(f"  Identity requests: {results['identity_requests']}")
    print(f"  IMSI found: {len(results['imsi_found'])} - {results['imsi_found']}")
    print(f"  TMSI found: {len(results['tmsi_found'])}")
    
    return results

def main():
    """Main test function"""
    print("Simple GSM Frequency Scanner for IMSI Activity")
    print("=" * 60)
    
    # Kill existing processes
    kill_existing_grgsm()
    
    # Test each frequency
    all_results = []
    for freq in FREQUENCIES:
        try:
            result = test_frequency(freq)
            all_results.append(result)
            time.sleep(2)  # Brief pause between frequencies
        except KeyboardInterrupt:
            print("\nTest interrupted by user")
            kill_existing_grgsm()
            break
        except Exception as e:
            print(f"Error testing {freq} MHz: {e}")
    
    # Summary report
    print("\n" + "="*60)
    print("SUMMARY REPORT")
    print("="*60)
    
    if all_results:
        # Find best frequency based on activity
        best_freq = max(all_results, key=lambda x: (
            len(x['imsi_found']) * 100 +  # IMSIs are most valuable
            x['paging_requests'] * 10 +    # Paging shows activity
            x['ccch_packets']              # General channel activity
        ))
        
        print("\nActivity summary by frequency:")
        for r in all_results:
            score = len(r['imsi_found']) * 100 + r['paging_requests'] * 10 + r['ccch_packets']
            print(f"\n{r['frequency']} MHz:")
            print(f"  Activity score: {score}")
            print(f"  Total packets: {r['total_packets']}")
            print(f"  CCCH packets: {r['ccch_packets']}")
            print(f"  Paging requests: {r['paging_requests']}")
            print(f"  IMSI captured: {len(r['imsi_found'])}")
            if r['imsi_found']:
                print(f"  IMSIs: {', '.join(r['imsi_found'])}")
        
        print(f"\n{'='*60}")
        print(f"BEST FREQUENCY: {best_freq['frequency']} MHz")
        print(f"Activity: {best_freq['ccch_packets']} CCCH, {best_freq['paging_requests']} paging, {len(best_freq['imsi_found'])} IMSIs")
        print(f"{'='*60}")
    
    # Final cleanup
    kill_existing_grgsm()

if __name__ == "__main__":
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, lambda s, f: (kill_existing_grgsm(), sys.exit(0)))
    main()