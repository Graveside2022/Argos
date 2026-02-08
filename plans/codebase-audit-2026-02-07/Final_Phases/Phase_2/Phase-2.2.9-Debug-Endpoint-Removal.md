# Phase 2.2.9: Debug Endpoint Removal in Production

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP A05:2021 (Security Misconfiguration), NIST SP 800-53 CM-7 (Least Functionality)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade B8

---

## Purpose

Remove or gate 7 debug/test API endpoints that expose internal system state, hardware serial numbers, process internals, and full API surface maps to any network client. Even after Phase 2.1 authentication is in place, these endpoints serve no production purpose and violate the principle of least functionality (NIST CM-7). Their continued existence increases the attack surface and provides reconnaissance information to an adversary who compromises or bypasses the API key.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | LOW -- Deleting debug routes has zero impact on production functionality                       |
| Severity      | HIGH -- Endpoints expose hardware serial numbers, board IDs, internal state, and API maps      |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 7 route directories (each containing `+server.ts`)                                             |
| Blocks        | Nothing                                                                                        |
| Blocked By    | Phase 2.1 Task 2.1.1 (API Key Authentication -- provides baseline protection during cleanup)   |

## Threat Context

Argos is field-deployed on RPi 5 hardware for Army EW training. The device operates on tactical networks where adversary electronic warfare teams actively probe for exploitable services. Debug endpoints provide the following intelligence to an adversary:

1. **`/api/test`** -- Returns a complete inventory of all API endpoints, WebSocket URLs, and page routes. This is equivalent to handing an adversary a network reconnaissance report. An attacker skips the enumeration phase entirely.

2. **`/api/test-db`** -- Reveals database integration status, connection parameters, and schema information. Confirms the SQLite backend and provides attack surface for SQL injection targeting.

3. **`/api/hackrf/debug-start`** -- Exposes SweepManager internal state including stack traces. Stack traces reveal file paths, line numbers, and internal function names that assist in crafting targeted exploits.

4. **`/api/hackrf/test-device`** -- Returns raw `hackrf_info` output including hardware serial numbers and board revision IDs. Serial numbers are unique device identifiers that could be used for device tracking, attribution, or warranty/supply chain attacks.

5. **`/api/hackrf/test-sweep`** -- Returns raw `hackrf_sweep` output including stderr. Error messages in stderr may reveal system configuration, library versions, and internal paths.

6. **`/api/debug/usrp-test`** -- Exposes USRP ProcessManager internal state, including child process PIDs, command-line arguments, and buffer contents.

7. **`/api/debug/spectrum-data`** -- Returns SweepManager private data structures including internal caches, frequency tables, and processing state.

Even with API key authentication (Phase 2.1), these endpoints remain dangerous because:

- A compromised API key grants immediate deep reconnaissance
- API keys can be extracted from client-side code, browser history, or network traffic
- The endpoints serve zero legitimate production purpose

NIST SP 800-53 CM-7 (Least Functionality) requires: "The organization configures the information system to provide only essential capabilities and prohibits or restricts the use of functions, ports, protocols, and/or services as defined in the registration requirements."

## Current State Assessment

| Metric                                    | Value                   | Verification Command                                                          |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | -------------- | ------------------------------------------------------- |
| Debug endpoints present in source tree    | **0** (already deleted) | `find src/routes/api/ -path "*test*" -o -path "*debug*" 2>/dev/null \| wc -l` |
| Debug endpoints referenced in other files | Verify at execution     | `grep -rn "/api/test\\                                                        | /api/test-db\\ | /api/debug" src/ --include="_.ts" --include="_.svelte"` |
| NODE_ENV production gate present          | **0**                   | `grep -rn "NODE_ENV.*production" src/routes/api/ --include="*.ts" \| wc -l`   |

**NOTE**: As of 2026-02-08, the 7 debug endpoint route directories appear to have been deleted from the filesystem in a prior cleanup operation. This task documents the required verification procedure, establishes the NODE_ENV gating pattern for any future debug endpoints, and ensures no references to deleted endpoints remain in the codebase.

## Implementation Plan

### Subtask 2.2.9.1: Identify and Remove Debug Endpoints

The following 7 debug/test endpoints were identified by the independent security regrade as exposing internal system state:

