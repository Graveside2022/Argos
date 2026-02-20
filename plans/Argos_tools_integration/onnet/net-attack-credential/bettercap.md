# BetterCAP

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Multi-protocol man-in-the-middle framework capable of ARP spoofing, DNS spoofing, WiFi deauthentication, BLE reconnaissance, HTTP proxying, and credential sniffing across wired and wireless networks. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Official ARM64 Go binary; pre-built package in Kali ARM64 repos

| Method               | Supported | Notes                                                                                               |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `kalilinux/kali-rolling` base; requires `--privileged` and `--net=host` for LAN/WiFi/BLE operations |
| **Native Install**   | YES       | `apt install bettercap`; recommended over Docker for reduced network overhead                       |

---

## Tool Description

BetterCAP is a comprehensive network attack and monitoring framework written in Go. It provides a modular architecture supporting simultaneous operations across multiple network protocols: ARP spoofing for LAN MITM, DNS spoofing for traffic redirection, WiFi deauthentication and client handshake capture, BLE device enumeration and characteristic reading, HTTP/HTTPS transparent proxying with SSLstrip, and credential sniffing. BetterCAP features an interactive command shell, a REST API for automation, and a web-based UI for real-time session monitoring.

## Category

Multi-Protocol MITM / Network Attack Framework / Credential Harvesting

## Repository

https://github.com/bettercap/bettercap

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - BetterCAP runs well in Docker with privileged access and host networking. It is distributed as a single static Go binary with minimal runtime dependencies, making it ideal for containerized deployment.

### Host OS-Level Requirements

- `--privileged` - Required for raw socket access, ARP manipulation, monitor mode control, and BLE scanning
- `--net=host` - Required for direct access to host network interfaces (ARP spoofing, packet capture, WiFi operations)
- `--device=/dev/bus/usb:/dev/bus/usb` - USB passthrough for external WiFi adapter and BLE adapter
- Host kernel modules: `cfg80211`, `mac80211` (WiFi), `bluetooth`, `btusb` (BLE), `nf_tables` (packet filtering)
- WiFi adapter must support monitor mode for WiFi attacks (Alfa AWUS036AXML)

### Docker-to-Host Communication

- Full host network stack access via `--net=host` for all LAN and WiFi operations
- BetterCAP REST API accessible on configurable port (default 8081) for remote control
- BetterCAP web UI accessible on configurable port (default 443) for browser-based control
- Capture files and logs via volume mount: `-v /host/bettercap:/data`
- WiFi adapter must be managed on host or privileges delegated to container

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt-get update && sudo apt-get install -y bettercap
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    bettercap \
    iw \
    wireless-tools \
    net-tools \
    iproute2 \
    aircrack-ng \
    bluez \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data /usr/local/share/bettercap

WORKDIR /data

ENTRYPOINT ["bettercap"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/bettercap .

# Run - interactive mode with full network access
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/bettercap-data:/data \
  argos/bettercap

# Run - with REST API and web UI enabled
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/bettercap-data:/data \
  argos/bettercap -eval "set api.rest.address 0.0.0.0; api.rest on; set http.ui.address 0.0.0.0; http.ui on"

# Run - ARP spoofing with credential sniffing
docker run --rm -it \
  --privileged \
  --net=host \
  argos/bettercap -eval "net.probe on; set arp.spoof.targets 192.168.1.0/24; arp.spoof on; net.sniff on"

# Run - WiFi scanning (requires monitor mode adapter)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/bettercap -eval "wifi.recon on"

# Run - BLE scanning
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/bettercap -eval "ble.recon on"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - BetterCAP provides official ARM64 (aarch64) releases as pre-compiled Go binaries. Additionally, the Kali Linux ARM64 repository includes a pre-built `bettercap` package installable via `apt`. No source compilation required.

### Hardware Constraints

- CPU: Go binary is efficient; Cortex-A76 handles all BetterCAP modules simultaneously without performance concerns. ARP spoofing and packet sniffing are lightweight operations
- RAM: ~100-300MB during active operations; BLE and WiFi scanning modules may increase usage slightly. Well within 8GB
- Hardware: Standard network interface for LAN operations (built-in). WiFi adapter with monitor mode for WiFi attacks (Alfa AWUS036AXML installed). Bluetooth adapter for BLE recon (installed). No additional hardware required
- Storage: Minimal (<100MB for Go binary plus caplets)

### Verdict

**COMPATIBLE** - BetterCAP runs natively on Kali RPi 5 ARM64 with official ARM64 support. Pre-built package available in Kali repositories. All required network adapters (Ethernet, WiFi with monitor mode, Bluetooth) are available on the Argos platform. Native install is recommended over Docker for reduced overhead on network operations.
