# Argos Code Quality Improvement Plans

This directory contains comprehensive, phased plans for two major code quality improvements to the Argos codebase.

## Overview

### 1. Empty Catch Block Fixes (4 weeks, 78 fixes)

**Status:** Ready for implementation
**Risk Level:** CRITICAL → LOW (prioritized by risk)
**Files:** `empty-catch-*.md`

Fix all 78 empty catch blocks identified in the codebase audit with proper error logging and operational visibility.

**Files:**

- `empty-catch-overview.md` - Executive summary, approach, success criteria
- `empty-catch-phase-1.md` - CRITICAL hardware/WebSocket/database fixes (Week 1-2)
- `empty-catch-phase-2.md` - MEDIUM process management fixes (Week 3)
- `empty-catch-phase-3.md` - LOW utility/UI fixes (Week 4)

### 2. Svelte 4 to 5 Migration (6-10 weeks, 116 components)

**Status:** Ready for implementation
**Complexity:** Simple → Complex (phased progression)
**Files:** `svelte5-*.md`

Migrate all 116 Svelte components from Svelte 4 syntax to Svelte 5 runes with zero functionality breakage.

**Files:**

- `svelte5-overview.md` - Executive summary, timeline, success criteria
- `svelte5-patterns.md` - Migration pattern reference guide
- `svelte5-phase-0.md` - Foundation & proof of concept (3-5 days)
- `svelte5-phase-1.md` - Simple components (5-7 days)
- `svelte5-phase-2.md` - Medium complexity dashboard/map (7-10 days)
- `svelte5-phase-3.md` - Complex hardware integration (10-14 days)
- `svelte5-phase-4.md` - Route pages & forms (5-7 days)
- `svelte5-phase-5.md` - Final cleanup & optimization (3-5 days)

## Execution Order

### Recommended: Sequential

1. **Complete Empty Catch Block Fixes FIRST** (4 weeks)
    - Establishes operational visibility
    - Critical for hardware debugging
    - Lower risk of breaking functionality

2. **Then Svelte 5 Migration** (6-10 weeks)
    - Benefits from improved error logging
    - Clean codebase foundation
    - Can validate migration with proper error tracking

### Alternative: Parallel (with caution)

- **Team of 2+**: One person handles catch blocks, another starts Svelte migration Phase 0-1
- **Branch strategy**:
    - `fix/empty-catch-blocks` branch for error handling fixes
    - `feature/svelte5-migration` branch for component migration
    - Merge catch block fixes first, then rebase Svelte branch

## Key Constraints

Both plans adhere to the critical requirement:

> **NO CODE MUST BE BROKEN, CORRUPTED, OR BROKEN IN ANY WAY**

Every phase includes:

- Detailed step-by-step instructions
- Before/after code examples
- Verification steps
- Rollback strategy
- Git checkpoint guidance

## Success Metrics

### Empty Catch Blocks

- ✅ All 78 catch blocks have proper logging
- ✅ Zero TypeScript errors
- ✅ All existing tests pass
- ✅ Log volume < 100 entries/minute under normal operation
- ✅ Operators can diagnose hardware issues from logs

### Svelte 5 Migration

- ✅ All 116 components migrated to Svelte 5 runes
- ✅ Zero `export let`, `$:`, or manual subscriptions remain
- ✅ All functionality preserved
- ✅ Performance benchmarks met or exceeded
- ✅ Component tests added for all migrated components

## Getting Started

### For Empty Catch Block Fixes:

```bash
cd /home/kali/Documents/Argos/Argos
git checkout -b fix/empty-catch-blocks
git tag pre-empty-catch-fixes

# Read overview
cat plans/empty-catch-overview.md

# Start with Phase 1 (CRITICAL)
cat plans/empty-catch-phase-1.md

# Follow line-by-line instructions
```

### For Svelte 5 Migration:

```bash
cd /home/kali/Documents/Argos/Argos
git checkout -b feature/svelte5-migration
git tag pre-svelte5-migration

# Read overview and patterns
cat plans/svelte5-overview.md
cat plans/svelte5-patterns.md

# Start with Phase 0 (Foundation)
cat plans/svelte5-phase-0.md

# Follow detailed migration steps
```

## Support & Resources

### Error Logging Strategy

- **ERROR**: Unexpected failures during normal operation
- **WARNING**: Expected intermittent failures with fallbacks
- **INFO**: Expected operational events
- **Rate Limiting**: 60 messages/minute (configured in logger.ts)

### Migration Tools

- **Verification Script**: `scripts/verify-migration.sh`
- **Test Template**: `tests/unit/components/dashboard/DashboardMap.test.ts`
- **Checklist**: `.claude/migration-checklist.md`
- **Pattern Reference**: `docs/svelte5-migration-patterns.md`

## Questions?

Both plans include:

- Comprehensive troubleshooting sections
- Common pitfalls and solutions
- Performance optimization guidance
- Testing strategies

Refer to phase-specific markdown files for detailed implementation guidance.

---

**Generated:** $(date)
**Author:** Claude Code (Anthropic)
**Based On:** Comprehensive codebase audit (78 empty catch blocks, 116 Svelte components analyzed)
