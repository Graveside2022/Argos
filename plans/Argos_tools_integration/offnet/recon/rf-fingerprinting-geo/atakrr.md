# ATAKRR (ATAK Radio Reconnaissance)

> **WARNING: EARLY-STAGE PROJECT** - The repository (github.com/ATAKRR/atakrr) contains early-stage source code (`src/atakrr.py`, `src/sig_spawn.py`), design diagrams, and a README. There is no `requirements.txt`, `setup.py`, or `main.py` entry point. Install instructions below are SPECULATIVE and may not produce a working system without additional development.

> **RISK CLASSIFICATION**: MODERATE RISK - PASSIVE RECON WITH ACTIVE INTELLIGENCE
> AI/ML-powered RF device fingerprinting, automatic modulation classification, and transmitter triangulation with CoT output. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — HackRF + data pipeline work natively; ML inference is CPU-constrained on Cortex-A76

| Method               | Supported | Notes                                                                            |
| -------------------- | --------- | -------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Requires `--privileged` for HackRF USB; ML models may exceed RPi 5 CPU budget    |
| **Native Install**   | PARTIAL   | TFLite quantized models recommended; full PyTorch inference too slow without GPU |

---

## Tool Description

ATAKRR (ATAK Radio Reconnaissance) is an AI/ML-powered RF reconnaissance system that provides automatic modulation classification (AMC), RF device fingerprinting, and transmitter triangulation/trilateration across the 1-6 GHz spectrum using HackRF One or similar SDR hardware. It employs deep learning models (CNN, RNN, and Transformer architectures) to classify RF emissions by modulation type and uniquely fingerprint individual transmitting devices. Detected transmitter locations are output as Cursor-on-Target (CoT) messages for display on ATAK tactical maps with heatmap overlays. Designed for fog computing deployment with distributed HackRF sensors feeding a central processing node.

Documentation: https://jackd.ethertech.org/atakrr/

## Category

RF Fingerprinting / AI-ML Signal Classification / Transmitter Geolocation / TAK Integration

## Repository

https://github.com/ATAKRR/atakrr

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Python application with ML dependencies that can be containerized. Requires USB passthrough for HackRF One access.

### Host OS-Level Requirements

- `--privileged` or `--device=/dev/bus/usb` for HackRF USB passthrough
- No `--net=host` required unless using TAK multicast
- Host must have HackRF udev rules installed for non-root USB access
- No additional kernel modules beyond standard USB (already present on Kali)

### Docker-to-Host Communication

- **HackRF USB**: HackRF One appears as a USB device on the host. Must be passed to the container via `--device` flag. Only one container can access a given HackRF at a time.
- **TAK Output**: CoT messages sent to TAK Server via TCP/UDP or to ATAK multicast.
- **Model Storage**: ML model files can be large (hundreds of MB). Mount a volume for persistent model storage to avoid re-downloading on container restart.
- **Multi-Sensor**: In distributed deployment, multiple containers on different hosts each access a local HackRF and report to a central fog computing node.

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install HackRF udev rules (if not already present)
sudo apt-get install -y hackrf libhackrf-dev

# Verify HackRF is detected
hackrf_info
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    pkg-config \
    libhackrf-dev \
    libusb-1.0-0-dev \
    libfftw3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/ATAKRR/atakrr.git /opt/atakrr

WORKDIR /opt/atakrr

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir \
    numpy \
    scipy \
    scikit-learn \
    tensorflow-lite-runtime \
    torch \
    pytak \
    hackrf

# NOTE: No main.py exists; actual source is src/atakrr.py (may require adaptation)
ENTRYPOINT ["python", "src/atakrr.py"]
```

### Build and Run

```bash
# Build
docker build -t argos/atakrr .

# Run with HackRF and TAK Server
docker run -d --rm \
  --name atakrr \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/models:/opt/atakrr/models \
  -e COT_URL="tcp://tak-server:8087" \
  -e FREQ_START="2400000000" \
  -e FREQ_END="2500000000" \
  argos/atakrr

# Run with specific HackRF device (non-privileged)
docker run -d --rm \
  --name atakrr \
  --device=/dev/bus/usb/001/004 \
  -v $(pwd)/models:/opt/atakrr/models \
  -e COT_URL="tcp://tak-server:8087" \
  argos/atakrr

# Run in classification-only mode (no TAK output)
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/models:/opt/atakrr/models \
  argos/atakrr --classify-only
```

### Fog Computing Architecture (Multi-Sensor)

```
RPi 5 Node A (HackRF #1)          RPi 5 Node B (HackRF #2)
  [ATAKRR Sensor Container]         [ATAKRR Sensor Container]
           |                                  |
           +-------------- LAN --------------+
                           |
                   [ATAKRR Mothership]
                   (Central Processing)
                           |
                    CoT Output to TAK
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 PARTIAL** - The Python application and HackRF interface run natively on aarch64. However, the ML inference workload (CNN, RNN, Transformer models) is computationally intensive. TensorFlow Lite provides optimized ARM64 inference, but full PyTorch models may be slow without GPU acceleration. Consider using pre-trained TFLite models rather than full PyTorch inference on RPi 5.

### Hardware Constraints

- **CPU**: HIGH - ML inference (classification, fingerprinting) is CPU-intensive on the Cortex-A76. Real-time classification of wideband spectrum data will consume significant CPU. All 4 cores may be utilized during active scanning.
- **RAM**: 2-4 GB recommended for ML model loading and spectrum data buffering. The 8 GB RPi 5 can handle this, but other memory-intensive services should be monitored.
- **Hardware**: Requires HackRF One (USB) for spectrum capture. One HackRF per sensor node.
- **Thermal**: Sustained ML inference will generate heat. Ensure adequate cooling (heatsink, fan) on the RPi 5 during extended operation.
- **Storage**: ML model files can be 100-500 MB. Ensure sufficient SD card or USB storage.

### Performance Optimization for RPi 5

1. Use TensorFlow Lite quantized models instead of full PyTorch models
2. Reduce spectrum bandwidth to focus on frequencies of interest
3. Increase classification interval (e.g., classify every 5 seconds instead of continuously)
4. Offload heavy ML inference to a more powerful fog computing node if available

### Verdict

**PARTIAL** - ATAKRR runs on Raspberry Pi 5 but with performance constraints on the ML inference pipeline. The HackRF integration, data collection, and CoT output work natively. For field deployment, use lightweight TFLite models or deploy the RPi 5 as a sensor node feeding data to a more powerful central processing node. This is the #2 priority tool for Argos integration due to its unique RF fingerprinting and triangulation capabilities.
