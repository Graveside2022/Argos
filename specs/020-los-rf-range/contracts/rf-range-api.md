# API Contracts: RF Range Overlay

**Feature**: 020-los-rf-range | **Date**: 2026-02-26

---

## Overview

The RF range feature is **primarily client-side** — the Friis calculation, band generation, and GeoJSON rendering all happen in the browser. No new REST API endpoints are required for P1/P2. The data inputs come from existing APIs:

- GPS position: existing `/api/gps/position` polling (every 2s)
- HackRF frequency: existing `/api/hackrf/data-stream` SSE stream
- Hardware state: existing `/api/hardware/status` polling (every 5s)

This contract documents the **client-side interfaces** and the **existing API dependencies**.

---

## Client-Side Module Contracts

### 1. RF Propagation Calculator

**Module**: `src/lib/utils/rf-propagation.ts`

```typescript
/**
 * Calculate maximum free-space range using Friis equation.
 * @param frequencyHz - Operating frequency in Hz (1e6 to 6e9)
 * @param txPowerDbm - Transmit power in dBm
 * @param txGainDbi - Transmit antenna gain in dBi
 * @param rxGainDbi - Receive antenna gain in dBi
 * @param sensitivityDbm - Receiver sensitivity threshold in dBm
 * @returns Maximum range in meters (uncapped)
 */
export function calculateFriisRange(
	frequencyHz: number,
	txPowerDbm: number,
	txGainDbi: number,
	rxGainDbi: number,
	sensitivityDbm: number
): number;

/**
 * Build 4 concentric range bands from a maximum range.
 * @param maxRangeMeters - Maximum range in meters (already capped)
 * @returns Array of 4 RangeBand objects (strong → maximum)
 */
export function buildRFRangeBands(maxRangeMeters: number): RFRangeBand[];

/**
 * Clamp a range value to display limits.
 * @returns { displayRange, isCapped }
 */
export function clampDisplayRange(rangeMeters: number): { displayRange: number; isCapped: boolean };

/** Display range limits */
export const RF_RANGE_LIMITS: {
	MIN_DISPLAY_METERS: 50;
	MAX_DISPLAY_METERS: 50_000;
};
```

### 2. RF Range Store

**Module**: `src/lib/stores/dashboard/rf-range-store.ts`

```typescript
import type { Writable } from 'svelte/store';

/** Store shape — persisted to localStorage */
interface RFRangeStoreState {
	isEnabled: boolean;
	activePresetId: string; // 'hackrf-bare' | 'hackrf-amplifier' | 'hackrf-directional' | 'custom'
	customProfile: RFRangeProfile; // user-edited values
	frequencySource: 'auto' | 'manual';
	manualFrequencyMHz: number; // only used when frequencySource === 'manual'
}

export const rfRangeStore: Writable<RFRangeStoreState>;

/** Convenience setters */
export function setRFRangeEnabled(enabled: boolean): void;
export function setActivePreset(presetId: string): void;
export function updateCustomProfile(partial: Partial<RFRangeProfile>): void;
export function setFrequencySource(source: 'auto' | 'manual'): void;
export function setManualFrequency(mhz: number): void;
```

### 3. RF Range GeoJSON Derivation

**Module**: `src/lib/components/dashboard/map/rf-range-derived.svelte.ts`

```typescript
/**
 * Creates reactive RF range GeoJSON state.
 * Inputs: gpsStore, hackrfStore, rfRangeStore
 * Output: GeoJSON FeatureCollection for MapLibre FillLayer
 */
export function createRFRangeDerivedState(deps: {
	gps$: { current: GPSState };
	hackrf$: { current: HackRFState };
	rfRange$: { current: RFRangeStoreState };
}): {
	rfRangeGeoJSON: FeatureCollection;
	rfRangeState: RFRangeState;
};
```

---

## Existing API Dependencies

### GPS Position (consumed, not modified)

```
GET /api/gps/position
Response: { lat: number, lon: number, alt: number, speed: number, track: number, mode: number, ... }
Polling interval: 2s (GPSService)
Used for: centering the RF range overlay
```

### HackRF Data Stream (consumed, not modified)

```
GET /api/hackrf/data-stream
Response: Server-Sent Events stream
Events:
  - "status": { state: string, currentFrequency?: number, sweepProgress?: number }
  - "sweep_data": { center_freq: number, peak_freq: number, frequencies: number[], power: number[] }
  - "connected": {}
  - "heartbeat": {}
Used for: reading active frequency (status.currentFrequency)
```

### Hardware Status (consumed, not modified)

```
GET /api/hardware/status
Response: { sdr: { sdrState: 'active'|'standby'|'offline', hackrf: {...} }, ... }
Polling interval: 5s (TopStatusBar)
Used for: determining if SDR hardware is connected
```

---

## Layer Registration Contract

The RF range overlay integrates with the existing map layer system:

```typescript
// dashboard-store.ts — add to layerVisibility initial state
{
  ...existingLayers,
  rfRange: false  // off by default until user enables + prerequisites met
}

// map-helpers.ts — add to LAYER_MAP
{
  ...existingMappings,
  rfRange: ['rf-range-fill']
}
```

---

## Map Settings Panel Navigation Contract

The "Layers" panel is redesigned into a card-based "Map Settings" hub:

```typescript
// map-settings-store.ts — add subview navigation state
type MapSettingsView = 'hub' | 'provider' | 'layers' | 'line-of-sight';

export const activeMapSettingsView = writable<MapSettingsView>('hub');

export function navigateToMapSettingsView(view: MapSettingsView): void;
export function navigateBackToHub(): void;
```

```typescript
// dashboard-store.ts — rename panel identifier
// Old: activePanel === 'layers'
// New: activePanel === 'map-settings'
```

```typescript
// IconRail.svelte — rename button
// Old: title="Layers", onclick={() => handleClick('layers')}
// New: title="Map Settings", onclick={() => handleClick('map-settings')}
```

---

## No New Server-Side Endpoints

P1/P2 requires **zero new API routes**. All computation is client-side:

- Friis equation: pure math, no external dependencies
- GeoJSON generation: reuses existing `buildDetectionRangeGeoJSON()`
- Profile persistence: localStorage via `persistedWritable`

P3 (terrain-aware) may require a new endpoint (`GET /api/terrain/elevation?lat=X&lon=Y&radius=R`) but that is out of scope for this plan.
