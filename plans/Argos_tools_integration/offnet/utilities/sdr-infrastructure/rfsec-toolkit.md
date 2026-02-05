# RFSec-ToolKit

> **RISK CLASSIFICATION**: LOW RISK
> Reference collection of RF security research tools and documentation; contains links, scripts, and methodology references with no direct RF transmission capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Architecture-independent reference collection of scripts and documentation; no compiled components

| Method               | Supported | Notes                                                                                             |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Trivial to containerize; no hardware, privileges, or special flags needed; alpine base sufficient |
| **Native Install**   | YES       | Already installed on Argos system; simple git clone, no build step required                       |

---

## Tool Description

RFSec-ToolKit is a curated collection of RF security research tool links and resources organized by SDR hardware platform (HackRF, RTL-SDR, BladeRF, LimeSDR, PlutoSDR, USRP). The repository's primary value is its README.md, which serves as a comprehensive index of SDR software, wireless security tools, and research references covering WiFi, Bluetooth, ZigBee, Z-Wave, GSM/LTE, RFID, GPS, ADS-B, and other wireless protocols. It is installed on the Argos system as a reference resource that complements the dedicated analysis tools in the SDR framework.

## Category

RF Security Reference Collection / Tool Index / Helper Scripts

## Repository

https://github.com/cn0xroot/RFSec-ToolKit

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - RFSec-ToolKit is primarily a collection of documentation, scripts, and references that requires no special hardware access or elevated privileges. It can be containerized trivially as a static resource volume or lightweight container. Most of the value comes from the curated information rather than executable tooling.

### Host OS-Level Requirements

- No `--device` flags required (no hardware interaction)
- No `--privileged` required (reference material and scripts only)
- No `--net=host` required
- No kernel modules required
- No udev rules required
- Individual scripts within the collection may have their own dependencies, but the toolkit itself has minimal requirements

### Docker-to-Host Communication

- Volume mount for accessing the toolkit contents: `-v /host/rfsec-toolkit:/opt/rfsec-toolkit`
- No network services exposed
- No ports required
- Scripts can be executed from the mounted volume or copied into other containers as needed

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - Already Installed)

```bash
# RFSec-ToolKit is already installed on the Argos system.
# Verify installation:
ls /opt/RFSec-ToolKit 2>/dev/null || ls ~/tools/RFSec-ToolKit 2>/dev/null

# Clone or update if needed:
cd /opt
git clone https://github.com/cn0xroot/RFSec-ToolKit.git
# or
cd /opt/RFSec-ToolKit && git pull
```

### Option B: Docker (Lightweight Reference Container)

```dockerfile
FROM alpine:latest

RUN apk add --no-cache git

RUN cd /opt && \
    git clone https://github.com/cn0xroot/RFSec-ToolKit.git

WORKDIR /opt/RFSec-ToolKit

ENTRYPOINT ["/bin/sh"]
```

```bash
# Build the Docker image
docker build -t argos/rfsec-toolkit .

# Run interactively to browse the toolkit
docker run -it --rm \
  --name rfsec-toolkit \
  argos/rfsec-toolkit

# Mount the toolkit as a reference volume for other containers
docker run -it --rm \
  -v $(pwd)/rfsec-reference:/opt/RFSec-ToolKit \
  argos/rfsec-toolkit \
  cp -r /opt/RFSec-ToolKit/* /opt/RFSec-ToolKit/
```

### Usage

```bash
# RFSec-ToolKit is organized by SDR hardware platform:
#
# /opt/RFSec-ToolKit/
#   BladeRF/       - BladeRF tools and references
#   HackRF/        - HackRF tools and references
#   LimeSDR/       - LimeSDR tools and references
#   PlutoSDR/      - PlutoSDR (ADALM-PLUTO) tools and references
#   RTL-SDR/       - RTL-SDR tools and references
#   USRP/          - USRP tools and references
#   README.md      - Curated link collection covering SDR software,
#                    GSM/LTE, WiFi, Bluetooth, ZigBee, RFID, GPS, etc.
#
# The README.md contains the primary value: a comprehensive curated
# index of RF security tools, techniques, and resources organized by
# category (SDR hardware, SDR software, 2G/3G/4G/5G, NFC/RFID, etc.)
#
# Use as a reference during RF operations to quickly locate
# the appropriate tool or technique for a given wireless target.
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - RFSec-ToolKit is architecture-independent as it consists primarily of documentation, scripts, and references. Shell scripts and Python helper scripts run on any architecture. No compiled binaries or architecture-specific components.

### Hardware Constraints

- **CPU**: Negligible CPU usage. The toolkit is a static reference collection.
- **RAM**: Negligible memory usage. Browsing the collection requires minimal resources.
- **Storage**: Approximately 50-200MB for the full repository including documentation and scripts.
- **Hardware**: No dedicated hardware required. The toolkit references tools that may require specific hardware, but the toolkit itself has no hardware dependencies.

### Verdict

**COMPATIBLE** - RFSec-ToolKit runs on any platform including the Raspberry Pi 5. It is a lightweight reference collection with no resource constraints. Already installed on the Argos system. Docker containerization adds unnecessary overhead for this tool; native installation as a git repository on disk is the most practical approach. Value lies in having organized RF security references immediately accessible during operations.
