# Wifite2

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Automated WiFi attack tool that chains WPA/WPA2 handshake capture, PMKID extraction, WPS Pixie Dust, and brute-force cracking into a single workflow. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python script with all companion tools available as ARM64 packages

| Method               | Supported | Notes                                                                                       |
| -------------------- | --------- | ------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; needs many companion tools in image |
| **Native Install**   | YES       | `apt install wifite` on Kali ARM64; strongly recommended; hashcat cracking CPU-only (slow)  |

---

## Tool Description

Wifite2 is a complete rewrite of the original Wifite, automating WiFi network auditing from scanning through cracking. It automatically detects nearby networks, selects optimal attack strategies (PMKID, WPA handshake capture via deauthentication, WPS Pixie Dust, WPS PIN brute force), captures the required key material, and invokes cracking tools (aircrack-ng, hashcat, john) against captured data. Wifite2 handles monitor mode management, channel hopping, and attack sequencing without manual intervention.

## Category

WiFi Automated Exploitation / WPA/WPA2/WPS Cracking

## Repository

https://github.com/derv82/wifite2

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Wifite2 runs in Docker with privileged access and host networking. It requires several companion tools (aircrack-ng, reaver, bully, hashcat, hcxdumptool) to be installed alongside it for full functionality.

### Host OS-Level Requirements

- `--privileged` - Required for monitor mode management, raw 802.11 injection, and interface control
- `--net=host` - Required for direct wireless interface access and channel hopping
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- Wifite2 manages monitor mode internally (calls airmon-ng), so host pre-configuration is optional

### Docker-to-Host Communication

- Wifite2 manages wireless interfaces directly; no IP-layer network ports required
- Captured handshakes and PMKID files shared via volume mount: `-v /host/output:/root/hs`
- Wordlists mounted from host: `-v /host/wordlists:/wordlists`
- Cracking results stored in Wifite2 session directory

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y wifite aircrack-ng reaver bully hcxdumptool hcxtools hashcat
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    wifite \
    aircrack-ng \
    reaver \
    bully \
    hcxdumptool \
    hcxtools \
    hashcat \
    pixiewps \
    wireless-tools \
    iw \
    net-tools \
    macchanger \
    tshark \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root/hs
ENTRYPOINT ["wifite"]
```

```bash
# Build
docker build -t argos/wifite2 .

# Run - automated scan and attack (interactive mode)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/handshakes:/root/hs \
  -v $(pwd)/wordlists:/wordlists \
  argos/wifite2

# Run - target specific BSSID with PMKID attack only
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/handshakes:/root/hs \
  argos/wifite2 -b AA:BB:CC:DD:EE:FF --pmkid

# Run - WPA handshake capture via deauth
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/handshakes:/root/hs \
  argos/wifite2 -b AA:BB:CC:DD:EE:FF --no-pmkid --no-wps

# Run - WPS Pixie Dust attack
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/handshakes:/root/hs \
  argos/wifite2 --wps-only --pixie
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Wifite2 is a Python script available in Kali ARM64 repositories. All companion tools (aircrack-ng, reaver, bully, hcxdumptool, hashcat) are also available as ARM64 pre-built packages.

### Hardware Constraints

- CPU: Scanning and injection are lightweight. Hashcat cracking is CPU-bound on RPi5 (no GPU) and will be slow for large wordlists; consider offloading cracking to a more powerful machine
- RAM: ~100-200MB during operation, well within 8GB
- WiFi: Requires adapter with monitor mode and packet injection. Alfa AWUS036AXML (mt76x2u) provides full support
- Storage: Captured handshakes and PMKID files are small (~1-10KB each). Wordlists may require significant storage (rockyou.txt is ~140MB)

### Verdict

**COMPATIBLE** - Wifite2 runs natively on RPi5 with full ARM64 support. All dependent tools are available in Kali repos. The only limitation is hashcat cracking speed (CPU-only, no GPU on RPi5). For practical use, capture handshakes on RPi5 and crack on a GPU-equipped machine. Native install strongly recommended over Docker.
