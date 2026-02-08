# Phase 5.5.2 -- Critical Wireshark and OUI Decomposition

| Field                | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.2                                                           |
| **Phase**            | 5.5.2                                                                        |
| **Title**            | Critical Wireshark and OUI Database Decomposition (CRITICAL-02, CRITICAL-03) |
| **Risk Level**       | LOW -- internal refactors with no public API changes                         |
| **Prerequisites**    | Phase 5.5.0 (Assessment) complete                                            |
| **Estimated Effort** | 1.5 hours                                                                    |
| **Files Touched**    | 2 existing files refactored, 2 new files created                             |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7   |
| **Audit Date**       | 2026-02-08                                                                   |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                          |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                        |

---

## 1. Objective

Decompose two CRITICAL functions related to packet capture and device identification:

1. `setupPacketStream` (272 lines) -- interleaves filter construction, process spawning, and packet parsing
2. `initializeOUIDatabase` (219 lines) -- embeds ~180 lines of static data inline as code

---

## 2. Function Inventory

| ID          | Lines | File                                           | Line Start | Function                | Pattern to Apply |
| ----------- | ----- | ---------------------------------------------- | ---------- | ----------------------- | ---------------- |
| CRITICAL-02 | 272   | `src/lib/server/wireshark.ts`                  | 221        | `setupPacketStream`     | Extract-and-Name |
| CRITICAL-03 | 219   | `src/lib/server/kismet/device_intelligence.ts` | 499        | `initializeOUIDatabase` | Data-Driven      |

---

## 3. CRITICAL-02: `setupPacketStream` (272 lines)

**Location**: `src/lib/server/wireshark.ts:221`
**Current size**: 272 lines
**Root cause**: Single function handles three distinct responsibilities: (1) building pcap/tshark filter expressions from user parameters, (2) spawning the capture child process with appropriate arguments, (3) parsing the raw packet output stream line-by-line and emitting structured objects. These three concerns are interleaved with error handling and fallback logic.

### 3.1 Decomposition Strategy

Extract each responsibility into a named function within the same file. The `setupPacketStream` function becomes an orchestrator that calls the three sub-functions in sequence.

### 3.2 New Functions (in `src/lib/server/wireshark.ts`)

| Function Name                                        | Estimated Lines | Responsibility                                                                      |
| ---------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `buildCaptureFilter(params: CaptureParams)`          | 30-40           | Construct pcap/BPF filter expression from user parameters                           |
| `spawnCaptureProcess(filter: string, iface: string)` | 30-40           | Spawn tshark/tcpdump child process with correct arguments                           |
| `createPacketParser()`                               | 40-55           | Return a Transform stream that parses raw lines into structured `Packet` objects    |
| `setupPacketStream(params)`                          | 25-35           | Orchestrator: build filter -> spawn process -> pipe through parser -> return stream |

### 3.3 Before/After Structure

**Before** (272 lines):

```typescript
export async function setupPacketStream(params: CaptureParams): Promise<PacketStream> {
	// BUILD FILTER (50-60 lines)
	let filter = '';
	if (params.protocol) {
		/* ... */
	}
	if (params.port) {
		/* ... */
	}
	if (params.host) {
		/* ... */
	}
	// ... complex BPF filter construction ...

	// SPAWN PROCESS (40-50 lines)
	const args = ['-i', params.interface, '-f', filter /* ... */];
	const child = spawn('tshark', args);
	// ... error handling, stderr capture ...

	// PARSE OUTPUT (100-120 lines)
	const transform = new Transform({
		transform(chunk, encoding, callback) {
			// ... line-by-line parsing ...
			// ... field extraction ...
			// ... structured object emission ...
		}
	});
	// ... cleanup, pipe wiring ...
}
```

**After** (25-35 lines for orchestrator):

```typescript
export async function setupPacketStream(params: CaptureParams): Promise<PacketStream> {
	const filter = buildCaptureFilter(params);
	const child = spawnCaptureProcess(filter, params.interface);
	const parser = createPacketParser();
	child.stdout.pipe(parser);
	return { stream: parser, cleanup: () => child.kill() };
}
```

### 3.4 Cross-Phase Notes

- **Phase 5.5.9**: `tryRealCapture` (74 lines, same file) is also a STANDARD-priority function in `wireshark.ts`. Process both functions in the same commit to avoid intermediate states.
- **Phase 2.1.2 (Shell Injection)**: `spawnCaptureProcess` must use `spawn(cmd, [args])` array form, NOT `exec()` with string interpolation. Verify during extraction.

### 3.5 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/server/wireshark.ts
# TARGET: 0 functions >60 lines