| #   | Endpoint                   | Route Directory                                 | Exposure                                             | Action                      |
| --- | -------------------------- | ----------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| 1   | `/api/test`                | `src/routes/api/test/+server.ts`                | Lists all API endpoints, WebSocket URLs, page routes | **DELETE** entire directory |
| 2   | `/api/test-db`             | `src/routes/api/test-db/+server.ts`             | Database integration status, connection info         | **DELETE** entire directory |
| 3   | `/api/hackrf/debug-start`  | `src/routes/api/hackrf/debug-start/+server.ts`  | SweepManager internal state + stack traces           | **DELETE** entire directory |
| 4   | `/api/hackrf/test-device`  | `src/routes/api/hackrf/test-device/+server.ts`  | Raw `hackrf_info` output (serial numbers, board IDs) | **DELETE** entire directory |
| 5   | `/api/hackrf/test-sweep`   | `src/routes/api/hackrf/test-sweep/+server.ts`   | Raw `hackrf_sweep` output + stderr                   | **DELETE** entire directory |
| 6   | `/api/debug/usrp-test`     | `src/routes/api/debug/usrp-test/+server.ts`     | ProcessManager internal state, child PIDs            | **DELETE** entire directory |
| 7   | `/api/debug/spectrum-data` | `src/routes/api/debug/spectrum-data/+server.ts` | SweepManager private data, internal caches           | **DELETE** entire directory |

#### Deletion Commands

```bash
# Delete all 7 debug/test route directories
rm -rf src/routes/api/test/
rm -rf src/routes/api/test-db/
rm -rf src/routes/api/hackrf/debug-start/
rm -rf src/routes/api/hackrf/test-device/
rm -rf src/routes/api/hackrf/test-sweep/
rm -rf src/routes/api/debug/usrp-test/
rm -rf src/routes/api/debug/spectrum-data/

# Remove empty parent directories if applicable
rmdir src/routes/api/debug/ 2>/dev/null || true
```

#### Remove Stale References

After deleting the route directories, search for and remove any references to these endpoints in other files:

```bash
# Find references to deleted debug endpoints in source code
grep -rn "/api/test\b\|/api/test-db\|/api/debug/\|debug-start\|test-device\|test-sweep" \
    src/ --include="*.ts" --include="*.svelte" --include="*.js"

# Expected: 0 results
# If results found: remove or update the references
```

#### NODE_ENV Gate Pattern for Future Debug Endpoints

If future development requires debug endpoints, they MUST be gated behind a `NODE_ENV` check. This pattern ensures debug functionality is never accessible in production deployments:

**BEFORE** (vulnerable -- debug endpoint accessible in all environments):

```typescript
// src/routes/api/debug/example/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const internalState = getSweepManagerState(); // Exposes internals
	return new Response(JSON.stringify(internalState), {
		headers: { 'Content-Type': 'application/json' }
	});
};
```

**AFTER** (secure -- debug endpoint returns 404 in production):

```typescript
// src/routes/api/debug/example/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// SECURITY: Debug endpoints MUST NOT be accessible in production
	// Reference: Phase 2.2.9, NIST CM-7 (Least Functionality)
	if (process.env.NODE_ENV === 'production') {
		return new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const internalState = getSweepManagerState();
	return new Response(JSON.stringify(internalState), {
		headers: { 'Content-Type': 'application/json' }
	});
};
```

### Subtask 2.2.9.2: Verification

#### Test 1: Confirm debug route directories do not exist

```bash
# Check that all 7 route directories are deleted
find src/routes/api/test src/routes/api/test-db src/routes/api/debug \
    src/routes/api/hackrf/debug-start src/routes/api/hackrf/test-device \
    src/routes/api/hackrf/test-sweep -name "+server.ts" 2>/dev/null | wc -l
# Expected: 0
```

#### Test 2: Confirm no references to deleted endpoints remain

```bash
grep -rn "/api/test\b\|/api/test-db\|/api/debug/" src/ \
    --include="*.ts" --include="*.svelte" --include="*.js" | wc -l
# Expected: 0
```

#### Test 3: Functional test -- debug endpoints return 404

```bash
# Test each endpoint returns 404 (requires running dev server)
for endpoint in "/api/test" "/api/test-db" "/api/hackrf/debug-start" \
    "/api/hackrf/test-device" "/api/hackrf/test-sweep" \
    "/api/debug/usrp-test" "/api/debug/spectrum-data"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: $ARGOS_API_KEY" \
        "http://localhost:5173${endpoint}")
    echo "${endpoint}: ${STATUS}"
done
# Expected: All 7 return 404
```

