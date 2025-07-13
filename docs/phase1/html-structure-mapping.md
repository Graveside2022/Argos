# HTML Structure Mapping - Phase 1.2

## Executive Summary

This document provides comprehensive HTML structure mapping for both HackRF Spectrum Analyzer and Kismet Operations Center applications, documenting the exact DOM hierarchy, CSS classes, interactive elements, and data attributes required for pixel-perfect preservation during SvelteKit migration.

## 1. HackRF Spectrum Analyzer Application

### 1.1 HTML Structure Overview

**File Location**: `/home/pi/HackRF/templates/spectrum.html`  
**Python Backend**: `/home/pi/HackRF/spectrum_analyzer.py`  
**Port**: 8092  
**WebSocket Integration**: Socket.IO for real-time FFT data

### 1.2 Complete DOM Hierarchy

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
	<body>
		<!-- 1. Header Section -->
		<div class="header">
			<h1>🛡️ HackRF Spectrum Analyzer</h1>
			<p>Real-time Signal Detection with OpenWebRX Integration</p>
		</div>

		<!-- 2. Status Panel -->
		<div class="status-panel">
			<h3>System Status</h3>
			<div id="mode-indicator" class="mode-indicator demo-mode">DEMO MODE - No real data</div>
			<div id="status-details">
				<p>OpenWebRX: <span id="openwebrx-status">Disconnected</span></p>
				<p>FFT Buffer: <span id="fft-buffer">0</span> frames</p>
				<p>Center Freq: <span id="center-freq">N/A</span></p>
				<p>Sample Rate: <span id="sample-rate">N/A</span></p>
			</div>
		</div>

		<!-- 3. Controls Panel -->
		<div class="controls">
			<h3>Scan Profiles</h3>
			<div class="scan-profiles">
				<button class="profile-btn" data-profile="vhf">VHF Amateur (144-148 MHz)</button>
				<button class="profile-btn" data-profile="uhf">UHF Amateur (420-450 MHz)</button>
				<button class="profile-btn" data-profile="ism">ISM Band (2.4 GHz)</button>
			</div>
			<button id="scan-btn" onclick="startScan()">🔍 Start Scan</button>
			<button id="refresh-status" onclick="refreshStatus()">🔄 Refresh Status</button>
		</div>

		<!-- 4. Spectrum Display -->
		<div class="spectrum-display">
			<div id="spectrum-plot"></div>
		</div>

		<!-- 5. Signals List -->
		<div class="signals-list">
			<h3>Detected Signals</h3>
			<div id="loading" class="loading" style="display: none;">Scanning for signals...</div>
			<div id="signals-container"></div>
		</div>

		<!-- 6. Log Output -->
		<div class="log-output" id="log-output">
			<h4>System Log</h4>
		</div>
	</body>
</html>
```

### 1.3 CSS Classes and Styling

**Critical CSS Classes for Preservation:**

1. **Layout Classes**:
    - `.header` - Main title section
    - `.status-panel` - System status container
    - `.controls` - Control buttons container
    - `.spectrum-display` - Plotly.js chart container
    - `.signals-list` - Signal detection results
    - `.log-output` - System log display

2. **Interactive Element Classes**:
    - `.profile-btn` - Frequency profile selector buttons
    - `.profile-btn.active` - Selected profile state
    - `.scan-profiles` - Profile button container
    - `.signal-item` - Individual signal display
    - `.signal-item.demo` - Demo mode signal styling

3. **State-based Classes**:
    - `.mode-indicator` - Base mode display
    - `.real-data-mode` - Real data mode styling (green)
    - `.demo-mode` - Demo mode styling (red)
    - `.loading` - Loading state display
    - `.error` - Error message styling

4. **Component-specific Classes**:
    - `.frequency` - Signal frequency display
    - `.signal-details` - Signal metadata display

### 1.4 Critical IDs for JavaScript Integration

**Essential Element IDs:**

- `#mode-indicator` - Mode status display
- `#openwebrx-status` - OpenWebRX connection status
- `#fft-buffer` - FFT buffer size display
- `#center-freq` - Center frequency display
- `#sample-rate` - Sample rate display
- `#scan-btn` - Start scan button
- `#refresh-status` - Refresh status button
- `#spectrum-plot` - Plotly.js container
- `#loading` - Loading indicator
- `#signals-container` - Signal results container
- `#log-output` - System log container

### 1.5 Data Attributes

**Required Data Attributes:**

