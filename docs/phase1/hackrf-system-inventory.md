# HackRF System Inventory - Complete Analysis

**Generated:** 2025-06-26  
**Phase:** 1.1.001 - System Documentation and Analysis  
**Agent:** Documentation Agent 1

## Executive Summary

This document provides a comprehensive inventory of the HackRF Monitor system, analyzing both the legacy implementation (running on port 3002) and the modern ArgosFinal implementation. The system consists of multiple interconnected components spanning spectrum analysis, web interfaces, and API endpoints.

## System Architecture Overview

### Legacy HackRF System (Port 3002)

- **Location:** `/home/pi/HackRF/`
- **Primary Script:** `spectrum_analyzer.py`
- **Web Interface:** Flask + SocketIO application
- **Port:** 8092 (configured), 3002 (currently running via Node.js process)
- **Integration:** OpenWebRX WebSocket connection for real-time FFT data

### Modern ArgosFinal System

- **Location:** `/home/pi/projects/ArgosFinal/`
- **Framework:** SvelteKit with TypeScript
- **Architecture:** Component-based frontend with server-side API routes
- **Integration Points:** HackRF, Kismet, and system monitoring

## Detailed Component Analysis

### 1. Legacy HackRF Spectrum Analyzer (`/home/pi/HackRF/`)

#### Core Python Application (`spectrum_analyzer.py`)

```python
# Key Components Identified:
- Flask application with SocketIO support
- OpenWebRX WebSocket connector for real-time FFT data
- Signal peak detection algorithms
- Multi-profile frequency scanning (VHF, UHF, ISM bands)
- Real-time data streaming to web clients
```

**Configuration:**

- OpenWebRX integration on localhost:8073
- WebSocket FFT data parsing (Float32, UInt8, Int16 formats)
- Signal threshold: -70 dBm
- Scan profiles: VHF (144-148 MHz), UHF (420-450 MHz), ISM (2.4 GHz)

#### HTML Template (`/home/pi/HackRF/templates/spectrum.html`)

**Complete HTML Structure:**

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>HackRF Spectrum Analyzer</title>
		<!-- External Dependencies -->
		<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.0/socket.io.js"></script>
		<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
	</head>
</html>
```

**CSS Classes and Styling (CRITICAL - Preserve Exactly):**

```css
/* Primary Layout Classes */
.header {
	text-align: center;
	margin-bottom: 20px;
}
.status-panel {
	background: #111;
	border: 2px solid #0f0;
	padding: 15px;
}
.mode-indicator {
	font-size: 24px;
	font-weight: bold;
	text-align: center;
}
.real-data-mode {
	background: #004400;
	color: #00ff00;
	border: 2px solid #00ff00;
}
.demo-mode {
	background: #440000;
	color: #ff4444;
	border: 2px solid #ff4444;
}
.controls {
	background: #111;
	border: 2px solid #0f0;
	padding: 15px;
}
.scan-profiles {
	display: flex;
	gap: 10px;
	margin-bottom: 15px;
}
.profile-btn {
	background: #003300;
	color: #0f0;
	border: 1px solid #0f0;
}
.profile-btn:hover {
	background: #004400;
}
.profile-btn.active {
	background: #0f0;
	color: #000;
}
.spectrum-display {
	background: #111;
	border: 2px solid #0f0;
	height: 400px;
}
.signals-list {
	background: #111;
	border: 2px solid #0f0;
}
.signal-item {
	background: #002200;
	border: 1px solid #0f0;
}
.signal-item.demo {
	background: #220000;
	border-color: #ff4444;
	color: #ff4444;
}
.frequency {
	font-weight: bold;
	font-size: 16px;
}
.signal-details {
	font-size: 12px;
	opacity: 0.8;
}
.loading {
	text-align: center;
	color: #ff0;
	font-size: 18px;
}
.error {
	color: #f00;
	background: #400;
	border: 1px solid #f00;
}
.log-output {
	background: #000;
	border: 1px solid #333;
	height: 200px;
	overflow-y: auto;
}
```

**JavaScript Functionality Mapping:**

```javascript
// Core Functions Identified:
- Socket.IO connection management
- Real-time FFT data processing (fft_data event)
- Status display updates
- Profile selection and scanning
- Spectrum plot rendering with Plotly.js
- Signal detection and display
- Logging system with timestamps
```

**Key HTML Elements Structure:**

```html
<!-- Status Panel -->
<div class="status-panel">
	<div id="mode-indicator" class="mode-indicator demo-mode">DEMO MODE</div>
	<div id="status-details">
		<p>OpenWebRX: <span id="openwebrx-status">Disconnected</span></p>
		<p>FFT Buffer: <span id="fft-buffer">0</span> frames</p>
		<p>Center Freq: <span id="center-freq">N/A</span></p>
		<p>Sample Rate: <span id="sample-rate">N/A</span></p>
	</div>
