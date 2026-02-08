# Phase 3.2 Verification Audit: Constants Centralization

**Auditor**: Adversarial verification agent
**Date**: 2026-02-08
**Target**: Phase-3.2-CONSTANTS-CENTRALIZATION-AND-MAGIC-NUMBERS.md
**Verdict**: PLAN UNDERCOUNTS SIGNIFICANTLY ON 6 OF 8 CLAIMS. File-level attribution has multiple errors.

---

## Claim-by-Claim Verification

### CLAIM 1: limits.ts has ~40 constants, 7 groups, only 2 files import from it

| Sub-claim             | Plan says                  | Actual                                                                   | Verdict                         |
| --------------------- | -------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| Total named constants | ~40                        | **40** (4+4+7+14+8+3)                                                    | MATCH                           |
| Constant groups       | 7                          | **6** (GSM_LIMITS, HACKRF_LIMITS, PORTS, TIMEOUTS, RESOURCE_LIMITS, GEO) | WRONG -- plan lists PORTS twice |
| File size             | 95 lines                   | **95 lines**                                                             | MATCH                           |
| Files importing       | 2 (gsm.ts, geo.ts)         | **2** (gsm.ts, geo.ts)                                                   | MATCH                           |
| Constants consumed    | 2 groups (GSM_LIMITS, GEO) | **2 groups**                                                             | MATCH                           |

**Rating**: 4/5. Minor error: the plan says "7 groups" but lists PORTS twice in its table. Actual is 6 groups.

---

### CLAIM 2: 73 hardcoded port occurrences across 13 unique ports

| Port                  | Plan claims | Actual (excl. limits.ts) | Delta                                                                                        |
| --------------------- | ----------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| 2501 (Kismet)         | 14          | **17**                   | +3 (missed agent/tools/+server.ts x3, kismetProxy.ts, webSocketManager.ts)                   |
| 8092 (HackRF API)     | 3           | **4**                    | +1 (missed agent/tools/+server.ts)                                                           |
| 8073 (Spectrum)       | 10          | **12**                   | +2 (missed openwebrx/control lines 95, 104, 105, 116; overcounted elsewhere)                 |
| 3002 (HackRF Control) | 1           | **2**                    | +1 (includes HackRFHeader.svelte comment)                                                    |
| 11434 (Ollama)        | 4           | **4**                    | MATCH (but plan claims agent/models/+server.ts which does NOT EXIST; runtime.ts has 2 not 1) |
| 5173 (Argos)          | 15          | **21**                   | +6                                                                                           |
| 8081 (Bettercap)      | 5           | **9**                    | +4                                                                                           |
| 3001 (Terminal)       | 2           | **2**                    | MATCH                                                                                        |
| 8080 (GSM Evil)       | 6           | **9**                    | +3 (missed server.ts:346, example-tools.ts:94, toolHierarchy.ts)                             |
| 4729 (grgsm)          | 7           | **14**                   | +7 (MAJOR undercount -- 2x actual)                                                           |
| 2947 (gpsd)           | 2           | **2**                    | MATCH                                                                                        |
| 8088 (Tile Server)    | 1           | **1**                    | MATCH                                                                                        |
| 8002 (Kismet WS)      | 1           | **1**                    | MATCH                                                                                        |
| **TOTAL**             | **73**      | **98**                   | **+25 (34% undercount)**                                                                     |

**File attribution errors in the plan's port 2501 table (rows 1-14)**:

- Items 7-14 (proxy/+server.ts, devices/list, devices, devices/stats, status, config, interfaces) do NOT contain port 2501
- Files that DO have 2501 but are NOT listed: kismetProxy.ts, webSocketManager.ts, example-tools.ts, kismet/+page.svelte, start/+server.ts, start-safe/+server.ts, agent/tools/+server.ts
- The count accidentally lands at 14 despite the wrong file list

**Port 11434 error**: Plan claims `src/routes/api/agent/models/+server.ts` has an occurrence. That file **does not exist**. The actual 4th hit is `runtime.ts` line 215 (plan only lists runtime.ts once but it has 2 occurrences).

**Port 8092 error**: Plan claims `OpenWebRXView.svelte` line 17 has `:8092`. That file does NOT contain 8092 -- it has 8073.

**Rating**: 1/5. Total is off by 34%, multiple file attributions are wrong, one cited file doesn't exist.

---

### CLAIM 3: 79 setTimeout/setInterval + 12 AbortSignal.timeout = 91 total

