# Kismet Operations System Inventory

## Phase 1.1.002 - Complete Current State Documentation

**Date**: 2025-06-26  
**Analyst**: Agent 2  
**Status**: ANALYSIS COMPLETE - NO MODIFICATIONS  
**System**: Kismet Operations Center (Current Port 8002)

---

## EXECUTIVE SUMMARY

### Current Reality Assessment

The Kismet Operations system is **NOT currently running on ports 8005 or 8006** as specified in the task. Investigation reveals:

1. **Actual Port**: System configured to run on port **8002** (from server.js line 19)
2. **Current Status**: No active processes found on ports 8002, 8005, or 8006
3. **Architecture**: Node.js/Express backend with WebSocket support
4. **Frontend**: Complex HTML5 application with advanced CSS grid system
5. **Integration**: Proxy-based architecture connecting Kismet (port 2501) and WigleToTAK (port 8000)

### Port Configuration Discrepancy

- **Task Specification**: Ports 8005 (backend) / 8006 (frontend)
- **Actual Implementation**: Port 8002 (unified backend/frontend)
- **Architecture Type**: Monolithic Express server serving both API and static content

---

## BACKEND API STRUCTURE (Port 8002)

### Core Express.js Application

**File**: `/home/pi/stinkster_christian/src/nodejs/kismet-operations/server.js`  
**Framework**: Express.js 4.18.2 with Socket.IO 4.7.2  
**Architecture**: Monolithic server combining REST API and static file serving

### API Endpoint Categories

#### 1. Health & System Status

```javascript
GET  /health              - System health check with memory/uptime stats
GET  /info                - System information with client IP detection
GET  /debug-ip            - Debug endpoint for IP detection
GET  /api/debug/ip        - Enhanced IP debugging with proxy headers
```

#### 2. Configuration Management

```javascript
GET  /api/config          - Get current system configuration
POST /api/config          - Update configuration (Joi validation)
```

#### 3. Service Control & Status

```javascript
GET  /script-status       - Legacy script status endpoint
GET  /api/script-status   - Enhanced script status with process tracking
POST /run-script          - Start Kismet services (frontend compatibility)
POST /stop-script         - Stop Kismet services with timeout handling
POST /api/start-script    - Advanced script execution with validation
POST /api/stop-script     - Process termination with SIGTERM/SIGKILL
```

#### 4. Spectrum Analysis Integration

```javascript
GET  /api/status          - OpenWebRX integration status
POST /api/connect         - Connect to OpenWebRX WebSocket
POST /api/disconnect      - Disconnect from OpenWebRX
GET  /api/signals         - Signal detection with threshold filtering
GET  /api/signals/stats   - Signal detection statistics
GET  /api/fft/latest      - Latest FFT data from buffer
POST /api/fft/clear       - Clear FFT buffer
```

#### 5. Legacy Compatibility

```javascript
GET  /api/profiles        - Scan profiles (VHF/UHF/ISM bands)
GET  /api/scan/:profileId - Execute profile scan with demo data
```

#### 6. Kismet Data Integration

```javascript
GET  /kismet-data         - Kismet data with fallback to demo data
GET  /api/kismet-data     - Enhanced Kismet integration with error handling
```

### Proxy Middleware Configuration

#### Kismet API Proxy

```javascript
Route: /api/kismet/*
Target: http://localhost:2501
Authentication: admin:admin
Features:
- 30-second timeout
- CORS header injection
- Error handling with 502 responses
- Debug logging
```

#### WigleToTAK API Proxy

```javascript
Route: /api/wigle/*
Target: http://localhost:8000
Features:
- Automatic CORS handling
- Request/response logging
- Error recovery
```

#### Kismet iframe Integration

```javascript
Route: /kismet/*
Target: http://localhost:2501
Special Features:
- WebSocket support (ws: true)
- X-Frame-Options header removal
- HTML base tag injection for relative URL fixing
- Authentication passthrough
```

### WebSocket Event System

#### Real-time Data Streams

```javascript
Events:
- fftData: Spectrum analyzer data
- signalsDetected: Signal detection results
- openwebrxConnected/Disconnected: Connection status
- configUpdated: Configuration changes
- bufferCleared: FFT buffer reset
- kismetData: WiFi scanning data
- kismetDataUpdate: Auto-polling updates
```

#### Client Interaction Events

