# Data Model: GSM Evil Component Interfaces

**Date**: 2026-02-16 | **Status**: Complete

## Component Props Interfaces

### GsmHeader

```typescript
interface GsmHeaderProps {
	/** Whether scan or IMSI capture is active (controls button variant) */
	isActive: boolean;
	/** Text to display on the Start/Stop button */
	buttonText: string;
	/** Whether IMSI capture is specifically active (controls status badge visibility) */
	imsiCaptureActive: boolean;
	/** Callback when Start/Stop button is clicked */
	onscanbutton: () => void;
}
```

### TowerTable

```typescript
import type { TowerGroup } from '$lib/utils/gsm-tower-utils';
import type { TowerLocation } from '$lib/stores/gsm-evil-store';

interface TowerTableProps {
	/** Grouped and sorted tower data with device lists */
	groupedTowers: TowerGroup[];
	/** Map of towerId → location data */
	towerLocations: Record<string, TowerLocation>;
	/** Map of towerId → whether lookup was attempted */
	towerLookupAttempted: Record<string, boolean>;
	/** Currently selected frequency */
	selectedFrequency: string;
}

// Internal state (NOT props — managed by TowerTable itself):
// - sortColumn: SortColumn ('carrier' | 'country' | 'location' | 'lac' | 'mccMnc' | 'devices' | 'lastSeen')
// - sortDirection: 'asc' | 'desc'
// - expandedTowers: Set<string>
```

### ScanResultsTable

```typescript
import type { ScanResult } from '$lib/stores/gsm-evil-store';

interface ScanResultsTableProps {
	/** Array of frequency scan results */
	scanResults: ScanResult[];
	/** Currently selected frequency */
	selectedFrequency: string;
	/** Callback when a frequency is selected */
	onselect: (frequency: string) => void;
}
```

### ScanConsole

```typescript
interface ScanConsoleProps {
	/** Array of scan progress log lines */
	scanProgress: string[];
	/** Whether a scan is currently in progress */
	isScanning: boolean;
}
```

### LiveFramesConsole

```typescript
import type { IMSICapture } from '$lib/stores/gsm-evil-store';

interface ActivityStatus {
	hasActivity: boolean;
	packetCount: number;
	recentIMSI: boolean;
	currentFrequency: string;
	message: string;
}

interface LiveFramesConsoleProps {
	/** Array of decoded GSM frame strings */
	gsmFrames: string[];
	/** Current activity status from the API */
	activityStatus: ActivityStatus;
	/** Captured IMSIs (used for display count) */
	capturedIMSIs: IMSICapture[];
	/** Currently selected frequency */
	selectedFrequency: string;
}
```

### ErrorDialog

```typescript
interface ErrorDialogProps {
	/** Whether the dialog is open (two-way bindable) */
	open: boolean; // $bindable()
	/** Error message to display */
	message: string;
}
```

## Existing Types (Unchanged)

### From `src/lib/stores/gsm-evil-store.ts`

```typescript
interface IMSICapture {
	imsi: string;
	tmsi?: string;
	mcc: string | number;
	mnc: string | number;
	lac: number;
	ci: number;
	lat?: number;
	lon?: number;
	timestamp: string;
	frequency?: string;
}

interface TowerLocation {
	lat: number;
	lon: number;
	range?: number;
	samples?: number;
	city?: string;
	source?: string;
	lastUpdated?: string;
}

interface ScanResult {
	frequency: string;
	power: number;
	strength: string;
	frameCount?: number;
	hasGsmActivity?: boolean;
	channelType?: string;
	controlChannel?: boolean;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

interface GSMEvilState {
	scanResults: ScanResult[];
	scanProgress: string[];
	scanStatus: string;
	selectedFrequency: string;
	isScanning: boolean;
	showScanProgress: boolean;
	scanAbortController: AbortController | null;
	canStopScan: boolean;
	scanButtonText: string;
	capturedIMSIs: IMSICapture[];
	totalIMSIs: number;
	towerLocations: Record<string, TowerLocation>;
	towerLookupAttempted: Record<string, boolean>;
	lastScanTime: string | null;
	storageVersion: string;
}
```

### From `src/lib/types/gsm.ts`

```typescript
interface FrequencyTestResult {
	frequency: string;
	power: number;
	frameCount: number;
	hasGsmActivity: boolean;
	strength: string;
	channelType: string;
	controlChannel: boolean;
}
```

### From `src/lib/utils/gsm-tower-utils.ts`

```typescript
interface TowerGroup {
	mcc: string;
	mnc: string;
	mccMnc: string;
	lac: string;
	ci: string;
	carrier: string;
	country: { name: string; flag: string; code: string };
	location: TowerLocation | null;
	count: number;
	devices: IMSICapture[];
	lastSeen: Date;
}
```

## Data Flow Diagram

```
gsmEvilStore (localStorage persistence)
    │
    ├── $gsmEvilStore.scanResults ──────────→ ScanResultsTable.scanResults
    ├── $gsmEvilStore.selectedFrequency ───→ ScanResultsTable.selectedFrequency
    │                                        TowerTable.selectedFrequency
    │                                        LiveFramesConsole.selectedFrequency
    ├── $gsmEvilStore.isScanning ──────────→ ScanConsole.isScanning
    │                                        GsmHeader (via isActive derivation)
    ├── $gsmEvilStore.scanProgress ────────→ ScanConsole.scanProgress
    ├── $gsmEvilStore.capturedIMSIs ───────→ (grouped in parent) → TowerTable.groupedTowers
    │                                        LiveFramesConsole.capturedIMSIs
    ├── $gsmEvilStore.towerLocations ──────→ TowerTable.towerLocations
    ├── $gsmEvilStore.towerLookupAttempted → TowerTable.towerLookupAttempted
    └── $gsmEvilStore.scanButtonText ──────→ GsmHeader.buttonText (via derivation)

Page-local state:
    ├── imsiCaptureActive ─────────────────→ GsmHeader.imsiCaptureActive
    │                                        (controls which panels are visible)
    ├── gsmFrames[] ───────────────────────→ LiveFramesConsole.gsmFrames
    ├── activityStatus ────────────────────→ LiveFramesConsole.activityStatus
    ├── errorDialogOpen ───────────────────→ ErrorDialog.open
    └── errorDialogMessage ────────────────→ ErrorDialog.message

Event callbacks (child → parent):
    ├── GsmHeader.onscanbutton() ──────────→ handleScanButton()
    ├── ScanResultsTable.onselect(freq) ──→ gsmEvilStore.setSelectedFrequency(freq)
    └── ErrorDialog.open (bindable) ───────→ errorDialogOpen
```