npm run build && npm run typecheck
```

### 3.6 Test Requirements

| Extracted Function   | Test Cases Required                                               | Coverage Target      |
| -------------------- | ----------------------------------------------------------------- | -------------------- |
| `buildCaptureFilter` | No filters, single filter, all filters combined, invalid params   | 100% branch coverage |
| `createPacketParser` | Valid packet line, malformed line, empty line, multi-field packet | 90% line coverage    |

Test file: `tests/unit/decomposition/wireshark/packetStream.test.ts`

---

## 4. CRITICAL-03: `initializeOUIDatabase` (219 lines)

**Location**: `src/lib/server/kismet/device_intelligence.ts:499`
**Current size**: 219 lines
**Root cause**: The function contains an inline OUI (Organizationally Unique Identifier) lookup table as a JavaScript object literal (~180 lines of static data) followed by ~39 lines of initialization logic. This is a textbook case of embedded data masquerading as code.

### 4.1 Decomposition Strategy

Move the OUI data to a JSON file. Reduce the function to a file loader with validation. This is the **Data-Driven** pattern (Pattern 3 in Phase 5.5.13).

### 4.2 New Files and Functions

```
src/lib/data/oui-database.json          -- static OUI->manufacturer mapping (~180 lines of JSON)
src/lib/server/kismet/ouiLoader.ts      -- loadOUIDatabase() function
```

| Function Name                     | Estimated Lines | Responsibility                                                 |
| --------------------------------- | --------------- | -------------------------------------------------------------- |
| `loadOUIDatabase()`               | 20-30           | Read JSON file, validate structure, return Map<string, string> |
| `lookupManufacturer(mac: string)` | 8-12            | Extract OUI prefix from MAC, look up in loaded database        |

### 4.3 Before/After Structure

**Before** (219 lines):

```typescript
function initializeOUIDatabase(): Map<string, string> {
	const ouiData: Record<string, string> = {
		'00:00:0C': 'Cisco Systems',
		'00:01:42': 'Cisco Systems',
		'00:03:6B': 'Cisco Systems',
		// ... ~175 more entries ...
		'FC:FB:FB': 'Cisco Systems'
	};

	// ... 39 lines of initialization logic ...
	const ouiMap = new Map<string, string>();
	for (const [prefix, manufacturer] of Object.entries(ouiData)) {
		ouiMap.set(prefix.toUpperCase(), manufacturer);
	}
	return ouiMap;
}
```

**After** (20-30 lines for loader + data in JSON):

```typescript
// src/lib/server/kismet/ouiLoader.ts
import ouiData from '$lib/data/oui-database.json';

let cachedOUIMap: Map<string, string> | null = null;

export function loadOUIDatabase(): Map<string, string> {
	if (cachedOUIMap) return cachedOUIMap;
	cachedOUIMap = new Map<string, string>();
	for (const [prefix, manufacturer] of Object.entries(ouiData)) {
		cachedOUIMap.set(prefix.toUpperCase(), manufacturer);
	}
	return cachedOUIMap;
}

export function lookupManufacturer(mac: string): string | undefined {
	const prefix = mac.substring(0, 8).toUpperCase();
	return loadOUIDatabase().get(prefix);
}
```

### 4.4 Post-Decomposition

The `initializeOUIDatabase` function is **DELETED** and replaced by `loadOUIDatabase()` (20-30 lines). The calling code in `device_intelligence.ts` is updated to call `loadOUIDatabase()` at module initialization.

### 4.5 Cross-Phase Notes

- **Phase 5.5.9**: `performClassification` (70 lines, same file `device_intelligence.ts`) is also a STANDARD-priority function. Process both functions in the same commit.
- **Phase 4.1 (Dead Code)**: Verify that the inline OUI data does not duplicate any existing JSON data files in `src/lib/data/`.

### 4.6 Verification

```bash
# Verify JSON is valid
python3 -c "import json; json.load(open('src/lib/data/oui-database.json'))"

# Verify no function >60 lines
python3 scripts/audit-function-sizes-v2.py src/lib/server/kismet/device_intelligence.ts
python3 scripts/audit-function-sizes-v2.py src/lib/server/kismet/ouiLoader.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

### 4.7 Test Requirements

| Extracted Function   | Test Cases Required                                            | Coverage Target      |
| -------------------- | -------------------------------------------------------------- | -------------------- |
| `loadOUIDatabase`    | Returns Map, caches result on second call, valid entry count   | 80% line coverage    |
| `lookupManufacturer` | Known MAC prefix, unknown prefix, lowercase input, short input | 100% branch coverage |

Test file: `tests/unit/decomposition/kismet/ouiLoader.test.ts`

---

## 5. Execution Order

1. Extract OUI data to JSON (CRITICAL-03) -- no dependency on other changes
2. Decompose `setupPacketStream` (CRITICAL-02) -- independent
3. Update import paths in consuming files
4. Run full verification suite

**Commit strategy**: One commit per function decomposition (2 commits total).

```
refactor(phase-5.5): extract OUI data from device_intelligence.ts to JSON (219 -> 25 lines)
refactor(phase-5.5): decompose setupPacketStream in wireshark.ts (272 -> 30 lines)
```

---

## 6. Risk Mitigations

### 6.1 Error-Handling Semantics Preservation

When extracting `buildCaptureFilter` and `spawnCaptureProcess` from `setupPacketStream`, verify that error paths produce the same HTTP status codes and error response formats. The original function may have `return` statements inside `try/catch` blocks that change semantics when extracted.

**Rule**: If the extracted code contains `return` statements that exit the outer function on error, the extracted function must `throw` instead, and the caller must handle it.

### 6.2 JSON Import in SvelteKit

SvelteKit supports JSON imports natively via Vite. Verify that `import ouiData from '$lib/data/oui-database.json'` resolves correctly in both dev and production builds. If `resolveJsonModule` is not enabled in `tsconfig.json`, add it.

### 6.3 Performance -- OUI Lookup

The current inline object literal is compiled into the JavaScript bundle. Moving to a JSON file loaded at runtime has negligible performance impact because:

1. The JSON file is read once at module initialization and cached in a `Map`
2. Map lookups are O(1)
3. The OUI database is ~180 entries (trivial size)

---

**END OF DOCUMENT**
