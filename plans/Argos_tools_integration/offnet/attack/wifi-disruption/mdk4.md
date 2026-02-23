# mdk4

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Multi-mode WiFi denial-of-service tool capable of beacon flooding, mass deauthentication, SSID brute forcing, and Michael shutdown attacks against WPA-TKIP networks. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Lightweight C binary, pre-built ARM64 package in Kali repos

| Method               | Supported | Notes                                                                          |
| -------------------- | --------- | ------------------------------------------------------------------------------ |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough for WiFi adapter        |
| **Native Install**   | YES       | `apt install mdk4` on Kali ARM64; recommended over Docker for minimal overhead |

---

## Tool Description

mdk4 is the successor to mdk3, providing a comprehensive set of WiFi denial-of-service attack modes. It supports beacon flooding (creating thousands of fake access points), targeted and broadcast deauthentication, SSID brute forcing against hidden networks, 802.11s mesh network disruption, WDS confusion attacks, and Michael shutdown attacks that exploit the TKIP countermeasure mechanism to force WPA-TKIP networks offline. mdk4 operates directly on raw 802.11 frames via monitor mode interfaces.

## Category

WiFi Denial of Service / Wireless Disruption

## Repository

https://github.com/aircrack-ng/mdk4

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - mdk4 runs well in Docker with privileged access and host networking. It is a lightweight C binary with minimal dependencies beyond the WiFi adapter in monitor mode.

### Host OS-Level Requirements

- `--privileged` - Required for raw 802.11 frame injection and monitor mode control
- `--net=host` - Required for direct access to host wireless interfaces in monitor mode
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter (Alfa AWUS036AXML)
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- WiFi adapter must be placed in monitor mode on the host before container launch, or the container must have privileges to do so

### Docker-to-Host Communication

- Monitor mode interface must be configured on the host (`airmon-ng start wlan1` or `iw dev wlan1 set type monitor`)
- No network port mappings required (mdk4 operates on raw 802.11 layer, not IP layer)
- Log output via volume mount: `-v /host/output:/output`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y mdk4
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    mdk4 \
    aircrack-ng \
    wireless-tools \
    iw \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["mdk4"]
```

```bash
# Build
docker build -t argos/mdk4 .

# Prepare monitor mode on host (run before container)
sudo airmon-ng start wlan1

# Run - beacon flood (create 1000 fake APs)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/mdk4 wlan1mon b -c 6

# Run - deauthentication attack on specific BSSID
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/mdk4 wlan1mon d -B AA:BB:CC:DD:EE:FF

# Run - SSID brute force against hidden network
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/mdk4 wlan1mon p -t AA:BB:CC:DD:EE:FF -f /wordlist.txt
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - mdk4 is available as a pre-built package in the Kali Linux ARM64 repositories. Installs directly via `apt install mdk4` with no compilation required.

### Hardware Constraints

- CPU: Extremely lightweight C binary. A single Cortex-A76 core handles all attack modes without measurable load
- RAM: Minimal memory usage (~10-30MB), negligible impact on 8GB available
- WiFi: Requires adapter with monitor mode and packet injection support. Alfa AWUS036AXML (mt76x2u) is fully compatible
- No GPU or additional hardware required

### Verdict

**COMPATIBLE** - mdk4 is one of the lightest tools in the WiFi exploit category. Pre-built ARM64 package available in Kali repos. Docker adds no benefit beyond isolation; native install is recommended for minimal overhead. The Alfa AWUS036AXML adapter provides full injection support required by all attack modes.
