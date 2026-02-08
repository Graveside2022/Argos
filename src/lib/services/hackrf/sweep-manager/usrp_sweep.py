#!/usr/bin/env python3
"""
USRP B205 Mini sweep tool that mimics hackrf_sweep output format
This allows the existing UI and parsing logic to work unchanged
"""

import sys
import time
import numpy as np
from gnuradio import gr, uhd, fft, blocks
from gnuradio.fft import window
import signal
import argparse

class USRPSweep(gr.top_block):
    def __init__(self, freq_start, freq_stop, bin_width, gain):
        gr.top_block.__init__(self)
        
        # Calculate parameters
        self.sample_rate = 20e6  # 20 MHz sample rate for B205 Mini
        self.fft_size = int(self.sample_rate / bin_width)
        self.freq_start = freq_start
        self.freq_stop = freq_stop
        self.bin_width = bin_width
        
        # Current frequency
        self.current_freq = freq_start
        self.freq_step = self.sample_rate * 0.8  # 80% overlap
        
        # USRP Source
        self.usrp = uhd.usrp_source(
            ",".join(("", "")),
            uhd.stream_args(
                cpu_format="fc32",
                channels=list(range(1)),
            ),
        )
        self.usrp.set_samp_rate(self.sample_rate)
        self.usrp.set_center_freq(self.current_freq, 0)
        self.usrp.set_gain(gain, 0)
        self.usrp.set_antenna("TX/RX", 0)
        
        # FFT
        self.fft = fft.fft_vcc(self.fft_size, True, window.blackmanharris(self.fft_size), True, 1)
        
        # Complex to Mag^2
        self.c2mag = blocks.complex_to_mag_squared(self.fft_size)
        
        # Stream to Vector
        self.s2v = blocks.stream_to_vector(gr.sizeof_gr_complex, self.fft_size)
        
        # Probe
        self.probe = blocks.probe_vector_f(self.fft_size)
        
        # Connect blocks
        self.connect(self.usrp, self.s2v, self.fft, self.c2mag, self.probe)
        
    def get_spectrum(self):
        """Get current spectrum data and format like hackrf_sweep"""
        # Get FFT data
        data = np.array(self.probe.level())
        
        # Convert to dB
        data_db = 10 * np.log10(data + 1e-20)
        
        # Format output like hackrf_sweep
        # Format: date, time, hz_low, hz_high, hz_bin_width, num_samples, dB, dB, ...
        timestamp = time.time()
        date_str = time.strftime("%Y-%m-%d", time.localtime(timestamp))
        time_str = time.strftime("%H:%M:%S", time.localtime(timestamp))
        
        hz_low = int(self.current_freq - self.sample_rate/2)
        hz_high = int(self.current_freq + self.sample_rate/2)
        
        # Build output line
        output = f"{date_str}, {time_str}, {hz_low}, {hz_high}, {int(self.bin_width)}, {len(data_db)}"
        
        # Add power values
        for val in data_db:
            output += f", {val:.2f}"
            
        return output
        
    def retune(self):
        """Move to next frequency"""
        self.current_freq += self.freq_step
        if self.current_freq > self.freq_stop:
            self.current_freq = self.freq_start
        self.usrp.set_center_freq(self.current_freq, 0)
        time.sleep(0.05)  # Allow settling time

def main():
    parser = argparse.ArgumentParser(description='USRP sweep tool with hackrf_sweep output format')
    parser.add_argument('-f', '--freq', required=True, help='frequency range like min:max')
    parser.add_argument('-g', '--vga_gain', type=int, default=20, help='VGA gain')
    parser.add_argument('-l', '--lna_gain', type=int, default=32, help='LNA gain (averaged with VGA for USRP)')
    parser.add_argument('-w', '--bin_width', type=int, default=20000, help='FFT bin width in Hz')
    parser.add_argument('-n', '--num_sweeps', type=int, default=0, help='Number of sweeps (0=infinite)')
    
    args = parser.parse_args()
    
    # Parse frequency range
    freq_parts = args.freq.split(':')
    freq_start = float(freq_parts[0])
    freq_stop = float(freq_parts[1])
    
    # Average gains for USRP (which has single gain setting)
    gain = (args.vga_gain + args.lna_gain) / 2
    
    # Create sweep object
    sweep = USRPSweep(freq_start, freq_stop, args.bin_width, gain)
    
    # Handle Ctrl+C
    def signal_handler(sig, frame):
        sweep.stop()
        sweep.wait()
        sys.exit(0)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start flowgraph
    sweep.start()
    
    # Main loop
    sweep_count = 0
    try:
        while args.num_sweeps == 0 or sweep_count < args.num_sweeps:
            # Get and print spectrum
            print(sweep.get_spectrum())
            sys.stdout.flush()
            
            # Move to next frequency
            sweep.retune()
            
            # Count sweeps
            if sweep.current_freq <= sweep.freq_start + sweep.freq_step:
                sweep_count += 1
                
            time.sleep(0.01)  # Small delay
            
    except KeyboardInterrupt:
        pass
    finally:
        sweep.stop()
        sweep.wait()

if __name__ == '__main__':
    main()