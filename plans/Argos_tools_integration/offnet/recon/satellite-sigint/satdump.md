# SatDump — Satellite Signal Processor

## Overview

Decodes and processes data from 90+ satellites — weather (GOES, NOAA, Meteor-M), Earth observation, and communications. Pre-built ARM64 .deb for Raspberry Pi. CLI headless mode for unattended operation.

## Links

- **GitHub:** https://github.com/SatDump/SatDump
- **Website:** https://www.satdump.org/
- **Getting Started:** https://www.satdump.org/getting-started/
- **Satellite List:** https://www.satdump.org/Satellite-List/

## What It Does

Receives satellite signals via SDR, demodulates, decodes, and produces usable products — actual imagery from weather satellites, telemetry data, and decoded transmissions. Built-in pass scheduler, rotator control, and automated reception.

## Hardware Requirements

- **RAM:** ~300–500 MB during active decode (CLI headless mode)
- **CPU:** ARM64 native (pre-built .deb available)
- **SDR:** RTL-SDR for 137 MHz LEO weather satellites ($0 — shared). HackRF for wider coverage. For GOES geostationary: dish antenna + SAWbird LNA (~$50–100 additional)
- **Pi 5 8GB:** ⚠️ PASS — CPU-intensive during active decode, v2.0 rewrite targets lower footprint

## Install on Raspberry Pi 5 (Kali ARM64)

### Pre-built .deb (Recommended)

```bash
# Download latest ARM64 nightly
wget https://github.com/SatDump/SatDump/releases/download/nightly/satdump_rpi64_latest_arm64.deb

# Install
sudo apt install ./satdump_rpi64_latest_arm64.deb
```

### CLI Headless Usage

```bash
# Receive NOAA APT weather satellite pass
satdump live noaa_apt \
  --source rtlsdr \
  --samplerate 1000000 \
  --frequency 137100000 \
  --output_folder ./output

# Automated scheduling uses SatDump's built-in autotrack feature
satdump autotrack --source rtlsdr --output_folder ./autotrack
```

### Build from Source

```bash
git clone https://github.com/SatDump/SatDump.git
cd SatDump
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j4
sudo make install
```

## Capabilities

- 90+ satellite decoders
- NOAA APT / Meteor LRPT weather imagery
- GOES geostationary imagery
- CLI headless mode for Pi
- Built-in pass scheduler (autotrack)
- Rotator control
- Multi-SDR support (RTL-SDR, HackRF, SDRplay, Airspy, USRP, LimeSDR, PlutoSDR)
- v2.0 rewrite in progress (lower memory footprint)

## Why We Care

Produces actual satellite photographs of the area of operations — not just telemetry. Pre-built ARM64 .deb for Pi means one command to install. Supersedes gr-satellites for 95% of satellite use cases with less overhead (no full GNU Radio stack needed). Autotrack mode enables unattended automated reception.

## Overlap Note

- Supersedes `gr-satellites` for most use cases. Keep gr-satellites only for custom GNU Radio flowgraphs.
- Does NOT replace `gr-iridium` — SatDump doesn't cover Iridium PHY decoding.
