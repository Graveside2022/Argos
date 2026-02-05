# gr-satellites

> **RISK CLASSIFICATION**: LOW RISK
> Amateur and research satellite telemetry decoder. Decodes publicly transmitted satellite beacons, weather data, and telemetry from 100+ satellites. All decoded signals are publicly broadcast. Receive-only — no transmit capability.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Standard GNU Radio OOT module; Debian `Architecture: any`; builds from source on ARM64

| Method               | Supported | Notes                                                                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | No current Docker image (stale community v1.8 on Ubuntu 19.10 — ignore); needs custom Dockerfile with GNU Radio base  |
| **Native Install**   | YES       | Standard GNU Radio OOT build with CMake; Debian packages available for some architectures; build from source on ARM64 |

---

## Tool Description

gr-satellites is a GNU Radio out-of-tree (OOT) module that provides decoders for over 100 amateur and research satellites. It handles the complete signal processing chain from IQ samples to decoded telemetry frames, supporting a wide range of modulations and protocols used by satellites in low Earth orbit (LEO) and geostationary orbit (GEO).

Key capabilities:

- Decodes telemetry from 100+ satellites including CubeSats, research satellites, and weather satellites
- Supported protocols: AX.25, GOMspace modems, FUNcube Dongle protocol, LilacSat, CCSDS, CSP (CubeSat Space Protocol), many more
- Supported modulations: FSK, BPSK, QPSK, GMSK, AFSK, LoRa (for satellite LoRa), SSB CW
- Real-time decoding from live SDR or offline from IQ recordings (SigMF compatible)
- Command-line interface for automated satellite pass decoding
- GNU Radio Companion flowgraph integration for custom processing chains
- Satellite database with frequency, modulation, and protocol info
- Doppler correction support when paired with orbital prediction tools (gpredict)
- Frame output in KISS, hex dump, or protocol-specific formats
- Telemetry upload to SatNOGS network (community satellite monitoring)

## Category

Satellite Telemetry Decoding / Space SIGINT / Amateur Satellite Monitoring

## Repository

- **GitHub**: https://github.com/daniestevez/gr-satellites
- **Language**: Python / C++ (GNU Radio OOT)
- **License**: GPL-3.0
- **Stars**: ~910

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** — No maintained Docker image exists. A stale community image (v1.8 on Ubuntu 19.10) should be ignored. A custom Dockerfile with GNU Radio base is needed. The image will be 2-4 GB due to GNU Radio dependencies.

### Docker Requirements

