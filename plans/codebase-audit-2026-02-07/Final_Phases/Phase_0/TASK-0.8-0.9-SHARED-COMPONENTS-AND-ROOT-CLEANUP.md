# Tasks 0.8 + 0.9: Shared Component Directory and Root File Cleanup

**Execution Order**: Step 7 (FINAL -- after all other tasks)
**Prerequisites**: Tasks 0.2, 0.3, 0.4, 0.6, 0.5, 0.7 ALL COMPLETE.
**Blocks**: Nothing. This is the last step of Phase 0.2.
**Risk Level**: LOW -- File moves and barrel creation only.
**Commit Message**: `chore: create shared components, clean root files`

---

## Task 0.8: Create Shared Component Directory

### Rationale

Cross-domain components should live in a `shared/` directory to signal their reusability and prevent domain directories from accumulating unrelated code.

### Current State

`src/lib/components/shared/` may already exist from Task 0.2.4 (HardwareConflictModal was moved there).

### Actions

Move cross-domain reusable components:

| Component                      | Current Location        | Reason                                          |
| ------------------------------ | ----------------------- | ----------------------------------------------- |
| `HardwareConflictModal.svelte` | `components/shared/`    | Already moved in Task 0.2.4                     |
| `CompanionLauncher.svelte`     | `components/companion/` | Single-file domain directory, utility component |

**Create**: `src/lib/components/shared/index.ts` barrel export:

```typescript
export { default as HardwareConflictModal } from './HardwareConflictModal.svelte';
export { default as CompanionLauncher } from './CompanionLauncher.svelte';
```

**After moves**:

- If `components/companion/` is empty, delete it
- If `components/navigation/` is empty (SpectrumLink was deleted in Phase 0.1), delete it

### Task 0.8 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
test -f src/lib/components/shared/index.ts && echo "PASS" || echo "FAIL"
```

---

## Task 0.9: Root File Cleanup

### Rationale

Build tools and generated outputs should not clutter the project root. A clean root directory is the first thing a reviewer sees.

### Subtask 0.9.1: Move vite-plugin-terminal.ts

**Current**: `vite-plugin-terminal.ts` (382 lines, 10,551 bytes) in project root.
**Target**: `config/vite-plugin-terminal.ts` -- it is a build tool configuration, belongs with other config files.

```bash
git mv vite-plugin-terminal.ts config/vite-plugin-terminal.ts
```

**Update**: `vite.config.ts` import path from `./vite-plugin-terminal` to `./config/vite-plugin-terminal`.

### Subtask 0.9.2: Handle Generated Files in Root

| File                           | Size (bytes) | Action                                     |
| ------------------------------ | ------------ | ------------------------------------------ |
| `css-integrity-baselines.json` | 746          | Already in `.gitignore`. No action needed. |
| `css-integrity-report.json`    | 941          | Already in `.gitignore`. No action needed. |

### Task 0.9 Verification Gate

```bash
npm run typecheck   # Must pass
npm run build       # Must pass
test -f vite-plugin-terminal.ts && echo "FAIL: still in root" || echo "PASS"
test -f config/vite-plugin-terminal.ts && echo "PASS" || echo "FAIL"
```

---

## Phase 0.2 Final Verification Checklist

**Run this ONLY after Tasks 0.8 + 0.9 are committed. Zero-tolerance -- ALL must pass:**

```bash
# 1. No snake_case .ts files anywhere in src/lib/
find src/lib/ -name "*_*.ts" -not -name "*.d.ts" -not -path "*/node_modules/*" | wc -l
# Must be 0

# 2. No PascalCase .ts files in services/
find src/lib/services -name "[A-Z]*.ts" -not -name "*.d.ts" | wc -l
# Must be 0

# 3. No camelCase .ts files in src/lib/
find src/lib/ -name "*.ts" -not -name "*.d.ts" -not -name "index.ts" -not -path "*/node_modules/*" | \
  xargs -I {} basename {} | grep '[a-z][A-Z]' | wc -l
# Must be 0

# 4. No server imports from stores
grep -rn "from '\$lib/stores" src/lib/server/ --include="*.ts" | wc -l
# Must be 0

# 5. No stores imports from server
grep -rn "from '\$lib/server" src/lib/stores/ --include="*.ts" | wc -l
# Must be 0

# 6. No service imports from routes/
grep -rn "from.*routes/" src/lib/services/ --include="*.ts" | wc -l
# Must be 0

# 7. No API routes importing from stores
grep -rn "from '\$lib/stores" src/routes/api/ --include="*.ts" | wc -l
# Must be 0

# 8. No relative cross-directory imports in lib/
grep -rn "from '\.\.\/" src/lib/ --include="*.ts" | wc -l
# Target: 0

# 9. No business logic files in routes/ (only +prefixed files)
find src/routes -name "*.ts" -not -name "+*" -not -name "*.d.ts" | wc -l
# Must be 0

# 10. Barrel exports exist for top-level modules
test -f src/lib/stores/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/types/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/utils/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/constants/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/server/db/index.ts && echo "PASS" || echo "FAIL"
test -f src/lib/components/shared/index.ts && echo "PASS" || echo "FAIL"

# 11. Boundary violations documented
test -f src/lib/BOUNDARY-VIOLATIONS.md && echo "PASS" || echo "FAIL"

# 12. Redundant directories removed
test -d src/lib/services/gsm/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/monitoring/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/recovery/ && echo "FAIL" || echo "PASS"
test -d src/lib/services/streaming/ && echo "FAIL" || echo "PASS"
test -d scripts/development/ && echo "FAIL" || echo "PASS"
test -d scripts/deployment/ && echo "FAIL" || echo "PASS"

# 13. Vite plugin moved from root
test -f vite-plugin-terminal.ts && echo "FAIL" || echo "PASS"
test -f config/vite-plugin-terminal.ts && echo "PASS" || echo "FAIL"

# 14. Full build pipeline
npm run typecheck
npm run build
npm run lint
npm run test:unit
```

---

## Definition of Done for Phase 0.2

1. All 106 naming violations corrected (kebab-case enforced across all .ts files)
2. All 5 misplaced files relocated from `routes/` to `lib/` (or deleted if dead)
3. All 30 type-only boundary violations resolved (types extracted to `$lib/types/`)
4. All 33 value boundary violations DOCUMENTED in `BOUNDARY-VIOLATIONS.md`
5. Stores-to-services circular dependency fixed (lazy import in usrp.ts)
6. All single-file directories consolidated or justified
7. Barrel exports exist for every module directory
8. Type system consolidated to `$lib/types/` as single source of truth
9. 100% `$lib/` import aliases (zero cross-directory relative imports)
10. Shared component directory established
11. Root directory clean (no misplaced build tools)
12. All commits follow conventional commit format
13. `npm run typecheck && npm run build && npm run lint && npm run test:unit` all pass
14. Zero non-SvelteKit files remain in `src/routes/` (only `+`-prefixed files)

---

## Rollback

If verification gate fails: `git checkout -- .` to discard unstaged changes. If commit was already made: `git revert HEAD`. The `v-pre-consolidation` tag from Phase 0.1 remains the hard recovery point.
