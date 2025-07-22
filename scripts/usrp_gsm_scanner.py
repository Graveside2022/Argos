#!/usr/bin/env python3
"""
USRP B205 Mini GSM Scanner
Uses GNU Radio and gr-gsm to scan for GSM signals with USRP hardware
"""

import sys
import time
import argparse
import subprocess
from gnuradio import gr, blocks
from gnuradio import uhd
from gnuradio import gsm
from gnuradio.gsm import arfcn
from gnuradio import network
import pmt
from math import pi

class USRPGSMScanner(gr.top_block):
    def __init__(self, fc=947.2e6, gain=50, samp_rate=2e6, serverport='4729'):
        gr.top_block.__init__(self, "USRP GSM Scanner")

        ##################################################
        # Variables
        ##################################################
        self.fc = fc
        self.gain = gain
        self.samp_rate = samp_rate
        self.serverport = serverport
        self.osr = 4
        self.ppm = 0
        self.shiftoff = 400e3

        ##################################################
        # Blocks
        ##################################################
        
        # USRP Source
        self.uhd_usrp_source = uhd.usrp_source(
            ",".join(("type=b200", "")),
            uhd.stream_args(
                cpu_format="fc32",
                args='',
                channels=list(range(0,1)),
            ),
        )
        
        # Configure USRP
        self.uhd_usrp_source.set_samp_rate(samp_rate)
        self.uhd_usrp_source.set_center_freq(fc - shiftoff, 0)
        self.uhd_usrp_source.set_gain(gain, 0)
        self.uhd_usrp_source.set_antenna('RX2', 0)
        
        # Frequency correction
        self.blocks_rotator_cc = blocks.rotator_cc(-2*pi*shiftoff/samp_rate)
        
        # GSM input
        self.gsm_input = gsm.gsm_input(
            ppm=self.ppm,
            osr=self.osr,
            fc=fc,
            samp_rate_in=samp_rate,
        )
        
        # GSM receiver
        self.gsm_receiver = gsm.receiver(self.osr, [arfcn.downlink2arfcn(fc)], [], False)
        
        # Control channels decoder
        self.gsm_control_channels_decoder = gsm.control_channels_decoder()
        
        # BCCH demapper
        self.gsm_bcch_ccch_sdcch4_demapper = gsm.gsm_bcch_ccch_sdcch4_demapper(
            timeslot_nr=0,
        )
        
        # Network socket for GSMTAP
        self.network_socket_pdu = network.socket_pdu('UDP_CLIENT', '127.0.0.1', serverport, 1500, False)
        
        # Message printer (optional, for debugging)
        self.gsm_message_printer = gsm.message_printer(pmt.intern(""), False, False, False)
        
        # Clock offset control
        self.gsm_clock_offset_control = gsm.clock_offset_control(fc-shiftoff, samp_rate, self.osr)

        ##################################################
        # Connections
        ##################################################
        self.connect((self.uhd_usrp_source, 0), (self.blocks_rotator_cc, 0))
        self.connect((self.blocks_rotator_cc, 0), (self.gsm_input, 0))
        self.connect((self.gsm_input, 0), (self.gsm_receiver, 0))
        
        self.msg_connect((self.gsm_receiver, 'C0'), (self.gsm_bcch_ccch_sdcch4_demapper, 'bursts'))
        self.msg_connect((self.gsm_receiver, 'measurements'), (self.gsm_clock_offset_control, 'measurements'))
        self.msg_connect((self.gsm_clock_offset_control, 'ctrl'), (self.gsm_input, 'ctrl_in'))
        self.msg_connect((self.gsm_bcch_ccch_sdcch4_demapper, 'bursts'), (self.gsm_control_channels_decoder, 'bursts'))
        self.msg_connect((self.gsm_control_channels_decoder, 'msgs'), (self.network_socket_pdu, 'pdus'))
        self.msg_connect((self.gsm_control_channels_decoder, 'msgs'), (self.gsm_message_printer, 'msgs'))

    def set_fc(self, fc):
        self.fc = fc
        self.uhd_usrp_source.set_center_freq(fc - self.shiftoff, 0)
        self.gsm_input.set_fc(fc)
        self.gsm_clock_offset_control.set_fc(fc - self.shiftoff)

    def set_gain(self, gain):
        self.gain = gain
        self.uhd_usrp_source.set_gain(gain, 0)

def count_gsm_frames(duration=5):
    """Count GSMTAP frames on port 4729"""
    try:
        cmd = f"sudo timeout {duration} tcpdump -i lo -nn port 4729 2>/dev/null | wc -l"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return int(result.stdout.strip())
    except:
        return 0

def scan_frequency(freq_mhz, gain=50, duration=5):
    """Scan a single frequency and return frame count"""
    print(f"Scanning {freq_mhz} MHz with gain {gain}...")
    
    tb = USRPGSMScanner(fc=freq_mhz*1e6, gain=gain)
    tb.start()
    
    # Wait for initialization
    time.sleep(2)
    
    # Count frames
    frames = count_gsm_frames(duration)
    
    tb.stop()
    tb.wait()
    
    return frames

def main():
    parser = argparse.ArgumentParser(description='USRP B205 Mini GSM Scanner')
    parser.add_argument('-f', '--frequency', type=float, default=947.2,
                        help='Frequency in MHz (default: 947.2)')
    parser.add_argument('-g', '--gain', type=float, default=50,
                        help='Gain (default: 50)')
    parser.add_argument('--scan', action='store_true',
                        help='Scan multiple frequencies')
    
    args = parser.parse_args()
    
    if args.scan:
        # Scan common GSM frequencies
        frequencies = [935.2, 937.8, 942.4, 944.0, 947.2, 949.0, 952.6, 957.8]
        results = []
        
        print("Scanning GSM frequencies...")
        for freq in frequencies:
            frames = scan_frequency(freq, args.gain)
            results.append((freq, frames))
            print(f"  {freq} MHz: {frames} frames")
        
        # Find best frequency
        results.sort(key=lambda x: x[1], reverse=True)
        print(f"\nBest frequency: {results[0][0]} MHz with {results[0][1]} frames")
    else:
        # Single frequency mode
        print(f"Starting USRP GSM receiver on {args.frequency} MHz...")
        tb = USRPGSMScanner(fc=args.frequency*1e6, gain=args.gain)
        tb.start()
        
        try:
            input("Press Enter to stop...\n")
        except KeyboardInterrupt:
            pass
        
        tb.stop()
        tb.wait()

if __name__ == '__main__':
    main()