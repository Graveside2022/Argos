# Kismet Dashboard Wireframe

## Overview
A modern, operator-friendly dashboard that replaces the iframe with native visualizations of Kismet data.

## Page Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          KISMET DASHBOARD                                │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐ │
│ │  SYSTEM STATUS      │ │ ACTIVE DEVICES   │ │  THREAT LEVEL         │ │
│ │  ● Running          │ │      247         │ │    MODERATE           │ │
│ │  GPS: Fixed        │ │   +12 (5min)     │ │  3 Alerts Active      │ │
│ │  Uptime: 2h 34m    │ └──────────────────┘ └───────────────────────┘ │
│ └─────────────────────┘                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌───────────────────────────────────────┐ ┌────────────────────────┐  │
│ │         DEVICE TIMELINE               │ │   DEVICE BREAKDOWN     │  │
│ │                                       │ │                        │  │
│ │  [Real-time graph showing]           │ │  📱 Mobile: 142 (57%) │  │
│ │  [device discovery over time]        │ │  💻 Laptop: 58 (23%)  │  │
│ │  [with classification colors]        │ │  🏠 IoT: 31 (13%)     │  │
│ │                                       │ │  📡 AP: 12 (5%)       │  │
│ │  └─────────────────────────────────┘ │ │  ❓ Unknown: 4 (2%)   │  │
│ └───────────────────────────────────────┘ └────────────────────────┘  │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │                    ACTIVE DEVICES TABLE                          │   │
│ ├────────────────┬─────────┬──────────┬─────────┬────────────────┤   │
│ │ Device/SSID    │ Type    │ Signal   │ Channel │ Last Seen      │   │
│ ├────────────────┼─────────┼──────────┼─────────┼────────────────┤   │
│ │ iPhone_John    │ Mobile  │ -45 dBm  │ 6       │ 2 sec ago      │   │
│ │ NETGEAR_5G     │ AP      │ -62 dBm  │ 36      │ 5 sec ago      │   │
│ │ Unknown_IoT    │ IoT     │ -78 dBm  │ 1       │ 12 sec ago     │   │
│ │ [Sortable, filterable, searchable table with all devices]       │   │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ ┌──────────────────────────┐ ┌─────────────────────────────────────┐ │
│ │    CHANNEL USAGE         │ │        SECURITY ALERTS              │ │
│ │                          │ │                                     │ │
│ │ Ch 1:  ████████ 45      │ │ ⚠️  Deauth attack detected         │ │
│ │ Ch 6:  ██████ 38        │ │    MAC: AA:BB:CC:DD:EE:FF         │ │
│ │ Ch 11: ████ 22          │ │    5 minutes ago                   │ │
│ │ Ch 36: ███████ 42       │ │                                     │ │
│ │ Ch 44: ██ 12            │ │ ⚠️  Suspicious probe pattern       │ │
│ │ [Visual channel load]    │ │    From: 11:22:33:44:55:66        │ │
│ └──────────────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. **System Status Card**
- Kismet service status (Running/Stopped)
- GPS fix status and coordinates
- System uptime
- Quick start/stop controls

### 2. **Active Devices Summary**
- Total device count
- Change over last 5 minutes
- Visual trend indicator

### 3. **Threat Level Indicator**
- Overall security assessment
- Active alert count
- Color-coded severity

### 4. **Device Timeline**
- Real-time graph showing device discovery
- Stacked by device type
- Zoomable time range (1h, 6h, 24h)

### 5. **Device Type Breakdown**
- Pie/donut chart showing device classification
- Interactive - click to filter table
- Percentages and counts

### 6. **Active Devices Table**
- Sortable columns
- Real-time updates
- Search/filter capabilities
- Click row for device details modal

### 7. **Channel Usage**
- Bar chart showing 2.4GHz and 5GHz channels
- Device count per channel
- Visual congestion indicator

### 8. **Security Alerts Feed**
- Real-time security events
- Severity indicators
- Timestamp and device info
- Click for detailed threat analysis

## Data Flow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Kismet    │────▶│  REST API    │────▶│  SvelteKit    │
│  (Port 2501)│     │  Endpoints   │     │   Backend     │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                    ┌─────────────────────────────┼───────┐
                    │                             ▼       │
              ┌─────┴──────┐              ┌──────────────┐│
              │  WebSocket  │              │   Stores     ││
              │   Updates   │              │  (Svelte)    ││
              └─────┬──────┘              └──────┬───────┘│
                    │                            │        │
                    ▼                            ▼        │
              ┌────────────────────────────────────────┐ │
              │      Dashboard Components              │ │
              │  - Status Cards                        │ │
              │  - Real-time Charts (Chart.js)         │ │
              │  - Data Tables                         │ │
              │  - Alert Feed                          │ │
              └────────────────────────────────────────┘ │
                                                         │
              └──────────────────────────────────────────┘
```

## Technical Implementation

### Backend Requirements
1. **New API Endpoints**:
   - `/api/kismet/dashboard/summary` - Aggregated stats
   - `/api/kismet/dashboard/timeline` - Time series data
   - `/api/kismet/dashboard/channels` - Channel usage
   - `/api/kismet/dashboard/alerts` - Security events

2. **WebSocket Integration**:
   - Real-time device updates
   - Alert notifications
   - Status changes

### Frontend Stack
1. **SvelteKit Page**: `/kismet-dashboard`
2. **Charting**: Chart.js for graphs
3. **Data Grid**: Tanstack Table or AG-Grid
4. **Real-time Updates**: SSE or WebSockets
5. **Responsive Design**: Tailwind CSS

### Key Improvements Over iframe
1. **Native Performance** - No iframe overhead
2. **Customizable UI** - Operator-focused design
3. **Integrated Alerts** - Built into main UI
4. **Mobile Responsive** - Works on tablets/phones
5. **Dark Mode Support** - Better for ops centers
6. **Export Capabilities** - CSV/JSON data export
7. **Custom Filtering** - Advanced device queries

## Next Steps
1. Create new route `/kismet-dashboard`
2. Implement API aggregation endpoints
3. Build responsive component layout
4. Add real-time data updates
5. Implement filtering and search
6. Add export functionality