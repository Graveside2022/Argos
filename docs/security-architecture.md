# Security Architecture

## Authentication (Phase 2.1.1)

**Dual authentication model:**

1. **Programmatic**: `X-API-Key` header for scripts, MCP servers, API clients
2. **Browser**: HMAC session cookie (`__argos_session`) set automatically on page loads

**Implementation:**

- Auth gate: [src/hooks.server.ts:27-30](../src/hooks.server.ts#L27-L30) validates BEFORE server starts
- Middleware: [src/lib/server/auth/auth-middleware.ts](../src/lib/server/auth/auth-middleware.ts)
- Protected: ALL `/api/*` except `/api/health`
- WebSocket: Token via `?token=...` query param or `X-API-Key` header + cookie fallback

## Input Sanitization (Phase 2.1.2)

**17 injection vectors patched across 16 files.**

**Validators** ([src/lib/server/security/input-sanitizer.ts](../src/lib/server/security/input-sanitizer.ts)):

- `validatePid()`: Linux pid_max = 2^22, range [1, 4194304]
- `validateInterfaceName()`: Regex `/^[a-zA-Z0-9_-]{1,15}$/` (IFNAMSIZ)
- `validateFrequency()`: RF frequency range validation
- `validateNumericRange()`: Generic bounds checking
- `sanitizeString()`: Shell-safe sanitization
- `sanitizeFilePath()`: Path traversal prevention

**Pattern:**

```typescript
// ❌ WRONG - Shell injection
exec(`hackrf_sweep -f ${userInput}`);

// ✅ RIGHT - Validation + execFile
const freq = validateFrequency(userInput);
execFile('hackrf_sweep', ['-f', freq.toString()]);
```

**Gotcha:** `hostExec()` needs shell (nsenter), can't use `execFile()`. Validate BEFORE interpolation.

## Rate Limiting (Phase 2.2.5)

**Token bucket algorithm** protects hardware endpoints.

**Config:**

- Pattern: `/api/(hackrf|kismet|gsm-evil|rf|droneid|openwebrx|bettercap|wifite)/`
- Body limits: 64KB hardware endpoints, 10MB general
- Implementation: [src/lib/server/security/rate-limiter.ts](../src/lib/server/security/rate-limiter.ts)
- Cleanup: Every 5 minutes (globalThis singleton for HMR)

**Why hardware endpoints?** RF hardware is resource-intensive. Prevents:

- DoS from rapid API calls
- Hardware lock contention
- Memory exhaustion from large FFT buffers

## Additional Layers

**CORS** (Phase 2.2.2): Origin allowlist in [src/lib/server/security/cors.ts](../src/lib/server/security/cors.ts). No wildcards.

**CSP Headers** (Phase 2.2.3): Content Security Policy in [src/hooks.server.ts](../src/hooks.server.ts).

**Safe JSON** (Phase 2.2.4): All `JSON.parse()` wrapped with try-catch + Zod validation. See [src/lib/server/security/safe-json.ts](../src/lib/server/security/safe-json.ts).

**Audit Logging**: Security events logged in [src/lib/server/security/auth-audit.ts](../src/lib/server/security/auth-audit.ts).
