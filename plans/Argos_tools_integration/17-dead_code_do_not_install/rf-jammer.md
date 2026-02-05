# RF-Jammer (2.4/5.8 GHz)

> **HIGH RISK - EXTREME - SENSITIVE SOFTWARE**
> Wideband RF jamming across ISM bands (2.4 GHz and 5.8 GHz). Disrupts ALL wireless communications in range: WiFi, Bluetooth, Zigbee, drone control links, FPV video, baby monitors, medical devices, and emergency communications. This is the most indiscriminate tool in the counter-UAS toolkit. Illegal under FCC Part 15 and the Communications Act of 1934 (47 U.S.C. 333). Federal felony to operate. Use ONLY in RF-shielded facilities with explicit authorization.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                          |
| -------------------- | --------- | ---------------------------------------------- |
| **Docker Container** | YES       | GNU Radio + HackRF, USB passthrough            |
| **Native Install**   | YES       | GNU Radio and HackRF tools in Kali ARM64 repos |

---

## Description

SDR-based wideband ISM band jammer using HackRF One. Generates continuous or frequency-hopping interference across 2.4 GHz and 5.8 GHz bands to disrupt drone control links and FPV video feeds. Features adaptive power control and frequency hopping jamming patterns. Implemented using GNU Radio flowgraphs or direct HackRF sample generation.

## Category

Wideband RF Jamming / Electronic Warfare / Active RF Transmission

## Source

- **Reference implementations**:
    - https://github.com/jhonnybonny/CleverJAM (Smart jammer with frequency hopping — `jam.py`, `clever.py`, GNU Radio flowgraph)
    - https://github.com/pietrotedeschi/power-modulated-jammer (Power-modulated GNU Radio jammer — `pmj.py`)
    - https://github.com/tiiuae/jamrf (README-only reference, no deployable code)
- **Status**: EXPERIMENTAL
- **Language**: Python (GNU Radio flowgraphs), C
- **Dependencies**: GNU Radio, gr-osmosdr, libhackrf

## Docker Compatibility

| Attribute                | Value                                    |
| ------------------------ | ---------------------------------------- |
| Docker Compatible        | Yes                                      |
| ARM64 (aarch64) Support  | Yes                                      |
| Base Image               | debian:bookworm-slim                     |
| Privileged Mode Required | Yes (HackRF USB access, RF transmission) |
| Host Network Required    | No                                       |
| USB Device Passthrough   | HackRF One (`/dev/bus/usb`)              |
| Host Kernel Modules      | hackrf (udev rules on host)              |

### Docker-to-Host Communication

- HackRF One must be accessible via USB passthrough. Host needs HackRF udev rules installed.
- Container requires `--privileged` for raw USB device access.
- No network communication required. Operates entirely via USB to HackRF for RF transmission.
- **WARNING**: Once transmitting, the jammer affects all devices within RF range. There is no software-level containment.

## Install Instructions (Docker)

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    gnuradio \
    gr-osmosdr \
    hackrf \
    libhackrf-dev \
    python3-numpy \
    && rm -rf /var/lib/apt/lists/*

# Clone jamming implementations
RUN git clone https://github.com/jhonnybonny/CleverJAM.git /opt/cleverjam
RUN git clone https://github.com/pietrotedeschi/power-modulated-jammer.git /opt/pmj

WORKDIR /opt/cleverjam

CMD ["/bin/bash"]
```

```bash
# Build
docker build -t rf-jammer .

# Run with HackRF
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  rf-jammer

# Inside container — CleverJAM (frequency-hopping jammer):
# python3 jam.py
# Or power-modulated jammer:
# cd /opt/pmj && python3 pmj.py
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                                                                                                                                                                                                                         |
| Architecture     | aarch64 native (GNU Radio compiles on ARM64, HackRF tools available in Kali repos)                                                                                                                                                                                                                                                                          |
| RAM Requirement  | ~1GB (GNU Radio signal processing)                                                                                                                                                                                                                                                                                                                          |
| Limiting Factors | HackRF One has limited TX bandwidth (~20 MHz). Cannot simultaneously jam full 2.4 GHz and 5.8 GHz bands with single HackRF (must alternate or use two units). GNU Radio on RPi5 is functional but CPU-intensive for continuous waveform generation. HackRF TX power is low (~15 dBm) so effective jamming radius is limited without external amplification. |
