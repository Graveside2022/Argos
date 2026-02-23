# Airgeddon

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Menu-driven WiFi attack suite covering deauthentication, evil twin, WPS attacks, handshake capture, WPA/WPA2 cracking, and PMKID harvesting from a single interactive interface. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Bash script; architecture-independent with all dependencies in Kali ARM64 repos

| Method               | Supported | Notes                                                                                   |
| -------------------- | --------- | --------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Official Docker image available; requires `--privileged`, `--net=host`, USB passthrough |
| **Native Install**   | YES       | `apt install airgeddon` on Kali ARM64; recommended for simplicity                       |

---

## Tool Description

Airgeddon is a comprehensive, menu-driven Bash script that orchestrates WiFi security auditing through an interactive terminal interface. It integrates multiple underlying tools (aircrack-ng, mdk4, hashcat, bettercap, hostapd, dhcpd, ettercap, beef) to provide a unified workflow for handshake capture, WPS Pixie Dust and brute-force attacks, evil twin with captive portal, PMKID harvesting, offline WPA cracking, and enterprise network attacks. Airgeddon handles interface management, dependency checking, and attack chaining automatically. It also provides its own official Docker image.

## Category

WiFi Multi-Attack Suite / Interactive Exploitation Framework

## Repository

https://github.com/v1s1t0r1sh3r3/airgeddon

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Airgeddon has official Docker support and maintains its own Docker image. It runs fully within a container given privileged access, host networking, and WiFi adapter passthrough.

### Host OS-Level Requirements

- `--privileged` - Required for monitor mode management, raw 802.11 injection, and network interface control
- `--net=host` - Required for wireless interface access, evil twin AP creation, and DHCP server operation
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- For evil twin attacks: host must allow container to create virtual interfaces and run hostapd/dhcpd

### Docker-to-Host Communication

- Evil twin mode creates a rogue AP that requires full host network stack access via `--net=host`
- Captured handshakes shared via volume mount: `-v /host/output:/opt/airgeddon/captured`
- DHCP and DNS services for evil twin run inside the container on host network
- X11 forwarding optional for GUI features: `-e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y airgeddon
```

### Option B: Official Docker Image

```bash
# Pull the official Airgeddon Docker image
docker pull v1s1t0r1sh3r3/airgeddon

# Run with full WiFi access
docker run --rm -it \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  -v $(pwd)/airgeddon-output:/opt/airgeddon/captured \
  v1s1t0r1sh3r3/airgeddon /opt/airgeddon/airgeddon.sh
```

### Option C: Custom Docker Build

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    airgeddon \
    aircrack-ng \
    mdk4 \
    hashcat \
    hostapd \
    isc-dhcp-server \
    dnsmasq \
    reaver \
    bully \
    pixiewps \
    hcxdumptool \
    hcxtools \
    ettercap-text-only \
    wireless-tools \
    iw \
    net-tools \
    curl \
    xterm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/airgeddon
ENTRYPOINT ["airgeddon"]
```

```bash
# Build custom image
docker build -t argos/airgeddon .

# Run
docker run --rm -it \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  -v $(pwd)/airgeddon-output:/opt/airgeddon/captured \
  argos/airgeddon airgeddon.sh
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Airgeddon is a Bash script with no compiled components; it runs identically on any architecture where its dependencies are available. All dependencies (aircrack-ng, mdk4, hashcat, hostapd, etc.) are available in Kali ARM64 repos.

### Hardware Constraints

- CPU: The Bash script itself is negligible. CPU usage depends on which attack mode is active. Handshake cracking via hashcat is CPU-bound and slow on RPi5 (no GPU)
- RAM: ~200-500MB depending on active attack mode. Evil twin with bettercap/ettercap uses more RAM. Well within 8GB
- WiFi: Requires adapter with monitor mode and injection. Alfa AWUS036AXML (mt76x2u) compatible. Evil twin mode benefits from a second WiFi adapter (one for AP, one for deauth)
- Display: Interactive TUI requires a terminal. Remote SSH sessions work fine

### Verdict

**COMPATIBLE** - Airgeddon runs natively on RPi5 without any architecture concerns. The official Docker image provides an additional deployment option. All attack modes function correctly with the Alfa AWUS036AXML adapter. Only limitation is hashcat cracking speed (CPU-only on RPi5). Native install recommended for simplicity.
