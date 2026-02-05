# RFID & Sub-GHz

Sub-GHz RF tools for the 300-928 MHz range (replay, jamming, brute force) and RFID/NFC security testing for access card cloning and emulation.

---

## Installed on Argos (3)

| Tool          | Type            | Description                                                                                    |
| ------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| **JamRF**     | RF Jamming      | Broadband RF jamming tool for disrupting wireless communications                               |
| **CleverJAM** | RF Jamming      | Smart RF jammer with adaptive frequency targeting and power control                            |
| **RFCrack**   | Sub-GHz Attacks | Sub-GHz attack tool - replay, brute force, jamming for garage doors, car key fobs, IoT devices |

---

## Available for Integration (2)

| Tool                   | Repository                             | Capabilities                                                                                            | Argos Integration                       | Maturity |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------- |
| RFcat / Yard Stick One | github.com/atlas0fd00m/rfcat           | Sub-GHz (300-928 MHz) transceiver - packet sniffing, replay, jamming, protocol analysis using TI CC1111 | **HIGH** - Python API, scriptable       | MATURE   |
| Proxmark3              | github.com/RfidResearchGroup/proxmark3 | RFID/NFC swiss-army tool - clone cards, sniff credentials, emulate tags, brute force, 125kHz + 13.56MHz | **HIGH** - CLI interface, Lua scripting | MATURE   |

## Hardware Requirements

- HackRF One (installed - used by JamRF, CleverJAM)
- Yard Stick One (~$100) for RFcat
- Proxmark3 RDV4 (~$300) or Easy (~$50) for RFID/NFC
