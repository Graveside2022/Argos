# hcxdumptool

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> PMKID and WPA handshake capture tool that extracts key material from WPA/WPA2/WPA3 networks without requiring client deauthentication. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Lightweight C binary, pre-built ARM64 package in Kali repos

| Method               | Supported | Notes                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; minimal image footprint      |
| **Native Install**   | YES       | `apt install hcxdumptool hcxtools` on Kali ARM64; recommended for capture operations |

---

## Tool Description

hcxdumptool is a purpose-built tool for capturing PMKID hashes and EAPOL handshakes from WPA/WPA2 networks. Unlike traditional deauthentication-based capture (aireplay-ng + airodump-ng), hcxdumptool can extract PMKID values directly from the access point's first EAPOL message without disconnecting any clients, making it a stealthier capture method. It also captures full 4-way handshakes via active and passive techniques. Output is written in pcapng format for processing by hcxtools (hcxpcapngtool) into hashcat/john-compatible hash formats.

## Category

WiFi Key Material Capture / PMKID Harvesting

## Repository

https://github.com/ZerBea/hcxdumptool

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - hcxdumptool runs well in Docker with privileged access. It is a lightweight C binary that operates directly on the WiFi adapter in monitor mode.

### Host OS-Level Requirements

- `--privileged` - Required for raw 802.11 frame handling and monitor mode interface control
- `--net=host` - Recommended for direct wireless interface access (avoids network namespace isolation issues)
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- hcxdumptool manages its own monitor mode internally; no pre-configuration required

### Docker-to-Host Communication

- No IP-layer network ports required (operates at raw 802.11 layer)
- Captured pcapng files shared via volume mount: `-v /host/captures:/captures`
- Processing with hcxtools (hcxpcapngtool) can run in same or separate container

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y hcxdumptool hcxtools
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    hcxdumptool \
    hcxtools \
    wireless-tools \
    iw \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /captures
ENTRYPOINT ["hcxdumptool"]
```

```bash
# Build
docker build -t argos/hcxdumptool .

# Run - capture PMKID and handshakes from all nearby APs
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/hcxdumptool -i wlan1 -o /captures/capture.pcapng

# Run - target specific BSSID
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/hcxdumptool -i wlan1 -o /captures/capture.pcapng \
  --filterlist_ap=AA:BB:CC:DD:EE:FF --filtermode=2

# Run - passive capture only (no active probing)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/hcxdumptool -i wlan1 -o /captures/capture.pcapng --active_beacon --passive

# Post-processing - convert captures to hashcat format
docker run --rm \
  -v $(pwd)/captures:/captures \
  --entrypoint hcxpcapngtool \
  argos/hcxdumptool -o /captures/hashes.22000 /captures/capture.pcapng
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - hcxdumptool and hcxtools are available as pre-built packages in the Kali Linux ARM64 repositories. Both install via `apt` with no compilation required.

### Hardware Constraints

- CPU: Extremely lightweight C binary. PMKID/handshake capture is computationally trivial for Cortex-A76 cores
- RAM: Minimal memory usage (~10-20MB), negligible impact on 8GB
- WiFi: Requires adapter with monitor mode support. Alfa AWUS036AXML (mt76x2u) is fully compatible. hcxdumptool has its own driver compatibility requirements but works well with mt76x2u
- Storage: pcapng capture files are typically small (1-50MB depending on capture duration)

### Verdict

**COMPATIBLE** - hcxdumptool is an ideal tool for RPi5 deployment. Lightweight, pre-built for ARM64, and provides stealthier PMKID capture compared to deauthentication-based methods. Native install recommended. Pair with hashcat on a GPU-equipped machine for cracking the captured hashes.
