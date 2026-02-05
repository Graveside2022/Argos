# snstac CoT Gateway Ecosystem

Modular Cursor-on-Target (CoT) gateways by Sensors & Signals LLC (github.com/snstac). Each gateway converts one sensor data source into CoT messages for TAK Server. Deploy individually or combine for comprehensive tactical awareness.

## Tools (7)

| Tool     | Repository                 | Capabilities                                                                                     | Argos Integration                                          | Maturity |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------- |
| adsbcot  | github.com/snstac/adsbcot  | ADS-B aircraft data → CoT gateway. Bridges dump1090/readsb aircraft tracks directly onto TAK map | **VERY HIGH** - Bridges existing dump1090 data to TAK      | MATURE   |
| dronecot | github.com/snstac/dronecot | Drone Remote ID → CoT gateway. Converts drone detection data to TAK map markers                  | **VERY HIGH** - Bridges DJI DroneID decoder data to TAK    | MATURE   |
| aiscot   | github.com/snstac/aiscot   | AIS maritime vessel data → CoT gateway. Ships from AIS-catcher appear on TAK map                 | **HIGH** - Bridges existing AIS-catcher data to TAK        | MATURE   |
| djicot   | github.com/snstac/djicot   | DJI drone telemetry → CoT gateway. Specifically handles DJI protocol data for TAK display        | **HIGH** - Complementary to dronecot for DJI-specific data | ACTIVE   |
| aprscot  | github.com/snstac/aprscot  | APRS amateur radio position data → CoT gateway. Ham radio position reports on TAK map            | **MEDIUM** - Niche but useful for APRS-equipped assets     | MATURE   |
| inrcot   | github.com/snstac/inrcot   | Garmin inReach satellite tracker → CoT gateway. Off-grid asset tracking via satellite            | **MEDIUM** - Satellite-based position tracking             | ACTIVE   |
| spotcot  | github.com/snstac/spotcot  | Spot satellite tracker → CoT gateway. Alternative satellite position tracking                    | **LOW** - Niche satellite tracking                         | ACTIVE   |

## Installation

```bash
# All gateways install via pip
pip install adsbcot --break-system-packages
pip install dronecot --break-system-packages
pip install aiscot --break-system-packages
pip install djicot --break-system-packages
pip install aprscot --break-system-packages
```

## Priority Note

**snstac CoT Gateways** are collectively the #3 priority for Argos - they bridge ALL existing sensor data (aircraft from dump1090, ships from AIS-catcher, drones from DroneID decoder) directly onto TAK maps without writing any custom code. Turns Argos into a multi-domain TAK data source.

## Integration Architecture

```
Argos Sensors                    snstac Gateways              TAK Ecosystem
─────────────                    ───────────────              ─────────────
dump1090 (aircraft)     ──→      adsbcot          ──→
AIS-catcher (ships)     ──→      aiscot           ──→       TAK Server
DJI DroneID decoder     ──→      dronecot/djicot  ──→         ├── ATAK (Android)
APRS radio              ──→      aprscot          ──→         ├── WinTAK (Windows)
Garmin inReach          ──→      inrcot           ──→         └── iTAK (iOS)
Spot tracker            ──→      spotcot          ──→
```

## Notes

- All gateways depend on **pytak** as their foundation library
- Each gateway is a standalone process that can be started/stopped independently
- Configuration via environment variables or config files
- The snstac organization maintains 61+ repositories in the TAK ecosystem
