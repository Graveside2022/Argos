# Ettercap

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Network man-in-the-middle framework providing ARP spoofing, DNS spoofing, credential sniffing, and traffic manipulation on LAN segments. Enables interception of all unencrypted network communications. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pre-built ARM64 package in Kali repos; lightweight C binary

| Method               | Supported | Notes                                                                                           |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `kalilinux/kali-rolling` base; requires `--privileged` and `--net=host` for ARP/MITM operations |
| **Native Install**   | YES       | `apt install ettercap-text-only`; recommended over Docker for reduced overhead                  |

---

## Tool Description

Ettercap is a mature network MITM framework for LAN-based attacks. It performs ARP cache poisoning to position the attacker between communicating hosts, enabling real-time interception, modification, and logging of network traffic. Ettercap supports DNS spoofing via plugin, SSL stripping for HTTPS downgrade, live connection filtering with custom etterfilter scripts, and credential sniffing for protocols including HTTP, FTP, Telnet, SSH, IMAP, and others. It provides text-mode, curses, and GTK interfaces, with a plugin architecture for extensibility.

## Category

Network MITM / ARP Spoofing / Credential Sniffing / Traffic Manipulation

## Repository

https://github.com/Ettercap/ettercap

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Ettercap runs in Docker with privileged access and host networking. The text-mode interface (`ettercap-text-only` package) requires no GUI and is ideal for containerized deployment.

### Host OS-Level Requirements

- `--privileged` - Required for ARP cache poisoning, raw socket operations, and promiscuous mode
- `--net=host` - Required for direct access to host network interfaces and LAN segment for ARP spoofing
- No USB device passthrough required (network-only tool)
- Host kernel modules: Standard networking stack; `ip_forward` must be enabled on host for traffic forwarding
- Requires being on the same Layer 2 network segment as targets

### Docker-to-Host Communication

- Full host network stack access via `--net=host` for ARP operations and traffic interception
- IP forwarding must be enabled on host: `echo 1 > /proc/sys/net/ipv4/ip_forward`
- Ettercap log files and captured data via volume mount: `-v /host/ettercap:/data`
- Custom filter scripts via volume mount: `-v /host/filters:/filters`
- DNS spoofing configuration via `etter.dns` file: mount custom file into container

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt-get update && sudo apt-get install -y ettercap-text-only
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    ettercap-text-only \
    net-tools \
    iproute2 \
    iptables \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data /filters

WORKDIR /data

ENTRYPOINT ["ettercap"]
CMD ["--help"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/ettercap .

# Enable IP forwarding on host (required for MITM)
sudo sysctl -w net.ipv4.ip_forward=1

# Run - ARP spoofing entire subnet (text mode)
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/ettercap-data:/data \
  argos/ettercap -T -q -M arp:remote /// ///

# Run - ARP spoof between specific targets
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/ettercap-data:/data \
  argos/ettercap -T -q -M arp:remote /192.168.1.1// /192.168.1.100//

# Run - DNS spoofing (requires custom etter.dns)
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/ettercap-data:/data \
  -v $(pwd)/etter.dns:/etc/ettercap/etter.dns \
  argos/ettercap -T -q -M arp:remote -P dns_spoof /// ///

# Run - with custom filter script
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/ettercap-data:/data \
  -v $(pwd)/filters:/filters \
  argos/ettercap -T -q -M arp:remote -F /filters/my_filter.ef /// ///

# Run - passive sniffing only (no ARP spoofing)
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/ettercap-data:/data \
  argos/ettercap -T -q -i eth0

# Compile a custom filter (on host or in container):
# etterfilter my_filter.txt -o my_filter.ef
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Ettercap is available as a pre-built package in the Kali Linux ARM64 repositories. Installs directly via `apt install ettercap-text-only` with no compilation required.

### Hardware Constraints

- CPU: Lightweight C application; ARP spoofing and packet interception use minimal CPU resources. Cortex-A76 handles full subnet MITM operations effortlessly
- RAM: ~50-200MB depending on number of tracked connections and plugin usage; negligible on 8GB system
- Hardware: No specialized hardware required. Standard Ethernet interface for wired LAN attacks. WiFi interface for wireless segment attacks (less reliable due to 802.11 frame handling). Wired Ethernet connection to target LAN is recommended for stable MITM
- Storage: Minimal (<50MB for binary and configuration files). Log files grow with intercepted traffic volume

### Verdict

**COMPATIBLE** - Ettercap runs natively on Kali RPi 5 ARM64 with pre-built package in Kali repos. Native install is recommended over Docker for reduced overhead and simpler network stack interaction. The tool is extremely lightweight and proven on ARM platforms. Text-mode operation is ideal for headless field deployment.
