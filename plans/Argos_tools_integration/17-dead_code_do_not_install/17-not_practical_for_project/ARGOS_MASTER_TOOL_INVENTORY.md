# ARGOS MASTER TOOL INVENTORY

## Combined Comprehensive Arsenal for SDR & Network Analysis Console

> **Sources**: Claude deep GitHub research + curated sections list. Excludes tools already in original Argos arsenal (mdk4, aireplay-ng, Wifite2, Airgeddon, WEF, hcxdumptool, Wifiphisher, WiFi-Pumpkin3, EAPHammer, Fluxion, BlueToolkit, Btlejack, Braktooth, Bluesnarfer, JamRF, CleverJAM, RFCrack, gr-gsm, RFSec-ToolKit, BetterCAP).

---

## SECTION 1: COUNTER-UAS / DRONE DEFEAT

### 1A: Active Drone Defeat

| Tool                             | Repository                                  | Capabilities                                                                                                        | Argos Integration                                     | Maturity     |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| SDR-Based-Attacks (GPS Spoofing) | github.com/sxlmnwb/SDR-Based-Attacks        | GPS L1 spoofing via HackRF, coordinate injection, time manipulation, drone trajectory control                       | **HIGH** - Direct HackRF integration                  | EXPERIMENTAL |
| dronesploit                      | github.com/dhondta/dronesploit              | Modular drone pentesting - MAVLink attacks, DJI protocol exploitation, FPV video hijacking, controller spoofing     | **MEDIUM** - CLI subprocess                           | BETA         |
| gnss-uav-spoofing-jamming        | github.com/Mrnmap/gnss-uav-spoofing         | Multi-constellation spoofing (GPS/GLONASS/Galileo), adaptive jamming, CEP manipulation                              | **MEDIUM** - Requires USRP or HackRF                  | RESEARCH     |
| ESP32 WiFi Drone Disabler        | github.com/jopohl/esp32-wifi-drone-disabler | Targeted deauth of DJI Mini/Mavic Air drones via WiFi, automated BSSID tracking, battery-powered portable           | **HIGH** - Can be controlled via Argos API            | WORKING      |
| DroneID-Spoofer                  | github.com/proto17/dji-firmware-tools       | Remote ID frame injection, fake operator location, serial number spoofing to confuse drone tracking                 | **MEDIUM** - WiFi adapter required                    | EXPERIMENTAL |
| RF-Jammer (2.4/5.8 GHz)          | github.com/MarkusLange/RF-Jammer            | Wideband ISM jamming via HackRF, adaptive power control, frequency hopping jamming for drone control/FPV disruption | **HIGH** - HackRF subprocess                          | EXPERIMENTAL |
| GPS-SDR-SIM                      | github.com/osqzss/gps-sdr-sim               | Generates GPS L1 C/A baseband signals for HackRF, custom trajectories, time manipulation                            | **HIGH** - Direct HackRF integration, Python-friendly | MATURE       |

### 1B: Passive Drone Detection

| Tool                | Repository                            | Capabilities                                                                                          | Argos Integration                                                          | Maturity     |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| RF-Drone-Detection  | github.com/RFVenue/rf-drone-detection | Passive RF signature analysis to detect drone presence without active transmission                    | **HIGH** - SDR integration                                                 | RESEARCH     |
| DroneSecurity       | github.com/AresValley/DroneSecurity   | Drone detection and classification via RF fingerprinting, multi-SDR support                           | **HIGH** - Python-based, JSON output                                       | ACTIVE       |
| DroneRF             | github.com/allahyar/DroneRF           | ML-based drone detection using RF signal features, supports multiple drone types                      | **MEDIUM** - Requires training data                                        | RESEARCH     |
| DJI DroneID Decoder | github.com/proto17/dji_droneid        | Decodes DJI OcuSync/WiFi DroneID broadcasts - extracts GPS, serial, operator location from DJI drones | **VERY HIGH** - Direct WiFi capture, JSON output, tactical map integration | ACTIVE       |
| SniffleToTak        | github.com/sniffletotak               | Bridges Sniffle BLE sniffer data to TAK (Team Awareness Kit) for tactical display                     | **HIGH** - TAK protocol compatible                                         | EXPERIMENTAL |

---

## SECTION 2: CELLULAR NETWORK EXPLOITATION (2G-5G)

### 2A: IMSI Catching, LTE Surveillance & Cellular Exploitation

