# Argos Deployment Compatibility Matrix

> **Target**: Raspberry Pi 5 Model B Rev 1.0 (4x ARM Cortex-A76, 8GB RAM)
> **OS**: Kali GNU/Linux Rolling 2025.4, Kernel 6.12.34+rpt-rpi-2712
> **Docker**: v27.5.1 (aarch64)
> **Scope**: All 15 categories, 120 individual tools
> **Generated**: 2026-02-04
> **Last Verified**: 2026-02-05 (full audit of all 120 tools against live system)

---

## Executive Summary

| Metric                     | Count   | Percentage |
| -------------------------- | ------- | ---------- |
| **Total Tools Documented** | **120** | 100%       |
| **COMPATIBLE with RPi 5**  | **110** | 91.7%      |
| **PARTIAL Compatibility**  | **10**  | 8.3%       |

| Installation Status     | Count  | Notes                                           |
| ----------------------- | ------ | ----------------------------------------------- |
| **INSTALLED (Native)**  | **21** | Available as system binaries or Python packages |
| **INSTALLED (Docker)**  | **3**  | Running as Docker containers                    |
| **BUILT-IN (Argos)**    | **6**  | Integrated into Argos application               |
| **NOT INSTALLED**       | **89** | Requires installation                           |
| **N/A (API/companion)** | **1**  | WiGLE (web API only)                            |

| Docker Status                      | Count |
| ---------------------------------- | ----- |
| Docker YES (full containerization) | 97    |
| Docker PARTIAL (GUI/special needs) | 13    |
| Docker BUILD/FLASH ONLY (firmware) | 6     |
| Docker NO / N/A                    | 4     |

| Risk Classification            | Count |
| ------------------------------ | ----- |
| HIGH RISK - EXTREME            | 3     |
| HIGH RISK - SENSITIVE SOFTWARE | 57    |
| MODERATE RISK                  | 19    |
| LOW RISK                       | 41    |

| Install Instruction Quality             | Count |
| --------------------------------------- | ----- |
| CORRECT (no issues)                     | 52    |
| MOSTLY CORRECT (minor issues)           | 48    |
| HAS ISSUES (will fail without fixes)    | 14    |
| BROKEN (critical errors, will not work) | 6     |

---

## Currently Installed Tools (Verified 2026-02-05)

### Native System Installs

| Tool              | Version        | Category        | Binary/Package                                              |
| ----------------- | -------------- | --------------- | ----------------------------------------------------------- |
| Kismet            | 2025.09.0      | 14-wardriving   | `kismet` + ALL 20 capture modules                           |
| aircrack-ng suite | 1.7            | 06-wifi         | `aircrack-ng`, `aireplay-ng`, `airodump-ng`, `airmon-ng`    |
| hashcat           | 7.1.2          | 06-wifi         | `hashcat` + `hashcat-utils` + `hashcat-data`                |
| wifite2           | 2.8.1          | 06-wifi         | `wifite`                                                    |
| hcxdumptool       | 7.0.0          | 06-wifi         | `hcxdumptool` + `hcxtools` (hcxpcapngtool)                  |
| scapy             | 2.6.1          | 06-wifi         | `python3-scapy` + `scapy` CLI                               |
| ettercap          | 0.8.3.1        | 11-network      | `ettercap-graphical` + `ettercap-common`                    |
| responder         | 3.2.0.0        | 11-network      | `responder`                                                 |
| wireshark/tshark  | 4.6.2          | 15-counter-atak | `wireshark` + `tshark`                                      |
| HackRF tools      | 2024.02.1      | 08-sdr          | `hackrf` + `libhackrf0` + `libhackrf-dev`                   |
| GNU Radio         | 3.10.12.0      | 08-sdr          | `gnuradio` + `gnuradio-dev` + `gr-osmosdr`                  |
| gr-gsm            | (source build) | 02-cellular     | `grgsm_decode` + `grgsm_livemon` (Python module incomplete) |
| SoapySDR          | 0.8.1-7        | 08-sdr          | `soapysdr-tools` + ALL 16 hardware modules                  |
| BlueZ             | 5.84           | 05-bluetooth    | `bluetoothctl`, `hciconfig`, `hcitool`, `gatttool`, `btmon` |
| nmap              | 7.98           | (general)       | `nmap` + `zenmap`                                           |
| masscan           | 1.3.2          | (general)       | `masscan`                                                   |
| reaver            | 1.6.6          | 06-wifi         | `reaver` + `bully`                                          |
| impacket          | 0.13.0         | (general)       | Python package                                              |
| paho-mqtt         | 2.1.0          | 04-iot          | Python package                                              |
| pyserial          | 3.5            | (general)       | Python package                                              |
| pyshark           | 0.6            | (general)       | Python package                                              |

### Docker Container Installs

| Tool         | Image                                                               | Category    |
| ------------ | ------------------------------------------------------------------- | ----------- |
| BetterCAP    | `bettercap/bettercap:latest`                                        | 11-network  |
| OpenWebRX    | `jketterl/openwebrx-hackrf:stable` + `slechev/openwebrxplus:latest` | 08-sdr      |
| IMSI-catcher | `atomicpowerman/imsi-catcher:latest` (amd64, QEMU emulated)         | 02-cellular |

### Built-in Argos Modules (No Separate Install)

