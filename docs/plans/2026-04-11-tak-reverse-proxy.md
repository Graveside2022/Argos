# TAK Server Reverse Proxy Plan

## Context

WebTAK (TAK server web UI at `https://<host>:8446`) is loaded in an iframe inside Argos's WebTAKView component. Login fails because Chrome's default `SameSite=Lax` cookie policy blocks the TAK server's `JSESSIONID` cookie on cross-origin XHR POST from the iframe (`localhost:5173` → `10.3.1.5:8446`). Login works fine in a direct browser tab because everything is same-origin.

**Solution**: A same-origin reverse proxy at `/api/tak/web/[...path]` that forwards all requests to the TAK server. The iframe loads from `localhost:5173/api/tak/web/` — no more cross-origin issues, no SSL cert warnings, cookies work natively.

## Files

| Action     | File                                                   | Lines |
| ---------- | ------------------------------------------------------ | ----- |
| **CREATE** | `src/routes/api/tak/web/[...path]/+server.ts`          | ~150  |
| **MODIFY** | `src/lib/components/dashboard/views/WebTAKView.svelte` | minor |

No changes needed to security-headers.ts (same-origin), hooks.server.ts (auth already covers `/api/*`), or env.ts (URL from DB).

## Step 1: Create Proxy Route

**File**: `src/routes/api/tak/web/[...path]/+server.ts`

Follow the SpiderFoot proxy pattern (`src/routes/api/spiderfoot/proxy/[...path]/+server.ts`) with four TAK-specific adaptations:

### 1a. Dynamic upstream URL from database

```typescript
import { loadTakConfig } from '$lib/server/tak/tak-db';
import { getRFDatabase } from '$lib/server/db/database';

function getTakBaseUrl(): string | null {
	const config = loadTakConfig(getRFDatabase().rawDb);
	if (!config) return null;
	return `https://${config.hostname}:${config.enrollmentPort}`;
}
```

### 1b. HTTPS with self-signed certs via undici

```typescript
import { Agent } from 'undici';

const tlsAgent = new Agent({
  connect: { rejectUnauthorized: false }
});

// Use undici's fetch directly (not global fetch) to pass dispatcher
import { fetch as undiciFetch } from 'undici';
const upstream = await undiciFetch(url, { dispatcher: tlsAgent, ... });
```

This avoids setting `NODE_TLS_REJECT_UNAUTHORIZED=0` globally.

### 1c. Bidirectional cookie forwarding

- **Request**: Forward browser's `cookie` header to TAK server (contains JSESSIONID)
- **Response**: Forward TAK server's `set-cookie` header to browser, rewriting `Path=/` to `Path=/api/tak/web/` so cookies scope correctly and don't collide with Argos cookies

### 1d. TAK-specific URL rewriting

The TAK server uses AngularJS with these path patterns:

- `/Marti/lib/angular/...` — framework scripts
- `/Marti/login/js/...` — login controller/services
- `/Marti/login/partials/...` — AngularJS templates
- `/oauth/token` — login endpoint
- `/login/auth` — external auth redirect
- `window.location = "/"` — post-login redirect

Rewrite functions:

```
rewriteHtml(): (href|src|action)="/..." → (href|src|action)="/api/tak/web/..."
rewriteJs():   url: "/..." → url: "/api/tak/web/..."
                window.location = "/" → window.location = "/api/tak/web/"
```

### 1e. Exported handlers

- `GET` — pages, scripts, styles, images, API calls
- `POST` — login (`/oauth/token`), API mutations
- `PUT`, `DELETE` — API operations (use fallthrough handler)

### 1f. Error responses

- No TAK config in DB → `503 Service Unavailable` with message
- TAK server unreachable → `502 Bad Gateway` with message

## Step 2: Update WebTAKView Component

**File**: `src/lib/components/dashboard/views/WebTAKView.svelte`

- Change iframe `src` from user-entered URL to `/api/tak/web/`
- Keep the URL input form as fallback (if user wants a custom TAK server not in DB)
- Add logic: on mount, check if TAK config exists (fetch `/api/tak/config`), if yes auto-load proxy URL
- Keep Refresh, Open in Tab, Change URL buttons
- Remove cert-overlay (no longer needed — same-origin proxy handles SSL)

## Step 3: Verify End-to-End

1. Start dev server (`npm run dev`)
2. Navigate to dashboard → WebTAK
3. Verify iframe auto-loads `/api/tak/web/`
4. Verify login page renders (AngularJS scripts load through proxy)
5. Type credentials, click login
6. Verify JSESSIONID cookie is set scoped to `/api/tak/web/`
7. Verify post-login redirect stays in iframe
8. Check browser console for CSP violations or blocked requests
9. Test Refresh button works
10. Run `npx tsc --noEmit` on the new file

## Key Risks & Mitigations

| Risk                                           | Mitigation                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| AngularJS `$templateCache` uses absolute paths | Rewrite `/Marti/` paths in HTML responses                            |
| TAK server WebSocket (real-time updates)       | Not needed for login flow; can add WS proxy later if WebTAK needs it |
| Large binary responses (map tiles)             | Stream through without buffering — only buffer HTML/JS for rewriting |
| Cookie collision with Argos session            | Scope TAK cookies to `Path=/api/tak/web/` via set-cookie rewriting   |
| undici API differences from global fetch       | Use undici's own `fetch` + `Agent` for consistent API                |

## Reference Implementations

- **SpiderFoot Proxy** (primary template): `src/routes/api/spiderfoot/proxy/[...path]/+server.ts`
- **Map Tiles Proxy** (binary streaming): `src/routes/api/map-tiles/[...path]/+server.ts`
- **TAK Config Loader**: `src/lib/server/tak/tak-db.ts` — `loadTakConfig()`
- **TAK Types**: `src/lib/types/tak.ts` — `TakServerConfig` interface
