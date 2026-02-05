# RF Reconnaissance & Device Fingerprinting

Tools for passive detection and tracking of devices through RF emissions, WiFi probe requests, and signal strength triangulation. Focused on locating and identifying adversary devices in the field.

## Tools (3)

| Tool                                   | Repository                             | Capabilities                                                                                                                                                                                                                                                                  | Argos Integration                                                                              | Maturity |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| **ATAKRR** (ATAK Radio Reconnaissance) | github.com/ATAKRR/atakrr               | AI/ML automatic modulation classification (AMC), RF device fingerprinting, triangulation/trilateration, passive wideband spectrum monitoring (1-6 GHz via HackRF), deep learning models (CNN, RNN, Transformer), ATAK CoT map overlay with transmitter locations and heatmaps | **VERY HIGH** - Direct HackRF integration, CoT output, Python, field-deployable, BSD-2 license | ACTIVE   |
| trackerjacker                          | github.com/calebmadrigal/trackerjacker | WiFi device tracking without association - probe request sniffing, MAC address tracking, signal strength mapping, device vendor ID, movement patterns                                                                                                                         | **HIGH** - Python, pip install, can feed MAC data to Argos/Kismet                              | MATURE   |
| find-lf                                | github.com/schollz/find-lf             | Multi-sensor WiFi positioning using RPi nodes - sniffs probe requests from multiple positions for triangulation                                                                                                                                                               | **HIGH** - RPi-based distributed sensors, similar architecture to Argos                        | ACTIVE   |

## Hardware Requirements

- HackRF One (ATAKRR - wideband 1-6 GHz monitoring)
- WiFi adapter with monitor mode (trackerjacker)
- Multiple Raspberry Pi nodes (find-lf distributed positioning)

## Priority Note

**ATAKRR** is the #2 priority tool for Argos integration - it provides:

- AI/ML-powered RF device fingerprinting for unique device identification
- Triangulation/trilateration to locate transmitters on the map
- Direct HackRF sensor integration (you already have this hardware)
- Native ATAK CoT output for TAK ecosystem interoperability
- Fog Computing architecture for centralized multi-sensor processing

Documentation: https://jackd.ethertech.org/atakrr/

## Integration Architecture

```
HackRF Sensors (distributed) → ATAKRR Mothership (Fog Computing)
                                    ├── RF Fingerprint Database
                                    ├── AI/ML Classification (CNN/RNN/Transformer)
                                    ├── Triangulation Engine
                                    └── CoT Output → TAK Server → ATAK Map Overlay
                                                   → Argos Tactical Map
```
