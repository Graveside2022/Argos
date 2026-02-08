# Phase 7.6.05: Security Integration Tests

**Decomposed from**: Phase-7.6-VERIFICATION-SUITE.md (Task 7.6.8)
**Risk Level**: LOW -- Testing only, no production code modified
**Prerequisites**: Phase 7.5 complete (all API routes with auth/validation), Phase 2.1.1 API authentication installed, existing test suite green
**Estimated Duration**: 2-3 hours
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

**Added by Independent Audit (2026-02-08)**: The original plan had no security-specific tests. For a military deployment, the following security properties must be verified:

1. **Authentication enforcement** -- Unauthenticated requests are rejected in production
2. **Input validation** -- Zod schemas reject malformed, NaN, negative, and string-in-numeric inputs
3. **CORS policy** -- No wildcard `Access-Control-Allow-Origin: *` on RF control endpoints
4. **Rate limiting** -- Rapid repeated requests are throttled
5. **Error opacity** -- Error responses do not leak stack traces or file paths
6. **Audit trail** -- Every transmission attempt is logged

These properties are non-negotiable for military deployment. A single failure means the HackRF transmit system is not ready for field use.

**File**: `tests/integration/hackrf-security.test.ts`

---

## Task 7.6.8: Security Integration Test Table

| #   | Test                                       | Method  | Endpoint                      | Assertion                                                           |
| --- | ------------------------------------------ | ------- | ----------------------------- | ------------------------------------------------------------------- |
| 1   | Unauthenticated POST rejected (production) | POST    | `/api/hackrf/transmit/start`  | 401 or 403 when no API key provided and NODE_ENV=production         |
| 2   | Valid API key accepted                     | POST    | `/api/hackrf/transmit/start`  | 200 or 503 (no hardware) when valid Bearer token provided           |
| 3   | Invalid API key rejected                   | POST    | `/api/hackrf/transmit/start`  | 401 when wrong Bearer token provided                                |
| 4   | No wildcard CORS                           | GET     | `/api/hackrf/transmit/status` | Response does NOT contain `Access-Control-Allow-Origin: *`          |
| 5   | Rate limit enforced                        | POST x5 | `/api/hackrf/transmit/start`  | 4th+ request returns 429 within 10s window                          |
| 6   | Zod rejects NaN frequency                  | POST    | `/api/hackrf/transmit/start`  | 400 when frequency is NaN                                           |
| 7   | Zod rejects negative gain                  | POST    | `/api/hackrf/transmit/start`  | 400 when gain is -1                                                 |
| 8   | Zod rejects string in numeric field        | POST    | `/api/hackrf/transmit/start`  | 400 when frequency is "abc"                                         |
| 9   | No stack trace in error response           | POST    | `/api/hackrf/transmit/start`  | Error response does NOT contain `.stack` or file paths              |
| 10  | Audit log written on start                 | POST    | `/api/hackrf/transmit/start`  | File at `data/audit/transmit-log-*.jsonl` exists and contains entry |

### Detailed Test Descriptions

**Test 1 (Unauthenticated Rejection)**: Send a POST to `/api/hackrf/transmit/start` with valid JSON body but NO `X-API-Key` header and NO `__argos_session` cookie. With `NODE_ENV=production`, the auth middleware in `src/hooks.server.ts` must reject with 401 or 403. This verifies the fail-closed authentication gate installed in Phase 2.1.1.

**Test 2 (Valid API Key)**: Send the same POST with a valid `X-API-Key` header (value from `ARGOS_API_KEY` env var). Expect 200 (transmission started) or 503 (no HackRF hardware), but NOT 401/403. This verifies the auth gate allows legitimate programmatic access.

**Test 3 (Invalid API Key)**: Send with `X-API-Key: wrong-key-value-that-does-not-match`. Expect 401. This verifies the auth gate does not accept arbitrary keys.

**Test 4 (No Wildcard CORS)**: Send a GET to `/api/hackrf/transmit/status` and inspect response headers. The `Access-Control-Allow-Origin` header must NOT be `*`. For an RF transmitter API, wildcard CORS would allow any website to trigger transmissions via the user's browser. This is a security-critical check.

**Test 5 (Rate Limiting)**: Send 5 rapid POST requests to `/api/hackrf/transmit/start` within a 10-second window. The 4th or 5th request should return HTTP 429 (Too Many Requests). This prevents rapid-fire abuse of the transmitter. Note: the exact threshold depends on the rate limiter configuration; adjust the count if the limit is set differently.