| Tool            | Category       | Access                         |
| --------------- | -------------- | ------------------------------ |
| Drone ID        | 01-counter-uas | `/drone-id` route              |
| GSM Evil        | 02-cellular    | `/gsm-evil` route              |
| BTLE Scanner    | 05-bluetooth   | Built-in BLE scanning          |
| HackRF Spectrum | 08-sdr         | HackRF spectrum analyzer view  |
| RF Emitter      | 08-sdr         | HackRF signal emission control |
| USRP Sweep      | 08-sdr         | USRP frequency sweep           |

### Hardware Detected

| Device                                                | Status                 |
| ----------------------------------------------------- | ---------------------- |
| HackRF One (serial: 000000000000000066a062dc22361c9f) | Connected, operational |
| WiFi adapter (monitor+injection capable)              | Available              |
| Bluetooth adapter (BlueZ 5.84)                        | Available              |
| GPS module                                            | Available              |

---

## CRITICAL Install Instruction Errors (6 BROKEN tools)

These tools have install instructions that **WILL FAIL** without fixes:

| Tool                  | Category        | Error                                                             | Fix Required                                          |
| --------------------- | --------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| gr-gsm                | 02-cellular     | `apt install gr-gsm` does NOT exist in Kali ARM64 repos           | Must build from source: `github.com/ptrkrysik/gr-gsm` |
| IMSI-catcher (Oros42) | 02-cellular     | Depends on `apt install gr-gsm` which fails                       | Same gr-gsm source build required                     |
| Crocodile Hunter      | 02-cellular     | `apt install srsran` does NOT exist in Kali ARM64 repos           | Must build srsRAN_4G from source                      |
| Open5GS               | 02-cellular     | Docker images `open5gs/open5gs:latest` do NOT exist on Docker Hub | Must build from Open5GS source repo Dockerfiles       |
| DroneRF               | 01-counter-uas  | `pip install tensorflow-cpu` has NO ARM64 wheels                  | Use `tflite-runtime` or `tensorflow-aarch64`          |
| ATAKRR                | 15-counter-atak | `pip install tensorflow-lite-runtime` wrong package name          | Correct name: `tflite-runtime`                        |

## Significant Install Issues (14 tools with errors)

| Tool                      | Category        | Issue                                                                           |
| ------------------------- | --------------- | ------------------------------------------------------------------------------- |
| RF-Drone-Detection        | 01-counter-uas  | `python:3.11-slim` + `apt install gnuradio` causes Python path mismatch         |
| DroneSecurity             | 01-counter-uas  | Pinned old numpy/scipy versions lack ARM64 wheels; missing build deps           |
| SDR-Based-Attacks         | 01-counter-uas  | NASA CDDIS requires authentication; stale ephemeris URL                         |
| GPS-SDR-SIM               | 01-counter-uas  | CDDIS auth required; ephemeris download URL format incorrect                    |
| ESP32 WiFi Drone Disabler | 01-counter-uas  | `espressif/idf:latest` ARM64 tag uncertain; project may use Arduino not ESP-IDF |
| QCSuper                   | 02-cellular     | Docker missing `git` package; `pip install qcsuper` not on PyPI                 |
| Modmobmap                 | 02-cellular     | Docker missing `git` package                                                    |
| EAPHammer                 | 06-wifi         | hostapd-mana build not explicit in Dockerfile; error suppression masks failures |
| FragAttacks               | 06-wifi         | `linux-headers-$(uname -r)` unavailable for RPi 5 kernel; driver porting needed |
| FISSURE                   | 08-sdr          | Interactive installer targets x86_64; OOT modules may fail on ARM64             |
| Airgeddon                 | 06-wifi         | Official Docker image `v1s1t0r1sh3r3/airgeddon` may lack ARM64 manifest         |
| nRF52 Attack Toolkit      | 05-bluetooth    | ARM GCC download URL likely broken for ARM64 host                               |
| Meshtastic Freq Calc      | 15-counter-atak | Dockerfile missing `git` package before `git clone`                             |
| Rayhunter                 | 02-cellular     | Docker build stage likely missing `git` package                                 |

## Recurring Issues Across Multiple Files

| Issue                                         | Affected Count | Description                                                                   |
| --------------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| **PEP 668 pip restriction**                   | ~15 tools      | `pip3 install` without `--break-system-packages` or venv fails on Kali 2025.4 |
| **Missing `git` in slim Docker images**       | ~8 tools       | `python:3.11-slim` and `debian:bookworm-slim` don't include `git`             |
| **`docker-compose` v1 syntax**                | ~3 tools       | Should use `docker compose` (v2 plugin) on Docker v27.5.1                     |
| **`-v /dev/bus/usb` instead of `--device`**   | ~5 tools       | Non-standard volume mount for USB; works with `--privileged`                  |
| **`setup.py install` deprecated**             | ~4 tools       | Should use `pip install .` instead                                            |
| **Error suppression `2>/dev/null \|\| true`** | ~12 tools      | Masks real build failures silently                                            |
| **`libncurses5-dev` naming**                  | ~3 tools       | Should be `libncurses-dev` on modern Debian/Kali                              |
| **`master` branch assumption**                | ~3 tools       | Many repos renamed default branch to `main`                                   |

---

## RPi 5 Compatibility by Category

