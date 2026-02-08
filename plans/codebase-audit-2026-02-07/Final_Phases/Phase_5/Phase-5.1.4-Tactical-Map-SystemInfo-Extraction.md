# Phase 5.1.4 -- Tactical Map: Extract System Info Subsystem

| Field             | Value                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| **Phase**         | 5.1.4                                                                      |
| **Title**         | Tactical Map: Extract System Info Subsystem                                |
| **Risk Level**    | MEDIUM                                                                     |
| **Prerequisites** | Phase 4 complete (dead systemService.ts removed), Phase 5.1.1 complete     |
| **Files Touched** | 2-3 (1 modified, 1 created, possibly wire existing SystemInfoPopup.svelte) |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8      |
| **Audit Date**    | 2026-02-08                                                                 |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                        |

---

## 1. Objective

Extract the system info subsystem (SystemInfo interface, fetch, popup display) from
the tactical-map-simple god page into a new `SystemInfoManager` service. The
`showPiPopup` function at 167 lines EXCEEDS the 60-LOC NASA/JPL Rule 15 limit and
must be decomposed. Additionally, evaluate and wire the pre-built
`SystemInfoPopup.svelte` component (270 lines) as a replacement for raw HTML string
generation.

**CRITICAL**: This creates a NEW file at `src/lib/services/tactical-map/systemInfoManager.ts`.
It does NOT extend, import from, or reference the dead `systemService.ts` (which
has zero importers and is deleted in Phase 4). See Phase-5.1.0 Section 3.2.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

| Function/Interface     | Location   | Lines | Side Effects            | >60 LOC? |
| ---------------------- | ---------- | ----- | ----------------------- | -------- |
| `SystemInfo` interface | L38-L70    | 33    | None (type definition)  | No       |
| `fetchSystemInfo()`    | L886-L924  | 39    | API call                | No       |
| `showPiPopup()`        | L925-L1091 | 167   | API call, Leaflet popup | **YES**  |
| State: `systemInfo`    | let decl   | --    | --                      | --       |
| State: `piMarker`      | let decl   | --    | --                      | --       |
| State: `piPopupOpen`   | let decl   | --    | --                      | --       |

**Total lines to extract**: ~205

---

## 3. Decomposition of showPiPopup (167 lines)

`showPiPopup` currently handles 5 responsibilities:

1. Fetch system info via API call (~10 lines)
2. Format bytes helper function (nested `formatBytes` at L969, ~5 lines)
3. Generate massive popup HTML string (~120 lines of template literal with inline
   styles for CPU, memory, storage, temperature, battery, WiFi interfaces)
4. Create/update Leaflet popup on the Pi marker (~15 lines)
5. Error handling (~10 lines)

**Split into 3 functions**:

- `formatSystemBytes(bytes: number): string` -- pure utility (~5 lines). Move to
  `src/lib/services/tactical-map/utils.ts` (extends Phase 5.1.1 output).
- `generateSystemPopupHTML(info: SystemInfo, position: Position): string` -- pure
  function returning popup HTML (~120 lines). The HTML is a data template, not
  logic; acceptable at this length as a template.
- `showPiPopup(map, position)` -- orchestrator: fetch, generate HTML, bind popup (~30 lines)

**Post-split max function length**: ~30 lines (excluding HTML template)

---

## 4. Pre-Built Component Evaluation

The pre-built `SystemInfoPopup.svelte` (270 lines) exists at
`src/lib/components/tactical-map/system/`. It should be evaluated for compatibility:

**Evaluation criteria**:

1. Does its prop interface accept a `SystemInfo`-compatible type?
2. Does it render the same data fields (CPU, memory, storage, temp, battery, WiFi)?
3. Does it produce output suitable for Leaflet popup binding?

**If compatible**: Import `SystemInfoPopup.svelte` instead of generating popup HTML
strings. The Svelte component approach is preferred over raw HTML strings for
maintainability.

**If incompatible**: Use the extracted `generateSystemPopupHTML` pure function and
document the interface mismatch for future reconciliation.

---

## 5. Implementation Steps

### Step 1: Move formatBytes to utils.ts

Add to `src/lib/services/tactical-map/utils.ts` (created in Phase 5.1.1):

```typescript
export function formatSystemBytes(bytes: number): string {
	// Extracted from nested formatBytes at L969 (~5 lines)
}
```