| Sub-claim                          | Plan says | Actual  | Delta                    |
| ---------------------------------- | --------- | ------- | ------------------------ |
| setTimeout with hardcoded numeric  | 64        | **69**  | +5                       |
| setInterval with hardcoded numeric | 15        | **23**  | +8                       |
| AbortSignal.timeout with hardcoded | 12        | **12**  | MATCH                    |
| **TOTAL**                          | **91**    | **104** | **+13 (14% undercount)** |

**AbortSignal.timeout value breakdown errors**:

- Plan claims 2x 1000ms: actual is **3** (runtime.ts:93, start/+server.ts:30, status/+server.ts:34)
- Plan claims 4x 2000ms: actual is **5** (status/+server.ts:20, runtime.ts:79, network-detector.ts:88, :129, :168)

**Rating**: 2/5. AbortSignal count matches exactly, but setTimeout is off by 5 and setInterval is off by 8. Total 14% undercount.

---

### CLAIM 4: 80+ hardcoded RF frequency values across 20+ files

| Sub-claim    | Plan says | Actual                                                          | Verdict                             |
| ------------ | --------- | --------------------------------------------------------------- | ----------------------------------- |
| Occurrences  | 80+       | **~80-100** (after excluding false positives from 150 raw hits) | ROUGHLY CORRECT (lower bound valid) |
| Unique files | 20+       | **23**                                                          | MATCH                               |

**Notes**: Raw grep hits are 150, but many are false positives (MCC-MNC codes like "302-880", pixel widths, USB IDs like "2500:0022", protocol names like "RTL-433", GSM frequency range discussion in comments). After manual filtering, approximately 80-100 are genuine RF frequency hardcodes.

**Rating**: 4/5. The "80+" phrasing is defensible as a lower bound.

---

### CLAIM 5: 18 hardcoded /home/ paths across 3 directories

| Sub-claim         | Plan says                              | Actual | Delta               |
| ----------------- | -------------------------------------- | ------ | ------------------- |
| Total occurrences | 18                                     | **25** | +7 (39% undercount) |
| Unique files      | 12                                     | **15** | +3                  |
| Directories       | 3 (/home/pi, /home/ubuntu, /home/kali) | **3**  | MATCH               |

**Files the plan missed entirely**:

1. `src/lib/components/wigletotak/directory/DirectoryCard.svelte` -- 2 occurrences (/home/pi/kismet_ops)
2. `src/lib/server/agent/tool-execution/detection/binary-detector.ts` -- 1 occurrence (/home/kali/.local/bin)
3. `src/lib/server/gsm-database-path.ts` -- 1 occurrence (/home/ubuntu/gsmevil-user)
4. `src/lib/stores/wigletotak/wigleStore.ts` -- 1 occurrence (/home/pi/kismet_ops)
5. `src/lib/server/kismet/scriptManager.ts:181` -- plan covers lines 12-13 but misses line 181 (/home/pi/tmp/\*.log)

**Rating**: 2/5. 39% undercount. 5 files completely omitted.

---

### CLAIM 6: 53 hardcoded IPs/localhost

| Sub-claim | Plan says       | Actual | Delta                    |
| --------- | --------------- | ------ | ------------------------ |
| localhost | ~included in 53 | **56** | --                       |
| 127.0.0.1 | ~included in 53 | **5**  | --                       |
| 0.0.0.0   | ~included in 53 | **6**  | --                       |
| **TOTAL** | **53**          | **67** | **+14 (26% undercount)** |

**Rating**: 2/5. 26% undercount.

---

### CLAIM 7: 25 hardcoded DB config values

| Sub-claim         | Plan says | Actual                                        | Verdict     |
| ----------------- | --------- | --------------------------------------------- | ----------- |
| dbOptimizer.ts    | 17        | **~12 pragma + 3 defaults = 15**              | Overcounted |
| database.ts       | 6         | **4 pragma + 1 batchSize + 1 grid = 6**       | MATCH       |
| cleanupService.ts | 2         | **2 (batchSize + VACUUM threshold)**          | MATCH       |
| **TOTAL**         | **25**    | **~23** (excluding grid 10000 SQL references) | CLOSE       |

**Notes**: The exact count depends on whether you count pragma reads (for reporting) vs pragma writes (for config). If we count only configuration-setting pragmas with hardcoded values:

- dbOptimizer.ts: 8 pragma writes + 2 default config values + 1 row_count threshold = 11
- database.ts: 3 pragma writes + batchSize + maxRuntime = 5
- cleanupService.ts: batchSize + VACUUM threshold = 2
- Grid multiplier 10000: appears 10 times across 3 files but is a single logical constant

Total: ~18-23 depending on counting methodology. Plan's 25 is slightly overcounted for dbOptimizer.

**Rating**: 3/5. Roughly in the right range, slightly overcounted.

---

### CLAIM 8: 12 duplicate retention period values

