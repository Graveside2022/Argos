#!/usr/bin/env python3
"""
Convert JSON configuration to OpenWebRX Python config and start OpenWebRX
"""

import json
import os
import sys
import subprocess

def convert_json_to_python_config():
    """Convert JSON config files to Python configuration"""
    
    settings_file = '/var/lib/openwebrx/settings.json'
    sdrs_file = '/var/lib/openwebrx/sdrs.json'
    config_file = '/etc/openwebrx/config_webrx.py'
    
    if not os.path.exists(settings_file) or not os.path.exists(sdrs_file):
        print("JSON config files not found, using default configuration")
        return
    
    try:
        # Load JSON configs
        with open(settings_file, 'r') as f:
            settings = json.load(f)
        with open(sdrs_file, 'r') as f:
            sdr_config = json.load(f)
        
        # Generate Python config
        config_lines = [
            "# Auto-generated from JSON config",
            f"receiver_name = '{settings.get('receiver_name', 'OpenWebRX')}'",
            f"receiver_location = '{settings.get('receiver_location', 'Unknown')}'",
            f"waterfall_scheme = '{settings.get('waterfall_scheme', 'GoogleTurboWaterfall')}'",
            f"fft_fps = {settings.get('fft_fps', 25)}",
            f"audio_compression = '{settings.get('audio_compression', 'none')}'",
            "web_port = 8073",
            "",
            "sdrs = {"
        ]
        
        # Add SDR configurations
        for sdr_id, sdr_data in sdr_config.get('sdrs', {}).items():
            if sdr_data.get('enabled', False):
                config_lines.append(f"    '{sdr_id}': {{")
                config_lines.append(f"        'name': '{sdr_data.get('name', sdr_id)}',")
                config_lines.append(f"        'type': '{sdr_data.get('type', 'hackrf')}',")
                config_lines.append(f"        'enabled': True,")
                
                if 'device' in sdr_data:
                    config_lines.append(f"        'device': '{sdr_data['device']}',")
                if 'ppm' in sdr_data:
                    config_lines.append(f"        'ppm': {sdr_data['ppm']},")
                
                # Add profiles
                if 'profiles' in sdr_data:
                    config_lines.append("        'profiles': {")
                    for profile_id, profile_data in sdr_data['profiles'].items():
                        config_lines.append(f"            '{profile_id}': {{")
                        config_lines.append(f"                'name': '{profile_data.get('name', profile_id)}',")
                        config_lines.append(f"                'center_freq': {profile_data.get('center_freq', 100000000)},")
                        config_lines.append(f"                'samp_rate': {profile_data.get('samp_rate', 2048000)},")
                        config_lines.append(f"                'start_freq': {profile_data.get('start_freq', 100000000)},")
                        config_lines.append(f"                'start_mod': '{profile_data.get('start_mod', 'nfm')}',")
                        if 'rf_gain' in profile_data:
                            config_lines.append(f"                'rf_gain': {profile_data['rf_gain']},")
                        config_lines.append("            },")
                    config_lines.append("        },")
                
                config_lines.append("    },")
        
        config_lines.append("}")
        
        # Write config file
        os.makedirs('/etc/openwebrx', exist_ok=True)
        with open(config_file, 'w') as f:
            f.write('\n'.join(config_lines))
        
        print(f"Generated Python config from JSON at {config_file}")
        
    except Exception as e:
        print(f"Error generating config: {e}")
        sys.exit(1)

def main():
    print("Converting JSON config to Python...")
    convert_json_to_python_config()
    
    print("Starting OpenWebRX...")
    os.execv('/usr/bin/python3', ['python3', '/usr/bin/openwebrx'])

if __name__ == '__main__':
    main()