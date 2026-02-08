# Phase 5.5.12 -- Standard Routes and Stores Directory Batch

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.12                                                              |
| **Phase**            | 5.5.12                                                                           |
| **Title**            | Standard Functions in routes/ and stores/ Directories (7 functions, 60-99 lines) |
| **Risk Level**       | LOW -- small overages requiring 1-2 extractions each                             |
| **Prerequisites**    | Phase 5.5.0 (Assessment), Phase 5.1 complete for God Pages                       |
| **Estimated Effort** | 1 hour                                                                           |
| **Files Touched**    | 4 existing files modified                                                        |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7       |
| **Audit Date**       | 2026-02-08                                                                       |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                              |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                            |

---

## 1. Objective

Decompose all STANDARD-priority functions (60-99 lines) residing in the `src/routes/` and `src/lib/stores/` directory trees that are not already handled by other Phase 5.5 sub-tasks or Phase 5.1.

---

## 2. Function Inventory -- Routes Directory (6 functions)

| #   | Lines | File                                     | Function           | Pattern to Apply                                                                               |
| --- | ----- | ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | 89    | `routes/kismet/+page.svelte:152`         | `startKismet`      | Early-Return: guard clauses for already running, no interface; extract `launchKismetProcess()` |
| 2   | 71    | `routes/droneid/+page.svelte:59`         | `connectWebSocket` | Extract-and-Name: extract `createWebSocket()`, `registerDroneHandlers()`                       |
| 3   | 68    | `routes/api/gps/position/+server.ts:180` | `buildGpsResponse` | Builder: extract `buildPositionSection()`, `buildSatelliteSection()`, `buildTimingSection()`   |
| 4   | 67    | `routes/test/+page.svelte:68`            | `testWebSockets`   | Data-Driven: define test cases as array, map through executor                                  |
| 5   | 65    | `routes/api/gps/position/+server.ts:111` | `queryGpsd`        | Early-Return: guard clauses for connection errors; extract `parseGpsdResponse()`               |

**Multi-function file**: `routes/api/gps/position/+server.ts` contains TWO oversized functions (68 and 65 lines). Process as a unit in one commit.

---

## 3. Function Inventory -- Stores Directory (1 function)

| #   | Lines | File                                | Function        | Pattern to Apply                                                                                    |
| --- | ----- | ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| 6   | 68    | `stores/packetAnalysisStore.ts:173` | `analyzePacket` | Extract-and-Name: extract `identifyProtocol()`, `extractPayloadMetadata()`, `classifyThreatLevel()` |

---

## 4. Detailed Decomposition Plans

### 4.1 `startKismet` (89 lines, kismet/+page.svelte)

**Current structure**: Checks if Kismet is already running, validates interface selection, configures Kismet startup options, launches the process, and monitors startup status.

**Early-Return + Extract**:

```typescript
async function startKismet(): Promise<void> {
	if (kismetRunning) return; // guard: already running
	if (!selectedInterface) {
		showError('No interface selected');
		return;
	} // guard: no interface

	const config = buildKismetConfig(selectedInterface, options);
	await launchKismetProcess(config);
	await monitorStartupStatus();
}
```

| New Function                        | Lines | Responsibility                              |
| ----------------------------------- | ----- | ------------------------------------------- |
| `buildKismetConfig(iface, options)` | 15-20 | Build Kismet startup configuration          |
| `launchKismetProcess(config)`       | 20-25 | POST to API, handle response                |
| `monitorStartupStatus()`            | 15-20 | Poll status endpoint until running or error |

**Post-decomposition**: `startKismet` becomes 15-25 lines.

### 4.2 `connectWebSocket` (71 lines, droneid/+page.svelte)

| New Function                | Lines | Responsibility                            |
| --------------------------- | ----- | ----------------------------------------- |
| `createWebSocket(url)`      | 15-20 | Create WebSocket, attach open/close/error |
| `registerDroneHandlers(ws)` | 20-25 | Register message handlers for drone data  |

**Post-decomposition**: `connectWebSocket` becomes 15-25 lines.

### 4.3 `buildGpsResponse` (68 lines, gps/position/+server.ts)

**Builder pattern**:

| New Function                     | Lines | Section                         |
| -------------------------------- | ----- | ------------------------------- |
| `buildPositionSection(gpsData)`  | 15-20 | Lat/lng/alt/speed/heading       |
| `buildSatelliteSection(gpsData)` | 12-18 | Satellite count, HDOP, fix type |
| `buildTimingSection(gpsData)`    | 10-15 | Timestamp, fix age, UTC offset  |

**Post-decomposition**: `buildGpsResponse` becomes 15-20 lines.

### 4.4 `queryGpsd` (65 lines, gps/position/+server.ts)

**Early-Return + Extract**:

```typescript
async function queryGpsd(): Promise<GpsData> {
	const socket = await connectToGpsd();
	if (!socket) return defaultGpsResponse(); // guard: connection failed

	const rawResponse = await readGpsdData(socket);
	if (!rawResponse) return defaultGpsResponse(); // guard: read failed

	return parseGpsdResponse(rawResponse);
}
```