| #   | Category               | Total   | Compatible | Partial |
| --- | ---------------------- | ------- | ---------- | ------- |
| 01  | Counter-UAS            | 12      | 10         | 2       |
| 02  | Cellular Attacks       | 11      | 8          | 3       |
| 03  | Attack Hardware        | 8       | 8          | 0       |
| 04  | IoT Exploits           | 10      | 10         | 0       |
| 05  | Bluetooth Exploits     | 14      | 14         | 0       |
| 06  | WiFi Exploits          | 15      | 13         | 2       |
| 07  | RF Geolocation         | 3       | 3          | 0       |
| 08  | SDR Frameworks         | 9       | 8          | 1       |
| 09  | Aircraft/Ship Tracking | 4       | 4          | 0       |
| 10  | RFID/Sub-GHz           | 5       | 5          | 0       |
| 11  | Network Recon          | 7       | 7          | 0       |
| 12  | EM Eavesdropping       | 1       | 0          | 1       |
| 13  | Keyboard/Mouse Attacks | 1       | 1          | 0       |
| 14  | Wardriving             | 4       | 4          | 0       |
| 15  | Counter-ATAK/TAK       | 16      | 15         | 1       |
|     | **TOTALS**             | **120** | **110**    | **10**  |

\*One additional tool (pwnagotchi) is compatible only as a companion device, not a direct RPi5 application.

---

## Tools with PARTIAL Compatibility (10)

| Tool                 | Category            | Limitation                                                  | Workaround                            |
| -------------------- | ------------------- | ----------------------------------------------------------- | ------------------------------------- |
| DroneRF              | 01-counter-uas      | Python ML pipeline works; MATLAB/LabVIEW require x86        | Use Python pipeline only              |
| ESP32 Drone Disabler | 01-counter-uas      | RPi5 builds/flashes firmware; attack runs on ESP32          | Normal workflow                       |
| LTE-Cell-Scanner     | 02-cellular         | Limited to 1.4 MHz bandwidth on ARM64                       | Use for basic cell detection only     |
| srsRAN               | 02-cellular         | Passive sniffer mode only; active BTS needs x86             | Run passive mode on RPi5              |
| Crocodile Hunter     | 02-cellular         | srsRAN dependency is CPU-heavy on ARM64                     | Functional but slow                   |
| FragAttacks          | 06-wifi             | Needs patched WiFi driver compiled for RPi5 aarch64 kernel  | Patch and compile driver              |
| Hashcat              | 06-wifi             | CPU-only (no GPU on RPi5); ~100x slower than GPU            | Capture on RPi5, crack on GPU machine |
| FISSURE              | 08-sdr-frameworks   | GUI needs x86; headless sensor/attack scripts work on ARM64 | Run as headless node                  |
| TempestSDR           | 12-em-eavesdropping | Real-time video reconstruction CPU-intensive for RPi5       | Low-resolution targets only           |
| ATAKRR               | 15-counter-atak     | ML inference pipeline heavy on RPi5 CPU                     | Data collection works; inference slow |

---

## Docker Deployment Classification

### Full Docker Support (97 tools)

Tools that run completely in Docker with appropriate USB/network passthrough.

**01-counter-uas (9):** RF-Drone-Detection, DroneSecurity, SniffleToTAK, SDR-Based-Attacks, dronesploit, GNSS-UAV-Spoofing, DroneID-Spoofer, RF-Jammer, GPS-SDR-SIM

**02-cellular (10):** gr-gsm, QCSuper, Kalibrate-hackrf, Modmobmap, Open5GS, IMSI-catcher (Oros42), srsRAN, Rayhunter, Crocodile Hunter, LTE-Cell-Scanner

**03-attack-hardware (2):** LoRa-Attack-Toolkit, WiFi-Pineapple-Pi

**04-iot-exploits (9):** KillerBee, LAF-LoRa, MQTT-Pwn, Pagermon, RTL-433, SDR-LoRa, Z3sec, Zigator, ZigDiggity

**05-bluetooth (10):** BLE-CTF, Bluesnarfer, BlueToolkit, Bluing, Braktooth, Bsniffhub, Btlejack, Mirage, nRF-Sniffer, Sniffle

**06-wifi (14):** aireplay-ng, Airgeddon, Bl0ck, EAPHammer, Fluxion, Hashcat, hcxdumptool, mdk4, Scapy-80211, WEF, WiFi-Injection-Tester, Wifiphisher, WiFi-Pumpkin3, Wifite2

**07-rf-geolocation (3):** KrakenSDR, DF Aggregator, rtl-coherent

**08-sdr-frameworks (5):** HackRF-Spectrum, OpenWebRX, RF-Emitter, RFSec-ToolKit, USRP-Sweep

**09-aircraft-ship (4):** dump1090, tar1090, readsb, AIS-catcher

**10-rfid-subghz (5):** CleverJAM, JamRF, Proxmark3, RFcat, RFCrack

**11-network-recon (7):** BetterCAP, CryptoLyzer, Ettercap, nDPI, p0f, Responder, Satori

**13-keyboard-mouse (1):** MouseJack

**14-wardriving (3):** Kismet, WiGLE (API), WigleToTAK

**15-counter-atak (15):** adsbcot, aiscot, aprscot, djicot, dronecot, inrcot, spotcot, Meshtastic-Frequency-Calculator, trackerjacker, find-lf, ATAKRR, takproto, pytak, push-cursor-on-target, cotproxy

### Docker Partial (13 tools)

Tools requiring X11 forwarding, VNC, or significant host-level access.

