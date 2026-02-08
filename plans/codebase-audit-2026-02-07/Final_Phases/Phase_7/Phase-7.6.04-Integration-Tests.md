# Phase 7.6.04: Integration Tests

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Task 7.6.6)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete (all API routes implemented), SvelteKit dev server running on port 5173, existing test suite green
**Estimated Duration**: 3-4 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Integration tests verify that the full TypeScript stack works end-to-end: HTTP request enters the SvelteKit API route, passes through Zod validation, reaches the transmit service layer, invokes the protocol encoder, and returns a correct response. Unlike unit tests (which test isolated functions), integration tests exercise the real server with real HTTP calls.

These 17 tests cover all 11 API endpoints of the HackRF transmit system plus cross-cutting concerns (audit logging, concurrency, feature flag proxy).

**File**: `tests/integration/hackrf-transmit.test.ts`

---

## Task 7.6.6: Integration Test Table

| #   | Test                              | Method      | Endpoint                         | Assertion                                                   |
| --- | --------------------------------- | ----------- | -------------------------------- | ----------------------------------------------------------- |
| 1   | Status returns valid JSON         | GET         | `/api/hackrf/transmit/status`    | Has `status`, `active`, `deviceConnected`                   |
| 2   | Workflows lists all protocols     | GET         | `/api/hackrf/transmit/workflows` | Array length >= 8                                           |
| 3   | Start with valid params           | POST        | `/api/hackrf/transmit/start`     | 200 or 503 (no hardware), not 500                           |
| 4   | Start with invalid params         | POST        | `/api/hackrf/transmit/start`     | 400 with `error` field                                      |
| 5   | Start with out-of-range frequency | POST        | `/api/hackrf/transmit/start`     | 400, code = "FREQUENCY_OUT_OF_RANGE"                        |
| 6   | Stop transmission                 | POST        | `/api/hackrf/transmit/stop`      | 200                                                         |
| 7   | Health check                      | GET         | `/api/hackrf/transmit/health`    | Has `status` field                                          |
| 8   | Device info                       | GET         | `/api/hackrf/transmit/device`    | 200 with device info or unavailable                         |
| 9   | Cache status                      | GET         | `/api/hackrf/transmit/cache`     | Has `entries` field                                         |
| 10  | Cache clear                       | DELETE      | `/api/hackrf/transmit/cache`     | 200                                                         |
| 11  | Frequency bands                   | GET         | `/api/hackrf/transmit/bands`     | Array of band objects                                       |
| 12  | Safety limits                     | GET         | `/api/hackrf/transmit/safety`    | Has `maxFrequencyHz`, `maxGainDb`                           |
| 13  | Signal library                    | GET         | `/api/hackrf/transmit/library`   | Array of signal entries                                     |
| 14  | SSE events stream                 | GET         | `/api/hackrf/transmit/events`    | Content-Type: text/event-stream                             |
| 15  | Audit log creation                | POST+verify | `/api/hackrf/transmit/start`     | File at `data/audit/transmit-log-*.jsonl`                   |
| 16  | Concurrent requests               | GET x10     | `/api/hackrf/transmit/status`    | All return 200                                              |
| 17  | Feature flag proxy                | GET         | `/api/hackrf/transmit/status`    | With USE_PYTHON_HACKRF=true, response matches Python format |

### Detailed Test Descriptions

**Tests 1-2 (Status and Workflows)**: Read-only endpoints that must always return valid JSON regardless of hardware availability. Test 2 verifies that all 8+ protocol encoders are registered.

**Tests 3-5 (Start Transmission)**: The most critical endpoint. Test 3 uses valid parameters -- expect 200 if hardware is connected, 503 (Service Unavailable) if not, but NEVER 500 (Internal Server Error). Test 4 sends malformed JSON -- expect 400. Test 5 sends a valid structure with out-of-range frequency -- expect 400 with specific error code `FREQUENCY_OUT_OF_RANGE`.

**Test 6 (Stop)**: Idempotent -- calling stop when nothing is transmitting should still return 200.

**Tests 7-8 (Health and Device)**: Diagnostics endpoints. Device info may return "unavailable" if no HackRF is connected.

**Tests 9-10 (Cache)**: Signal cache management. GET returns cache status including entry count. DELETE clears the cache.

**Tests 11-13 (Reference Data)**: Static reference endpoints for frequency bands, safety limits, and pre-built signal library.

