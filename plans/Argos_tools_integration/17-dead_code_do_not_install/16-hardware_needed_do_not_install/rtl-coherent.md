# rtl_coherent

## DO NOT INSTALL -- Required hardware not available

> **NOTE:** The binary produced by `make` is named `main` (not `rtl_coherent`). DOA processing scripts are `music_df.py` and `inter_df.py`. The project also includes `run.sh` for launching the full pipeline.

> **RISK CLASSIFICATION**: LOW RISK
> Experimental passive direction-of-arrival receiver using multiple RTL-SDR dongles with no transmit capability; receives and correlates IQ samples only. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — C source compiles natively on ARM64; Python DOA scripts use standard NumPy/SciPy

| Method               | Supported | Notes                                                                                                          |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | USB passthrough (`--privileged --device=/dev/bus/usb`) for multiple RTL-SDR dongles; debian:bookworm-slim base |
| **Native Install**   | YES       | Builds with gcc on aarch64; librtlsdr and Python scientific stack available in Kali repos                      |

---

## Tool Description

rtl_coherent is an experimental research project that enables coherent reception using multiple inexpensive RTL-SDR dongles for direction of arrival (DOA) estimation. Unlike the KrakenSDR which uses a purpose-built 5-channel coherent receiver with a shared clock, rtl_coherent achieves coherence between independent RTL-SDR dongles through software-based clock synchronization techniques, exploiting a common reference signal to align phase across receivers. This dramatically lowers the cost of entry for DOA experiments, as standard RTL-SDR dongles cost approximately $10-25 each compared to the $150 KrakenSDR. The project provides C-based low-level SDR control and Python scripts for DOA processing and visualization.

## Category

Experimental RF Direction Finding / Low-Cost Coherent SDR Array / Research Grade DOA

## Repository

https://github.com/tejeez/rtl_coherent

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - rtl_coherent runs in Docker with USB passthrough for multiple RTL-SDR dongles. The application consists of C executables for coherent sample capture and Python scripts for DOA processing. Both are standard userspace programs with no kernel-level dependencies beyond USB device access. Each RTL-SDR dongle must be accessible from within the container.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for all RTL-SDR dongles (typically 3-5 dongles for a DOA array)
- `--privileged` - Required for raw USB access to multiple RTL-SDR devices simultaneously
- No `--net=host` required (processing is local, results can be exposed via port mapping)
- Host kernel module `dvb_usb_rtl28xxu` must be **blacklisted** to prevent the kernel from claiming the RTL-SDR tuners
- Each RTL-SDR dongle should have a unique serial number programmed (using `rtl_eeprom -s <serial>`) to allow the software to distinguish between devices
- Host `udev` rules for RTL-SDR permissions (from `rtl-sdr` package)

### Docker-to-Host Communication

- Output is primarily file-based (IQ samples, DOA results) - use volume mounts: `-v /host/output:/output`
- Python visualization scripts can optionally serve a simple web display if modified for integration
- Results can be piped to stdout or written to shared volumes for consumption by Argos
- No persistent network services by default (batch/research-oriented tool)

---

## Install Instructions (Docker on Kali RPi 5)

### Prerequisites (Host)

```bash
# Blacklist kernel DVB driver to prevent it from claiming RTL-SDR tuners
echo 'blacklist dvb_usb_rtl28xxu' | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu

# Install RTL-SDR tools on host for dongle serial programming
sudo apt-get update && sudo apt-get install -y rtl-sdr

# Program unique serial numbers on each RTL-SDR dongle
# (connect one at a time for programming)
rtl_eeprom -s 00000001  # First dongle
rtl_eeprom -s 00000002  # Second dongle
rtl_eeprom -s 00000003  # Third dongle
# Unplug and replug after programming
```

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

# Install build dependencies and RTL-SDR libraries
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    libusb-1.0-0-dev \
    librtlsdr-dev \
    rtl-sdr \
    libfftw3-dev \
    python3 \
    python3-pip \
    python3-numpy \
    python3-scipy \
    python3-matplotlib \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Clone rtl_coherent repository
