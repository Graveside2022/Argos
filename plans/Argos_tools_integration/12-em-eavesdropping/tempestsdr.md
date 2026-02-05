# TempestSDR

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> This tool is part of a controlled military/defense training toolkit. TempestSDR enables eavesdropping on display screens via electromagnetic emanations (van Eck phreaking). Unauthorized use against systems you do not own or have explicit authorization to test is illegal under federal wiretapping and electronic surveillance laws. Use only in authorized training, research, and penetration testing environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — JNI native libraries require ARM64 recompilation; CPU-intensive real-time video reconstruction may struggle with high-res targets

| Method               | Supported | Notes                                                                                                                     |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | `debian:bookworm-slim` base with Java 17 + JNI; requires X11 forwarding for Swing GUI; USB passthrough for HackRF/RTL-SDR |
| **Native Install**   | PARTIAL   | Compiles on ARM64 after JNI library recompilation; pre-built binaries are x86_64 only; Java GUI needs X11 display         |

---

## Tool Description

TempestSDR is a software-defined radio (SDR) tool that reconstructs video from electromagnetic emanations leaked by monitors and display cables. Based on the van Eck phreaking technique, it captures unintentional RF emissions from video signals (HDMI, VGA, DVI cables and displays), processes them in real-time, and reconstructs a viewable image of what is displayed on the target screen. The tool performs signal acquisition via SDR hardware, applies digital signal processing to isolate the video signal, and renders the reconstructed frames in a Java-based GUI. It supports automatic and manual tuning of resolution, refresh rate, and frequency parameters.

## Category

Electromagnetic Eavesdropping / TEMPEST / Signal Intelligence (SIGINT)

## Repository

- **GitHub**: https://github.com/martinmarinov/TempestSDR (original) / https://github.com/eried/Research/tree/master/TempestSDR (maintained fork)
- **Language**: Java (GUI/DSP), C (JNI native libraries for SDR hardware access)
- **License**: GPL-3.0

---

> **WARNING: DOCUMENTATION ACCURACY** - Multiple documentation errors identified: plugin names, build system, and dependency list may not match the actual TempestSDR repository. Verify all build steps against the actual repo before attempting installation.

## Docker Compatibility

### Can it run in Docker?

PARTIAL

### Docker Requirements

- X11 forwarding or VNC for Java Swing GUI display
- USB passthrough for SDR hardware (HackRF One or RTL-SDR)
- Java Runtime Environment 8+ with JNI support
- GNU Radio libraries compiled for container architecture
- Host audio/video subsystem access for real-time rendering
- `--privileged` flag or specific device passthrough for USB SDR

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install Java, build tools, and SDR dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    openjdk-17-jre \
    build-essential \
    cmake \
    git \
    libusb-1.0-0-dev \
    libhackrf-dev \
    librtlsdr-dev \
    libfftw3-dev \
    pkg-config \
    ant \
    maven \
    && rm -rf /var/lib/apt/lists/*

# Clone TempestSDR
RUN git clone https://github.com/martinmarinov/TempestSDR.git /opt/tempestsdr

WORKDIR /opt/tempestsdr

# Build native JNI libraries
RUN cd JavaGUI && \
    mkdir -p libs && \
    cd ../TSDRPlugin_RawFile && make && \
    cd ../TSDRPlugin_UsbRawFile && make && \
    cd ../TSDRPlugin_HackRF && make && \
    cd ../TSDRPlugin_ExtIO && make || true

# Build Java GUI
RUN cd JavaGUI && ant build || true

# Set library path
ENV LD_LIBRARY_PATH=/opt/tempestsdr/JavaGUI/libs:$LD_LIBRARY_PATH

WORKDIR /opt/tempestsdr/JavaGUI

CMD ["java", "-jar", "JTempestSDR.jar"]
```

### Docker Run Command

```bash
# Run with X11 forwarding and HackRF USB passthrough
docker run -it --rm \
    --privileged \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v /dev/bus/usb:/dev/bus/usb \
    --device /dev/bus/usb \
    --name tempestsdr \
    tempestsdr:latest

# Alternative: with specific HackRF device passthrough
docker run -it --rm \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    --device /dev/bus/usb/001/004 \
    --name tempestsdr \
    tempestsdr:latest
```

---

## Install Instructions (Native)

```bash
# Install dependencies on Kali Linux
sudo apt-get update
sudo apt-get install -y \
    openjdk-17-jdk \
    openjdk-17-jre \
    build-essential \
    cmake \
    git \
    libusb-1.0-0-dev \
    libhackrf-dev \
    librtlsdr-dev \
    libfftw3-dev \
    pkg-config \
    ant

# Clone repository
git clone https://github.com/martinmarinov/TempestSDR.git
cd TempestSDR

# Build native JNI libraries for each SDR plugin
cd TSDRPlugin_RawFile && make && cd ..
cd TSDRPlugin_UsbRawFile && make && cd ..
cd TSDRPlugin_HackRF && make && cd ..
cd TSDRPlugin_ExtIO && make || cd ..

# Build Java GUI application
cd JavaGUI
ant build

# Run TempestSDR
java -jar JTempestSDR.jar
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ARM64 Support         | :warning: Requires recompilation of JNI native libraries for aarch64                                                                             |
| Kali Repo Available   | :x: Not in Kali repositories, must be built from source                                                                                          |
| Hardware Requirements | HackRF One or RTL-SDR dongle + directional antenna, display target within range                                                                  |
| Performance on RPi5   | :warning: CPU-intensive real-time video reconstruction; 4x Cortex-A76 may handle low-res targets but will struggle with high-resolution displays |

### Additional Notes

- **SDR Hardware**: Requires HackRF One (recommended for bandwidth) or RTL-SDR with directional antenna pointed at target display/cable
- **Antenna**: Directional antenna significantly improves reception quality and range
- **Target Frequencies**: HDMI signals typically leak in 100 MHz - 1 GHz range depending on resolution and cable shielding
- **Real-time DSP**: Video reconstruction requires continuous FFT processing which is CPU-bound; RPi5's Cortex-A76 cores provide reasonable but not optimal performance
- **Java/JNI**: The JNI native libraries must be cross-compiled or natively compiled on aarch64; pre-built binaries are x86_64 only
- **Display**: Requires X11 display server for the Java Swing GUI; can use VNC for remote operation

### Verdict

**PARTIAL** -- TempestSDR can be compiled and run on RPi5 aarch64 with effort, but real-time video reconstruction from EM emanations is computationally demanding. Low-resolution targets (VGA, older HDMI) may work acceptably, but high-resolution modern displays will likely produce poor frame rates. The JNI native libraries require manual recompilation for ARM64. Best used as a demonstration/training tool on RPi5 rather than for operational use.