#### Test 4: Build verification

```bash
npm run typecheck && npm run build
# Expected: Both exit 0 (no type errors from missing imports)
```

## Verification Checklist

1. **Confirm debug route directories do not exist**

    ```bash
    find src/routes/api/test src/routes/api/test-db src/routes/api/debug \
        src/routes/api/hackrf/debug-start src/routes/api/hackrf/test-device \
        src/routes/api/hackrf/test-sweep -name "+server.ts" 2>/dev/null | wc -l
    # Expected: 0
    ```

2. **Confirm no references to deleted endpoints remain**

    ```bash
    grep -rn "/api/test\b\|/api/test-db\|/api/debug/" src/ \
        --include="*.ts" --include="*.svelte" --include="*.js" | wc -l
    # Expected: 0
    ```

3. **Functional test -- debug endpoints return 404**

    ```bash
    for endpoint in "/api/test" "/api/test-db" "/api/hackrf/debug-start" \
        "/api/hackrf/test-device" "/api/hackrf/test-sweep" \
        "/api/debug/usrp-test" "/api/debug/spectrum-data"; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "X-API-Key: $ARGOS_API_KEY" \
            "http://localhost:5173${endpoint}")
        echo "${endpoint}: ${STATUS}"
    done
    # Expected: All 7 return 404
    ```

4. **Build verification**
    ```bash
    npm run typecheck && npm run build
    # Expected: Both exit 0
    ```

## Commit Strategy

```
security(phase2.2.9): remove 7 debug/test endpoints exposing internal state

Phase 2.2 Task 9: Debug Endpoint Removal (OWASP A05, NIST CM-7)
- Deleted: /api/test, /api/test-db, /api/hackrf/debug-start,
  /api/hackrf/test-device, /api/hackrf/test-sweep,
  /api/debug/usrp-test, /api/debug/spectrum-data
- Removed stale references to deleted endpoints
- Established NODE_ENV gate pattern for future debug routes
Verified: find returns 0 debug route files; curl returns 404 for all 7

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Revert this single commit
git reset --soft HEAD~1

# Restore deleted route directories from git
git checkout HEAD -- src/routes/api/test/ src/routes/api/test-db/ \
    src/routes/api/debug/ src/routes/api/hackrf/debug-start/ \
    src/routes/api/hackrf/test-device/ src/routes/api/hackrf/test-sweep/
```

## Risk Assessment

| Risk                                             | Level  | Mitigation                                                               |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| Developers lose debug tooling                    | LOW    | NODE_ENV gate pattern provided; endpoints accessible in dev mode         |
| Stale imports cause build failures               | LOW    | Verification step 4 runs typecheck + build before commit                 |
| Hidden references to deleted endpoints           | LOW    | grep scan covers .ts, .svelte, .js files; manual review for dynamic refs |
| Re-introduction of debug endpoints in future PRs | MEDIUM | ESLint rule (Phase 2.2.14) can flag unguarded debug patterns             |

## Standards Traceability

| Standard       | Control    | Requirement                                   | How This Task Satisfies It                                           |
| -------------- | ---------- | --------------------------------------------- | -------------------------------------------------------------------- |
| OWASP Top 10   | A05:2021   | Security Misconfiguration                     | Removes unnecessary features (debug endpoints) from production       |
| NIST SP 800-53 | CM-7       | Least Functionality                           | System provides only essential capabilities; debug functions removed |
| NIST SP 800-53 | CM-7(1)    | Periodic review of unnecessary functions      | Verification commands enable periodic re-audit                       |
| NIST SP 800-53 | SC-7       | Boundary Protection                           | Reduces information available at network boundary                    |
| DISA STIG      | APP-SEC-12 | Remove debug code before deployment           | Direct implementation                                                |
| CERT           | MSC11-J    | Do not let session info leak within a servlet | Analogous: do not let system state leak through API endpoints        |

## Execution Tracking

| Subtask | Description                                                         | Status  | Started | Completed | Verified By |
| ------- | ------------------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.9.1 | Identify and delete 7 debug endpoints, remove stale references      | PENDING | --      | --        | --          |
| 2.2.9.2 | Verification (404 in production, 0 route files, 0 stale references) | PENDING | --      | --        | --          |
