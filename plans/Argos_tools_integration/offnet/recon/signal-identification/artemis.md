# Artemis — Offline RF Signal Identification Database

## Overview

Offline reference database with 500+ identified RF signals. Each entry includes frequency range, bandwidth, modulation type, audio samples, and spectrograms. v4.0 is a complete rewrite with modular architecture for future ML-based auto signal recognition.

## Links

- **GitHub:** https://github.com/AresValley/Artemis
- **Website:** https://www.aresvalley.com/
- **Coverage:** https://www.rtl-sdr.com/artemis-4-released-offline-signal-identification-database/

## What It Does

Searchable offline catalog of radio signals. Look up unknown signals by frequency, bandwidth, or modulation type. Each signal entry has visual spectrograms and audio samples for comparison. Space weather tracking with 5-minute updates for RF propagation analysis.

## Hardware Requirements

- **RAM:** ~100–200 MB (Python + QML app)
- **CPU:** ARM64 (Python, Pi 3B+/4B port exists, ARM bugs fixed in v4)
- **Hardware:** None — database reference tool only
- **Pi 5 8GB:** ✅ PASS

## Install on Raspberry Pi 5 (Kali ARM64)

### Install via pip

```bash
pip3 install artemis-sdr
artemis  # Launch
```

### Install from Source

```bash
git clone https://github.com/AresValley/Artemis.git
cd Artemis
pip3 install -r requirements.txt
python3 -m artemis
```

## Capabilities

- 500+ signal database with spectrograms and audio
- Frequency, bandwidth, and modulation search
- Offline-capable (no internet required)
- Space weather tracking (propagation conditions)
- Signal comparison tools
- v4 architecture designed for future ML auto-classification

## Why We Care

"What is this signal?" — answered offline, without internet. Only tool for air-gapped signal identification. When an operator sees an unknown signal on the HackRF spectrum sweep, Artemis is the only way to identify it without going online. SigIDWiki (the only alternative) is web-only and useless in the field.
