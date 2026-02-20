# Wifiphisher

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Automated rogue access point framework with social engineering phishing templates for credential harvesting via captive portal attacks. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python application available in Kali ARM64 repos; no architecture-specific binaries

| Method               | Supported | Notes                                                                                  |
| -------------------- | --------- | -------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; needs hostapd/dnsmasq in image |
| **Native Install**   | YES       | `apt install wifiphisher` on Kali ARM64; recommended; two WiFi adapters ideal          |

---

## Tool Description

Wifiphisher is an automated rogue access point tool that performs WiFi phishing attacks. It creates a fake access point mimicking a legitimate network, deauthenticates clients from the real AP to force reconnection to the rogue AP, and presents a configurable captive portal page designed to harvest credentials (WiFi passwords, login credentials, or install malware via fake firmware update pages). Wifiphisher includes multiple built-in phishing scenarios (firmware upgrade, OAuth login, network manager connect) and supports custom phishing templates. Two WiFi adapters are recommended: one for the rogue AP and one for deauthentication.

## Category

Evil Twin / Rogue AP / WiFi Social Engineering

## Repository

https://github.com/wifiphisher/wifiphisher

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Wifiphisher runs in Docker with privileged access and host networking. It requires full control over wireless interfaces to create the rogue AP and perform deauthentication simultaneously.

### Host OS-Level Requirements

- `--privileged` - Required for creating virtual AP interface, monitor mode, packet injection, and DHCP/DNS services
- `--net=host` - Required for rogue AP bridge, DHCP server, DNS spoofing, and HTTP captive portal
- `--device=/dev/bus/usb` - USB passthrough for WiFi adapter(s)
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- Recommended: two WiFi adapters (one for AP, one for deauth). Single-adapter mode is supported but less effective

### Docker-to-Host Communication

- Rogue AP and captive portal operate via `--net=host` on the host network stack
- Captive portal HTTP server runs on port 80/443 inside the container (bound to host via `--net=host`)
- DHCP and DNS services for connected victims run inside the container
- Captured credentials shared via volume mount: `-v /host/output:/output`
- Phishing templates mounted from host: `-v /host/templates:/templates`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y wifiphisher
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    wifiphisher \
    hostapd \
    dnsmasq \
    aircrack-ng \
    wireless-tools \
    iw \
    net-tools \
    iptables \
    python3 \
    python3-pip \
    lighttpd \
    php-cgi \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /output
ENTRYPOINT ["wifiphisher"]
```

```bash
# Build
docker build -t argos/wifiphisher .

# Run - interactive mode (auto-select interfaces and scenario)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/wifiphisher

# Run - target specific AP with firmware upgrade scenario
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/wifiphisher -aI wlan1 -eI wlan2 \
  -e "TargetNetwork" -p firmware-upgrade

# Run - with custom phishing template
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  -v $(pwd)/custom-template:/custom-template \
  argos/wifiphisher -aI wlan1 -eI wlan2 \
  -e "TargetNetwork" -p /custom-template

# Run - single adapter mode (AP + deauth on same interface)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/wifiphisher -nD -e "TargetNetwork" -p oauth-login
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Wifiphisher is available in the Kali Linux ARM64 repositories. It is a Python application with no compiled architecture-specific components.

### Hardware Constraints

- CPU: Lightweight Python application. Running the rogue AP, DHCP, DNS, and HTTP server simultaneously uses moderate CPU but well within Cortex-A76 capability
- RAM: ~200-400MB with all services active (hostapd, dnsmasq, HTTP server). Comfortable within 8GB
- WiFi: Best results with two WiFi adapters (one for rogue AP, one for deauthentication). Single Alfa AWUS036AXML works in no-deauth mode (`-nD`). Second adapter recommended for full attack chain
- Network: Captive portal requires ports 80/443 free on the host

### Verdict

**COMPATIBLE** - Wifiphisher runs natively on RPi5. ARM64 package available in Kali repos. Full functionality requires two WiFi adapters (the second can be any cheap monitor-mode-capable adapter for the deauth role). Single-adapter mode works with reduced effectiveness. Native install recommended.
