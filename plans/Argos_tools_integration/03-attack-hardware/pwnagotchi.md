# Pwnagotchi

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> AI-powered autonomous WiFi handshake capture device using deep reinforcement learning to optimize deauthentication timing and maximize WPA/WPA2 credential harvesting. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: NO** — requires dedicated RPi Zero W with custom OS image; RPi 5 serves as data retrieval and analysis host only

| Method               | Supported | Notes                                                                        |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| **Docker Container** | NO        | Needs dedicated hardware, monitor-mode WiFi, GPIO for e-ink, USB gadget mode |
| **Native Install**   | NO        | Designed for RPi Zero W only; RPi 5 can analyze captured handshakes          |

---

## Tool Description

Pwnagotchi is an AI-driven, Raspberry Pi Zero W-based device that autonomously captures WPA/WPA2 handshakes from nearby WiFi networks. It uses a bettercap agent combined with a deep reinforcement learning model (A2C - Advantage Actor-Critic) that learns from its environment to optimize attack parameters such as deauthentication timing, channel hopping strategy, and target selection. The device operates passively until it identifies capturable handshakes, then actively deauthenticates clients to force re-authentication and capture the resulting EAPOL exchanges. It features an e-ink display showing a Tamagotchi-style face reflecting its mood (based on capture success rate), mesh networking for peer discovery, and plugin support for extended functionality including GPS logging, Telegram notifications, and hashcat integration.

## Category

Autonomous WiFi Handshake Capture / AI-Driven Wireless Exploitation

## Repository

https://github.com/evilsocket/pwnagotchi

---

## Docker Compatibility Analysis

### Can it run in Docker?

**NO** - Pwnagotchi is designed to run as the primary operating system on a dedicated Raspberry Pi Zero W (or Zero 2 W). It requires exclusive control over a WiFi adapter in monitor mode, a custom bettercap installation, real-time AI inference, and direct hardware access to GPIO (for the e-ink display) and USB gadget mode (for host tethering). These requirements make Docker containerization on the RPi5 impractical and architecturally inappropriate. The Pwnagotchi runs on its own dedicated hardware and communicates results to external systems.

### Host OS-Level Requirements

Not applicable for Docker. Pwnagotchi requirements on its own RPi Zero W:

- Dedicated Raspberry Pi Zero W or Zero 2 W (BCM2835/BCM2710 SoC)
- Custom Pwnagotchi OS image (based on Raspberry Pi OS Lite)
- Nexmon patched kernel for monitor mode on the onboard Broadcom WiFi chip
- GPIO access for Waveshare e-ink display (SPI bus)
- USB gadget mode for host PC tethering (`dwc2` and `g_ether` kernel modules)

### Docker-to-Host Communication

Not applicable. The RPi5 can interact with a Pwnagotchi via:

- **USB RNDIS/Ethernet gadget**: When connected via USB to the RPi5, the Pwnagotchi exposes a network interface for SSH access and data transfer
- **Bluetooth tethering**: For internet sharing from RPi5 to Pwnagotchi
- **Shared storage**: SD card or USB transfer of captured handshake files (`.pcap`)
- **REST API**: Pwnagotchi exposes a web UI and API on `http://10.0.0.2:8080` when USB-tethered
- **Mesh networking**: Pwnagotchi devices discover each other over WiFi; RPi5 could run a mesh peer

---

## Install Instructions (Docker on Kali RPi 5)

### Not a Docker Deployment - Standalone Device

Pwnagotchi runs on its own dedicated Raspberry Pi Zero W. The RPi5 serves as a data collection and analysis host.

### Pwnagotchi Device Setup (on RPi Zero W)

```bash
# Download the latest Pwnagotchi image
wget https://github.com/evilsocket/pwnagotchi/releases/latest/download/pwnagotchi-raspios-lite-latest.img.xz

# Flash to micro SD card (on RPi5)
xzcat pwnagotchi-raspios-lite-latest.img.xz | sudo dd of=/dev/mmcblk0 bs=4M status=progress

# Mount boot partition and configure
sudo mount /dev/mmcblk0p1 /mnt
cat > /mnt/config.toml << 'EOF'
main.name = "argos-pwn"
main.lang = "en"
main.whitelist = [
  "your_home_network_ssid"
]

main.plugins.grid.enabled = true
main.plugins.grid.report = true

ui.display.enabled = true
ui.display.type = "waveshare_2"

bettercap.handshakes = "/root/handshakes"
EOF
sudo umount /mnt

# Insert SD into RPi Zero W and power on
```