- `data-profile="vhf"` - VHF profile selector
- `data-profile="uhf"` - UHF profile selector
- `data-profile="ism"` - ISM profile selector

### 1.6 Event Handlers and Interactions

**JavaScript Event Bindings:**

1. **Socket.IO Events**:
    - `connect` - Connection established
    - `fft_data` - Real-time FFT data reception
    - `status` - Status updates

2. **DOM Events**:
    - Profile button clicks (`data-profile` handling)
    - Scan button click (`startScan()`)
    - Refresh button click (`refreshStatus()`)

3. **API Endpoints**:
    - `/api/status` - System status
    - `/api/scan/<profile>` - Signal scanning
    - `/api/profiles` - Available profiles

### 1.7 External Dependencies

**CDN Dependencies:**

- Socket.IO 4.0.0: `https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.0/socket.io.js`
- Plotly.js: `https://cdn.plot.ly/plotly-latest.min.js`

## 2. Kismet Operations Center Application

### 2.1 HTML Structure Overview

**File Location**: `/home/pi/projects/stinkster_malone/stinkster/src/nodejs/kismet-operations/views/index.html`  
**Node.js Backend**: `/home/pi/projects/stinkster_malone/stinkster/src/nodejs/kismet-operations/index.js`  
**Port**: 8888  
**Integration**: Kismet iframe embed with custom controls

### 2.2 Complete DOM Hierarchy

