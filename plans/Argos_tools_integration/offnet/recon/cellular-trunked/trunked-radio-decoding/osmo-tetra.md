# osmo-tetra

> **RISK CLASSIFICATION**: MEDIUM RISK - SENSITIVE SOFTWARE
> TETRA (Terrestrial Trunked Radio) protocol decoder. Decodes European military/emergency digital radio voice and SDS messages. Passive receive-only — no transmit capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure C with Makefile; compiles natively on ARM64; libosmocore available in Debian ARM64 repos

| Method               | Supported | Notes                                                                                                   |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | No current Docker image (stale 2015 image exists — ignore it); needs custom Dockerfile with libosmocore |
| **Native Install**   | YES       | Pure C with Makefile; libosmocore from Debian repos; GNU Radio needed only for demodulator component    |

---

## Tool Description

osmo-tetra (specifically the sq5bpf fork) is a TETRA protocol decoder based on the Osmocom TETRA project. TETRA (Terrestrial Trunked Radio) is the European standard for digital trunked radio, used by military forces, police, emergency services, and public utilities across Europe and parts of Asia. osmo-tetra decodes TETRA protocol layers from demodulated baseband, extracting voice channels, SDS (Short Data Service) text messages, and control channel information.

Key capabilities:

- Decodes TETRA voice channels (ACELP codec) to audio output
- Extracts SDS (Short Data Service) text messages — TETRA's equivalent of SMS
- Decodes control channels: system info, registration, group attachments
- Displays TETRA identity information: ISSI (Individual Short Subscriber Identity), GSSI (Group Short Subscriber Identity)
- Companion tool `telive` provides a real-time ncurses display interface
- Processes demodulated baseband — works with any SDR via GNU Radio demodulator or SDR++ TETRA plugin
- Supports both uplink and downlink decoding
- TETRA frequency range: 380-400 MHz (emergency), 410-430 MHz (commercial), 450-470 MHz (PMR)

**Note**: TETRA is used extensively at JMRC (Germany) and NATO exercises. It is NOT used in the US (NTC uses P25). Deploy this tool for European theater operations.

## Category

TETRA Protocol Decoding / European Digital Radio / SIGINT

## Repository

- **GitHub**: https://github.com/sq5bpf/osmo-tetra-sq5bpf
- **Language**: C
- **License**: GPL (Osmocom)
- **Stars**: ~59

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** — No current, maintained Docker image exists. A stale community image from 2015 should be ignored. Custom Dockerfile is needed with libosmocore from Debian repos. The build is straightforward but the GNU Radio demodulator component adds complexity.

### Docker Requirements

