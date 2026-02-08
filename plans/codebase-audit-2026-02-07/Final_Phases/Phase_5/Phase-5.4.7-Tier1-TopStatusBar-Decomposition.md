# Phase 5.4.7 -- Tier 1: TopStatusBar.svelte Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.7-TOP-STATUS-BAR
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.7 -- Decompose TopStatusBar.svelte (1,001 lines)
Risk Level:     LOW-MEDIUM
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 6 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Path            | `src/lib/components/dashboard/TopStatusBar.svelte` |
| Current Lines   | 1,001                                              |
| Tier            | 1 (>1,000 lines, unconditional)                    |
| Execution Order | 7 of 7 (last Tier 1 decomposition)                 |

---

## 2. Content Analysis

Dashboard header bar. Contains:

- System metrics display (CPU, memory, disk usage gauges)
- Connection indicators for each service (Kismet, HackRF, GPS, GSM status dots)
- GPS coordinates display with fix quality indicator
- Real-time clock (UTC and local time, mission elapsed timer)
- Substantial polling logic (periodic fetch of system metrics)
- WebSocket subscription management for real-time service status

**Why It Exceeds Threshold:**
Five distinct indicator clusters plus their polling/subscription logic are all packed into
a single component. Each cluster has its own data source, update frequency, and rendering
template.

---

## 3. Decomposition Strategy

Extract each indicator cluster into a self-contained component. Move polling logic into
a shared status service that all indicator components consume.

**Architecture after decomposition:**

```
TopStatusBar.svelte (bar layout, ~120 lines)
  +-- SystemMetrics.svelte (CPU/memory/disk, ~180 lines)
  +-- ConnectionIndicators.svelte (service dots, ~200 lines)
  +-- GPSStatusBadge.svelte (GPS fix/coords, ~150 lines)
  +-- ClockDisplay.svelte (UTC/local/elapsed, ~80 lines)
  +-- statusBarService.ts (polling orchestration, ~150 lines)
```

---

## 4. New File Manifest

| New File                                                      | Content                                        | Est. Lines |
| ------------------------------------------------------------- | ---------------------------------------------- | ---------- |
| `components/dashboard/status-bar/TopStatusBar.svelte`         | Bar layout, imports indicators                 | ~120       |
| `components/dashboard/status-bar/SystemMetrics.svelte`        | CPU, memory, disk gauges                       | ~180       |
| `components/dashboard/status-bar/ConnectionIndicators.svelte` | Service status dots (Kismet, HackRF, etc.)     | ~200       |
| `components/dashboard/status-bar/GPSStatusBadge.svelte`       | GPS fix quality, lat/lon display               | ~150       |
| `components/dashboard/status-bar/ClockDisplay.svelte`         | UTC/local time, mission elapsed timer          | ~80        |
| `components/dashboard/status-bar/statusBarService.ts`         | Polling orchestration, WebSocket subscriptions | ~150       |

**Total target files:** 6
**Maximum file size:** ~200 lines (ConnectionIndicators.svelte)
**Original file disposition:** Replaced by orchestrator at new subdirectory path

---

## 5. Service Module Interface

### statusBarService.ts

```typescript
export interface SystemMetricsData {
	cpuPercent: number;
	memoryPercent: number;
	diskPercent: number;
	temperature?: number;
}

export interface ServiceStatus {
	kismet: 'connected' | 'disconnected' | 'error';
	hackrf: 'connected' | 'disconnected' | 'error';
	gps: 'connected' | 'disconnected' | 'error';
	gsm: 'connected' | 'disconnected' | 'error';
}

export interface GPSData {
	latitude: number;
	longitude: number;
	fixQuality: 'none' | '2d' | '3d' | 'dgps';
	satellites: number;
}

// Polling orchestration
export function startStatusPolling(intervalMs: number): () => void;
// Returns cleanup function for onDestroy
```

**Design rationale:** The status bar service encapsulates all periodic fetch and WebSocket
subscription logic. Each indicator component subscribes to the relevant Svelte store that
the service populates. This prevents each component from independently creating its own
polling timer.

