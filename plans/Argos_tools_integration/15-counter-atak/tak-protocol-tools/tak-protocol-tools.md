# TAK Protocol Libraries & CoT Manipulation

Core libraries and utilities for encoding, decoding, sending, intercepting, and modifying Cursor-on-Target (CoT) messages used by TAK (Team Awareness Kit) devices and servers.

## Tools (5)

| Tool                    | Repository                               | Capabilities                                                                                                                                   | Argos Integration                                                                                                          | Maturity             |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| takproto                | pypi.org/project/takproto                | Python library for encoding/decoding TAK Protocol Protobuf data - parse and generate Cursor-on-Target (CoT) messages, supports TAK Protocol v1 | **VERY HIGH** - Core library enabling Argos to speak CoT natively, push device detections to any TAK server or ATAK device | MATURE (MIT license) |
| pytak                   | github.com/snstac/pytak                  | Higher-level Python TAK client/server framework built on takproto - handles connections, authentication, message routing                       | **VERY HIGH** - Foundation library for all snstac gateways, enables Argos to act as a TAK data source                      | MATURE               |
| push-cursor-on-target   | github.com/sofwerx/push-cursor-on-target | Standalone CoT message sender - push fake or real position location info (PLI) to ATAK devices via UDP/TCP                                     | **MEDIUM** - Simple utility for CoT injection, requires network connectivity to TAK server                                 | ACTIVE               |
| cotproxy                | github.com/snstac/cotproxy               | In-line CoT transformation proxy - intercept and modify CoT messages as they transit between TAK devices and servers                           | **MEDIUM** - MITM for TAK traffic, modify coordinates in transit, inject delay, alter mission data                         | ACTIVE               |
| Wireshark TAK Dissector | github.com/jmkeyes/wireshark-tak-plugin  | Lua-based Wireshark dissector for TAK/CoT protocol - deep packet inspection of TAK traffic, CoT XML/Protobuf parsing                           | **MEDIUM** - Passive analysis, extract coordinates from CoT messages, identify device types                                | MATURE               |

## Installation

```bash
# Core libraries
pip install takproto --break-system-packages
pip install pytak --break-system-packages

# Wireshark plugin
git clone https://github.com/jmkeyes/wireshark-tak-plugin
# Copy Lua files to Wireshark plugins directory
```

## Priority Note

**takproto + pytak** are #4 priority for Argos - they enable Argos to speak CoT natively. Every device Argos detects (WiFi, BLE, RF, cellular) can be pushed as a CoT marker to any TAK server, making Argos visible to all ATAK/WinTAK/iTAK users on the network.

## CoT Message Format

```xml
<!-- Example: Argos pushing a detected WiFi device to TAK -->
<event version="2.0" uid="ARGOS-WIFI-AA:BB:CC:DD:EE:FF"
       type="a-u-G" time="2025-01-15T12:00:00Z"
       start="2025-01-15T12:00:00Z" stale="2025-01-15T12:05:00Z"
       how="m-g">
  <point lat="34.0522" lon="-118.2437" hae="0" ce="50" le="0"/>
  <detail>
    <contact callsign="WiFi-Device-AABB"/>
    <remarks>MAC: AA:BB:CC:DD:EE:FF | SSID: TargetNetwork | Signal: -45dBm</remarks>
  </detail>
</event>
```
