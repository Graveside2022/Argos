# LTE-Cell-Scanner

> **RISK CLASSIFICATION**: MODERATE RISK
> LTE cell tower detection and analysis. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Builds on ARM64 but limited to 1.4MHz bandwidth

| Method               | Supported | Notes                                            |
| -------------------- | --------- | ------------------------------------------------ |
| **Docker Container** | YES       | Build from source, RTL-SDR/USRP USB passthrough  |
| **Native Install**   | PARTIAL   | Compiles on ARM64 but limited bandwidth on RPi 5 |

---

## Tool Description

Quick LTE cell detection and analysis tool. Scans for LTE cells in range and displays their parameters including Physical Cell ID (PCI), center frequency, bandwidth, MIB/SIB content, and signal strength. Uses RTL-SDR or USRP as the RF frontend. Useful for rapid reconnaissance of the LTE cellular landscape before deploying more advanced tools like FALCON or LTESniffer.

## Category

Cellular Reconnaissance / LTE Cell Scanner

## Repository

https://github.com/Evrytania/LTE-Cell-Scanner

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - C++ application with standard build dependencies. RTL-SDR or USRP USB passthrough required.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - RTL-SDR or USRP USB passthrough
- `--privileged` - For USB device access
- No kernel modules needed
- No `--net=host` required

### Docker-to-Host Communication

- CLI output only (stdout)
- No network services
- Optional file output via volume mount

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install

```bash
sudo apt install -y build-essential cmake git \
    librtlsdr-dev rtl-sdr libfftw3-dev libboost-all-dev \
    libitpp-dev libncurses5-dev
git clone https://github.com/Evrytania/LTE-Cell-Scanner.git /opt/lte-cell-scanner
cd /opt/lte-cell-scanner
mkdir build && cd build
cmake ../
make -j4
sudo make install
```

### Option B: Docker

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    librtlsdr-dev rtl-sdr libfftw3-dev \
    libboost-all-dev libitpp-dev libncurses5-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Evrytania/LTE-Cell-Scanner.git /opt/lte-scanner && \
    cd /opt/lte-scanner && mkdir build && cd build && \
    cmake ../ && make -j$(nproc) && make install

ENTRYPOINT ["CellSearch"]
```

```bash
# Build
docker build -t argos/lte-cell-scanner .

# Run - scan for LTE cells using RTL-SDR
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/lte-cell-scanner -s 739e6 -e 757e6
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**PARTIAL** - The code is standard C++ and should compile on ARM64. However, the project has not been actively maintained (last significant update several years ago) and has no CI testing for ARM64. ITPP library availability on ARM64 may require manual building.

### Hardware Constraints

- **CPU**: LTE cell search involves correlation and FFT operations. RPi 5 can handle single-band scanning but may struggle with wideband sweeps.
- **RAM**: ~500MB during operation. Feasible on 8GB RPi.
- **SDR**: RTL-SDR (recommended) or USRP. RTL-SDR bandwidth (2.4 MHz) limits to single-band scanning.

### Verdict

**PARTIAL COMPATIBILITY** - Should compile and run for basic LTE cell detection with RTL-SDR. Performance will be limited compared to x86 systems. Not suitable for continuous monitoring but adequate for initial field reconnaissance. Consider `srsRAN_Project` cell search as a more modern alternative with explicit ARM64 support.