### Step 2: Create the Target File

Create `src/lib/services/tactical-map/systemInfoManager.ts`:

```typescript
// src/lib/services/tactical-map/systemInfoManager.ts

import type { LeafletMap, LeafletLibrary, LeafletMarker } from '$lib/types/leaflet';
import { formatSystemBytes } from './utils';

export interface SystemInfo {
	// Extracted from L38-L70 (33 lines)
}

interface Position {
	lat: number;
	lon: number;
}

function generateSystemPopupHTML(info: SystemInfo, position: Position): string {
	// Pure function, returns popup HTML (~120 lines template literal)
	// Extracted from showPiPopup L969-L1080 region
}

export class SystemInfoManager {
	private systemInfo: SystemInfo | null = null;
	private piMarker: LeafletMarker | null = null;
	private piPopupOpen = false;

	constructor(
		private map: LeafletMap,
		private L: LeafletLibrary
	) {}

	async fetchInfo(): Promise<SystemInfo> {
		// Extracted from fetchSystemInfo() L886-L924 (~39 lines)
	}

	async showPopup(position: Position): Promise<void> {
		// Orchestrator: fetch, generate HTML, bind popup (~30 lines)
		// Extracted from showPiPopup() L925-L1091
	}

	closePopup(): void {
		// Close popup and update state
	}

	get isPopupOpen(): boolean {
		return this.piPopupOpen;
	}
}
```

### Step 3: Remove Functions from God Page

Remove from `+page.svelte`:

- `SystemInfo` interface (L38-L70)
- `fetchSystemInfo()` (L886-L924)
- `showPiPopup()` (L925-L1091)
- Related state declarations: `systemInfo`, `piMarker`, `piPopupOpen`

### Step 4: Wire the Manager in the God Page

```typescript
import { SystemInfoManager } from '$lib/services/tactical-map/systemInfoManager';

// In onMount:
systemInfoMgr = new SystemInfoManager(map, L);

// In template/event handlers:
// showPiPopup() -> systemInfoMgr.showPopup(userPosition)
```

### Step 5: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 6. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function fetchSystemInfo\|function showPiPopup' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify SystemInfo interface removed from god page:
grep -c 'interface SystemInfo' src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify new file exists and has expected size:
wc -l src/lib/services/tactical-map/systemInfoManager.ts
# Expected: ~220

# Verify the new file is imported:
grep 'systemInfoManager' src/routes/tactical-map-simple/+page.svelte
# Expected: >= 1 match

# Check if SystemInfoPopup component was wired:
grep -c 'SystemInfoPopup' src/routes/tactical-map-simple/+page.svelte
# Expected: >= 1 (if component was compatible and wired)

# Build verification:
npm run typecheck
npm run build
```

---

## 7. Risk Assessment

| Risk                                          | Severity | Likelihood | Mitigation                                                        |
| --------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------- |
| SystemInfo interface shape mismatch           | MEDIUM   | LOW        | TypeScript typecheck catches immediately                          |
| Popup HTML visual regression                  | MEDIUM   | LOW        | Template literal is a direct copy; visual regression test catches |
| SystemInfoPopup.svelte interface incompatible | LOW      | MEDIUM     | Fall back to generateSystemPopupHTML pure function                |
| Leaflet popup lifecycle broken                | MEDIUM   | LOW        | Manager class owns piMarker; constructor receives map             |

**Overall risk**: MEDIUM. The popup HTML is large (~120 lines) but is pure template
data. The primary risk is Leaflet popup lifecycle management, mitigated by class-based
ownership.

---

## 8. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                        |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`                   |
| CERT C MEM00-C        | Allocate/free in same module               | Leaflet popup created and destroyed in same `SystemInfoManager` class |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 167-line showPiPopup split into 30-line orchestrator + HTML template  |
| Barr C Ch. 8          | Each module shall have a header            | `systemInfoManager.ts` exports typed `SystemInfoManager` class        |

---

## 9. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
git checkout -- src/lib/services/tactical-map/utils.ts  # revert formatSystemBytes addition
rm -f src/lib/services/tactical-map/systemInfoManager.ts
```

Single commit, single revert. The `SystemInfoManager` is only imported by the god page.

---

_Phase 5.1.4 -- Tactical Map: Extract System Info Subsystem_
_Execution priority: 14 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -205 lines from god page_