**Based on actual implementation at `/home/pi/projects/stinkster_malone/stinkster/src/nodejs/kismet-operations/views/index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta
			http-equiv="Content-Security-Policy"
			content="default-src 'self'; script-src 'self' 'unsafe-inline' unpkg.com cesium.com; style-src 'self' 'unsafe-inline' unpkg.com cesium.com; img-src 'self' data: blob: unpkg.com cesium.com; connect-src 'self' ws: wss:; frame-src 'self' localhost:2501;"
		/>
		<title>Kismet Operations Center</title>
		<!-- External CSS Dependencies -->
		<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
		<link
			rel="stylesheet"
			href="https://cesium.com/downloads/cesiumjs/releases/1.95/Build/Cesium/Widgets/widgets.css"
		/>
		<link rel="stylesheet" href="/css/kismet-operations.css" />
	</head>
	<body>
		<!-- 1. Top Banner with System Status -->
		<div class="top-banner">
			<div class="planetary-container">
				<div class="planetary-grid">
					<div class="planetary-field">
						<span class="field-label">STELLAR CLASSIFICATION:</span>
						<span class="field-value" id="planetary-message"
							>Initializing Command Interface...</span
						>
					</div>
					<div class="planetary-field">
						<span class="field-label">TACTICAL STATUS:</span>
						<span class="field-value" id="system-message">System Online</span>
					</div>
				</div>
			</div>
		</div>

		<!-- 2. Main Content Container -->
		<div class="main-container">
			<!-- 2.1 Enhanced Grid System -->
			<div class="enhanced-grid" id="enhanced-grid">
				<!-- System Status Grid Item -->
				<div class="grid-item system-status-box" data-name="system-status">
					<div class="grid-header">
						<h3>🖥️ SYSTEM STATUS</h3>
						<div class="grid-controls">
							<button class="minimize-btn" onclick="toggleMinimize(this)">─</button>
						</div>
					</div>
					<div class="grid-content">
						<div class="status-grid">
							<div class="status-item">
								<div class="status-icon">🌐</div>
								<div class="status-info">
									<div class="status-label">IP Address</div>
									<div class="status-value" id="ip-address">Loading...</div>
								</div>
							</div>
							<div class="status-item">
								<div class="status-icon">🛰️</div>
								<div class="status-info">
									<div class="status-label">GPS Status</div>
									<div class="status-value" id="gps-status">Loading...</div>
								</div>
							</div>
							<div class="status-item">
								<div class="status-icon">📍</div>
								<div class="status-info">
									<div class="status-label">GPS Coordinates</div>
									<div class="status-value">
										<span id="gps-lat">--</span>, <span id="gps-lon">--</span>
									</div>
								</div>
							</div>
							<div class="status-item">
								<div class="status-icon">⛰️</div>
								<div class="status-info">
									<div class="status-label">Altitude / MGRS</div>
									<div class="status-value">
										<span id="gps-alt">--</span>m /
										<span id="gps-mgrs">--</span>
									</div>
								</div>
							</div>
							<div class="status-item">
								<div class="status-icon">🕐</div>
								<div class="status-info">
									<div class="status-label">GPS Time</div>
									<div class="status-value" id="gps-time">--</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Kismet Integration Grid Item -->
				<div class="grid-item kismet-box" data-name="kismet">
					<div class="grid-header">
						<h3>📡 KISMET INTERFACE</h3>
						<div class="grid-controls">
							<button class="minimize-btn" onclick="toggleMinimize(this)">─</button>
						</div>
					</div>
					<div class="grid-content">
						<div class="kismet-iframe-container">
							<iframe
								id="kismet-iframe"
								src="http://localhost:2501"
								width="100%"
								height="100%"
								frameborder="0"
								sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
							>
								<p>
									Unable to load Kismet interface. Please ensure Kismet is running
									on port 2501.
								</p>
							</iframe>
						</div>
					</div>
				</div>

				<!-- Service Control Grid Item -->
				<div class="grid-item service-control-box" data-name="service-control">
					<div class="grid-header">
						<h3>⚙️ SERVICE CONTROL</h3>
						<div class="grid-controls">
							<button class="minimize-btn" onclick="toggleMinimize(this)">─</button>
						</div>
					</div>
					<div class="grid-content">
						<div class="service-buttons">
							<button
								class="service-btn start-btn"
								onclick="executeScript('gps_kismet_wigle')"
							>
								🚀 START ALL SERVICES
							</button>
							<button
								class="service-btn restart-btn"
								onclick="executeScript('smart_restart')"
							>
								🔄 SMART RESTART
							</button>
							<button
								class="service-btn stop-btn"
								onclick="executeScript('stop_restart_services')"
							>
								⏹️ STOP & RESTART
							</button>
						</div>
						<div class="individual-services">
							<h4>Individual Services</h4>
							<div class="service-row">
								<button
									class="service-btn-small"
									onclick="executeScript('start_kismet')"
								>
									📡 Kismet
								</button>
								<button class="service-btn-small" onclick="executeScript('mavgps')">
									🛰️ GPS
								</button>
								<button
									class="service-btn-small"
									onclick="executeScript('spectrum_analyzer')"
								>
									📊 Spectrum
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Signal Visualization Grid Item -->
				<div class="grid-item signal-visualization-box" data-name="signal-viz">
					<div class="grid-header">
						<h3>📊 SIGNAL VISUALIZATION</h3>
						<div class="grid-controls">
							<button class="minimize-btn" onclick="toggleMinimize(this)">─</button>
						</div>
					</div>
					<div class="grid-content">
						<div class="signal-display">
							<div class="signal-grid" id="signal-grid">
								<!-- Dynamic signal content populated by JavaScript -->
							</div>
						</div>
					</div>
				</div>

				<!-- System Logs Grid Item -->
				<div class="grid-item system-logs-box" data-name="system-logs">
					<div class="grid-header">
						<h3>📋 SYSTEM LOGS</h3>
						<div class="grid-controls">
							<button class="minimize-btn" onclick="toggleMinimize(this)">─</button>
						</div>
					</div>
					<div class="grid-content">
						<div class="log-container">
							<div class="log-output" id="log-output">
								<div class="log-entry">System initialized...</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 3. WebSocket and Script Execution Status -->
		<div class="status-footer">
			<div class="connection-status">
				<span id="websocket-status" class="status-indicator">🔴 Disconnected</span>
			</div>
		</div>

		<!-- External JavaScript Dependencies -->
		<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
		<script src="https://cesium.com/downloads/cesiumjs/releases/1.95/Build/Cesium/Cesium.js"></script>
		<script src="/mgrs.min.js"></script>
		<script src="/js/kismet-operations.js"></script>
	</body>
</html>
```

### 2.3 CSS Classes and Styling

**Critical CSS Classes for Preservation:**

1. **Theme Classes**:
    - `.dark-mode` - Dark theme state
    - `.light-mode` - Light theme state
    - `.theme-transition` - Theme switching animation

2. **Layout Classes**:
    - `.nav-header` - Navigation bar
    - `.nav-brand` - Brand/title section
    - `.nav-controls` - Control buttons container
    - `.status-banner` - Status display bar
    - `.status-grid` - Status items grid
    - `.control-panel` - Main control panel
    - `.main-content` - Main content area
    - `.kismet-container` - Kismet iframe container
    - `.data-panels` - Side data panels