| Tool                    | Issue                        | Solution                      |
| ----------------------- | ---------------------------- | ----------------------------- |
| DroneRF                 | MATLAB/LabVIEW x86 only      | Python pipeline in Docker     |
| Attify ZigBee           | Qt GUI                       | X11 forwarding or VNC         |
| BlueFang                | Build/flash + serial control | USB passthrough               |
| ButteRFly               | Build/flash + serial control | USB passthrough               |
| nRF52-Attack-Toolkit    | Build/flash + serial control | USB passthrough               |
| FragAttacks             | Patched kernel driver        | Host kernel modification      |
| FISSURE                 | PyQt5 GUI dashboard          | X11 forwarding; headless mode |
| QSpectrumAnalyzer       | Qt GUI                       | X11 forwarding or VNC         |
| Inspectrum              | Qt GUI                       | X11 forwarding or VNC         |
| Universal Radio Hacker  | Qt GUI                       | X11 forwarding or VNC         |
| TempestSDR              | Java GUI + SDR               | X11 forwarding                |
| Sparrow-WiFi            | Qt5 GUI + GPS                | X11 forwarding; remote agent  |
| Wireshark-TAK-Dissector | GUI (tshark works headless)  | Use tshark in Docker          |

### Docker BUILD/FLASH Only (6 tools)

RPi5 Docker compiles and flashes firmware to external hardware.

| Tool                      | Target Hardware          | Runs On                 |
| ------------------------- | ------------------------ | ----------------------- |
| ESP32 Marauder            | ESP32                    | ESP32 microcontroller   |
| ESP8266 Deauther          | ESP8266                  | ESP8266 microcontroller |
| ESP32 WiFi Drone Disabler | ESP32                    | ESP32 microcontroller   |
| Flipper Zero Unleashed    | Flipper Zero (STM32WB55) | Flipper Zero hardware   |
| M5Stack WiFi Toolkit      | M5Stack (ESP32)          | M5Stack hardware        |
| Minigotchi                | ESP8266/ESP32            | ESP microcontroller     |

### Cannot Use Docker (4 tools)

| Tool         | Reason                            |
| ------------ | --------------------------------- |
| Drone ID     | Built into Argos app              |
| GSM Evil     | Built into Argos app              |
| BTLE Scanner | Built into Argos app              |
| Pwnagotchi   | Standalone RPi device with own OS |

---

## Host OS Dependencies (Required Regardless of Docker/Native)

### udev Rules

```bash
# /etc/udev/rules.d/99-argos-sdr.rules
# HackRF One
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666"
# RTL-SDR
SUBSYSTEM=="usb", ATTR{idVendor}=="0bda", ATTR{idProduct}=="2838", MODE="0666"
# USRP B200/B210
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666"
# Orbic RC400L (Rayhunter)
SUBSYSTEM=="usb", ATTR{idVendor}=="05c6", MODE="0666"
# Proxmark3
SUBSYSTEM=="usb", ATTR{idVendor}=="9ac4", ATTR{idProduct}=="4b8f", MODE="0666"
# CrazyRadio PA (MouseJack)
SUBSYSTEM=="usb", ATTR{idVendor}=="1915", ATTR{idProduct}=="7777", MODE="0666"
# Yard Stick One (RFcat)
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6048", MODE="0666"
# nRF52840 Dongle (Sniffle/nRF-Sniffer)
SUBSYSTEM=="usb", ATTR{idVendor}=="1915", ATTR{idProduct}=="cafe", MODE="0666"

sudo udevadm control --reload-rules && sudo udevadm trigger
```

### Kernel Modules

```bash
# WiFi monitor mode + injection
sudo modprobe cfg80211
sudo modprobe mac80211

# Bluetooth
sudo modprobe bluetooth
sudo modprobe btusb

# TUN device (Open5GS, VPN tools)
sudo modprobe tun

# USB serial (ESP32, cellular modems, LoRa)
sudo modprobe cp210x
sudo modprobe ch341
sudo modprobe cdc_acm
sudo modprobe ftdi_sio
```

### Common Docker Flags

```bash
# SDR hardware (HackRF, RTL-SDR, USRP)
--privileged --device=/dev/bus/usb

# WiFi injection tools
--privileged --net=host

# Network recon tools (BetterCAP, Ettercap, Responder)
--privileged --net=host

# Core network (Open5GS)
--cap-add=NET_ADMIN --device=/dev/net/tun

# USB serial devices (modems, ESP32, LoRa)
--device=/dev/ttyUSB0 --device=/dev/ttyACM0

# GUI applications (X11 forwarding)
-e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix
```

---

## File Inventory

### 01-counter-uas/ (12 tool files)

| File                                           | Tool                      | RPi5       | Docker      | Risk    | Installed? | Install OK?             |
| ---------------------------------------------- | ------------------------- | ---------- | ----------- | ------- | ---------- | ----------------------- |
| drone-detection/drone-id.md                    | Drone ID (Argos built-in) | COMPATIBLE | N/A         | LOW     | BUILT-IN   | N/A                     |
| drone-detection/rf-drone-detection.md          | RF-Drone-Detection        | COMPATIBLE | YES         | LOW     | No         | HAS ISSUES              |
| drone-detection/dronesecurity.md               | DroneSecurity             | COMPATIBLE | YES         | LOW     | No         | HAS ISSUES              |
| drone-detection/dronerf.md                     | DroneRF                   | PARTIAL    | PARTIAL     | LOW     | No         | BROKEN (tensorflow-cpu) |
| drone-detection/sniffletotak.md                | SniffleToTAK              | COMPATIBLE | YES         | LOW     | No         | MOSTLY OK               |
| drone-defeat/sdr-based-attacks-gps-spoofing.md | GPS L1 Spoofing           | COMPATIBLE | YES         | HIGH    | No         | HAS ISSUES              |
| drone-defeat/dronesploit.md                    | dronesploit               | COMPATIBLE | YES         | HIGH    | No         | MOSTLY OK               |
| drone-defeat/gnss-uav-spoofing-jamming.md      | GNSS Spoofing             | COMPATIBLE | YES         | HIGH    | No         | MOSTLY OK               |
| drone-defeat/esp32-wifi-drone-disabler.md      | ESP32 Drone Disabler      | PARTIAL    | BUILD/FLASH | HIGH    | No         | HAS ISSUES              |
| drone-defeat/droneid-spoofer.md                | DroneID Spoofer           | COMPATIBLE | YES         | HIGH    | No         | MOSTLY OK               |
| drone-defeat/rf-jammer.md                      | RF Jammer                 | COMPATIBLE | YES         | EXTREME | No         | MOSTLY OK               |
| drone-defeat/gps-sdr-sim.md                    | GPS-SDR-SIM               | COMPATIBLE | YES         | HIGH    | No         | HAS ISSUES              |

