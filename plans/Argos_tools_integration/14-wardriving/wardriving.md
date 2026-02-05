# Wardriving & Field Mapping

Field-deployable tools for WiFi and Bluetooth network discovery, signal strength mapping, GPS-correlated network databases, and tactical signal hunting.

---

## Installed on Argos (2)

| Tool           | Type            | Description                                                                                                      |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Kismet**     | WiFi/BT Scanner | Wireless network detector, sniffer, and IDS - passive WiFi/BT/BTLE/Zigbee scanning, device tracking, GPS logging |
| **WigleToTAK** | TAK Bridge      | WiGLE wardriving data integration for TAK systems - bridges WiFi/BT network data to tactical map                 |

---

## Available for Integration (2)

| Tool         | Repository                        | Capabilities                                                                                               | Argos Integration                                                 | Maturity |
| ------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Sparrow-WiFi | github.com/ghostop14/sparrow-wifi | Field WiFi + Bluetooth analyzer with GPS - hunt mode for signal tracking, 2.4/5 GHz scanning, BT detection | **VERY HIGH** - Python, GPS integration, field-ready, tactical UI | MATURE   |
| WiGLE        | wigle.net + API                   | Global wardriving database - WiFi/BT/cell tower mapping, historical data, network lookup API               | **HIGH** - REST API for network lookups                           | MATURE   |

## Hardware Requirements

- WiFi adapter with monitor mode (installed - Alfa AWUS036AXML)
- Bluetooth adapter (installed)
- GPS module (installed)

## Notes

- **Kismet** is already the primary WiFi/BT scanning engine on Argos
- **WigleToTAK** bridges wardriving data into the TAK ecosystem
- **Sparrow-WiFi** hunt mode adds real-time signal tracking for physically locating targets
