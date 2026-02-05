# QSpectrumAnalyzer

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. QSpectrumAnalyzer is a passive receive-only spectrum analysis tool with no transmission or attack capabilities. It visualizes RF spectrum data from SDR hardware backends for monitoring and situational awareness purposes only. Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Lightweight Python/PyQt5 app; all dependencies available as ARM64 packages; hackrf_sweep backend offloads to hardware

| Method               | Supported | Notes                                                                                                           |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Qt GUI requires X11 forwarding or VNC; SDR backends need USB passthrough (`--privileged --device=/dev/bus/usb`) |
| **Native Install**   | YES       | `pip3 install qspectrumanalyzer`; PyQt5 and SDR libraries available as ARM64 packages in Kali 2025.4            |

---

## Tool Description

QSpectrumAnalyzer is a real-time spectrum analyzer GUI for multiple SDR platforms. It provides a PyQtGraph-based interface for visualizing RF spectrum data from various backends including soapy_power (default, supports nearly all SDR hardware via SoapySDR), hackrf_sweep (wideband sweeps at 8 GHz/sec using HackRF), rtl_power and rtl_power_fftw (RTL-SDR devices), and rx_power (SoapySDR-based). The application displays live spectrum plots with adjustable frequency range, gain, sample rate, and bin size, along with a scrolling waterfall display with configurable history depth and color mapping. It supports peak hold, average traces, min/max overlay, adjustable crop percentage for edge artifact removal, and PPM correction. QSpectrumAnalyzer complements the Argos built-in HackRF spectrum analyzer by providing an alternative visualization frontend with different display options and multi-backend support.

## Category

Real-Time Spectrum Analysis / RF Monitoring / Signal Visualization

## Repository

- **GitHub**: https://github.com/xmikos/qspectrumanalyzer
- **Language**: Python 3 (PyQt5/PyQt4/PySide2, PyQtGraph)
- **License**: GPL-3.0+
- **Stars**: ~550+

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** -- QSpectrumAnalyzer is a Qt-based GUI application that requires a display server. In Docker, it needs X11 forwarding or a VNC server for graphical output. The underlying Python logic and backend communication work in a container, but the primary value is the interactive spectrum display which requires display access. SDR hardware backends (hackrf_sweep, soapy_power) must also be available inside the container.

### Docker Requirements

- `--privileged` -- Required for USB passthrough to SDR hardware
- `--device=/dev/bus/usb` -- USB device access for HackRF, RTL-SDR, or other SDR hardware
- `-e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix` -- X11 forwarding for Qt GUI
- Host must run X11 display server (Xorg) or Wayland with XWayland
- Host `udev` rules for SDR device permissions
- Volume mount for saving screenshots or configuration

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for Qt, SDR backends, and display
RUN apt-get update && apt-get install -y \
    python3-pyqt5 \
    python3-numpy \
    python3-scipy \
    hackrf \
    libhackrf-dev \
    rtl-sdr \
    librtlsdr-dev \
    libsoapysdr-dev \
    soapysdr-module-all \
    soapysdr-tools \
    libfftw3-dev \
    pkg-config \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install soapy_power (default backend) and qspectrumanalyzer
RUN pip3 install --no-cache-dir --break-system-packages \
    soapy_power \
    pyqtgraph \
    Qt.py \
    qspectrumanalyzer

WORKDIR /app

ENTRYPOINT ["qspectrumanalyzer"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/qspectrumanalyzer .

# Run with X11 forwarding for GUI display
xhost +local:docker
docker run -it --rm \
  --name qspectrumanalyzer \
  --privileged \
  --device=/dev/bus/usb \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  argos/qspectrumanalyzer

# Run with VNC for remote/headless access
docker run -d --rm \
  --name qspectrumanalyzer-vnc \
  --privileged \
  --device=/dev/bus/usb \
  -p 5900:5900 \
  argos/qspectrumanalyzer \
  bash -c "apt-get update && apt-get install -y x11vnc xvfb && \
           Xvfb :1 -screen 0 1280x720x24 & \
           x11vnc -display :1 -forever -nopw & \
           DISPLAY=:1 qspectrumanalyzer"
```

---

## Install Instructions (Native)

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y \
    python3-pip \
    python3-pyqt5 \
    python3-numpy \
    python3-scipy \
    hackrf \
    libhackrf-dev \
    rtl-sdr \
    librtlsdr-dev \
    libsoapysdr-dev \
    soapysdr-module-all \
    soapysdr-tools

# Install soapy_power backend (default, recommended)
pip3 install --break-system-packages soapy_power

# Install QSpectrumAnalyzer
pip3 install --break-system-packages qspectrumanalyzer

# Alternative: install from Git source
git clone https://github.com/xmikos/qspectrumanalyzer.git
cd qspectrumanalyzer
pip3 install --break-system-packages .

# Verify SDR hardware is detected
SoapySDRUtil --find
hackrf_info

# Launch the application
qspectrumanalyzer

# Configure backend in File -> Settings:
#   - soapy_power (default, multi-SDR support)
#   - hackrf_sweep (HackRF only, fastest sweep rate)
#   - rtl_power_fftw (RTL-SDR, better FFT performance)
#   - rtl_power (RTL-SDR, legacy)
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full -- Python/PyQt5 application, all dependencies available for ARM64                                                                           |
| Kali Repo Available   | :x: Not in Kali repos directly -- install via pip; PyQt5 and SDR libraries available via apt                                                                        |
| Hardware Requirements | SDR hardware (HackRF, RTL-SDR, Airspy, LimeSDR, etc.) via USB; display for GUI                                                                                      |
| Performance on RPi5   | Good -- lightweight Python/Qt application; spectrum rendering and waterfall updates run smoothly; hackrf_sweep backend offloads sweep processing to HackRF hardware |

### Verdict

**COMPATIBLE** -- QSpectrumAnalyzer runs on the Raspberry Pi 5 with full functionality. It is a lightweight Python/PyQt5 application with minimal CPU and memory requirements (approximately 100-250 MB RAM). All Python dependencies (PyQtGraph, NumPy, SciPy, Qt.py) and SDR backend libraries (libhackrf, librtlsdr, SoapySDR) are available as ARM64 packages in Kali/Debian repositories. The hackrf_sweep backend is particularly well-suited for RPi5 deployment as sweep processing is handled by HackRF hardware, minimizing host CPU load. The Qt GUI requires a display server -- use HDMI output, VNC, or X11 forwarding over SSH. Waterfall display history should be kept reasonable (100-200 lines) to manage memory consumption on the RPi5. QSpectrumAnalyzer provides a useful alternative spectrum visualization frontend that complements the Argos built-in HackRF spectrum module.
