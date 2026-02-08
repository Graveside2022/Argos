# Phase 3.2.5: Hardcoded Buffer, Capacity, and Retention Limit Replacement

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.5
**Risk Level**: LOW
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension -- BUFFER_LIMITS, RETENTION, and GEO must be defined)
**Blocks**: Phase 3.3 (ESLint `no-magic-numbers` rule)
**Estimated Files Touched**: 10+
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Replace all 27 hardcoded buffer size, capacity limit, and retention limit literals across 10+ source files with named constants from the `BUFFER_LIMITS`, `RETENTION`, and `GEO` objects defined in `src/lib/constants/limits.ts`. This includes the duplicate Earth radius constants.

## Current State Assessment

| Metric                              | Value                                  |
| ----------------------------------- | -------------------------------------- |
| Total buffer/capacity occurrences   | 27                                     |
| Target files                        | 10+                                    |
| Unique values                       | 10 unique buffer/capacity values       |
| BUFFER_LIMITS defined (after 3.2.0) | 21 constants                           |
| Earth radius duplicates             | 3 (6371000, 6371, 3959) across 2 files |

## Scope

### Buffer and Capacity Replacement Table

| #   | File                                        | Line | Current Value                | Replacement Constant                            | Context                       |
| --- | ------------------------------------------- | ---- | ---------------------------- | ----------------------------------------------- | ----------------------------- |
| 1   | `src/lib/server/btle/processManager.ts`     | 44   | `5000` packets cap           | `BUFFER_LIMITS.BTLE_PACKETS_CAP`                | BTLE packet array slice limit |
| 2   | `src/lib/server/kismet/device_tracker.ts`   | 305  | `100` history cap            | `BUFFER_LIMITS.DEVICE_HISTORY_CAP`              | Device history array limit    |
| 3   | `src/lib/server/wifite/processManager.ts`   | 228  | `500` output cap             | `BUFFER_LIMITS.WIFITE_OUTPUT_CAP`               | Wifite output buffer limit    |
| 4   | `src/lib/server/wifite/processManager.ts`   | 238  | `500` output cap             | `BUFFER_LIMITS.WIFITE_OUTPUT_CAP`               | Second wifite output slice    |
| 5   | `src/lib/server/pagermon/processManager.ts` | 51   | `1000` messages cap          | `BUFFER_LIMITS.PAGERMON_MESSAGES_CAP`           | PagerMon message buffer limit |
| 6   | `src/lib/server/websocket-server.ts`        | 32   | `1024` chunk size            | `BUFFER_LIMITS.WEBSOCKET_CHUNK_SIZE`            | WS data chunking threshold    |
| 7   | `src/lib/server/websocket-server.ts`        | 37   | `10240` large chunk size     | `BUFFER_LIMITS.WEBSOCKET_LARGE_CHUNK_SIZE`      | WS large message chunking     |
| 8   | `src/lib/server/websocket-server.ts`        | 43   | `1024` compression threshold | `BUFFER_LIMITS.WEBSOCKET_COMPRESSION_THRESHOLD` | WS compression trigger        |
| 9   | `src/lib/server/db/signalRepository.ts`     | 191  | `1000` query limit           | `BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT`          | Default SQL LIMIT clause      |
| 10  | `src/lib/server/db/networkRepository.ts`    | 63   | `1000` query limit           | `BUFFER_LIMITS.DB_QUERY_LIMIT_DEFAULT`          | Default SQL LIMIT clause      |
| 11  | `src/lib/server/db/cleanupService.ts`       | 54   | `1000` batchSize             | `BUFFER_LIMITS.CLEANUP_BATCH_SIZE`              | Cleanup batch size            |
| 12  | `src/lib/server/db/cleanupService.ts`       | 317  | `10000` VACUUM threshold     | `BUFFER_LIMITS.VACUUM_THRESHOLD`                | VACUUM trigger threshold      |

**Note**: Items 11 and 12 overlap with Task 3.2.4 (Database Config Replacement). If Task 3.2.4 completes first, these will already be replaced. The executor must verify at execution time whether these are already constant references before attempting replacement. Do not double-replace.

