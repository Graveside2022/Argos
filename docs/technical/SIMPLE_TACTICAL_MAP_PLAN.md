# Simple Tactical Map - Implementation Plan

## Overview

Create a clean, effective tactical map that shows RF signals detected by HackRF in real-time. Focus on operator needs: search for a frequency, see signal strength in the area.

## Core Requirements

1. Operator enters target frequency (e.g., 2400 MHz)
2. Map shows signals near that frequency with strength indicators
3. Real-time updates from HackRF
4. Minimal UI, maximum clarity

## Technical Approach

### Phase 1: Create New Simple Map Page (1-2 hours)

#### Task 1.1: Create new route

- [ ] Create `/src/routes/tactical-map-simple/+page.svelte`
- [ ] Basic HTML structure with map container
- [ ] Import Leaflet for map display
- [ ] Set up basic map centered on default location

#### Task 1.2: Add frequency search UI

- [ ] Create search input at top of page
- [ ] Add search button
- [ ] Style with simple, clean CSS
- [ ] Add frequency validation (positive numbers only)

#### Task 1.3: Set up map basics

- [ ] Initialize Leaflet map
- [ ] Add OpenStreetMap tiles
- [ ] Set default zoom level (city-wide view)
- [ ] Add GPS position marker if available

### Phase 2: HackRF Integration (2-3 hours)

#### Task 2.1: Connect to HackRF data stream

- [ ] Import HackRF API and stores
- [ ] Subscribe to spectrum data on component mount
- [ ] Unsubscribe on component destroy
- [ ] Add connection status indicator

#### Task 2.2: Create signal aggregation logic

- [ ] Buffer incoming spectrum data
- [ ] Aggregate by 1-second windows
- [ ] Group signals by frequency (±1 MHz)
- [ ] Calculate average power per frequency
- [ ] Filter out weak signals (<-80 dBm)

#### Task 2.3: Implement frequency matching

- [ ] Compare detected frequencies to search frequency
- [ ] Allow ±1 MHz tolerance for matches
- [ ] Store matched signals in a Map
- [ ] Limit to most recent 50 signals

### Phase 3: Signal Visualization (2-3 hours)

#### Task 3.1: Create signal marker system

- [ ] Design simple circle markers
- [ ] Color based on signal strength:
    - Red: -40 to -60 dBm (strong)
    - Orange: -60 to -70 dBm (good)
    - Yellow: -70 to -80 dBm (fair)
    - Blue: -80 to -90 dBm (weak)
- [ ] Size based on signal persistence (how long detected)

#### Task 3.2: Position signals on map

- [ ] Use GPS position as center
- [ ] Create logical signal placement:
    - Stronger signals closer to center
    - Distribute in circle pattern
    - Avoid overlapping markers
- [ ] Update positions as new data arrives

#### Task 3.3: Add signal info display

- [ ] Show current signal details at bottom
- [ ] Display: frequency, power, last updated
- [ ] Update in real-time
- [ ] Keep it minimal - no popups

### Phase 4: Performance & Polish (1-2 hours)

#### Task 4.1: Optimize performance

- [ ] Throttle updates to max 2Hz
- [ ] Remove old signals (>30 seconds)
- [ ] Use requestAnimationFrame for smooth updates
- [ ] Limit map markers to 50 maximum

#### Task 4.2: Add quality of life features

- [ ] Loading state while connecting
- [ ] Error handling for no HackRF connection
- [ ] Clear all signals button
- [ ] Signal count indicator

#### Task 4.3: Mobile optimization

- [ ] Responsive design for phones
- [ ] Touch-friendly controls
- [ ] Proper viewport settings
- [ ] Test on mobile devices

## Implementation Details

### Data Structure

```typescript
interface SimplifiedSignal {
	id: string;
	frequency: number; // MHz
	power: number; // dBm
	timestamp: number;
	persistence: number; // seconds detected
	position: {
		lat: number;
		lon: number;
	};
}
```

### Signal Aggregation Algorithm

```typescript
// 1. Buffer spectrum data for 1 second
// 2. Group by frequency (±1 MHz bins)
// 3. Calculate average power per bin
// 4. Keep only bins > -80 dBm
// 5. Update or create signal markers
```

### Color Mapping

```typescript
function getSignalColor(power: number): string {
	if (power > -60) return '#ff0000'; // Red (strong)
	if (power > -70) return '#ff8800'; // Orange (good)
	if (power > -80) return '#ffff00'; // Yellow (fair)
	return '#0088ff'; // Blue (weak)
}
```

### Position Algorithm

```typescript
function calculateSignalPosition(
	centerLat: number,
	centerLon: number,
	signalStrength: number,
	index: number
): { lat: number; lon: number } {
	// Position based on signal strength
	// Stronger = closer to center
	// Distribute in spiral pattern
	const distance = (100 + signalStrength) * 0.00001;
	const angle = index * 137.5 * (Math.PI / 180); // Golden angle

	return {
		lat: centerLat + distance * Math.cos(angle),
		lon: centerLon + distance * Math.sin(angle)
	};
}
```

## Success Criteria

1. Page loads in <1 second
2. Frequency search works instantly
3. Signals appear within 2 seconds of detection
4. No more than 50 signals on map at once
5. Clear visual hierarchy (strong signals obvious)
6. Works on mobile devices
7. No lag or stuttering with updates

## What We're NOT Building

- Multiple visualization modes
- Complex filtering options
- Historical data playback
- Signal clustering
- Heatmaps
- Grid overlays
- Altitude/3D features
- AI detection
- Network analysis
- Detailed popups
- Statistics panels
- Time controls

## Folder Structure

```
/src/routes/tactical-map-simple/
  +page.svelte         # Main component
  SignalAggregator.ts  # Signal processing logic
  signalStore.ts       # Simplified store for signals
```

## Testing Plan

1. Test with no HackRF connected (graceful failure)
2. Test with HackRF generating signals
3. Test frequency search with various inputs
4. Test with high signal volume
5. Test on mobile devices
6. Test GPS vs no GPS

## Rollout Strategy

1. Build alongside existing tactical-map
2. Test thoroughly
3. Get user feedback
4. Replace complex map if successful
