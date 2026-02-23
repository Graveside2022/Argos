# EFF Rayhunter — IMSI Catcher Detector

## Overview

Open-source tool by the EFF (Electronic Frontier Foundation) for detecting IMSI catchers (fake cell towers / cell-site simulators). Successor to the deprecated Crocodile Hunter project.

## Links

- **GitHub:** https://github.com/EFForg/rayhunter
- **Docs:** https://www.eff.org/deeplinks/2025/03/meet-rayhunter-new-open-source-tool-detect-cell-phone-surveillance
- **EFF Page:** https://www.eff.org/pages/rayhunter

## What It Does

Runs on a $20 Orbic RC400L mobile hotspot. Monitors cell tower handshakes for suspicious behavior — 2G downgrades, IMSI requests, unusual tower parameters. Alerts when a cell-site simulator is detected nearby.

## Hardware Requirements

- **Device:** Orbic Speed RC400L mobile hotspot (~$20 prepaid, no active plan needed)
- **RAM:** Runs on the hotspot, not the Pi. Pi only reads data from the device.
- **CPU:** N/A (hotspot device)
- **Pi 5 8GB:** ✅ PASS (Pi manages/reads data via USB)

## Install on Raspberry Pi 5 (Kali ARM64)

### Flash Rayhunter onto Orbic Hotspot

```bash
# Clone the repo
git clone https://github.com/EFForg/rayhunter.git
cd rayhunter

# Install Rust cross-compilation toolchain
rustup target add armv7-unknown-linux-musleabihf

# Build for ARM (hotspot CPU)
cargo build --target armv7-unknown-linux-musleabihf --release

# Connect Orbic hotspot via USB and flash
# Follow EFF's flashing guide for your specific hotspot model
./scripts/flash.sh
```

### Access from Pi

```bash
# Connect Orbic hotspot via USB to Pi
# Rayhunter serves a web UI on the hotspot's WiFi network
# Connect Pi to hotspot's WiFi and open:
# http://192.168.1.1:8080
```

## Capabilities

- 2G downgrade detection (forces to insecure GSM)
- IMSI/TMSI request anomaly detection
- Cell tower parameter analysis
- Suspicious handshake logging
- Visual and audio alerts
- Web-based monitoring UI

## Why We Care

Replaces deprecated Crocodile Hunter (EFF, Dec 2022). Tells you if someone is running a cell-site simulator (Stingray/IMSI catcher) nearby. Essential for counter-surveillance. Much more accessible than Crocodile Hunter — runs on a $20 hotspot instead of requiring expensive USRP hardware.
