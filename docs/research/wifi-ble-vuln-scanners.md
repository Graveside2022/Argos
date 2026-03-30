# WiFi & BLE Vulnerability Scanner Tools Research

**Date**: 2026-03-30
**Goal**: Find open-source tools that let you point at a WiFi AP or BLE device and scan for vulnerabilities — "Burp Suite for wireless."

---

## Tier 1 — Established, Actively Maintained, Closest to the Vision

### 1. Bettercap (WiFi + BLE + Network)

- **URL**: https://github.com/bettercap/bettercap
- **Stars**: 19,006 | **Language**: Go | **Last pushed**: 2026-03-29
- **What it does**: Swiss Army knife for 802.11, BLE, HID, IPv4/IPv6 recon and MITM. WiFi deauth, PMKID capture, rogue AP, BLE device enumeration, BLE GATT read/write, network sniffing.
- **GUI**: Yes — official web UI at https://github.com/bettercap/ui (362 stars, TypeScript). Real-time dashboard showing discovered WiFi APs, BLE devices, network hosts.
- **Wraps**: Standalone (Go binary). Does NOT wrap aircrack-ng — has its own 802.11 and BLE stacks.
- **RPi/ARM**: Yes, native ARM builds. Already in Argos Docker compose.
- **Verdict**: **BEST OVERALL MATCH**. Covers both WiFi and BLE with a web UI. The UI is basic but functional. This is the closest thing to "Burp for wireless" that exists today. You already run it.

### 2. Kismet (WiFi + BLE + SDR)

- **URL**: https://github.com/kismetwireless/kismet
- **Stars**: 2,080 | **Language**: C++ | **Last pushed**: 2026-03-30
- **What it does**: Wireless network detector, sniffer, wardriving tool, and WIDS. Detects WiFi APs, BLE devices, SDR signals. Passive monitoring — identifies rogue APs, detects deauth attacks, logs SSID history.
- **GUI**: Yes — built-in REST API + full web UI dashboard. Shows maps, device details, signal strength, alerts.
- **Wraps**: Standalone. Uses libpcap and direct hardware interfaces.
- **RPi/ARM**: Yes, native. Already integrated in Argos.
- **Verdict**: **BEST FOR DETECTION/MONITORING**. More passive/defensive than offensive. Excellent for rogue AP detection and wireless IDS. Not a vulnerability scanner per se, but pairs well with active tools.

### 3. Sparrow-wifi (WiFi + BLE)

- **URL**: https://github.com/ghostop14/sparrow-wifi
- **Stars**: 1,523 | **Language**: Python | **Last pushed**: 2026-03-30
- **What it does**: Next-gen GUI-based WiFi and Bluetooth analyzer. WiFi scanning, signal analysis, Bluetooth device discovery, GPS integration, drone detection, HackRF spectrum analysis.
- **GUI**: Yes — PyQt5 native desktop GUI. Very polished with real-time graphs, maps, device tables.
- **Wraps**: Uses ubertooth, HackRF, iwlist, hcitool. Integrates with Mavlink for drone detection.
- **RPi/ARM**: Yes, Python + Qt. Works on RPi but needs display or VNC.
- **Verdict**: **BEST GUI FOR ANALYSIS**. Not a vulnerability scanner, but excellent for wireless recon and visualization. Could feed data into attack tools.

### 4. BlueToolkit (Bluetooth Classic)

- **URL**: https://github.com/sgxgsx/BlueToolkit
- **Stars**: 677 | **Language**: Python/Jupyter | **Last pushed**: 2026-03-05
- **What it does**: Extensible Bluetooth Classic vulnerability testing framework. Tests for known BT vulnerabilities (BlueBorne, KNOB, BLURtooth, and more). Automated exploit execution.
- **GUI**: Jupyter notebook interface for interactive testing.
- **Wraps**: Standalone framework with exploit modules. Uses BlueZ stack.
- **RPi/ARM**: Yes, Python-based. Needs Bluetooth adapter.
- **Verdict**: **BEST FOR BT CLASSIC VULNS**. Closest to "point and scan for BT vulnerabilities." Actively maintained and extensible. Not BLE though — focused on Bluetooth Classic.

---

## Tier 2 — Strong Tools, Partial Coverage

### 5. Wifiphisher (WiFi)

- **URL**: https://github.com/wifiphisher/wifiphisher
- **Stars**: 14,516 | **Language**: Python | **Last pushed**: 2025-02-04
- **What it does**: Rogue Access Point framework. Automated phishing attacks against WiFi clients. Evil twin, KARMA, known beacons attacks.
- **GUI**: Web-based phishing pages (for victims). CLI for operator.
- **RPi/ARM**: Yes.
- **Verdict**: Attack-focused (rogue AP/phishing), not a scanner. Useful for testing client susceptibility to evil twin attacks.

