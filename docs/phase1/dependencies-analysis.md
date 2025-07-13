# Dependencies Analysis - Phase 1.1.004

**Agent 4 Execution**  
**Date:** 2025-06-26  
**BINDING RULES ACKNOWLEDGED:** Christian's instructions are absolute rules  
**Status:** ANALYSIS COMPLETE - NO MODIFICATIONS

---

## Executive Summary

This document provides a comprehensive analysis of all external dependencies and service integrations required for the ArgosFinal system. The analysis identifies hardware dependencies, service requirements, network configurations, file system dependencies, and API integrations based on current system state and migration requirements.

## Hardware Dependencies

### Software Defined Radio (SDR)

**HackRF One SDR Device**

- **USB ID:** 1d50:6089 OpenMoko, Inc. Great Scott Gadgets HackRF One SDR
- **Status:** ✅ DETECTED - Hardware physically connected
- **Driver Requirements:** libhackrf-dev, hackrf-tools
- **Integration:** OpenWebRX Docker container (port 8073)
- **Critical:** Native HackRF driver required (NOT SoapySDR)

### WiFi Adapters

**Multiple WiFi Interfaces Configuration:**

```
wlan0     - Primary WiFi (UP, connected)
wlan1     - Secondary adapter (DOWN)
wlan2     - Monitor mode (UP, PROMISC)
wlan2mon  - Monitor interface (UP, active)
```

- **Monitor Mode:** wlan2 configured for Kismet scanning
- **Driver Support:** Must support monitor mode and packet injection
- **Kismet Integration:** Active scanning interface

### GPS Hardware

**GPS Device Requirements:**

- **Interface:** USB/Serial (ttyUSB0 typical)
- **Protocol:** NMEA 0183 compatible
- **Integration:** MAVLink bridge → GPSD daemon (port 2947)
- **Status:** ✅ GPSD service running

## Service Dependencies

### Core Services Architecture

#### 1. GPSD Service (Port 2947)

```
Service: gpsd.service
Status: ✅ ACTIVE (running)
Protocol: TCP socket server
Integration: GPS coordinates for device geolocation
Dependencies: GPS hardware device, serial permissions
```

#### 2. Kismet WiFi Scanner (Port 2501)

```
Service: kismet (standalone process)
Status: ✅ ACTIVE (listening on 2501)
Authentication: admin:admin (hardcoded)
Integration: REST API for WiFi device scanning
Monitor Interface: wlan2/wlan2mon required
```

#### 3. WigleToTAK Service (Port 8000)

```
Service: python3 WigleToTak2.py
Status: ✅ ACTIVE (PID 3024375)
Framework: Flask web application
Integration: Converts Kismet data to TAK format
TAK Broadcasting: Port 6969 (configurable)
```

#### 4. Kismet Operations Center (Port 8002)

```
Service: kismet-operations-center.service
Status: ✅ ACTIVE (Node.js application)
Framework: Express.js + Socket.IO
Integration: Web dashboard + proxy to all services
```

#### 5. OpenWebRX SDR (Port 8073)

```
Service: Docker container (openwebrx-hackrf-only)
Status: ⚠️ UNHEALTHY (running 38 hours)
Network Mode: host (exposes port 8073)
Integration: WebSocket FFT data for spectrum analysis
```

#### 6. HackRF Spectrum Analyzer (Port 8092)

```
Service: python3 spectrum_analyzer.py
Status: ✅ ACTIVE (listening)
Framework: Flask + SocketIO
Integration: Real-time spectrum analysis
OpenWebRX Dependency: WebSocket connection required
```

### Service Dependency Chain

```
Hardware Layer:
├── HackRF One → OpenWebRX (8073) → Spectrum Analyzer (8092)
├── WiFi Adapters → Kismet (2501) → WigleToTAK (8000)
└── GPS Device → GPSD (2947) → Location Services

Application Layer:
├── Kismet Operations Center (8002) [Node.js Dashboard]
├── ArgosFinal SvelteKit (target: 3002/4173)
└── Service Orchestration Scripts
```

## Network Dependencies

### Port Configuration Matrix

| Port | Service             | Protocol   | Status       | Purpose                  |
| ---- | ------------------- | ---------- | ------------ | ------------------------ |
| 2501 | Kismet              | HTTP/REST  | ✅ Active    | WiFi device scanning API |
| 2947 | GPSD                | TCP Socket | ✅ Active    | GPS coordinate service   |
| 6969 | TAK Broadcast       | UDP        | Configurable | TAK data streaming       |
| 8000 | WigleToTAK          | HTTP/Flask | ✅ Active    | CSV to TAK conversion    |
| 8002 | Kismet Ops          | HTTP/WS    | ✅ Active    | Operations dashboard     |
| 8073 | OpenWebRX           | HTTP/WS    | ⚠️ Unhealthy | SDR web interface        |
| 8092 | Spectrum Analyzer   | HTTP/WS    | ✅ Active    | Real-time spectrum       |
| 3002 | ArgosFinal (target) | HTTP/WS    | 📋 Planned   | Unified interface        |

