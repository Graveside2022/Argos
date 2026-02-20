# Universal Radio Hacker

> **RISK CLASSIFICATION**: MODERATE RISK
> Wireless protocol investigation tool with both receive and transmit capabilities; can demodulate, analyze, and replay captured RF signals. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python app with ARM64 C extensions; Qt GUI requires display (X11/VNC)

| Method               | Supported | Notes                                                                                        |
| -------------------- | --------- | -------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Requires X11 forwarding or VNC for GUI; CLI/headless signal processing works fully in Docker |
| **Native Install**   | YES       | Already installed on Argos system; `pip3 install urh` with ARM64 wheels; PyQt5 in Kali repos |

---

## Tool Description

Universal Radio Hacker (URH) is a comprehensive wireless protocol investigation tool that provides a complete workflow for analyzing unknown RF protocols. It supports signal recording, demodulation (ASK, FSK, PSK, GFSK), automatic protocol detection, bitstream analysis, protocol reverse engineering, fuzzing, and signal replay/transmission. URH includes a graphical interface for interactive signal analysis with drag-to-select, zoom, and measurement tools. It supports HackRF, RTL-SDR, USRP, Airspy, and other SDR hardware through native drivers and SoapySDR. URH is installed on the Argos system and serves as the primary tool for investigating and reverse-engineering unknown wireless protocols encountered during RF monitoring.

## Category

Wireless Protocol Analysis / RF Reverse Engineering / Signal Investigation

## Repository

https://github.com/jopohl/urh

---

## Docker Compatibility Analysis

### Can it run in Docker?

**PARTIAL** - URH is a Qt-based GUI application that requires a display server. In Docker, it needs X11 forwarding or a VNC server for graphical output. The underlying signal processing and CLI operations can run headlessly, but the primary value of URH is its interactive graphical analysis interface. For full functionality, X11 socket passthrough or a container-based VNC session is required.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for SDR hardware (HackRF, RTL-SDR, USRP)
- `--privileged` - Required for USB device access
- `-e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix` - X11 forwarding for GUI display
- No `--net=host` strictly required, but simplifies X11 forwarding
- Host must run an X11 display server (Xorg) or Wayland with XWayland
- Host kernel module `dvb_usb_rtl28xxu` should be blacklisted if using RTL-SDR
- Host `udev` rules for SDR device permissions

### Docker-to-Host Communication

- X11 socket forwarding via volume mount (`/tmp/.X11-unix`) for GUI display on host screen
- Alternative: VNC server inside container with port mapping `-p 5900:5900` for remote GUI access
- Volume mount for signal recordings: `-v /host/signals:/signals`
- USB device passthrough for SDR hardware
- CLI mode can pipe data to stdout for integration with other tools

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - Already Installed)

```bash
# URH is already installed on the Argos system.
# Verify installation:
which urh || pip3 show urh

# Launch with GUI:
urh

# Install/update via pip if needed:
pip3 install --upgrade urh
```

### Option B: Docker with X11 Forwarding

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-pyqt5 \
    python3-numpy \
    python3-psutil \
    rtl-sdr \
    librtlsdr-dev \
    hackrf \
    libhackrf-dev \
    libsoapysdr-dev \
    soapysdr-module-all \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages urh

WORKDIR /signals

ENTRYPOINT ["urh"]
```

```bash
# Build the Docker image
docker build -t argos/urh .

# Run with X11 forwarding (requires X11 display on host)
xhost +local:docker
docker run -it --rm \
  --name urh \
  --privileged \
  --device=/dev/bus/usb \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd)/signals:/signals \
  argos/urh

# Run with VNC for remote access (no local display required)
docker run -d --rm \
  --name urh-vnc \
  --privileged \
  --device=/dev/bus/usb \
  -p 5900:5900 \
  -v $(pwd)/signals:/signals \
  argos/urh \
  bash -c "apt-get update && apt-get install -y x11vnc xvfb && \
           Xvfb :1 -screen 0 1280x720x24 & \
           x11vnc -display :1 -forever -nopw & \
           DISPLAY=:1 urh"
```

### Option C: CLI/Headless Operation

```bash
# URH supports command-line signal processing without GUI:

# Record signal via HackRF:
docker run -it --rm \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/signals:/signals \
  argos/urh \
  urh_cli -i hackrf -f 433920000 -s 2000000 -o /signals/capture.complex

# Analyze recorded signal:
docker run -it --rm \
  -v $(pwd)/signals:/signals \
  argos/urh \
  urh_cli -a /signals/capture.complex --demod ASK
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - URH is a Python application with compiled C extensions for performance-critical DSP operations. The Python package installs via pip with ARM64 wheel builds for NumPy and compiled extensions. PyQt5 is available as an ARM64 package in the Kali/Debian repositories. Some C extensions may require compilation from source during pip install, which succeeds on the RPi5 with standard build tools (gcc, python3-dev).

### Hardware Constraints

- **CPU**: Signal processing (demodulation, correlation, FFT) is moderately CPU-intensive. Interactive analysis of recorded signals runs smoothly on the Cortex-A76 cores. Real-time capture and demodulation of high-bandwidth signals may consume 30-50% CPU. Fuzzing operations can be CPU-intensive during automated protocol testing.
- **RAM**: Approximately 300-600MB runtime memory depending on the size of loaded signal files. Large recordings (100+ MB) increase memory consumption proportionally as signals are loaded into memory for interactive analysis. The 8GB available is adequate for typical analysis sessions.
- **Storage**: Application and dependencies require approximately 500MB. Signal recording files can be large (1-100+ MB per capture depending on duration and sample rate). Adequate storage planning required for capture libraries.
- **Hardware**: Requires SDR hardware for live signal capture (HackRF, RTL-SDR, USRP). Can analyze pre-recorded signal files without SDR hardware. GUI requires a display connection (HDMI, VNC, or X11 forwarding).
- **Display**: Qt-based GUI requires display output. On a headless RPi5, use VNC or X11 forwarding over SSH (`ssh -X`). GUI performance over VNC is adequate for signal analysis but may lag during rapid waterfall scrolling.

### Verdict

**COMPATIBLE** - Universal Radio Hacker runs on the Raspberry Pi 5 with ARM64 support. It is already installed on the Argos system. The primary limitation is the GUI requirement, which needs either a local display, VNC, or X11 forwarding. For Docker deployment, X11 socket passthrough is the most performant option when a local display is available. The RPi5 provides adequate CPU and memory for interactive protocol analysis. URH is the primary tool for investigating unknown RF protocols discovered during Argos spectrum monitoring.