### RPi5 Integration: Receiving Captured Handshakes

```bash
# When Pwnagotchi is connected to RPi5 via USB cable:
# It appears as a USB Ethernet gadget at 10.0.0.2

# SSH into Pwnagotchi
ssh pi@10.0.0.2

# Pull captured handshakes to RPi5 for analysis
mkdir -p /home/kali/pwnagotchi-captures
scp pi@10.0.0.2:/root/handshakes/*.pcap /home/kali/pwnagotchi-captures/

# Automated capture retrieval script for Argos
cat > /home/kali/scripts/pull-pwnagotchi.sh << 'SCRIPT'
#!/bin/bash
DEST="/home/kali/pwnagotchi-captures"
SRC="pi@10.0.0.2:/root/handshakes/"
mkdir -p "$DEST"
rsync -avz --progress "$SRC" "$DEST/" 2>/dev/null
echo "$(date): Synced $(ls -1 $DEST/*.pcap 2>/dev/null | wc -l) handshake files"
SCRIPT
chmod +x /home/kali/scripts/pull-pwnagotchi.sh
```

### RPi5 Integration: Pwnagotchi API Access

```bash
# Access Pwnagotchi web UI and REST API (when USB-tethered)
# Web UI:  http://10.0.0.2:8080
# API endpoint examples:
curl http://10.0.0.2:8080/api/v1/status
curl http://10.0.0.2:8080/api/v1/mesh/peers
curl http://10.0.0.2:8080/api/v1/handshakes

# Argos could poll these endpoints for status display
```

### Docker Container for Handshake Analysis on RPi5

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    hashcat \
    aircrack-ng \
    hcxtools \
    hcxdumptool \
    wireshark-common \
    tshark \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /handshakes
ENTRYPOINT ["/bin/bash"]
```

```bash
# Analyze captured handshakes on RPi5
docker build -t argos/handshake-cracker -f Dockerfile.cracker .
docker run -it --rm \
  -v /home/kali/pwnagotchi-captures:/handshakes \
  argos/handshake-cracker

# Inside container:
# hcxpcapngtool -o hash.22000 *.pcap
# hashcat -m 22000 hash.22000 /wordlists/rockyou.txt
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**NOT APPLICABLE (SEPARATE DEVICE)** - Pwnagotchi runs on its own RPi Zero W, not on the RPi5. The RPi5 role is limited to data retrieval, handshake analysis, and Argos dashboard integration. The Pwnagotchi OS image is 32-bit ARM (armhf) for the Zero W's BCM2835 SoC, which is a different platform entirely from the RPi5's Cortex-A76.

### Hardware Constraints

- **RPi5 role**: No significant resource consumption on the RPi5 itself. Handshake analysis (hashcat/aircrack-ng) is CPU-intensive but feasible on the Cortex-A76.
- **Pwnagotchi hardware**: Requires a dedicated Raspberry Pi Zero W (~$10-15) or Zero 2 W (~$15), a micro SD card (8GB+), a Waveshare e-ink display (~$15-20), and a battery HAT or power bank for portable operation.
- **Connectivity**: USB cable between RPi5 and Pwnagotchi for data transfer and tethering. The Pwnagotchi uses its onboard WiFi exclusively for attacks.
- **RAM**: Handshake analysis on RPi5 uses minimal RAM unless running large hashcat dictionary attacks.

### Verdict

**COMPATIBLE (AS COMPANION DEVICE)** - Pwnagotchi cannot and should not run in Docker on the RPi5. It is a standalone device with its own dedicated hardware. The RPi5 integrates with Pwnagotchi as a data collection host: retrieving captured handshakes via USB tethering, analyzing them with hashcat/aircrack-ng, and displaying results in the Argos dashboard. Integration value with Argos is LOW because Pwnagotchi is designed for autonomous, long-term passive operation rather than real-time coordinated attacks. However, its captured handshakes feed into the broader Argos intelligence pipeline.
