# Phase 5.1.2 -- Tactical Map: Extract getDeviceIconSVG

| Field             | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Phase**         | 5.1.2                                                                   |
| **Title**         | Tactical Map: Extract getDeviceIconSVG                                  |
| **Risk Level**    | LOW                                                                     |
| **Prerequisites** | Phase 5.1.1 complete (utilities extracted)                              |
| **Files Touched** | 2 (1 modified, 1 created)                                               |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 15, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                              |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                     |

---

## 1. Objective

Extract the 227-line `getDeviceIconSVG` function from the tactical-map-simple god
page into a dedicated module. This function is pure (accepts a `KismetDevice` and a
CSS color string, returns an SVG string) with zero state dependencies and zero DOM
interaction. At 227 lines it is the second-largest function in the file and EXCEEDS
the 60-LOC NASA/JPL Rule 15 limit. The extraction includes decomposing it into
three sub-functions to achieve compliance.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

| Function                                                        | Location    | Lines | Side Effects | State Deps | >60 LOC? |
| --------------------------------------------------------------- | ----------- | ----- | ------------ | ---------- | -------- |
| `getDeviceIconSVG(device: KismetDevice, color: string): string` | L1092-L1318 | 227   | None         | None       | YES      |

**Internal structure**: The function is a cascade of `if/return` blocks, one per
device type. It contains 12 device-type branches:

1. Router
2. Smartphone
3. Laptop
4. Tablet
5. TV
6. Gaming console
7. IoT
8. Printer
9. Camera
10. Network bridge
11. Client
12. Unknown (fallback)

Each branch returns an SVG template literal. This is a classification problem.

---

## 3. Implementation Steps

### Step 1: Create the Target File

Create `src/lib/services/tactical-map/deviceIcons.ts`.

### Step 2: Define the DeviceType Enum

```typescript
export type DeviceType =
	| 'router'
	| 'smartphone'
	| 'laptop'
	| 'tablet'
	| 'tv'
	| 'gaming'
	| 'iot'
	| 'printer'
	| 'camera'
	| 'bridge'
	| 'client'
	| 'unknown';
```

### Step 3: Extract classifyDeviceType (~60 lines)

Extract the conditional logic (the `if` guards that determine device type) into a
standalone classifier function:

```typescript
export function classifyDeviceType(device: KismetDevice): DeviceType {
	// Extract the condition-checking logic from each if/return block
	// Each original block's condition becomes a case here
	// Returns the DeviceType enum value
	// ~60 lines (the condition logic only, no SVG markup)
}
```

### Step 4: Extract SVG_TEMPLATES Lookup Table (~140 lines)

Create a `Record<DeviceType, (color: string) => string>` mapping each device type
to its SVG template function:

```typescript
const SVG_TEMPLATES: Record<DeviceType, (color: string) => string> = {
	router: (color) => `<svg ...>...</svg>`,
	smartphone: (color) => `<svg ...>...</svg>`,
	laptop: (color) => `<svg ...>...</svg>`
	// ... one entry per device type
};
```

### Step 5: Rewrite getDeviceIconSVG as 2-Line Orchestrator

```typescript
export function getDeviceIconSVG(device: KismetDevice, color: string): string {
	return SVG_TEMPLATES[classifyDeviceType(device)](color);
}
```

### Step 6: Update the God Page

1. Remove the entire `getDeviceIconSVG` function definition (L1092-L1318)
2. Add import:

```typescript
import { getDeviceIconSVG } from '$lib/services/tactical-map/deviceIcons';
```

3. All call sites reference `getDeviceIconSVG` by the same name -- no renaming required

### Step 7: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify function definition removed from god page:
grep -c 'function getDeviceIconSVG' src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify exports exist in new file:
grep -c 'export function\|export const SVG_TEMPLATES' src/lib/services/tactical-map/deviceIcons.ts
# Expected: 3 (classifyDeviceType, SVG_TEMPLATES, getDeviceIconSVG)

# Verify file size:
wc -l src/lib/services/tactical-map/deviceIcons.ts
# Expected: ~240 (includes imports, types, exports)

# Verify no function in new file exceeds 60 LOC:
# classifyDeviceType should be ~60 lines
# getDeviceIconSVG should be 2 lines
# SVG_TEMPLATES is a const, not a function

# Verify import wired in page:
grep 'deviceIcons' src/routes/tactical-map-simple/+page.svelte
# Expected: 1 match (import line)

# Build checks:
npm run typecheck
npm run build
```

---

## 5. Risk Assessment

| Risk                                   | Severity | Likelihood | Mitigation                                            |
| -------------------------------------- | -------- | ---------- | ----------------------------------------------------- |
| Device type classification logic error | MEDIUM   | LOW        | Each branch is a simple string/manufacturer check     |
| SVG template syntax broken during move | LOW      | LOW        | SVG is inside template literals; copy-paste preserves |
| Missing device type branch             | MEDIUM   | LOW        | TypeScript exhaustive check on Record<DeviceType,...> |

**Overall risk**: LOW. This is a pure function. The decomposition is mechanical
(separate conditions from SVG markup). TypeScript's `Record<DeviceType, ...>` type
ensures exhaustive coverage of all device types at compile time.

---

## 6. Decomposition Notes

**Post-split max function length**: ~60 lines (`classifyDeviceType`)

The `SVG_TEMPLATES` constant is ~140 lines, but it is a data declaration (a lookup
table of template functions), not a function body. Lookup tables are exempt from
the 60-LOC function length rule per NASA/JPL Rule 15 interpretation -- the rule
applies to executable code paths, not static data declarations.

**Total lines extracted from god page**: 227

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                        |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`                   |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 227-line function split into 60-line classifier + 2-line orchestrator |
| NASA/JPL Rule 14      | Minimize function complexity               | Classification separated from SVG generation                          |
| Barr C Ch. 8          | Each module shall have a header            | `deviceIcons.ts` exports typed public interface                       |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/deviceIcons.ts
```

Single commit, single revert. No cascading dependencies beyond this step
(downstream steps reference `getDeviceIconSVG` by import, which would also revert).

---

_Phase 5.1.2 -- Tactical Map: Extract getDeviceIconSVG_
_Execution priority: 6 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -227 lines from god page_
