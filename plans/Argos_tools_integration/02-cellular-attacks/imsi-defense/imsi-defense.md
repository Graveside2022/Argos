# IMSI Catcher Detection (Defensive)

Tools for detecting fake base stations, rogue cell towers, and IMSI catchers in the area. Defensive counterpart to IMSI catching tools.

## Tools (5)

| Tool                          | Repository                                               | Capabilities                                                                                              | Argos Integration                                                       | Maturity           |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ |
| Rayhunter                     | github.com/EFForg/rayhunter                              | EFF's $20 IMSI catcher detector using Orbic mobile hotspot - red/green alerts, PCAP logging, Rust-based   | **VERY HIGH** - REST API, JSON output, cheap hardware, field-deployable | ACTIVE (2024-2025) |
| Crocodile Hunter              | github.com/EFForg/crocodilehunter                        | EFF 4G/LTE fake base station detector using srsLTE - detects rogue eNodeBs, maps cell towers              | **HIGH** - Python, srsLTE-based, RPi 4 compatible                       | MATURE             |
| IMSICatcherDetector (Android) | github.com/CellularPrivacy/Android-IMSI-Catcher-Detector | Android app - fake BTS detection, IMSI catcher alerts, cell tower mapping, encryption downgrade detection | **LOW** - Mobile app, not Pi-compatible                                 | MATURE             |
| CellScan                      | Multiple sources                                         | Cell tower scanning and anomaly detection for identifying rogue base stations                             | **MEDIUM** - Varies by implementation                                   | ACTIVE             |
| AIMSICD / AIMSICDL            | github.com/CellularPrivacy/AIMSICD                       | Android IMSI-Catcher Detector - community fork with extended detection capabilities                       | **LOW** - Android only                                                  | MATURE             |

## Hardware Requirements

- Orbic RC400L mobile hotspot (~$20) for Rayhunter
- USRP or compatible SDR for Crocodile Hunter
- Android device for AIMSICD/IMSICatcherDetector

## Priority Note

**Rayhunter** is a top-5 priority tool for Argos - $20 hardware cost, REST API for integration, real-time IMSI catcher alerts, and PCAP logging for forensics. Field-proven by EFF.