RUN cd /opt && \
    git clone https://github.com/tejeez/rtl_coherent.git

WORKDIR /opt/rtl_coherent

# Build the C components (produces binary named 'main')
RUN make -j$(nproc)

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/rtl-coherent .

# Run interactively for experimentation
docker run -it --rm \
  --name rtl-coherent \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/coherent-output:/output \
  argos/rtl-coherent

# Inside the container, verify all RTL-SDR dongles are detected:
# rtl_test -t    (repeat for each dongle by specifying -d 0, -d 1, -d 2)

# Run coherent capture using the run.sh pipeline script:
# bash run.sh

# Or run the main binary directly (binary is named 'main'):
# ./main

# Process DOA from captured data (MUSIC algorithm):
# python3 music_df.py
# python3 inter_df.py
```

### Experimental Usage Notes

```bash
# rtl_coherent is a research-grade tool. Key considerations:
#
# 1. Clock synchronization: All RTL-SDR dongles must receive a common
#    reference signal for phase coherence. This can be achieved by:
#    - Splitting a known transmitter signal to all antennas
#    - Using a noise source coupled to all receivers
#    - Software-based cross-correlation (lower accuracy)
#
# 2. Antenna array: Physical antenna arrangement determines DOA
#    resolution. Uniform circular or linear arrays recommended.
#    Element spacing should be approximately half-wavelength at
#    the target frequency.
#
# 3. Calibration: Each dongle has different phase/gain characteristics.
#    Calibration against a known transmitter position is essential
#    for accurate DOA estimation.
#
# 4. Comparison to KrakenSDR: KrakenSDR provides hardware-level
#    clock synchronization and calibration, delivering significantly
#    more reliable DOA results. rtl_coherent is suitable for
#    experimentation and proof-of-concept work at very low cost.
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - The C source code compiles natively on ARM64 using standard gcc with no architecture-specific dependencies. The rtlsdr library (`librtlsdr`) is available as a pre-built ARM64 package in the Kali/Debian repositories. Python scientific libraries (NumPy, SciPy, Matplotlib) have mature ARM64 builds. No cross-compilation or emulation required.

### Hardware Constraints

- **CPU**: Coherent processing across multiple RTL-SDR streams is moderately CPU-intensive. Real-time cross-correlation and FFT processing for 3-5 simultaneous SDR streams will consume approximately 40-70% of the RPi5 CPU capacity depending on sample rate and FFT size. The Cortex-A76 cores provide adequate performance for experimental use.
- **RAM**: Each RTL-SDR stream at 2.4 MSPS consumes approximately 50-100MB for buffering and processing. With 5 dongles, total memory usage is approximately 500MB-1GB. Feasible within the 8GB available.
- **Storage**: Application and dependencies require approximately 500MB. Raw IQ capture files can be large (several GB for extended captures); plan storage accordingly.
- **USB**: Multiple RTL-SDR dongles require adequate USB bandwidth. The RPi5 has a PCIe-based USB 3.0 controller that can handle multiple simultaneous SDR streams, but a powered USB hub is recommended for reliable power delivery. USB 2.0 bandwidth may become a bottleneck with more than 3-4 dongles at high sample rates.
- **Hardware**: Requires 3-5 RTL-SDR dongles ($10-25 each), antenna array, and optionally a reference signal source for clock synchronization. Total hardware cost approximately $50-150 depending on dongle count and antenna quality.

### Verdict

**COMPATIBLE** - rtl_coherent compiles and runs on the Raspberry Pi 5 with ARM64 support. However, this is an experimental/research-grade tool with significantly lower DOA accuracy and reliability compared to the KrakenSDR. It is best suited for educational purposes, proof-of-concept experiments, and scenarios where the KrakenSDR hardware is not available. The low cost of entry (multiple $10 RTL-SDR dongles versus the $150 KrakenSDR) makes it valuable for initial experimentation before investing in dedicated DOA hardware. For production tactical deployments, the KrakenSDR is strongly recommended.
