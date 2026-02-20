# gr-iridium

> **RISK CLASSIFICATION**: MEDIUM RISK - SENSITIVE SOFTWARE
> Iridium satellite burst detector and demodulator. Intercepts and decodes Iridium satellite communications including pager messages, position data, and ring alerts. Passive receive-only — no transmit capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — RPi 4 documented in README with ARM optimization tips; GNU Radio 3.10 required; computationally intensive

| Method               | Supported | Notes                                                                                                                    |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Docker Container** | PARTIAL   | No official image; `thebiggerguy/gr-iridium` community image (125 pulls, stale); custom Dockerfile with GNU Radio needed |
| **Native Install**   | YES       | README documents "Ubuntu 22.04 on Raspberry Pi 4 (from source)" with ARM optimization flags                              |

---

## Tool Description

gr-iridium is a GNU Radio out-of-tree (OOT) module for detecting and demodulating Iridium satellite bursts at 1626 MHz (L-band). The Iridium constellation consists of 66 active satellites in low Earth orbit providing global communications coverage. gr-iridium captures the raw RF bursts and, combined with the companion `iridium-toolkit`, decodes various Iridium message types including pager messages, position information, ring alerts, and system parameters.

Key capabilities:

- Detects and extracts Iridium bursts from wideband IQ recordings or live SDR streams
- Requires 10+ MSPS bandwidth to capture Iridium's frequency-hopping TDMA bursts
- HackRF (20 MSPS native) is ideal — captures full Iridium band with margin
- USRP also well-suited (variable sample rate, wideband)
- RTL-SDR too narrow (2.4 MSPS) for meaningful Iridium capture
- Outputs burst data for processing by `iridium-toolkit`
- `iridium-toolkit` decodes: IRA (Iridium Ring Alert) pager messages, IBC (Iridium Broadcast Channel), IMS (Iridium Messaging Service), position/timing data
- Satellite tracking and identification from decoded messages
- Can reconstruct Iridium constellation status from decoded system broadcasts

**Note**: Computationally intensive on ARM — use `--samples_per_symbol` and `--max_burst_len` flags for RPi optimization.

## Category

Satellite SIGINT / Iridium Interception / L-band Reception

## Repository

- **GitHub**: https://github.com/muccc/gr-iridium
- **Companion**: https://github.com/muccc/iridium-toolkit
- **Language**: Python / C++ (GNU Radio OOT)
- **License**: GPL-3.0
- **Stars**: ~457

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** — No official Docker image. A community image `thebiggerguy/gr-iridium` exists but has only ~125 pulls and may be stale. A custom Dockerfile based on `gnuradio/gnuradio:latest` or `debian:bookworm-slim` with GNU Radio is needed. The GNU Radio + SDR dependencies make the image ~2-4 GB.

### Docker Requirements

