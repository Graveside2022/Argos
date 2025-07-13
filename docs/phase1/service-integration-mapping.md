# Service Integration Mapping - Phase 1.1.005

**Agent 5 Execution**  
**Date:** 2025-06-26  
**BINDING RULES ACKNOWLEDGED:** Christian's instructions are absolute rules  
**Status:** ANALYSIS COMPLETE - DOCUMENTATION ONLY, NO MODIFICATIONS

---

## Executive Summary

This document provides comprehensive mapping of all service integrations and data flows within the ArgosFinal system ecosystem. The analysis covers current legacy services, the new SvelteKit implementation, and the integration patterns required for unified system operation.

## Service Architecture Overview

### Current Service Ecosystem

The ArgosFinal system integrates with a complex ecosystem of services spanning multiple technologies and communication protocols:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARGOSFINAL ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│  Legacy Services                    │  ArgosFinal (SvelteKit)   │
│  ┌─────────────────┐              │  ┌─────────────────────┐  │
│  │ HackRF (8092)   │◄─────────────┼──┤ HackRF API Routes   │  │
│  │ WigleToTAK      │              │  │ (/api/hackrf/*)     │  │
│  │ (8000)          │              │  │                     │  │
│  │ Kismet Ops     │◄─────────────┼──┤ Kismet API Routes   │  │
│  │ (8002)          │              │  │ (/api/kismet/*)     │  │
│  │ GPS Bridge      │              │  │                     │  │
│  │ (2947)          │              │  │ System API Routes   │  │
│  └─────────────────┘              │  │ (/api/system/*)     │  │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Service Integration Points

### 1. HackRF SDR System Integration

#### Legacy Service (Python Flask - Port 8092)

```python
# Service Details
Location: /home/pi/HackRF/spectrum_analyzer.py
Framework: Flask + Flask-SocketIO
Port: 8092 (configured), currently proxied via Node.js on 3002
Dependencies: OpenWebRX (8073), NumPy, WebSocket connection
```

#### Data Flow Architecture

```
HackRF Hardware (USB) → OpenWebRX (8073) → WebSocket (ws://localhost:8073/ws/)
    ↓
Python Flask App (8092) → SocketIO → HTML Client (spectrum.html)
    ↓
Real-time FFT Data Processing → Signal Detection → User Interface
```

#### ArgosFinal Integration (SvelteKit)

```typescript
// API Route Structure
/api/hackrf/
├── +server.ts              # Main API info endpoint
├── health/+server.ts        # Device health checks
├── start-sweep/+server.ts   # Initiate spectrum sweep
├── stop-sweep/+server.ts    # Stop current sweep
├── cycle-status/+server.ts  # Current sweep status
├── emergency-stop/+server.ts # Force stop operations
├── force-cleanup/+server.ts # Clean zombie processes
└── data-stream/+server.ts   # Server-Sent Events stream
```

#### Critical Data Structures

```typescript
interface SpectrumData {
	frequencies: number[]; // MHz values
	powers: number[]; // dBm values
	timestamp: number; // Unix timestamp
	centerFrequency: number; // Current center freq
	sampleRate: number; // Samples per second
}

interface SweepConfig {
	centerFrequency: number; // Center frequency in Hz
	bandwidth?: number; // Sweep bandwidth
	sampleRate?: number; // Sample rate
	lnaGain?: number; // LNA gain setting
	vgaGain?: number; // VGA gain setting
}
```

### 2. WiFi Scanning (Kismet) Integration

#### Legacy Service Architecture

```bash
# Service Chain
Kismet Server (2501) → REST API → Kismet Operations Center (8002)
    ↓
WigleToTAK (8000) → CSV Processing → TAK XML Generation → UDP Broadcast (6969)
```

#### Kismet Operations Center (Node.js - Port 8002)

```javascript
// Service Details
Location: /home/pi/stinkster_christian/src/nodejs/kismet-operations/server.js
Framework: Express.js 4.18.2 + Socket.IO 4.7.2
Architecture: Monolithic server (API + static content)

// Proxy Configuration
Kismet API Proxy: /api/kismet/* → http://localhost:2501
WigleToTAK Proxy: /api/wigle/* → http://localhost:8000
Authentication: admin:admin (hardcoded)
```

#### ArgosFinal Kismet Integration

```typescript
// SvelteKit API Structure
/api/kismet/
├── +server.ts                    # API information endpoint
├── service/
│   ├── status/+server.ts         # Service health status
│   ├── start/+server.ts          # Start Kismet service
│   ├── stop/+server.ts           # Stop Kismet service
│   └── restart/+server.ts        # Restart service
├── devices/
│   ├── list/+server.ts           # WiFi device listing
│   └── stats/+server.ts          # Device statistics
├── scripts/
│   ├── list/+server.ts           # Available scripts
│   └── execute/+server.ts        # Script execution
├── config/+server.ts             # Configuration management
├── proxy/[...path]/+server.ts    # Generic proxy endpoint
└── ws/+server.ts                 # WebSocket endpoint
```

#### Kismet Device Data Structure

```typescript
interface KismetDevice {
	mac: string; // Device MAC address
	firstSeen: string; // ISO timestamp
	lastSeen: string; // ISO timestamp
	ssid?: string; // Network SSID
	manufacturer?: string; // Device manufacturer
	signalStrength?: number; // dBm value
	channel?: number; // WiFi channel
	encryption?: string[]; // Encryption types
	frequency?: number; // Frequency in Hz
	packets?: number; // Packet count
	lat?: number; // GPS latitude
	lon?: number; // GPS longitude
	alt?: number; // GPS altitude
}
```

### 3. GPS Location Services Integration

#### GPS Service Chain

```bash
# Hardware → Software Bridge → System Service
GPS Hardware (USB/Serial) → MAVLink Bridge (mavgps.py) → GPSD Daemon (2947)
    ↓
Location Data → Kismet Integration → Device Geolocation → TAK Broadcasting
```

#### GPSD Protocol Integration

```javascript
// Connection Details
Protocol: TCP Socket (localhost:2947)
Data Format: NMEA 0183 strings + JSON responses
Commands:
- ?WATCH={"enable":true,"json":true}  // Enable JSON mode
- ?POLL                               // Request position
- ?VERSION                           // Get daemon version

// Data Structure
interface GPSData {
  lat: number;        // Latitude (degrees)
  lon: number;        // Longitude (degrees)
  alt: number;        // Altitude (meters)
  time: string;       // ISO timestamp
  mode: number;       // Fix quality (1=no fix, 2=2D, 3=3D)
}
```

### 4. TAK Integration (WigleToTAK Service)

#### Service Details

```python
# WigleToTAK Flask Application
Location: /home/pi/WigletoTAK/WigleToTAK/TheStinkToTAK/
Framework: Flask (simple)
Port: 8000 (configurable via --flask-port)
Dependencies: CSV processing, XML generation
```

#### Data Transformation Pipeline

```
Kismet WiFi Data (.wiglecsv) → CSV Processing → TAK XML Generation
    ↓
Cursor-on-Target XML → UDP Multicast → TAK Clients (ATAK/WinTAK)
Broadcasting Port: 6969 (configurable)
```

#### TAK Data Format

```xml
<!-- TAK XML Structure -->
<event version="2.0" uid="device-mac-address" type="a-n-G" time="..." start="..." stale="...">
  <point lat="40.7128" lon="-74.0060" hae="10.5" ce="5.0" le="3.0"/>
  <detail>
    <contact callsign="WiFi-Device"/>
    <status battery="100"/>
    <track speed="0" course="0"/>
  </detail>
</event>
```

## Real-Time Communication Patterns

### 1. WebSocket Architecture

#### Legacy WebSocket Implementations

```javascript
// HackRF Spectrum Analyzer (Flask-SocketIO)
Events:
- 'fft_data': Real-time spectrum data from OpenWebRX
- 'status_update': Device status changes
- 'sweep_complete': Sweep operation finished
- 'error': Error notifications

// Kismet Operations Center (Socket.IO)
Events:
- 'kismetData': WiFi device updates
- 'fftData': Spectrum analyzer data
- 'signalsDetected': Signal detection results
- 'configUpdated': Configuration changes
```

#### ArgosFinal WebSocket Integration

```typescript
// Unified WebSocket Architecture
interface WebSocketMessage {
	type: 'device_update' | 'spectrum_data' | 'status_change' | 'error';
	source: 'hackrf' | 'kismet' | 'gps' | 'system';
	data: any;
	timestamp: string;
}

// WebSocket Service Classes
export class HackRFWebSocket extends BaseWebSocket {
	handleSpectrumData(data: SpectrumData): void;
	handleStatusUpdate(status: HackRFStatus): void;
}

export class KismetWebSocket extends BaseWebSocket {
	handleDeviceUpdate(device: KismetDevice): void;
	handleStatsUpdate(stats: KismetStats): void;
}
```

### 2. HTTP API Integration Patterns

#### Request/Response Flow

```typescript
// ArgosFinal → Legacy Service Communication
Frontend (SvelteKit) → API Route (/api/service/*) → Legacy Service (HTTP/REST)
    ↓
Response Processing → Data Transformation → Frontend Update

// Example: HackRF Status Check
GET /api/hackrf/health → Python Flask (8092) → OpenWebRX (8073) → Status Response
```

#### Error Handling Strategy

```typescript
interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}

// Cascading Error Recovery
try {
	// Primary service call
	const result = await legacyService.call();
} catch (primaryError) {
	// Fallback to demo data
	const demoResult = await demoDataService.call();
	return { ...demoResult, source: 'demo' };
}
```

## Service Startup and Dependency Management

### 1. Service Orchestration

#### Legacy Orchestration (Bash Scripts)

```bash
# Main orchestration script: /home/pi/stinky/gps_kismet_wigle.sh
Service Startup Order:
1. GPS Service (mavgps.py → GPSD)
2. Kismet Server (port 2501)
3. WigleToTAK Service (port 8000)
4. Kismet Operations Center (port 8002)

# Health Monitoring
PID Files: /home/pi/tmp/gps_kismet_wigle.pids
Log Files: /home/pi/tmp/*.log
Process Monitoring: pgrep commands with automatic restart
```

#### ArgosFinal Service Dependencies

```typescript
// Service Health Check Chain
interface ServiceHealth {
	name: string;
	status: 'healthy' | 'degraded' | 'unhealthy';
	port?: number;
	lastCheck: string;
	dependencies: string[];
}

// Health Check Sequence
const healthChecks: ServiceHealth[] = [
	{ name: 'gpsd', port: 2947, dependencies: ['gps-hardware'] },
	{ name: 'kismet', port: 2501, dependencies: ['gpsd', 'wifi-interfaces'] },
	{ name: 'wigletotak', port: 8000, dependencies: ['kismet'] },
	{ name: 'openwebrx', port: 8073, dependencies: ['hackrf-hardware'] },
	{ name: 'hackrf-analyzer', port: 8092, dependencies: ['openwebrx'] }
];
```

### 2. Configuration Management

#### Centralized Configuration Strategy

```typescript
// Configuration Hierarchy
interface SystemConfig {
	services: {
		hackrf: {
			centerFrequency: number;
			gain: { lna: number; vga: number };
			sampleRate: number;
		};
		kismet: {
			interfaces: string[];
			logLevel: string;
			gpsd: { enabled: boolean; host: string; port: number };
		};
		tak: {
			broadcastPort: number;
			updateInterval: number;
		};
	};
	network: {
		ports: Record<string, number>;
		hosts: Record<string, string>;
	};
}
```

## Data Flow Patterns

### 1. Unidirectional Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

Hardware Layer:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  HackRF SDR  │    │ WiFi Adapter │    │  GPS Device  │
│   (USB)      │    │ (Monitor)    │    │  (Serial)    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
Service Layer:
┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐
│  OpenWebRX   │    │   Kismet     │    │    GPSD      │
│   (8073)     │    │   (2501)     │    │   (2947)     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
Application Layer:
┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐
│HackRF Analyzer│   │WigleToTAK    │    │ GPS Bridge   │
│   (8092)     │    │   (8000)     │    │  (mavgps)    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
Integration Layer:
┌──────▼───────────────────▼───────────────────▼───────┐
│              ArgosFinal SvelteKit                    │
│         Frontend + API Routes + WebSocket            │
│                   (Target)                           │
└──────────────────────────────────────────────────────┘
```

### 2. Real-Time Streaming Data Paths

#### Spectrum Data Stream

```typescript
// OpenWebRX → HackRF Analyzer → ArgosFinal
WebSocket: ws://localhost:8073/ws/
Data Types: Float32Array (FFT), UInt8Array (Waterfall), Int16Array (Audio)
Buffer Size: Real-time processing, ~1024 samples
Update Rate: ~10-20 Hz depending on bandwidth
Signal Threshold: -70 dBm (configurable)

// Data Processing Pipeline
FFT Raw Data → Peak Detection → Signal Classification → Frontend Display
```

#### WiFi Device Tracking Stream

```typescript
// Kismet → WigleToTAK → TAK Broadcast
Polling Interval: 5 seconds (configurable)
Data Format: JSON → CSV → TAK XML
Location Enrichment: GPS coordinates from GPSD
Broadcast Protocol: UDP multicast on port 6969
Client Support: ATAK, WinTAK, TAK Server
```

## Error Handling and Recovery Mechanisms

### 1. Service Recovery Strategies

#### Automatic Service Recovery

```typescript
interface RecoveryStrategy {
	service: string;
	healthCheckInterval: number; // milliseconds
	maxFailures: number; // before declaring unhealthy
	recoveryActions: RecoveryAction[];
}

type RecoveryAction =
	| 'restart_service'
	| 'reset_hardware'
	| 'fallback_demo_data'
	| 'notify_admin'
	| 'graceful_degradation';

// Example Recovery Configuration
const hackrfRecovery: RecoveryStrategy = {
	service: 'hackrf',
	healthCheckInterval: 30000,
	maxFailures: 3,
	recoveryActions: ['reset_hardware', 'restart_service', 'fallback_demo_data']
};
```

#### Graceful Degradation Patterns

```typescript
// Service Availability Matrix
interface ServiceMatrix {
	hackrf: {
		primary: 'openwebrx_integration';
		fallback: 'demo_spectrum_data';
		degraded: 'static_frequency_list';
	};
	kismet: {
		primary: 'live_device_scanning';
		fallback: 'demo_device_data';
		degraded: 'cached_device_list';
	};
	gps: {
		primary: 'gpsd_live_coordinates';
		fallback: 'static_coordinates';
		degraded: 'no_location_data';
	};
}
```

### 2. Connection Management

#### WebSocket Connection Resilience

```typescript
class ResilientWebSocket {
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Base delay in ms

	private reconnect(): void {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
			setTimeout(() => this.connect(), delay);
			this.reconnectAttempts++;
		} else {
			this.fallbackToPolling();
		}
	}

	private fallbackToPolling(): void {
		// Switch to HTTP polling when WebSocket fails
		setInterval(() => this.httpHealthCheck(), 5000);
	}
}
```

## Configuration Management Across Services

### 1. Configuration File Hierarchy

```bash
# Configuration File Locations
/home/pi/projects/ArgosFinal/
├── app.config.json              # ArgosFinal main config
├── .env                         # Environment variables
└── docs/config/
    ├── hackrf.config.json       # HackRF specific settings
    ├── kismet.config.json       # Kismet configuration
    └── system.config.json       # System-wide settings

# Legacy Configuration Files (Preserve)
/home/pi/HackRF/config.json                    # HackRF legacy config
/home/pi/kismet_ops/kismet_site.conf          # Kismet configuration
/home/pi/openwebrx-hackrf-config.json         # SDR configuration
/home/pi/WigletoTAK/.../config.ini           # TAK service config
```

### 2. Configuration Synchronization

```typescript
// Configuration Management Service
class ConfigManager {
	async syncConfigurations(): Promise<void> {
		// Read ArgosFinal config
		const argosfinalConfig = await this.loadConfig('app.config.json');

		// Propagate to legacy services
		await this.updateHackRFConfig(argosfinalConfig.hackrf);
		await this.updateKismetConfig(argosfinalConfig.kismet);
		await this.updateTAKConfig(argosfinalConfig.tak);

		// Restart affected services
		await this.restartServices(['hackrf', 'kismet']);
	}

	async validateConfiguration(config: SystemConfig): Promise<ValidationResult> {
		// Port conflict detection
		// Hardware availability checks
		// Service dependency validation
		// Return validation results
	}
}
```

## Migration Considerations and Integration Points

### 1. Legacy Service Preservation

#### Critical Preservation Requirements

```typescript
// Must preserve exactly during migration:
interface PreservationRequirements {
	apiContracts: {
		endpoints: string[]; // All REST endpoint signatures
		responseFormats: object[]; // JSON response structures
		errorCodes: number[]; // HTTP status codes
	};
	dataFormats: {
		spectrumData: SpectrumData; // FFT data structure
		deviceData: KismetDevice; // WiFi device format
		takXml: string; // TAK XML schema
	};
	communicationProtocols: {
		websocket: WebSocketMessage; // Real-time message format
		httpAuth: AuthConfig; // Authentication methods
		udpBroadcast: TAKBroadcast; // TAK UDP protocol
	};
}
```

#### Gradual Migration Strategy

```typescript
// Phase-based Integration Approach
interface MigrationPhase {
	phase: number;
	description: string;
	services: string[];
	riskLevel: 'low' | 'medium' | 'high';
	rollbackPlan: string;
}

const migrationPlan: MigrationPhase[] = [
	{
		phase: 1,
		description: 'API Route Creation & Testing',
		services: ['api-skeleton'],
		riskLevel: 'low',
		rollbackPlan: 'Remove new routes, no impact on legacy'
	},
	{
		phase: 2,
		description: 'WebSocket Integration',
		services: ['websocket-bridge'],
		riskLevel: 'medium',
		rollbackPlan: 'Disable WebSocket, fallback to polling'
	},
	{
		phase: 3,
		description: 'Service Integration',
		services: ['hackrf', 'kismet', 'gps'],
		riskLevel: 'high',
		rollbackPlan: 'Switch back to legacy services entirely'
	}
];
```

### 2. Performance Optimization

#### Real-Time Data Processing

```typescript
// Buffer Management for High-Frequency Data
class DataBuffer<T> {
	private buffer: T[] = [];
	private maxSize: number;
	private processingInterval: number;

	constructor(maxSize = 1000, processingInterval = 100) {
		this.maxSize = maxSize;
		this.processingInterval = processingInterval;
		this.startProcessing();
	}

	add(data: T): void {
		this.buffer.push(data);
		if (this.buffer.length > this.maxSize) {
			this.buffer.shift(); // Remove oldest data
		}
	}

	private startProcessing(): void {
		setInterval(() => {
			if (this.buffer.length > 0) {
				const batchData = this.buffer.splice(0, 10); // Process in batches
				this.processBatch(batchData);
			}
		}, this.processingInterval);
	}
}
```

## Conclusion

The ArgosFinal service integration architecture presents a complex but well-structured ecosystem requiring careful preservation of:

**Critical Integration Points:**

- **Hardware Dependencies:** HackRF SDR, WiFi adapters, GPS devices
- **Service Communication:** REST APIs, WebSocket streams, UDP broadcasts
- **Data Format Compatibility:** Spectrum data, WiFi devices, TAK XML
- **Real-time Performance:** Sub-second response times, streaming data
- **Service Orchestration:** Startup dependencies, health monitoring, recovery

**Migration Success Factors:**

- Maintain all existing API contracts and data formats
- Preserve real-time communication protocols and performance
- Implement graceful degradation and error recovery mechanisms
- Provide comprehensive configuration management across services
- Support dual-mode operation during transition phases

**Next Phase:** Implementation of service bridges and integration testing to validate communication patterns and data flow integrity.

---

**Agent 5 Analysis Complete:** Service integration mapping documents all data flows, API patterns, communication protocols, and dependency relationships for successful ArgosFinal system integration.
