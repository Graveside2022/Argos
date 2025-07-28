# OpenWebRX Configuration for USRP B205 Mini

# SDR Configuration
sdrs = {
    "usrp_b205": {
        "name": "USRP B205 Mini",
        "type": "soapy_connector",
        "device": "driver=uhd,type=b200",
        "enabled": True,
        "always_up": True,
        "samp_rate": 10000000,
        "center_freq": 100000000,
        "rf_gain": 40,
        "profiles": {
            "fm": {
                "name": "FM Broadcast", 
                "center_freq": 100000000,
                "samp_rate": 2400000,
                "start_freq": 100300000,
                "start_mod": "wfm"
            }
        }
    }
}

# Web interface settings
receiver_name = "Argos USRP B205 Mini"
receiver_location = "Tactical Operations"
receiver_admin = "admin"
start_freq = 100300000
start_mod = "wfm"

# User authentication
users = {
    "admin": {
        "password": "admin",
        "enabled": True,
        "admin": True
    }
}

# Basic web settings
web_port = 8073

