# Phase 7.5.03: Feature Flag Implementation -- USE_PYTHON_HACKRF

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.2)
**Risk Level**: LOW -- Configuration only, no behavioral change when unset
**Prerequisites**: Phase-7.5.01 route files created
**Estimated Duration**: 1-2 hours
**Estimated Files Created**: 1 (`src/lib/server/hackrf/transmit/config.ts`)
**Estimated Files Modified**: 1 (Docker compose for env var passthrough)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Implement a feature flag (`USE_PYTHON_HACKRF`) that allows instant rollback from the new TypeScript API routes to the legacy Python Flask backend. This is critical for field deployment safety -- if the TypeScript implementation has issues during live Army EW training exercises, operators can switch back to the proven Python backend by setting a single environment variable, without redeployment or code changes.

---

## Implementation

### Feature Flag Module

**File**: `src/lib/server/hackrf/transmit/config.ts`

```typescript
// src/lib/server/hackrf/transmit/config.ts
const USE_PYTHON_BACKEND = process.env.USE_PYTHON_HACKRF === 'true';

export function getHackRFEndpoint(path: string): string {
	if (USE_PYTHON_BACKEND) {
		return `http://localhost:8092/api${path}`;
	}
	return `/api/hackrf/transmit${path}`;
}

export function isPythonBackendEnabled(): boolean {
	return USE_PYTHON_BACKEND;
}
```

### Behavior Matrix

| `USE_PYTHON_HACKRF` Value | Behavior                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `true`                    | The `[...path]/+server.ts` proxy remains active and forwards all requests to the Python Flask backend on `localhost:8092` |
|                           | New transmit routes under `src/routes/api/hackrf/transmit/` are bypassed                                                  |
|                           | Frontend API client uses proxy endpoints                                                                                  |
| unset or `false`          | New transmit routes handle all requests directly via the TypeScript service layer                                         |
|                           | The `[...path]/+server.ts` proxy is not needed but is kept until Phase 7.7 deletion                                       |
|                           | Frontend API client uses `/api/hackrf/transmit/*` endpoints                                                               |
| Any other string          | Treated as `false` (only exact string `'true'` enables Python backend)                                                    |

### Default Behavior

The flag defaults to **disabled** (TypeScript routes active). This is intentional -- the new routes are the target state, and the Python backend is the fallback.

### Where the Flag Is Consumed

1. **Frontend API client** (`src/lib/services/api/hackrf.ts`): Uses `getHackRFEndpoint()` to resolve base URL
2. **Frontend config** (`src/lib/services/api/config.ts`): Uses `isPythonBackendEnabled()` to select endpoint base
3. **Frontend service** (`src/lib/services/hackrf/hackrf-service.ts`): Uses flag to choose SSE vs SocketIO connection

### Docker Compose Environment Variable

Add to `docker/docker-compose.portainer-dev.yml` in the argos-dev service:

```yaml
environment:
    - USE_PYTHON_HACKRF=${USE_PYTHON_HACKRF:-}
```

Default is empty (evaluates to `false`). To enable Python backend:

```bash
# In .env or docker-compose override:
USE_PYTHON_HACKRF=true
```

### Rollback Procedure

If the TypeScript implementation fails during field deployment:

1. Set `USE_PYTHON_HACKRF=true` in `.env` or Docker compose environment
2. Restart the argos-dev container: `docker compose restart argos-dev`
3. Verify Python backend is reachable: `curl http://localhost:8092/api/health`
4. Verify frontend routes through proxy: `curl http://localhost:5173/api/hackrf/transmit/health`

---

## Verification Commands

```bash
# Verify config file exists
ls src/lib/server/hackrf/transmit/config.ts

# Verify exports
grep -n "export function getHackRFEndpoint" src/lib/server/hackrf/transmit/config.ts
grep -n "export function isPythonBackendEnabled" src/lib/server/hackrf/transmit/config.ts

# Verify USE_PYTHON_HACKRF env var check
grep -n "USE_PYTHON_HACKRF" src/lib/server/hackrf/transmit/config.ts

# Verify Docker compose includes the env var
grep "USE_PYTHON_HACKRF" docker/docker-compose.portainer-dev.yml

# Test default behavior (flag unset = TypeScript routes)
unset USE_PYTHON_HACKRF
# Frontend should call /api/hackrf/transmit/* directly

# Test flag enabled (Python backend)
export USE_PYTHON_HACKRF=true
# Frontend should call proxy which forwards to localhost:8092

# Verify strict equality check (only 'true' enables)
export USE_PYTHON_HACKRF=1
# Should NOT enable Python backend (only exact 'true' string)

# Typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] `src/lib/server/hackrf/transmit/config.ts` created with both exported functions
- [ ] `getHackRFEndpoint()` returns `http://localhost:8092/api{path}` when flag is true
- [ ] `getHackRFEndpoint()` returns `/api/hackrf/transmit{path}` when flag is false/unset
- [ ] `isPythonBackendEnabled()` returns boolean correctly
- [ ] Only exact string `'true'` activates Python backend (strict equality)
- [ ] `USE_PYTHON_HACKRF` added to Docker compose environment passthrough
- [ ] Flag consumed by frontend API client (Phase-7.5.04)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Definition of Done

1. Feature flag module exists at `src/lib/server/hackrf/transmit/config.ts`
2. Setting `USE_PYTHON_HACKRF=true` routes all requests through the Python proxy
3. Unsetting the flag (default) routes all requests to the new TypeScript API
4. Docker compose passes the environment variable to the container
5. Rollback procedure documented and verified

---

## Cross-References

- **Phase-7.5.01**: Route files that are bypassed when flag is true
- **Phase-7.5.04**: Frontend API client consumes `getHackRFEndpoint()` and `isPythonBackendEnabled()`
- **Phase-7.5.05**: SSE connection function uses flag to choose connection strategy
- **Phase 7.7**: Proxy `[...path]/+server.ts` and Python backend deleted (flag becomes obsolete)
