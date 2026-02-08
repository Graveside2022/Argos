# Phase 4.1.7: Remove Deprecated Landing Page

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), DoD STIG V-222602 (no unused code), CERT MSC12-C (detect and remove dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity                |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                                          |
| **Task ID**            | 4.1.7                                                                                 |
| **Title**              | Remove Deprecated Landing Page (`/` route)                                            |
| **Status**             | PLANNED                                                                               |
| **Risk Level**         | LOW -- page is superseded by `/dashboard`; self-contained with zero component imports |
| **Estimated Duration** | 10 minutes                                                                            |
| **Dependencies**       | `/dashboard` route confirmed functional at http://100.120.210.5:5173/dashboard        |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                                          |
| **Commit Message**     | `refactor: remove deprecated landing page, redirect / to /dashboard (753 lines)`      |

---

## 1. Objective

Remove the old card-based landing page at `src/routes/+page.svelte` (753 lines) and redirect the `/` route to `/dashboard`, which is now the primary interface. Update all 14 back-navigation links across the codebase that point to `href="/"`.

---

## 2. Rationale

The `/dashboard` page provides full navigation to all tools (Kismet, GSM Evil, RF Sweep, etc.) and is the active interface used in field deployments. The old `/` landing page is a static card-based navigation hub that duplicates this functionality. Retaining it:

- Wastes 753 lines of unmaintained code
- Creates user confusion (two entry points)
- Appears in Phase 5.4.9 as a Tier 2 decomposition target (item 5.4.2-08) -- deleting it here eliminates that work entirely

---

## 3. Current State

| Metric                     | Value                             | Verification                                     |
| -------------------------- | --------------------------------- | ------------------------------------------------ |
| Landing page size          | 753 lines                         | `wc -l src/routes/+page.svelte`                  |
| Component imports          | 0 (fully self-contained)          | `grep -c 'import.*from' src/routes/+page.svelte` |
| External importers         | 0 (SvelteKit route, not imported) | `grep -r '+page' src/ \| grep -v node_modules`   |
| Back-links pointing to `/` | 14 files                          | See Section 5                                    |
| Dashboard status           | FUNCTIONAL                        | http://100.120.210.5:5173/dashboard              |

---

## 4. Implementation Steps

### Step 1: Delete the old landing page

```bash
git rm src/routes/+page.svelte
```

### Step 2: Create redirect from `/` to `/dashboard`

Create a minimal `src/routes/+page.server.ts` that redirects:

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(301, '/dashboard');
};
```

### Step 3: Update back-navigation links

The following 14 files contain `href="/"` or `goto('/')` that should point to `/dashboard`:

| #   | File                                            | Current     | Change To            |
| --- | ----------------------------------------------- | ----------- | -------------------- |
| 1   | `src/routes/bettercap/+page.svelte`             | `href="/"`  | `href="/dashboard"`  |
| 2   | `src/routes/btle/+page.svelte`                  | `href="/"`  | `href="/dashboard"`  |
| 3   | `src/routes/droneid/+page.svelte`               | `href="/"`  | `href="/dashboard"`  |
| 4   | `src/routes/gsm-evil/+page.svelte`              | `href="/"`  | `href="/dashboard"`  |
| 5   | `src/routes/hackrfsweep/+page.svelte`           | `href="/"`  | `href="/dashboard"`  |
| 6   | `src/routes/kismet-dashboard/+page.svelte`      | `href="/"`  | `href="/dashboard"`  |
| 7   | `src/routes/kismet/+page.svelte`                | `href="/"`  | `href="/dashboard"`  |
| 8   | `src/routes/pagermon/+page.svelte`              | `href="/"`  | `href="/dashboard"`  |
| 9   | `src/routes/tempestsdr/+page.svelte`            | `href="/"`  | `href="/dashboard"`  |
| 10  | `src/routes/urh/+page.svelte`                   | `href="/"`  | `href="/dashboard"`  |
| 11  | `src/routes/viewspectrum/+page.svelte`          | `href="/"`  | `href="/dashboard"`  |
| 12  | `src/routes/wifite/+page.svelte`                | `href="/"`  | `href="/dashboard"`  |
| 13  | `src/routes/wigletotak/+page.svelte`            | `href="/"`  | `href="/dashboard"`  |
| 14  | `src/lib/components/hackrf/HackRFHeader.svelte` | `href="/"`  | `href="/dashboard"`  |
| 15  | `src/routes/rtl-433/+page.svelte`               | `goto('/')` | `goto('/dashboard')` |

**Note**: The 301 redirect in Step 2 provides backward compatibility for any links not yet updated, but all known references should be updated explicitly.

---

## 5. Verification Commands

```bash
# Verify old landing page is deleted
test ! -f src/routes/+page.svelte && echo "PASS: deleted" || echo "FAIL: still exists"

# Verify redirect exists
cat src/routes/+page.server.ts

# Verify no remaining href="/" back-links (expect 0 matches in route/component files)
grep -rn 'href="/"' src/routes/ src/lib/components/ --include="*.svelte" | grep -v node_modules
# Expected: 0 matches

# Verify no remaining goto('/') calls
grep -rn "goto('/')" src/routes/ --include="*.svelte"
# Expected: 0 matches

# Verify redirect works
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:5173/
# Expected: 301 http://localhost:5173/dashboard

# Verify TypeScript compilation
npx tsc --noEmit 2>&1 | tail -5

# Verify build
npm run build 2>&1 | tail -5
```

---

## 6. Cross-Phase Impact

| Phase    | Document                                                 | Item              | Update Required                                        |
| -------- | -------------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| 5.4.9    | Phase-5.4.9-Tier2-Components-Services-Decomposition.md   | 5.4.2-08          | Mark as **EXCLUDED -- file deleted in Phase 4.1.7**    |
| 5.4.0    | Phase-5.4.0-File-Size-Assessment-Standards-Deductions.md | Tier 2 count      | Update from 23 to 22 files, LOC from 15,264 to ~14,511 |
| 5 Master | PHASE-5-MASTER-INDEX.md                                  | Aggregate metrics | Update Tier 2 totals                                   |

---

## 7. Risk Assessment

| Risk                           | Severity | Likelihood | Mitigation                                    |
| ------------------------------ | -------- | ---------- | --------------------------------------------- |
| Users bookmarked old `/` URL   | LOW      | MEDIUM     | 301 redirect preserves access                 |
| Missed `href="/"` link         | LOW      | LOW        | Redirect catches any missed links             |
| Dashboard not fully functional | HIGH     | LOW        | Already verified functional at deployment URL |

---

## 8. Rollback Strategy

```bash
git revert HEAD  # Restores +page.svelte and all href changes
```

---

## 9. Standards Compliance

| Standard          | Rule                              | Application                           |
| ----------------- | --------------------------------- | ------------------------------------- |
| NASA/JPL Rule 31  | No dead code in delivered product | Superseded page removed               |
| DoD STIG V-222602 | No unused code                    | Deprecated UI eliminated              |
| CERT MSC12-C      | Detect and remove dead code       | Verified no importers, self-contained |

---

_Phase 4.1.7 -- Remove Deprecated Landing Page_
_Document version: 1.0_
_Classification: UNCLASSIFIED // FOUO_
