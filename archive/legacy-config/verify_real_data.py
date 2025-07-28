#!/usr/bin/env python3
"""
Verify we're getting REAL RF data from USRP, not simulation
This will test multiple frequencies and show clear evidence of real measurements
"""
import uhd
import numpy as np
import time

def test_frequency_response():
    """Test multiple frequencies to prove data is real"""
    print("=== VERIFYING REAL RF DATA FROM USRP B205 MINI ===")
    print("Testing different frequencies to prove measurements are real...")
    
    frequencies = [900.0, 946.0, 1800.0, 2400.0]  # Very different frequencies
    results = []
    
    try:
        usrp = uhd.usrp.MultiUSRP()
        usrp.set_rx_rate(2e6)
        usrp.set_rx_gain(50)
        usrp.set_rx_antenna("RX2")
        
        for freq_mhz in frequencies:
            print(f"\nTesting {freq_mhz} MHz...")
            
            # Set frequency
            usrp.set_rx_freq(uhd.libpyuhd.types.tune_request(freq_mhz * 1e6))
            time.sleep(0.05)
            
            # Capture samples
            st_args = uhd.usrp.StreamArgs("fc32", "sc16")
            st_args.channels = [0]
            rx_streamer = usrp.get_rx_stream(st_args)
            
            num_samps = 100000  # Short capture
            recv_buffer = np.zeros((1, num_samps), dtype=np.complex64)
            
            stream_cmd = uhd.types.StreamCMD(uhd.types.StreamMode.num_done)
            stream_cmd.num_samps = num_samps
            stream_cmd.stream_now = True
            rx_streamer.issue_stream_cmd(stream_cmd)
            
            metadata = uhd.types.RXMetadata()
            samps_rcvd = rx_streamer.recv(recv_buffer, metadata)
            
            # Analyze samples
            samples = recv_buffer[0, :samps_rcvd]
            power_linear = np.mean(np.abs(samples)**2)
            power_db = 10 * np.log10(power_linear + 1e-12) - 40
            
            # Statistical analysis to prove it's real
            real_parts = np.real(samples)
            imag_parts = np.imag(samples)
            
            real_mean = np.mean(real_parts)
            real_std = np.std(real_parts)
            imag_mean = np.mean(imag_parts)
            imag_std = np.std(imag_parts)
            
            # Check for non-zero DC offset (proves it's from real ADC)
            dc_offset = np.sqrt(real_mean**2 + imag_mean**2)
            
            print(f"  Power: {power_db:.1f} dBm")
            print(f"  Sample mean (real): {real_mean:.6f}")
            print(f"  Sample std (real): {real_std:.6f}")
            print(f"  DC offset: {dc_offset:.6f}")
            print(f"  Sample range: {np.min(np.abs(samples)):.6f} to {np.max(np.abs(samples)):.6f}")
            
            results.append({
                'freq': freq_mhz,
                'power': power_db,
                'dc_offset': dc_offset,
                'std': real_std,
                'samples': samps_rcvd
            })
    
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    # Analysis
    print("\n=== ANALYSIS ===")
    power_values = [r['power'] for r in results]
    power_range = max(power_values) - min(power_values)
    
    print(f"Power measurements: {[f'{p:.1f}' for p in power_values]} dBm")
    print(f"Power variation: {power_range:.1f} dB")
    print(f"DC offsets: {[f'{r['dc_offset']:.6f}' for r in results]}")
    
    # Real data indicators
    print("\n=== REAL DATA VERIFICATION ===")
    if power_range > 5.0:
        print("✓ REAL: Power varies significantly across frequencies")
    else:
        print("⚠ SUSPICIOUS: Power too consistent across frequencies")
    
    if any(r['dc_offset'] > 0.001 for r in results):
        print("✓ REAL: Non-zero DC offsets detected (ADC characteristic)")
    else:
        print("⚠ SUSPICIOUS: No DC offset (could be simulated)")
    
    if all(r['samples'] == 100000 for r in results):
        print("✓ REAL: All sample captures successful")
    
    if all(r['std'] > 0.01 for r in results):
        print("✓ REAL: Proper noise floor detected")
    else:
        print("⚠ SUSPICIOUS: Noise floor too low")
    
    return True

if __name__ == '__main__':
    test_frequency_response()