### Additional Buffer Limits (from memory leak fixes, 2026-02-06/07)

The following buffer caps were added during the memory leak audit and may already use hardcoded literals:

| #   | File / Store                                 | Current Value | Replacement Constant                | Context                |
| --- | -------------------------------------------- | ------------- | ----------------------------------- | ---------------------- |
| 13  | `src/lib/stores/securityAlerts` (or similar) | `500`         | `BUFFER_LIMITS.MAX_ALERTS`          | Security alert cap     |
| 14  | `src/lib/stores/flaggedPackets` (or similar) | `500`         | `BUFFER_LIMITS.MAX_FLAGGED_PACKETS` | Flagged packet cap     |
| 15  | `src/lib/services/map/signals.ts`            | `5000`        | `BUFFER_LIMITS.MAX_SIGNALS_MAP`     | Signal map cap         |
| 16  | `src/lib/stores/gsmEvilStore.ts`             | `500`         | `BUFFER_LIMITS.MAX_SCAN_PROGRESS`   | GSM scan progress cap  |
| 17  | `src/lib/stores/gsmEvilStore.ts`             | `1000`        | `BUFFER_LIMITS.MAX_CAPTURED_IMSI`   | IMSI capture cap       |
| 18  | `src/lib/stores/rtl433Store.ts`              | `1000`        | `BUFFER_LIMITS.MAX_RTL433_SIGNALS`  | RTL-433 signal cap     |
| 19  | `src/lib/stores/drone.ts` (or similar)       | `10000`       | `BUFFER_LIMITS.MAX_FLIGHT_POINTS`   | Drone flight point cap |
| 20  | `src/lib/stores/drone.ts` (or similar)       | `50`          | `BUFFER_LIMITS.MAX_MISSION_HISTORY` | Mission history cap    |

### Duplicate Earth Radius Constants

Three different Earth radius values are used in 2 files. These must be consolidated:

| #   | File                                                            | Line | Current Value | Replacement                             | Context                    |
| --- | --------------------------------------------------------------- | ---- | ------------- | --------------------------------------- | -------------------------- |
| 21  | `src/lib/server/services/kismet.service.ts`                     | 202  | `6371000`     | `GEO.EARTH_RADIUS_M`                    | Haversine formula (meters) |
| 22  | `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 198  | `6371`        | `GEO.EARTH_RADIUS_M / 1000`             | Haversine formula (km)     |
| 23  | `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 199  | `3959`        | New: `GEO.EARTH_RADIUS_MI` (add to GEO) | Haversine formula (miles)  |

**Action required for item 23**: Add `EARTH_RADIUS_MI: 3959` to the existing `GEO` object in limits.ts. This is a minor extension to Task 3.2.0 -- if Task 3.2.0 has already been committed, add this as part of this task's commit.

### RTL-433 and Service Log Caps