| Tool                          | Repository                             | Capabilities                                                                                                                                                             | Argos Integration                                  | Maturity                      |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------- |
| LTESniffer                    | github.com/SysSec-KAIST/LTESniffer     | Open-source LTE downlink/uplink eavesdropper - decodes PDCCH for DCIs/RNTIs of ALL active users, IMSI collection, identity mapping, UE capability profiling, PCAP output | **HIGH** - C/C++, PCAP output, USRP compatible     | ACTIVE (WiSec 2023)           |
| FALCON LTE                    | github.com/falkenber9/falcon           | Fast Analysis of LTE Control Channels - real-time monitoring up to 20MHz, reveals all active devices with RNTIs and resource allocations, Qt GUI                         | **HIGH** - C/C++, Qt GUI, srsRAN-compatible SDRs   | MATURE (IEEE GLOBECOM 2019)   |
| QCSuper                       | github.com/P1sec/QCSuper               | Captures 2G/3G/4G air traffic using Qualcomm-based phones - turns any Qualcomm Android into passive cellular analyzer, PCAP output                                       | **VERY HIGH** - Python, PCAP output, no SDR needed | ACTIVE (P1 Security)          |
| Kalibrate-hackrf              | github.com/scateu/kalibrate-hackrf     | GSM base station scanner and frequency calibration - scans all GSM towers in range, identifies frequencies and offsets, HackRF-compatible                                | **VERY HIGH** - Uses HackRF (installed), C, CLI    | MATURE                        |
| LTE-Cell-Scanner              | github.com/Evrytania/LTE-Cell-Scanner  | Quick LTE cell detection and analysis - finds LTE cells in range, displays PCI, frequency, bandwidth, signal strength                                                    | **MEDIUM** - C++, RTL-SDR or USRP                  | MATURE                        |
| Modmobmap                     | github.com/Synacktiv-contrib/Modmobmap | Mobile network mapping - scans/maps all cell towers in range with frequencies, operators, signal strengths via phone modem                                               | **HIGH** - Python, CLI, JSON output                | ACTIVE (Synacktiv)            |
| OpenBTS (PentHertz)           | github.com/PentHertz/OpenBTS           | Updated rogue GSM base station for Ubuntu 22.04/24.04 - fake cell tower, forces LTE-to-GSM downgrade, call/SMS interception                                              | **MEDIUM** - Complex setup, requires USRP/BladeRF  | MATURE (2024 fork)            |
| Open5GS                       | github.com/open5gs/open5gs             | Complete 4G/5G core network (EPC + 5GC), 3GPP Release-17 - required backend for srsRAN to run full rogue LTE/5G base station                                             | **HIGH** - C, Docker-ready, 2.4K stars             | MATURE                        |
| YateBTS                       | github.com/yatevoip/yatebts            | Complete open-source GSM/UMTS base station - fake cell tower, IMSI catching, SMS interception, voice call interception                                                   | **LOW** - Complex setup, requires SDR              | MATURE (commercial open core) |
| srsRAN (Passive Sniffer Mode) | github.com/srsran/srsRAN               | Passive LTE/5G NR sniffer - IMSI/TMSI collection, cell broadcast monitoring, paging channel analysis, tracking area mapping                                              | **MEDIUM** - Requires USRP or LimeSDR              | MATURE                        |
| 5GBaseChecker                 | github.com/asset-group/5GBaseChecker   | 5G NSA security assessment - fake base station detection, downgrade attack identification, fake gNB identification                                                       | **LOW** - Requires commercial 5G modem             | RESEARCH                      |
| IMSI-catcher (Oros42)         | github.com/Oros42/IMSI-catcher         | Passive IMSI collection using RTL-SDR + gr-gsm, maps nearby cell towers and connected devices                                                                            | **HIGH** - RTL-SDR compatible, Python, map output  | ACTIVE                        |

### 2B: IMSI Catcher Detection (Defensive)

| Tool                          | Repository                                               | Capabilities                                                                                              | Argos Integration                                                       | Maturity           |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ |
| Rayhunter                     | github.com/EFF/rayhunter                                 | EFF's $20 IMSI catcher detector using Orbic mobile hotspot - red/green alerts, PCAP logging, Rust-based   | **VERY HIGH** - REST API, JSON output, cheap hardware, field-deployable | ACTIVE (2024-2025) |
| Crocodile Hunter              | github.com/EFF/crocodilehunter                           | EFF 4G/LTE fake base station detector using srsLTE - detects rogue eNodeBs, maps cell towers              | **HIGH** - Python, srsLTE-based, RPi 4 compatible                       | MATURE             |
| IMSICatcherDetector (Android) | github.com/CellularPrivacy/Android-IMSI-Catcher-Detector | Android app - fake BTS detection, IMSI catcher alerts, cell tower mapping, encryption downgrade detection | **LOW** - Mobile app, not Pi-compatible                                 | MATURE             |
| CellScan                      | Multiple sources                                         | Cell tower scanning and anomaly detection for identifying rogue base stations                             | **MEDIUM** - Varies by implementation                                   | ACTIVE             |
| AIMSICD / AIMSICDL            | github.com/CellularPrivacy/AIMSICD                       | Android IMSI-Catcher Detector - community fork with extended detection capabilities                       | **LOW** - Android only                                                  | MATURE             |

### 2C: GSM/Cellular Analysis Reference

| Tool                     | Repository                                 | Capabilities                                                                                     | Argos Integration        | Maturity  |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------ | --------- |
| Awesome-Cellular-Hacking | github.com/W00t3k/Awesome-Cellular-Hacking | Curated list of cellular security resources - 2G/3G/4G/5G tools, IMSI catching, SS7 exploitation | **N/A** - Reference list | REFERENCE |

---

## SECTION 3: HARDWARE ATTACK PLATFORMS

