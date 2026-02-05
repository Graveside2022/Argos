# ADS-B / Maritime / Aircraft Surveillance

Tools for tracking aircraft via ADS-B transponder signals and maritime vessels via AIS broadcasts using RTL-SDR receivers. Provides real-time position, identity, and trajectory data for tactical map display.

## Tools (4)

| Tool        | Repository                         | Capabilities                                                                                         | Argos Integration                                                  | Maturity                   |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| dump1090    | github.com/antirez/dump1090        | ADS-B aircraft decoder using RTL-SDR - plots aircraft on map with altitude, speed, heading, callsign | **VERY HIGH** - JSON output, web interface, direct map integration | MATURE (industry standard) |
| tar1090     | github.com/wiedehopf/tar1090       | Enhanced ADS-B web interface - better mapping, history, trail display, multi-receiver                | **HIGH** - Designed as dump1090 frontend                           | MATURE                     |
| readsb      | github.com/wiedehopf/readsb        | Drop-in dump1090 replacement with improved performance - better decoding, reduced CPU                | **HIGH** - Same interface as dump1090                              | MATURE                     |
| AIS-catcher | github.com/jvde-github/AIS-catcher | Maritime vessel tracking via AIS signals using RTL-SDR - ship positions, identities on map           | **HIGH** - JSON output, web interface                              | MATURE                     |

## Hardware Requirements

- RTL-SDR with 1090 MHz antenna (ADS-B)
- RTL-SDR with VHF antenna (AIS - 161.975/162.025 MHz)
- Can run both simultaneously with two dongles

## Priority Note

**dump1090** is a top-10 priority tool - aircraft appear on your tactical map with full telemetry using a $30 RTL-SDR. JSON API integrates directly with Argos. Pairs with **adsbcot** (Section 15) to bridge aircraft data into TAK ecosystem.

## Integration Architecture

```
RTL-SDR (1090 MHz) → dump1090/readsb → JSON API → Argos tactical map
                                      → adsbcot → TAK Server → ATAK devices

RTL-SDR (VHF)      → AIS-catcher     → JSON API → Argos tactical map
                                      → aiscot  → TAK Server → ATAK devices
```
