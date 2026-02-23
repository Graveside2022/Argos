# blah2 — Open Source Passive Radar

## Overview

Real-time passive radar system that detects aircraft and vehicles by analyzing reflections of existing FM/DAB broadcast signals. No transmission — completely undetectable. Web-based delay-Doppler display.

## Links

- **GitHub:** https://github.com/30hours/blah2
- **Live Demo:** http://radar4.30hours.dev
- **Coverage:** https://www.rtl-sdr.com/wardragon-passive-radar-with-blah2-and-ads-b-delay-doppler-truth/

## What It Does

Processes two RF channels — one reference channel tuned to a local FM/DAB broadcast tower, one surveillance channel with omnidirectional antenna — and computes delay-Doppler maps showing moving objects. Web frontend displays results. ADS-B truth overlay validates detections.

## Hardware Requirements

- **RAM:** ~200–400 MB (unverified — needs bench testing on Pi 5)
- **CPU:** ARM64 (C++ DSP pipeline, CPU-intensive during processing)
- **SDR Options:**
    - 2x RTL-SDR dongles (~$50 total) — one for reference, one for surveillance
    - OR HackRF with FM front-end mixer/splitter (~$15-30)
    - OR KrakenSDR (2+ channels)
    - OR SDRplay RSPDuo (dual-tuner)
    - OR USRP B210
- **Antennas:** Two antennas — one directional toward FM tower, one omni for surveillance
- **Pi 5 8GB:** ⚠️ PASS with caveats — RAM needs bench testing, dedicates SDR exclusively

## Install on Raspberry Pi 5 (Kali ARM64)

### Docker Install (Recommended)

```bash
git clone https://github.com/30hours/blah2.git
cd blah2

# Edit config for your SDR and local FM station
nano config/config.yml
# Set: sdr type, fm_frequency (find strong local FM station)

# Build and run
sudo docker compose up -d

# Web UI at http://localhost:49152
```

### Native Install

```bash
git clone https://github.com/30hours/blah2.git
cd blah2
mkdir build && cd build
cmake ..
make -j4
sudo make install

# Run with config
blah2 -c ../config/config.yml
```

## Capabilities

- Delay-Doppler map generation
- FM/DAB illumination source
- Multi-SDR support (RTL-SDR, HackRF, KrakenSDR, SDRplay, USRP)
- Web-based real-time display
- ADS-B truth overlay for validation
- IQ recording on demand
- Docker ARM64 support

## Why We Care

Entirely new capability — no other tool in our inventory does passive radar. Detect flying objects without transmitting anything. Operationally significant because it's undetectable by the target. Only actively maintained open-source passive radar.