```javascript
Client Requests:
- requestStatus: Get current system status
- requestLatestFFT: Latest FFT data
- requestSignals: Signal detection with threshold
- requestKismetData: WiFi scanning data
```

---

## FRONTEND APPLICATION STRUCTURE (Served from Port 8002)

### Main HTML Files

**Primary Interface**: `/views/hi.html` (27,517+ tokens - massive single-page application)  
**Mobile Optimized**: `/views/index_mobile_optimized.html`  
**Specialized Pages**: `atak.html`, `wigle.html`, `kismet.html`, `kismet2.html`

### Advanced CSS Architecture

#### Phase 3 Design System

```css
/* Foundation Changes */
- CSS Reset with box-sizing: border-box
- Responsive typography with clamp()
- Mobile-first design principles

/* Layout Transformation */
- CSS Grid system: 12 columns × 4 rows (desktop)
- Mobile: Single column responsive
- Tablet: 2-column responsive
- Fixed positioning removal for mobile compatibility
```

#### Visual Theme System

```css
/* Color Palette */
Primary Background: #030610 (Dark blue-black)
Text Color: #d0d8f0 (Soft light blue)
Accent: #00d2ff (Cyan blue)
Grid Pattern: rgba(0, 200, 220, 0.02)

/* Animation System */
- Background panning: 80s linear infinite
- Banner scanning: 4s linear infinite
- Text shine effect: 3s linear infinite
- Radial pulse: 4s ease-in-out infinite
```

#### Component Structure

```css
.top-banner           - Header with animated effects
.minimized-tabs       - Tab management system
.main-content-area    - CSS Grid layout container
.container           - Full viewport wrapper
.header              - Navigation header (60px height)
```

### JavaScript Integration Points

#### Core Dependencies

```javascript
External CDNs:
- Chart.js 4.2.1 (Charts and graphs)
- Socket.IO client 4.7.2 (Real-time communication)
- Font: Inter from Google Fonts

Internal Modules:
- WebSocket connection management
- Configuration updates
- Signal detection display
- Mobile responsive handlers
```

---

## SERVICE INTEGRATION POINTS

### Kismet Integration (Port 2501)

```javascript
Configuration:
- Base URL: http://localhost:2501
- Authentication: admin:admin
- Timeout: 5-30 seconds
- Health Check: /system/status endpoint
- Data Endpoints: /devices/all_devices, /devices/all_ssids

Data Transformation:
- Device mapping with MAC, signal, manufacturer
- Network SSID extraction with encryption detection
- Location data processing
- Real-time update polling (5-second intervals)
```

### WigleToTAK Integration (Port 8000)

```javascript
Target Service: Flask application
Data Flow: Kismet → WigleCSV → TAK format
TAK Broadcasting: Port 6969 (configurable)
Web Interface: Port 8000 (configurable)
```

### OpenWebRX Integration (Port 8073)

```javascript
WebSocket URL: ws://localhost:8073/ws/
Data Types: FFT data, spectrum analysis
Buffer Management: Real-time FFT processing
Signal Detection: Threshold-based algorithms
```

### GPS Integration (Port 2947)

```javascript
Service: GPSD daemon
Data Source: MAVLink bridge (mavgps.py)
Real-time Updates: GPS coordinates for device tracking
```

---

## WEBSOCKET & REAL-TIME DATA FLOW

### Socket.IO Implementation

```javascript
Server Configuration:
- CORS: Dynamic origin checking
- Transports: ['websocket', 'polling']
- Ping Timeout: 60 seconds
- Ping Interval: 25 seconds

Event Broadcasting:
- Automatic Kismet data polling (5 seconds)
- FFT data streaming from OpenWebRX
- Signal detection notifications
- Configuration change propagation
```

### Data Pipeline Architecture

```
Kismet (2501) ──┐
               ├─→ Node.js Server (8002) ──→ WebSocket ──→ Frontend
WigleToTAK ────┘                          ├─→ REST API ──→ External
OpenWebRX ─────────────────────────────────┘
```

---

## PROCESS MANAGEMENT SYSTEM

### Script Manager Class

```javascript
Class: SimpleScriptManager
Capabilities:
- Process lifecycle management
- PID file tracking
- Health monitoring
- Graceful shutdown
- Network interface reset
- Tailscale connectivity recovery

Supported Scripts:
- gps_kismet_wigle.sh (main orchestration)
- start_kismet.sh (Kismet startup)
- smart_restart.sh (intelligent restart)
- stop_and_restart_services.sh (cleanup)
```