**Test 14 (SSE Stream)**: Server-Sent Events endpoint. Verify the Content-Type header is `text/event-stream`. Do NOT hold the connection open for more than 2 seconds in the test.

**Test 15 (Audit Log)**: After a POST to `/start`, verify that a JSONL audit log file was created in `data/audit/`. This is a military requirement -- every transmission attempt must be logged.

**Test 16 (Concurrency)**: Fire 10 simultaneous GET requests to `/status`. All must return 200. No deadlocks, no dropped connections.

**Test 17 (Feature Flag)**: When the `USE_PYTHON_HACKRF=true` environment variable is set, the TypeScript routes should proxy to the Python backend (port 8092) for backward compatibility. Verify the response format matches the Python API.

---

## API Endpoint Coverage Matrix

| Endpoint                         | Method | Tests Covering  |
| -------------------------------- | ------ | --------------- |
| `/api/hackrf/transmit/status`    | GET    | #1, #16, #17    |
| `/api/hackrf/transmit/workflows` | GET    | #2              |
| `/api/hackrf/transmit/start`     | POST   | #3, #4, #5, #15 |
| `/api/hackrf/transmit/stop`      | POST   | #6              |
| `/api/hackrf/transmit/health`    | GET    | #7              |
| `/api/hackrf/transmit/device`    | GET    | #8              |
| `/api/hackrf/transmit/cache`     | GET    | #9              |
| `/api/hackrf/transmit/cache`     | DELETE | #10             |
| `/api/hackrf/transmit/bands`     | GET    | #11             |
| `/api/hackrf/transmit/safety`    | GET    | #12             |
| `/api/hackrf/transmit/library`   | GET    | #13             |
| `/api/hackrf/transmit/events`    | GET    | #14             |

Total: **11 unique endpoints** covered by **17 tests** (some endpoints tested multiple times with different scenarios).

---

## Verification Commands

```bash
# Run integration tests
npm run test:integration -- tests/integration/hackrf-transmit.test.ts

# Run with verbose output showing each test
npm run test:integration -- tests/integration/hackrf-transmit.test.ts --reporter=verbose

# Ensure dev server is running before integration tests
curl -s http://localhost:5173/api/hackrf/transmit/status | head -c 200

# Check audit log directory exists
ls -la data/audit/
```

---

## Verification Checklist

- [ ] Test file `tests/integration/hackrf-transmit.test.ts` exists and compiles
- [ ] SvelteKit dev server accessible at port 5173
- [ ] Test #1: Status returns JSON with `status`, `active`, `deviceConnected`
- [ ] Test #2: Workflows returns array with length >= 8
- [ ] Test #3: Start with valid params returns 200 or 503 (never 500)
- [ ] Test #4: Start with invalid params returns 400 with `error` field
- [ ] Test #5: Out-of-range frequency returns 400 with code "FREQUENCY_OUT_OF_RANGE"
- [ ] Test #6: Stop transmission returns 200
- [ ] Test #7: Health check returns JSON with `status` field
- [ ] Test #8: Device info returns 200
- [ ] Test #9: Cache status returns JSON with `entries` field
- [ ] Test #10: Cache clear returns 200
- [ ] Test #11: Frequency bands returns array of band objects
- [ ] Test #12: Safety limits returns JSON with `maxFrequencyHz`, `maxGainDb`
- [ ] Test #13: Signal library returns array of signal entries
- [ ] Test #14: SSE events returns Content-Type: text/event-stream
- [ ] Test #15: Audit log JSONL file created after POST to /start
- [ ] Test #16: 10 concurrent GET requests all return 200
- [ ] Test #17: Feature flag proxy returns Python-format response
- [ ] ALL 17/17 integration tests pass

---

## Pass Criteria

ALL 17 tests must pass. Integration test failures indicate broken API contracts, which would break the frontend UI.

---

## Definition of Done

1. Test file `tests/integration/hackrf-transmit.test.ts` is created and compiles without errors
2. All 17 integration tests pass
3. All 11 API endpoints have at least one test
4. `npm run test:integration -- tests/integration/hackrf-transmit.test.ts` exits with code 0

---

## Cross-References

- **Phase 7.5**: API Routes and Frontend (implements the endpoints tested here)
- **Phase 7.4**: Service Layer (transmit manager, safety manager invoked by API routes)
- **Phase 7.6.05**: Security Integration Tests (tests the same endpoints from a security perspective)
- **Phase 7.6.07**: Final Gate Check (integration is Gate 7 of 10)
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
