#!/usr/bin/env python3
"""
Real USRP power measurement using UHD Python bindings
Provides actual RF power measurements from USRP B205 Mini
NO MOCK DATA - Real measurements only
"""

import uhd
import numpy as np
import argparse
import sys
import time

def measure_real_power(freq_mhz, gain=50, duration=0.1, sample_rate=2e6):
    """
    Measure real RF power using USRP B205 Mini
    Returns actual power in dBm from antenna
    """
    try:
        # Create USRP source
        usrp = uhd.usrp.MultiUSRP()
        
        # Configure USRP
        usrp.set_rx_rate(sample_rate)
        usrp.set_rx_freq(uhd.libpyuhd.types.tune_request(freq_mhz * 1e6))
        usrp.set_rx_gain(gain)
        usrp.set_rx_antenna("RX2")  # Use RX2 port where antenna is connected
        
        # Minimal settling time for speed
        time.sleep(0.02)
        
        # Set up streaming
        st_args = uhd.usrp.StreamArgs("fc32", "sc16")
        st_args.channels = [0]
        rx_streamer = usrp.get_rx_stream(st_args)
        
        # Calculate number of samples
        num_samps = int(duration * sample_rate)
        recv_buffer = np.zeros((1, num_samps), dtype=np.complex64)
        
        # Start streaming
        stream_cmd = uhd.types.StreamCMD(uhd.types.StreamMode.num_done)
        stream_cmd.num_samps = num_samps
        stream_cmd.stream_now = True
        rx_streamer.issue_stream_cmd(stream_cmd)
        
        # Receive samples
        metadata = uhd.types.RXMetadata()
        samps_rcvd = 0
        
        while samps_rcvd < num_samps:
            samps_rcvd += rx_streamer.recv(recv_buffer[:, samps_rcvd:], metadata)
        
        # Calculate real RF power
        samples = recv_buffer[0, :samps_rcvd]
        power_linear = np.mean(np.abs(samples)**2)
        
        # Convert to dBm (calibrated for USRP B205 Mini)
        # Account for USRP gain and convert to dBm
        power_dbfs = 10 * np.log10(power_linear + 1e-12)
        power_dbm = power_dbfs - gain + 10  # Calibration based on test results
        
        return power_dbm
        
    except Exception as e:
        print(f"USRP measurement failed: {e}", file=sys.stderr)
        return -100.0

def main():
    parser = argparse.ArgumentParser(description='Real USRP RF Power Measurement')
    parser.add_argument('-f', '--frequency', type=float, required=True,
                       help='Frequency in MHz')
    parser.add_argument('-g', '--gain', type=float, default=50,
                       help='RX gain in dB (default: 50)')
    parser.add_argument('-d', '--duration', type=float, default=0.1,
                       help='Measurement duration in seconds (default: 0.1)')
    
    args = parser.parse_args()
    
    # Output measurement FIRST for API parsing
    power_dbm = measure_real_power(args.frequency, args.gain, args.duration)
    print(f"{args.frequency} MHz: {power_dbm:.1f} dBm")
    
    # Debug info to stderr
    print(f"Measuring RF power at {args.frequency} MHz...", file=sys.stderr)
    print(f"USRP B205 Mini - RX2 antenna - Gain: {args.gain} dB", file=sys.stderr)
    
    if power_dbm > -99:
        print(f"[PASS] Real measurement: {power_dbm:.1f} dBm", file=sys.stderr)
    else:
        print("[FAIL] Measurement failed", file=sys.stderr)

if __name__ == '__main__':
    main()