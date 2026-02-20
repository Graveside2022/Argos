# Quickstart: 008 Codebase Hardening

## Prerequisites

- Node.js 22+ with npm
- On branch `008-codebase-hardening`
- `.env` file with `ARGOS_API_KEY` set (32+ chars)

## Verify Current State

```bash
# Confirm branch
git branch --show-current  # → 008-codebase-hardening

# Run baseline checks
npx tsc --noEmit           # 0 errors expected
npm run test:unit          # 163+ tests pass
npm run test:security      # 151 tests pass (36 active, rest skipped)
```

## Execution Order

1. **Workstream A** (shell call migration): Tasks A0→A7 in order
2. **Workstream B Tier 1** (file decomposition): Tasks B1→B4
3. **Workstream C** (convention fixes): Tasks C1→C2

## Key Reference Files

- **Safe execFile pattern**: `src/routes/api/system/info/+server.ts`
- **Input validators**: `src/lib/server/security/input-sanitizer.ts`
- **Existing security tests**: `tests/security/injection.test.ts`, `tests/security/property-based.test.ts`

## Verification After Each Task

```bash
npx tsc --noEmit && npm run test:unit
```

## Final Verification (After All Tasks)

```bash
npx tsc --noEmit
npm run test:unit
npm run test:security
npm run build
grep -r "promisify(exec)" src/     # Should return 0 matches
```
