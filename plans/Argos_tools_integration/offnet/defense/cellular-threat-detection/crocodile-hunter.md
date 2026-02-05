# Crocodile Hunter

> **RISK CLASSIFICATION**: MODERATE RISK
> 4G/LTE fake base station detector. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Python works but srsLTE dependency heavy on ARM

| Method               | Supported | Notes                                                    |
| -------------------- | --------- | -------------------------------------------------------- |
| **Docker Container** | YES       | Python + srsLTE, USRP USB passthrough                    |
| **Native Install**   | PARTIAL   | srsLTE builds on ARM64 but not optimized; may miss cells |

---

## Tool Description

EFF's 4G/LTE fake base station detector. Uses srsLTE (now srsRAN_4G) to passively scan for LTE cells and detect rogue eNodeBs (fake 4G base stations). Compares observed cell parameters against known legitimate cell tower databases to identify anomalies. Maps cell towers in the area and flags suspicious ones based on:

- Signal strength anomalies (too strong for location)
- Inconsistent cell parameters (wrong TAC, EARFCN mismatches)
- Missing or modified System Information Blocks (SIBs)
- Encryption downgrade indicators

Originally designed to run on Raspberry Pi 4 with USRP SDR.

## Category

IMSI Catcher Detection / Fake Base Station Detection

## Repository

https://github.com/EFForg/crocodilehunter

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Python application with srsLTE/srsRAN dependency for cell scanning. Can be containerized with SDR USB passthrough.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USRP or compatible SDR passthrough
- `--privileged` - For SDR USB access
- UHD drivers in container or on host
- No `--net=host` needed (standalone scanner)

### Docker-to-Host Communication

- CLI output and log files via volume mount
- No network services in default mode
- Optional web UI for map display

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install

```bash
sudo apt install -y python3-pip python3-numpy python3-scipy python3-dev \
    build-essential cmake libfftw3-dev libmbedtls-dev libboost-program-options-dev \
    libconfig++-dev libsctp-dev libuhd-dev uhd-host libmariadb-dev mariadb-server \
    gpsd gpsd-clients jq

git clone --recursive https://github.com/EFForg/crocodilehunter.git /opt/crocodile-hunter
cd /opt/crocodile-hunter
pip3 install -r src/requirements.txt

# Build srsLTE from submodule (no apt package available on ARM64)
cd src/srsLTE && mkdir build && cd build
cmake ../ && make -j$(nproc) && make install
```

### Option B: Docker

```dockerfile
FROM python:3.11-bookworm

RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libfftw3-dev libmbedtls-dev libboost-program-options-dev \
    libconfig++-dev libsctp-dev libuhd-dev uhd-host \
    && rm -rf /var/lib/apt/lists/*

RUN uhd_images_downloader || true

# Build srsRAN_4G cell search tools
RUN git clone https://github.com/srsran/srsRAN_4G.git /opt/srsran && \
    cd /opt/srsran && mkdir build && cd build && \
    cmake ../ && make -j$(nproc) && make install

RUN git clone --recursive https://github.com/EFForg/crocodilehunter.git /opt/crochunter

# Build srsLTE submodule
RUN cd /opt/crochunter/src/srsLTE && mkdir build && cd build && \
    cmake ../ && make -j$(nproc) && make install

WORKDIR /opt/crochunter
RUN pip install --no-cache-dir -r src/requirements.txt

ENTRYPOINT ["python3", "src/crocodilehunter.py"]
```

```bash
# Build
docker build -t argos/crocodile-hunter .

# Run - scan for fake base stations
docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/logs:/opt/crochunter/logs \
  argos/crocodile-hunter --scan
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**PARTIAL** - The Python components work on ARM64. The srsLTE/srsRAN_4G dependency builds on ARM64 but is not optimized. The EFF originally designed Crocodile Hunter for RPi 4, suggesting ARM compatibility was considered.

### Hardware Constraints

- **CPU**: Cell scanning with srsRAN is moderately CPU-intensive. RPi 5 (faster than RPi 4) should handle basic scanning but may miss cells during busy periods.
- **RAM**: ~1GB. Feasible on 8GB RPi.
- **SDR**: Requires USRP B200/B210 or compatible SDR. Not compatible with RTL-SDR (needs TX capability for some features) or HackRF.

### Verdict

**PARTIAL COMPATIBILITY** - Was originally targeting RPi 4, so RPi 5 should handle basic operation. The srsRAN dependency is the bottleneck — ARM64 builds work but aren't optimized. Cell scanning at limited bandwidth is feasible. Not suitable for continuous wide-area monitoring.