- `--privileged` — Required for SDR USB passthrough
- `--device=/dev/bus/usb` — USB passthrough for HackRF or USRP
- CPU-intensive: consider `--cpus=3` to leave headroom for other Argos services
- Volume mount for burst output files: `-v /path/to/output:/output`
- Volume mount for iridium-toolkit processing: `-v /path/to/toolkit:/toolkit`
- No network ports required for core operation

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    gnuradio-dev \
    gr-osmosdr \
    libhackrf-dev \
    libuhd-dev \
    libvolk-dev \
    pybind11-dev \
    python3 \
    python3-dev \
    python3-numpy \
    && rm -rf /var/lib/apt/lists/*

# Build gr-iridium
RUN git clone https://github.com/muccc/gr-iridium.git /build/gr-iridium
WORKDIR /build/gr-iridium
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gnuradio \
    gr-osmosdr \
    libhackrf0 \
    libvolk2.5 \
    python3 \
    python3-numpy \
    python3-zmq \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3/dist-packages/gnuradio/iridium/ /usr/local/lib/python3/dist-packages/gnuradio/iridium/
COPY --from=builder /usr/local/lib/lib* /usr/local/lib/
COPY --from=builder /usr/local/bin/iridium* /usr/local/bin/
RUN ldconfig

# Install iridium-toolkit
RUN git clone https://github.com/muccc/iridium-toolkit.git /opt/iridium-toolkit

WORKDIR /output
ENTRYPOINT ["iridium-extractor"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/gr-iridium .

# Capture Iridium bursts with HackRF (live)
docker run --rm -it \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/iridium-output:/output \
  argos/gr-iridium \
  -D 4 --raw-capture /output/iridium.raw hackrf=0

# With RPi optimization flags
docker run --rm -it \
  --privileged \
  --device=/dev/bus/usb \
  --cpus=3 \
  -v $(pwd)/iridium-output:/output \
  argos/gr-iridium \
  -D 4 --samples-per-symbol 10 hackrf=0 | tee /output/bursts.txt

# Decode captured bursts with iridium-toolkit
docker run --rm -it \
  -v $(pwd)/iridium-output:/output \
  --entrypoint python3 \
  argos/gr-iridium \
  /opt/iridium-toolkit/iridium-parser.py /output/bursts.txt
```

---

## Install Instructions (Native)

```bash
# ============================================
# gr-iridium Native Install on Kali Linux RPi5
# ============================================

# Install GNU Radio and SDR dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  gnuradio-dev \
  gr-osmosdr \
  libhackrf-dev \
  libuhd-dev \
  libvolk-dev \
  pybind11-dev \
  python3 \
  python3-dev \
  python3-numpy

# Clone and build gr-iridium
cd /opt
sudo git clone https://github.com/muccc/gr-iridium.git
cd gr-iridium
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo make install
sudo ldconfig

# Test installation
iridium-extractor --help

# Install iridium-toolkit (companion decoder)
cd /opt
sudo git clone https://github.com/muccc/iridium-toolkit.git
cd iridium-toolkit
pip3 install --break-system-packages -r requirements.txt 2>/dev/null || true

# ============================================
# Usage
# ============================================

# Capture Iridium bursts with HackRF (1626 MHz, 20 MSPS)
# Note: HackRF is ideal — Iridium needs 10+ MSPS bandwidth
iridium-extractor -D 4 hackrf=0 2>/dev/null | tee /tmp/iridium_bursts.txt

# With RPi optimization (reduce sample processing load)
iridium-extractor -D 4 --samples-per-symbol 10 hackrf=0 | tee /tmp/iridium_bursts.txt

# Process captured bursts with iridium-toolkit
python3 /opt/iridium-toolkit/iridium-parser.py /tmp/iridium_bursts.txt

# Extract specific message types
grep "IRA:" /tmp/iridium_bursts.txt  # Ring alerts (pager)
grep "IBC:" /tmp/iridium_bursts.txt  # Broadcast channel
grep "IMS:" /tmp/iridium_bursts.txt  # Messaging service

# Record raw IQ for offline analysis
iridium-extractor -D 4 --raw-capture /tmp/iridium_raw.fc32 hackrf=0
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — README documents RPi 4 from-source build; RPi 5 is more capable                              |
| Kali Repo Available   | :x: Not in Kali repos — build from source; GNU Radio and SDR deps available via apt                                    |
| Hardware Requirements | HackRF One (best — 20 MSPS captures full Iridium band); USRP (alternative); RTL-SDR insufficient (2.4 MSPS too narrow) |
| Performance on RPi5   | :warning: Moderate — computationally intensive DSP; uses 50-80% CPU; use optimization flags for ARM                    |

### RPi5-Specific Notes

- README explicitly documents Ubuntu 22.04 on Raspberry Pi 4 build — RPi 5 Cortex-A76 is significantly faster
- Iridium burst detection is CPU-intensive due to wideband FFT processing at 10-20 MSPS
- Use `--samples-per-symbol 10` flag to reduce processing load on ARM
- HackRF is the best SDR for this application — its 20 MSPS captures the full Iridium downlink band
- RTL-SDR is NOT suitable — 2.4 MSPS bandwidth is too narrow for Iridium's frequency-hopping TDMA
- Memory usage: ~500 MB - 1 GB with GNU Radio pipeline active
- Consider running captures in bursts (not 24/7) to manage CPU and thermal load on RPi 5

### Argos Integration Notes

- Decoded Iridium messages provide satellite SIGINT — know what's transmitting from orbit above your AO
- Ring alerts (IRA) reveal Iridium phone activity patterns
- Position data from decoded messages can be plotted on Argos tactical map
- Iridium is used by military, government, and maritime users for satellite communications
- Pairs with gr-satellites for comprehensive satellite signal awareness
- Batch processing model: capture bursts for a period, then decode offline — suits RPi 5 resource constraints

### Verdict

**COMPATIBLE** — gr-iridium runs on RPi 5 with optimization flags. The README documents RPi 4 support; RPi 5 is more capable. Computationally intensive but manageable with `--samples-per-symbol` optimization. HackRF is required (RTL-SDR insufficient). Provides a unique satellite SIGINT capability not available from any other tool in the Argos suite.
