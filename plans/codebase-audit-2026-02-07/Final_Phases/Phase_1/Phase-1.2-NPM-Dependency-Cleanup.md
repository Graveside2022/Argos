# Phase 1.2: NPM Dependency Cleanup

**Task ID**: 1.2
**Risk Level**: ZERO (removal) / LOW (section move)
**Produces Git Commit**: Yes
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: CERT MEM51-CPP (minimize resource footprint), OWASP A06:2021 (vulnerable/outdated components)
**Audit Findings Resolved**: CE-1, CE-2, CE-3, FE-4, FE-5
**Commit Message**: `cleanup(phase1.2): remove 3 unused deps, move 8 misplaced deps to devDependencies`

---

## Purpose

Remove 3 confirmed-unused devDependencies and move 8 misplaced packages from `dependencies` to `devDependencies`. This reduces the production install footprint and ensures correct package categorization per npm best practices.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] `npm install` has been run and `node_modules/` is current
- [ ] No other npm operations are in progress

---

## Subtask 1.2.1: Remove Confirmed Unused Dev Dependencies (3 packages)

These packages have **zero imports** across `src/`, `tests/`, and `scripts/`. Each removal is verified independently with a build + test gate.

### Package Inventory

| #   | Package              | package.json Section | Line | Evidence of Non-Usage                                             |
| --- | -------------------- | -------------------- | ---- | ----------------------------------------------------------------- |
| 1   | `db-migrate`         | devDependencies      | 74   | `grep -rn "db-migrate" src/ tests/ scripts/` = 0 results          |
| 2   | `db-migrate-sqlite3` | devDependencies      | 75   | `grep -rn "db-migrate-sqlite3" src/ tests/ scripts/` = 0 results  |
| 3   | `terser`             | devDependencies      | 92   | `grep -rn "terser" vite.config.ts` = 0 results; Vite uses esbuild |

### CRITICAL EXCLUSION: pngjs

**DO NOT REMOVE `pngjs`**. It is actively imported in 4 locations:

| File                                        | Line | Import                                        |
| ------------------------------------------- | ---- | --------------------------------------------- |
| `tests/helpers/visual-helpers.ts`           | 3    | `import { PNG } from 'pngjs'`                 |
| `tests/helpers/visual-helpers.ts`           | 4    | `import type { PNG as PNGType } from 'pngjs'` |
| `tests/visual/pi-visual-regression.test.ts` | 4    | `import { PNG } from 'pngjs'`                 |
| `tests/visual/visual-regression.test.ts`    | 4    | `import { PNG } from 'pngjs'`                 |

Removing `pngjs` would break `npm run test:visual`. It MUST remain.

### Execution (Sequential -- One Package at a Time)

**Rationale for sequential execution**: If a build or test failure occurs, the last-removed package is immediately identifiable as the cause. Batch removal obscures root cause analysis.

```bash
# Package 1: db-migrate
npm uninstall db-migrate
npm run build && npm run test:unit
# HALT if fail: npm install -D db-migrate && STOP -- investigate

# Package 2: db-migrate-sqlite3
npm uninstall db-migrate-sqlite3
npm run build && npm run test:unit
# HALT if fail: npm install -D db-migrate-sqlite3 && STOP -- investigate

# Package 3: terser
npm uninstall terser
npm run build && npm run test:unit
# HALT if fail: npm install -D terser && STOP -- investigate
```

### Post-Removal Verification

```bash
# Verify packages are removed
npm ls db-migrate 2>&1 | grep -c "empty"
npm ls db-migrate-sqlite3 2>&1 | grep -c "empty"
npm ls terser 2>&1 | grep -c "empty"
# Expected: each returns 1

# Verify pngjs is still present (safety check)
npm ls pngjs 2>&1 | grep "pngjs"
# Expected: pngjs@7.x.x listed
```

---

## Subtask 1.2.2: Move Misplaced Dependencies (8 packages: dependencies -> devDependencies)

These packages are in the `dependencies` section but are build-time, type-time, or lint-time only. They do not need to be present in a production `npm ci --production` install.

### Package Inventory

| #   | Package                        | Line in package.json | Reason for devDependency          |
| --- | ------------------------------ | -------------------- | --------------------------------- |
| 1   | `@eslint/js`                   | 105                  | Linting tool, not runtime         |
| 2   | `@types/better-sqlite3`        | 108                  | TypeScript type declarations only |
| 3   | `@types/cytoscape`             | 109                  | TypeScript type declarations only |
| 4   | `@types/leaflet`               | 110                  | TypeScript type declarations only |
| 5   | `@types/leaflet.markercluster` | 111                  | TypeScript type declarations only |
| 6   | `autoprefixer`                 | 115                  | PostCSS build tool, not runtime   |
| 7   | `globals`                      | 123                  | ESLint helper, not runtime        |
| 8   | `postcss`                      | 130                  | CSS build tool, not runtime       |

### Execution (Batch -- Safe Because Section Move, Not Removal)

```bash
# Remove from dependencies
npm uninstall @eslint/js @types/better-sqlite3 @types/cytoscape @types/leaflet @types/leaflet.markercluster autoprefixer globals postcss

# Re-add as devDependencies
npm install -D @eslint/js @types/better-sqlite3 @types/cytoscape @types/leaflet @types/leaflet.markercluster autoprefixer globals postcss

# Verify build and tests
npm run build && npm run test:unit
```

**HALT condition**: If build or tests fail after the move, this indicates a production runtime dependency was incorrectly categorized. Restore by moving the failing package back to dependencies:

```bash
npm uninstall <package>
npm install <package>
```

### Post-Move Verification

```bash
node -e "
const p=require('./package.json');
const d=p.dependencies||{};
const dd=p.devDependencies||{};
const check=['@eslint/js','@types/better-sqlite3','@types/cytoscape','@types/leaflet','@types/leaflet.markercluster','autoprefixer','globals','postcss'];
let fail=0;
check.forEach(k=>{
  if(d[k]){console.log('FAIL:',k,'still in dependencies');fail++}
  else if(!dd[k]){console.log('FAIL:',k,'not found in devDependencies');fail++}
  else{console.log('PASS:',k,'in devDependencies')}
});
process.exit(fail);
"
# Expected: all PASS
```

---

## Subtask 1.2.3: Reserved Packages Documentation (NO ACTION -- Reference Only)

The following packages are in `dependencies` with zero current imports but are reserved for planned features. They MUST NOT be removed without explicit user approval.

### Verified ACTIVE (Do Not Touch)

| Package              | Line | Imported In                                              | Status |
| -------------------- | ---- | -------------------------------------------------------- | ------ |
| `maplibre-gl`        | 127  | `src/lib/components/dashboard/DashboardMap.svelte:20-21` | ACTIVE |
| `svelte-maplibre-gl` | 131  | `src/lib/components/dashboard/DashboardMap.svelte:10-19` | ACTIVE |

### Reserved for Future Work (Do Not Remove)

| Package                      | Line | Reserved For                |
| ---------------------------- | ---- | --------------------------- |
| `@ag-ui/client`              | 100  | Agent UI upgrade            |
| `@ag-ui/core`                | 101  | Agent UI upgrade            |
| `@ag-ui/mcp-apps-middleware` | 102  | Agent UI upgrade            |
| `@deck.gl/core`              | 103  | 3D tactical visualization   |
| `@deck.gl/layers`            | 104  | 3D tactical visualization   |
| `deck.gl`                    | 119  | 3D tactical visualization   |
| `cytoscape`                  | 116  | Network graph visualization |
| `cytoscape-cola`             | 117  | Network graph visualization |
| `cytoscape-dagre`            | 118  | Network graph visualization |
| `eventsource`                | 121  | SSE streaming for agent     |
| `eventsource-parser`         | 122  | SSE streaming for agent     |
| `node-fetch`                 | 129  | Server-side HTTP            |
| `ts-interface-checker`       | 132  | Runtime type validation     |

**Notes**:

- `@deck.gl/mesh-layers` is NOT in package.json. Do not reference it.
- `@anthropic-ai/sdk` is NOT in package.json. The codebase uses direct `fetch()` calls to the Anthropic API.

**POLICY**: If any reserved package triggers HIGH or CRITICAL severity in `npm audit`, escalate to the user for a keep/remove decision.

---

## Subtask 1.2.4: NPM Security Audit

```bash
npm audit --audit-level=high
```

### Triage Protocol

| Condition                                             | Action                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Vulnerable package is in removal list (Subtask 1.2.1) | Proceed with removal (already planned)                      |
| Direct dependency with available patch                | `npm audit fix`                                             |
| Transitive dependency with no fix                     | Document in `KNOWN-VULNERABILITIES.md` with risk assessment |
| Reserved package with HIGH/CRITICAL                   | Escalate to user for keep/remove decision                   |

---

## Subtask 1.2.5: Final Verification

```bash
# 1. Removed packages are gone
for pkg in db-migrate db-migrate-sqlite3 terser; do
    npm ls "$pkg" 2>&1 | grep -q "empty" && echo "PASS: $pkg removed" || echo "CHECK: $pkg"
done

# 2. Moved packages are in devDependencies (not dependencies)
node -e "
const p=require('./package.json');
const d=p.dependencies||{};
['@eslint/js','@types/better-sqlite3','@types/cytoscape','@types/leaflet','@types/leaflet.markercluster','autoprefixer','globals','postcss'].forEach(k => {
  if(d[k]) console.log('FAIL: '+k+' still in dependencies');
  else console.log('PASS: '+k);
});
"
# Expected: all PASS

# 3. Build and tests pass
npm run typecheck && npm run build && npm run test:unit
# Expected: all exit 0

# 4. pngjs still present (safety check)
npm ls pngjs 2>&1 | grep "pngjs"
# Expected: pngjs@7.x.x listed

# 5. package-lock.json updated
test -f package-lock.json && echo "PASS: lockfile exists" || echo "FAIL: lockfile missing"
```

---

## Rollback Procedure

```bash
git reset --soft HEAD~1 && npm install
```

Must run `npm install` after reverting `package.json` to restore `node_modules` to pre-task state.

## Risk Assessment

| Risk                              | Level | Mitigation                                                           |
| --------------------------------- | ----- | -------------------------------------------------------------------- |
| Removing an actually-used package | ZERO  | Each verified with zero imports; sequential removal with build gate  |
| Breaking production install       | LOW   | Run `npm run build` after dep section move                           |
| Incorrectly moving a runtime dep  | LOW   | Build + test verification catches false devDependency classification |
| Removing pngjs by accident        | ZERO  | Explicit exclusion with 4 import locations documented                |

## Completion Criteria

- [ ] 3 unused devDependencies removed (db-migrate, db-migrate-sqlite3, terser)
- [ ] 8 packages moved from dependencies to devDependencies
- [ ] pngjs confirmed still installed
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:unit` exits 0
- [ ] `npm audit` reviewed (no unaddressed HIGH/CRITICAL)
- [ ] Git commit created with correct message format