### Service Dependencies

```javascript
Process Chain:
1. GPS Service (mavgps.py → GPSD)
2. Kismet Server (port 2501)
3. WigleToTAK (port 8000)
4. Node.js Operations Center (port 8002)

Health Checks:
- Process existence verification
- Port connectivity testing
- API response validation
- Service readiness confirmation
```

---

## SECURITY & ACCESS CONTROL

### Authentication System

```javascript
Kismet Authentication: admin:admin (hardcoded)
Proxy Headers: Trust proxy enabled
CORS Policy: Dynamic origin validation
Security Headers: Helmet.js with CSP disabled
```

### Network Security

```javascript
Firewall Considerations:
- Internal communication: localhost only
- External access: Port 8002 main interface
- Iframe embedding: X-Frame-Options removed
- Client IP detection: Multi-header support
```

---

## MOBILE OPTIMIZATION FEATURES

### Responsive Design System

```css
Breakpoints:
- Mobile: ≤600px (single column)
- Tablet: 601px-1023px (2 columns)
- Desktop: ≥1024px (12-column grid)

Mobile Optimizations:
- Fixed positioning removal
- Animation disabling
- Touch-friendly sizing
- Viewport overflow management
```

---

## DEMO DATA SYSTEMS

### Signal Generation

```javascript
Demo Signals:
- VHF: 144-148 MHz (25 kHz steps)
- UHF: 420-450 MHz (25 kHz steps)
- ISM: 2.4-2.485 GHz (1 MHz steps)
- Random strength: -80 to -40 dBm
- Confidence ratings: 0.3-0.9
```

### Kismet Demo Data

```javascript
Demo Devices: 10 synthetic WiFi devices
Demo Networks: 8 synthetic access points
Manufacturers: Apple, Samsung, Intel, Broadcom, Realtek
Encryption Types: Open, WEP, WPA, WPA2, WPA3
Location Simulation: San Francisco coordinates
```

---

## FILE STRUCTURE PRESERVATION REQUIREMENTS

### Critical Files (DO NOT MODIFY)

```
/home/pi/stinkster_christian/src/nodejs/kismet-operations/
├── server.js (2,096 lines - core application)
├── package.json (dependency management)
├── views/
│   ├── hi.html (27,517+ tokens - main interface)
│   ├── index_mobile_optimized.html
│   ├── atak.html, wigle.html, kismet.html
│   └── archive/ (backup variants)
├── lib/ (WebSocket and integration modules)
└── public/ (static assets)
```

### Asset Dependencies

```
Static Assets:
- CSS: /css/* (common styles)
- JavaScript: /js/* (utilities)
- Offline Maps: /offline-tiles/* (tile server)
- Mobile Assets: Mobile-optimized HTML variants
```

---

## MIGRATION RECOMMENDATIONS

### For ArgosFinal Integration

#### Backend Considerations

1. **Port Standardization**: Decide on 8002 vs 8005/8006 architecture
2. **API Compatibility**: Maintain existing proxy endpoints
3. **WebSocket Migration**: Preserve real-time data flows
4. **Service Dependencies**: Ensure Kismet/WigleToTAK connectivity

#### Frontend Migration Strategy

1. **CSS Framework**: Extract advanced grid system
2. **Component Extraction**: Modularize single-page application
3. **Mobile Optimization**: Preserve responsive design features
4. **Theme System**: Maintain visual consistency

#### Integration Points

1. **Proxy Configuration**: Maintain service routing
2. **Authentication**: Preserve Kismet credentials
3. **Health Monitoring**: Migrate status endpoints
4. **Demo Systems**: Preserve fallback data

---

## CONCLUSION

The current Kismet Operations system is a **sophisticated, production-ready Node.js application** with advanced features including:

- **Mature Architecture**: Express.js with Socket.IO real-time capabilities
- **Complex Frontend**: 27,517+ token single-page application with advanced CSS
- **Service Integration**: Proxy-based architecture connecting multiple services
- **Mobile Optimization**: Comprehensive responsive design system
- **Demo Systems**: Robust fallback data for development
- **Process Management**: Advanced script execution and monitoring

**Critical Note**: System currently operates on **port 8002**, not the specified ports 8005/8006. This discrepancy must be resolved during migration planning.

**Preservation Priority**: The existing HTML structure and CSS framework represent significant engineering effort and should be preserved during any migration to ArgosFinal.
