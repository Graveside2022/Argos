# multimon-ng

> **RISK CLASSIFICATION**: LOW RISK
> Multi-protocol decoder for pager, EAS, DTMF, AFSK, and other analog/digital signals. Decodes publicly broadcast signals (pagers, emergency alerts, APRS). Receive-only — no transmit capability.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Available via `apt-get install multimon-ng` on Kali ARM64; community Docker image available; pure C with minimal dependencies

| Method               | Supported | Notes                                                                            |
| -------------------- | --------- | -------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `boxel/multimon-ng:latest` — community arm64 image; or trivial custom Dockerfile |
| **Native Install**   | YES       | `sudo apt-get install multimon-ng` on Kali ARM64 — simplest possible install     |

---

## Tool Description

multimon-ng is a multi-protocol decoder that processes audio input and decodes a wide variety of analog and low-data-rate digital signals. It operates on an audio pipe model — feed it demodulated audio from any SDR (via rtl_fm, hackrf_transfer + sox, or any other source) and it extracts data from the signals.

Supported protocols:

- **POCSAG** (512/1200/2400 baud) — pager messages (hospitals, military bases, emergency services still use pagers extensively)
- **FLEX** — Motorola pager protocol (faster than POCSAG, used by commercial paging services)
- **EAS/SAME** — Emergency Alert System / Specific Area Message Encoding (US emergency broadcasts)
- **DTMF** — Dual-Tone Multi-Frequency touch-tones (phone dialing, access codes, radio control)
- **AFSK1200** — Audio Frequency Shift Keying (APRS amateur radio packet network)
- **ZVEI/CCIR/EEA/EIA** — European and US selective calling/paging tones (emergency services dispatch)
- **FSK9600** — 9600 baud FSK (high-speed amateur packet radio)
- **Morse CW** — Continuous wave Morse code
- **X10** — Home automation signaling
- **DCSF/CTCSS** — Sub-audible tone decoding (repeater access tones)
- **FMS** — German emergency services status protocol (Funkmeldesystem)
- **HAPN4800** — 4800 baud packet radio

Key features:

- Audio pipe input — works with ANY SDR via demodulated audio feed
- Multiple simultaneous protocol decoding
- Can decode from WAV files for offline analysis
- Text output with timestamp and protocol identification
- PulseAudio support for direct audio input from sound card

## Category

Multi-Protocol Decoder / Pager Interception / Emergency Alert Monitoring / Sub-GHz Signal Intelligence

## Repository

- **GitHub**: https://github.com/EliasOenal/multimon-ng
- **Language**: C
- **License**: GPL-2.0
- **Stars**: ~1,077

---

## Docker Compatibility

### Can it run in Docker?

**YES** — Community Docker image `boxel/multimon-ng:latest` available with arm64 support. Alternatively, a custom Dockerfile is trivial since multimon-ng has minimal dependencies (CMake only, PulseAudio optional). Native apt install is even simpler.

### Docker Requirements

- No `--privileged` needed — multimon-ng reads audio from stdin, not directly from hardware
- Audio pipe model: pipe demodulated audio from host SDR tool into container
- Volume mount for WAV files (if processing recordings): `-v /path/to/wav:/wav`
- PulseAudio socket forwarding (optional): `-v /run/pulse:/run/pulse` for direct audio input
- No network ports required

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    libpulse-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/EliasOenal/multimon-ng.git /build/multimon-ng

WORKDIR /build/multimon-ng
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpulse0 \
    sox \
    rtl-sdr \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/multimon-ng/build/multimon-ng /usr/local/bin/multimon-ng