### Network Security Requirements

- **Internal Communication:** All services communicate via localhost
- **External Access:** Port-specific firewall rules required
- **Authentication:** Kismet requires admin:admin credentials
- **Monitoring Interface:** wlan2 requires monitor mode capability

## File System Dependencies

### Critical Directories and Permissions

#### Data Storage Locations

```
/home/pi/kismet_ops/           - Kismet capture files (.kismet, .wiglecsv)
/home/pi/tmp/                  - Process logs and PID files
/home/pi/HackRF/               - Legacy spectrum analyzer
/home/pi/WigletoTAK/          - TAK conversion service
/home/pi/gpsmav/GPSmav/       - GPS bridge service
/home/pi/stinkster_christian/ - Current operations center
```

#### Configuration Files

```
/home/pi/kismet_ops/kismet_site.conf     - Kismet configuration
/home/pi/HackRF/config.json             - HackRF settings
/home/pi/docker-compose.yml             - OpenWebRX container
/home/pi/openwebrx-hackrf-config.json   - SDR configuration
```

#### Log Files and Monitoring

```
/home/pi/tmp/gps_kismet_wigle.log    - Main orchestration logs
/home/pi/tmp/kismet.log              - Kismet service logs
/home/pi/tmp/spectrum_analyzer.log   - HackRF spectrum logs
/home/pi/tmp/wigletotak.log          - TAK conversion logs
/home/pi/kismet_ops/kismet_debug.log - Kismet debug output
```

#### Virtual Environments

```
/home/pi/HackRF/venv/                    - Spectrum analyzer dependencies
/home/pi/gpsmav/GPSmav/venv/            - GPS bridge dependencies
/home/pi/WigletoTAK/.../venv/           - TAK service dependencies
/home/pi/stinkster_christian/.../venv/  - Web interface dependencies
```

### Filesystem Permissions Requirements

- **Device Access:** /dev/ttyUSB*, /dev/ttyACM* (GPS serial)
- **USB Access:** HackRF device permissions
- **Network Interfaces:** Monitor mode configuration (requires root)
- **Log Directory:** Write permissions for service logs
- **Process Management:** PID file creation and cleanup

## External API Integrations

### Kismet REST API Integration

```
Base URL: http://localhost:2501
Authentication: Basic Auth (admin:admin)
Key Endpoints:
├── /system/status        - Service health
├── /devices/all_devices  - WiFi device list
├── /devices/all_ssids    - Network SSID list
└── /devicetracker/      - Device tracking data

Response Format: JSON
Update Frequency: 5-second polling
Timeout: 30 seconds
```

### OpenWebRX WebSocket Integration

```
WebSocket URL: ws://localhost:8073/ws/
Data Types:
├── FFT data (Float32/UInt8/Int16)
├── Spectrum analysis
├── Real-time signal data
└── Configuration updates

Buffer Management: Real-time processing
Signal Detection: Threshold-based (-70 dBm default)
Connection Management: Automatic reconnection
```

### GPSD Protocol Integration

```
Protocol: TCP socket (localhost:2947)
Data Format: NMEA 0183 strings
Commands:
├── ?WATCH={"enable":true,"json":true}
├── ?POLL
└── ?VERSION

Integration: Real-time GPS coordinates
Update Rate: 1Hz typical
Precision: Depends on GPS hardware
```

### TAK Data Broadcasting

```
Protocol: UDP multicast (configurable)
Port: 6969 (default, configurable)
Data Format: TAK XML (Cursor-on-Target)
Integration: ATAK/WinTAK compatible
Frequency: Real-time device updates
```

## Python Dependencies Analysis

### HackRF Spectrum Analyzer

```python
# Core dependencies (inferred from codebase analysis)
flask>=2.3.0          # Web framework
flask-socketio>=5.3.0  # Real-time WebSocket support
numpy>=1.24.0          # Signal processing
websockets>=11.0.0     # OpenWebRX WebSocket client
asyncio               # Asynchronous processing
matplotlib            # Spectrum plotting (optional)
```

### WigleToTAK Service

```python
# Current dependencies
Flask==3.0.2          # Web framework only

# Additional requirements (inferred)
requests>=2.31.0      # HTTP client for Kismet API
csv                   # CSV processing (built-in)
xml.etree.ElementTree # TAK XML generation (built-in)
threading             # Background processing (built-in)
```

