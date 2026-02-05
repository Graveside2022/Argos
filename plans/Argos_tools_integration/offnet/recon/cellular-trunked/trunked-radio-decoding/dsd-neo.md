# dsd-neo

> **RISK CLASSIFICATION**: MEDIUM RISK - SENSITIVE SOFTWARE
> Multi-protocol digital voice decoder capable of decoding DMR, P25, NXDN, D-STAR, EDACS, and other trunked/digital radio systems. Passive receive-only — no transmit capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pre-built aarch64 AppImage available; compiles natively from source; no GNU Radio dependency

| Method               | Supported | Notes                                                                                         |
| -------------------- | --------- | --------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | No official image; needs custom Dockerfile; straightforward C build with minimal dependencies |
| **Native Install**   | YES       | Pre-built aarch64 AppImage from nightly builds; or compile from source with CMake on ARM64    |

---

## Tool Description

dsd-neo is a modern digital speech decoder and successor to the classic DSD (Digital Speech Decoder) project. It takes raw discriminator audio from any SDR (via audio pipe or RTL-SDR direct) and decodes digital voice protocols in real time, outputting audible speech. Unlike GNU Radio-based decoders, dsd-neo is a lightweight standalone C/C++ application with no heavy framework dependencies.

Supported protocols:

- **DMR** (Digital Mobile Radio) — Motorola TRBO, Hytera, Tier II/III
- **P25 Phase I** — FDMA (C4FM/CQPSK)
- **P25 Phase II** — TDMA (H-DQPSK)
- **NXDN** — Kenwood, Icom (4800/9600 baud)
- **D-STAR** — Icom amateur radio digital voice
- **EDACS** — Ericsson/GE trunked radio
- **dPMR** — Digital PMR446
- **ProVoice** — Motorola legacy digital voice
- **X2-TDMA** — Motorola X2 systems
- **M17** — Open-source digital voice protocol
- **YSF** — Yaesu System Fusion

Key features:

- RTL-SDR direct USB support with built-in tuner control
- RTL-TCP network SDR input
- Audio pipe input from any SDR (hackrf_transfer, sox, etc.)
- AMBE/IMBE/Codec2 voice decoding with mbe-neo library
- ncurses terminal UI with signal strength, protocol info, and talkgroup display
- Per-call audio recording
- JSON metadata output

## Category

Digital Voice Decoding / Multi-Protocol Radio Decoder / SIGINT

## Repository

- **GitHub**: https://github.com/arancormonk/dsd-neo
- **Language**: C/C++ (C11/C++14)
- **License**: Open source
- **Stars**: ~67

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** — No official Docker image exists. A custom Dockerfile is straightforward since dsd-neo is a self-contained C/C++ build with minimal dependencies (CMake, libsndfile, ncurses, portaudio, mbe-neo). RTL-SDR USB passthrough works in Docker for direct SDR mode; audio pipe mode works regardless.

### Docker Requirements

- `--privileged` — Required only if using RTL-SDR direct USB mode
- `--device=/dev/bus/usb` — USB passthrough for RTL-SDR (not needed for audio pipe mode)
- Audio pipe mode: pipe audio from host SDR tool into container via stdin or named pipe
- Volume mount for recorded audio output: `-v /path/to/recordings:/recordings`
- No network ports required unless using RTL-TCP mode

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    libsndfile1-dev \
    libncurses5-dev \
    libportaudio-dev \
    librtlsdr-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone dsd-neo and mbe-neo
RUN git clone --recursive https://github.com/arancormonk/dsd-neo.git /build/dsd-neo

WORKDIR /build/dsd-neo
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    libncurses6 \
    libportaudio2 \
    librtlsdr0 \
    libusb-1.0-0 \
    sox \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/dsd-neo/build/dsd-neo /usr/local/bin/dsd-neo

