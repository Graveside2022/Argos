#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Working USRP B205 Mini GSM receiver for gr-gsm
This actually uses UHD source instead of osmosdr
"""

from gnuradio import blocks
from gnuradio import gr
from gnuradio import uhd
import sys
import signal
from argparse import ArgumentParser
from gnuradio import eng_notation
from gnuradio import gsm
import pmt
from gnuradio import network
from gnuradio.gsm import arfcn
from math import pi
import time

class grgsm_livemon_usrp(gr.top_block):
    def __init__(self, fc=947.2e6, gain=50, samp_rate=2e6, ppm=0, 
                 serverport='4729', shiftoff=400e3, osr=4):
        gr.top_block.__init__(self, "USRP GSM Receiver")

        ##################################################
        # Variables
        ##################################################
        self.fc = fc
        self.gain = gain
        self.samp_rate = samp_rate
        self.serverport = serverport
        self.shiftoff = shiftoff
        self.osr = osr
        self.ppm = ppm

        ##################################################
        # Create USRP source - THIS IS THE KEY DIFFERENCE
        ##################################################
        self.uhd_usrp_source = uhd.usrp_source(
            ",".join(("", "")),  # Empty string for auto-detection
            uhd.stream_args(
                cpu_format="fc32",
                args='',
                channels=list(range(0,1)),
            ),
        )
        
        # Configure USRP
        self.uhd_usrp_source.set_samp_rate(samp_rate)
        print(f"Actual sample rate: {self.uhd_usrp_source.get_samp_rate()/1e6:.2f} MHz")
        
        self.uhd_usrp_source.set_center_freq(fc - shiftoff, 0)
        print(f"Tuned to {self.uhd_usrp_source.get_center_freq(0)/1e6:.2f} MHz")
        
        self.uhd_usrp_source.set_gain(gain, 0)
        print(f"Gain set to {self.uhd_usrp_source.get_gain(0)} dB")
        
        # Use RX2 antenna on B205 mini
        self.uhd_usrp_source.set_antenna("RX2", 0)
        print(f"Using antenna: {self.uhd_usrp_source.get_antenna(0)}")
        
        # Set bandwidth
        self.uhd_usrp_source.set_bandwidth(250e3 + abs(shiftoff), 0)
        
        ##################################################
        # GSM receiver blocks
        ##################################################
        self.gsm_receiver_0 = gsm.receiver(osr, [arfcn.downlink2arfcn(fc)], [], False)
        self.gsm_input_0 = gsm.gsm_input(
            ppm=ppm,
            osr=osr,
            fc=fc,
            samp_rate_in=samp_rate,
        )
        self.gsm_clock_offset_control_0 = gsm.clock_offset_control(fc-shiftoff, samp_rate, osr)
        
        self.blocks_rotator_cc_0 = blocks.rotator_cc(-2*pi*shiftoff/samp_rate)
        
        # Add signal probe for signal strength measurement
        self.blocks_probe_signal_vf = blocks.probe_signal_vf(1024)
        self.blocks_complex_to_mag_squared_0 = blocks.complex_to_mag_squared(1)
        
        self.gsm_control_channels_decoder_0 = gsm.control_channels_decoder()
        self.gsm_control_channels_decoder_0_0 = gsm.control_channels_decoder()
        self.gsm_bcch_ccch_sdcch4_demapper_0 = gsm.gsm_bcch_ccch_sdcch4_demapper(
            timeslot_nr=0,
        )
        self.gsm_sdcch8_demapper_0 = gsm.gsm_sdcch8_demapper(
            timeslot_nr=1,
        )
        self.gsm_decryption_0 = gsm.decryption([], 1)
        self.gsm_message_printer_1 = gsm.message_printer(pmt.intern(""), False,
            False, False)
        
        # Network output
        self.network_socket_pdu_0 = network.socket_pdu('UDP_CLIENT', '127.0.0.1', serverport, 1500, False)
        self.network_socket_pdu_1 = network.socket_pdu('UDP_SERVER', '127.0.0.1', serverport, 1500, False)

        ##################################################
        # Connections
        ##################################################
        self.connect((self.uhd_usrp_source, 0), (self.blocks_rotator_cc_0, 0))
        self.connect((self.blocks_rotator_cc_0, 0), (self.gsm_input_0, 0))
        self.connect((self.gsm_input_0, 0), (self.gsm_receiver_0, 0))
        
        # Connect signal strength measurement
        self.connect((self.gsm_input_0, 0), (self.blocks_complex_to_mag_squared_0, 0))
        self.connect((self.blocks_complex_to_mag_squared_0, 0), (self.blocks_probe_signal_vf, 0))
        
        self.msg_connect((self.gsm_receiver_0, 'C0'), (self.gsm_bcch_ccch_sdcch4_demapper_0, 'bursts'))
        self.msg_connect((self.gsm_receiver_0, 'C0'), (self.gsm_sdcch8_demapper_0, 'bursts'))
        self.msg_connect((self.gsm_receiver_0, 'measurements'), (self.gsm_clock_offset_control_0, 'measurements'))
        self.msg_connect((self.gsm_clock_offset_control_0, 'ctrl'), (self.gsm_input_0, 'ctrl_in'))
        self.msg_connect((self.gsm_bcch_ccch_sdcch4_demapper_0, 'bursts'), (self.gsm_control_channels_decoder_0, 'bursts'))
        self.msg_connect((self.gsm_sdcch8_demapper_0, 'bursts'), (self.gsm_decryption_0, 'bursts'))
        self.msg_connect((self.gsm_decryption_0, 'bursts'), (self.gsm_control_channels_decoder_0_0, 'bursts'))
        self.msg_connect((self.gsm_control_channels_decoder_0, 'msgs'), (self.gsm_message_printer_1, 'msgs'))
        self.msg_connect((self.gsm_control_channels_decoder_0, 'msgs'), (self.network_socket_pdu_0, 'pdus'))
        self.msg_connect((self.gsm_control_channels_decoder_0, 'msgs'), (self.network_socket_pdu_1, 'pdus'))
        self.msg_connect((self.gsm_control_channels_decoder_0_0, 'msgs'), (self.gsm_message_printer_1, 'msgs'))
        self.msg_connect((self.gsm_control_channels_decoder_0_0, 'msgs'), (self.network_socket_pdu_0, 'pdus'))
        self.msg_connect((self.gsm_control_channels_decoder_0_0, 'msgs'), (self.network_socket_pdu_1, 'pdus'))

    def get_fc(self):
        return self.fc

    def set_fc(self, fc):
        self.fc = fc
        self.gsm_clock_offset_control_0.set_fc(self.fc-self.shiftoff)
        self.gsm_input_0.set_fc(self.fc)
        self.uhd_usrp_source.set_center_freq(self.fc-self.shiftoff, 0)

    def get_gain(self):
        return self.gain

    def set_gain(self, gain):
        self.gain = gain
        self.uhd_usrp_source.set_gain(self.gain, 0)

    def get_samp_rate(self):
        return self.samp_rate

    def set_samp_rate(self, samp_rate):
        self.samp_rate = samp_rate
        self.blocks_rotator_cc_0.set_phase_inc(-2*pi*self.shiftoff/self.samp_rate)
        self.gsm_clock_offset_control_0.set_samp_rate(self.samp_rate)
        self.gsm_input_0.set_samp_rate_in(self.samp_rate)
        self.uhd_usrp_source.set_samp_rate(self.samp_rate)
    
    def get_signal_level(self):
        return self.blocks_probe_signal_vf.level()

def argument_parser():
    parser = ArgumentParser()
    parser.add_argument(
        "--args", dest="args", type=str, default="",
        help="UHD device args (ignored for compatibility)")
    parser.add_argument(
        "-f", "--fc", dest="fc", type=eng_notation.str_to_num, default="947.2M",
        help="Set center frequency [default=%(default)r]")
    parser.add_argument(
        "-g", "--gain", dest="gain", type=eng_notation.str_to_num, default="50",
        help="Set gain [default=%(default)r]")
    parser.add_argument(
        "-p", "--ppm", dest="ppm", type=eng_notation.str_to_num, default="0",
        help="Set ppm [default=%(default)r]")
    parser.add_argument(
        "-s", "--samp-rate", dest="samp_rate", type=eng_notation.str_to_num, default="2000000",
        help="Set sample rate [default=%(default)r]")
    parser.add_argument(
        "-o", "--serverport", dest="serverport", type=str, default="4729",
        help="Set server port [default=%(default)r]")
    parser.add_argument(
        "-b", "--shiftoff", dest="shiftoff", type=eng_notation.str_to_num, default="400e3",
        help="Set shift offset [default=%(default)r]")
    parser.add_argument(
        "--osr", dest="osr", type=int, default=4,
        help="Set OSR [default=%(default)r]")
    return parser

def main(top_block_cls=grgsm_livemon_usrp, options=None):
    parser = argument_parser()
    options = parser.parse_args()
    
    print(f"Starting USRP GSM receiver on {options.fc/1e6:.1f} MHz with gain {options.gain}")
    
    tb = top_block_cls(
        fc=options.fc,
        gain=options.gain,
        samp_rate=options.samp_rate,
        ppm=options.ppm,
        serverport=options.serverport,
        shiftoff=options.shiftoff,
        osr=options.osr
    )
    
    def sig_handler(sig=None, frame=None):
        tb.stop()
        tb.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    print("Starting flowgraph...")
    tb.start()
    
    try:
        tb.wait()
    except KeyboardInterrupt:
        pass
    
    tb.stop()
    tb.wait()

if __name__ == '__main__':
    main()