- `--privileged` — Required if SDR demodulator runs inside container
- `--device=/dev/bus/usb` — USB passthrough for SDR hardware (if demod is in-container)
- Audio output: volume mount or PulseAudio socket forwarding for decoded voice
- Named pipe or volume mount for feeding demodulated baseband from host SDR
- No network ports required for core operation

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ca-certificates \
    pkg-config \
    libtalloc-dev \
    libosmocore-dev \
    libosmo-abis-dev \
    autoconf \
    automake \
    libtool \
    && rm -rf /var/lib/apt/lists/*

# Clone osmo-tetra
RUN git clone https://github.com/sq5bpf/osmo-tetra-sq5bpf.git /build/osmo-tetra

WORKDIR /build/osmo-tetra/src
RUN make

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libosmocore \
    libtalloc2 \
    sox \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/osmo-tetra/src/tetra-rx /usr/local/bin/tetra-rx
COPY --from=builder /build/osmo-tetra/src/float_to_bits /usr/local/bin/float_to_bits

WORKDIR /data
ENTRYPOINT ["tetra-rx"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/osmo-tetra .

# Run with demodulated baseband piped from host
# Step 1: On host, run GNU Radio TETRA demodulator or SDR++ TETRA plugin
# Step 2: Pipe the demodulated bits to osmo-tetra

# Using named pipe
mkfifo /tmp/tetra_bits
docker run --rm -it \
  -v /tmp/tetra_bits:/data/tetra_bits \
  -v $(pwd)/recordings:/recordings \
  argos/osmo-tetra \
  /data/tetra_bits

# Using stdin pipe from GNU Radio demodulator on host
gnuradio-companion tetra_demod.grc | \
docker run --rm -i \
  -v $(pwd)/recordings:/recordings \
  argos/osmo-tetra \
  /dev/stdin
```

---

## Install Instructions (Native)

```bash
# ============================================
# osmo-tetra Native Install on Kali Linux RPi5
# ============================================

# Install dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  git \
  pkg-config \
  libtalloc-dev \
  libosmocore-dev \
  autoconf \
  automake \
  libtool

# Clone osmo-tetra (sq5bpf fork with voice decoding and telive)
cd /opt
sudo git clone https://github.com/sq5bpf/osmo-tetra-sq5bpf.git
cd osmo-tetra-sq5bpf/src
sudo make

# Install binaries
sudo cp tetra-rx /usr/local/bin/
sudo cp float_to_bits /usr/local/bin/

# Test installation
tetra-rx --help

# Install telive (companion display tool)
cd /opt
sudo git clone https://github.com/sq5bpf/telive.git
cd telive
sudo make
sudo cp telive /usr/local/bin/

# ============================================
# Usage: Requires a TETRA demodulator feeding bits
# ============================================

# Option A: Use SDR++ with TETRA demodulator plugin
# 1. Run SDR++ tuned to TETRA frequency (e.g., 390 MHz)
# 2. Enable TETRA demodulator plugin
# 3. Plugin outputs bits to named pipe
# 4. Feed pipe to tetra-rx

# Option B: Use GNU Radio TETRA demodulator
# 1. Install gr-tetra (Osmocom GNU Radio TETRA blocks)
sudo apt-get install -y gnuradio-dev gr-osmosdr
cd /opt
sudo git clone https://gitea.osmocom.org/sdr/gr-tetra.git
cd gr-tetra
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo make install
sudo ldconfig

# 2. Run the demodulator and pipe to tetra-rx
# gnuradio-companion /opt/gr-tetra/examples/tetra_rx.grc | tetra-rx /dev/stdin

# Option C: Use rtl_fm for simple demodulation
rtl_fm -f 390000000 -s 36000 -g 40 - | \
float_to_bits | \
tetra-rx /dev/stdin

# Run telive display alongside tetra-rx
# Terminal 1:
tetra-rx /dev/stdin < /tmp/tetra_bits
# Terminal 2:
telive
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — pure C with Makefile; libosmocore available in Debian ARM64 repos             |
| Kali Repo Available   | :x: Not in Kali repos — build from source; dependencies (libosmocore) available via apt                 |
| Hardware Requirements | Any SDR via demodulator (RTL-SDR typical for TETRA at 380-470 MHz); HackRF or USRP also work            |
| Performance on RPi5   | :white_check_mark: Excellent — pure C decoder is very lightweight; ~5-10% CPU for single-channel decode |

### RPi5-Specific Notes

- osmo-tetra itself is very lightweight (pure C, no frameworks)
- The demodulator component (GNU Radio or SDR++) adds the bulk of CPU load
- RTL-SDR is well-suited for TETRA frequencies (380-470 MHz, within its range)
- HackRF also works for TETRA but RTL-SDR is adequate and cheaper
- telive companion tool provides a clean ncurses display of decoded TETRA traffic
- Memory usage: ~30-50 MB for osmo-tetra alone; add ~200-500 MB if GNU Radio demodulator runs locally

### Argos Integration Notes

- Decoded SDS messages (text) can be logged and displayed in Argos dashboard
- Voice output can be recorded and indexed by ISSI/GSSI (subscriber/group IDs)
- TETRA system info reveals network topology (base stations, frequency assignments, encryption status)
- Only relevant at European theater exercises (JMRC, NATO). Not needed for NTC (US) deployments
- Could feed TETRA data to CoT gateways for TAK integration

### Verdict

**COMPATIBLE** — osmo-tetra compiles and runs natively on RPi 5 with minimal resource usage. The pure C codebase has no heavy dependencies beyond libosmocore. Primary use case is European theater operations (JMRC, NATO exercises) where TETRA is the standard radio protocol. Lower priority for NTC/US deployments where P25 tools (trunk-recorder, OP25) are more relevant.
