# OpenWebRX Configuration for USRP B205 Mini
# Auto-starting configuration - no login required

# SDR Configuration - device starts automatically
sdrs = {
    "usrp_auto": {
        "name": "USRP B205 Mini", 
        "type": "uhd",
        "device": "serial=32B0765",
        "enabled": True,
        "always_up": True,  # Keep device always running
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

# Receiver settings - auto-start at 100.3 MHz FM
receiver_name = "Argos USRP B205 Mini"
receiver_location = "Tactical Operations"
receiver_admin = "admin"
start_freq = 100300000  # 100.3 MHz
start_mod = "wfm"       # Wide FM

# No authentication required
users = {}

# Web interface settings
web_port = 8073
max_clients = 20

# Waterfall settings for immediate display
waterfall_levels = (-88, -20)
fft_fps = 4

# Auto-enable features
digimodes_enable = True
aprs_symbols_path = "/usr/share/aprs-symbols/png"