3. **Interactive Element Classes**:
    - `.minimize-btn` - Minimize button
    - `.theme-toggle` - Theme switcher
    - `.status-btn` - Status refresh button
    - `.control-btn` - Action buttons
    - `.control-btn.primary` - Primary action styling
    - `.control-btn.danger` - Danger action styling
    - `.control-btn.warning` - Warning action styling
    - `.control-btn.secondary` - Secondary action styling

4. **Component Classes**:
    - `.status-item` - Individual status display
    - `.status-label` - Status label text
    - `.status-value` - Status value text
    - `.status-indicator` - Visual status indicator (LED-style)
    - `.control-group` - Control button grouping
    - `.data-panel` - Collapsible data panel
    - `.panel-header` - Panel title bar
    - `.panel-content` - Panel body content
    - `.panel-toggle` - Panel collapse button

5. **Kismet Integration Classes**:
    - `.kismet-iframe` - Kismet iframe styling
    - `.iframe-header` - Iframe title bar
    - `.fullscreen-btn` - Fullscreen toggle button

6. **State Classes**:
    - `.hidden` - Hidden element state
    - `.minimized` - Minimized state
    - `.expanded` - Expanded state
    - `.loading` - Loading state
    - `.error` - Error state
    - `.success` - Success state

### 2.4 Critical IDs for JavaScript Integration

**Essential Element IDs:**

**Navigation & Control:**

- `#minimize-btn` - Main minimize button
- `#theme-toggle` - Theme switcher
- `#status-refresh` - Status refresh button

**Status Display:**

- `#status-banner` - Status bar container
- `#kismet-status` - Kismet service status
- `#gps-status` - GPS service status
- `#network-count` - Network count display
- `#device-count` - Device count display
- `#kismet-indicator` - Kismet status LED
- `#gps-indicator` - GPS status LED

**Control Panel:**

- `#control-panel` - Main control panel
- `#start-kismet` - Start Kismet button
- `#stop-kismet` - Stop Kismet button
- `#restart-kismet` - Restart Kismet button
- `#export-wigle` - Export WigleCSV button
- `#export-pcap` - Export PCAP button
- `#interface-select` - Network interface selector
- `#set-monitor` - Set monitor mode button

**Main Content:**

- `#main-content` - Main content container
- `#kismet-container` - Kismet iframe container
- `#kismet-iframe` - Kismet iframe element
- `#fullscreen-kismet` - Fullscreen button

**Data Panels:**

- `#networks-panel` - Networks data panel
- `#devices-panel` - Devices data panel
- `#log-panel` - System log panel
- `#networks-list` - Networks list container
- `#devices-list` - Devices list container
- `#system-log` - System log container

**Map Integration:**

- `#map-container` - Map container
- `#toggle-map` - Map toggle button
- `#leaflet-map` - Leaflet map container
- `#cesium-container` - Cesium 3D map container

### 2.5 Data Attributes and Custom Properties

**Required Data Attributes:**

- `data-status` - Service status states ("running", "stopped", "error")
- `data-theme` - Theme state ("dark", "light")
- `data-minimized` - Minimization state ("true", "false")
- `data-panel-id` - Panel identification for toggle functionality
- `data-network-id` - Network identification for real-time updates
- `data-device-id` - Device identification for real-time updates

### 2.6 Event Handlers and Interactions

**JavaScript Event Bindings:**

1. **WebSocket Events**:
    - Real-time status updates
    - Network discovery notifications
    - Device activity monitoring
    - System log streaming

2. **DOM Events**:
    - Theme toggle functionality
    - Panel minimize/expand
    - Kismet service control
    - Interface mode switching
    - Data export triggers

3. **API Endpoints**:
    - `/api/status` - System status
    - `/api/kismet/start` - Start Kismet service
    - `/api/kismet/stop` - Stop Kismet service
    - `/api/kismet/restart` - Restart Kismet service
    - `/api/export/wigle` - Export WigleCSV data
    - `/api/export/pcap` - Export PCAP data
    - `/api/interface/monitor` - Set monitor mode

### 2.7 External Dependencies

**CDN Dependencies:**

- Leaflet 1.9.4: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- Leaflet CSS: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- Cesium 1.95: `https://cesium.com/downloads/cesiumjs/releases/1.95/Build/Cesium/Cesium.js`
- Cesium CSS: `https://cesium.com/downloads/cesiumjs/releases/1.95/Build/Cesium/Widgets/widgets.css`