- `--privileged` — Required for SDR USB passthrough
- `--device=/dev/bus/usb` — USB passthrough for HackRF, RTL-SDR, USRP
- Volume mount for IQ recordings: `-v /path/to/iq:/iq`
- Volume mount for decoded output: `-v /path/to/output:/output`
- No network ports required for core operation; optional for SatNOGS upload

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
    librtlsdr-dev \
    libuhd-dev \
    pybind11-dev \
    python3 \
    python3-dev \
    python3-numpy \
    python3-pip \
    python3-construct \
    python3-requests \
    && rm -rf /var/lib/apt/lists/*

# Build gr-satellites
RUN git clone https://github.com/daniestevez/gr-satellites.git /build/gr-satellites
WORKDIR /build/gr-satellites
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
    librtlsdr0 \
    python3 \
    python3-numpy \
    python3-construct \
    python3-requests \
    python3-zmq \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3/dist-packages/gnuradio/satellites/ /usr/local/lib/python3/dist-packages/gnuradio/satellites/
COPY --from=builder /usr/local/lib/lib* /usr/local/lib/
COPY --from=builder /usr/local/bin/gr_satellites /usr/local/bin/
COPY --from=builder /usr/local/share/gr-satellites/ /usr/local/share/gr-satellites/
RUN ldconfig

WORKDIR /output
ENTRYPOINT ["gr_satellites"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/gr-satellites .

# Decode ISS APRS packets (145.825 MHz) with RTL-SDR
docker run --rm -it \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/sat-output:/output \
  argos/gr-satellites \
  ISS --source osmocom --osmocom-args "rtl=0" --samp-rate 2.4e6

# Decode from IQ recording file (SigMF format)
docker run --rm -it \
  -v $(pwd)/iq-files:/iq \
  -v $(pwd)/sat-output:/output \
  argos/gr-satellites \
  FUNcube-1 --wavfile /iq/funcube_pass.wav --samp-rate 48000

# List all supported satellites
docker run --rm argos/gr-satellites --list
```

---

## Install Instructions (Native)

```bash
# ============================================
# gr-satellites Native Install on Kali Linux RPi5
# ============================================

# Install GNU Radio and build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  gnuradio-dev \
  gr-osmosdr \
  libhackrf-dev \
  librtlsdr-dev \
  libuhd-dev \
  pybind11-dev \
  python3 \
  python3-dev \
  python3-numpy \
  python3-pip \
  python3-construct \
  python3-requests

# Clone and build gr-satellites
cd /opt
sudo git clone https://github.com/daniestevez/gr-satellites.git
cd gr-satellites
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo make install
sudo ldconfig

# Test installation
gr_satellites --help
gr_satellites --list  # Show all supported satellites

# ============================================
# Usage Examples
# ============================================

# Decode ISS APRS digipeater (145.825 MHz) with RTL-SDR
gr_satellites ISS \
  --source osmocom \
  --osmocom-args "rtl=0" \
  --samp-rate 2.4e6

# Decode with HackRF
gr_satellites ISS \
  --source osmocom \
  --osmocom-args "hackrf=0" \
  --samp-rate 4e6

# Decode NOAA-15 APT weather satellite (137.620 MHz)
gr_satellites NOAA-15 \
  --source osmocom \
  --osmocom-args "rtl=0" \
  --samp-rate 2.4e6

# Decode from pre-recorded IQ file
gr_satellites FUNcube-1 \
  --wavfile /path/to/recording.wav \
  --samp-rate 48000

# Decode from SigMF recording (pairs with SigMF tool)
gr_satellites AAUSAT-4 \
  --file-name /path/to/recording.sigmf-data \
  --samp-rate 48000
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ARM64 Support         | :white_check_mark: Full — Debian `Architecture: any`; standard GNU Radio OOT build patterns                        |
| Kali Repo Available   | :x: Not in Kali repos — build from source; GNU Radio and SDR deps available via apt                                |
| Hardware Requirements | RTL-SDR (good for most satellite downlinks); HackRF (wider bandwidth); USRP (best sensitivity); satellite antenna  |
| Performance on RPi5   | :warning: Moderate — GNU Radio DSP chain; ~20-40% CPU per satellite decode; manageable for single-satellite passes |

### RPi5-Specific Notes

- Standard GNU Radio OOT module — follows established ARM64 build patterns
- Most satellite downlinks are in VHF/UHF (137-440 MHz) or L-band (1.2-1.7 GHz) — all within HackRF/RTL-SDR range
- RTL-SDR is sufficient for most amateur satellites (narrow bandwidth signals)
- HackRF provides wider bandwidth for satellites with spread-spectrum or wider modulations
- Satellite passes are transient (5-15 minutes) so CPU load is not sustained
- Consider using orbital prediction (gpredict) to schedule automatic recording of passes
- Memory usage: ~300-500 MB with GNU Radio runtime

### Argos Integration Notes

- Satellite telemetry provides overhead signals awareness — know what's transmitting from space above the AO
- ISS APRS decoding shows amateur radio packet activity from orbit
- Weather satellite decoding (NOAA APT, Meteor M2) provides local weather imagery
- Pairs with gr-iridium: gr-iridium handles Iridium specifically, gr-satellites handles everything else
- SigMF recordings from Argos IQ capture can be decoded offline by gr-satellites
- Satellite pass schedule can be displayed on Argos tactical map

### Verdict

**COMPATIBLE** — gr-satellites runs on RPi 5 as a standard GNU Radio OOT module. Decodes 100+ satellites with any SDR. Lower priority than aviation and trunked radio tools but adds a unique satellite SIGINT dimension to Argos. CPU usage is intermittent (satellite passes only), making it manageable alongside other tools.
