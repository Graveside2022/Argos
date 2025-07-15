#!/usr/bin/env python3
"""
Patch for GSMEvil2 CPU usage issue
This creates a fixed version of the sniffer method
"""

import time

# Fixed sniffer method that doesn't consume 100% CPU
fixed_sniffer_code = '''
    def sniffer():
        global gsm_sniffer, imsi_sniffer, sms_sniffer
        while True:
            if gsm_sniffer == "on":
                try:
                    capture = pyshark.LiveCapture(interface='lo', bpf_filter='port 4729 and not icmp and udp')
                    for packet in capture:
                        if sms_sniffer == "off" and imsi_sniffer == "off":
                            gsm_sniffer = "off"  # Fixed: was using == instead of =
                            break
                        layer = packet.highest_layer
                        if layer == "GSM_SMS":
                            if sms_sniffer == "on":
                                SmsEvil().get_sms(packet)
                        elif layer == "GSM_A.CCCH":
                            if imsi_sniffer == "on":
                                ImsiEvil().get_imsi(packet)
                except Exception as e:
                    print(f"Error in packet capture: {e}")
                    time.sleep(1)
            else:
                # CRITICAL FIX: Sleep when sniffer is off to prevent 100% CPU usage
                time.sleep(0.1)
        return gsm_sniffer
'''

# Read the original file
with open('/tmp/gsmevil2/GsmEvil.py', 'r') as f:
    content = f.read()

# Add import time at the top if not present
if 'import time' not in content:
    content = content.replace('import pyshark', 'import pyshark\nimport time')

# Replace the buggy sniffer method
import re
pattern = r'def sniffer\(\):.*?return gsm_sniffer'
replacement = fixed_sniffer_code.strip()
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Save the patched version
with open('/tmp/gsmevil2/GsmEvil_fixed.py', 'w') as f:
    f.write(content)

print("Created fixed version at /tmp/gsmevil2/GsmEvil_fixed.py")