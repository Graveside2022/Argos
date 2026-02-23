# DragonSync — Multi-Protocol Drone Remote ID to TAK Gateway

## Overview

Lightweight gateway that ingests drone Remote ID detections from multiple sources — BLE5 Long Range (Sniffle), WiFi RID (ESP32), and DJI DroneID (ANTSDR) — and outputs Cursor on Target (CoT) for TAK/ATAK. Also publishes to MQTT. Created by alphafox02 (DragonOS creator).

## Links

- **GitHub:** https://github.com/alphafox02/DragonSync
- **Coverage:** https://www.rtl-sdr.com/wardragon-real-time-drone-remote-id-tracking-with-snifflee-tar1090-and-atak/
- **iOS Companion:** https://github.com/Root-Down-Digital/DragonSync-iOS

## What It Does

Takes drone Remote ID broadcasts from BLE5 Long Range, WiFi, and DJI proprietary protocols, fuses them into a unified drone track, and outputs CoT messages for TAK tactical maps. Also reads ADS-B from local readsb for aircraft context.

## Hardware Requirements

- **RAM:** ~50–100 MB (Python daemon + Sniffle CLI)
- **CPU:** ARM64 native (pure Python)
- **Hardware:**
    - TI CC1352P LaunchPad or Sonoff Zigbee dongle (flashed with Sniffle firmware) — ~$20–30
    - ESP32-S3 board (e.g., Mesh Detect from colonelpanic.tech) — ~$10–15
    - Optional: ANTSDR E200 for DJI DroneID via SDR — ~$160
- **Pi 5 8GB:** ✅ PASS

## Install on Raspberry Pi 5 (Kali ARM64)

### Native Install

```bash
# Clone DragonSync
git clone https://github.com/alphafox02/DragonSync.git
cd DragonSync
pip3 install -r requirements.txt

# Edit config.ini: set TAK server, ZMQ ports, enable MQTT
nano config.ini

# Flash Sniffle firmware onto TI CC1352 / Sonoff dongle
# See: https://github.com/nccgroup/Sniffle
git clone https://github.com/nccgroup/Sniffle.git
cd Sniffle
# Flash using UniFlash or cc-tool

# Start Sniffle BLE scanner
python3 sniffle/python_cli/scanner.py -s /dev/ttyACM0 -l -e &

# Start DragonSync
python3 dragonsync.py
```

### Integration with Argos

DragonSync outputs CoT on configurable multicast or TCP. Feeds directly into Argos's existing cotproxy / node-cot pipeline. Drones appear as CoT markers on the tactical map.

## Capabilities

- BLE5 Long Range Remote ID detection (via Sniffle dongle)
- WiFi Remote ID detection (via ESP32-S3)
- DJI DroneID detection (via ANTSDR SDR)
- Fused multi-protocol drone tracking
- CoT output for TAK/ATAK
- MQTT output for dashboards
- ADS-B aircraft context from readsb
- ZMQ-based architecture

## Why We Care

Detects ALL drones (not just DJI) and puts them on the TAK map. BLE5 Long Range catches drones that WiFi-only solutions miss. Multi-protocol fusion means one tool instead of three. ~$30-45 in hardware. Successor to SniffleToTAK.
