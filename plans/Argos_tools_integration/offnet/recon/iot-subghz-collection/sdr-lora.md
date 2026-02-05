# SDR-LoRa (LoRa-SDR)

> **NOTE:** May require SoapySDR and Pothos framework as additional dependencies for full functionality on ARM64.

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Capable of LoRa signal generation, jamming, and spoofing using commodity SDR hardware. Enables downlink injection and denial-of-service against LoRaWAN infrastructure. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — GNU Radio blocks compile from source on ARM64; CPU-intensive at higher spreading factors

| Method               | Supported | Notes                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| **Docker Container** | YES       | GNU Radio + SDR hardware passthrough; long build time (10-20 min)             |
| **Native Install**   | YES       | GNU Radio available in Kali ARM64 repos; LoRa-SDR module compiles from source |

---

## Tool Description

SDR-LoRa (LoRa-SDR) is a software-defined implementation of the LoRa physical layer (PHY) that runs on general-purpose SDR hardware such as LimeSDR and HackRF. Unlike dedicated LoRa transceiver chips, this implementation provides full control over LoRa chirp spread spectrum modulation parameters, enabling signal generation, reception, analysis, jamming, and spoofing at the physical layer. It operates as GNU Radio blocks that can be integrated into custom signal processing flowgraphs.

## Category

LoRa PHY-Layer SDR Implementation / RF Signal Manipulation

## Repository

https://github.com/myriadrf/LoRa-SDR

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - SDR-LoRa runs in Docker with SDR hardware passthrough. Requires GNU Radio and associated SDR driver libraries. The GNU Radio blocks compile from source within the container.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for SDR hardware (HackRF, LimeSDR)
- `--privileged` - Required for raw USB device access to SDR hardware
- No special kernel modules beyond standard USB drivers
- Host must have `udev` rules configured for SDR device permissions
- If using LimeSDR: `limesuite` udev rules on host

### Docker-to-Host Communication

- No inbound port mappings required for RF operations
- Volume mount for flowgraphs and captured data: `-v /host/data:/app/data`
- If using GNU Radio Companion (GRC) GUI: X11 forwarding required (`-e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix`)
- Output IQ files can be shared via volume mount for offline analysis

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    gnuradio \
    gnuradio-dev \
    gr-osmosdr \
    libhackrf-dev \
    hackrf \
    libboost-all-dev \
    cmake \
    build-essential \
    git \
    swig \
    python3-numpy \
    python3-scipy \
    libspdlog-dev \
    pybind11-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/myriadrf/LoRa-SDR.git /opt/lora-sdr

WORKDIR /opt/lora-sdr
RUN mkdir build && cd build && \
    cmake .. \
      -DCMAKE_INSTALL_PREFIX=/usr \
      -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc) && \
    make install && \
    ldconfig

WORKDIR /app/data

ENTRYPOINT ["/bin/bash"]
```

```bash
# Build (note: compilation takes 10-20 minutes on RPi 5)
docker build -t argos/sdr-lora .

# Run - interactive shell for GNU Radio block usage
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/lora-data:/app/data \
  argos/sdr-lora

# Run - with GUI support (GNU Radio Companion)
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd)/lora-data:/app/data \
  argos/sdr-lora gnuradio-companion

# Run - execute a LoRa receiver flowgraph
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/lora-data:/app/data \
  argos/sdr-lora python3 /app/data/lora_receiver.py

# Run - capture LoRa signals to file for offline analysis
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/lora-data:/app/data \
  argos/sdr-lora python3 -c "
from gnuradio import gr, blocks
import osmosdr
# Custom flowgraph for LoRa capture
# Adjust frequency and sample rate for target LoRa deployment
"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - GNU Radio is available in Kali ARM64 repositories. The LoRa-SDR GNU Radio out-of-tree module compiles from source on aarch64 using cmake. Boost, SWIG, and pybind11 dependencies all have ARM64 support. Compilation from source is required as no pre-built ARM64 packages exist for this specific module.

### Hardware Constraints

- CPU: **CPU-INTENSIVE** - Software-defined LoRa modulation/demodulation performs chirp spread spectrum DSP in software. Real-time LoRa processing at higher spreading factors (SF10-SF12) may strain the Cortex-A76 cores. Lower spreading factors (SF7-SF9) are more manageable. Multi-core utilization depends on the GNU Radio flowgraph scheduler
- RAM: GNU Radio with SDR-LoRa blocks uses approximately 300-500MB. Well within 8GB but notable compared to hardware LoRa transceivers
- SDR Hardware: Requires HackRF One (installed on Argos) or LimeSDR. HackRF operates half-duplex only (cannot simultaneously transmit and receive). LimeSDR supports full-duplex operation
- Storage: IQ capture files can be very large (hundreds of MB per minute at typical sample rates). Plan storage accordingly for extended captures

### Verdict

**COMPATIBLE** - SDR-LoRa compiles and runs on Raspberry Pi 5 but is CPU-intensive compared to hardware LoRa transceivers. Real-time processing may require limiting spreading factor or sample rate to stay within the CPU budget of the Cortex-A76 cores. The HackRF already installed on Argos provides the necessary SDR hardware. Docker build time is significant (10-20 minutes) due to GNU Radio compilation overhead. Best suited for targeted LoRa analysis rather than continuous monitoring.
