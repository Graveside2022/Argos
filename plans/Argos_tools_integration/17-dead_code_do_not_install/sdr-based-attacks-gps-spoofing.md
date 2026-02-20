# SDR-Based-Attacks (GPS Spoofing)

> **HIGH RISK - SENSITIVE SOFTWARE**
> Transmits counterfeit GPS L1 signals via HackRF. Can redirect any GPS-dependent device (drones, vehicles, phones, aircraft navigation). Illegal to transmit GPS signals without authorization under federal law (18 U.S.C. 32, 49 U.S.C. 46505). Use only in RF-shielded environments or with explicit authorization.

> **WARNING: DOCUMENTATION ONLY** - The SDR-Based-Attacks repository contains only documentation and reference materials, not deployable software. Use gps-sdr-sim for actual GPS spoofing capabilities.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                 |
| -------------------- | --------- | ------------------------------------- |
| **Docker Container** | YES       | C + HackRF tools, USB passthrough     |
| **Native Install**   | YES       | Pure C, compiles with `make` on ARM64 |

---

## Description

GPS spoofing attack toolkit that generates fake GPS L1 C/A baseband signals and transmits them via HackRF One. Wraps gps-sdr-sim to create counterfeit satellite signals with arbitrary coordinates, then uses hackrf_transfer to broadcast them over-the-air. Targets include drones, navigation systems, and any GPS-enabled device within transmission range.

## Category

GPS Spoofing / GNSS Attack / Active RF Transmission

## Source

- **Repository**: https://github.com/Aidan-Lenz/SDR-Based-Attacks
- **Status**: EXPERIMENTAL
- **Language**: C (gps-sdr-sim core), Bash scripts
- **Dependencies**: gps-sdr-sim, hackrf host tools, gcc, libhackrf

## Docker Compatibility

| Attribute                | Value                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| Docker Compatible        | Yes                                                              |
| ARM64 (aarch64) Support  | Yes                                                              |
| Base Image               | debian:bookworm-slim                                             |
| Privileged Mode Required | Yes (HackRF USB access + transmission)                           |
| Host Network Required    | No                                                               |
| USB Device Passthrough   | HackRF One (`/dev/bus/usb`)                                      |
| Host Kernel Modules      | hackrf (udev rules on host: `/etc/udev/rules.d/52-hackrf.rules`) |

### Docker-to-Host Communication

- HackRF One must be connected and accessible via USB. Host requires HackRF udev rules:
    ```
    ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0660", GROUP="plugdev"
    ```
- Container needs `--privileged` or `--device=/dev/bus/usb` plus `SYS_RAWIO` capability.
- No network communication required. All interaction is via USB to HackRF for RF transmission.

## Install Instructions (Docker)

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    hackrf \
    libhackrf-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Build gps-sdr-sim
RUN git clone https://github.com/osqzss/gps-sdr-sim.git /opt/gps-sdr-sim \
    && cd /opt/gps-sdr-sim \
    && make

# Clone attack scripts
RUN git clone https://github.com/Aidan-Lenz/SDR-Based-Attacks.git /opt/sdr-attacks

# Download current GPS ephemeris (needed for signal generation)
# Must be refreshed daily for accurate spoofing
RUN cd /opt/gps-sdr-sim && \
    wget -q "https://cddis.nasa.gov/archive/gnss/data/daily/2024/brdc/brdc0010.24n.Z" -O brdc.Z && \
    gunzip brdc.Z || true

ENV PATH="/opt/gps-sdr-sim:/opt/sdr-attacks:${PATH}"

WORKDIR /opt/sdr-attacks

CMD ["/bin/bash"]
```

```bash
# Build
docker build -t gps-spoof .

# Run with HackRF
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  gps-spoof

# Inside container - generate spoofed signal for specific coordinates:
# gps-sdr-sim -e brdc.n -l 38.8977,‑77.0365,100 -b 8 -o gpssim.bin
# hackrf_transfer -t gpssim.bin -f 1575420000 -s 2600000 -a 1 -x 0
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                                                                                                               |
| Architecture     | aarch64 native (pure C, compiles with gcc on ARM64)                                                                                                                                                                                               |
| RAM Requirement  | ~256MB (signal generation is CPU-bound, not memory-heavy)                                                                                                                                                                                         |
| Limiting Factors | GPS signal generation is computationally intensive. RPi5 Cortex-A76 can generate signals in near-real-time but may struggle with dynamic real-time trajectory spoofing at full sample rate (2.6 Msps). Pre-computing signal files is recommended. |