| Tool                        | Repository                                 | Capabilities                                                                                                                     | Argos Integration                          | Maturity                 |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| ESP32 Marauder              | github.com/justcallmekoko/ESP32Marauder    | WiFi/BT attack suite - deauth, beacon spam, packet sniffing, BLE attacks, EAPOL/PMKID scanning, Evil Portal, Flipper integration | **HIGH** - Serial/USB control from Argos   | MATURE (large community) |
| Flipper Zero (Unleashed FW) | github.com/DarkFlippers/unleashed-firmware | Extended firmware - unlocked SubGHz TX (315/433/868/915 MHz), NFC emulation, infrared, BadUSB                                    | **MEDIUM** - Can be controlled via CLI     | MATURE                   |
| M5Stack WiFi Toolkit        | github.com/M5Stack (various)               | ESP32 modular attack platform - deauth, captive portal, packet monitor, LCD display, battery powered, SD logging                 | **HIGH** - Similar to ESP32 Marauder       | ACTIVE                   |
| Pwnagotchi                  | github.com/evilsocket/pwnagotchi           | AI-powered RPi Zero W - deep reinforcement learning for autonomous handshake capture, mesh networking                            | **LOW** - Standalone (can share captures)  | MATURE                   |
| Minigotchi                  | github.com/dj1ch/minigotchi                | Pwnagotchi companion on ESP8266/ESP32 - smaller, cheaper, deauths for Pwnagotchi handshake capture                               | **MEDIUM** - Can be coordinated with Argos | ACTIVE                   |
| WiFi Pineapple Pi Ports     | github.com/hak5 (community forks)          | WiFi Pineapple attacks on RPi - rogue AP, MITM, captive portal, credential harvesting, PineAP client tracking                    | **HIGH** - Can integrate with Argos        | BETA                     |
| ESP8266 Deauther            | github.com/SpacehuhnTech/esp8266_deauther  | $3 WiFi deauth device - beacon flood, probe spam, deauth attacks, web UI, portable                                               | **HIGH** - Serial/web API control          | MATURE                   |
| LoRa Attack Toolkit (RAK)   | github.com/ioactive/laf                    | LoRaWAN security testing - packet injection, replay, DevAddr spoofing, frame counter bypass, gateway impersonation               | **MEDIUM** - Requires LoRa hardware module | RESEARCH                 |

---

## SECTION 4: IoT PROTOCOL EXPLOITATION

| Tool                        | Repository                                | Capabilities                                                                                                                                     | Argos Integration                                              | Maturity                   |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------- |
| LAF (LoRa Attack Framework) | github.com/IOActive/laf                   | LoRaWAN v1.0/1.1 attacks - OTAA/ABP bypass, ACK spoofing, gateway MITM                                                                           | **MEDIUM** - Requires LoRa transceiver                         | RESEARCH                   |
| SDR-LoRa                    | github.com/myriadrf/LoRa-SDR              | Software-defined LoRa PHY using LimeSDR/HackRF - signal gen, chirp spreading, jamming, downlink spoofing                                         | **HIGH** - HackRF compatible                                   | EXPERIMENTAL               |
| ZigDiggity                  | github.com/BishopFox/zigdiggity           | ZigBee assessment with RZUSBstick - sniffing, replay, key extraction, smart home exploitation                                                    | **LOW** - Requires specific hardware                           | MATURE (Bishop Fox)        |
| KillerBee                   | github.com/riverloopsec/killerbee         | 802.15.4/ZigBee framework - packet capture, key cracking, network mapping, smart lock exploitation                                               | **MEDIUM** - Requires Atmel/TI hardware                        | MATURE (industry standard) |
| Z3sec                       | github.com/IoTsec/Z3sec                   | ZigBee security testing - network analysis, touchlink attacks, key sniffing                                                                      | **MEDIUM** - Requires compatible hardware                      | ACTIVE                     |
| Zigator                     | github.com/akestoridis/zigator            | ZigBee traffic analyzer - packet parsing, encryption analysis, network visualization                                                             | **MEDIUM** - Python-based analysis                             | RESEARCH                   |
| Attify ZigBee Framework     | github.com/attify/attify-zigbee-framework | ZigBee pentesting framework with GUI - device discovery, packet sniffing, replay attacks                                                         | **MEDIUM** - GUI + CLI                                         | ACTIVE                     |
| Z-Wave Hacking Tools        | github.com/CoreSecurity/z-wave-research   | Z-Wave frame injection, S0/S2 key extraction, pairing hijacking, door lock exploitation                                                          | **LOW** - Requires Z-Wave SDR hardware                         | RESEARCH                   |
| MQTT Pwn                    | github.com/akamai/mqtt-pwn                | MQTT pentesting - broker discovery, topic enumeration, subscription hijacking, message injection, credential brute force                         | **MEDIUM** - Network-based                                     | MATURE (Akamai)            |
| rtl_433                     | github.com/merbanan/rtl_433               | **280+ device decoders** for ISM bands (433/315/868/915 MHz) - weather stations, tire pressure, security sensors, energy meters, medical devices | **VERY HIGH** - RTL-SDR, JSON output, MQTT, direct integration | MATURE (massive community) |

---

