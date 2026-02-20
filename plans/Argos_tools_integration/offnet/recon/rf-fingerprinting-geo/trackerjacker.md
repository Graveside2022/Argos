# trackerjacker

> **RISK CLASSIFICATION**: MODERATE RISK - PASSIVE SURVEILLANCE
> WiFi device tracking via probe request sniffing without network association, enabling covert device location monitoring. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python with libpcap; requires external USB WiFi adapter with monitor mode

| Method               | Supported | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged` and `--net=host` for monitor mode WiFi access |
| **Native Install**   | YES       | `pip install trackerjacker` on ARM64; libpcap available in Kali repos |

---

## Tool Description

trackerjacker is a Python-based WiFi device tracker that monitors and maps devices through passive 802.11 probe request sniffing. It tracks devices by MAC address without associating to any network, identifying device vendors via OUI lookup, measuring signal strength (RSSI), and detecting movement patterns. Operates in monitor mode to passively capture probe requests, beacon frames, and other WiFi management frames. Can be used for perimeter monitoring, device counting, presence detection, and tracking device movement patterns over time.

## Category

WiFi Surveillance / Device Tracking / Passive RF Monitoring

## Repository

https://github.com/calebmadrigal/trackerjacker

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Python application that requires privileged access to a WiFi adapter in monitor mode. Containerizable with appropriate device passthrough and privileges.

### Host OS-Level Requirements

- `--privileged` required for WiFi monitor mode control (alternatively, `--cap-add=NET_ADMIN --cap-add=NET_RAW`)
- `--net=host` required for direct access to wireless interfaces
- Host must have a WiFi adapter capable of monitor mode (e.g., Alfa AWUS036ACH, TP-Link TL-WN722N v1)
- Host kernel modules: `cfg80211`, `mac80211`, and adapter-specific driver (e.g., `ath9k_htc`, `rtl8812au`)
- `iw` and `airmon-ng` utilities must be available (installed on Kali by default)

### Docker-to-Host Communication

- **WiFi Adapter**: The WiFi adapter must be placed in monitor mode on the host (or the container must have privileges to do so). The container accesses the monitor mode interface via `--net=host`.
- **Output**: Results written to stdout, JSON files, or can trigger webhook alerts. Mount a volume for persistent log storage.
- **No TAK output natively**: trackerjacker does not produce CoT messages directly. Output would need to be piped through a custom bridge to TAK.

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Ensure WiFi adapter with monitor mode support is connected
# Verify adapter is detected
iwconfig

# Put adapter into monitor mode (if not done inside container)
sudo airmon-ng start wlan1
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    iw \
    wireless-tools \
    aircrack-ng \
    libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir trackerjacker

ENTRYPOINT ["trackerjacker"]
```

### Build and Run

```bash
# Build
docker build -t argos/trackerjacker .

# Track all devices (monitor mode)
docker run -it --rm \
  --privileged \
  --net=host \
  argos/trackerjacker --track \
  --interface wlan1mon

# Track specific MAC addresses
docker run -it --rm \
  --privileged \
  --net=host \
  argos/trackerjacker --track \
  --interface wlan1mon \
  --mac-to-track "AA:BB:CC:DD:EE:FF,11:22:33:44:55:66"

# Map all nearby devices (discovery mode)
docker run -it --rm \
  --privileged \
  --net=host \
  argos/trackerjacker --map \
  --interface wlan1mon

# Track with JSON output for Argos integration
docker run -it --rm \
  --privileged \
  --net=host \
  -v $(pwd)/output:/output \
  argos/trackerjacker --track \
  --interface wlan1mon \
  --output /output/devices.json

# Track with alert threshold (signal strength trigger)
docker run -it --rm \
  --privileged \
  --net=host \
  argos/trackerjacker --track \
  --interface wlan1mon \
  --threshold -50 \
  --alert-command "echo 'Strong signal detected: {mac}'"
```

### Key Command Options

| Option                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `--track`               | Track devices by MAC, report signal strength changes |
| `--map`                 | Map all nearby networks and devices                  |
| `--interface`           | WiFi interface in monitor mode                       |
| `--mac-to-track`        | Comma-separated list of target MAC addresses         |
| `--threshold`           | RSSI threshold (dBm) to trigger alerts               |
| `--alert-command`       | Command to execute when threshold is crossed         |
| `--channels-to-monitor` | Specific WiFi channels to scan                       |

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package with libpcap dependency. All components have ARM64 support. The libpcap library is available in Kali's aarch64 repository. Installs cleanly via pip on Raspberry Pi 5.

### Hardware Constraints

- **CPU**: Low - passive packet capture and RSSI tracking. Minimal processing overhead on Cortex-A76.
- **RAM**: < 100MB total footprint, even when tracking hundreds of devices.
- **Hardware**: Requires an external USB WiFi adapter with monitor mode support. The RPi 5's built-in WiFi (Broadcom BCM2712) does not reliably support monitor mode. Recommended adapters:
    - Alfa AWUS036ACH (dual-band, well-supported on Kali)
    - Alfa AWUS036ACHM (monitor mode, good range)
    - TP-Link TL-WN722N v1 (Atheros chipset, budget option)
- **Note**: The WiFi adapter used for trackerjacker cannot simultaneously be used for internet connectivity. Use the RPi's built-in WiFi or Ethernet for network access.

### Verdict

**COMPATIBLE** - trackerjacker runs natively on Raspberry Pi 5 with an external USB WiFi adapter in monitor mode. Lightweight passive tool that integrates well with the Argos WiFi monitoring stack. Can complement Kismet by providing focused device tracking and movement pattern analysis for specific MAC addresses of interest.
