# USRP Sweep

> **RISK CLASSIFICATION**: LOW RISK
> Passive wideband spectrum analyzer using USRP hardware with no transmit capability in sweep mode; receive-only frequency scanning. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — UHD driver and tools available as ARM64 packages; B200/B210 USB models best suited for RPi5

| Method               | Supported | Notes                                                                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | USB passthrough (`--privileged --device=/dev/bus/usb`) or `--net=host` for network USRPs; UHD firmware volume mount needed |
| **Native Install**   | YES       | `uhd-host`, `libuhd-dev`, `python3-uhd` ARM64 packages available in Kali 2025.4 repos                                      |

---

## Tool Description

USRP Sweep is the Argos built-in wideband spectrum analysis module that uses Ettus Research USRP (Universal Software Radio Peripheral) hardware for frequency-domain scanning across the USRP's supported frequency range. The USRP platform offers wider instantaneous bandwidth, better dynamic range, and more flexible RF frontend options compared to the HackRF, making it suitable for high-fidelity spectrum monitoring applications. The module integrates with the Argos web interface through the UHD (USRP Hardware Driver) library and provides real-time spectrum visualization alongside the existing HackRF spectrum analysis capability.

## Category

Wideband Spectrum Analysis / High-Fidelity RF Monitoring / USRP Integration

## Repository

Built into the Argos application. USRP-specific components in `src/lib/components/`, API endpoints in `src/routes/api/`, UHD driver integration via system libraries.

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - USRP Sweep runs in Docker with USB passthrough for the USRP device. The UHD (USRP Hardware Driver) library and associated tools run as standard userspace processes. Network-connected USRPs (USRP N2xx, X3xx, N3xx) can be accessed without USB passthrough, using only network connectivity from the container.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for USB-connected USRP devices (B200, B210, B200mini)
- `--privileged` - Required for direct USB access to USRP hardware
- `--net=host` - Required for network-connected USRP devices that use UDP for high-bandwidth IQ streaming
- Host kernel module `usb_uhci` or `xhci_hcd` for USB 3.0 USRP devices (loaded by default)
- UHD firmware images must be available (downloaded via `uhd_images_downloader` either on host or in container)
- Host `udev` rules for Ettus USRP devices (installed by `uhd-host` package)

### Docker-to-Host Communication

- Part of the main Argos container for integrated deployment
- UHD device discovery uses UDP broadcast on port **49152** - requires `--net=host` for network USRPs
- High-bandwidth IQ data streams over USB 3.0 or Gigabit Ethernet (depending on USRP model)
- Argos WebSocket server streams processed spectrum data to the frontend
- USRP FPGA image loading may require access to UHD firmware directory: `-v /usr/share/uhd:/usr/share/uhd`

---

## Install Instructions (Docker on Kali RPi 5)

### Part of Main Argos Container

```bash
# USRP Sweep is included in the main Argos Docker deployment.

# Install UHD drivers and tools on the host:
sudo apt-get update && sudo apt-get install -y \
    uhd-host \
    libuhd-dev \
    gnuradio

# Download USRP firmware images (required for device initialization):
sudo uhd_images_downloader

# Verify USRP device is detected:
uhd_find_devices
uhd_usrp_probe

# For USB-connected USRPs (B200/B210), set USB permissions:
# UHD udev rules are typically installed by the uhd-host package
# If not, copy from /usr/lib/uhd/utils/uhd-usrp.rules to /etc/udev/rules.d/
```

### Standalone USRP Spectrum Test

```bash
# Test USRP spectrum analysis directly on the host:
# Using UHD example rx_ascii_art_dft (real-time terminal spectrum display):
/usr/lib/uhd/examples/rx_ascii_art_dft \
    --freq 2.4e9 \
    --rate 10e6 \
    --gain 40 \
    --frame-rate 10

# Using uhd_fft (GNU Radio companion, requires display):
uhd_fft -f 2.4e9 -s 10e6 -g 40
```

### Docker with UHD Support

```dockerfile
# If building a standalone USRP analysis container:
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    uhd-host \
    libuhd-dev \
    python3-uhd \
    python3-numpy \
    python3-scipy \
    && rm -rf /var/lib/apt/lists/*

# Download firmware images into the container
RUN uhd_images_downloader || true

ENTRYPOINT ["/bin/bash"]
```

```bash
# Run with USB USRP:
docker run -it --rm \
  --privileged \
  --device=/dev/bus/usb \
  -v /usr/share/uhd/images:/usr/share/uhd/images \
  argos/usrp-sweep

# Run with network USRP:
docker run -it --rm \
  --net=host \
  -v /usr/share/uhd/images:/usr/share/uhd/images \
  argos/usrp-sweep
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - UHD (USRP Hardware Driver) is available as a pre-built ARM64 package in the Kali/Debian repositories. The `uhd-host` and `libuhd-dev` packages install cleanly on aarch64. Python UHD bindings (`python3-uhd`) are also available for ARM64. The USRP B200/B210 series (USB 3.0) are the most suitable models for portable RPi5 deployment.

### Hardware Constraints

- **CPU**: USRP spectrum processing is more CPU-intensive than HackRF due to wider instantaneous bandwidth and higher sample rates. At 10 MSPS, the RPi5 Cortex-A76 cores handle FFT and visualization comfortably. At 56 MSPS (B210 maximum), CPU usage increases significantly and may require reduced FFT resolution or averaging.
- **RAM**: UHD buffers and spectrum processing consume approximately 500MB-1.5GB depending on sample rate and buffer configuration. Higher sample rates require larger buffers. Feasible within 8GB but monitor memory usage at maximum sample rates.
- **Storage**: UHD firmware images require approximately 500MB-1GB. Runtime storage requirements depend on logging configuration.
- **Hardware**: Requires a USRP device. The B200mini (~$700) or B210 (~$1,300) are the most practical for portable RPi5 deployment due to USB 3.0 connectivity. The RPi5 USB 3.0 ports provide adequate bandwidth for B200 (up to 30.72 MSPS) but may be bandwidth-limited for B210 at maximum dual-channel rates.
- **Power**: USB-powered USRP devices (B200, B200mini) draw significant current (up to 1.5A). An externally powered USB 3.0 hub is recommended for reliable operation on the RPi5.

### Verdict

**COMPATIBLE** - USRP Sweep runs natively on the Raspberry Pi 5 with ARM64 UHD packages from Kali repositories. The USRP provides higher dynamic range and wider bandwidth than the HackRF, at higher cost and power consumption. The RPi5 USB 3.0 interface supports adequate data throughput for the B200/B200mini models. For maximum USRP performance, sample rates may need to be limited compared to x86 workstation deployments. An externally powered USB hub is recommended for reliable USRP power delivery.