ENTRYPOINT ["multimon-ng"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/multimon-ng .

# Decode POCSAG pagers from RTL-SDR on host (piped)
rtl_fm -f 152.480M -s 22050 -g 40 - | \
docker run --rm -i argos/multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -f alpha -

# Decode EAS emergency alerts from RTL-SDR
rtl_fm -f 162.400M -s 22050 -g 40 - | \
docker run --rm -i argos/multimon-ng -t raw -a EAS -

# Decode APRS packets from RTL-SDR (144.390 MHz US, 144.800 MHz EU)
rtl_fm -f 144.390M -s 22050 -g 40 - | \
docker run --rm -i argos/multimon-ng -t raw -a AFSK1200 -

# Decode all protocols from WAV file
docker run --rm \
  -v $(pwd)/recordings:/wav \
  argos/multimon-ng -t wav -a ALL /wav/recording.wav

# Using community image
rtl_fm -f 152.480M -s 22050 -g 40 - | \
docker run --rm -i boxel/multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -
```

---

## Install Instructions (Native)

```bash
# ============================================
# multimon-ng Native Install on Kali Linux RPi5
# ============================================

# Option A: Install from apt (recommended — simplest)
sudo apt-get update
sudo apt-get install -y multimon-ng

# Verify installation
multimon-ng --help

# Option B: Build from source (for latest features)
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  libpulse-dev

cd /opt
sudo git clone https://github.com/EliasOenal/multimon-ng.git
cd multimon-ng
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo cp multimon-ng /usr/local/bin/

# ============================================
# Usage Examples
# ============================================

# Decode POCSAG pagers (common pager frequency — check local frequencies)
rtl_fm -f 152.480M -s 22050 -g 40 - | multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -f alpha -

# Decode POCSAG from HackRF (via hackrf_transfer + sox audio pipe)
hackrf_transfer -r - -f 152480000 -s 2000000 -g 32 -l 24 | \
sox -t raw -r 2000000 -e signed -b 16 -c 1 - -t raw -r 22050 -e signed -b 16 -c 1 - | \
multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -f alpha -

# Decode EAS/SAME emergency alerts (NOAA Weather Radio frequencies)
rtl_fm -f 162.400M -s 22050 -g 40 - | multimon-ng -t raw -a EAS -

# Decode APRS packets (144.390 MHz US)
rtl_fm -f 144.390M -s 22050 -g 40 - | multimon-ng -t raw -a AFSK1200 -

# Decode DTMF tones
rtl_fm -f <target_freq>M -s 22050 -g 40 - | multimon-ng -t raw -a DTMF -

# Decode all protocols simultaneously (auto-detect)
rtl_fm -f 152.480M -s 22050 -g 40 - | multimon-ng -t raw -a ALL -

# Decode from WAV file (offline analysis)
multimon-ng -t wav -a ALL recording.wav

# Decode ZVEI selective call tones (European emergency dispatch)
rtl_fm -f <target_freq>M -s 22050 -g 40 - | multimon-ng -t raw -a ZVEI1 -a ZVEI2 -a ZVEI3 -
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — available via `apt-get install multimon-ng` on Kali ARM64          |
| Kali Repo Available   | :white_check_mark: YES — pre-built ARM64 package in Kali/Debian repos                        |
| Hardware Requirements | None direct — audio pipe model; any SDR via `rtl_fm`, `hackrf_transfer`, or sound card input |
| Performance on RPi5   | :white_check_mark: Excellent — pure C, ~1-3% CPU for single-channel decode; <10 MB RAM       |

### RPi5-Specific Notes

- `apt-get install multimon-ng` — the simplest install of any tool in this list
- Pure C with no framework dependencies — extremely lightweight
- Audio pipe model means it works with any SDR hardware without SDR-specific code
- For HackRF: pipe through `hackrf_transfer | sox | multimon-ng`
- For RTL-SDR: pipe through `rtl_fm | multimon-ng` (most common usage)
- Can run multiple instances simultaneously for different frequencies/protocols
- Memory usage: <10 MB — negligible

### Argos Integration Notes

- Decoded POCSAG pager messages can be logged and displayed in Argos dashboard
- Pagers are still widely used at military installations, hospitals, and emergency services
- EAS/SAME emergency alerts provide situational awareness of weather and emergency events
- AFSK1200/APRS packets contain position data that can be plotted on Argos tactical map
- DTMF decoding useful for identifying radio control sequences and phone signaling
- Text output is easily parsed and fed to Argos backend via simple script
- Covers signals that rtl-433 doesn't: pagers, APRS, emergency alerts, selective calling tones

### Verdict

**COMPATIBLE** — multimon-ng is the easiest tool to deploy on RPi 5 — a single `apt-get install` command. Zero resource impact. Covers a wide range of signals that no other Argos tool handles (pagers, EAS, APRS, DTMF, selective calling). High value for the zero-effort deployment cost.
