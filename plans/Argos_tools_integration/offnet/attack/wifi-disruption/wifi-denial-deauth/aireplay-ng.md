# aireplay-ng

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Targeted deauthentication, fake authentication, and packet injection tool from the aircrack-ng suite; enables forced client disconnection and WPA handshake capture. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Full aircrack-ng suite available as pre-built ARM64 packages in Kali repos

| Method               | Supported | Notes                                                                          |
| -------------------- | --------- | ------------------------------------------------------------------------------ |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; lightweight C binaries |
| **Native Install**   | YES       | `apt install aircrack-ng` on Kali ARM64; strongly recommended over Docker      |

---

## Tool Description

aireplay-ng is the packet injection component of the aircrack-ng suite. It provides multiple attack modes including targeted deauthentication (forcing specific clients off a network to capture WPA handshakes), fake authentication with access points, interactive packet replay, ARP request replay for WEP IV generation, chopchop and fragmentation attacks against WEP, and cafe-latte client-side WEP attacks. It is the foundational injection tool upon which many higher-level WiFi attack tools depend.

## Category

WiFi Packet Injection / Deauthentication

## Repository

https://github.com/aircrack-ng/aircrack-ng

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - aireplay-ng and the full aircrack-ng suite run cleanly in Docker with privileged access and host networking. The suite is composed of lightweight C binaries with minimal dependencies.

### Host OS-Level Requirements

- `--privileged` - Required for raw 802.11 frame injection and monitor mode interface control
- `--net=host` - Required for direct access to host wireless interfaces
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- WiFi adapter must support packet injection (Alfa AWUS036AXML confirmed compatible)

### Docker-to-Host Communication

- Monitor mode interface configured on host or within privileged container
- Capture files (`.cap`, `.pcap`) shared via volume mount: `-v /host/captures:/captures`
- No TCP/UDP port mappings required (operates at raw 802.11 layer)

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y aircrack-ng
# This installs the complete suite: airmon-ng, airodump-ng, aireplay-ng, aircrack-ng, etc.
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    aircrack-ng \
    wireless-tools \
    iw \
    net-tools \
    ethtool \
    pciutils \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /captures
ENTRYPOINT ["aireplay-ng"]
```

```bash
# Build
docker build -t argos/aireplay-ng .

# Prepare monitor mode on host
sudo airmon-ng start wlan1

# Run - targeted deauthentication (capture WPA handshake)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/aireplay-ng --deauth 10 -a AA:BB:CC:DD:EE:FF -c 11:22:33:44:55:66 wlan1mon

# Run - broadcast deauthentication
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/aireplay-ng --deauth 0 -a AA:BB:CC:DD:EE:FF wlan1mon

# Run - fake authentication with target AP
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/aireplay-ng --fakeauth 0 -e "TargetSSID" -a AA:BB:CC:DD:EE:FF wlan1mon

# Run - injection test (verify adapter capability)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  --entrypoint aireplay-ng \
  argos/aireplay-ng --test wlan1mon
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - The complete aircrack-ng suite (including aireplay-ng) is available as a pre-built package in the Kali Linux ARM64 repositories. Installs via `apt install aircrack-ng`. All tools in the suite are compiled for aarch64.

### Hardware Constraints

- CPU: Lightweight C binaries. Injection and deauthentication consume negligible CPU. The aircrack-ng cracking component is CPU-bound but aireplay-ng itself is not
- RAM: Minimal memory usage (~10-20MB for aireplay-ng), negligible impact on 8GB available
- WiFi: Requires adapter with monitor mode and packet injection. Alfa AWUS036AXML (mt76x2u) provides full support including per-channel injection
- Storage: Capture files can grow large during extended sessions; plan for periodic cleanup

### Verdict

**COMPATIBLE** - aireplay-ng is a core tool with first-class ARM64 support. Pre-built in Kali repos, extremely lightweight, and the Alfa AWUS036AXML adapter is fully compatible with all injection modes. Native install is strongly recommended over Docker for this tool.