### 02-cellular-attacks/ (11 tool files)

| File                                 | Tool             | RPi5       | Docker | Risk     | Installed?              | Install OK?                    |
| ------------------------------------ | ---------------- | ---------- | ------ | -------- | ----------------------- | ------------------------------ |
| imsi-catching/gr-gsm.md              | gr-gsm           | COMPATIBLE | YES    | HIGH     | Partial (binaries only) | BROKEN (apt pkg missing)       |
| imsi-catching/gsm-evil.md            | GSM Evil (Argos) | COMPATIBLE | N/A    | HIGH     | BUILT-IN                | CORRECT                        |
| imsi-catching/qcsuper.md             | QCSuper          | COMPATIBLE | YES    | HIGH     | No                      | HAS ISSUES                     |
| imsi-catching/kalibrate-hackrf.md    | Kalibrate-hackrf | COMPATIBLE | YES    | MODERATE | No                      | CORRECT                        |
| imsi-catching/lte-cell-scanner.md    | LTE-Cell-Scanner | PARTIAL    | YES    | MODERATE | No                      | MOSTLY OK                      |
| imsi-catching/modmobmap.md           | Modmobmap        | COMPATIBLE | YES    | MODERATE | No                      | HAS ISSUES                     |
| imsi-catching/open5gs.md             | Open5GS          | COMPATIBLE | YES    | HIGH     | No                      | BROKEN (Docker images missing) |
| imsi-catching/srsran.md              | srsRAN           | PARTIAL    | YES    | HIGH     | No                      | MOSTLY OK                      |
| imsi-catching/imsi-catcher-oros42.md | IMSI-catcher     | COMPATIBLE | YES    | HIGH     | Docker (amd64/QEMU)     | BROKEN (gr-gsm dep)            |
| imsi-defense/rayhunter.md            | Rayhunter        | COMPATIBLE | YES    | LOW      | No                      | MOSTLY OK                      |
| imsi-defense/crocodile-hunter.md     | Crocodile Hunter | PARTIAL    | YES    | MODERATE | No                      | BROKEN (srsran apt)            |

### 03-attack-hardware/ (8 tool files)

| File                      | Tool                | RPi5        | Docker      | Risk     | Installed? | Install OK? |
| ------------------------- | ------------------- | ----------- | ----------- | -------- | ---------- | ----------- |
| esp32-marauder.md         | ESP32 Marauder      | COMPATIBLE  | BUILD/FLASH | HIGH     | No         | MOSTLY OK   |
| esp8266-deauther.md       | ESP8266 Deauther    | COMPATIBLE  | BUILD/FLASH | HIGH     | No         | MOSTLY OK   |
| flipper-zero-unleashed.md | Flipper Unleashed   | COMPATIBLE  | BUILD/FLASH | HIGH     | No         | MOSTLY OK   |
| lora-attack-toolkit.md    | LoRa Attack Toolkit | COMPATIBLE  | YES         | HIGH     | No         | MOSTLY OK   |
| m5stack-wifi-toolkit.md   | M5Stack WiFi        | COMPATIBLE  | BUILD/FLASH | HIGH     | No         | MOSTLY OK   |
| minigotchi.md             | Minigotchi          | COMPATIBLE  | BUILD/FLASH | MODERATE | No         | MOSTLY OK   |
| pwnagotchi.md             | Pwnagotchi          | COMPANION\* | NO          | HIGH     | No         | CORRECT     |
| wifi-pineapple-pi.md      | WiFi Pineapple Pi   | COMPATIBLE  | YES         | HIGH     | No         | MOSTLY OK   |

\*Runs as standalone device alongside RPi5

### 04-iot-exploits/ (10 tool files)

| File             | Tool          | RPi5       | Docker  | Risk     | Installed?         | Install OK? |
| ---------------- | ------------- | ---------- | ------- | -------- | ------------------ | ----------- |
| attify-zigbee.md | Attify ZigBee | COMPATIBLE | PARTIAL | MODERATE | No                 | MOSTLY OK   |
| killerbee.md     | KillerBee     | COMPATIBLE | YES     | HIGH     | Kismet module only | CORRECT     |
| laf-lora.md      | LAF LoRa      | COMPATIBLE | YES     | HIGH     | No                 | MOSTLY OK   |
| mqtt-pwn.md      | MQTT-Pwn      | COMPATIBLE | YES     | MODERATE | paho-mqtt only     | MOSTLY OK   |
| pagermon.md      | Pagermon      | COMPATIBLE | YES     | MODERATE | No                 | MOSTLY OK   |
| rtl-433.md       | RTL-433       | COMPATIBLE | YES     | LOW      | Kismet module only | CORRECT     |
| sdr-lora.md      | SDR-LoRa      | COMPATIBLE | YES     | HIGH     | No                 | MOSTLY OK   |
| z3sec.md         | Z3sec         | COMPATIBLE | YES     | MODERATE | No                 | MOSTLY OK   |
| zigator.md       | Zigator       | COMPATIBLE | YES     | LOW      | No                 | CORRECT     |
| zigdiggity.md    | ZigDiggity    | COMPATIBLE | YES     | HIGH     | No                 | CORRECT     |