**Test 6 (Zod NaN Rejection)**: Send `{ "frequency": NaN, ... }`. JSON.stringify converts NaN to `null`, but the Zod schema should reject null/undefined frequency with a 400 error. Alternatively, send the string "NaN" which Zod's `.number()` parser rejects.

**Test 7 (Zod Negative Gain)**: Send `{ "gain": -1, ... }`. Gain must be non-negative for HackRF. The Zod schema should enforce `.min(0)` and return 400.

**Test 8 (Zod String in Numeric Field)**: Send `{ "frequency": "abc", ... }`. The Zod schema's `.number()` parser rejects strings. Expect 400 with a Zod validation error message.

**Test 9 (No Stack Traces)**: Send a deliberately malformed request and inspect the error response body. It must NOT contain:

- `.stack` property with a stack trace
- File paths (e.g., `/home/kali/`, `/app/src/`, `node_modules/`)
- Internal function names from the SvelteKit framework
  This prevents information leakage that could help an attacker map the server's file system.

**Test 10 (Audit Log)**: After a POST to `/api/hackrf/transmit/start` (with valid auth), check that a file matching `data/audit/transmit-log-*.jsonl` exists and contains at least one line with a JSON object including the transmission parameters, timestamp, and requesting IP. This is required for military chain-of-custody documentation.

---

## Verification Commands

```bash
# Run security integration tests
npm run test:integration -- tests/integration/hackrf-security.test.ts

# Run with verbose output
npm run test:integration -- tests/integration/hackrf-security.test.ts --reporter=verbose

# Manual verification of auth rejection (should return 401/403)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5173/api/hackrf/transmit/start \
  -H "Content-Type: application/json" \
  -d '{"protocol":"adsb","frequency":1090000000}'

# Manual verification of CORS header
curl -s -D - http://localhost:5173/api/hackrf/transmit/status 2>&1 | grep -i "access-control-allow-origin"

# Check audit log exists
ls -la data/audit/transmit-log-*.jsonl 2>/dev/null
```

---

## Verification Checklist

- [ ] Test file `tests/integration/hackrf-security.test.ts` exists and compiles
- [ ] Test #1: Unauthenticated POST returns 401 or 403 (production mode)
- [ ] Test #2: Valid API key returns 200 or 503 (never 401/403)
- [ ] Test #3: Invalid API key returns 401
- [ ] Test #4: No `Access-Control-Allow-Origin: *` in response headers
- [ ] Test #5: Rate limit returns 429 after rapid repeated requests
- [ ] Test #6: NaN frequency returns 400
- [ ] Test #7: Negative gain (-1) returns 400
- [ ] Test #8: String frequency ("abc") returns 400
- [ ] Test #9: Error response contains no `.stack` or file paths
- [ ] Test #10: Audit log JSONL file created with transmission entry
- [ ] ALL 10/10 security tests pass

---

## Pass Criteria

**All 10 security tests must pass. This is a non-negotiable gate for military deployment.**

A failure in any security test means:

- Test 1/2/3 failure: Authentication bypass -- the transmitter can be controlled by unauthorized actors
- Test 4 failure: CORS vulnerability -- any website can trigger RF transmission via CSRF
- Test 5 failure: No rate limiting -- the transmitter can be flooded with requests
- Test 6/7/8 failure: Input validation bypass -- malformed data reaches the RF hardware
- Test 9 failure: Information leakage -- attackers can map the server filesystem
- Test 10 failure: No audit trail -- transmissions cannot be attributed for chain-of-custody

---

## Definition of Done

1. Test file `tests/integration/hackrf-security.test.ts` is created and compiles without errors
2. All 10 security tests pass
3. `npm run test:integration -- tests/integration/hackrf-security.test.ts` exits with code 0
4. No security test is skipped, mocked, or marked as `.todo`

---

## Cross-References

- **Phase 2.1.1**: API Authentication (installs the auth middleware tested here)
- **Phase 2.1.2**: Shell Injection Elimination (input validation patterns)
- **Phase 7.5**: API Routes (implements the Zod schemas and error handling tested here)
- **Phase 7.6.04**: Integration Tests (functional tests of the same endpoints)
- **Phase 7.6.07**: Final Gate Check (security is Gate 8 of 10)
- **Independent Security Audit (2026-02-08)**: Identified missing security tests as a gap
- **Parent**: Phase-7.6-VERIFICATION-SUITE.md
