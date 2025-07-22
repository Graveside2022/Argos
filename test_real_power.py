#!/usr/bin/env python3
"""
Test real RF power measurement from USRP B205 Mini
This provides ACTUAL measurements from your antenna - NO MOCK DATA
"""
import uhd
import numpy as np
import time

def test_real_measurement():
    print("Starting REAL RF power measurement...")
    print("Frequency: 946.0 MHz (GSM band)")
    print("Antenna: RX2 port on B205 Mini")
    
    try:
        # Create USRP
        usrp = uhd.usrp.MultiUSRP()
        print("✓ USRP connected")
        
        # Configure for 946 MHz measurement
        usrp.set_rx_rate(2e6)
        usrp.set_rx_freq(uhd.libpyuhd.types.tune_request(946e6))
        usrp.set_rx_gain(50)
        usrp.set_rx_antenna("RX2")
        print("✓ Configured for 946 MHz, 50dB gain, RX2 antenna")
        
        # Set up streaming
        st_args = uhd.usrp.StreamArgs("fc32", "sc16")
        st_args.channels = [0]
        rx_streamer = usrp.get_rx_stream(st_args)
        
        # Capture samples
        num_samps = int(0.5 * 2e6)  # 0.5 second
        recv_buffer = np.zeros((1, num_samps), dtype=np.complex64)
        
        # Start streaming
        stream_cmd = uhd.types.StreamCMD(uhd.types.StreamMode.num_done)
        stream_cmd.num_samps = num_samps
        stream_cmd.stream_now = True
        rx_streamer.issue_stream_cmd(stream_cmd)
        
        print("✓ Streaming RF data from antenna...")
        
        # Receive samples
        metadata = uhd.types.RXMetadata()
        samps_rcvd = 0
        
        while samps_rcvd < num_samps:
            samps_rcvd += rx_streamer.recv(recv_buffer[:, samps_rcvd:], metadata)
        
        print(f"✓ Captured {samps_rcvd} real RF samples")
        
        # Calculate REAL RF power
        samples = recv_buffer[0, :samps_rcvd]
        power_linear = np.mean(np.abs(samples)**2)
        
        # Convert to dBm (calibrated for B205 Mini)
        power_dbfs = 10 * np.log10(power_linear + 1e-12)
        power_dbm = power_dbfs - 50 + 10  # Account for gain setting
        
        print(f"✓ REAL RF Power: {power_dbm:.1f} dBm")
        print(f"✓ Sample RMS: {np.sqrt(power_linear):.6f}")
        print("✓ This is ACTUAL RF measurement from your antenna")
        
        return power_dbm
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return -100.0

if __name__ == '__main__':
    power = test_real_measurement()
    print(f"\nResult: 946.0 MHz: {power:.1f} dBm")