### 05-bluetooth-exploits/ (14 tool files)

| File                    | Tool                 | RPi5       | Docker  | Risk     | Installed? | Install OK? |
| ----------------------- | -------------------- | ---------- | ------- | -------- | ---------- | ----------- |
| ble-ctf-framework.md    | BLE CTF              | COMPATIBLE | YES     | LOW      | No         | MOSTLY OK   |
| bluefang.md             | BlueFang             | COMPATIBLE | PARTIAL | HIGH     | No         | HAS ISSUES  |
| bluesnarfer.md          | Bluesnarfer          | COMPATIBLE | YES     | HIGH     | No         | CORRECT     |
| bluetoolkit.md          | BlueToolkit          | COMPATIBLE | YES     | HIGH     | No         | HAS ISSUES  |
| bluing.md               | Bluing               | COMPATIBLE | YES     | HIGH     | No         | MOSTLY OK   |
| braktooth.md            | Braktooth            | COMPATIBLE | YES     | HIGH     | No         | MOSTLY OK   |
| bsniffhub.md            | Bsniffhub            | COMPATIBLE | YES     | LOW      | No         | CORRECT     |
| btlejack.md             | Btlejack             | COMPATIBLE | YES     | HIGH     | No         | CORRECT     |
| btle-scanner.md         | BTLE Scanner (Argos) | COMPATIBLE | N/A     | LOW      | BUILT-IN   | CORRECT     |
| butterfly.md            | ButteRFly            | COMPATIBLE | PARTIAL | HIGH     | No         | MOSTLY OK   |
| mirage-framework.md     | Mirage               | COMPATIBLE | YES     | HIGH     | No         | MOSTLY OK   |
| nrf52-attack-toolkit.md | nRF52 Attack Toolkit | COMPATIBLE | PARTIAL | HIGH     | No         | HAS ISSUES  |
| nrf-sniffer.md          | nRF Sniffer          | COMPATIBLE | YES     | LOW      | No         | HAS ISSUES  |
| sniffle.md              | Sniffle              | COMPATIBLE | YES     | MODERATE | No         | CORRECT     |

### 06-wifi-exploits/ (15 tool files)

| File                     | Tool                  | RPi5       | Docker  | Risk     | Installed?      | Install OK? |
| ------------------------ | --------------------- | ---------- | ------- | -------- | --------------- | ----------- |
| aireplay-ng.md           | aireplay-ng           | COMPATIBLE | YES     | HIGH     | **YES** (1.7)   | CORRECT     |
| airgeddon.md             | Airgeddon             | COMPATIBLE | YES     | HIGH     | No              | MOSTLY OK   |
| bl0ck.md                 | Bl0ck                 | COMPATIBLE | YES     | HIGH     | No              | MOSTLY OK   |
| eaphammer.md             | EAPHammer             | COMPATIBLE | YES     | HIGH     | No              | HAS ISSUES  |
| fluxion.md               | Fluxion               | COMPATIBLE | YES     | HIGH     | No              | CORRECT     |
| fragattacks.md           | FragAttacks           | PARTIAL    | PARTIAL | HIGH     | No              | HAS ISSUES  |
| hashcat.md               | Hashcat               | PARTIAL    | YES     | MODERATE | **YES** (7.1.2) | CORRECT     |
| hcxdumptool.md           | hcxdumptool           | COMPATIBLE | YES     | HIGH     | **YES** (7.0.0) | CORRECT     |
| mdk4.md                  | mdk4                  | COMPATIBLE | YES     | HIGH     | No              | CORRECT     |
| scapy-80211.md           | Scapy 802.11          | COMPATIBLE | YES     | HIGH     | **YES** (2.6.1) | CORRECT     |
| wef.md                   | WEF                   | COMPATIBLE | YES     | HIGH     | No              | MOSTLY OK   |
| wifi-injection-tester.md | WiFi Injection Tester | COMPATIBLE | YES     | LOW      | No              | CORRECT     |
| wifiphisher.md           | Wifiphisher           | COMPATIBLE | YES     | HIGH     | No              | MOSTLY OK   |
| wifi-pumpkin3.md         | WiFi-Pumpkin3         | COMPATIBLE | YES     | HIGH     | No              | MOSTLY OK   |
| wifite2.md               | Wifite2               | COMPATIBLE | YES     | HIGH     | **YES** (2.8.1) | CORRECT     |

### 07-rf-geolocation/ (3 tool files)

| File             | Tool          | RPi5       | Docker | Risk | Installed?          | Install OK? |
| ---------------- | ------------- | ---------- | ------ | ---- | ------------------- | ----------- |
| krakensdr.md     | KrakenSDR     | COMPATIBLE | YES    | LOW  | No (needs hardware) | MOSTLY OK   |
| df-aggregator.md | DF Aggregator | COMPATIBLE | YES    | LOW  | No                  | MOSTLY OK   |
| rtl-coherent.md  | rtl-coherent  | COMPATIBLE | YES    | LOW  | No (needs hardware) | MOSTLY OK   |