## SECTION 5: ADVANCED BLE EXPLOITATION

| Tool                 | Repository                               | Capabilities                                                                                                            | Argos Integration                         | Maturity             |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------- |
| ButteRFly            | github.com/whid-injector/ButteRFly       | ESP32-S3 BT Classic/BLE attacks - MAC spoofing, GATT fuzzing, HID keystroke injection                                   | **HIGH** - Serial control via Argos       | ACTIVE (2024)        |
| Mirage Framework     | github.com/RCayre/mirage                 | Multi-protocol wireless attacks - BLE, ZigBee, IR, Mosart - BLE MITM, MAC spoofing, unified interface                   | **MEDIUM** - CLI subprocess               | ACTIVE (academic)    |
| nRF52-Attack-Toolkit | github.com/nccgroup/nrf52-attack-toolkit | BLE attacks on nRF52 boards - MAC randomization bypass, pairing attacks, privacy mode exploitation                      | **MEDIUM** - Requires nRF52 DK            | RESEARCH (NCC Group) |
| BlueFang (ESP32)     | github.com/koutto/bluefang               | ESP32 BLE attacks - automated GATT discovery, characteristic fuzzing, connection exhaustion DoS, advertisement flooding | **HIGH** - ESP32 serial control           | ACTIVE (2023-2024)   |
| Sniffle              | github.com/nccgroup/Sniffle              | BT5 long range sniffer - all PHY modes (1M, 2M, Coded), connection following, advert sniffing on TI CC1352/CC26x2       | **HIGH** - Python API, JSON output        | MATURE (NCC Group)   |
| nRF Sniffer          | Nordic Semiconductor tools               | BLE packet capture for Wireshark using nRF52840 dongle - passive monitoring of all BLE channels                         | **MEDIUM** - Wireshark integration        | MATURE               |
| Bsniffhub            | github.com/nickelc/bsniffhub             | BLE sniffing hub - aggregates multiple BLE sniffers for comprehensive coverage                                          | **MEDIUM** - Can feed into Argos          | ACTIVE               |
| Bluing               | github.com/fO-000/bluing                 | Bluetooth recon/attack - device enumeration, service scanning, vulnerability detection, Classic + LE                    | **HIGH** - Python, CLI, structured output | ACTIVE               |
| BleedingTooth        | Linux kernel BT exploits                 | Linux Bluetooth stack RCE exploits (CVE-2020-12351/12352) - zero-click remote code execution via BT                     | **LOW** - Exploit research only           | RESEARCH             |
| BLE CTF Framework    | github.com/hackgnar/ble_ctf_infinity     | BLE security training platform - vulnerable GATT services for practice                                                  | **LOW** - Training tool                   | MATURE               |

---

## SECTION 6: ADVANCED WiFi PACKET INJECTION & EXPLOITATION

| Tool                  | Repository                               | Capabilities                                                                                                     | Argos Integration                             | Maturity                   |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------- |
| FragAttacks           | github.com/vanhoefm/fragattacks          | 802.11 design flaw exploits (CVE-2020-24588) - A-MSDU injection, mixed key attack, plaintext injection           | **MEDIUM** - Requires patched driver          | RESEARCH (KU Leuven)       |
| Bl0ck                 | github.com/MS-WinCrypt/bl0ck             | Intelligent WiFi deauth - client prioritization, MAC blacklist/whitelist, automated AP tracking, channel hopping | **HIGH** - Python subprocess                  | ACTIVE                     |
| WiFi-Injection-Tester | github.com/rpp0/wifi-injection           | Tests adapter injection capability - verifies monitor mode, injection support, benchmarks injection rate         | **HIGH** - Hardware validation                | MATURE (essential utility) |
| Scapy (Custom 802.11) | github.com/secdev/scapy                  | Custom 802.11 frame crafting - beacon injection, probe spoofing, EAP/EAPOL manipulation, fuzzing                 | **HIGH** - Python library, direct integration | MATURE (industry standard) |
| KRACK Attack Scripts  | github.com/vanhoefm/krackattacks-scripts | WPA2 4-way handshake manipulation - nonce reuse, packet decryption, client injection (CVE-2017-13077)            | **MEDIUM** - Requires research setup          | RESEARCH                   |
| VeilCast              | github.com/VeilCast                      | WiFi cloaking and evasion techniques for rogue AP operations                                                     | **MEDIUM** - Experimental                     | EXPERIMENTAL               |
| Hashcat               | github.com/hashcat/hashcat               | GPU-accelerated password cracking - WPA/WPA2/WPA3 handshake cracking, PMKID attacks                              | **HIGH** - CLI integration, rule-based        | MATURE (industry standard) |

---

## SECTION 7: RF DIRECTION FINDING & GEOLOCATION

> _Entirely from Claude research - not in user's original sections_

