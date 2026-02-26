# Data Model: Line-of-Sight RF Range Overlay

**Feature**: 020-los-rf-range | **Date**: 2026-02-26

---

## Entities

### RFRangeProfile

The core configuration entity — a set of parameters that define an RF range calculation.

```typescript
/** Propagation model type */
type PropagationModel = 'free-space' | 'terrain-aware';

/** A named preset or custom RF range configuration */
interface RFRangeProfile {
	/** Unique preset identifier, or 'custom' for user-defined */
	id: string;
	/** Human-readable label (e.g., "HackRF Bare") */
	label: string;
	/** Transmit power in dBm (range: -30 to 47) */
	txPowerDbm: number;
	/** Transmit antenna gain in dBi (range: -5 to 30) */
	antennaGainDbi: number;
	/** Receive antenna gain in dBi (assumed for target receiver) */
	rxAntennaGainDbi: number;
	/** Receiver sensitivity threshold in dBm (range: -120 to -20) */
	sensitivityDbm: number;
	/** Antenna height above ground level in meters (range: 0.5 to 100) */
	heightAglMeters: number;
	/** Active propagation model */
	propagationModel: PropagationModel;
}
```

**Validation rules**:

- `txPowerDbm`: min -30, max 47 (50W is regulatory max for most bands)
- `antennaGainDbi`: min -5 (lossy dummy load), max 30 (high-gain dish)
- `rxAntennaGainDbi`: min -5, max 30 (defaults to 0)
- `sensitivityDbm`: min -120 (very sensitive SDR), max -20 (very noisy)
- `heightAglMeters`: min 0.5, max 100
- `propagationModel`: must be `'free-space'` for P1/P2, `'terrain-aware'` reserved for P3

**State transitions**: None — this is a configuration entity, not a stateful process.

---

### RFRangeState

Client-side reactive state that drives the overlay rendering.

```typescript
/** Computed RF range state derived from profile + active frequency + GPS */
interface RFRangeState {
	/** Whether the RF range overlay is enabled by the user */
	isEnabled: boolean;
	/** The active profile (preset or custom) */
	activeProfile: RFRangeProfile;
	/** Active frequency in Hz (from HackRF SSE stream or manual entry) */
	frequencyHz: number;
	/** Frequency source: 'auto' (from SDR) or 'manual' (user-entered) */
	frequencySource: 'auto' | 'manual';
	/** Computed maximum range in meters (Friis result, before capping) */
	computedMaxRangeMeters: number;
	/** Display range in meters (after min/max capping) */
	displayRangeMeters: number;
	/** Whether the display range is capped */
	isCapped: boolean;
	/** Computed range bands for rendering */
	rangeBands: RFRangeBand[];
	/** Whether all prerequisites are met (SDR connected + GPS fix) */
	isActive: boolean;
	/** Reason the overlay is inactive, if applicable */
	inactiveReason: string | null;
}
```

---

### RFRangeBand

Extends the existing `RangeBand` interface pattern for RF-specific bands.

```typescript
/** A concentric signal quality zone within the RF range overlay */
interface RFRangeBand {
	/** Outer radius in meters */
	outerR: number;
	/** Inner radius in meters (0 for innermost band) */
	innerR: number;
	/** Band quality key */
	band: 'strong' | 'usable' | 'marginal' | 'maximum';
	/** Resolved hex color for MapLibre rendering */
	color: string;
	/** Signal margin label (e.g., "> 12 dB margin") */
	marginLabel: string;
	/** Distance label (e.g., "2.4 km") */
	distanceLabel: string;
}
```

**Relationship to existing `RangeBand`**: Same shape, compatible with `buildDetectionRangeGeoJSON()`. The `band` key values differ (WiFi uses `vstrong/strong/good/fair/weak`; RF uses `strong/usable/marginal/maximum`) but the GeoJSON builder only reads `outerR`, `innerR`, `band`, and `color`.

---

### Hardware Presets (Constants)

```typescript
/** Built-in hardware presets — not stored in DB, defined as constants */
const RF_RANGE_PRESETS: readonly RFRangeProfile[] = [
	{
		id: 'hackrf-bare',
		label: 'HackRF Bare',
		txPowerDbm: 10,
		antennaGainDbi: 0,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	},
	{
		id: 'hackrf-amplifier',
		label: 'HackRF + Amplifier',
		txPowerDbm: 20,
		antennaGainDbi: 0,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	},
	{
		id: 'hackrf-directional',
		label: 'HackRF + Directional',
		txPowerDbm: 10,
		antennaGainDbi: 12,
		rxAntennaGainDbi: 0,
		sensitivityDbm: -90,
		heightAglMeters: 1.5,
		propagationModel: 'free-space'
	}
] as const;
```

---

## Relationships

```
RFRangeProfile ──1:1──> RFRangeState.activeProfile
RFRangeState   ──1:N──> RFRangeBand[]  (always 4 bands)
RFRangeState   ──reads──> hackrfStore.targetFrequency (auto mode)
RFRangeState   ──reads──> gpsStore.position.{lat, lon}
RFRangeState   ──reads──> gpsStore.status.hasGPSFix
RFRangeState   ──reads──> hardwareStatus.sdrState
RFRangeBand[]  ──feeds──> buildDetectionRangeGeoJSON() → GeoJSON FeatureCollection
```

---

## Storage

**No database storage required for P1/P2.** All state is client-side reactive stores.

- Presets are TypeScript constants (compile-time)
- Active profile selection persisted via `persistedWritable` (localStorage) — same pattern as `map-settings-store.ts`
- Custom parameter values persisted via the same `persistedWritable`
- No server-side state needed — the propagation math runs entirely on the client

**Future (P3)**: Terrain elevation tile cache may require disk storage (`~/.argos/terrain-cache/`), but that is out of scope for this plan.