### 6. Pwnagotchi (WiFi)

- **URL**: https://github.com/evilsocket/pwnagotchi (original, 9,011 stars) / https://github.com/jayofelony/pwnagotchi (active fork, 2,605 stars, RPi5 support)
- **What it does**: AI-driven WiFi auditing tool. Uses deep reinforcement learning + bettercap to automatically capture WPA handshakes and PMKID hashes. Tamagotchi-style e-ink display.
- **GUI**: E-ink display + web UI for status/config. Not a full analysis dashboard.
- **Wraps**: Bettercap under the hood.
- **RPi/ARM**: Yes, designed for RPi Zero/3/4/5.
- **Verdict**: Automated WiFi hash capture, not a vulnerability scanner. Excellent companion for passive handshake collection.

### 7. Airgeddon (WiFi)

- **URL**: https://github.com/v1s1t0r1sh3r3/airgeddon
- **Stars**: 7,606 | **Language**: Bash | **Last pushed**: 2026-03-28
- **What it does**: Multi-use WiFi audit script. Evil twin, handshake capture, WPS attacks, PMKID, deauth, DoS, WEP/WPA/WPA2/WPA3, enterprise attacks.
- **GUI**: TUI (terminal UI) with menus. No web UI.
- **Wraps**: aircrack-ng, hashcat, bettercap, mdk3/4, reaver, bully, pixiewps, and many more.
- **RPi/ARM**: Yes, bash script.
- **Verdict**: **Most comprehensive WiFi audit tool** but CLI/TUI only. Covers nearly every WiFi attack vector. No BLE.

### 8. Wifite2 (WiFi)

- **URL**: https://github.com/derv82/wifite2
- **Stars**: 7,720 | **Language**: Python | **Last pushed**: 2024-08-20
- **What it does**: Automated WiFi auditor. Scans for targets, attacks WEP/WPA/WPS networks automatically.
- **GUI**: CLI only. Automated — point and run.
- **Wraps**: aircrack-ng, reaver, bully, hashcat, pyrit, tshark, etc.
- **RPi/ARM**: Yes.
- **Verdict**: Good automated scanner but CLI-only and showing age. Airgeddon has surpassed it in features.

### 9. WiFi-Pumpkin3 (WiFi)

- **URL**: https://github.com/P0cL4bs/wifipumpkin3
- **Stars**: 2,415 | **Language**: Python | **Last pushed**: 2024-01-09
- **What it does**: Rogue access point attack framework. MITM, captive portals, credential capture, proxy plugins.
- **GUI**: CLI + plugin system. The deprecated WiFi-Pumpkin v1 (3,157 stars) had a Qt GUI.
- **RPi/ARM**: Yes.
- **Verdict**: Powerful rogue AP framework. More attack-focused than scanning.

### 10. HomePWN (BLE + WiFi + NFC + IoT)

- **URL**: https://github.com/Telefonica/HomePWN
- **Stars**: 930 | **Language**: Python | **Last pushed**: 2022-12-27
- **What it does**: Swiss Army Knife for IoT device pentesting. BLE enumeration and exploitation, NFC cloning, WiFi attacks, Apple BLE device tracking.
- **GUI**: CLI framework (Metasploit-style console).
- **Wraps**: Standalone with modules for different protocols.
- **RPi/ARM**: Yes, Python.
- **Verdict**: Good multi-protocol IoT pentest tool. Covers BLE + WiFi + NFC. Inactive since late 2022.

---

## Tier 3 — Niche/Specialized Tools

### 11. Sniffle (BLE)

- **URL**: https://github.com/nccgroup/Sniffle
- **Stars**: 1,106 | **Language**: Python | **Last pushed**: 2025-09-25
- **What it does**: BLE 5 and 4.x sniffer by NCC Group. Captures BLE advertising and connection traffic. Supports BLE 5 long range and coded PHY.
- **GUI**: CLI + Wireshark pcap output.
- **Hardware**: Requires TI CC26x2 or CC1352 dev board.
- **Verdict**: Best BLE sniffer available, but requires specific hardware. Analysis only, not vulnerability testing.

### 12. InternalBlue (Bluetooth firmware)

- **URL**: https://github.com/seemoo-lab/internalblue
- **Stars**: 769 | **Language**: Python | **Last pushed**: 2024-08-21
- **What it does**: Bluetooth firmware experimentation framework for Broadcom/Cypress chips. Firmware patching, fuzzing, exploit development. Used to discover multiple CVEs.
- **GUI**: CLI/Python API.
- **Verdict**: Research-grade BT firmware tool. Very deep but requires specific Broadcom/Cypress chips.

