# Phase 4.3.2: Fix MCP `dynamic-server.ts`

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT OBJ35-C (use correct object type), BARR-C Rule 1.3 (braces shall always be used), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Phase**        | 4 -- Type Safety Hardening                                             |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                          |
| **Task ID**      | 4.3.2                                                                  |
| **Title**        | Fix MCP `dynamic-server.ts`                                            |
| **Status**       | PLANNED                                                                |
| **Risk Level**   | LOW -- Single interface definition replaces 6 identical callback types |
| **Duration**     | 15 minutes                                                             |
| **Dependencies** | None (independent of other 4.3.x tasks)                                |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation)                      |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                                 |
| **Commit**       | `fix(types): type MCP dynamic-server Kismet device callbacks`          |
| **Standards**    | CERT OBJ35-C, BARR-C Rule 1.3, NASA/JPL Rule 14                        |

---

## Objective

Eliminate all 6 `any` occurrences in `src/lib/server/mcp/dynamic-server.ts`. All 6 are `(d: any)` in `.filter()` and `.map()` callbacks operating on Kismet device arrays from `data.devices`.

**Result**: 6 `any` removed.

---

## Current State Assessment

| Metric                    | Value                                                    | Verification Command                                           |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `any` occurrences in file | 6                                                        | `grep -c ': any\|as any' src/lib/server/mcp/dynamic-server.ts` |
| Pattern                   | All 6 are `(d: any)` in `.filter()` / `.map()` callbacks |
| Lines affected            | 51, 58, 67, 105, 184, 197                                |

---

## Execution Steps

### Step 1: Define the `KismetDeviceRaw` Interface

Add this interface at the top of the file, after imports:

```typescript
interface KismetDeviceRaw {
	mac?: string;
	macaddr?: string;
	ssid?: string;
	name?: string;
	signalStrength?: number;
	signal?: { last_signal?: number };
	manufacturer?: string;
	manuf?: string;
	type?: string;
	deviceType?: string;
	encryption?: string;
	crypt?: string;
	channel?: number | null;
	frequency?: number | null;
	packets?: number;
	dataPackets?: number;
	lastSeen?: string;
	last_time?: string;
	firstSeen?: string;
	first_time?: string;
	location?: unknown;
}
```

This interface uses optional properties to match the shape accessed by the mapping code. The dual field names (e.g., `mac`/`macaddr`, `manufacturer`/`manuf`) reflect the two different Kismet API response formats the MCP server normalizes.

### Step 2: Replace All 6 Callback Parameters

**Line 51** -- BEFORE:

```typescript
devices = devices.filter((d: any) => {
```

**AFTER**:

```typescript
devices = devices.filter((d: KismetDeviceRaw) => {
```

**Line 58** -- BEFORE:

```typescript
devices = devices.filter((d: any) => {
```

**AFTER**:

```typescript
devices = devices.filter((d: KismetDeviceRaw) => {
```

**Line 67** -- BEFORE:

```typescript
.map((d: any) => ({
```

**AFTER**:

```typescript
.map((d: KismetDeviceRaw) => ({
```

**Line 105** -- BEFORE:

```typescript
devices = devices.filter((d: any) =>
```

**AFTER**:

```typescript
devices = devices.filter((d: KismetDeviceRaw) =>
```

**Line 184** -- BEFORE:

```typescript
devices.filter((d: any) =>
```

**AFTER**:

```typescript
devices.filter((d: KismetDeviceRaw) =>
```

**Line 197** -- BEFORE:

```typescript
.map((d: any) => ({
```

**AFTER**:

```typescript
.map((d: KismetDeviceRaw) => ({
```

---

## Verification

```bash
# 1. Zero any remaining
grep -n ': any\|as any' src/lib/server/mcp/dynamic-server.ts
# Expected: 0 matches

# 2. TypeScript compiles
npx tsc --noEmit 2>&1 | grep 'dynamic-server'
# Expected: 0 errors

# 3. Interface covers all accessed properties
grep -n '\bd\.' src/lib/server/mcp/dynamic-server.ts | head -20
# Verify each property accessed on 'd' exists in KismetDeviceRaw
```

---

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                       |
| ------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------- |
| Missing property in `KismetDeviceRaw`      | LOW        | LOW    | TypeScript will flag at compile; add missing optional properties |
| Interface conflicts with Kismet API change | LOW        | LOW    | All fields are optional; interface is permissive                 |

---

## Rollback Strategy

```bash
git checkout -- src/lib/server/mcp/dynamic-server.ts
```

---

## Standards Traceability

| Standard         | Rule        | Applicability                                                    |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| CERT OBJ35-C     | Object type | Device objects typed with correct interface instead of `any`     |
| BARR-C Rule 1.3  | Braces      | Interface definition uses proper brace structure                 |
| NASA/JPL Rule 14 | Return vals | `.filter()` predicates now type-checked against interface fields |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.3
- **Reuses pattern in**: [Phase 4.3.9](Phase-4.3.9-Fix-Remaining-Active-Any.md) -- `src/routes/api/agent/tools/+server.ts` uses same `KismetDeviceRaw` interface
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (ESLint escalation)
