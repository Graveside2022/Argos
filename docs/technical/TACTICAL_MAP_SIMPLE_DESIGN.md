# Simplified Tactical Map Design

## Core Use Case Flow

1. **Operator searches for specific frequency** (e.g., 433.92 MHz)
2. **Map shows signal strength in the area** with color-coded markers
3. **Real-time updates from HackRF** via WebSocket
4. **Simple, clear visualization** with minimal UI clutter
5. **Minimal controls** - just frequency search and basic filters

## Ideal Simple Implementation

### 1. Data Flow Architecture

```
HackRF Sweep → WebSocket → Signal Processor → Map Store → Leaflet Map
     ↓              ↓             ↓                ↓            ↓
  Frequency      Real-time    Filter by      Geographic    Visual
   Sweeps        Updates      Frequency      Positioning   Display
```

### 2. Core Components

#### A. Frequency Search Bar (Top of Map)

```svelte
<!-- Simple search with dropdown suggestions -->
<div class="frequency-search">
	<input
		type="text"
		placeholder="Search frequency (e.g., 433.92 MHz)"
		bind:value={searchFrequency}
		on:input={handleFrequencySearch}
	/>

	<!-- Dropdown with common frequencies -->
	<div class="freq-suggestions">
		<button>433.92 MHz (ISM)</button>
		<button>915 MHz (ISM)</button>
		<button>2.4 GHz (WiFi)</button>
		<button>5.8 GHz (WiFi)</button>
	</div>
</div>
```

#### B. Signal Strength Visualization

```typescript
// Simple color gradient based on signal strength
function getSignalColor(power: number): string {
	if (power >= -40) return '#FF0000'; // Very Strong - Red
	if (power >= -50) return '#FF4500'; // Strong - Orange Red
	if (power >= -60) return '#FFA500'; // Good - Orange
	if (power >= -70) return '#FFFF00'; // Medium - Yellow
	if (power >= -80) return '#90EE90'; // Fair - Light Green
	if (power >= -90) return '#0000FF'; // Weak - Blue
	return '#4B0082'; // Very Weak - Indigo
}
```

#### C. Map Markers

```typescript
interface SignalMarker {
	id: string;
	frequency: number; // MHz
	power: number; // dBm
	lat: number; // From GPS or triangulation
	lon: number;
	timestamp: number;
	// Simplified - no complex metadata
}
```

### 3. Minimal UI Layout

```
┌─────────────────────────────────────────┐
│  [🔍 Search: 433.92 MHz]  [Clear]       │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              MAP VIEW                   │
│         (Leaflet/MapBox)                │
│                                         │
│     🔴 Strong Signal (-45 dBm)          │
│     🟡 Medium Signal (-70 dBm)          │
│     🔵 Weak Signal (-85 dBm)            │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ Status: Connected | Signals: 12         │
└─────────────────────────────────────────┘
```

### 4. Real-time WebSocket Integration

```typescript
// Simple WebSocket handler
ws.on('hackrf:sweep', (data) => {
	// Filter for searched frequency (±1 MHz tolerance)
	const targetFreq = parseFloat(searchFrequency);
	const tolerance = 1.0; // MHz

	const matchingSignals = data.signals.filter(
		(signal) => Math.abs(signal.frequency - targetFreq) <= tolerance
	);

	// Update map markers
	matchingSignals.forEach((signal) => {
		addOrUpdateMarker({
			id: `${signal.frequency}-${Date.now()}`,
			frequency: signal.frequency,
			power: signal.power,
			lat: userPosition.lat + (Math.random() - 0.5) * 0.001, // Temporary
			lon: userPosition.lon + (Math.random() - 0.5) * 0.001,
			timestamp: Date.now()
		});
	});
});
```

### 5. Simplified Store Structure

```typescript
// stores/tacticalMap.ts
export const searchFrequency = writable<string>('');
export const signals = writable<Map<string, SignalMarker>>(new Map());
export const mapCenter = writable<[number, number]>([0, 0]);
export const signalAge = writable<number>(60); // Show signals from last 60 seconds

// Derived store for filtered signals
export const visibleSignals = derived(
	[signals, searchFrequency, signalAge],
	([$signals, $search, $age]) => {
		const now = Date.now();
		const targetFreq = parseFloat($search);

		return Array.from($signals.values()).filter((signal) => {
			// Age filter
			if (now - signal.timestamp > $age * 1000) return false;

			// Frequency filter (if search is active)
			if ($search && !isNaN(targetFreq)) {
				if (Math.abs(signal.frequency - targetFreq) > 1.0) return false;
			}

			return true;
		});
	}
);
```

### 6. Key Simplifications

#### What We Keep:

- **Frequency search** - Core feature
- **Signal strength visualization** - Color-coded markers
- **Real-time updates** - WebSocket integration
- **Basic age filtering** - Show recent signals only
- **GPS positioning** - User location centering

#### What We Remove:

- Complex filtering UI (multiple checkboxes/sliders)
- Heatmap generation (computationally expensive)
- Signal clustering (adds complexity)
- Historical playback
- Multiple data sources toggle
- Advanced statistics panels
- Complex tooltips/popups

### 7. Implementation Priority

1. **Phase 1: Core Search & Display**
    - Frequency search input
    - Basic map with markers
    - Color-coded signal strength
    - Connect to existing WebSocket

2. **Phase 2: Positioning**
    - GPS integration for user position
    - Basic triangulation for signal sources
    - Auto-center on user location

3. **Phase 3: Polish**
    - Smooth marker updates
    - Signal fade-out animation
    - Connection status indicator
    - Mobile responsive design

### 8. Performance Optimizations

```typescript
// Limit visible signals
const MAX_VISIBLE_SIGNALS = 50;

// Throttle updates
const updateThrottle = throttle((newSignals) => {
	signals.update((s) => {
		// Keep only strongest signals if over limit
		if (s.size > MAX_VISIBLE_SIGNALS) {
			const sorted = Array.from(s.values())
				.sort((a, b) => b.power - a.power)
				.slice(0, MAX_VISIBLE_SIGNALS);

			return new Map(sorted.map((sig) => [sig.id, sig]));
		}
		return s;
	});
}, 100); // Update max 10 times per second
```

### 9. Mobile-First Design

```css
/* Responsive controls */
.frequency-search {
	position: fixed;
	top: 10px;
	left: 10px;
	right: 10px;
	z-index: 1000;
}

.frequency-search input {
	width: 100%;
	padding: 12px;
	font-size: 16px; /* Prevent zoom on mobile */
	border-radius: 8px;
	border: 2px solid #333;
}

/* Fullscreen map */
.tactical-map {
	position: fixed;
	top: 60px; /* Below search */
	left: 0;
	right: 0;
	bottom: 30px; /* Above status */
	z-index: 1;
}

/* Minimal status bar */
.status-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	height: 30px;
	background: rgba(0, 0, 0, 0.8);
	color: white;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 10px;
	font-size: 12px;
}
```

### 10. Example Usage Flow

1. **Operator opens tactical map**
    - Map centers on their GPS location
    - All recent signals shown as faded markers

2. **Operator searches "433.92"**
    - Map filters to only show 432.92-434.92 MHz signals
    - Markers update color based on signal strength
    - Stronger signals appear larger

3. **Real-time updates arrive**
    - New signals fade in
    - Old signals fade out after 60 seconds
    - Map smoothly updates without flicker

4. **Operator moves**
    - Map follows their position
    - Signal positions update relative to movement
    - Historical trail shows signal path

This design focuses on the essential features while maintaining clarity and performance. The implementation can be completed in phases, with each phase providing immediate value to the operator.
