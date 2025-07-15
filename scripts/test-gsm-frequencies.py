#!/usr/bin/env python3
"""
Test multiple GSM frequencies for IMSI activity
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
    time.sleep(2)  # Give it time to start
    
    # Initialize counters
    results = {
        'frequency': freq,
        'paging_requests': 0,
        'identity_requests': 0,
        'imsi_found': [],
        'tmsi_found': [],
        'total_packets': 0
    }
    
    try:
        # Create capture filter for GSMTAP
        print("Starting packet capture...")
        capture = pyshark.LiveCapture(
            interface='lo',
            display_filter='gsmtap',
            output_file=f'/tmp/gsm_capture_{freq}.pcap'
        )
        
        # Set timeout for capture
        capture.set_debug()
        start_time = time.time()
        
        for packet in capture.sniff_continuously():
            results['total_packets'] += 1
            
            try:
                # Check for paging requests
                if hasattr(packet, 'gsm_a') and hasattr(packet.gsm_a, 'dtap_msg_rr_type'):
                    msg_type = int(packet.gsm_a.dtap_msg_rr_type)
                    
                    if msg_type == 0x21:  # Paging Request Type 1
                        results['paging_requests'] += 1
                        print(f"  [PAGING] Type 1 detected")
                    elif msg_type == 0x22:  # Paging Request Type 2
                        results['paging_requests'] += 1
                        print(f"  [PAGING] Type 2 detected")
                    elif msg_type == 0x18:  # Identity Request
                        results['identity_requests'] += 1
                        print(f"  [IDENTITY] Request detected")
                
                # Check for IMSI
                if hasattr(packet, 'gsm_a') and hasattr(packet.gsm_a, 'imsi'):
                    imsi = packet.gsm_a.imsi
                    if imsi and imsi not in results['imsi_found']:
                        results['imsi_found'].append(imsi)
                        print(f"  [IMSI FOUND] {imsi}")
                
                # Check for TMSI
                if hasattr(packet, 'gsm_a') and hasattr(packet.gsm_a, 'tmsi'):
                    tmsi = packet.gsm_a.tmsi
                    if tmsi and tmsi not in results['tmsi_found']:
                        results['tmsi_found'].append(tmsi)
                        print(f"  [TMSI] {tmsi}")
                        
            except Exception as e:
                # Continue on packet parsing errors
                pass
            
            # Check if test duration exceeded
            if time.time() - start_time >= TEST_DURATION:
                break
                
    except Exception as e:
        print(f"Capture error: {e}")
    
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
    print(f"  Paging requests: {results['paging_requests']}")
    print(f"  Identity requests: {results['identity_requests']}")
    print(f"  IMSI found: {len(results['imsi_found'])} - {results['imsi_found']}")
    print(f"  TMSI found: {len(results['tmsi_found'])}")
    
    return results

def main():
    """Main test function"""
    print("GSM Frequency Scanner for IMSI Activity")
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
            break
        except Exception as e:
            print(f"Error testing {freq} MHz: {e}")
    
    # Summary report
    print("\n" + "="*60)
    print("SUMMARY REPORT")
    print("="*60)
    
    if all_results:
        # Find best frequency
        best_freq = max(all_results, key=lambda x: x['paging_requests'] + len(x['imsi_found']) * 10)
        
        print("\nActivity summary by frequency:")
        for r in all_results:
            score = r['paging_requests'] + len(r['imsi_found']) * 10
            print(f"\n{r['frequency']} MHz:")
            print(f"  Activity score: {score}")
            print(f"  Packets: {r['total_packets']}")
            print(f"  Paging: {r['paging_requests']}")
            print(f"  Identity: {r['identity_requests']}")
            print(f"  IMSI captured: {len(r['imsi_found'])}")
            if r['imsi_found']:
                print(f"  IMSIs: {', '.join(r['imsi_found'])}")
        
        print(f"\n{'='*60}")
        print(f"BEST FREQUENCY: {best_freq['frequency']} MHz")
        print(f"Reason: {best_freq['paging_requests']} paging requests, {len(best_freq['imsi_found'])} IMSI captures")
        print(f"{'='*60}")

if __name__ == "__main__":
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    main()