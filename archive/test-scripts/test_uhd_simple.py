#!/usr/bin/env python3
import uhd
import numpy as np
import sys

try:
    print("Creating USRP object...")
    usrp = uhd.usrp.MultiUSRP()
    print("✓ USRP created successfully")
    
    print("Setting RX rate to 2 MSPS...")
    usrp.set_rx_rate(2e6)
    print("✓ RX rate set")
    
    print("Setting frequency to 946 MHz...")
    usrp.set_rx_freq(uhd.libpyuhd.types.tune_request(946e6))
    print("✓ Frequency set")
    
    print("Setting gain to 50 dB...")
    usrp.set_rx_gain(50)
    print("✓ Gain set")
    
    print("Setting antenna to RX2...")
    usrp.set_rx_antenna("RX2")
    print("✓ Antenna set")
    
    print("USRP configuration successful!")
    print("Ready for real RF measurements")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)