</div>

<!-- Control Panel -->
<div class="controls">
	<div class="scan-profiles">
		<button class="profile-btn" data-profile="vhf">VHF Amateur (144-148 MHz)</button>
		<button class="profile-btn" data-profile="uhf">UHF Amateur (420-450 MHz)</button>
		<button class="profile-btn" data-profile="ism">ISM Band (2.4 GHz)</button>
	</div>
	<button id="scan-btn" onclick="startScan()">🔍 Start Scan</button>
	<button id="refresh-status" onclick="refreshStatus()">🔄 Refresh Status</button>
</div>

<!-- Spectrum Display -->
<div class="spectrum-display">
	<div id="spectrum-plot"></div>
</div>

<!-- Signals List -->
<div class="signals-list">
	<div id="signals-container"></div>
</div>

<!-- Log Output -->
<div class="log-output" id="log-output"></div>
```

### 2. ArgosFinal Modern Implementation

#### Project Structure

```
/home/pi/projects/ArgosFinal/
├── src/
│   ├── routes/
│   │   ├── hackrf/
│   │   │   └── +page.svelte (Main HackRF page)
│   │   └── api/hackrf/ (API endpoints)
│   ├── lib/
│   │   ├── components/hackrf/ (Svelte components)
│   │   ├── services/ (API and WebSocket services)
│   │   ├── stores/ (State management)
│   │   └── styles/hackrf/ (Styling system)
│   └── app.html (Root template)
├── static/ (Static assets)
└── docs/ (Documentation)
```

#### Svelte Components Analysis

**HackRFHeader.svelte:**

```svelte
<!-- Navigation Structure -->
<header class="glass-header relative overflow-hidden sticky top-0 z-50">
	<!-- Logo and branding -->
	<div class="flex items-center space-x-3">
		<svg class="w-8 h-8 text-neon-cyan logo-icon">...</svg>
		<h1 class="font-heading text-2xl font-bold saasfly-heading-shine">HackRF Monitor</h1>
	</div>

	<!-- Navigation menu -->
	<nav class="hidden lg:flex items-center space-x-8">
		<a href="#dashboard" class="nav-link active">Dashboard</a>
		<a href="#scanner" class="nav-link">Scanner</a>
		<a href="#analysis" class="nav-link">Analysis</a>
		<a href="#settings" class="nav-link">Settings</a>
		<a href="#help" class="nav-link">Help</a>
	</nav>

	<!-- Status indicator -->
	<div class="status-indicator"></div>
