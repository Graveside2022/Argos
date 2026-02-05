# WiFi-Pumpkin3

> **NOTE:** The apt package availability for wifipumpkin3 on ARM64 Kali is unverified. PyQt5 (`python3-pyqt5`) is a required dependency that may be missing from the documented install steps.

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Rogue access point framework providing MITM interception, captive portal credential harvesting, SSL stripping, DNS spoofing, and transparent proxy injection capabilities. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python application; all dependencies available for ARM64

| Method               | Supported | Notes                                                                                     |
| -------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; official Docker support available |
| **Native Install**   | YES       | `apt install wifipumpkin3` or install from source; recommended for full MITM stack        |

---

## Tool Description

WiFi-Pumpkin3 (WP3) is a comprehensive rogue access point framework for red team WiFi operations. It creates a fully functional rogue AP with integrated MITM capabilities including transparent proxying, DNS spoofing, credential harvesting via captive portal, SSL stripping, JavaScript injection, image replacement, and session hijacking. WP3 features a modular plugin architecture, a CLI and GUI interface, built-in DHCP and DNS servers, and support for custom captive portal templates. It includes its own Docker support and can be extended with custom proxy plugins.

## Category

Rogue AP / MITM Framework / Credential Harvesting

## Repository

https://github.com/P0cL4bs/wifipumpkin3

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - WiFi-Pumpkin3 has official Docker support and runs well in containers with privileged access and host networking. The project maintains Docker build instructions in its repository.

### Host OS-Level Requirements

- `--privileged` - Required for creating AP interface, DHCP/DNS server operation, and iptables rules for traffic interception
- `--net=host` - Required for rogue AP bridge, transparent proxying, and DNS spoofing on the host network stack
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- iptables/nftables on host for NAT and traffic redirection rules

### Docker-to-Host Communication

- Rogue AP and all services (DHCP, DNS, HTTP, proxy) operate via `--net=host`
- Captive portal HTTP on port 80/443, DHCP on port 67/68, DNS on port 53
- Transparent proxy operates on configurable ports (default 8080)
- Captured credentials and logs via volume mount: `-v /host/output:/root/wifipumpkin3/logs`
- Custom captive portal templates mounted from host

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (from Kali repos or source)

```bash
# From Kali repos (if available)
sudo apt update
sudo apt install -y wifipumpkin3

# From source (if not in repos)
sudo apt install -y python3 python3-pip hostapd iptables iw net-tools \
    wireless-tools dnsmasq libssl-dev libffi-dev build-essential
git clone https://github.com/P0cL4bs/wifipumpkin3.git /opt/wifipumpkin3
cd /opt/wifipumpkin3
sudo python3 setup.py install
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-dev \
    hostapd \
    iptables \
    iw \
    net-tools \
    wireless-tools \
    dnsmasq \
    libssl-dev \
    libffi-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/P0cL4bs/wifipumpkin3.git /opt/wifipumpkin3 \
    && cd /opt/wifipumpkin3 \
    && pip3 install --break-system-packages . \
    && rm -rf /root/.cache/pip

WORKDIR /opt/wifipumpkin3
ENTRYPOINT ["wifipumpkin3"]
```

```bash
# Build
docker build -t argos/wifipumpkin3 .

# Run - interactive CLI mode
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/wp3-logs:/root/wifipumpkin3/logs \
  argos/wifipumpkin3

# Run - start rogue AP with captive portal
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/wp3-logs:/root/wifipumpkin3/logs \
  argos/wifipumpkin3 --pulp \
  -xP captiveflask \
  -iN wlan1 \
  -sN "FreeWiFi"

# Run - with transparent proxy and DNS spoofing
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/wp3-logs:/root/wifipumpkin3/logs \
  argos/wifipumpkin3 --pulp \
  -xP pumpkinproxy \
  -iN wlan1 \
  -sN "CorpGuest"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - WiFi-Pumpkin3 is a Python application with no architecture-specific compiled components. All Python dependencies install cleanly on ARM64. hostapd and dnsmasq are available in Kali ARM64 repos.

### Hardware Constraints

- CPU: Moderate CPU usage when running full MITM stack (AP + DHCP + DNS + proxy + HTTP). Cortex-A76 handles this comfortably, though simultaneous heavy proxy traffic may cause some load
- RAM: ~300-600MB with all services active. SSL stripping and proxy injection add overhead. Well within 8GB
- WiFi: Requires at least one WiFi adapter for the rogue AP. Alfa AWUS036AXML (mt76x2u) supports AP mode. A second adapter for deauthentication is beneficial but not required
- Storage: Logs and captured credentials accumulate over time; plan for cleanup in extended operations

### Verdict

**COMPATIBLE** - WiFi-Pumpkin3 runs fully on RPi5 with native ARM64 support. The Python codebase eliminates architecture concerns. The modular architecture allows selective feature activation to manage resource usage. Native install or Docker both viable. WP3 provides the most comprehensive rogue AP feature set in this category.
