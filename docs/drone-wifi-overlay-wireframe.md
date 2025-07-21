# Drone & WiFi Device Detection Overlay

## Overview
A specialized map overlay that combines WiFi device detection from Kismet with RF-based drone detection to provide comprehensive aerial threat awareness.

## Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│  🛡️ DRONE & DEVICE DETECTION OVERLAY                         [X] [-] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────── DETECTION STATUS ────────────┐   ┌─── QUICK STATS ───┐│
│  │ 🟢 Kismet: Active (247 devices)          │   │ 🚁 Drones: 3      ││
│  │ 🟢 RF Scan: Active (1-6 GHz)            │   │ 📱 WiFi: 244      ││
│  │ 🟡 Drone Detection: 3 Active Tracks      │   │ ⚠️  Threats: 1    ││
│  └──────────────────────────────────────────┘   └───────────────────┘│
│                                                                        │
│  ┌────────────────── MAP VIEW ──────────────────────────────────────┐ │
│  │                                                                  │ │
│  │    [OpenStreetMap/Satellite View]                              │ │
│  │                                                                  │ │
│  │         🚁 [Drone Track #1]                                    │ │
│  │        ╱  ← Predicted path                                     │ │
│  │       ╱   Speed: 15 m/s                                        │ │
│  │      ●    Alt: 120m                                           │ │
│  │     ╱│    DJI Phantom (95% conf)                              │ │
│  │    ╱ │                                                         │ │
│  │   ●  │    📱 [WiFi Cluster]                                   │ │
│  │  ╱   │    12 devices                                          │ │
│  │ ●────┘    -45 to -72 dBm                                      │ │
│  │           Mixed types                                          │ │
│  │                                                                │ │
│  │    🚁 [Drone Track #2]        📡 [Suspicious AP]             │ │
│  │    Custom drone               Deauth attacks                   │ │
│  │    433 MHz control            MAC: AA:BB:CC:DD:EE:FF         │ │
│  │    No video feed                                              │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌─────── ACTIVE DETECTIONS ────────┐  ┌──── SIGNAL ANALYSIS ─────┐ │
│  │ TYPE     ID        STATUS  THREAT│  │ Frequency  Power  Pattern│ │
│  │ ─────────────────────────────────│  │ ─────────────────────────│ │
│  │ 🚁 DJI   DR001    Active   MED  │  │ 2.4 GHz   -45dBm  Cont.  │ │
│  │ 🚁 Cust  DR002    Active   HIGH │  │ 433 MHz   -62dBm  Burst  │ │
│  │ 🚁 DJI   DR003    Landing  LOW  │  │ 5.8 GHz   -78dBm  Cont.  │ │
│  │ 📱 AP    WiFi042  Suspect  MED  │  │ 2.4 GHz   -52dBm  Normal │ │
│  │ 📱 IoT   WiFi156  Normal   NONE │  │ 2.4 GHz   -68dBm  Normal │ │
│  └─────────────────────────────────┘  └──────────────────────────┘ │
│                                                                        │
│  ┌────────────── CONTROLS ──────────────┐                            │
│  │ Filters:                             │  Legend:                   │
│  │ □ Show Drones      □ Show WiFi      │  🚁 Active Drone          │
│  │ □ Show Paths       □ Show Threats   │  ● Drone Path Point      │
│  │ □ Heat Map         □ Signal Strength│  📱 WiFi Device Cluster   │
│  │                                      │  📡 Access Point          │
│  │ Detection Range: [====|====] 5km    │  ⚠️  Security Threat      │
│  └──────────────────────────────────────┘                            │
└────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. **Dual Detection Sources**
- **Kismet Integration**: WiFi devices, access points, IoT devices
- **RF Detection**: Drone control/video signals via HackRF/SDR
- **Correlation Engine**: Links WiFi and RF signals from same source

### 2. **Drone-Specific Detection**
- **Signal Analysis**:
  - Control frequencies (433/915 MHz, 2.4/5.8 GHz)
  - Video downlink detection
  - Signal pattern recognition (continuous/burst/hopping)
- **Drone Identification**:
  - Manufacturer detection (DJI, Parrot, Autel)
  - Custom/DIY drone detection
  - Confidence scoring
- **Flight Tracking**:
  - Real-time position updates
  - Trajectory prediction
  - Speed and altitude estimation

### 3. **WiFi Device Visualization**
- **Device Clustering**: Groups nearby devices
- **Type Classification**: Mobile, laptop, IoT, AP
- **Signal Strength**: Visual RSSI indicators
- **Threat Detection**: Deauth attacks, rogue APs

### 4. **Map Overlay Elements**

#### Drone Visualization:
```
🚁 Active drone icon (color-coded by threat)
── Solid line: confirmed flight path
-- Dashed line: predicted trajectory
● Path points with timestamps
[Box] Info popup with details
```

#### WiFi Device Visualization:
```
📱 Device cluster (number indicates count)
📡 Access point icon
⭕ Signal range circles (optional)
🔥 Heat map mode for device density
```

### 5. **Real-Time Alerts**
- New drone detected
- Drone approaching restricted area
- Suspicious WiFi activity
- Signal jamming detected
- Lost drone track

## Technical Implementation

### Data Integration Architecture:
```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Kismet    │     │  HackRF/SDR │     │ DroneDetect  │
│  (WiFi)     │     │  (RF Scan)  │     │   Service    │
└──────┬──────┘     └──────┬──────┘     └──────┬───────┘
       │                   │                    │
       └───────────────────┴────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Correlation │
                    │   Engine     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Overlay    │
                    │  Component   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     Map      │
                    └──────────────┘
```

### Key Components:

1. **Enhanced Kismet Integration**:
   - Add drone manufacturer detection to device classification
   - Identify drone ground stations by WiFi signatures
   - Track drone operator devices

2. **RF Signal Correlation**:
   - Match RF drone signals with WiFi devices
   - Identify drone+controller pairs
   - Track operator location via WiFi device

3. **Overlay Controls**:
   - Toggle layers (drones/WiFi/threats)
   - Filter by device type
   - Adjust detection sensitivity
   - Export detection data

4. **Performance Optimizations**:
   - Cluster rendering for many devices
   - LOD (Level of Detail) for zoom levels
   - WebGL acceleration for heat maps
   - Efficient real-time updates

## Detection Logic

### Drone Detection Flow:
```
1. RF Signal Detection (HackRF)
   ↓
2. Frequency Analysis (2.4/5.8 GHz, ISM bands)
   ↓
3. Pattern Recognition (continuous/burst/hopping)
   ↓
4. Drone Classification (manufacturer/type)
   ↓
5. Trajectory Tracking (position/speed/altitude)
   ↓
6. Threat Assessment (location/behavior/capabilities)
```

### WiFi Correlation:
```
1. Detect WiFi devices near drone signals
2. Look for:
   - DJI GO app connections
   - Drone manufacturer SSIDs
   - Control app traffic patterns
3. Link operator device to drone
4. Track both drone and operator
```

## Use Cases

1. **Security Operations**:
   - Detect unauthorized drones
   - Track drone operators
   - Monitor restricted airspace

2. **Event Security**:
   - Real-time aerial threat monitoring
   - Crowd device density analysis
   - Suspicious activity detection

3. **Critical Infrastructure**:
   - Perimeter drone detection
   - WiFi intrusion monitoring
   - Automated threat alerts

## Next Steps

1. Enhance Kismet device classification for drone detection
2. Integrate existing DroneDetectionService with map overlay
3. Add WiFi-RF correlation logic
4. Implement real-time overlay component
5. Add threat assessment algorithms
6. Create alert notification system