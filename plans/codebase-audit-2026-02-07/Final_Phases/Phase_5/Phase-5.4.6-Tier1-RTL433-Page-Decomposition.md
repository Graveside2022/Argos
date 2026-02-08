# Phase 5.4.6 -- Tier 1: RTL-433 Page Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.6-RTL433-PAGE
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.6 -- Decompose rtl-433/+page.svelte (1,009 lines)
Risk Level:     LOW-MEDIUM
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 5 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                               |
| --------------- | ----------------------------------- |
| Path            | `src/routes/rtl-433/+page.svelte`   |
| Current Lines   | 1,009                               |
| Tier            | 1 (>1,000 lines, unconditional)     |
| Execution Order | 6 of 7 (sixth Tier 1 decomposition) |

---

## 2. Content Analysis

RTL-433 SDR receiver page. Contains:

- Device signal table with sorting, filtering, and pagination
- Protocol decoder display (RTL-433 JSON output parsed into typed records)
- Frequency controls (center frequency selector, gain adjustment, start/stop)
- Signal history chart (time-series visualization of received signals)
- Device configuration panel (RTL-433 decoder options)
- Heavy inline logic for decoding RTL-433 JSON output into typed device records

**Why It Exceeds Threshold:**
Three major UI sections plus a decoder service are all in one page file. The JSON
parsing/decoding logic for RTL-433 protocol output is business logic that does not
belong in a Svelte component.

---

## 3. Decomposition Strategy

Extract the three major UI sections into components and the decoder logic into a
TypeScript service module.

**Architecture after decomposition:**

```
+page.svelte (page shell, ~120 lines)
  +-- RTL433Controls.svelte (frequency/gain controls, ~180 lines)
  +-- SignalTable.svelte (signal history table, ~250 lines)
  +-- DeviceDecoder.svelte (protocol decoder display, ~200 lines)
  +-- rtl433Decoder.ts (JSON parsing/protocol ID, ~150 lines)
```

---

## 4. New File Manifest

| New File                               | Content                                             | Est. Lines |
| -------------------------------------- | --------------------------------------------------- | ---------- |
| `routes/rtl-433/+page.svelte`          | Page shell, layout, store subscriptions             | ~120       |
| `routes/rtl-433/RTL433Controls.svelte` | Frequency selector, gain controls, start/stop       | ~180       |
| `routes/rtl-433/SignalTable.svelte`    | Signal history data table with sorting/filtering    | ~250       |
| `routes/rtl-433/DeviceDecoder.svelte`  | Protocol decoder output display                     | ~200       |
| `routes/rtl-433/rtl433Decoder.ts`      | JSON parsing, protocol identification, type mapping | ~150       |

**Total target files:** 5
**Maximum file size:** ~250 lines (SignalTable.svelte)
**Original file disposition:** Reduced in-place to ~120-line page shell

---

## 5. Migration Steps

1. Extract `rtl433Decoder.ts` -- all JSON parsing logic for RTL-433 output. This includes:
    - Parsing raw JSON lines from RTL-433 process output
    - Protocol identification (weather sensors, car key fobs, tire pressure monitors, etc.)
    - Type mapping from protocol-specific fields to normalized device records
    - This module has ZERO Svelte or DOM dependencies (pure business logic).

2. Extract `RTL433Controls.svelte`:
    - Frequency selector (center frequency input or preset dropdown)
    - Gain adjustment slider
    - Start/stop toggle button
    - Props: `isRunning: boolean`, `currentFreq: number`, `currentGain: number`
    - Events: `dispatch('start')`, `dispatch('stop')`, `dispatch('configChange', { freq, gain })`

3. Extract `SignalTable.svelte`:
    - Signal history data table with column sorting and signal type filtering
    - Pagination controls if present
    - Props: `signals: DecodedSignal[]`
    - This is the largest extracted component (~250 lines) due to table rendering complexity

4. Extract `DeviceDecoder.svelte`:
    - Protocol decoder output display (formatted decoded device data)
    - Props: `decodedDevices: DecodedDevice[]`
    - Imports from `rtl433Decoder.ts` for display formatting helpers

5. Reduce `+page.svelte` to page shell:
    - Subscribes to RTL-433 data store
    - Passes decoded data to child components
    - Handles start/stop/config events from controls
    - Composes layout with child components

6. Verify compilation, build, and runtime.
7. Commit.

---

## 6. Verification Commands

```bash
# 1. All files within size limits
wc -l src/routes/rtl-433/*.svelte src/routes/rtl-433/*.ts

# 2. Build succeeds
npm run build 2>&1 | tail -5

# 3. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"

# 4. No broken imports
grep -r "rtl-433" src/ --include="*.svelte" --include="*.ts" -l
```

---

## 7. Key Constraints and Caveats

1. **RTL-433 JSON format.** The decoder must handle RTL-433's variable JSON schema (different fields per protocol/device type). This is existing logic being extracted, not new logic.
2. **Store subscriptions.** The page shell retains store subscriptions for RTL-433 data. Child components receive pre-processed data as props.
3. **SvelteKit route co-location.** All extracted components live in `src/routes/rtl-433/` alongside `+page.svelte`. This follows SvelteKit's co-located component convention.
4. **Signal table performance.** If the table renders hundreds of signals, ensure the parent passes a bounded slice (per memory leak fixes: `.slice(-MAX)` pattern) rather than the full history.

---

## 8. Commit Message

```
refactor: decompose RTL-433 page into components

- Extract RTL433Controls: frequency selector, gain, start/stop
- Extract SignalTable: signal history data table with sorting
- Extract DeviceDecoder: protocol decoder output display
- Extract rtl433Decoder.ts: JSON parsing and protocol identification
- Original 1,009-line page reduced to ~120-line shell
- Business logic (decoder) separated from presentation
- No logic changes, structural only
```

---

## 9. Standards Compliance

| Standard             | Compliance                                       |
| -------------------- | ------------------------------------------------ |
| Barr Group Rule 1.3  | All files <300 lines post-split                  |
| NASA/JPL Rule 2.4    | Decoder functions extracted into testable module |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files               |
| CERT C MSC41         | No secrets in SDR page components                |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.6 -- Tier 1: RTL-433 Page Decomposition
```