| New Function             | Lines | Responsibility                      |
| ------------------------ | ----- | ----------------------------------- |
| `connectToGpsd()`        | 10-15 | TCP connect to gpsd socket          |
| `readGpsdData(socket)`   | 10-15 | Read JSON response from gpsd        |
| `parseGpsdResponse(raw)` | 15-20 | Parse gpsd JSON into GpsData object |

### 4.5 `testWebSockets` (67 lines, test/+page.svelte)

**Data-driven conversion**:

```typescript
const WS_TESTS: { name: string; url: string; expectedEvent: string }[] = [
	{ name: 'Main WS', url: '/ws', expectedEvent: 'connection' },
	{ name: 'HackRF', url: '/ws/hackrf', expectedEvent: 'spectrum' }
	// ... more test definitions ...
];

async function testWebSockets(): Promise<TestResult[]> {
	return Promise.all(WS_TESTS.map(runWSTest));
}
```

### 4.6 `analyzePacket` (68 lines, packetAnalysisStore.ts)

| New Function                             | Lines | Responsibility                              |
| ---------------------------------------- | ----- | ------------------------------------------- |
| `identifyProtocol(packet)`               | 15-20 | Determine protocol from packet headers      |
| `extractPayloadMetadata(packet)`         | 15-20 | Extract payload size, encoding, flags       |
| `classifyThreatLevel(protocol, payload)` | 15-20 | Classify packet as benign/suspicious/threat |

**Post-decomposition**: `analyzePacket` becomes 15-25 lines (call each analyzer, merge results).

---

## 5. Svelte Reactivity Notes

### 5.1 Route Page Functions

- `startKismet`: Updates reactive state (`kismetRunning`, error messages). Keep the state updates in the `.svelte` file; extract the pure logic (`buildKismetConfig`, `launchKismetProcess`) to helpers.
- `connectWebSocket`: Creates a WebSocket and updates stores. Keep store interactions in `.svelte`; extract pure WebSocket creation logic.
- `testWebSockets`: Pure test logic, can be fully extracted to a `.ts` helper.

### 5.2 Store Functions

- `analyzePacket`: Called within a store action. The extracted pure functions (`identifyProtocol`, `extractPayloadMetadata`, `classifyThreatLevel`) can safely be in a separate `.ts` file. The store update wrapper stays in the store file.

---

## 6. Verification

### 6.1 Batch Verification

```bash
for f in routes/kismet/+page.svelte routes/droneid/+page.svelte \
         routes/api/gps/position/+server.ts routes/test/+page.svelte; do
    python3 scripts/audit-function-sizes-v2.py "src/$f"
done

python3 scripts/audit-function-sizes-v2.py src/lib/stores/packetAnalysisStore.ts

# TARGET: 0 functions >60 lines across all files

npm run build && npm run typecheck
```

---

## 7. Test Requirements

| Extracted Function     | Test Cases Required                                         | Coverage Target      |
| ---------------------- | ----------------------------------------------------------- | -------------------- |
| `buildKismetConfig`    | Default options, custom options, invalid interface          | 80% line coverage    |
| `parseGpsdResponse`    | Valid JSON, malformed JSON, missing fields, empty response  | 90% line coverage    |
| `buildPositionSection` | Valid position, zero coordinates, missing altitude          | 80% line coverage    |
| `identifyProtocol`     | TCP, UDP, ICMP, unknown, malformed headers                  | 100% branch coverage |
| `classifyThreatLevel`  | Benign traffic, port scan, known exploit pattern, encrypted | 100% branch coverage |

Test files:

- `tests/unit/decomposition/routes/gpsResponse.test.ts`
- `tests/unit/decomposition/stores/packetAnalysis.test.ts`

**Estimated test effort**: 7 functions x ~7 min/function = ~0.8 hours

---

## 8. Commit Strategy

```
refactor(phase-5.5): decompose startKismet via early-return (89 -> 20 lines)
refactor(phase-5.5): decompose connectWebSocket (71 -> <60 lines)
refactor(phase-5.5): decompose 2 functions in gps/position/+server.ts (68+65 -> <60 each)
refactor(phase-5.5): convert testWebSockets to data-driven (67 -> 10 lines)
refactor(phase-5.5): decompose analyzePacket (68 -> 20 lines)
```

---

## 9. Cross-Phase Notes

- **Phase 5.1**: Functions in `routes/gsm-evil/+page.svelte` (e.g., `scanFrequencies`, 190 lines) are CRITICAL and handled by Phase 5.1 God Page decomposition. They are NOT in this document's scope.
- **Phase 5.5.1**: `createGSMEvilStore`, `createRTL433Store`, and `createKismetStore` are CRITICAL store functions handled by sub-task 5.5.1. The only remaining store function for 5.5.12 is `analyzePacket` (68 lines).
- **Phase 2.1.2 (Shell Injection)**: `launchKismetProcess` calls an API endpoint that may spawn Kismet. Verify the API endpoint does NOT pass user input directly to shell commands.

---

**END OF DOCUMENT**
