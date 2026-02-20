# Argos Mesh Networking & TAK Integration Architecture

## Overview

This document outlines the distributed mesh networking architecture for Argos, enabling multiple nodes to share SIGINT data and integrate with TAK (Team Awareness Kit) servers for tactical situational awareness in military training environments (NTC/JMRC).

## Use Case

Multiple Argos nodes (Raspberry Pi 5) deployed in the field, connected via Tailscale VPN, sharing real-time RF intelligence, WiFi discoveries, GPS data, and cellular intercepts. Data feeds into TAK servers for unified tactical picture.

---

## Architecture: Argos Mesh Network

### Node Configuration

- **Hardware**: Raspberry Pi 5 with HackRF One, WiFi adapters, GPS
- **Network**: Tailscale mesh VPN (secure, NAT-traversing)
- **Storage**: Local SQLite databases (per-node persistence)
- **Data Sharing**: Real-time WebSocket streaming between peers

### Mesh Topology

```
┌─────────────┐         Tailscale VPN Mesh          ┌─────────────┐
│  Argos RPi  │◄────────────────────────────────────►│  Argos RPi  │
│   Node 1    │                                      │   Node 2    │
│             │         ┌─────────────┐              │             │
│ • HackRF    │◄────────│  Argos RPi  │─────────────►│ • HackRF    │
│ • Kismet    │         │   Node 3    │              │ • Kismet    │
│ • GPS       │         │             │              │ • GPS       │
└─────────────┘         └─────────────┘              └─────────────┘
```

### Data Shared Between Nodes

- **RF Signal Detections**: Frequency, power, GPS coordinates, timestamp
- **WiFi Devices**: MAC address, SSID, signal strength, encryption, location
- **GSM IMSI Captures**: IMSI, frequency, cell tower, location
- **GPS Tracks**: Node position updates (for mobile deployments)
- **Node Status**: Hardware capabilities, online/offline, last seen

### Data Exchange Protocol

Each node broadcasts detection events over WebSocket:

```json
{
	"type": "rf_signal_detected",
	"node_id": "argos-01",
	"timestamp": "2026-02-06T12:34:56Z",
	"data": {
		"frequency": 2437000000,
		"power": -45,
		"gps": { "lat": 35.123, "lon": -118.456 }
	}
}
```

**Event Types:**

- `rf_signal_detected` - HackRF/USRP spectrum analysis
- `wifi_device_discovered` - Kismet WiFi detection
- `gsm_imsi_captured` - GSM Evil IMSI intercept
- `node_location_update` - GPS position update
- `node_status_heartbeat` - Health/capability announcement

---

## Bandwidth Requirements

### Per-Node Data Rates

| Data Type    | Packet Size | Rate               | Bandwidth          |
| ------------ | ----------- | ------------------ | ------------------ |
| RF Signals   | ~100 bytes  | 1-10/sec           | 0.1-1 KB/s         |
| WiFi Devices | ~500 bytes  | 1-2/sec per device | 10-25 KB/s (urban) |
| GPS Updates  | ~50 bytes   | 1 Hz               | 0.05 KB/s          |
| GSM IMSI     | ~100 bytes  | sporadic           | 0.1 KB/s           |
| Heartbeats   | ~200 bytes  | 0.1 Hz             | 0.04 KB/s          |

**Total per node: ~26 KB/s (0.2 Mbps)**

### Scaling Analysis

| Nodes    | Per-Node Receive | Per-Node Send | Total Mesh Traffic |
| -------- | ---------------- | ------------- | ------------------ |
| 2 nodes  | 26 KB/s          | 26 KB/s       | **0.4 Mbps**       |
| 5 nodes  | 104 KB/s         | 104 KB/s      | **1.7 Mbps**       |
| 10 nodes | 234 KB/s         | 234 KB/s      | **3.7 Mbps**       |

### Backhaul Options

| Connection   | Download    | Upload     | Verdict               |
| ------------ | ----------- | ---------- | --------------------- |
| **Starlink** | 50-200 Mbps | 10-40 Mbps | ✅ Massive overkill   |
| **5G**       | 50-300 Mbps | 10-50 Mbps | ✅ Massive overkill   |
| **4G LTE**   | 5-50 Mbps   | 2-10 Mbps  | ✅ Plenty of headroom |

**Conclusion**: Even slow 4G LTE (1-5 Mbps) can support 10+ nodes. Starlink or 5G provides massive capacity.

---

## TAK Server Integration

### Scenario 1: Direct TAK Connection (Independent Nodes)

```
┌─────────────┐                    ┌─────────────┐
│  Argos RPi  │──── CoT/TCP ──────►│             │
│   Node 1    │                    │ TAK Server  │
└─────────────┘                    │  (Local or  │
                                   │  Federated) │
┌─────────────┐                    │             │
│  Argos RPi  │──── CoT/TCP ──────►│             │
│   Node 2    │                    └─────────────┘
└─────────────┘
```

**Configuration:**

