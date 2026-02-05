# FISSURE

> **NOTE:** FISSURE has ARM64 support that may be understated in this documentation. The default branch is `Python3` (not `main` or `master`).

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> This tool is part of a controlled military/defense training toolkit. FISSURE provides comprehensive offensive RF capabilities including 100+ attack scripts, signal jamming, protocol fuzzing, vulnerability exploitation, and replay attacks across the 24-6000 MHz frequency range. Used in government/military contexts for electronic warfare training, counter-UAS operations, and RF threat assessment. Strict access controls required. Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Python backend and headless sensor node run on ARM64; some GNU Radio OOT modules may need recompilation; installer targets x86_64

| Method               | Supported | Notes                                                                                                                                          |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | ~4-6 GB image; X11 forwarding needed for PyQt5 GUI; headless sensor node mode works fully; `--privileged --net=host` required                  |
| **Native Install**   | PARTIAL   | Must install from source; installer targets x86_64 Ubuntu/Kali and needs manual ARM64 adaptation; core Python/GNU Radio deps available via apt |

---

## Tool Description

FISSURE (Frequency Independent SDR-based Signal Understanding and Reverse Engineering) is an open-source RF and reverse engineering framework designed for both operational deployments and research/education. It provides a complete workflow for signal detection, classification, protocol discovery, attack execution, fuzzing, vulnerability analysis, and real-time integration with TAK (Team Awareness Kit). FISSURE centralizes over 100 attack scripts, SDR tools, GNU Radio flow graphs, IQ recording libraries, protocol dissectors, classifiers, and multi-stage attack capabilities into a unified dashboard. It supports HackRF, RTL-SDR, USRP, bladeRF, Airspy, LimeSDR, and other SDR hardware. The framework enables operators to detect, geolocate, and respond to RF activity in the field, while providing educators and researchers a shared environment for SDR experimentation. FISSURE supports desktop GUI mode, headless sensor nodes for remote/autonomous operations, and containerized deployment. It is the #1 priority integration for the Argos SDR frameworks category due to its comprehensive capability set and government/military provenance.

## Category

Comprehensive RF Framework / Signal Intelligence / Protocol Reverse Engineering / Electronic Warfare Training

## Repository

- **GitHub**: https://github.com/ainfosec/FISSURE
- **Language**: Python 3 (PyQt5 GUI, GNU Radio, Scapy, SciPy, Pandas)
- **License**: GPL-3.0
- **Stars**: ~1,870+

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** -- FISSURE's Python backend, CLI tools, headless sensor node, flow graph library, and attack script engine can be containerized. However, the primary GUI dashboard is a PyQt5 application that requires X11 forwarding or VNC for display output in a container. FISSURE's own roadmap includes Docker and Apptainer exploration for deployable components. The docker-compose.yml in the repository currently provisions a PostgreSQL database and pgAdmin for data management, not the full FISSURE application itself.

### Docker Requirements

- `--privileged` -- Required for USB passthrough to SDR hardware
- `--device=/dev/bus/usb` -- USB device access for HackRF, RTL-SDR, USRP, etc.
- `-e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix` -- X11 forwarding for PyQt5 GUI
- `--net=host` -- Recommended for TAK integration, ZMQ inter-process communication, and sensor node networking
- Host `udev` rules for SDR device permissions
- Volume mounts for IQ recordings, flow graphs, attack scripts, and database persistence
- Approximately 4-6 GB container image size due to GNU Radio, SDR libraries, and Python dependencies

### Dockerfile

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Install core system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-pyqt5 \
    python3-zmq \
    python3-numpy \
    python3-scipy \
    python3-matplotlib \
    python3-pandas \
    python3-scapy \
    gnuradio \
    gr-osmosdr \
    hackrf \
    libhackrf-dev \
    rtl-sdr \
    librtlsdr-dev \
    libsoapysdr-dev \
    soapysdr-module-all \
    uhd-host \
    libuhd-dev \
    cmake \
    build-essential \
    pkg-config \
    libfftw3-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone FISSURE
RUN cd /opt && \
    git clone https://github.com/ainfosec/FISSURE.git && \
    cd FISSURE && \
    pip3 install --no-cache-dir --break-system-packages -e .

WORKDIR /opt/FISSURE

# Expose ZMQ and TAK integration ports
EXPOSE 5555 5556 5557

ENTRYPOINT ["python3", "-m", "fissure.cli"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/fissure .

# Run with X11 forwarding for GUI mode
xhost +local:docker
docker run -it --rm \
  --name fissure \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd)/fissure-data/iq:/opt/FISSURE/IQ\ Recordings \
  -v $(pwd)/fissure-data/logs:/opt/FISSURE/Logs \
  argos/fissure

# Run in headless sensor node mode (no GUI)
docker run -d --rm \
  --name fissure-node \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  -v $(pwd)/fissure-data:/opt/FISSURE/IQ\ Recordings \
  argos/fissure server
```

---

## Install Instructions (Native)

```bash
# Clone the repository
cd /opt
git clone https://github.com/ainfosec/FISSURE.git
cd FISSURE

# Run the FISSURE installer (interactive, selects OS-appropriate packages)
# The installer handles GNU Radio, SDR drivers, Python dependencies, etc.
./install

# Alternative: install Python dependencies via poetry
pip3 install poetry
poetry install

# Verify installation
python3 -c "import fissure; print('FISSURE loaded')"

# Launch the GUI dashboard
fissure

# Launch headless server mode
server

# Launch individual components
hiprfisr       # HiPRFISR (main engine)
pd             # Protocol Discovery
tsi            # Target Signal Identification
dashboard      # Dashboard GUI
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :warning: Partial -- Python core and most dependencies support ARM64; some GNU Radio OOT modules and compiled flow graphs may need ARM64 recompilation                                            |
| Kali Repo Available   | :x: Not in Kali repos -- must install from source via GitHub; GNU Radio and SDR libraries are available via apt                                                                                   |
| Hardware Requirements | SDR hardware (HackRF, RTL-SDR, USRP, etc.) via USB; display for GUI mode; 4+ GB RAM recommended for full framework                                                                                |
| Performance on RPi5   | Moderate -- Python backend, signal classification, and protocol discovery run adequately; GNU Radio flow graphs with high sample rates may strain CPU; GUI responsiveness acceptable over X11/VNC |

### Verdict

**PARTIAL** -- FISSURE's Python backend, CLI tools, headless sensor node, attack script engine, and protocol discovery modules run on the Raspberry Pi 5 ARM64 architecture. GNU Radio and core SDR libraries (gr-osmosdr, libhackrf, librtlsdr, UHD) are available as ARM64 packages in Kali/Debian repositories. The PyQt5 GUI runs but requires a display server (X11, VNC, or HDMI). Primary limitations: (1) some precompiled GNU Radio OOT modules and flow graphs may need ARM64 recompilation, (2) high-bandwidth signal processing flow graphs (>5 Msps) may exceed RPi5 CPU capacity, (3) the full installer targets x86_64 Ubuntu/Kali and may require manual adaptation for ARM64. The recommended deployment on RPi5 is as a headless tactical sensor node with the full GUI dashboard running on a more powerful x86_64 workstation. Memory usage for the full framework is approximately 1.5-3 GB, which fits within the 8 GB available but leaves limited headroom for concurrent Argos services.
