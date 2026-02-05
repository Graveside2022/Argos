# Inspectrum

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. Inspectrum is a passive offline signal analysis tool with no transmission, replay, or real-time capture capabilities. It only visualizes and measures pre-recorded IQ signal files for analysis and demodulation purposes. Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pre-built ARM64 package in Kali/Debian apt repos; C++/FFTW3 performs well on Cortex-A76

| Method               | Supported | Notes                                                                                                         |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Qt5 GUI requires X11 forwarding or VNC; no hardware or privileges needed (offline file analysis only)         |
| **Native Install**   | YES       | `apt-get install inspectrum`; pre-built ARM64 binary available; also builds from source with cmake on aarch64 |

---

## Tool Description

Inspectrum is an offline RF signal analysis tool for visualizing and decoding recorded IQ signal files from software-defined radio receivers. It provides a high-performance spectrogram display with smooth zoom and pan, supporting files over 100 GB in size through memory-mapped file access. Key features include amplitude, frequency, phase, and IQ sample plots; drag-to-measure cursors for determining period, symbol rate, and symbol extraction; export of selected time periods, filtered samples, and demodulated data; and support for a wide range of IQ file formats including SigMF, complex float32/64, signed/unsigned 8/16/32-bit integer formats from GNU Radio, HackRF, RTL-SDR, BladeRF, SDRAngel, and MATLAB. Inspectrum uses the liquid-dsp library for signal processing and FFTW for FFT computation. It is designed for post-capture signal analysis, making it an essential companion tool for investigating signals recorded by Argos spectrum monitoring sessions.

## Category

Offline RF Signal Analysis / IQ File Visualization / Signal Demodulation

## Repository

- **GitHub**: https://github.com/miek/inspectrum
- **Language**: C++ (Qt5, FFTW3, liquid-dsp)
- **License**: GPL-3.0
- **Stars**: ~600+

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** -- Inspectrum is a C++/Qt5 GUI application that requires a display server for its spectrogram visualization. In Docker, it needs X11 forwarding or VNC for graphical output. The application has no CLI mode or headless operation -- the spectrogram GUI is its sole interface. However, it containerizes cleanly with X11 socket passthrough and runs well as a containerized analysis workstation.

### Docker Requirements

- `-e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix` -- X11 forwarding for Qt5 GUI (required)
- No `--privileged` or `--device` required -- inspectrum works with pre-recorded files only, no hardware access needed
- Volume mount for IQ recording files: `-v /host/recordings:/recordings`
- No `--net=host` required
- No kernel modules or udev rules required
- Approximately 200-400 MB container image size

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install inspectrum and dependencies from apt
RUN apt-get update && apt-get install -y \
    inspectrum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /recordings

ENTRYPOINT ["inspectrum"]
CMD []
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/inspectrum .

# Run with X11 forwarding to display spectrogram on host
xhost +local:docker
docker run -it --rm \
  --name inspectrum \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd)/recordings:/recordings \
  argos/inspectrum

# Open a specific IQ recording file
docker run -it --rm \
  --name inspectrum \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd)/recordings:/recordings \
  argos/inspectrum /recordings/capture.cf32

# Build from source if apt package is unavailable
# docker build -f Dockerfile.source -t argos/inspectrum .
```

---

## Install Instructions (Native)

```bash
# Option A: Install from Kali/Debian package repositories (recommended)
sudo apt-get update
sudo apt-get install -y inspectrum

# Verify installation
which inspectrum
inspectrum --help

# Option B: Build from source (latest version)
sudo apt-get install -y \
    cmake \
    build-essential \
    pkg-config \
    qt5-qmake \
    qtbase5-dev \
    libfftw3-dev \
    libliquid-dev \
    git

git clone https://github.com/miek/inspectrum.git
cd inspectrum
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install

# Launch inspectrum
inspectrum

# Open a specific file
inspectrum /path/to/recording.cf32

# Supported file formats:
#   *.sigmf-meta / *.sigmf-data  - SigMF recordings
#   *.cf32 / *.fc32 / *.cfile    - Complex float32 (GNU Radio)
#   *.cf64 / *.fc64              - Complex float64
#   *.cs16 / *.sc16 / *.c16     - Complex signed 16-bit (BladeRF)
#   *.cs8 / *.sc8 / *.c8        - Complex signed 8-bit (HackRF)
#   *.cu8 / *.uc8               - Complex unsigned 8-bit (RTL-SDR)
#   *.f32, *.f64, *.s16, *.s8, *.u8  - Real sample formats
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full -- available as pre-built ARM64 package via apt; builds from source on ARM64 without issues                                       |
| Kali Repo Available   | :white_check_mark: Available via Debian/Kali apt repositories                                                                                             |
| Hardware Requirements | No SDR hardware required -- works with pre-recorded IQ files only; display required for GUI                                                               |
| Performance on RPi5   | Good -- C++ with FFTW3 provides efficient FFT computation on Cortex-A76; large files (>1 GB) handled via memory-mapped access without excessive RAM usage |

### Verdict

**COMPATIBLE** -- Inspectrum runs on the Raspberry Pi 5 with full functionality. It is available as a pre-built ARM64 package in the Kali/Debian apt repositories, making installation trivial (`apt-get install inspectrum`). As a compiled C++ application using FFTW3 for FFT and Qt5 for rendering, it performs well on the RPi5 Cortex-A76 cores. Memory usage is efficient due to memory-mapped file access, allowing analysis of very large IQ recordings without loading entire files into RAM. The 8 GB available RAM is more than sufficient. No SDR hardware is required since inspectrum operates exclusively on pre-recorded files. The Qt5 GUI requires a display server -- use HDMI output, VNC, or X11 forwarding over SSH (`ssh -X`). Inspectrum is an essential post-capture analysis companion for investigating signals recorded during Argos HackRF spectrum monitoring sessions, enabling detailed measurement of symbol rates, protocol timing, and signal characteristics.
