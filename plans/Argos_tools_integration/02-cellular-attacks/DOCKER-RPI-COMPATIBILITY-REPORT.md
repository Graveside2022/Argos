# Docker & RPi 5 Compatibility Report: Cellular Attack Tools

> **Generated**: 2026-02-04
> **Target Platform**: Raspberry Pi 5 Model B Rev 1.0 (4x ARM Cortex-A76 @ 2.4GHz, 8GB RAM)
> **OS**: Kali GNU/Linux Rolling 2025.4, Kernel 6.12.34+rpt-rpi-2712
> **Docker**: v27.5.1, Architecture: aarch64
> **Scope**: 19 tools across `imsi-catching/` (14) and `imsi-defense/` (5)

---

## Executive Summary

| Metric                  | Count |
| ----------------------- | ----- |
| Total tools evaluated   | 19    |
| Docker-capable on RPi 5 | **9** |
| Cannot run on RPi 5     | **7** |
| Partial / Conditional   | **3** |

**Bottom line**: 9 of 19 cellular tools can be containerized and deployed on the RPi 5 field kit. The 7 incompatible tools either require x86 multicore CPUs for real-time signal processing or are Android-only apps. A split deployment (RPi 5 + x86 field laptop) covers the full kill chain.

---

## Compatibility Matrix

### Docker-Capable on Kali RPi 5 (9 tools)

| #   | Tool                  | Category                 | Docker | RPi 5        | Hardware Needed            | Est. RAM |
| --- | --------------------- | ------------------------ | ------ | ------------ | -------------------------- | -------- |
| 1   | gr-gsm                | GSM Passive Capture      | YES    | YES          | RTL-SDR / HackRF           | ~500MB   |
| 2   | QCSuper               | Cellular Passive Sniffer | YES    | YES          | Qualcomm Android phone     | < 200MB  |
| 3   | Kalibrate-hackrf      | GSM Tower Scanner        | YES    | YES          | HackRF (already installed) | < 50MB   |
| 4   | Modmobmap             | Cell Tower Mapper        | YES    | YES          | USB cellular modem         | < 100MB  |
| 5   | Open5GS               | 4G/5G Core Network       | YES    | YES          | None (pure software)       | ~512MB   |
| 6   | IMSI-catcher (Oros42) | GSM IMSI Catcher         | YES    | YES          | RTL-SDR ($25)              | ~500MB   |
| 7   | Rayhunter             | IMSI Catcher Detector    | YES    | YES          | Orbic RC400L ($20)         | < 100MB  |
| 8   | srsRAN                | 5G/LTE Stack             | YES    | PASSIVE ONLY | USRP B200/B210             | ~1GB     |
| 9   | 5GBaseChecker         | 5G Security Audit        | YES    | YES          | 5G-capable modem           | ~500MB   |

### Cannot Run on RPi 5 (7 tools)

| #   | Tool                            | Reason                                                              | Alternative                  |
| --- | ------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| 1   | LTESniffer                      | Requires Intel i7 8-core for real-time LTE PDCCH decode at 20MHz BW | Run on x86 field laptop      |
| 2   | FALCON LTE                      | Same real-time x86 multicore requirement as LTESniffer              | Run on x86 field laptop      |
| 3   | OpenBTS                         | Real-time GSM baseband processing, x86-optimized DSP                | Use Open5GS + srsRAN instead |
| 4   | YateBTS                         | Complex telephony stack with real-time scheduling requirements      | Use Open5GS + srsRAN instead |
| 5   | IMSI-Catcher Detector (Android) | Android APK only, not a Linux application                           | Use Rayhunter on RPi 5       |
| 6   | AIMSICD                         | Android APK only, not a Linux application                           | Use Rayhunter on RPi 5       |
| 7   | GSM Evil                        | N/A - Already integrated into Argos natively                        | Already running on RPi 5     |

### Partial / Conditional (3 tools)

| #   | Tool             | Status                      | Limitation                                                     |
| --- | ---------------- | --------------------------- | -------------------------------------------------------------- |
| 1   | LTE-Cell-Scanner | Builds on ARM64             | Limited to 6 PRB bandwidth (1.4MHz), misses wider LTE carriers |
| 2   | Crocodile Hunter | Python works, srsLTE builds | ARM64 srsLTE not optimized, may miss cells during busy periods |
| 3   | CellScan         | No canonical implementation | Use Modmobmap as primary cell scanner instead                  |

---

## Host OS Dependencies for Docker Containers

### USB Device Passthrough

Most cellular tools require USB hardware access from inside Docker containers.

```bash
# SDR Devices (HackRF, RTL-SDR, USRP)
--device=/dev/bus/usb
--privileged

# Specific device passthrough (more secure, when device path is known)
--device=/dev/bus/usb/001/005

# USB cellular modem
--device=/dev/ttyUSB0
--device=/dev/ttyUSB1
```

### udev Rules (host-side, pre-container)

These rules must exist on the RPi 5 host for proper device permissions:

```bash
# /etc/udev/rules.d/99-sdr.rules

# HackRF One
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666"

# RTL-SDR
SUBSYSTEM=="usb", ATTR{idVendor}=="0bda", ATTR{idProduct}=="2838", MODE="0666"

# USRP B200/B210
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0002", MODE="0666"

# Orbic RC400L (Rayhunter)
SUBSYSTEM=="usb", ATTR{idVendor}=="05c6", MODE="0666"
```

```bash
# Reload after adding rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### Kernel Modules (host-side)

```bash
# Required for Open5GS core network
sudo modprobe tun     # TUN/TAP virtual network interface

# Verify
ls /dev/net/tun       # Should exist
```

### Network Configuration

```bash
# For tools needing raw network access
--net=host

# For Open5GS core network
--cap-add=NET_ADMIN
--device=/dev/net/tun

# For tools with web UIs
-p 8080:8080          # Rayhunter web UI
-p 9999:9999          # Open5GS WebUI
-p 27017:27017        # MongoDB (Open5GS dependency)
```

---

## Docker-to-Host Communication Requirements

### Volume Mounts

| Tool                  | Mount                                | Purpose              |
| --------------------- | ------------------------------------ | -------------------- |
| gr-gsm                | `-v $(pwd)/captures:/data`           | PCAP / cfile output  |
| QCSuper               | `-v $(pwd)/pcaps:/data`              | PCAP captures        |
| Kalibrate-hackrf      | None needed                          | Stdout output only   |
| Modmobmap             | `-v $(pwd)/logs:/opt/modmobmap/logs` | JSON cell tower data |
| Open5GS               | `-v $(pwd)/config:/opt/open5gs/etc`  | Configuration files  |
| IMSI-catcher (Oros42) | `-v $(pwd)/output:/data`             | Captured IMSI data   |
| Rayhunter             | `-v $(pwd)/pcaps:/data`              | PCAP forensic logs   |
| srsRAN                | `-v $(pwd)/config:/etc/srsran`       | Configuration files  |
| 5GBaseChecker         | `-v $(pwd)/results:/data`            | Analysis results     |

### Port Mappings

| Tool      | Port       | Protocol | Purpose                     |
| --------- | ---------- | -------- | --------------------------- |
| Open5GS   | 9999/tcp   | HTTP     | WebUI subscriber management |
| Open5GS   | 38412/sctp | SCTP     | NGAP (5G NR gNB connection) |
| Open5GS   | 36412/sctp | SCTP     | S1AP (4G eNB connection)    |
| Open5GS   | 2152/udp   | GTP-U    | User plane data tunnel      |
| Open5GS   | 27017/tcp  | MongoDB  | Subscriber database         |
| Rayhunter | 8080/tcp   | HTTP     | Alert dashboard             |
| srsRAN    | 2001/tcp   | HTTP     | Metrics / status            |

### Inter-Container Communication

For the Open5GS + srsRAN rogue base station setup, containers must communicate:

```yaml
# docker-compose networking
networks:
    cellular:
        driver: bridge
        ipam:
            config:
                - subnet: 10.45.0.0/16
```

---

## Deployment Priority Order

Ranked by operational value at NTC, ease of deployment, and hardware availability:

### Priority 1 - Deploy Immediately (hardware already in Argos kit)

| #   | Tool                  | Why                                        | Hardware           |
| --- | --------------------- | ------------------------------------------ | ------------------ |
| 1   | Kalibrate-hackrf      | GSM tower recon, zero new hardware         | HackRF (installed) |
| 2   | gr-gsm                | GSM passive capture, HackRF or $25 RTL-SDR | HackRF (installed) |
| 3   | IMSI-catcher (Oros42) | GSM IMSI catching with existing hardware   | HackRF / RTL-SDR   |

### Priority 2 - Deploy with Minimal Purchase ($20-50)

| #   | Tool      | Why                                          | Hardware Cost      |
| --- | --------- | -------------------------------------------- | ------------------ |
| 4   | Rayhunter | Best IMSI catcher detector, $20 device       | $20 (Orbic RC400L) |
| 5   | QCSuper   | Passive cellular sniffer, any Qualcomm phone | $0-30 (old phone)  |
| 6   | Modmobmap | Cell tower mapping with modem                | $30-50 (USB modem) |

### Priority 3 - Deploy for Advanced Operations

| #   | Tool          | Why                                 | Notes                                 |
| --- | ------------- | ----------------------------------- | ------------------------------------- |
| 7   | Open5GS       | Full rogue 4G/5G core network       | Pure software, needs srsRAN for radio |
| 8   | srsRAN        | Radio access for rogue base station | Needs USRP B200 ($500+)               |
| 9   | 5GBaseChecker | 5G security auditing                | Needs 5G modem ($100+)                |

### Requires x86 Field Laptop (not RPi 5)

| #   | Tool       | Why                          |
| --- | ---------- | ---------------------------- |
| 10  | LTESniffer | Real-time LTE eavesdropping  |
| 11  | FALCON LTE | LTE control channel analysis |

---

## Resource Budget on RPi 5

### Memory Allocation (8GB total, ~6.5GB available)

| Service                          | RAM        | Notes                       |
| -------------------------------- | ---------- | --------------------------- |
| Argos (SvelteKit + Node.js)      | 2048MB     | `--max-old-space-size=2048` |
| Kismet                           | ~500MB     | WiFi scanning               |
| Docker overhead                  | ~200MB     | Docker daemon               |
| **Available for cellular tools** | **~3.7GB** |                             |

### Recommended Concurrent Tool Limits

| Scenario            | Tools Running                     | Est. RAM |
| ------------------- | --------------------------------- | -------- |
| Passive GSM recon   | Kalibrate + gr-gsm                | ~550MB   |
| IMSI catching       | IMSI-catcher (Oros42) + Rayhunter | ~600MB   |
| Rogue base station  | Open5GS + srsRAN                  | ~1.5GB   |
| Full cellular suite | Open5GS + srsRAN + Rayhunter      | ~2.1GB   |

All scenarios fit within the ~3.7GB available headroom.

### CPU Considerations

The RPi 5's 4x Cortex-A76 cores handle:

- GSM decoding (gr-gsm): 1 core
- Cell scanning (Kalibrate): 1 core (burst, not continuous)
- Core network (Open5GS): 1 core
- srsRAN passive mode: 1-2 cores

Running all tools simultaneously is feasible but leaves minimal headroom for Argos itself. In practice, run 2-3 cellular tools alongside Argos.

---

## Quick Reference: Docker Run Commands

```bash
# Kalibrate-hackrf - Scan GSM towers
docker run --rm --privileged --device=/dev/bus/usb \
  argos/kalibrate-hackrf -s GSM900