| Location                                 | Values                                                                | Count              |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------ |
| cleanupService.ts defaults (lines 43-59) | hackrf, wifi, default, device, pattern, cleanup, aggregate            | 7                  |
| database.ts (lines 262-270)              | Same 7 + batchSize + maxRuntime                                       | 9                  |
| **Duplicated retention values**          | 5 retention + 2 intervals = 7 unique values duplicated across 2 files | **14 occurrences** |

Plan claims "12 duplicate retention period values". Actual: 7 unique values are duplicated across 2 files = 14 individual occurrences. If the plan means "12 lines of retention config that are duplicated" it's closer to 7+7=14. The "12" doesn't match any counting methodology I can reproduce.

**Rating**: 2/5. Number doesn't match under any reasonable counting.

---

## SECURITY FINDINGS (Not adequately addressed in the plan)

### 1. Hardcoded API Key (CRITICAL)

```
src/routes/api/cell-towers/nearby/+server.ts:7:
  const OPENCELLID_API_KEY = 'pk.d6291c07a2907c915cd8994fb22bc189';

src/routes/api/gsm-evil/tower-location/+server.ts:52:
  const apiKey = 'pk.d6291c07a2907c915cd8994fb22bc189';
```

Same OpenCelliD API key hardcoded in 2 files. The plan mentions deferring credentials to Phase 2 but does NOT flag these specific instances.

### 2. Hardcoded Kismet Credentials

```
src/routes/api/kismet/control/+server.ts:134:
  'curl ... -d "username=admin&password=password" http://localhost:2501/session/set_password'

src/lib/server/kismet/kismet_controller.ts:52:
  restPassword: 'kismet'
```

### 3. Command Injection via Port 4729

The 14 occurrences of port 4729 include several in shell command strings (`sudo grgsm_livemon_headless -f ${freq}M`). These are already flagged in the runtime validation audit as command injection vectors. Centralizing the port number alone does not fix the injection risk.

---

## OVERALL PLAN ACCURACY SUMMARY

| Claim                  | Plan value | Actual value | Error %  | Rating |
| ---------------------- | ---------- | ------------ | -------- | ------ |
| limits.ts constants    | ~40        | 40           | 0%       | 5/5    |
| limits.ts groups       | 7          | 6            | -14%     | 3/5    |
| limits.ts importers    | 2          | 2            | 0%       | 5/5    |
| Hardcoded ports        | 73         | 98           | **-34%** | 1/5    |
| setTimeout/setInterval | 79         | 92           | -16%     | 2/5    |
| AbortSignal.timeout    | 12         | 12           | 0%       | 5/5    |
| Total timeouts         | 91         | 104          | **-14%** | 2/5    |
| RF frequencies         | 80+        | ~80-100      | ~0%      | 4/5    |
| /home/ paths           | 18         | 25           | **-39%** | 2/5    |
| IPs/localhost          | 53         | 67           | **-26%** | 2/5    |
| DB config values       | 25         | ~23          | +9%      | 3/5    |
| Retention duplicates   | 12         | 14           | -14%     | 2/5    |

**Overall Quantitative Accuracy: 2.5/5**

The plan's architectural approach (centralize constants, then do file-by-file replacement) is SOUND. The execution order is logical. But the inventory is incomplete:

1. **Port count is 34% low** -- 98 actual vs 73 claimed
2. **Timeout count is 14% low** -- 104 actual vs 91 claimed
3. **Path count is 39% low** -- 25 actual vs 18 claimed
4. **IP/localhost is 26% low** -- 67 actual vs 53 claimed
5. **File attribution errors** -- wrong files listed for port 2501 table, nonexistent file cited for 11434
6. **agent/tools/+server.ts completely missed** -- has both 2501 (x3) and 8092 (x1)
7. **5 files with /home/ paths completely omitted** from the path replacement table
8. **Port 4729 undercounted 2x** -- 14 actual vs 7 claimed

### Impact Assessment

If executed as-written, the plan would leave approximately:

- ~25 port hardcodes unfixed (98-73)
- ~13 timeout hardcodes unfixed (104-91)
- ~7 path hardcodes unfixed (25-18)
- ~14 IP/localhost hardcodes unfixed (67-53)

Total: approximately **59 hardcoded values would survive** the plan's execution. The verification commands at the end of the plan (grep-based checks targeting 0 remaining) would catch these -- so the plan is SELF-CORRECTING at verification time, but the scope estimation and work breakdown are materially wrong.

### Recommendation

Before execution, re-run the inventory grep commands from this audit to produce accurate file-level tables. The plan's structure and approach are correct; only the numbers and file attributions need updating.
