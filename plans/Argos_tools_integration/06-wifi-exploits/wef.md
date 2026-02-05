# WEF (WiFi Exploitation Framework)

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Automated WiFi exploitation framework providing guided attack workflows for deauthentication, handshake capture, evil twin, WPS attacks, and PMKID harvesting. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python/Bash codebase; no architecture-specific binaries

| Method               | Supported | Notes                                                                                   |
| -------------------- | --------- | --------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; many wireless tool dependencies |
| **Native Install**   | YES       | Clone from GitHub + `bash wef`; all dependencies in Kali ARM64 repos; recommended       |

---

## Tool Description

WEF (WiFi Exploitation Framework) is an automated WiFi attack tool that provides structured workflows for common wireless penetration testing tasks. It wraps aircrack-ng, hostapd, dnsmasq, and other wireless tools into guided attack sequences covering WPA/WPA2 handshake capture, WPS Pixie Dust and PIN brute force, deauthentication floods, evil twin with captive portal, PMKID collection, and probe request sniffing. WEF is designed for operators who want structured attack automation with less manual configuration than raw tool usage.

## Category

WiFi Automated Exploitation / Attack Workflow Automation

## Repository

https://github.com/D3Ext/WEF

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - WEF runs in Docker with privileged access and host networking. It is primarily Python and Bash scripts with dependencies on standard wireless tools available in Kali repos.

### Host OS-Level Requirements

- `--privileged` - Required for monitor mode management, raw 802.11 injection, and network interface manipulation
- `--net=host` - Required for wireless interface access and evil twin AP creation
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- Evil twin mode requires container ability to create virtual interfaces and run hostapd/dnsmasq

### Docker-to-Host Communication

- Direct wireless interface access via `--net=host` and `--privileged`
- Captured data shared via volume mount: `-v /host/output:/output`
- Evil twin attack mode requires full network stack access for DHCP/DNS services
- No inbound IP port mappings needed for standard attack modes

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (from source)

```bash
sudo apt update
sudo apt install -y git gcc python3 aircrack-ng mdk4 hostapd hostapd-wpe dnsmasq \
    lighttpd reaver bully pixiewps hcxdumptool hcxtools hashcat john macchanger \
    wireless-tools iw iproute2 net-tools ethtool pciutils usbutils bsdmainutils \
    xterm jq curl procps gawk sed bettercap

git clone https://github.com/D3Ext/WEF.git /opt/WEF
cd /opt/WEF
sudo bash wef
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    git \
    gcc \
    python3 \
    aircrack-ng \
    mdk4 \
    hostapd \
    hostapd-wpe \
    dnsmasq \
    lighttpd \
    reaver \
    bully \
    pixiewps \
    hcxdumptool \
    hcxtools \
    hashcat \
    john \
    macchanger \
    wireless-tools \
    iw \
    iproute2 \
    net-tools \
    ethtool \
    pciutils \
    usbutils \
    bsdmainutils \
    xterm \
    jq \
    curl \
    procps \
    gawk \
    sed \
    bettercap \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/D3Ext/WEF.git /opt/WEF \
    && cd /opt/WEF \
    && bash wef

WORKDIR /opt/WEF
ENTRYPOINT ["wef"]
```

```bash
# Build
docker build -t argos/wef .

# Run - interactive mode
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/wef

# Run - specify interface
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/wef -i wlan1
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - WEF is written in Python and Bash with no compiled architecture-specific components. All tool dependencies (aircrack-ng, hostapd, dnsmasq, reaver, etc.) are available in Kali ARM64 repositories.

### Hardware Constraints

- CPU: Lightweight scripting overhead. Actual CPU usage depends on which underlying tools are active. No concerns for RPi5 Cortex-A76 cores
- RAM: ~100-300MB depending on active attack mode and number of concurrent processes. Well within 8GB
- WiFi: Requires adapter with monitor mode and injection support. Alfa AWUS036AXML (mt76x2u) fully compatible
- Storage: Minimal - captured handshakes and log files are small

### Verdict

**COMPATIBLE** - WEF runs without issues on RPi5. Pure Python/Bash codebase eliminates architecture concerns. All dependencies available in Kali ARM64 repos. Native install from the GitHub repository is straightforward and recommended over Docker for this tool.
