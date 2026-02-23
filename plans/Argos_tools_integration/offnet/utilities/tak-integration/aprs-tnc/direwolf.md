# Dire Wolf — APRS Software TNC

## Overview

Software soundcard AX.25 packet modem (TNC) and APRS encoder/decoder. The undisputed gold standard — decodes more frames than any hardware TNC. Functions as tracker, digipeater, APRStt gateway, or Internet Gateway (IGate). 1,907 GitHub stars.

## Links

- **GitHub:** https://github.com/wb2osz/direwolf
- **RPi APRS Guide (PDF):** https://github.com/wb2osz/direwolf/blob/master/doc/Raspberry-Pi-APRS.pdf
- **Install Guide:** https://themodernham.com/ultimate-direwolf-tnc-installation-guide-for-windows-and-linux/

## What It Does

Decodes and transmits APRS (Automatic Packet Reporting System) radio packets. Provides KISS TCP and AGW interfaces that feed downstream tools like `aprscot` (APRS → TAK gateway). Supports FX.25 forward error correction and IL2P protocol.

## Hardware Requirements

- **RAM:** ~10–20 MB (verified — pure C daemon)
- **CPU:** ARM64 native, GPIO PTT support on RPi
- **Hardware (receive-only):** Audio pipe from RTL-SDR ($0 beyond existing SDR)
- **Hardware (transmit):** VHF radio with PTT interface (~$30 Baofeng + audio cable)
- **Pi 5 8GB:** ✅ PASS — among the lightest tools in the entire inventory

## Install on Raspberry Pi 5 (Kali ARM64)

### apt Install

```bash
sudo apt install direwolf
```

### Build from Source (v1.8.1)

```bash
git clone https://github.com/wb2osz/direwolf.git
cd direwolf
mkdir build && cd build
cmake ..
make -j4
sudo make install
```

### Receive-Only with RTL-SDR

```bash
# Listen on 144.39 MHz (US APRS frequency)
rtl_fm -f 144.39M -s 22050 - | direwolf -c direwolf.conf -r 22050 -

# For European APRS (144.80 MHz):
rtl_fm -f 144.80M -s 22050 - | direwolf -c direwolf.conf -r 22050 -
```

### Configuration (direwolf.conf)

```
# Basic receive-only config
ADEVICE stdin null
CHANNEL 0
MYCALL N0CALL
MODEM 1200
KISSPORT 8001
AGWPORT 8000
```

### Feed aprscot (APRS → TAK)

```bash
# aprscot reads from Dire Wolf's KISS TCP port
# In aprscot config:
# KISS_HOST=localhost
# KISS_PORT=8001
```

## Capabilities

- AX.25 TNC (KISS TCP port 8001, AGW port 8000)
- APRS encode and decode
- FX.25 forward error correction
- IL2P protocol support
- 6 simultaneous radio channels across 3 soundcards
- Digipeater mode
- Internet Gateway (IGate) mode
- APRStt gateway (DTMF to APRS)
- GPIO PTT on Raspberry Pi
- Decodes 1,000+ error-free frames from WA8LMF test CD

## Why We Care

**Critical dependency** — `aprscot` (our APRS → TAK gateway, already in the tool hierarchy) requires Dire Wolf's KISS TCP output as its input. Without Dire Wolf, the `aprscot → CoT → TAK` pipeline is dead code. Also: no hardware TNC can match Dire Wolf's decode performance. At ~15 MB RAM, it's essentially free to run.
