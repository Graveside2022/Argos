# CleverJAM

> **RISK CLASSIFICATION**: HIGH RISK - EXTREME - SENSITIVE SOFTWARE
> Smart RF jammer with adaptive frequency targeting and power control. Disrupts wireless communications by intelligently hopping across frequencies to maximize jamming effectiveness. Illegal to operate under FCC regulations (47 U.S.C. 333). Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python/GNU Radio; ARM64-native with HackRF USB passthrough

| Method               | Supported | Notes                                                                                               |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `debian:bookworm-slim` base with `gnuradio`, `gr-osmosdr`, `hackrf`; USB passthrough for HackRF One |
| **Native Install**   | YES       | GNU Radio and all dependencies install natively from Kali ARM64 apt repositories                    |

---

## Tool Description

CleverJAM is an intelligent RF jamming tool that improves upon brute-force broadband jamming by implementing adaptive frequency targeting. Built on GNU Radio with HackRF One support, it analyzes the RF environment in real time and focuses jamming energy on detected active transmissions rather than blindly sweeping bands. This approach provides more effective disruption with lower power output and reduces unintentional interference to non-targeted frequency ranges.

## Category

Adaptive RF Jamming / Electronic Warfare / Smart Jamming

## Repository

https://github.com/jhonnybonny/CleverJAM

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - CleverJAM runs in Docker with HackRF One USB passthrough. The tool is Python/GNU Radio-based and operates entirely through USB-connected SDR hardware with no GUI requirement for core operation.

### Host OS-Level Requirements

- `--privileged` - Required for raw USB access to HackRF One for simultaneous RX (sensing) and TX (jamming)
- `--device=/dev/bus/usb:/dev/bus/usb` - USB passthrough for HackRF One
- No `--net=host` required (RF operations via USB, not network)
- Host kernel modules: HackRF udev rules on host for device enumeration
- Note: Full-duplex sensing+jamming may benefit from two HackRF units (one RX, one TX)

### Docker-to-Host Communication

- HackRF One must be connected to host USB and accessible via passthrough
- Host requires HackRF udev rules installed: `/etc/udev/rules.d/53-hackrf.rules`
- No network ports required; all operations are USB-to-HackRF
- RF emissions from jamming are NOT contained by Docker; all devices within radio range are affected regardless of container isolation

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install HackRF udev rules on host
sudo apt-get update && sudo apt-get install -y hackrf
sudo udevadm control --reload-rules
sudo udevadm trigger

# Verify HackRF detected
hackrf_info
```

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    gnuradio \
    gr-osmosdr \
    hackrf \
    libhackrf-dev \
    python3 \
    python3-pip \
    python3-numpy \
    python3-scipy \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/jhonnybonny/CleverJAM.git /opt/cleverjam

WORKDIR /opt/cleverjam

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/cleverjam .

# Run with HackRF passthrough
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/cleverjam

# Inside container - launch CleverJAM with target frequency:
# python3 jam.py --freq 2.4e9 --gain 40
#
# For adaptive/clever jamming mode:
# python3 clever.py --freq 2.4e9 --gain 40
#
# For dual-HackRF operation (dedicated RX + TX):
# python3 jam.py --rx-serial <hackrf1_serial> --tx-serial <hackrf2_serial>
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - CleverJAM is Python-based on top of GNU Radio, which is fully available in the Kali ARM64 repositories. All dependencies (GNU Radio, gr-osmosdr, NumPy, SciPy, libhackrf) compile and run natively on aarch64.

### Hardware Constraints

- CPU: Adaptive frequency sensing + jamming is more CPU-intensive than static broadband jamming due to real-time spectrum analysis. Cortex-A76 quad-core handles this workload but may show elevated CPU usage (50-80% on active cores) during aggressive scanning modes
- RAM: ~1-1.5GB during operation with active GNU Radio flowgraphs and FFT processing; manageable within 8GB
- Hardware: Requires HackRF One (installed). Optimal operation benefits from two HackRF units (one for spectrum sensing, one for jamming) since HackRF is half-duplex. Single-unit mode alternates between sensing and jamming
- Storage: ~500MB including GNU Radio dependencies in Docker image

### Verdict

**COMPATIBLE** - CleverJAM runs natively on Kali RPi 5 ARM64 with HackRF One. The adaptive jamming algorithm is more CPU-intensive than static jammers but remains within RPi 5 Cortex-A76 capabilities. Dual-HackRF configuration recommended for optimal simultaneous sensing and jamming.
