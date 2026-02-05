# IMSI Catchers & Cellular Attacks

Tools for GSM/LTE signal monitoring, IMSI collection, fake base stations, cellular reconnaissance, and network exploitation across 2G-5G.

---

## Installed on Argos (2)

| Tool         | Type           | Description                                                                                          |
| ------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| **gr-gsm**   | GSM Analysis   | GNU Radio GSM blocks - decode signaling channels, A5/1 cracking, IMSI collection, cell tower mapping |
| **GSM Evil** | IMSI Detection | Argos built-in GSM signal monitoring and IMSI detection module                                       |

---

## Available for Integration (12)

### Passive LTE Surveillance

| Tool       | Repository                         | Capabilities                                                                                                                                                                                                               | Argos Integration                                               | Maturity                    |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| LTESniffer | github.com/SysSec-KAIST/LTESniffer | Open-source LTE downlink/uplink eavesdropper - decodes PDCCH for DCIs and RNTIs of ALL active users, Security API for identity mapping (RNTI-to-TMSI), IMSI collection, UE capability profiling, PCAP output for Wireshark | **HIGH** - C/C++, PCAP output, USRP compatible, Ubuntu 18/20/22 | ACTIVE (WiSec 2023)         |
| FALCON LTE | github.com/falkenber9/falcon       | Fast Analysis of LTE Control Channels - real-time monitoring of public LTE cells up to 20MHz, decodes PDCCH, reveals all active devices with RNTIs and resource allocations, Qt GUI visualization                          | **HIGH** - C/C++, Qt GUI, srsRAN-compatible SDRs                | MATURE (IEEE GLOBECOM 2019) |
| QCSuper    | github.com/P1sec/QCSuper           | Captures 2G/3G/4G air traffic using Qualcomm-based phones - turns any Qualcomm Android phone into a passive cellular protocol analyzer, PCAP output                                                                        | **VERY HIGH** - Python, PCAP output, zero SDR hardware needed   | ACTIVE (P1 Security)        |

### Cellular Reconnaissance & Mapping

| Tool             | Repository                             | Capabilities                                                                                                                                  | Argos Integration                                      | Maturity           |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| Kalibrate-hackrf | github.com/scateu/kalibrate-hackrf     | GSM base station scanner and frequency calibration - scans for all GSM towers in range, identifies frequencies and offsets, HackRF-compatible | **VERY HIGH** - Uses HackRF (installed), C, simple CLI | MATURE             |
| LTE-Cell-Scanner | github.com/Evrytania/LTE-Cell-Scanner  | Quick LTE cell detection and analysis - finds LTE cells in range and displays parameters (PCI, frequency, bandwidth, signal strength)         | **MEDIUM** - C++, RTL-SDR or USRP compatible           | MATURE             |
| Modmobmap        | github.com/Synacktiv-contrib/Modmobmap | Mobile network mapping - scans and maps all cell towers in range with frequencies, operators, signal strengths using phone modem              | **HIGH** - Python, simple CLI, JSON output             | ACTIVE (Synacktiv) |

### Rogue Base Stations & Core Network

| Tool                | Repository                   | Capabilities                                                                                                                           | Argos Integration                                   | Maturity           |
| ------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------ |
| OpenBTS (PentHertz) | github.com/PentHertz/OpenBTS | Updated rogue GSM base station for Ubuntu 22.04/24.04 - fake cell tower, forces phone downgrade from LTE to GSM, call/SMS interception | **MEDIUM** - Complex setup, requires USRP/BladeRF   | MATURE (2024 fork) |
| Open5GS             | github.com/open5gs/open5gs   | Complete 4G/5G core network (EPC + 5GC), 3GPP Release-17 - required backend for srsRAN to run as full rogue LTE/5G base station        | **HIGH** - C, Docker-ready, 2.4K stars, very active | MATURE             |

### GSM IMSI Catching

| Tool                  | Repository                     | Capabilities                                                                                                           | Argos Integration                                 | Maturity |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------- |
| YateBTS               | github.com/yatevoip/yatebts    | Complete open-source GSM/UMTS base station - fake cell tower, IMSI catching, SMS interception, voice call interception | **LOW** - Complex setup, requires SDR             | MATURE   |
| IMSI-catcher (Oros42) | github.com/Oros42/IMSI-catcher | Passive IMSI collection using RTL-SDR + gr-gsm, maps nearby cell towers and connected devices                          | **HIGH** - RTL-SDR compatible, Python, map output | ACTIVE   |

### 5G Security Research

| Tool                          | Repository                           | Capabilities                                                                                                                | Argos Integration                      | Maturity |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------- |
| srsRAN (Passive Sniffer Mode) | github.com/srsran/srsRAN             | Passive LTE/5G NR sniffer - IMSI/TMSI collection, cell broadcast monitoring, paging channel analysis, tracking area mapping | **MEDIUM** - Requires USRP or LimeSDR  | MATURE   |
| 5GBaseChecker                 | github.com/asset-group/5GBaseChecker | 5G NSA security assessment - fake base station detection, downgrade attack identification, fake gNB identification          | **LOW** - Requires commercial 5G modem | RESEARCH |

---

## NTC Field Operations Kill Chain

```
STEP 1: RECON          → Kalibrate-hackrf (scan GSM towers with HackRF)
                       → Modmobmap (map all cell towers, operators, frequencies)

STEP 2: LTE PASSIVE    → FALCON (real-time view of active devices on LTE cells)
                       → LTESniffer (IMSI collection, identity mapping, PCAP capture)
                       → QCSuper (backup capture using any Qualcomm Android phone)

STEP 3: GSM PASSIVE    → gr-gsm + IMSI-catcher (passive GSM IMSI collection)
                       → GSM Evil (Argos built-in GSM monitoring)

STEP 4: ACTIVE (opt)   → Open5GS + srsRAN (rogue LTE/5G base station)
                       → OpenBTS (rogue GSM base station, force LTE downgrade)
                       → YateBTS (alternative GSM BTS)
```

Steps 1-3 are entirely **passive** - no transmission, no detection risk.

## Hardware Requirements

- HackRF One (installed - Kalibrate-hackrf, GSM Evil, gr-gsm)
- RTL-SDR (IMSI-catcher Oros42, LTE-Cell-Scanner)
- USRP B210 (LTESniffer downlink, FALCON, srsRAN, OpenBTS)
- USRP X310 (LTESniffer uplink+downlink - dual LO for simultaneous UL/DL)
- Qualcomm Android phone (QCSuper - zero SDR needed)
- USB cellular modem (Modmobmap)