| #   | File / Context                                       | Current Value | Replacement Constant                      |
| --- | ---------------------------------------------------- | ------------- | ----------------------------------------- |
| 24  | RTL-433 global output cap                            | `100`         | `BUFFER_LIMITS.RTL433_GLOBAL_OUTPUT_CAP`  |
| 25  | Service log lines default                            | `100`         | `BUFFER_LIMITS.SERVICE_LOG_LINES_DEFAULT` |
| 26  | Log buffer size                                      | `1000`        | `BUFFER_LIMITS.LOG_BUFFER_SIZE`           |
| 27  | Pagermon messages (store-level, if separate from #5) | `1000`        | `BUFFER_LIMITS.PAGERMON_MESSAGES_CAP`     |

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.0 is complete -- `grep "BUFFER_LIMITS" src/lib/constants/limits.ts` returns matches.
2. **Check for overlap with Task 3.2.4**: If cleanupService.ts items 11-12 are already replaced, skip them.
3. **Add `EARTH_RADIUS_MI: 3959`** to GEO object in limits.ts (if not already present from Task 3.2.0).
4. **Replace server-side buffer limits** (items 1-12): processManager files, websocket-server, repository files, cleanupService.
5. **Run** `npm run typecheck`.
6. **Replace store-level buffer caps** (items 13-20): Svelte stores with `.slice(-N)` patterns.
7. **Run** `npm run typecheck`.
8. **Replace Earth radius constants** (items 21-23).
9. **Run** `npm run typecheck`.
10. **Replace remaining caps** (items 24-27).
11. **Run final verification**.

## Commit Message

```
refactor(constants): replace 27 hardcoded buffer/capacity/retention literals

Phase 3.2 Task 5: Hardcoded Buffer, Capacity, and Retention Limit Replacement
- Replaced BTLE, Wifite, PagerMon, WebSocket buffer caps with BUFFER_LIMITS.*
- Replaced DB query limits and cleanup thresholds with BUFFER_LIMITS.*
- Replaced store-level array caps (signals, alerts, IMSI, flight points)
- Consolidated duplicate Earth radius constants (6371000, 6371, 3959)
  into GEO.EARTH_RADIUS_M and GEO.EARTH_RADIUS_MI
Verified: grep for raw buffer cap literals returns 0 outside limits.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No hardcoded 5000 packet cap in BTLE**:

```bash
grep -Prn '\b5000\b' src/lib/server/btle/ --include="*.ts" | grep -v limits.ts | wc -l
```

**Expected result**: `0`

**Command 2 -- No hardcoded Earth radius**:

```bash
grep -Prn '\b(6371000|6371|3959)\b' src/ --include="*.ts" | grep -v limits.ts | wc -l
```

**Expected result**: `0`

**Command 3 -- No hardcoded 1024 in websocket-server**:

```bash
grep -Prn '\b1024\b' src/lib/server/websocket-server.ts | wc -l
```

**Expected result**: `0`

**Command 4 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 5 -- Build succeeds**:

```bash
npm run build
```

**Expected result**: Exit 0.

## Audit Corrections Applied

No significant audit corrections apply to this task. The buffer/capacity counts were not a major focus of the verification audit. The RETENTION duplicate count of 14 (corrected from 12) is primarily addressed in Task 3.2.4 but overlaps here for the store-level retention references.

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                                    |
| --------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| Buffer cap value change alters behavior             | NONE       | --     | Literal-for-literal replacement; no values changed                            |
| Double-replacement with Task 3.2.4                  | MEDIUM     | LOW    | Executor checks if cleanupService items already replaced before proceeding    |
| Store-level cap replacement breaks reactive updates | LOW        | LOW    | `.slice(-N)` pattern preserved; only the `N` changes from literal to constant |
| Earth radius precision loss                         | NONE       | --     | Integer values (6371000, 6371, 3959) -- no floating point involved            |
| EARTH_RADIUS_MI addition to GEO                     | LOW        | LOW    | Additive-only change to existing object; no existing code broken              |

## Success Criteria

- `grep -Prn '\b(6371000|6371|3959)\b' src/ --include="*.ts" | grep -v limits.ts | wc -l` returns **0**
- All 27 buffer/capacity/retention literals replaced with named constants
- `npm run typecheck` exits 0
- `npm run build` exits 0
- No behavioral changes -- only identifiers changed, not values
- GEO object extended with EARTH_RADIUS_MI if not already present

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension -- BUFFER_LIMITS, RETENTION, GEO)
- **Overlaps with**: Phase-3.2.4 (Database Config Replacement -- cleanupService.ts items 11-12)
- **Independent of**: Phase-3.2.1 (Port), Phase-3.2.2 (Timeout), Phase-3.2.3 (RF Frequency)
- **Blocks**: Phase-3.3 (ESLint `no-magic-numbers` enforcement)

## Execution Tracking

| Subtask | Description                                     | Status  | Started | Completed | Verified By |
| ------- | ----------------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.5.1 | Replace server-side buffer limits (items 1-12)  | PENDING | --      | --        | --          |
| 3.2.5.2 | Replace store-level caps (items 13-20)          | PENDING | --      | --        | --          |
| 3.2.5.3 | Add EARTH_RADIUS_MI to GEO, replace items 21-23 | PENDING | --      | --        | --          |
| 3.2.5.4 | Replace remaining caps (items 24-27)            | PENDING | --      | --        | --          |
| 3.2.5.5 | Final verification                              | PENDING | --      | --        | --          |
