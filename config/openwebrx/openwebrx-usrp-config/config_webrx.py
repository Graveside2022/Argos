# OpenWebRX Configuration for USRP B205 mini

receiver_name = "USRP B205 mini"
receiver_location = "Argos SDR Station"
receiver_admin = "admin@localhost"
receiver_gps = {"lat": 0.0, "lon": 0.0}
photo_title = "USRP B205 mini Receiver"
photo_desc = "Software Defined Radio"

sdrhu_key = ""
sdrhu_public_listing = False
server_hostname = "localhost"

sdr_sources = {
    "usrp": {
        "name": "USRP B205 mini",
        "type": "soapy_connector",
        "ppm": 0,
        "device": "driver=uhd,type=b200",
        "direct_sampling": 0,
        "profiles": {
            "70cm": {
                "name": "70cm Amateur Band",
                "center_freq": 435000000,
                "rf_gain": 30,
                "samp_rate": 2400000,
                "start_freq": 434000000,
                "start_mod": "nfm"
            },
            "2m": {
                "name": "2m Amateur Band", 
                "center_freq": 145500000,
                "rf_gain": 30,
                "samp_rate": 2400000,
                "start_freq": 145000000,
                "start_mod": "nfm"
            },
            "gsm900": {
                "name": "GSM 900 Band",
                "center_freq": 935000000,
                "rf_gain": 30,
                "samp_rate": 2400000,
                "start_freq": 935000000,
                "start_mod": "nfm"
            },
            "gsm1800": {
                "name": "GSM 1800 Band",
                "center_freq": 1842500000,
                "rf_gain": 30,
                "samp_rate": 2400000,
                "start_freq": 1842500000,
                "start_mod": "nfm"
            }
        }
    }
}

waterfall_scheme = "GoogleTurboWaterfall"
fft_fps = 20
waterfall_levels = {"min": -90, "max": -50}

EOF < /dev/null