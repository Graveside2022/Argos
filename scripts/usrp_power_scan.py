#!/usr/bin/env python3
"""
Real USRP power measurement for GSM scanning
Actually measures RF power levels instead of fake values
"""

import sys
import time
import numpy as np
import subprocess
from gnuradio import gr, blocks, uhd
import argparse

class USRPPowerMeasurement(gr.top_block):
    def __init__(self, freq, gain, samp_rate=2e6):
        gr.top_block.__init__(self, "USRP Power Measurement")
        
        # USRP Source
        self.usrp_source = uhd.usrp_source(
            ",".join(("", "")),
            uhd.stream_args(
                cpu_format="fc32",
                channels=[0],
            ),
        )
        
        # Configure USRP
        self.usrp_source.set_samp_rate(samp_rate)
        self.usrp_source.set_center_freq(freq, 0)
        self.usrp_source.set_gain(gain, 0)
        self.usrp_source.set_antenna("RX2", 0)
        
        # Power calculation blocks
        self.blocks_complex_to_mag_squared = blocks.complex_to_mag_squared(1)
        self.blocks_integrate_ff = blocks.integrate_ff(int(samp_rate * 0.1))  # 100ms integration
        
        # File sink to capture power data
        self.blocks_file_sink = blocks.file_sink(gr.sizeof_float*1, "/tmp/usrp_power.dat", False)
        self.blocks_file_sink.set_unbuffered(False)
        
        # Connections
        self.connect((self.usrp_source, 0), (self.blocks_complex_to_mag_squared, 0))
        self.connect((self.blocks_complex_to_mag_squared, 0), (self.blocks_integrate_ff, 0))
        self.connect((self.blocks_integrate_ff, 0), (self.blocks_file_sink, 0))

def measure_power(freq_mhz, gain=50, duration=2):
    """Measure actual RF power at a frequency"""
    freq_hz = freq_mhz * 1e6
    
    # Create and start flowgraph
    tb = USRPPowerMeasurement(freq_hz, gain)
    tb.start()
    
    # Let it run for specified duration
    time.sleep(duration)
    
    # Stop and read power data
    tb.stop()
    tb.wait()
    
    try:
        # Read power measurements
        with open("/tmp/usrp_power.dat", "rb") as f:
            data = np.fromfile(f, dtype=np.float32)
        
        if len(data) > 0:
            # Convert to dBm (approximate)
            # This is a rough calibration - you may need to adjust
            avg_power_linear = np.mean(data)
            power_db = 10 * np.log10(avg_power_linear + 1e-12) - 60  # Rough calibration
            return power_db
        else:
            return -100.0
            
    except Exception as e:
        print(f"Error reading power data: {e}")
        return -100.0
    finally:
        # Clean up
        subprocess.run(["rm", "-f", "/tmp/usrp_power.dat"], capture_output=True)

def scan_frequencies():
    """Scan GSM frequencies and measure real power levels"""
    # GSM frequencies to test
    frequencies = [935.2, 937.8, 942.4, 944.0, 947.2, 949.0, 952.6, 957.8]
    gains = [40, 50, 60, 70]
    
    print("Scanning GSM frequencies with USRP B205 Mini...")
    print("Freq (MHz)  | Gain 40 | Gain 50 | Gain 60 | Gain 70")
    print("-" * 55)
    
    best_freq = None
    best_power = -100
    
    for freq in frequencies:
        power_readings = []
        
        for gain in gains:
            power = measure_power(freq, gain, duration=1)
            power_readings.append(f"{power:6.1f}")
            
            if power > best_power:
                best_power = power
                best_freq = freq
        
        print(f"{freq:8.1f}    | {' | '.join(power_readings)}")
    
    print("-" * 55)
    print(f"Best signal: {best_freq} MHz at {best_power:.1f} dBm")
    
    return best_freq, best_power

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='USRP Power Scanner')
    parser.add_argument('-f', '--frequency', type=float, 
                       help='Single frequency to measure (MHz)')
    parser.add_argument('-g', '--gain', type=float, default=50,
                       help='Gain in dB')
    parser.add_argument('--scan', action='store_true',
                       help='Scan multiple frequencies')
    
    args = parser.parse_args()
    
    if args.scan:
        scan_frequencies()
    elif args.frequency:
        power = measure_power(args.frequency, args.gain)
        print(f"{args.frequency} MHz: {power:.1f} dBm")
    else:
        print("Use --scan or specify -f frequency")