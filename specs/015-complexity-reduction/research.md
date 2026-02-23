# Research: Complexity Reduction Patterns

**Feature**: 015-complexity-reduction
**Date**: 2026-02-23

## Decision 1: Complexity Threshold Target

**Decision**: Set both cyclomatic and cognitive complexity thresholds to 5 at error level.

**Rationale**: SonarSource rates complexity ≤5 as "A grade" — the highest quality tier. At threshold 5, every function is trivially readable at a glance with at most 4 decision points. This forces aggressive decomposition into micro-helpers and lookup tables, producing extremely modular code where every function has a single, obvious responsibility. The strict error level means zero tolerance — no new complexity debt can be introduced.

**Alternatives Considered**:

- 15 (SonarSource default) — too lenient, allows functions that are hard to review
- 10 (Google/industry standard) — still allows moderately complex functions; chosen initially but tightened to 5
- Warn-only — does not prevent regression; developers can ignore warnings

## Decision 2: Refactoring Without Behavioral Changes

**Decision**: Pure structural refactoring only. No feature additions, API changes, or behavioral modifications during this spec.

**Rationale**: Mixing refactoring with feature work increases risk. Structural changes should be verifiable by existing tests alone. Any test that breaks indicates a behavioral change, which is a bug in the refactoring, not a missing test.

**Alternatives Considered**:

- Refactor-and-improve (fix bugs found during refactoring) — rejected: scope creep risk; bugs should get their own tracked fix
- Rewrite complex modules from scratch — rejected: too high risk for production code with hardware dependencies

## Decision 3: Helper Naming Convention

**Decision**: Extracted helpers follow the pattern `<verb><noun>` describing their single responsibility. Examples: `parseEncryption`, `buildFeatureFromDevice`, `validateGpsCoordinates`.

**Rationale**: Constitution Article 2.3 mandates camelCase for functions. Descriptive names eliminate the need for documentation on trivial helpers. The verb-noun pattern communicates both the action and the data being processed.

**Alternatives Considered**:

- Prefix with underscore (`_parseEncryption`) to mark as "private" helper — rejected: TypeScript has no module-private functions, and the underscore convention is for unused parameters
- Suffix with `Helper` (`parseEncryptionHelper`) — rejected: redundant and adds noise

## Decision 4: File Splitting Strategy

**Decision**: When a file exceeds 300 lines after helper extraction, create `<filename>-helpers.ts` in the same directory. The main file keeps the orchestrator function; helpers move to the helpers file.

**Rationale**: Constitution Article 2.2 mandates 300-line file limit. Co-located helpers maintain discoverability. The `-helpers.ts` suffix is descriptive and grep-friendly. No barrel files.

**Alternatives Considered**:

- Create a `helpers/` subdirectory — rejected: adds directory nesting for potentially 1-2 files
- Keep everything in one file with eslint-disable for file length — rejected: violates constitution
- Split by logical domain (e.g., `validation.ts`, `formatting.ts`) — considered viable for large splits; will use when the file naturally decomposes into 3+ distinct concerns

## Decision 5: Lookup Table Pattern for Conditional Chains

**Decision**: Replace if-else chains with 3+ branches using `Record<string, T>` or `Map<string, T>` lookup tables. The lookup is defined as a module-level constant. A fallback/default case is handled with nullish coalescing (`??`).

**Rationale**: A lookup table has cyclomatic complexity of 1 regardless of how many entries it contains. It is also more performant (O(1) vs O(n) for if-else chains). The fallback handles unknown/unexpected inputs without throwing.

**Alternatives Considered**:

- Keep switch/case — rejected: still counted as N branches by cyclomatic analysis
- Use a class with strategy pattern — rejected: over-engineering for static dispatch; classes add unnecessary ceremony in a functional TypeScript codebase

## Decision 6: Execution Grouping by File Proximity

**Decision**: Group refactoring tasks by file/directory cluster rather than strictly by severity tier.

**Rationale**: Refactoring `map-geojson.ts` and `map-handlers.ts` together (both in `src/lib/components/dashboard/map/`) requires loading the same context. Grouping by proximity reduces context switching and catches cross-function dependencies that severity-only ordering would miss.

**Alternatives Considered**:

- Strict severity ordering (highest first) — rejected: causes excessive context switching between unrelated directories
- Alphabetical by filename — rejected: no logical grouping benefit