</header>
```

**FrequencyConfig.svelte:**

```svelte
<!-- Frequency Management Card -->
<div class="saasfly-feature-card group rounded-2xl p-8">
	<div class="flex items-center mb-6">
		<div class="p-3 bg-gradient-to-br from-neon-cyan/20">
			<svg class="w-6 h-6 frequency-config-icon">...</svg>
		</div>
		<h3 class="frequency-config-header">Frequency Configuration</h3>
	</div>

	<!-- Frequency list with dynamic addition/removal -->
	<div id="frequencyList" class="space-y-3 mb-6">
		{#each frequencies as freq, index}
			<div class="frequency-item saasfly-interactive-card">
				<input bind:value={freq.value} placeholder="Enter frequency" />
				<button on:click={() => removeFrequency(freq.id)}>Remove</button>
			</div>
		{/each}
	</div>

	<button on:click={addFrequency} class="saasfly-btn saasfly-btn-primary"> Add Frequency </button>
</div>
```

**SpectrumChart.svelte:**

```svelte
<!-- Spectrum Analysis Display -->
<div class="glass-panel rounded-2xl p-8">
	<div class="flex items-center justify-between mb-6">
		<h2 class="font-heading text-2xl font-bold">Spectrum Analysis</h2>
		<button class="saasfly-btn saasfly-btn-secondary">Reset View</button>
	</div>

	<!-- Canvas-based chart with axis labels -->
	<div class="relative">
		<canvas bind:this={canvas} width="800" height="400"></canvas>

		<!-- Y-axis labels (dBm scale) -->
		<div class="absolute left-0 top-0 h-full flex flex-col justify-between">
			<span>0</span><span>-20</span><span>-40</span>
			<span>-60</span><span>-80</span><span>-100</span>
		</div>

		<!-- X-axis labels (frequency scale) -->
		<div class="absolute bottom-0 left-0 w-full flex justify-between">
			<span>0</span><span>100</span>...<span>1000</span>
		</div>
	</div>
</div>
```

#### CSS Framework Analysis (`/home/pi/projects/ArgosFinal/src/lib/styles/hackrf/style.css`)

**Critical CSS Variables (PRESERVE EXACTLY):**

```css
:root {
	/* Backgrounds */
	--bg-primary: #0a0a0a;
	--bg-secondary: #141414;
	--bg-card: #141414;
	--bg-input: #1a1a1a;
	--bg-hover: #2d2d2d;

	/* Accent Colors */
	--accent-primary: #bfff00;
	--accent-hover: #d4ff00;
	--accent-muted: #a3d500;
	--accent-active: #8fbf00;

	/* Signal Strength Colors */
	--signal-none: #ffffff;
	--signal-weak: #60a5fa;
	--signal-moderate: #fbbf24;
	--signal-strong: #ff6b35;
	--signal-very-strong: #dc2626;

	/* Error Panel Colors */
	--error-bg: #2a1f1f;
	--error-border: #ff6b6b;
	--recovery-bg: #1f2a1f;
	--recovery-border: #68d391;
}
```

**Component-Specific Styling:**

```css
/* Glass panel effects */
.glass-header { backdrop-blur-xl; }
.glass-panel { background: rgba(...); border: ...; }

/* Interactive elements */
.saasfly-btn { transition: all 0.2s ease; }
.saasfly-btn-primary { background: var(--accent-primary); }
.saasfly-feature-card { border-radius: 2xl; padding: 2rem; }

/* Signal visualization */
.signal-indicator { height: 28px; background: var(--bg-input); }
.signal-indicator-fill { transition: width 0.3s ease; }
```

#### API Endpoints Structure

**Main HackRF API (`/api/hackrf/+server.ts`):**

```typescript
export const GET: RequestHandler = async () => {
	return json({
		success: true,
		message: 'HackRF API',
		version: '1.0.0',
		endpoints: [
			'/api/hackrf/health',
			'/api/hackrf/start-sweep',
			'/api/hackrf/stop-sweep',
			'/api/hackrf/cycle-status',
			'/api/hackrf/emergency-stop',
			'/api/hackrf/force-cleanup',
			'/api/hackrf/data-stream'
		]
	});
};
```

**Available API Routes:**

```
/api/hackrf/
├── health/ - System health checks
├── start-sweep/ - Initiate spectrum sweep
├── stop-sweep/ - Stop current sweep
├── cycle-status/ - Cycling status information
├── emergency-stop/ - Emergency shutdown
├── force-cleanup/ - Force cleanup operations
└── data-stream/ - Real-time data streaming
```

### 3. Data Flow Architecture

#### Legacy System Data Flow:

```
OpenWebRX (port 8073)
  ↓ WebSocket FFT data
spectrum_analyzer.py
  ↓ Signal processing & peak detection
Flask/SocketIO (port 8092)
  ↓ Real-time updates
HTML/JavaScript Client
  ↓ Plotly.js visualization
User Interface
```

#### ArgosFinal Data Flow:

```
HackRF Hardware
  ↓ Backend services
SvelteKit API Routes (/api/hackrf/*)
  ↓ TypeScript interfaces
Svelte Components
  ↓ Reactive state management
User Interface (Modern web stack)
```

### 4. Integration Points and Dependencies

#### External Dependencies:

- **Socket.IO 4.0.0** (legacy system)
- **Plotly.js** (legacy visualization)
- **OpenWebRX** (Docker container on port 8073)
- **SvelteKit** (modern framework)
- **Tailwind CSS** (modern styling)

#### Hardware Dependencies:

- **HackRF One** SDR device
- **USB connectivity** for HackRF
- **Raspberry Pi** host system

### 5. Port Configuration and Network Architecture

**Current Port Assignments:**

- Port 3002: Node.js process (likely ArgosFinal dev server)
- Port 8073: OpenWebRX Docker container
- Port 8092: Legacy Python spectrum analyzer (configured but not active)

**Network Flow:**

```
Client Browser → Port 3002 (ArgosFinal) → Backend APIs
                ↓
OpenWebRX (8073) ← WebSocket ← Spectrum Analyzer
```

### 6. File System Structure Mapping

#### Legacy Implementation Files:

```
/home/pi/HackRF/
├── spectrum_analyzer.py (451 lines - main application)
├── templates/spectrum.html (391 lines - web interface)
├── config.json (configuration)
├── venv/ (Python virtual environment)
└── [various helper scripts and data files]
```

#### ArgosFinal Implementation Files:

```
/home/pi/projects/ArgosFinal/src/
├── routes/hackrf/+page.svelte (55 lines - main page)
├── lib/components/hackrf/
│   ├── HackRFHeader.svelte (94 lines)
│   ├── FrequencyConfig.svelte (65 lines)
│   ├── SpectrumChart.svelte (91 lines)
│   ├── StatusDisplay.svelte
│   ├── SweepControl.svelte
│   ├── AnalysisTools.svelte
│   └── GeometricBackground.svelte
├── lib/styles/hackrf/style.css (1550 lines - comprehensive styling)
└── routes/api/hackrf/ (multiple TypeScript API endpoints)
```

## Key Preservation Requirements

### CRITICAL - Must Preserve Exactly:

1. **Legacy CSS Classes** - All styling classes in spectrum.html must remain identical
2. **JavaScript Function Names** - All event handlers and function signatures
3. **HTML Element IDs** - All DOM element identifiers for JavaScript targeting
4. **API Endpoint Structure** - Existing REST API patterns and responses
5. **WebSocket Message Formats** - FFT data streaming protocols
6. **Signal Processing Algorithms** - Peak detection and frequency analysis logic

### Component Dependencies:

- OpenWebRX integration must remain functional
- Real-time data streaming capabilities
- Multi-profile frequency scanning
- Signal strength visualization
- Status monitoring and error handling

## Migration Considerations

### Data Format Compatibility:

- FFT data parsing (Float32, UInt8, Int16)
- Signal threshold configurations (-70 dBm default)
- Frequency range definitions (VHF, UHF, ISM)
- Status message protocols

### UI/UX Consistency:

- Terminal-style green-on-black aesthetic (legacy)
- Modern glass morphism design (ArgosFinal)
- Responsive mobile layouts
- Real-time update patterns

### Performance Requirements:

- Real-time FFT data processing
- WebSocket streaming capabilities
- Canvas-based spectrum visualization
- Efficient signal peak detection

## Recommendations for Phase 1.1.002

1. **Preserve Legacy Functionality** - Maintain all existing features during migration
2. **Gradual Component Integration** - Migrate components incrementally
3. **Dual System Support** - Keep both systems operational during transition
4. **Comprehensive Testing** - Validate all signal processing algorithms
5. **Documentation Updates** - Maintain API compatibility documentation

---

**Status:** ✅ COMPLETE - System inventory documented with full preservation requirements  
**Next Phase:** 1.1.002 - Component migration planning and implementation strategy
