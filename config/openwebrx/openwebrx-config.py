# OpenWebRX Configuration for USRP B205 Mini
# Auto-start configuration for immediate operation

sdrs = {
    "usrp_b205": {
        "name": "USRP B205 Mini",
        "type": "soapy_connector",
        "device": "driver=uhd,type=b200",
        "enabled": True,
        "always_up": True,
        "gain": {
            "PGA": 40
        },
        "samp_rate": 10000000,
        "center_freq": 100000000,
        "rf_gain": 40,
        "profiles": {
            "default": {
                "name": "Wide Spectrum",
                "center_freq": 100000000,
                "samp_rate": 10000000,
                "start_freq": 100300000,
                "start_mod": "wfm"
            }
        }
    }
}

# Web interface configuration
web_port = 8073
receiver_name = "Argos USRP B205 Mini"
receiver_location = "Tactical Operations"
receiver_asl = 0
receiver_admin = "admin"
receiver_gps = [0.0, 0.0]
photo_title = "Argos Tactical SDR"
photo_desc = "USRP B205 Mini Software Defined Radio"

# Auto-start settings
start_freq = 100300000
start_mod = "wfm"

# User authentication
users = {
    "admin": {
        "password": "admin",
        "admin": True
    }
}