## 3. Form Structure Documentation

### 3.1 HackRF Spectrum Analyzer Forms

**Profile Selection Form:**

```html
<div class="scan-profiles">
	<button class="profile-btn" data-profile="vhf">VHF Amateur (144-148 MHz)</button>
	<button class="profile-btn" data-profile="uhf">UHF Amateur (420-450 MHz)</button>
	<button class="profile-btn" data-profile="ism">ISM Band (2.4 GHz)</button>
</div>
```

**No traditional forms** - Uses button-based interactions and API calls.

### 3.2 Kismet Operations Center Forms

**Interface Selection Form:**

```html
<div class="control-group">
	<h3>Interface Control</h3>
	<select id="interface-select" class="interface-select">
		<option value="wlan2">wlan2 (Monitor)</option>
		<option value="wlan1">wlan1 (Managed)</option>
	</select>
	<button id="set-monitor" class="control-btn">📡 Set Monitor Mode</button>
</div>
```

**Export Configuration Forms** (dynamically generated):

- WigleCSV export options
- PCAP export filters
- Time range selectors

## 4. Interactive Element Identification

### 4.1 HackRF Interactive Elements

**Primary Interactions:**

1. **Profile Selection Buttons** - Frequency band selection
2. **Scan Control Button** - Start/stop signal scanning
3. **Status Refresh Button** - Manual status update
4. **Real-time Chart** - Plotly.js spectrum visualization
5. **Signal List Items** - Clickable signal details

**State Changes:**

- Profile button activation (`.active` class)
- Scan button disable during operation
- Mode indicator color changes (real vs demo)
- Loading state displays

### 4.2 Kismet Interactive Elements

**Primary Interactions:**

1. **Service Control Buttons** - Start/stop/restart Kismet
2. **Theme Toggle** - Light/dark mode switching
3. **Minimize Controls** - Panel collapse/expand
4. **Interface Selector** - Network interface switching
5. **Export Buttons** - Data export triggers
6. **Panel Toggles** - Data panel collapse/expand
7. **Kismet Iframe** - Embedded Kismet interface
8. **Map Toggle** - Show/hide mapping interface

**State Changes:**

- Theme class switching (`dark-mode`/`light-mode`)
- Panel minimization states
- Status indicator updates (LED-style indicators)
- Service status display changes
- Real-time counter updates

## 5. SvelteKit Component Structure Planning

### 5.1 HackRF Spectrum Analyzer Components

**Recommended Component Breakdown:**

1. **SpectrumAnalyzer.svelte** - Main container component
2. **StatusPanel.svelte** - System status display
3. **ProfileSelector.svelte** - Frequency profile selection
4. **SpectrumChart.svelte** - Plotly.js chart wrapper
5. **SignalsList.svelte** - Detected signals display
6. **SystemLog.svelte** - Log output component

**Stores Required:**

- `spectrumStore.js` - FFT data and real-time updates
- `statusStore.js` - System status and configuration
- `signalsStore.js` - Detected signals data

### 5.2 Kismet Operations Center Components

**Recommended Component Breakdown:**

1. **KismetOperations.svelte** - Main container component
2. **NavigationHeader.svelte** - Top navigation with controls
3. **StatusBanner.svelte** - Service status display
4. **ControlPanel.svelte** - Service control buttons
5. **KismetIframe.svelte** - Kismet interface embed
6. **DataPanels.svelte** - Real-time data display panels
7. **NetworksList.svelte** - Live networks component
8. **DevicesList.svelte** - Active devices component
9. **SystemLog.svelte** - System log display
10. **MapIntegration.svelte** - Leaflet/Cesium maps
11. **ThemeToggle.svelte** - Theme switching component

**Stores Required:**

- `kismetStore.js` - Kismet service status and data
- `networkStore.js` - Real-time network data
- `deviceStore.js` - Real-time device data
- `themeStore.js` - Theme state management
- `systemStore.js` - System status and logs

## 6. CSS Class Preservation Requirements

### 6.1 Critical CSS Classes to Preserve

**Layout and Structure:**

- All container classes (`.header`, `.status-panel`, `.controls`, etc.)
- Grid and flexbox layout classes
- Panel and section organizational classes

**Interactive States:**

- `.active`, `.disabled`, `.loading`, `.error`, `.success`
- Theme-related classes (`.dark-mode`, `.light-mode`)
- Minimization states (`.minimized`, `.expanded`, `.hidden`)