### 08-sdr-frameworks/ (9 tool files)

| File                      | Tool                    | RPi5       | Docker  | Risk     | Installed?       | Install OK? |
| ------------------------- | ----------------------- | ---------- | ------- | -------- | ---------------- | ----------- |
| hackrf-spectrum.md        | HackRF Spectrum (Argos) | COMPATIBLE | YES     | LOW      | **BUILT-IN**     | CORRECT     |
| rf-emitter.md             | RF Emitter (Argos)      | COMPATIBLE | YES     | HIGH     | **BUILT-IN**     | CORRECT     |
| usrp-sweep.md             | USRP Sweep (Argos)      | COMPATIBLE | YES     | LOW      | **BUILT-IN**     | MOSTLY OK   |
| openwebrx.md              | OpenWebRX               | COMPATIBLE | YES     | LOW      | **YES** (Docker) | MOSTLY OK   |
| universal-radio-hacker.md | Universal Radio Hacker  | COMPATIBLE | PARTIAL | MODERATE | No               | MOSTLY OK   |
| rfsec-toolkit.md          | RFSec-ToolKit           | COMPATIBLE | YES     | LOW      | No               | CORRECT     |
| fissure.md                | FISSURE                 | PARTIAL    | PARTIAL | HIGH     | No               | HAS ISSUES  |
| qspectrumanalyzer.md      | QSpectrumAnalyzer       | COMPATIBLE | PARTIAL | LOW      | No               | MOSTLY OK   |
| inspectrum.md             | Inspectrum              | COMPATIBLE | PARTIAL | LOW      | No               | CORRECT     |

### 09-aircraft-ship-tracking/ (4 tool files)

| File           | Tool        | RPi5       | Docker | Risk | Installed? | Install OK? |
| -------------- | ----------- | ---------- | ------ | ---- | ---------- | ----------- |
| dump1090.md    | dump1090    | COMPATIBLE | YES    | LOW  | No         | MOSTLY OK   |
| tar1090.md     | tar1090     | COMPATIBLE | YES    | LOW  | No         | CORRECT     |
| readsb.md      | readsb      | COMPATIBLE | YES    | LOW  | No         | CORRECT     |
| ais-catcher.md | AIS-catcher | COMPATIBLE | YES    | LOW  | No         | CORRECT     |

### 10-rfid-subghz/ (5 tool files)

| File         | Tool      | RPi5       | Docker | Risk    | Installed?            | Install OK? |
| ------------ | --------- | ---------- | ------ | ------- | --------------------- | ----------- |
| proxmark3.md | Proxmark3 | COMPATIBLE | YES    | HIGH    | No (needs hardware)   | MOSTLY OK   |
| rfcat.md     | RFcat     | COMPATIBLE | YES    | HIGH    | No (needs Yard Stick) | MOSTLY OK   |
| rfcrack.md   | RFCrack   | COMPATIBLE | YES    | HIGH    | No                    | MOSTLY OK   |
| cleverjam.md | CleverJAM | COMPATIBLE | YES    | EXTREME | No                    | MOSTLY OK   |
| jamrf.md     | JamRF     | COMPATIBLE | YES    | EXTREME | No                    | MOSTLY OK   |

### 11-network-recon/ (7 tool files)

| File           | Tool        | RPi5       | Docker | Risk     | Installed?        | Install OK? |
| -------------- | ----------- | ---------- | ------ | -------- | ----------------- | ----------- |
| bettercap.md   | BetterCAP   | COMPATIBLE | YES    | HIGH     | **YES** (Docker)  | CORRECT     |
| ettercap.md    | Ettercap    | COMPATIBLE | YES    | HIGH     | **YES** (0.8.3.1) | CORRECT     |
| responder.md   | Responder   | COMPATIBLE | YES    | HIGH     | **YES** (3.2.0.0) | CORRECT     |
| p0f.md         | p0f         | COMPATIBLE | YES    | LOW      | No                | CORRECT     |
| cryptolyzer.md | CryptoLyzer | COMPATIBLE | YES    | LOW      | No                | CORRECT     |
| ndpi.md        | nDPI        | COMPATIBLE | YES    | MODERATE | No                | MOSTLY OK   |
| satori.md      | Satori      | COMPATIBLE | YES    | MODERATE | No                | MOSTLY OK   |

### 12-em-eavesdropping/ (1 tool file)

| File          | Tool       | RPi5    | Docker  | Risk | Installed? | Install OK? |
| ------------- | ---------- | ------- | ------- | ---- | ---------- | ----------- |
| tempestsdr.md | TempestSDR | PARTIAL | PARTIAL | HIGH | No         | HAS ISSUES  |

### 13-keyboard-mouse-attacks/ (1 tool file)

| File         | Tool               | RPi5       | Docker | Risk | Installed?            | Install OK? |
| ------------ | ------------------ | ---------- | ------ | ---- | --------------------- | ----------- |
| mousejack.md | MouseJack / JackIt | COMPATIBLE | YES    | HIGH | No (needs CrazyRadio) | MOSTLY OK   |

### 14-wardriving/ (4 tool files)

