# Argos RF Monitoring System - Service Architecture Analysis
## By Agent @13

### System Overview
Argos is a comprehensive RF (Radio Frequency) monitoring platform built with SvelteKit that integrates multiple RF analysis tools.

### Core Services Identified

1. **HackRF Service** (`/api/hackrf/*`)
   - Software Defined Radio (SDR) spectrum sweep management
   - Real-time frequency analysis
   - Located in: `/src/lib/server/hackrf/`

2. **Kismet Service** (`/api/kismet/*`)
   - WiFi and Bluetooth device monitoring
   - Device tracking and intelligence gathering
   - Located in: `/src/lib/server/kismet/`

3. **GSM-Evil Service** (`/api/gsm-evil/*`)
   - GSM cellular network monitoring
   - IMSI capture capabilities
   - Tower location tracking
   - Located in: `/src/routes/api/gsm-evil/`

4. **GNU Radio Service** (`/api/gnuradio/*`)
   - Advanced SDR control
   - Signal detection and processing
   - FFT processing utilities
   - Located in: `/src/lib/server/gnuradio/`

5. **RTL-433 Service** (`/api/rtl-433/*`)
   - 433MHz device monitoring
   - IoT device detection
   - Located in: `/src/routes/api/rtl-433/`

6. **Fusion Service** (`/api/fusion/*`)
   - Multi-source data correlation engine
   - Combines data from all RF sources
   - Located in: `/src/lib/server/fusion/`

7. **Wireshark Service** (`/api/wireshark/*`)
   - Network packet capture
   - Protocol analysis
   - Located in: `/src/lib/server/wireshark.ts`

8. **WebSocket Service** (`/api/ws/*`)
   - Real-time data streaming
   - Event-based updates
   - Located in: `/src/lib/server/websockets.ts`

### WebSocket Integration Pattern
- Each service broadcasts events through a centralized WebSocket manager
- Frontend components subscribe to specific service channels
- High-frequency data (like HackRF sweeps) use buffering and throttling
- Connection status tracked per service with automatic reconnection

### Key Frontend Components
- Individual service stores in `/src/lib/stores/`
- Service-specific UI components in `/src/lib/components/`
- Real-time visualization for spectrum analysis
- Map-based signal visualization

### Notes for Team
- The system uses a modular architecture where each RF tool is wrapped as a service
- All services follow a similar API pattern: start/stop/status/stream
- WebSocket connections handle real-time data flow
- The Fusion service acts as a correlation engine combining all data sources

### Areas for Further Investigation
- Performance optimization for high-frequency data streams
- Security implications of RF monitoring capabilities
- Integration testing across multiple active services