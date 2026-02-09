# Phase 1: Delete Dead Code

**Timeline**: 1 day
**Effort**: 8 hours
**Risk**: ZERO (pure deletions, no logic changes)
**Savings**: ~31,000 lines (verified)
**Commits**: 7 sub-commits with dashboard gates

---

## Goal

Delete duplicate pages, dead code islands, unused tools - NO functionality changes. Dashboard must continue working after every sub-commit.

---

## VERIFICATION GATE (run after EVERY sub-commit)

```bash
# Gate script - save as scripts/verify-dashboard.sh
npm run build && npm run typecheck
npm run dev &
DEV_PID=$!
sleep 8
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dashboard)
HEALTH=$(curl -s http://localhost:5173/api/health 2>/dev/null)
kill $DEV_PID 2>/dev/null
if [ "$HTTP_CODE" != "200" ]; then echo "FAIL: Dashboard returned $HTTP_CODE"; exit 1; fi
echo "PASS: Dashboard OK (HTTP $HTTP_CODE)"
```

---

## 1.1 Delete All Standalone Pages Except Dashboard

**Commit**: `refactor(phase1.1): delete 20 standalone pages, keep /dashboard only`
**Verified lines**: 17,099

### Delete Old/Duplicate Landing Pages (5,641 lines)

```bash
rm src/routes/+page.svelte                          # 753 lines (verified)
rm src/routes/tactical-map-simple/+page.svelte      # 3,833 lines (verified)
rm src/routes/redesign/+page.svelte                 # 1,055 lines (verified)
```

### Delete Duplicate HackRF Spectrum Pages (4,375 lines)

```bash
rm src/routes/hackrfsweep/+page.svelte              # 1,830 lines (verified)
rm src/routes/rfsweep/+page.svelte                  # 2,245 lines (verified)
rm src/routes/hackrf/+page.svelte                   # 123 lines (verified)
rm src/routes/viewspectrum/+page.svelte             # 277 lines (verified)
rm -rf src/routes/viewspectrum/spectrum/            # 72 lines (verified, directory)
```

### Delete Standalone Tool Wrapper Pages (5,656 lines)

```bash
rm src/routes/kismet/+page.svelte                   # 744 lines (verified)
rm src/routes/kismet-dashboard/+page.svelte         # 209 lines (verified)
rm src/routes/gsm-evil/+page.svelte                 # 2,591 lines (verified)
rm src/routes/wifite/+page.svelte                   # 698 lines (verified)
rm src/routes/droneid/+page.svelte                  # 812 lines (verified)
rm src/routes/wigletotak/+page.svelte               # 286 lines (verified)
rm src/routes/bettercap/+page.svelte                # 25 lines (verified)
rm src/routes/pagermon/+page.svelte                 # 140 lines (verified)
rm src/routes/btle/+page.svelte                     # 167 lines (verified)
```

### Delete Hardware-Specific Pages (1,134 lines)

```bash
rm src/routes/rtl-433/+page.svelte                  # 1,009 lines (verified)
rm src/routes/urh/+page.svelte                      # 65 lines (verified)
rm src/routes/tempestsdr/+page.svelte               # 60 lines (verified)
```

### Delete Associated Route Files (9 lines)

```bash
rm src/routes/kismet/+page.ts                       # 9 lines (verified)
```