### 13. WifiForge (WiFi Training)

- **URL**: https://github.com/blackhillsinfosec/WifiForge
- **Stars**: 648 | **Language**: Python | **Last pushed**: 2026-01-15
- **What it does**: WiFi attack training environment by Black Hills InfoSec. Docker-based lab for practicing WiFi attacks safely.
- **GUI**: Docker environment with preconfigured attack scenarios.
- **Verdict**: Training tool, not a scanner. Useful for learning WiFi pentesting techniques.

### 14. wifi_hack_gui (WiFi — NEW)

- **URL**: https://github.com/OhDamnn/wifi_hack_gui
- **Stars**: 5 | **Language**: Python | **Last pushed**: 2026-03-05
- **What it does**: GUI for WiFi penetration testing. Integrates wifipumpkin3, airgeddon, KRACK attacks, CaptiveFlask. Features network reconnaissance and scanning.
- **GUI**: Yes — Python GUI wrapping multiple tools.
- **Verdict**: Very new, very small, but the closest to the "GUI wrapper for WiFi attacks" concept. Worth watching.

### 15. WHISPR (WiFi + BLE — AI)

- **URL**: https://github.com/suhassiyengar/WHISPR-Multi-Vector-AI-Threat-Detector-Wi-Fi-Bluetooth-
- **Stars**: 0 | **Language**: HTML/Python | **Last pushed**: 2025-10-08
- **What it does**: Wireless Hiding Protocol Scanner. Full-stack security diagnostic tool for detecting surveillance threats at the physical layer (WiFi + Bluetooth).
- **GUI**: Yes — web dashboard.
- **Verdict**: Interesting concept (multi-vector WiFi+BLE+AI) but appears to be a student project. Unproven.

### 16. Drone Hacking Tool (WiFi + HackRF)

- **URL**: https://github.com/HKSSY/Drone-Hacking-Tool
- **Stars**: 670 | **Language**: Python | **Last pushed**: 2022-11-25
- **What it does**: GUI tool for drone hacking using WiFi adapter and HackRF One. Deauth, packet injection, frequency analysis.
- **GUI**: Yes — Python GUI (PyQt).
- **Verdict**: Niche (drone-specific) but demonstrates the GUI + WiFi + HackRF integration pattern relevant to Argos.

---

## Gap Analysis

**The "Burp Suite for WiFi/BLE" does not exist yet.** Here is what is missing:

| Feature                           | Best Current Tool | Gap                                      |
| --------------------------------- | ----------------- | ---------------------------------------- |
| WiFi AP vulnerability scanning    | Airgeddon (CLI)   | No web UI, no structured vuln reports    |
| BLE device vulnerability scanning | BlueToolkit       | Jupyter-only, BT Classic not BLE         |
| Combined WiFi + BLE in one UI     | Bettercap + UI    | UI is basic, no vuln assessment workflow |
| Automated vuln assessment         | Wifite2           | Just cracks passwords, no vuln taxonomy  |
| Web dashboard for results         | Kismet            | Passive only, no active scanning         |
| AI-powered analysis               | Pwnagotchi        | Only optimizes handshake capture         |
| PMKID/KRACK/deauth testing        | Airgeddon         | No structured "scan and report" mode     |
| BLE GATT enumeration + vulns      | Bettercap         | Can enumerate but no vuln database       |

**Opportunity**: A tool that combines:

1. Bettercap's WiFi+BLE recon engine
2. Airgeddon's attack coverage (PMKID, KRACK, deauth, WPS, evil twin)
3. BlueToolkit's BT vulnerability database
4. Kismet's web UI quality
5. Structured vulnerability reporting (like Burp's issue definitions)

This is precisely the gap that could be filled by an Argos module.

---

## Recommendations for Argos Integration

**Immediate (already have)**:

- Bettercap (Docker) — already in your stack. Its web UI at port 80 gives WiFi + BLE recon.
- Kismet — already integrated. Passive WiFi/BLE monitoring.

**Short-term additions**:

- BlueToolkit — pip install, run BT Classic vuln scans from Argos API
- Airgeddon — already available on Kali, wrap key functions via exec

**Build opportunity**:

- Create an Argos "Wireless Vuln Scanner" view that orchestrates bettercap (recon) + targeted tests (PMKID check, deauth susceptibility, BLE GATT enum) with structured reporting
- This would be the first web-UI-based WiFi+BLE vulnerability assessment dashboard