| Tool          | Repository                                    | Capabilities                                                                                                              | Argos Integration                                                                     | Maturity                          |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| KrakenSDR     | github.com/krakenrf/krakensdr_doa             | 5-channel coherent RTL-SDR array - direction of arrival (DOA) estimation using MUSIC algorithm, real-time bearing display | **VERY HIGH** - Python, JSON output, web UI, direct map integration, field-deployable | MATURE (commercial + open source) |
| DF Aggregator | github.com/krakenrf/krakensdr_doa (companion) | Aggregates multiple KrakenSDR units for triangulation - plots estimated transmitter location on map                       | **VERY HIGH** - Designed for multi-unit geolocation                                   | MATURE                            |
| rtl_coherent  | github.com/tejeez/rtl_coherent                | Coherent multi-RTL-SDR for direction finding using cheap dongles - experimental DOA                                       | **MEDIUM** - Requires multiple RTL-SDRs                                               | EXPERIMENTAL                      |

---

## SECTION 8: SDR SIGNAL ANALYSIS FRAMEWORKS

> _Entirely from Claude research_

| Tool                         | Repository                          | Capabilities                                                                                                                                           | Argos Integration                                                    | Maturity                         |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------- |
| FISSURE                      | github.com/ainfosec/FISSURE         | **Comprehensive RF framework** - signal detection, classification, protocol discovery, attack execution, fuzzing, TAK integration, 100+ attack scripts | **VERY HIGH** - Python, TAK integration, modular, covers 24-6000 MHz | MATURE (1871 stars, gov/mil use) |
| Universal Radio Hacker (URH) | github.com/jopohl/urh               | Complete wireless protocol investigation - demodulation, analysis, attack tools, supports all common SDR hardware                                      | **HIGH** - Python, extensive API                                     | MATURE (large community)         |
| QSpectrumAnalyzer            | github.com/xmikos/qspectrumanalyzer | Real-time spectrum analyzer GUI using hackrf_sweep or rtl_power - waterfall display, peak detection                                                    | **MEDIUM** - Qt-based, can extract data                              | MATURE                           |
| hackrf_sweep                 | Part of HackRF tools                | Ultra-fast spectrum sweep - 8 GHz/sec scanning bandwidth, feeds into analysis tools                                                                    | **VERY HIGH** - Already using HackRF hardware                        | MATURE                           |
| Inspectrum                   | github.com/miek/inspectrum          | RF signal analysis tool - visualize and decode recorded RF signals, drag-to-measure, demodulation                                                      | **MEDIUM** - GUI analysis tool                                       | MATURE                           |

---

## SECTION 9: ADS-B / MARITIME / AIRCRAFT SURVEILLANCE

> _Entirely from Claude research_

| Tool        | Repository                         | Capabilities                                                                                         | Argos Integration                                                  | Maturity                   |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| dump1090    | github.com/antirez/dump1090        | ADS-B aircraft decoder using RTL-SDR - plots aircraft on map with altitude, speed, heading, callsign | **VERY HIGH** - JSON output, web interface, direct map integration | MATURE (industry standard) |
| tar1090     | github.com/wiedehopf/tar1090       | Enhanced ADS-B web interface - better mapping, history, trail display, multi-receiver                | **HIGH** - Designed as dump1090 frontend                           | MATURE                     |
| readsb      | github.com/wiedehopf/readsb        | Drop-in dump1090 replacement with improved performance - better decoding, reduced CPU                | **HIGH** - Same interface as dump1090                              | MATURE                     |
| AIS-catcher | github.com/jvde-github/AIS-catcher | Maritime vessel tracking via AIS signals using RTL-SDR - ship positions, identities on map           | **HIGH** - JSON output, web interface                              | MATURE                     |

---

## SECTION 10: SUB-GHz & ISM BAND TOOLS

> _Partially from both lists_

| Tool                   | Repository                             | Capabilities                                                                                            | Argos Integration                       | Maturity                   |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------- |
| RFcat / Yard Stick One | github.com/atlas0fd00m/rfcat           | Sub-GHz (300-928 MHz) transceiver - packet sniffing, replay, jamming, protocol analysis using TI CC1111 | **HIGH** - Python API, scriptable       | MATURE                     |
| Proxmark3              | github.com/RfidResearchGroup/proxmark3 | RFID/NFC swiss-army tool - clone cards, sniff credentials, emulate tags, brute force, 125kHz + 13.56MHz | **HIGH** - CLI interface, Lua scripting | MATURE (industry standard) |

---

## SECTION 11: NETWORK RECONNAISSANCE & FINGERPRINTING

> _Entirely from Claude research_

| Tool        | Repository                     | Capabilities                                                                                                | Argos Integration                         | Maturity      |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------- |
| nDPI        | github.com/ntop/nDPI           | Deep packet inspection library - identifies 300+ protocols and applications from network traffic            | **HIGH** - C library with Python bindings | MATURE (ntop) |
| p0f         | github.com/p0f/p0f             | Passive OS fingerprinting - identifies operating systems from TCP/IP stack behavior without active scanning | **HIGH** - Passive, no detection risk     | MATURE        |
| Satori      | github.com/xnih/satori         | Device fingerprinting via DHCP, CDP, mDNS, UPnP - identifies device type, OS, manufacturer                  | **MEDIUM** - Python-based                 | ACTIVE        |
| CryptoLyzer | github.com/c0r0n3r/cryptolyzer | TLS/SSL analysis tool - identifies cipher suites, vulnerabilities, misconfigurations                        | **MEDIUM** - Python library               | ACTIVE        |
| Responder   | github.com/lgandx/Responder    | LLMNR/NBT-NS/mDNS poisoner + credential harvester - captures NTLMv2 hashes on network                       | **HIGH** - Python, field-deployable       | MATURE        |
| Ettercap    | github.com/Ettercap/ettercap   | Network MITM framework - ARP spoofing, DNS spoofing, credential sniffing, plugin system                     | **MEDIUM** - CLI mode available           | MATURE        |