### Create Simple Redirect at Root (~5 lines)

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	onMount(() => goto('/dashboard'));
</script>
```

**GATE**: Run verification. Commit if passes.

---

## 1.2 Delete Dead Service Islands

**Commit**: `refactor(phase1.2): delete dead service islands`
**Verified lines**: 3,264

```bash
rm -rf src/lib/services/system/                     # 1,442 lines (verified)
rm -rf src/lib/services/hackrfsweep/                # 661 lines (verified)
rm -rf src/lib/services/tactical-map/               # 597 lines (verified)
rm -rf src/lib/server/database/                     # 70 lines (verified)
rm src/lib/server/websockets.ts                     # 163 lines (verified)
rm src/lib/server/services/kismet.service.ts        # 331 lines (verified, was claimed 340)
```

**GATE**: Run verification. Commit if passes.

---

## 1.3 Delete Stores for Deleted Pages

**Commit**: `refactor(phase1.3): delete stores for deleted pages`
**Verified lines**: 1,180

```bash
rm -rf src/lib/stores/hackrfsweep/                  # 501 lines (verified, 5 files)
rm -rf src/lib/stores/tactical-map/                 # 505 lines (verified, 6 files)
rm -rf src/lib/stores/wigletotak/                   # 174 lines (verified, 2 files)
```

**GATE**: Run verification. Commit if passes.

---

## 1.4 Delete Components for Deleted Pages

**Commit**: `refactor(phase1.4): delete components for deleted pages`
**Verified lines**: 2,329 (CORRECTED from original 1,761)

```bash
rm -rf src/lib/components/tactical-map/             # 961 lines (verified, was claimed 735)
rm -rf src/lib/components/wigletotak/               # 1,014 lines (verified, was claimed 790)
rm -rf src/lib/components/bettercap/                # 236 lines (verified)
rm -rf src/lib/components/hardware/                 # 118 lines (verified)
```

**NOTE**: tactical-map/ has 6 files totaling 961 (not 735). wigletotak/ has 10 files totaling 1,014 (not 790). Both were undercounted in original audit by ~30%.

**GATE**: Run verification. Commit if passes.

---

## 1.5 Delete Example/Dead Code Files

**Commit**: `refactor(phase1.5): delete example and dead code files`
**Verified lines**: 558

```bash
rm src/lib/services/websocket/example-usage.ts      # 281 lines (verified)
rm src/lib/services/websocket/test-connection.ts    # 108 lines (verified)
rm src/lib/services/api/example-usage.ts            # 169 lines (verified)
```

**GATE**: Run verification. Commit if passes.

---

## 1.6 Delete CSS for Deleted Pages

**Commit**: `refactor(phase1.6): delete CSS for deleted pages`
**Verified lines**: 3,701

```bash
rm src/lib/styles/hackrf/monochrome-theme.css       # 567 lines (verified)
rm src/lib/styles/hackrf/saasfly-buttons.css        # 452 lines (verified)
rm src/lib/styles/hackrf/geometric-backgrounds.css  # 385 lines (verified)
rm src/lib/styles/hackrf/custom-components-exact.css # 2,083 lines (verified)
rm -rf src/styles/hackrf/                           # 214 lines (verified, 4 files)
```

**GATE**: Run verification. Commit if passes.

---

## 1.7 Delete Duplicate/Audit Scripts

**Commit**: `refactor(phase1.7): delete duplicate and one-time audit scripts`
**Verified lines**: 2,630

```bash
# Delete exact duplicate
rm scripts/testing/verify-deployment.sh             # 688 lines (verified)

# Delete maintenance duplicates
rm -rf scripts/maintenance/                         # 487 lines (verified, 4 files)

# Delete infrastructure scripts
rm -rf scripts/infrastructure/                      # 247 lines (verified, 3 files)

# Delete one-time audit/compare scripts (4 files, 1,208 lines verified)
rm scripts/compare-audit-to-plan.py                 # 229 lines (verified)
rm scripts/compare-audit-v2.py                      # 243 lines (verified)
rm scripts/audit-function-sizes.py                  # 399 lines (verified)
rm scripts/audit-function-sizes-v2.py               # 337 lines (verified)
```

**NOTE**: Original plan claimed ~979 for audit scripts. Actual is 1,208 (4 files, not 2 groups).

**GATE**: Run verification. Commit if passes.

---

## Phase 1 Verified Totals

| Section              | Claimed Lines | Verified Lines | Delta    |
| -------------------- | ------------- | -------------- | -------- |
| 1.1 Standalone Pages | 16,650        | 17,099         | +449     |
| 1.2 Dead Services    | 2,610         | 3,264          | +654     |
| 1.3 Stores           | 1,180         | 1,180          | 0        |
| 1.4 Components       | 1,761         | 2,329          | +568     |
| 1.5 Example Code     | 450           | 558            | +108     |
| 1.6 CSS              | 3,701         | 3,701          | 0        |
| 1.7 Scripts          | 3,479         | 2,630          | -849     |
| **TOTAL**            | **~29,831**   | **~30,761**    | **+930** |

---

## Success Criteria

- [ ] 7 commits made, each with passing verification gate
- [ ] All 20 standalone pages deleted except `/dashboard`
- [ ] Root page redirects to `/dashboard`
- [ ] Dead service islands deleted
- [ ] Stores for deleted pages removed
- [ ] Components for deleted pages removed
- [ ] Example/test files deleted
- [ ] CSS for deleted pages removed
- [ ] Duplicate scripts deleted
- [ ] `npm run build && npm run typecheck` passes
- [ ] `curl http://localhost:5173/dashboard` returns 200
- [ ] `curl http://localhost:5173/api/health` returns ok

---

## Rollback

Each sub-step has its own commit. If a gate fails:

```bash
git revert HEAD  # Revert the failing commit
# Investigate what broke, fix, re-commit
```

**Risk Assessment**: ZERO RISK - Pure deletions of unused code. Dashboard is independent. Each sub-step committed separately for safe rollback.