# gr-gsm - Capture GSM traffic
docker run --rm --privileged --device=/dev/bus/usb \
  -v $(pwd)/captures:/data \
  argos/gr-gsm grgsm_livemon -f 945.2e6

# QCSuper - Passive cellular sniff
docker run --rm --privileged --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/data \
  argos/qcsuper --adb --pcap-dump /data/capture.pcap

# Open5GS - 4G/5G core network
docker compose -f open5gs-compose.yml up -d

# Rayhunter - IMSI catcher detection
docker run --rm --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/data -p 8080:8080 \
  argos/rayhunter

# IMSI-catcher (Oros42) - GSM IMSI catching
docker run --rm --privileged --device=/dev/bus/usb \
  -v $(pwd)/output:/data \
  argos/imsi-catcher --sniff

# Modmobmap - Cell tower mapping
docker run --rm --device=/dev/ttyUSB0 \
  -v $(pwd)/logs:/opt/modmobmap/logs \
  argos/modmobmap -m /dev/ttyUSB0
```

---

## File Inventory

### imsi-catching/ (14 tool files + 1 index)

| File                     | Tool                  | Docker    | RPi 5          |
| ------------------------ | --------------------- | --------- | -------------- |
| `gr-gsm.md`              | gr-gsm                | YES       | YES            |
| `gsm-evil.md`            | GSM Evil              | N/A       | N/A (built-in) |
| `ltesniffer.md`          | LTESniffer            | YES (x86) | NO             |
| `falcon-lte.md`          | FALCON LTE            | YES (x86) | NO             |
| `qcsuper.md`             | QCSuper               | YES       | YES            |
| `kalibrate-hackrf.md`    | Kalibrate-hackrf      | YES       | YES            |
| `lte-cell-scanner.md`    | LTE-Cell-Scanner      | YES       | PARTIAL        |
| `modmobmap.md`           | Modmobmap             | YES       | YES            |
| `openbts.md`             | OpenBTS               | DIFFICULT | NO             |
| `open5gs.md`             | Open5GS               | YES       | YES            |
| `yatebts.md`             | YateBTS               | DIFFICULT | NO             |
| `srsran.md`              | srsRAN                | YES       | PARTIAL        |
| `5gbasechecker.md`       | 5GBaseChecker         | YES       | PARTIAL        |
| `imsi-catcher-oros42.md` | IMSI-catcher (Oros42) | YES       | YES            |
| `imsi-catchers.md`       | _(category index)_    | -         | -              |

### imsi-defense/ (5 tool files + 1 index)

| File                               | Tool                  | Docker  | RPi 5   |
| ---------------------------------- | --------------------- | ------- | ------- |
| `rayhunter.md`                     | Rayhunter             | YES     | YES     |
| `crocodile-hunter.md`              | Crocodile Hunter      | YES     | PARTIAL |
| `imsi-catcher-detector-android.md` | IMSI Catcher Detector | NO      | NO      |
| `cellscan.md`                      | CellScan              | DEPENDS | DEPENDS |
| `aimsicd.md`                       | AIMSICD               | NO      | NO      |
| `imsi-defense.md`                  | _(category index)_    | -       | -       |