---

## 6. Migration Steps

1. Create `src/lib/components/dashboard/status-bar/` directory.
2. Extract `statusBarService.ts`:
    - Move all `setInterval`/`setTimeout` polling logic from the original component
    - Move all WebSocket subscription setup for service status updates
    - Export a `startStatusPolling()` function that returns a cleanup callback
    - Export stores or callbacks that child components can subscribe to

3. Extract `SystemMetrics.svelte`:
    - CPU, memory, disk progress bars/gauges
    - Temperature display (RPi thermal zone)
    - Props: `metrics: SystemMetricsData`

4. Extract `ConnectionIndicators.svelte`:
    - Service status indicator dots (green/yellow/red) for each service
    - Props: `status: ServiceStatus`

5. Extract `GPSStatusBadge.svelte`:
    - GPS fix quality badge (none/2D/3D/DGPS)
    - Latitude/longitude display with precision formatting
    - Satellite count
    - Props: `gps: GPSData`

6. Extract `ClockDisplay.svelte`:
    - UTC clock, local time, mission elapsed timer
    - Self-contained `setInterval` for clock tick (1-second interval)
    - Props: `missionStartTime?: Date` (for elapsed timer calculation)

7. Rewrite `TopStatusBar.svelte` as layout orchestrator:
    - Calls `startStatusPolling()` in `onMount`, stores cleanup for `onDestroy`
    - Passes data from service stores to each child component as props
    - Contains flexbox/grid layout for the status bar

8. Update all importers of original path.
9. Verify compilation, build, and runtime.
10. Commit.

---

## 7. Verification Commands

```bash
# 1. All files within size limits
wc -l src/lib/components/dashboard/status-bar/*.svelte src/lib/components/dashboard/status-bar/*.ts

# 2. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"

# 3. Build succeeds
npm run build 2>&1 | tail -5

# 4. Original import path updated
grep -r "TopStatusBar" src/ --include="*.svelte" --include="*.ts" -l

# 5. No circular dependencies
npx madge --circular src/lib/components/dashboard/status-bar/
```

---

## 8. Key Constraints and Caveats

1. **Polling lifecycle.** All `setInterval` timers must be cleared on component destroy. The service's `startStatusPolling()` returns a cleanup function for this purpose.
2. **Clock precision.** ClockDisplay uses its own 1-second `setInterval` for the clock tick. This is separate from the status polling interval and must have its own cleanup.
3. **Connection indicator semantics.** The color mapping (green=connected, yellow=intermittent, red=disconnected) is domain logic that stays in `ConnectionIndicators.svelte`, not in the service.
4. **GPS coordinate formatting.** Latitude/longitude display formatting (decimal degrees vs DMS) is presentation logic that stays in `GPSStatusBadge.svelte`.
5. **Temperature reading.** RPi thermal zone reading (`/sys/class/thermal/thermal_zone0/temp`) is accessed via API, not direct file read. The service handles the API call; `SystemMetrics.svelte` just displays the value.

---

## 9. Commit Message

```
refactor: extract status bar indicator components

- Extract SystemMetrics: CPU, memory, disk gauges
- Extract ConnectionIndicators: service status dots
- Extract GPSStatusBadge: GPS fix quality and coordinates
- Extract ClockDisplay: UTC/local time, mission elapsed timer
- Extract statusBarService.ts: polling orchestration
- Original 1,001-line component reduced to ~120-line layout
- Polling lifecycle properly encapsulated in service
- No logic changes, structural only
```

---

## 10. Standards Compliance

| Standard             | Compliance                                                     |
| -------------------- | -------------------------------------------------------------- |
| Barr Group Rule 1.3  | All files <200 lines post-split                                |
| NASA/JPL Rule 2.4    | Polling logic extracted into service module functions          |
| CERT C MEM00         | Timer allocation/cleanup in same lifecycle (onMount/onDestroy) |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                             |
| CERT C MSC41         | No secrets in status display components                        |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.7 -- Tier 1: TopStatusBar.svelte Decomposition
```
