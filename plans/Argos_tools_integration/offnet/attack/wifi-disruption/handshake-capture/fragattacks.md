# FragAttacks

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> 802.11 protocol design flaw exploitation toolkit targeting fundamental WiFi fragmentation and aggregation vulnerabilities (CVE-2020-24588 and related). Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Python scripts run on ARM64, but patched WiFi driver requires custom kernel module compilation for RPi5 aarch64 kernel

| Method               | Supported | Notes                                                                                             |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Attack scripts containerizable; patched WiFi driver must be on host kernel (not in container)     |
| **Native Install**   | PARTIAL   | Python scripts run fine; patched driver compilation for RPi5 kernel untested and may need porting |

---

## Tool Description

FragAttacks (Fragmentation and Aggregation Attacks) is a research toolkit developed by Mathy Vanhoef that exploits design flaws and implementation vulnerabilities in the IEEE 802.11 (WiFi) standard. The toolkit targets three categories of flaws: aggregation-based attacks (A-MSDU injection via the "is aggregated" flag), mixed key attacks (reassembling fragments encrypted under different keys), and fragment cache attacks (injecting fragments into a victim's fragment cache). These vulnerabilities affect virtually every WiFi device manufactured since 1997. The toolkit includes scripts for testing specific CVEs (CVE-2020-24586 through CVE-2020-26145) and requires a patched WiFi driver for reliable exploitation.

## Category

802.11 Protocol Exploitation / WiFi Design Flaw Research

## Repository

https://github.com/vanhoefm/fragattacks

---

## Docker Compatibility Analysis

### Can it run in Docker?

**PARTIAL** - The test scripts and Python components can run in Docker, but FragAttacks requires a patched WiFi driver compiled and loaded on the host kernel. The patched driver cannot run inside a container. The container can execute the attack scripts while the host provides the modified driver.

### Host OS-Level Requirements

- `--privileged` - Required for raw 802.11 frame manipulation and monitor mode
- `--net=host` - Required for direct wireless interface access
- `--device=/dev/bus/usb` - USB passthrough for WiFi adapter
- **Critical**: Host must run a patched WiFi driver (modified mac80211 or device-specific driver) that disables hardware-level frame aggregation/defragmentation. This is a kernel module change that cannot be containerized
- Host kernel modules: patched `cfg80211`, patched `mac80211`, adapter-specific driver with fragmentation patches

### Docker-to-Host Communication

- WiFi adapter with patched driver must be available on the host
- Container accesses the patched interface via `--net=host` and `--privileged`
- Test results and packet captures shared via volume mount: `-v /host/output:/output`
- The split architecture (patched driver on host, test scripts in container) adds complexity

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation (Required - cannot be containerized)

```bash
# Install kernel headers and build tools
sudo apt update
sudo apt install -y linux-headers-$(uname -r) build-essential git python3 python3-venv

# Clone FragAttacks (includes patched driver source)
git clone https://github.com/vanhoefm/fragattacks.git /opt/fragattacks
cd /opt/fragattacks

# Build and install patched driver (adapter-specific - see FragAttacks docs)
# WARNING: This replaces the standard WiFi driver on the host
cd research
./build.sh
sudo ./load-driver.sh
```

### Docker (attack scripts only)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    iw \
    wireless-tools \
    net-tools \
    tcpdump \
    python3-scapy \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/vanhoefm/fragattacks.git /opt/fragattacks

RUN cd /opt/fragattacks/research && \
    pip install --no-cache-dir -r requirements.txt

WORKDIR /opt/fragattacks/research
ENTRYPOINT ["python3", "fragattack.py"]
```

```bash
# Build
docker build -t argos/fragattacks .

# Run - test A-MSDU injection (requires patched driver on host)
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/fragattacks wlan1 --inject-test

# Run - test specific CVE against target AP
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/fragattacks wlan1 --ap-test

# Run - individual attack test
docker run --rm -it \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/fragattacks wlan1 ping --amsdu-inject
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 UNTESTED** - The Python attack scripts are architecture-independent. However, the patched WiFi driver must be compiled for the RPi5 kernel (aarch64). The mt76x2u driver patches may require manual adaptation for the RPi5 kernel version. This is a research-grade tool that has not been formally validated on ARM64/RPi5.

### Hardware Constraints

- CPU: Attack scripts are lightweight. No significant CPU requirements
- RAM: Minimal memory usage (~100-200MB). Well within 8GB
- WiFi: Requires an adapter supported by the patched FragAttacks driver. The Alfa AWUS036AXML (mt76x2u) may require custom driver patches not included in the upstream FragAttacks repository. Driver compatibility is the primary risk factor
- Kernel: RPi5 runs a custom kernel. Patching and rebuilding WiFi drivers requires matching kernel headers and may encounter kernel API differences

### Verdict

**PARTIAL** - FragAttacks is a research tool with significant setup complexity on any platform. On RPi5, the primary challenge is building the patched WiFi driver for the aarch64 kernel. The Python attack scripts will run without issues. Plan for substantial driver development effort. This tool is best suited for dedicated research setups rather than field deployment. Consider testing on x86_64 first and porting to RPi5 only if ARM64 deployment is specifically required.