WORKDIR /recordings
ENTRYPOINT ["dsd-neo"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/dsd-neo .

# Run with RTL-SDR direct (USB passthrough)
docker run --rm -it \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/recordings:/recordings \
  argos/dsd-neo \
  -i rtl -f 851000000 -g 40

# Run with audio pipe from HackRF on host
hackrf_transfer -r - -f 851000000 -s 8000000 | \
sox -t raw -r 8000000 -e signed -b 16 -c 1 - -t raw -r 48000 -e signed -b 16 -c 1 - | \
docker run --rm -i \
  -v $(pwd)/recordings:/recordings \
  argos/dsd-neo \
  -i stdin -r 48000

# Run with RTL-TCP (network SDR)
docker run --rm -it \
  --net=host \
  -v $(pwd)/recordings:/recordings \
  argos/dsd-neo \
  -i rtltcp -f 851000000 -g 40 -a 127.0.0.1 -p 1234
```

---

## Install Instructions (Native)

```bash
# ============================================
# dsd-neo Native Install on Kali Linux RPi5
# ============================================

# Option A: Use pre-built aarch64 AppImage (easiest)
# Download latest nightly from GitHub releases
cd /opt
wget https://github.com/arancormonk/dsd-neo/releases/download/nightly/dsd-neo-aarch64.AppImage
chmod +x dsd-neo-aarch64.AppImage
sudo ln -sf /opt/dsd-neo-aarch64.AppImage /usr/local/bin/dsd-neo

# Test AppImage
dsd-neo --help

# Option B: Build from source
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  libsndfile1-dev \
  libncurses5-dev \
  libportaudio-dev \
  librtlsdr-dev \
  libusb-1.0-0-dev

cd /opt
sudo git clone --recursive https://github.com/arancormonk/dsd-neo.git
cd dsd-neo
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo cp dsd-neo /usr/local/bin/

# Test installation
dsd-neo --help

# Usage examples:

# Decode P25 from RTL-SDR tuned to a known frequency
dsd-neo -i rtl -f 851012500 -g 40

# Decode DMR from audio pipe (HackRF)
hackrf_transfer -r - -f 438500000 -s 2000000 | \
sox -t raw -r 2000000 -e signed -b 16 -c 1 - -t raw -r 48000 -e signed -b 16 -c 1 - | \
dsd-neo -i stdin -r 48000

# Auto-detect protocol from RTL-SDR
dsd-neo -i rtl -f 851000000 -g 40 -a

# Record decoded audio to WAV files
dsd-neo -i rtl -f 851012500 -g 40 -w /var/lib/dsd-neo/recordings/
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — pre-built aarch64 AppImage; compiles from source on ARM64                               |
| Kali Repo Available   | :x: Not in Kali repos — use AppImage or build from source                                                         |
| Hardware Requirements | RTL-SDR (direct USB support); any SDR via audio pipe (HackRF, USRP via hackrf_transfer/sox)                       |
| Performance on RPi5   | :white_check_mark: Excellent — lightweight C/C++ with no GNU Radio overhead; ~5-10% CPU for single-channel decode |

### RPi5-Specific Notes

- Pre-built aarch64 AppImage is the fastest deployment path — single file download, no compilation
- No GNU Radio dependency makes this dramatically lighter than OP25 or trunk-recorder
- Audio pipe model means it works with any SDR that can output raw samples
- For HackRF: pipe through `hackrf_transfer | sox | dsd-neo` for frequency conversion
- Memory usage: ~50-100 MB — minimal footprint
- ncurses UI provides real-time protocol detection, signal quality, and talkgroup info in terminal

### Argos Integration Notes

- JSON metadata output can be piped to Argos backend for logging talkgroup activity
- Per-call WAV recordings can be indexed and served through Argos web interface
- Complements trunk-recorder: trunk-recorder records P25 trunked calls unattended; dsd-neo decodes voice from many more protocol types (DMR, NXDN, D-STAR, EDACS, etc.)
- Can run alongside trunk-recorder — one monitors P25 trunking, the other decodes other digital protocols on different frequencies

### Verdict

**COMPATIBLE** — dsd-neo is lightweight, dependency-minimal, and runs excellently on RPi 5. The pre-built aarch64 AppImage makes deployment trivial. As a universal digital voice decoder covering 11+ protocols, it complements trunk-recorder's P25-focused trunking approach with broad protocol coverage.
