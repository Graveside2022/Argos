# Fluxion

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Automated evil twin attack tool combining rogue AP creation with captive portal social engineering to trick users into entering their WPA/WPA2 passphrase. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Bash script; architecture-independent with all dependencies in Kali ARM64 repos

| Method               | Supported | Notes                                                                                    |
| -------------------- | --------- | ---------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough, X11 forwarding for xterm windows |
| **Native Install**   | YES       | Clone from GitHub; all deps in Kali ARM64 repos; recommended; requires X11 for display   |

---

## Tool Description

Fluxion is a security auditing tool that automates evil twin attacks with social engineering. It captures a WPA handshake from the target network, creates a cloned rogue access point, deauthenticates clients from the legitimate AP, and presents a convincing captive portal page requesting the WiFi password when clients connect to the rogue AP. The entered password is verified in real-time against the captured handshake; if correct, Fluxion reports success and shuts down the rogue AP. Fluxion orchestrates multiple tools (aircrack-ng, hostapd, dhcpd, lighttpd/nginx) through a guided Bash menu interface with multi-language captive portal templates.

## Category

Evil Twin / Captive Portal Social Engineering

## Repository

https://github.com/FluxionNetwork/fluxion

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Fluxion runs in Docker with privileged access and host networking. As a Bash script orchestrating other tools, it requires a fully equipped container with all dependencies pre-installed.

### Host OS-Level Requirements

- `--privileged` - Required for monitor mode, packet injection, rogue AP creation, DHCP/DNS services, and iptables rules
- `--net=host` - Required for rogue AP bridge, captive portal HTTP server, DHCP, and DNS on host network stack
- `--device=/dev/bus/usb` - USB passthrough for WiFi adapter(s)
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- Two WiFi interfaces recommended (one for rogue AP, one for deauth and handshake capture)

### Docker-to-Host Communication

- All services (hostapd, DHCP, DNS, HTTP captive portal) bind to host network via `--net=host`
- HTTP captive portal on port 80, DNS on port 53, DHCP on port 67/68
- Captured handshakes and passwords shared via volume mount: `-v /host/output:/root/.fluxion`
- X11 forwarding needed for xterm windows: `-e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (from source)

```bash
sudo apt update
sudo apt install -y git aircrack-ng hostapd dnsmasq lighttpd isc-dhcp-server \
    mdk4 wireless-tools iw net-tools macchanger iptables php-cgi xterm bc

git clone https://github.com/FluxionNetwork/fluxion.git /opt/fluxion
cd /opt/fluxion
sudo bash fluxion.sh
# Fluxion auto-checks and reports missing dependencies on first run
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    git \
    aircrack-ng \
    hostapd \
    dnsmasq \
    lighttpd \
    isc-dhcp-server \
    mdk4 \
    wireless-tools \
    iw \
    net-tools \
    macchanger \
    iptables \
    php-cgi \
    xterm \
    bc \
    gawk \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/FluxionNetwork/fluxion.git /opt/fluxion

WORKDIR /opt/fluxion
ENTRYPOINT ["bash", "fluxion.sh"]
```

```bash
# Build
docker build -t argos/fluxion .

# Run - interactive mode (Fluxion is menu-driven)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/fluxion-output:/root/.fluxion \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  argos/fluxion

# Run - without X11 (text-only mode, if supported)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/fluxion-output:/root/.fluxion \
  argos/fluxion -l
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Fluxion is a Bash script with no compiled components. It runs identically on any architecture where its dependencies are available. All dependencies (aircrack-ng, hostapd, dnsmasq, lighttpd, etc.) are available in Kali ARM64 repos.

### Hardware Constraints

- CPU: Bash script overhead is negligible. Underlying services (hostapd, dhcpd, lighttpd) are lightweight. Handshake verification via aircrack-ng uses minimal CPU
- RAM: ~200-400MB with all services running. Well within 8GB
- WiFi: Best results with two WiFi adapters. Alfa AWUS036AXML (mt76x2u) works for both AP and monitor roles. Second cheap adapter recommended for simultaneous deauth and AP operation
- Display: Fluxion uses xterm for multiple terminal windows. Over SSH, X11 forwarding must be enabled, or use screen/tmux as alternatives

### Verdict

**COMPATIBLE** - Fluxion runs natively on RPi5 without architecture concerns. Pure Bash script with standard tool dependencies all available in Kali ARM64 repos. The main operational consideration is X11 display requirement (Fluxion opens multiple xterm windows). For headless RPi5 operation, X11 forwarding over SSH is needed. Native install from GitHub recommended.