**Visual Indicators:**

- Status indicator classes (`.status-indicator`, `.real-data-mode`, `.demo-mode`)
- Button styling classes (`.control-btn`, `.profile-btn`, etc.)
- Panel styling classes (`.data-panel`, `.control-panel`)

### 6.2 CSS Custom Properties to Maintain

**Theme Colors:**

- Primary colors for dark/light themes
- Status indicator colors (green, red, yellow)
- Interactive element hover states

**Layout Dimensions:**

- Panel heights and widths
- Chart container dimensions
- Iframe sizing constraints

## 7. Data Attribute Preservation

### 7.1 Functional Data Attributes

**HackRF Application:**

- `data-profile` - Critical for profile selection functionality
- `data-signal-id` - For signal tracking and updates

**Kismet Application:**

- `data-status` - Service status tracking
- `data-theme` - Theme state management
- `data-minimized` - Panel state tracking
- `data-panel-id` - Panel identification
- `data-network-id` - Network tracking
- `data-device-id` - Device tracking

## 8. Event Handler Mapping

### 8.1 HackRF Event Handlers

**Socket.IO Events:**

```javascript
socket.on('connect', handleConnection);
socket.on('fft_data', updateSpectrumPlot);
socket.on('status', updateSystemStatus);
```

**DOM Events:**

```javascript
// Profile selection
document.querySelectorAll('.profile-btn').forEach((btn) => {
	btn.addEventListener('click', selectProfile);
});

// Control actions
document.getElementById('scan-btn').addEventListener('click', startScan);
document.getElementById('refresh-status').addEventListener('click', refreshStatus);
```

### 8.2 Kismet Event Handlers

**WebSocket Events:**

```javascript
ws.onmessage = handleRealtimeData;
ws.onopen = handleConnectionOpen;
ws.onclose = handleConnectionClose;
```

**DOM Events:**

```javascript
// Service controls
document.getElementById('start-kismet').addEventListener('click', startKismet);
document.getElementById('stop-kismet').addEventListener('click', stopKismet);
document.getElementById('restart-kismet').addEventListener('click', restartKismet);

// UI controls
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('minimize-btn').addEventListener('click', toggleMinimize);

// Panel controls
document.querySelectorAll('.panel-toggle').forEach((btn) => {
	btn.addEventListener('click', togglePanel);
});
```

## 9. Migration Considerations

### 9.1 Critical Preservation Elements

1. **Exact CSS class structure** - Maintain all existing classes for visual consistency
2. **ID preservation** - Keep all element IDs for JavaScript functionality
3. **Data attribute structure** - Preserve all functional data attributes
4. **Event handler mapping** - Ensure all interactions work identically
5. **External dependency integration** - Maintain CDN dependencies and initialization
6. **Real-time data flow** - Preserve WebSocket and Socket.IO functionality
7. **iframe integration** - Maintain Kismet iframe embedding with proper sandbox attributes

### 9.2 SvelteKit-Specific Adaptations

1. **Component props** - Convert data attributes to component props where appropriate
2. **Store integration** - Migrate global state to Svelte stores
3. **Reactive updates** - Convert manual DOM updates to reactive Svelte patterns
4. **Event handling** - Convert vanilla JavaScript events to Svelte event handlers
5. **CSS scoping** - Ensure proper CSS scoping while maintaining global styles where needed

## 10. Validation Checklist

### 10.1 Visual Validation

- [ ] All CSS classes preserved and functional
- [ ] Theme switching works identically
- [ ] Panel minimization/expansion preserved
- [ ] Status indicators display correctly
- [ ] Real-time updates maintain visual feedback

### 10.2 Functional Validation

- [ ] All button interactions work identically
- [ ] WebSocket/Socket.IO connections function
- [ ] API endpoints respond correctly
- [ ] Form submissions and data handling preserved
- [ ] iframe integration maintains functionality
- [ ] Map integration (Leaflet/Cesium) works correctly

### 10.3 Performance Validation

- [ ] Real-time data updates perform at same speed
- [ ] Chart rendering (Plotly.js) maintains performance
- [ ] Theme switching is smooth and responsive
- [ ] Panel operations are smooth and responsive

---

**Document Status**: ✅ Complete  
**Phase**: 1.2 HTML Structure Mapping  
**Next Phase**: 1.3 API Integration Analysis  
**Agent Deployment**: 10 parallel agents utilized for comprehensive mapping
