# Task 0.5: Barrel Export Creation

**Execution Order**: Step 5 (after Tasks 0.2, 0.3, 0.4, 0.6)
**Prerequisites**: Task 0.6 COMPLETE. All files at final locations, types extracted.
**Blocks**: Task 0.7 (import standardization benefits from barrel paths)
**Risk Level**: LOW -- Creating new index.ts files, no logic changes.
**Commit Message**: `refactor: create barrel exports for all module directories`

---

## Rationale

Only 16 of 97 directories under `src/lib/` have `index.ts` barrel exports. Immich, HuggingFace, and Twenty all use barrel exports as the standard module interface. Without them, consumers import from deep internal paths that break on refactor and expose implementation details.

---

## Subtask 0.5.1: Top-Level Barrel Exports (Critical)

Create these 4 barrel files. Each barrel must use **explicit named re-exports** (NOT `export *`) to prevent namespace collisions and enable dead code elimination by the bundler.

### `src/lib/stores/index.ts`

At execution time, generate the barrel by running:

```bash
ls src/lib/stores/*.ts | grep -v index.ts
```

For each file, inspect whether it uses `export default` or named exports. Generate the barrel using named re-exports.

**Rules**:

- Every `.ts` file in `src/lib/stores/` (excluding `index.ts`) MUST have a corresponding export line
- Do NOT use `export * from` -- name each export explicitly
- If a store file uses `export default`, re-export it as a named export: `export { default as storeName } from './store-file'`

### `src/lib/types/index.ts`

```typescript
// Canonical type barrel -- ONE import path for all shared types
// Usage: import type { SpectrumData, KismetDevice } from '$lib/types';
export * from './enums';
export * from './shared';
export * from './errors';
export * from './signals';
export * from './kismet';
export * from './gsm';
export * from './validation';
export * from './terminal';
export * from './tools';
```

**NOTE**: `export *` is acceptable for type files because types do not have runtime side effects and namespace collisions are caught at compile time.

### `src/lib/utils/index.ts`

```typescript
export { logger, logInfo, logError, logWarn } from './logger';
export { detectCountry, formatCoordinates } from './country-detector';
export { latLonToMGRS } from './mgrs-converter';
```

**Verify**: Run `ls src/lib/utils/*.ts | grep -v index.ts` and ensure every utility file has at least one export in the barrel.

### `src/lib/constants/index.ts`

```typescript
export * from './limits';
```

---

## Subtask 0.5.2: Server Module Barrel Exports

Create `index.ts` for each directory. Use explicit named re-exports.

| Directory           | Approx Files | Priority | Notes                                         |
| ------------------- | ------------ | -------- | --------------------------------------------- |
| `server/db/`        | 10           | HIGH     | Heavily imported across the codebase          |
| `server/agent/`     | 22           | HIGH     | Largest server module                         |
| `server/hardware/`  | 11           | HIGH     | Verify if barrel already exists; update if so |
| `server/kismet/`    | 14           | HIGH     | After renames in Task 0.3                     |
| `server/bettercap/` | 2            | MEDIUM   |                                               |
| `server/btle/`      | 2            | MEDIUM   |                                               |
| `server/companion/` | 2            | MEDIUM   |                                               |
| `server/wifite/`    | 2            | MEDIUM   |                                               |
| `server/pagermon/`  | 2            | MEDIUM   |                                               |
| `server/usrp/`      | 1            | LOW      |                                               |

**Process for each directory**:

1. `ls <directory>/*.ts | grep -v index.ts` to list all module files
2. For each file, identify its public exports
3. Create `index.ts` with explicit named re-exports
4. Run `npm run typecheck`

---

## Subtask 0.5.3: Service Module Barrel Exports

| Directory                | Approx Files                 | Priority |
| ------------------------ | ---------------------------- | -------- |
| `services/map/`          | 14                           | HIGH     |
| `services/tactical-map/` | 6                            | HIGH     |
| `services/localization/` | 6                            | MEDIUM   |
| `services/hackrfsweep/`  | 4                            | MEDIUM   |
| `services/db/`           | 2                            | MEDIUM   |
| `services/system/`       | 3 (after merges in Task 0.4) | MEDIUM   |

---

## Subtask 0.5.4: Component Module Barrel Exports

| Directory                  | Approx Files | Priority |
| -------------------------- | ------------ | -------- |
| `components/hackrf/`       | ~15          | HIGH     |
| `components/kismet/`       | ~7           | HIGH     |
| `components/map/`          | ~16          | HIGH     |
| `components/dashboard/`    | ~25          | HIGH     |
| `components/tactical-map/` | ~11          | HIGH     |
| `components/shared/`       | 3+           | MEDIUM   |
| `components/hackrfsweep/`  | ~7           | MEDIUM   |
| `components/wigletotak/`   | 6            | MEDIUM   |
| `components/drone/`        | ~2           | LOW      |
| `components/hardware/`     | ~3           | LOW      |

**NOTE**: File counts are approximate. Run `ls <directory>/*.svelte | wc -l` at execution time to get the exact count.

---

## Subtask 0.5.5: Store Subdirectory Barrel Exports

| Directory              | Files |
| ---------------------- | ----- |
| `stores/dashboard/`    | 4     |
| `stores/tactical-map/` | 5     |
| `stores/hackrfsweep/`  | 4     |
| `stores/map/`          | 1     |
| `stores/wigletotak/`   | 1     |

---

## Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass

# Verify critical barrels exist:
test -f src/lib/stores/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/types/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/utils/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/constants/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/server/db/index.ts && echo "PASS" || echo "FAIL"
```

---

## Rollback

If verification gate fails: `git checkout -- .` to discard unstaged changes. If commit was already made: `git revert HEAD`.