---

## SECTION 12: ELECTROMAGNETIC / TEMPEST

> _Entirely from Claude research_

| Tool       | Repository                          | Capabilities                                                                                                | Argos Integration                  | Maturity |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| TempestSDR | github.com/martinmarinov/TempestSDR | Eavesdrop on monitors/screens via electromagnetic emanations using SDR - reconstructs video from EM leakage | **MEDIUM** - Requires wideband SDR | RESEARCH |

---

## SECTION 13: WIRELESS PERIPHERAL ATTACKS

> _Entirely from Claude research_

| Tool               | Repository                            | Capabilities                                                                                            | Argos Integration             | Maturity                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------- |
| MouseJack / JackIt | github.com/BastilleResearch/mousejack | Exploit non-Bluetooth wireless keyboards/mice - keystroke injection, mouse spoofing using CrazyRadio PA | **HIGH** - Python, USB dongle | MATURE (Bastille Research) |

---

## SECTION 14: WARDRIVING & FIELD MAPPING

> _Entirely from Claude research_

| Tool         | Repository                        | Capabilities                                                                                               | Argos Integration                                                 | Maturity |
| ------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Sparrow-WiFi | github.com/ghostop14/sparrow-wifi | Field WiFi + Bluetooth analyzer with GPS - hunt mode for signal tracking, 2.4/5 GHz scanning, BT detection | **VERY HIGH** - Python, GPS integration, field-ready, tactical UI | MATURE   |
| WiGLE        | wigle.net + API                   | Global wardriving database - WiFi/BT/cell tower mapping, historical data, network lookup API               | **HIGH** - REST API for network lookups                           | MATURE   |

---

## SECTION 15: TAK/CoT PROTOCOL & COUNTER-ATAK OPERATIONS

> _Verified tools for detecting, analyzing, and interacting with TAK (Team Awareness Kit) / Cursor-on-Target tactical networks. All tools are standalone and must be assembled into a pipeline._

### 15A: RF Reconnaissance & Device Fingerprinting

| Tool                                   | Repository                             | Capabilities                                                                                                                                                                                                                                                                  | Argos Integration                                                                              | Maturity |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| **ATAKRR** (ATAK Radio Reconnaissance) | github.com/ATAKRR/atakrr               | AI/ML automatic modulation classification (AMC), RF device fingerprinting, triangulation/trilateration, passive wideband spectrum monitoring (1-6 GHz via HackRF), deep learning models (CNN, RNN, Transformer), ATAK CoT map overlay with transmitter locations and heatmaps | **VERY HIGH** - Direct HackRF integration, CoT output, Python, field-deployable, BSD-2 license | ACTIVE   |
| trackerjacker                          | github.com/calebmadrigal/trackerjacker | WiFi device tracking without association - probe request sniffing, MAC address tracking, signal strength mapping, device vendor ID, movement patterns                                                                                                                         | **HIGH** - Python, pip install, can feed MAC data to Argos/Kismet                              | MATURE   |
| find-lf                                | github.com/schollz/find-lf             | Multi-sensor WiFi positioning using RPi nodes - sniffs probe requests from multiple positions for triangulation                                                                                                                                                               | **HIGH** - RPi-based distributed sensors, similar architecture to Argos                        | ACTIVE   |

### 15B: TAK Protocol Libraries & CoT Manipulation

| Tool                    | Repository                               | Capabilities                                                                                                                                   | Argos Integration                                                                                                          | Maturity             |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| takproto                | pypi.org/project/takproto                | Python library for encoding/decoding TAK Protocol Protobuf data - parse and generate Cursor-on-Target (CoT) messages, supports TAK Protocol v1 | **VERY HIGH** - Core library enabling Argos to speak CoT natively, push device detections to any TAK server or ATAK device | MATURE (MIT license) |
| pytak                   | github.com/snstac/pytak                  | Higher-level Python TAK client/server framework built on takproto - handles connections, authentication, message routing                       | **VERY HIGH** - Foundation library for all snstac gateways, enables Argos to act as a TAK data source                      | MATURE               |
| push-cursor-on-target   | github.com/sofwerx/push-cursor-on-target | Standalone CoT message sender - push fake or real position location info (PLI) to ATAK devices via UDP/TCP                                     | **MEDIUM** - Simple utility for CoT injection, requires network connectivity to TAK server                                 | ACTIVE               |
| cotproxy                | github.com/snstac/cotproxy               | In-line CoT transformation proxy - intercept and modify CoT messages as they transit between TAK devices and servers                           | **MEDIUM** - MITM for TAK traffic, modify coordinates in transit, inject delay, alter mission data                         | ACTIVE               |
| Wireshark TAK Dissector | github.com/jmkeyes/wireshark-tak-plugin  | Lua-based Wireshark dissector for TAK/CoT protocol - deep packet inspection of TAK traffic, CoT XML/Protobuf parsing                           | **MEDIUM** - Passive analysis, extract coordinates from CoT messages, identify device types                                | MATURE               |