| File            | Tool         | RPi5       | Docker  | Risk | Installed?          | Install OK? |
| --------------- | ------------ | ---------- | ------- | ---- | ------------------- | ----------- |
| kismet.md       | Kismet       | COMPATIBLE | YES     | LOW  | **YES** (2025.09.0) | CORRECT     |
| sparrow-wifi.md | Sparrow-WiFi | COMPATIBLE | PARTIAL | LOW  | No                  | MOSTLY OK   |
| wigle.md        | WiGLE (API)  | COMPATIBLE | YES     | LOW  | N/A (web API)       | CORRECT     |
| wigletotak.md   | WigleToTAK   | COMPATIBLE | YES     | LOW  | No                  | MOSTLY OK   |

### 15-counter-atak/ (16 tool files across 5 subfolders)

| File                                                  | Tool                    | RPi5       | Docker  | Risk     | Installed?            | Install OK?            |
| ----------------------------------------------------- | ----------------------- | ---------- | ------- | -------- | --------------------- | ---------------------- |
| cot-gateways/adsbcot.md                               | adsbcot                 | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/aiscot.md                                | aiscot                  | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/aprscot.md                               | aprscot                 | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/djicot.md                                | djicot                  | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/dronecot.md                              | dronecot                | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/inrcot.md                                | inrcot                  | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| cot-gateways/spotcot.md                               | spotcot                 | COMPATIBLE | YES     | LOW      | No                    | CORRECT                |
| meshtastic-attacks/meshtastic-frequency-calculator.md | Meshtastic Freq Calc    | COMPATIBLE | YES     | MODERATE | No                    | HAS ISSUES             |
| rf-fingerprinting/atakrr.md                           | ATAKRR                  | PARTIAL    | YES     | MODERATE | No                    | BROKEN (pip pkg names) |
| rf-fingerprinting/find-lf.md                          | find-lf                 | COMPATIBLE | YES     | LOW      | No                    | MOSTLY OK              |
| rf-fingerprinting/trackerjacker.md                    | trackerjacker           | COMPATIBLE | YES     | MODERATE | No                    | MOSTLY OK              |
| tak-protocol-tools/takproto.md                        | takproto                | COMPATIBLE | YES     | MODERATE | No                    | CORRECT                |
| tak-protocol-tools/pytak.md                           | pytak                   | COMPATIBLE | YES     | MODERATE | No                    | CORRECT                |
| tak-protocol-tools/push-cursor-on-target.md           | push-cursor-on-target   | COMPATIBLE | YES     | HIGH     | No                    | CORRECT                |
| tak-protocol-tools/cotproxy.md                        | cotproxy                | COMPATIBLE | YES     | HIGH     | No                    | CORRECT                |
| tak-protocol-tools/wireshark-tak-dissector.md         | Wireshark TAK Dissector | COMPATIBLE | PARTIAL | LOW      | tshark YES, plugin No | CORRECT                |

---

## Docker vs Native Decision Guide

| Choose Docker When                                | Choose Native When                          |
| ------------------------------------------------- | ------------------------------------------- |
| Tool has complex dependencies (GNU Radio, srsRAN) | Tool is lightweight (pure C, simple Python) |
| You want isolation from Argos                     | Tool needs maximum real-time performance    |
| You want easy cleanup after use                   | Tool is already built into Argos            |
| Running multiple tool versions                    | Tool is a single binary / `apt install`     |
| Reproducible environment needed                   | Direct hardware access critical             |

### Recommended Native Install (Best Performance)

Drone ID, GSM Evil, BTLE Scanner, Kalibrate-hackrf, gr-gsm, GPS-SDR-SIM, mdk4, aireplay-ng, p0f, Kismet, RTL-433, dump1090/readsb

### Recommended Docker Install (Clean Isolation)

Open5GS, srsRAN, Crocodile Hunter, dronesploit, RF-Jammer, KillerBee, MQTT-Pwn, BetterCAP, Ettercap, Responder, all CoT gateways

---

## Hardware Requirements Summary

| Hardware                         | Tools That Need It                      | Estimated Cost               |
| -------------------------------- | --------------------------------------- | ---------------------------- |
| HackRF One                       | ~30 tools (spectrum, jamming, spoofing) | Installed                    |
| WiFi adapter (monitor+injection) | ~20 tools (WiFi exploits, wardriving)   | Installed (Alfa AWUS036AXML) |
| Bluetooth adapter                | ~15 tools (BLE/BT exploits)             | Installed                    |
| GPS module                       | ~5 tools (wardriving, geolocation)      | Installed                    |
| RTL-SDR                          | ~10 tools (ADS-B, AIS, GSM)             | ~$30                         |
| USRP B210                        | ~5 tools (LTE/5G, wideband)             | ~$1,500                      |
| Orbic RC400L                     | 1 tool (Rayhunter)                      | ~$20                         |
| CrazyRadio PA                    | 1 tool (MouseJack)                      | ~$30                         |
| Proxmark3                        | 1 tool (RFID)                           | ~$50-300                     |
| Yard Stick One                   | 2 tools (RFcat, RFCrack)                | ~$100                        |
| nRF52840 Dongle                  | 2 tools (Sniffle, nRF-Sniffer)          | ~$10                         |
| ESP32/ESP8266                    | 5 tools (firmware attacks)              | ~$5-15 each                  |
| LoRa transceiver                 | 2 tools (LAF, SDR-LoRa)                 | ~$15-30                      |
| Flipper Zero                     | 1 tool (Unleashed firmware)             | ~$170                        |
| KrakenSDR                        | 1 tool (RF direction finding)           | ~$500                        |