### GPS Bridge (GPSmav)

```python
# Confirmed dependencies
pymavlink>=2.4.33     # MAVLink protocol support
pyserial>=3.5         # Serial communication

# Additional system dependencies
gpsd                  # GPS daemon (system package)
gpsd-clients          # GPS utilities (system package)
```

### Node.js Dependencies

```json
{
	"kismet-operations-center": {
		"express": "^4.18.2",
		"socket.io": "^4.7.2",
		"http-proxy-middleware": "^2.0.6",
		"joi": "^17.9.2",
		"helmet": "^7.0.0"
	}
}
```

## Version Compatibility Requirements

### Python Environment

- **Python Version:** 3.11+ (Raspberry Pi OS default)
- **Virtual Environment:** Required for each service
- **Package Manager:** pip (system package manager)

### Node.js Environment

- **Node.js Version:** >=16.0.0 (for SvelteKit compatibility)
- **Package Manager:** npm (system package manager)
- **Framework Compatibility:** Express.js 4.x, Socket.IO 4.x

### System Dependencies

```bash
# Hardware interface libraries
libhackrf-dev         # HackRF hardware support
hackrf-tools          # Command line utilities
kismet                # WiFi scanning framework
gpsd                  # GPS daemon
gpsd-clients          # GPS utilities

# Python development
python3-dev           # Python headers
python3-pip           # Package installer
python3-venv          # Virtual environment support

# Node.js development
nodejs                # JavaScript runtime
npm                   # Node package manager

# Docker (for OpenWebRX)
docker.io             # Container runtime
docker-compose        # Container orchestration
```

## Integration Risk Assessment

### High Risk Dependencies 🔥

1. **HackRF Hardware Interface**
    - Hardware-specific driver requirements
    - USB device permissions and stability
    - OpenWebRX container health issues

2. **WiFi Monitor Mode**
    - Hardware driver compatibility
    - Interface configuration complexity
    - Root permissions required

3. **Service Orchestration**
    - Multi-process coordination
    - PID file management
    - Service startup order dependencies

### Medium Risk Dependencies ⚠️

1. **Real-time Data Streaming**
    - WebSocket connection stability
    - Buffer management
    - Network latency sensitivity

2. **GPS Hardware Integration**
    - Serial device reliability
    - NMEA protocol parsing
    - Hardware-specific timing

3. **Docker Container Management**
    - Container health monitoring
    - Volume mount dependencies
    - Network configuration

### Low Risk Dependencies ✅

1. **REST API Integration**
    - Standard HTTP protocols
    - JSON data formats
    - Well-defined endpoints

2. **File System Operations**
    - Standard file I/O
    - Log rotation
    - Configuration management

3. **Python Virtual Environments**
    - Isolated dependency management
    - Standard pip installation
    - Reproducible environments

## Migration Strategy Recommendations

### Phase 1: Dependency Inventory (COMPLETE)

- ✅ Hardware dependency mapping
- ✅ Service dependency analysis
- ✅ Network port configuration
- ✅ File system requirements
- ✅ External API integration points

### Phase 2: Compatibility Assessment

1. **SvelteKit Integration Points**
    - TypeScript API route compatibility
    - WebSocket integration patterns
    - Real-time data streaming

2. **Service Bridge Development**
    - Python-to-TypeScript API bridges
    - Process management integration
    - Configuration management

3. **Testing Framework**
    - Hardware integration testing
    - Service dependency validation
    - Performance benchmarking

### Phase 3: Risk Mitigation

1. **Hardware Abstraction Layer**
    - HackRF interface standardization
    - WiFi adapter configuration management
    - GPS device abstraction

2. **Service Health Monitoring**
    - Automated service recovery
    - Dependency health checks
    - Performance monitoring

3. **Fallback Systems**
    - Demo data generation
    - Service degradation handling
    - Offline mode capabilities

## Conclusion

The ArgosFinal system requires integration with **6 major services**, **3 hardware devices**, and **8 network ports**. The dependency chain is complex but well-defined, with clear integration points and established communication protocols.

**Critical Success Factors:**

- Hardware driver stability (HackRF, WiFi adapters)
- Service orchestration reliability
- Real-time data streaming performance
- Network interface configuration management

**Preservation Requirements:**

- All existing API contracts and data formats
- Real-time communication protocols
- Service authentication mechanisms
- Hardware abstraction interfaces

**Next Phase:** System integration testing and service bridge development for SvelteKit migration.

---

**Agent 4 Analysis Complete:** All external dependencies and integration requirements documented with risk assessment and migration strategy.