### 15C: snstac CoT Gateway Ecosystem

> _Sensors & Signals LLC (github.com/snstac) - 61+ repos. Each gateway converts one sensor data source into CoT messages for TAK Server. Modular: deploy individually or combine._

| Tool     | Repository                 | Capabilities                                                                                     | Argos Integration                                          | Maturity |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------- |
| adsbcot  | github.com/snstac/adsbcot  | ADS-B aircraft data → CoT gateway. Bridges dump1090/readsb aircraft tracks directly onto TAK map | **VERY HIGH** - Bridges existing dump1090 data to TAK      | MATURE   |
| dronecot | github.com/snstac/dronecot | Drone Remote ID → CoT gateway. Converts drone detection data to TAK map markers                  | **VERY HIGH** - Bridges DJI DroneID decoder data to TAK    | MATURE   |
| aiscot   | github.com/snstac/aiscot   | AIS maritime vessel data → CoT gateway. Ships from AIS-catcher appear on TAK map                 | **HIGH** - Bridges existing AIS-catcher data to TAK        | MATURE   |
| djicot   | github.com/snstac/djicot   | DJI drone telemetry → CoT gateway. Specifically handles DJI protocol data for TAK display        | **HIGH** - Complementary to dronecot for DJI-specific data | ACTIVE   |
| aprscot  | github.com/snstac/aprscot  | APRS amateur radio position data → CoT gateway. Ham radio position reports on TAK map            | **MEDIUM** - Niche but useful for APRS-equipped assets     | MATURE   |
| inrcot   | github.com/snstac/inrcot   | Garmin inReach satellite tracker → CoT gateway. Off-grid asset tracking via satellite            | **MEDIUM** - Satellite-based position tracking             | ACTIVE   |
| spotcot  | github.com/snstac/spotcot  | Spot satellite tracker → CoT gateway. Alternative satellite position tracking                    | **LOW** - Niche satellite tracking                         | ACTIVE   |

### 15D: Meshtastic/LoRa Mesh Attack Tools

| Tool                            | Repository                                              | Capabilities                                                                                                                                                               | Argos Integration                                                                                                          | Maturity |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Meshtastic Frequency Calculator | github.com/heypete/meshtastic_frequency_slot_calculator | Calculate exact frequency slots for any Meshtastic channel name using djb2 hash algorithm - enables precise RF targeting of specific mesh channels in 902-928 MHz ISM band | **HIGH** - Frequency planning for targeted jamming/monitoring, also available as web calculator at calc.mesh.badpirate.net | MATURE   |
| ATAK Meshtastic Plugin          | github.com/meshtastic/ATAK-Plugin                       | Official plugin enabling CoT messaging over Meshtastic LoRa mesh - position sharing, chat, file transfer between ATAK devices without internet                             | **MEDIUM** - Understanding target protocol, reveals how adversary ATAK+Meshtastic networks operate                         | MATURE   |

### 15E: Known Vulnerabilities (Reference)

| CVE                 | Affected             | Description                                                                                                                            | Tactical Relevance                                                                                                      |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **CVE-2025-55292**  | Meshtastic < v2.7.6  | HAM mode authentication bypass via NodeID forging - enables message interception and node impersonation on any Meshtastic mesh network | If adversary runs unpatched Meshtastic firmware, allows passive interception and active injection into their mesh comms |
| CVE-2025-55293      | Meshtastic < v2.7.6  | Additional auth bypass variant                                                                                                         | Same tactical relevance as above                                                                                        |
| CVE-2025-24797      | Meshtastic < v2.6.11 | Low-entropy key generation, repeated public/private keypairs                                                                           | Cryptographic weakness enabling traffic decryption                                                                      |
| GHSA-gq7v-jr8c-mfr7 | Meshtastic < v2.6.11 | MQTT impersonation and PKC decoding vulnerabilities                                                                                    | Network-level compromise of mesh communications                                                                         |

---

## TOP 20 PRIORITY TOOLS FOR ARGOS INTEGRATION

Ranked by integration value, field-deployability, and capability gap they fill:

| Rank | Tool                          | Category             | Integration | Why Priority                                                                                                                                                                          |
| ---- | ----------------------------- | -------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **FISSURE**                   | SDR Framework        | VERY HIGH   | All-in-one RF framework, TAK integration, 100+ attacks, replaces multiple tools                                                                                                       |
| 2    | **ATAKRR**                    | TAK/Counter-ATAK     | VERY HIGH   | HackRF RF fingerprinting + AI/ML modulation classification + triangulation + ATAK map overlay. THE tool for detecting and locating adversary devices in the field. Direct CoT output. |
| 3    | **snstac CoT Gateways**       | TAK/CoT Protocol     | VERY HIGH   | adsbcot + dronecot + aiscot + djicot bridge ALL your existing sensors (dump1090, AIS-catcher, DroneID) directly onto TAK maps. Turns Argos into a TAK data source.                    |
| 4    | **takproto + pytak**          | TAK/CoT Protocol     | VERY HIGH   | Core libraries enabling Argos to speak CoT natively - push every device detection to any TAK server or ATAK device. Makes Argos TAK-interoperable.                                    |
| 5    | **Rayhunter**                 | IMSI Detection       | VERY HIGH   | $20 hardware, REST API, real-time alerts, fills critical defensive gap                                                                                                                |
| 6    | **KrakenSDR**                 | RF Direction Finding | VERY HIGH   | Find ANY transmitter on map, MUSIC algorithm, multi-unit triangulation                                                                                                                |
| 7    | **DJI DroneID Decoder**       | Drone Detection      | VERY HIGH   | Passive drone detection, extracts GPS/serial/operator from DJI drones                                                                                                                 |
| 8    | **rtl_433**                   | ISM Band Decoder     | VERY HIGH   | 280+ device types decoded, JSON/MQTT output, massive passive intelligence                                                                                                             |
| 9    | **dump1090**                  | ADS-B Surveillance   | VERY HIGH   | Aircraft on your tactical map, JSON output, low CPU                                                                                                                                   |
| 10   | **ESP32 Marauder**            | Hardware Platform    | HIGH        | Multi-attack hardware, serial control, compact, field-proven                                                                                                                          |
| 11   | **Sparrow-WiFi**              | Field Mapping        | VERY HIGH   | WiFi+BT analyzer with GPS hunt mode, tactical-ready                                                                                                                                   |
| 12   | **hackrf_sweep**              | Spectrum Analysis    | VERY HIGH   | 8 GHz/sec sweep, you already have HackRF hardware                                                                                                                                     |
| 13   | **Sniffle**                   | BLE Sniffing         | HIGH        | BT5 all PHY modes, Python API, NCC Group quality                                                                                                                                      |
| 14   | **GPS-SDR-SIM**               | GPS Spoofing         | HIGH        | Direct HackRF GPS spoofing, Python-friendly                                                                                                                                           |
| 15   | **Meshtastic Freq Calc**      | LoRa Mesh Targeting  | HIGH        | Calculate exact Meshtastic channel frequencies for targeted monitoring/jamming of adversary mesh comms                                                                                |
| 16   | **ESP32 WiFi Drone Disabler** | Drone Defeat         | HIGH        | Portable, battery-powered, API-controllable                                                                                                                                           |
| 17   | **Scapy**                     | WiFi Crafting        | HIGH        | Custom frame crafting, Python library, infinite flexibility                                                                                                                           |
| 18   | **AIS-catcher**               | Maritime             | HIGH        | Ship tracking on tactical map, JSON output                                                                                                                                            |
| 19   | **Proxmark3**                 | RFID/NFC             | HIGH        | Physical access card cloning, industry standard                                                                                                                                       |
| 20   | **Crocodile Hunter**          | IMSI Detection       | HIGH        | EFF 4G fake BTS detector, RPi compatible                                                                                                                                              |

---

## TOTAL INVENTORY SUMMARY

| Category                                   | Tool Count                 | New to Argos |
| ------------------------------------------ | -------------------------- | ------------ |
| Counter-UAS: Active Defeat                 | 7                          | 7            |
| Counter-UAS: Passive Detection             | 5                          | 5            |
| Cellular: IMSI Catching & LTE Surveillance | 12                         | 12           |
| Cellular: IMSI Detection (Defensive)       | 5                          | 5            |
| Hardware Attack Platforms                  | 8                          | 8            |
| IoT Protocol Exploitation                  | 10                         | 10           |
| Advanced BLE Exploitation                  | 10                         | 10           |
| Advanced WiFi Exploitation                 | 7                          | 7            |
| RF Direction Finding                       | 3                          | 3            |
| SDR Analysis Frameworks                    | 5                          | 5            |
| ADS-B / Maritime Surveillance              | 4                          | 4            |
| Sub-GHz & RFID/NFC                         | 2                          | 2            |
| Network Reconnaissance                     | 6                          | 6            |
| TEMPEST / Electromagnetic                  | 1                          | 1            |
| Wireless Peripheral Attacks                | 1                          | 1            |
| Wardriving & Field Mapping                 | 2                          | 2            |
| TAK/CoT: RF Recon & Device Tracking        | 3                          | 3            |
| TAK/CoT: Protocol Libraries & Manipulation | 5                          | 5            |
| TAK/CoT: snstac CoT Gateways               | 7                          | 7            |
| TAK/CoT: Meshtastic/LoRa Mesh              | 2                          | 2            |
| TAK/CoT: Known Vulnerabilities (CVEs)      | 4 ref                      | —            |
| **TOTAL**                                  | **105 tools + 4 CVE refs** | **105**      |

> All 105 tools are additions beyond the original 20-tool Argos arsenal, bringing the combined potential to **125 integrated tools** across 20 categories. The TAK/CoT section adds critical interoperability with the military TAK ecosystem used by ATAK, WinTAK, and iTAK devices.
