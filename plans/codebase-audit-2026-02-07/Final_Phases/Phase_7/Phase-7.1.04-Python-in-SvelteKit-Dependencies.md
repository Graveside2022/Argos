# Phase 7.1.04: Python-in-SvelteKit Dependencies

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtasks 7.1.3.1 and 7.1.3.2)
**Risk Level**: MEDIUM -- Decision required that affects system capabilities post-migration.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md, Phase-7.1.02-Source-Inventory-Verification.md
**Estimated Duration**: 20-30 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Phase 7 deletes the entire `hackrf_emitter/` directory. However, Python files also exist INSIDE the SvelteKit source tree (`src/`). These files are NOT part of `hackrf_emitter/` but depend on a Python runtime. If the migration removes Python from the system, these files will break silently.

This sub-task identifies all Python dependencies inside the SvelteKit tree, documents their impact, and records a decision for each one. Failure to address these dependencies would result in silent runtime failures in USRP sweep functionality after migration.

---

## Subtask 7.1.3.1: usrp_sweep.py Inside SvelteKit Source Tree

**CRITICAL FINDING NOT IN ORIGINAL PLAN**: A 146-line Python file exists inside the SvelteKit source:

**File**: `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py`
**Purpose**: USRP B205 Mini sweep tool that mimics hackrf_sweep output format
**Dependencies**: `numpy`, `gnuradio` (gr, uhd, fft, blocks)
**Lines**: 146

This file is NOT part of `hackrf_emitter/` but depends on Python + numpy + gnuradio. It is invoked by `auto_sweep.sh` as a fallback when the native `hackrf_sweep` binary is unavailable.

### Decision Matrix

| Option | Description                                                                         | Pros                                  | Cons                                                     |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| 1      | Keep as-is (requires Python + gnuradio to remain installed for USRP support)        | Zero code changes, USRP works         | Python runtime dependency remains on system              |
| 2      | Migrate to TypeScript (requires Node.js bindings for UHD -- none exist)             | Pure TypeScript stack                 | No UHD bindings exist; would require native addon or FFI |
| 3      | Migrate to compiled language (C++ with UHD library -- native approach)              | Fastest, no runtime dependency        | Significant development effort, outside Phase 7 scope    |
| 4      | Accept USRP sweep degradation (remove Python fallback, require gnuradio separately) | Clean separation, document limitation | USRP sweep requires separate Python + gnuradio install   |

**Recommendation**: Option 4. The USRP sweep is a secondary hardware path. Document that USRP sweep requires Python + gnuradio installed separately. Do NOT delete usrp_sweep.py as part of Phase 7.

### Verification commands

```bash
# Verify file exists and count lines
wc -l /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py

# Verify Python dependencies
grep -n "^import\|^from" /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py

# Verify it is invoked by auto_sweep.sh
grep -n "usrp_sweep" /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh

# Verify this file is NOT inside hackrf_emitter/
echo "Path starts with src/: CONFIRMED -- this is inside SvelteKit tree, not hackrf_emitter/"
```

---

## Subtask 7.1.3.2: auto_sweep.sh Dependency on sweep_bridge.py

**File**: `src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh` (77 lines)
**Line 63-64**: References `hackrf_emitter/backend/sweep_bridge.py` via relative path traversal

```bash
SWEEP_BRIDGE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../../../../../hackrf_emitter/backend/sweep_bridge.py"
if [ -f "$SWEEP_BRIDGE" ] && python3 -c "from python_hackrf import pyhackrf_sweep" 2>/dev/null; then
```

After Phase 7.7 deletes `hackrf_emitter/backend/`, this path will resolve to a nonexistent file. The `[ -f "$SWEEP_BRIDGE" ]` check will fail gracefully, so the sweep will fall through to the `hackrf_sweep` binary path. No functional breakage, but the dead reference must be cleaned up.

**Action**: In Phase 7.7 (Deletion), update `auto_sweep.sh` to remove the sweep_bridge.py fallback block.

### Verification commands

```bash
# Verify auto_sweep.sh exists and count lines
wc -l /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh

# Verify the sweep_bridge.py reference
grep -n "sweep_bridge" /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh

# Verify the fallback is guarded by file-existence check
grep -n '\[ -f.*SWEEP_BRIDGE' /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh

# Verify sweep_bridge.py currently exists in hackrf_emitter (will be deleted by Phase 7.7)
ls -la /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/sweep_bridge.py
```

---

## Verification Checklist

- [ ] usrp_sweep.py verified at `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py` (146 lines)
- [ ] usrp_sweep.py dependencies documented: numpy, gnuradio (gr, uhd, fft, blocks)
- [ ] Decision recorded: Option 4 (keep usrp_sweep.py, document separate Python requirement)
- [ ] auto_sweep.sh sweep_bridge.py reference verified at lines 63-64
- [ ] Graceful fallback confirmed: `[ -f "$SWEEP_BRIDGE" ]` guard prevents runtime failure
- [ ] Cleanup action documented for Phase 7.7: remove sweep_bridge.py fallback block from auto_sweep.sh

---

## Definition of Done

This sub-task is complete when:

1. usrp_sweep.py is documented as an out-of-scope Python dependency with a recorded decision (Option 4 recommended).
2. The auto_sweep.sh dependency on sweep_bridge.py is documented with evidence that it fails gracefully.
3. A cleanup action for Phase 7.7 is recorded: remove the dead sweep_bridge.py fallback block from auto_sweep.sh.

---

## Cross-References

- **Required by**: Phase-7.7-DELETION-CLEANUP.md (must know to clean up auto_sweep.sh sweep_bridge.py block)
- **Informed by**: Phase-7.1.02-Source-Inventory-Verification.md (sweep_bridge.py is file #14 in backend inventory)
- **Informed by**: Phase-7.1.03-Port-Architecture-Discovery.md (auto_sweep.sh reference overlaps with port discovery)
