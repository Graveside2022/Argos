# Data Model: Constitution Compliance Remediation

**Date**: 2026-02-22

## Overview

This feature is a refactoring effort — no new database tables, API endpoints, or persistent entities are created. The "data model" here describes the violation categories and their relationships to guide the remediation process.

## Entities

### Violation

A specific instance where code doesn't comply with a constitution article.

| Field        | Type          | Description                                                                                    |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| article      | string        | Constitution article reference (e.g., "2.2", "2.3")                                            |
| category     | enum          | `oversized-function`, `oversized-file`, `pascal-case`, `any-type`, `hex-color`, `test-failure` |
| filePath     | string        | Absolute path to the violating file                                                            |
| lineNumber   | number?       | Line number for function/type violations                                                       |
| currentValue | number/string | Current measured value (line count, type text, etc.)                                           |
| threshold    | number/string | Constitutional limit                                                                           |
| severity     | enum          | `critical` (>2x limit), `major` (>limit), `minor`                                              |

### Refactoring Unit

A group of related violations that must be fixed together atomically.

| Field        | Type              | Description                            |
| ------------ | ----------------- | -------------------------------------- |
| violations   | Violation[]       | Related violations in this unit        |
| files        | string[]          | All files that must change together    |
| testFiles    | string[]          | Test files that verify the refactoring |
| dependencies | RefactoringUnit[] | Other units that must complete first   |

## Relationships

```
Constitution Article 2.2
  ├── Oversized Functions (21 violations)
  │     └── Often contained within → Oversized Files
  └── Oversized Files (58 violations)
        └── May shrink naturally when functions are extracted

Constitution Article 2.3
  └── PascalCase Files (7 renames + 1 delete)
        └── Import updates across → Consumer files

Constitution Article 2.1
  └── any Types (16 violations)
        └── Independent fixes, no cross-dependencies

Constitution Article 2.6 / 4.1
  └── Hex Colors (65 occurrences)
        └── Resolved via → Constitutional Amendment (no code change)

Constitution Article 3
  └── Test Failures (11 failures across 4 files)
        └── Independent of other violations
```

## State Transitions

Each violation follows this lifecycle:

```
Identified → In Progress → Fixed → Verified
                              ↓
                          Build passes
                          Tests pass
                          Lint passes
```

## Validation Rules

- A function refactoring is complete when ALL resulting functions are ≤50 lines
- A file split is complete when ALL resulting files are ≤300 lines AND build passes
- A rename is complete when `git mv` + ALL import updates build successfully
- An `any` fix is complete when `npx tsc --noEmit` passes with strict mode
- The hex color resolution is complete when the constitutional amendment is ratified
- A test fix is complete when the specific test passes AND no regressions appear
