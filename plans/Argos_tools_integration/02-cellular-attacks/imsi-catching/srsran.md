# srsRAN

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> LTE/5G base station and passive sniffer with ARM64 support. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Passive sniffer mode works; active BTS mode does not

| Method               | Supported | Notes                                                   |
| -------------------- | --------- | ------------------------------------------------------- |
| **Docker Container** | YES       | srsRAN_Project has explicit ARM64 support               |
| **Native Install**   | PARTIAL   | Passive mode feasible, active gNB/eNB too CPU-intensive |

---

## Tool Description

Open-source 4G LTE and 5G NR software radio suite. Two versions exist:

- **srsRAN_4G** (github.com/srsran/srsRAN_4G): Mature 4G LTE implementation — includes eNodeB (base station), UE (user equipment emulator), and EPC (core network). Can operate as a passive sniffer for IMSI/TMSI collection, cell broadcast monitoring, and paging channel analysis.

- **srsRAN_Project** (github.com/srsran/srsRAN_Project): Newer 5G NR O-RAN CU/DU implementation with **explicit ARM64 optimization**. This is the recommended version for Argos deployment.

When paired with Open5GS, srsRAN creates a complete rogue LTE/5G base station. In passive sniffer mode (no Open5GS needed), it monitors LTE/5G traffic without transmitting.

## Category

LTE/5G Software Radio Suite / Passive Sniffer / Rogue Base Station

## Repository

- https://github.com/srsran/srsRAN_4G (4G suite)
- https://github.com/srsran/srsRAN_Project (5G O-RAN)

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - srsRAN_Project has Docker support with ARM64-specific library paths in its Dockerfile. Passive sniffing mode works in Docker. Active base station mode requires `--privileged` and real-time scheduling.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USRP or LimeSDR USB passthrough
- `--privileged` - Required for SDR access and real-time scheduling (active mode)
- `--net=host` - Required for SCTP (S1AP/NGAP) connection to Open5GS core
- UHD drivers installed (in container or on host)
- For active mode: `--ulimit rtprio=99` for real-time thread priority

### Docker-to-Host Communication

- S1AP/NGAP: Port 38412 (SCTP) — to Open5GS AMF/MME
- GTP-U: Port 2152 (UDP) — user plane to Open5GS UPF/SGW
- USRP USB communication via passthrough
- Passive mode: No network ports needed, PCAP output via volume

---

## Install Instructions (Docker on Kali RPi 5)

### For Passive Sniffer Mode on RPi 5

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libfftw3-dev libmbedtls-dev libboost-program-options-dev \
    libconfig++-dev libsctp-dev libuhd-dev uhd-host \
    && rm -rf /var/lib/apt/lists/*

RUN uhd_images_downloader || true

# Build srsRAN_4G for passive sniffing
RUN git clone https://github.com/srsran/srsRAN_4G.git /opt/srsran && \
    cd /opt/srsran && mkdir build && cd build && \
    cmake ../ && make -j$(nproc) && make install

WORKDIR /opt/srsran/build
ENTRYPOINT ["./lib/examples/cell_search"]
```

```bash
# Build
docker build -t argos/srsran .

# Run cell search (passive - no transmission)
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/srsran -b 3  # Band 3

# Run PDSCH decoder (passive sniffing)
docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/output \
  argos/srsran pdsch_ue -f 1840e6
```

### For Active Base Station (x86 only)

```bash
# Requires Open5GS running (see open5gs.md)
# Build srsRAN_Project with Docker
docker run --rm --privileged \
  --net=host \
  --device=/dev/bus/usb \
  --ulimit rtprio=99 \
  argos/srsran-gnb \
  gnb -c /etc/srsran/gnb.yml
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**PARTIAL**

- **srsRAN_Project (5G)**: README explicitly states "optimized for x86 and ARM." Dockerfile includes `aarch64-linux-gnu` library paths. This is the best-supported option.
- **srsRAN_4G**: No explicit ARM64 support, but builds with standard CMake on ARM64.

### Hardware Constraints

- **Passive sniffer mode**: Cell search and basic decoding feasible on 4x Cortex-A76. Limited to narrow bandwidth.
- **Active base station mode**: NOT feasible on RPi 5 — requires sustained real-time processing.
- **RAM**: ~1-2GB depending on mode. Feasible on 8GB RPi.
- **SDR**: Requires USRP B210 or LimeSDR.

### Verdict

**PARTIAL COMPATIBILITY** - Passive sniffer mode (cell search, basic decoding) works on RPi 5 with srsRAN_Project. Active base station mode requires x86 hardware. For NTC deployment: run passive sniffing on RPi 5, active BTS on a field laptop.
