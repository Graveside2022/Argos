# Quickstart: Constitution Compliance Remediation

**Branch**: `013-constitution-compliance`

## Prerequisites

- Node.js 20+ with npm
- Git
- Access to the Argos repository

## Verification Commands

```bash
# Check for oversized functions (should output nothing when compliant)
find src/ -name '*.ts' -not -name '*.test.ts' -not -name '*.d.ts' | \
  xargs grep -l 'function\|=>' | head -20

# Check for oversized files (should output nothing when compliant)
find src/ -name '*.ts' -o -name '*.svelte' | \
  grep -v node_modules | grep -v '.test.ts' | grep -v '.d.ts' | \
  xargs wc -l | sort -rn | awk '$1 > 300 {print}'

# Check for PascalCase files (should output nothing when compliant)
find src/ -name '*.ts' -not -name '*.d.ts' | grep '[A-Z][a-z]*[A-Z]'

# Check for any types (should output nothing when compliant)
grep -rn ': any\b\|as any\b' src/ --include='*.ts' | \
  grep -v '.test.ts' | grep -v '.d.ts' | grep -v 'node_modules'

# Full verification suite
npm run build          # Must pass
npx tsc --noEmit       # Must pass
npm run lint           # Must pass
npm run test:unit      # Must pass (190/190)
npm run test:all       # Must pass (0 failures)
```

## Development Workflow

1. **Pick a violation category** from research.md
2. **Create a branch** (already on `013-constitution-compliance`)
3. **Fix violations** in that category
4. **Run file-scoped verification** after each change:
    ```bash
    npx tsc --noEmit src/lib/CHANGED_FILE.ts
    npx eslint src/lib/CHANGED_FILE.ts --config config/eslint.config.js
    ```
5. **Run full build** after completing a category:
    ```bash
    npm run build
    npm run test:unit
    ```
6. **Commit** with format: `refactor(scope): TXXX — description`

## Task Execution Order

1. P2: PascalCase renames (low risk, unblocks nothing)
2. P2: `any` type fixes (low risk, independent)
3. P2: Hex color constitutional exemption (policy, no code)
4. P1: Oversized function extraction (high impact, may reduce file sizes)
5. P1: Oversized file splits (do after function extraction)
6. P3: Test failure fixes (independent, lower priority)
