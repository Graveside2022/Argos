# Quickstart: Performance Optimization & Complexity Reduction

**Feature**: 014-performance-optimization | **Date**: 2026-02-23

## Prerequisites

- Node.js with `--max-old-space-size=2048` (set in dev script)
- Argos dev environment functional (`npm run dev` works)
- On branch `014-performance-optimization`

## Verification Commands

After each implementation step, run the appropriate verification:

```bash
# After dead code deletion batches (Stream A)
npm run build

# After any refactoring (Stream B)
npm run build
npx vitest run --no-coverage <modified-file>.test.ts

# After performance optimization (Stream C)
npm run build
npx vitest run --no-coverage src/lib/stores/
npx vitest run --no-coverage tests/performance/

# After ESLint guardrails (Stream D)
npm run lint

# Full verification (after all streams complete)
npm run build && npm run lint && npx vitest run --no-coverage src/lib/stores/ tests/performance/ tests/integration/
```

## Key Safety Rules

1. **Never delete without grep**: `grep -rn "from.*<module>" src/ tests/` must return 0 results
2. **Never batch without build**: `npm run build` after every deletion batch
3. **Never refactor without tests**: Run the file's tests before AND after changes
4. **If tests change**: The refactor altered behavior — revert and reassess

## What NOT to Do

- Do NOT refactor the 21 oversized functions (they get `eslint-disable` annotations only)
- Do NOT delete anything in `src/lib/hackrf/sweep-manager/` — it powers live API routes
- Do NOT run `npm run test:unit` (full suite) while Antigravity/VS Code is running (OOM risk)
- Do NOT install packages without user approval (`eslint-plugin-sonarjs` needs approval)