- Each Argos node has independent TAK server connection
- Nodes send their own detections directly to TAK
- Supports federated TAK servers (multiple TAK servers syncing)

**Use Case:**

- Nodes have reliable backhaul connectivity
- Distributed command structure
- Redundancy (if one node loses TAK connection, others continue)

---

### Scenario 2: Relay/Gateway Mode (Single TAK Connection)

```
┌─────────────┐
│  Argos RPi  │ (Field Node - No TAK Connection)
│   Node 1    │
└──────┬──────┘
       │
       │ Tailscale Mesh
       │ (Detection Events)
       ▼
┌─────────────┐        CoT/TCP         ┌─────────────┐
│  Argos RPi  │─────────────────────►  │ TAK Server  │
│   Node 2    │   (Aggregated Data)    │             │
│  (Gateway)  │                        └─────────────┘
└─────────────┘
```

**Configuration:**

- **Node 1** (field): Collects RF/WiFi/GPS data, no direct TAK connection
- **Node 2** (gateway): Connected to TAK Server (at TOC/base)
- **Node 2** receives Node 1's data via Tailscale mesh
- **Node 2** converts and forwards ALL data (own + Node 1's) to TAK

**Use Case:**

- Limited backhaul availability in field
- Centralized TAK connection at base/TOC
- Reduced network complexity

---

### Scenario 3: Federated TAK (Multi-Server)

```
┌─────────────┐                    ┌─────────────┐
│  Argos RPi  │──── CoT/TCP ──────►│ TAK Server  │
│   Node 1    │                    │      A      │
└─────────────┘                    └──────┬──────┘
                                          │
                                   Federation Link
                                          │
┌─────────────┐                    ┌──────▼──────┐
│  Argos RPi  │──── CoT/TCP ──────►│ TAK Server  │
│   Node 2    │                    │      B      │
└─────────────┘                    └─────────────┘
```

**Configuration:**

- Multiple TAK servers (e.g., battalion/brigade/division)
- Argos nodes connect to nearest TAK server
- TAK servers sync via federation protocol
- Unified tactical picture across all TAK clients

**Use Case:**

- Large-scale operations (NTC/JMRC rotations)
- Multi-echelon command structure
- Resilient architecture

---

## TAK Integration Technical Details

### Cursor on Target (CoT) Protocol

Argos detections are converted to CoT XML messages for TAK consumption.

**RF Signal Detection:**

```xml
<event version="2.0" uid="argos-01-signal-12345" type="b-m-p-s-m"
       time="2026-02-06T12:34:56Z" start="2026-02-06T12:34:56Z"
       stale="2026-02-06T12:39:56Z">
  <point lat="35.123" lon="-118.456" hae="100" ce="10" le="10"/>
  <detail>
    <contact callsign="RF-2437MHz"/>
    <remarks>Power: -45dBm, Bandwidth: 20MHz, Source: argos-01</remarks>
    <link uid="argos-01" relation="p-p" type="a-f-G-E-S"/>
  </detail>
</event>
```

**WiFi Device Discovery:**

```xml
<event version="2.0" uid="argos-02-wifi-AA:BB:CC:DD:EE:FF" type="a-f-G-E-S"
       time="2026-02-06T12:34:56Z" start="2026-02-06T12:34:56Z"
       stale="2026-02-06T12:44:56Z">
  <point lat="35.124" lon="-118.457" hae="100" ce="15" le="10"/>
  <detail>
    <contact callsign="WiFi-GuestNetwork"/>
    <remarks>MAC: AA:BB:CC:DD:EE:FF, Signal: -65dBm, Encryption: WPA2, Source: argos-02</remarks>
    <link uid="argos-02" relation="p-p" type="a-f-G-E-S"/>
  </detail>
</event>
```

**Argos Node Position:**

```xml
<event version="2.0" uid="argos-01" type="a-f-G-E-S"
       time="2026-02-06T12:34:56Z" start="2026-02-06T12:34:56Z"
       stale="2026-02-06T12:39:56Z">
  <point lat="35.123" lon="-118.456" hae="100" ce="5" le="5"/>
  <detail>
    <contact callsign="Argos-01"/>
    <remarks>Status: Online, Hardware: HackRF+Kismet+GPS</remarks>
  </detail>
</event>
```

### CoT Type Codes

- `a-f-G-E-S` - Friendly ground equipment (sensors)
- `b-m-p-s-m` - Point - Sensor - Electromagnetic
- Custom types can be defined per unit SOP

---

## What TAK Users See

When Argos data is ingested by TAK Server, operators see:

1. **Argos Node Icons**: Friendly unit symbols showing node locations
2. **RF Signal Markers**: Points with frequency/power annotations
3. **WiFi Device Icons**: Electronic targets with MAC/SSID/signal
4. **GSM Intercepts**: Cellular target markers with IMSI data
5. **Source Attribution**: Each detection tagged with originating node ID
6. **Real-Time Updates**: Detections appear within 1-2 seconds

### TAK Display Example:

```
Map View:
  📍 Argos-01 (35.123, -118.456) ← Friendly unit
    └─ 📡 RF-2437MHz (-45dBm) ← Detected signal
    └─ 📶 WiFi-GuestNetwork (WPA2) ← Detected WiFi

  📍 Argos-02 (35.130, -118.450) ← Friendly unit
    └─ 📡 RF-915MHz (-60dBm)
    └─ 📱 IMSI-310170... ← GSM intercept
```

---

## Implementation Roadmap

### Phase 1: Mesh Foundation (MVP)

- [ ] Node discovery and registration system
- [ ] WebSocket mesh connections between Argos nodes
- [ ] Data exchange protocol (JSON event format)
- [ ] Multi-node tactical map UI
- [ ] Node status monitoring

**Deliverable**: Two Argos nodes sharing detections in real-time

### Phase 2: TAK Integration

- [ ] CoT message builder (detection → XML)
- [ ] TAK client (TCP connection to TAK server)
- [ ] Direct mode: Each node → TAK
- [ ] Relay mode: Field node → Gateway → TAK
- [ ] TAK server configuration management

**Deliverable**: Argos detections visible in TAK clients

### Phase 3: Production Hardening

- [ ] Authentication between nodes (shared secrets/certificates)
- [ ] Data integrity verification (message signing)
- [ ] Connection resilience (auto-reconnect, buffering)
- [ ] Performance optimization (compression, batching)
- [ ] Monitoring and alerting

**Deliverable**: Production-ready mesh network

### Phase 4: Advanced Features

- [ ] Federated TAK server support
- [ ] Collaborative spectrum scanning coordination
- [ ] Time-synchronized captures across nodes
- [ ] Conflict resolution for overlapping detections
- [ ] Mobile mesh routing (MANET-style)

**Deliverable**: Enterprise-grade distributed SIGINT platform

---

## Security Considerations

### Network Security

- ✅ **Tailscale VPN**: All mesh traffic encrypted end-to-end
- ✅ **Authentication**: Node registration requires shared secret
- ✅ **Authorization**: Whitelist of approved node IDs
- ⚠️ **Data Integrity**: Message signing (Phase 3)

### TAK Security

- TAK server authentication (username/password or certificate)
- CoT message sanitization (prevent injection attacks)
- Rate limiting on TAK connections

### Operational Security

- No raw RF samples transmitted (only processed detections)
- GPS obfuscation options for OPSEC
- Configurable data retention policies

---

## Technical Requirements

### Software Dependencies

- **Tailscale**: VPN mesh networking
- **WebSocket Libraries**: ws (Node.js) or native WebSocket
- **TAK Client Libraries**: node-cot or custom implementation
- **Database**: SQLite with R-tree spatial indexing (existing)

### Hardware Requirements

- **Raspberry Pi 5**: 8GB RAM recommended
- **Storage**: 500GB NVMe SSD (existing)
- **Network**: WiFi/Ethernet for Tailscale connectivity
- **SDR Hardware**: HackRF One, USRP (existing)

### Backhaul Requirements

- **Minimum**: 1 Mbps per node (for 2-node mesh)
- **Recommended**: 5+ Mbps per node (for 10-node mesh)
- **Latency**: <100ms for real-time coordination
- **Options**: Starlink, 5G, 4G LTE, tactical radios

---

## Operational Scenarios

### NTC/JMRC Training Rotation

- **Deployment**: 5-10 Argos nodes across training area
- **Backhaul**: Starlink terminals at OPs, 5G hotspots on vehicles
- **TAK Integration**: Brigade TAK server at TOC
- **Use Case**: EW training, SIGINT collection, red team tracking

### Mobile Convoy Protection

- **Deployment**: 2-3 Argos nodes per convoy vehicle
- **Backhaul**: 4G/5G cellular
- **TAK Integration**: Relay mode (lead vehicle gateway → TAK)
- **Use Case**: Threat detection, spectrum monitoring, WiFi reconnaissance

### Base Camp Security

- **Deployment**: Static Argos nodes around perimeter
- **Backhaul**: Wired Ethernet or WiFi
- **TAK Integration**: Direct mode (all nodes → local TAK server)
- **Use Case**: Perimeter monitoring, unauthorized device detection

---

## Success Metrics

- **Latency**: Detection-to-TAK display < 2 seconds
- **Reliability**: 99%+ mesh uptime during operations
- **Scalability**: Support 10+ nodes without degradation
- **Bandwidth Efficiency**: <5 Mbps per node under load
- **Security**: Zero unauthorized access incidents

---

## References

- TAK Product Center: https://tak.gov
- Cursor on Target (CoT) Specification: https://www.mitre.org/sites/default/files/pdf/09_4937.pdf
- Tailscale Mesh VPN: https://tailscale.com/kb/1136/tailnet/
- Argos Project Repository: (internal)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-06
**Author**: Argos Development Team
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
