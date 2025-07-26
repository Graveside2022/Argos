#!/usr/bin/env python3
# Wrapper to fix USRP B205 mini antenna issue for grgsm_livemon_headless

import os
import sys
import subprocess

# Set UHD images directory
os.environ['UHD_IMAGES_DIR'] = '/usr/share/uhd/images'

# Modify the osmosdr device args to include antenna spec
args = sys.argv[1:]
new_args = []

for i, arg in enumerate(args):
    if arg == '--args' and i + 1 < len(args):
        # Add antenna spec to the device args
        device_arg = args[i + 1]
        if 'type=b200' in device_arg:
            # For USRP B205 mini, we need to specify RX2 antenna
            new_args.append(arg)
            new_args.append(f'{device_arg},antenna=RX2')
            i += 1
        else:
            new_args.append(arg)
    elif i > 0 and args[i-1] == '--args':
        # Skip, already handled
        continue
    else:
        new_args.append(arg)

# Run the actual grgsm_livemon_headless with modified args
cmd = ['/usr/bin/python3', '/usr/local/bin/grgsm_livemon_headless'] + new_args
print(f"Running: {' '.join(cmd)}")
subprocess.run(cmd)