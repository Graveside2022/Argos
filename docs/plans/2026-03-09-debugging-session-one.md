# Debugging Session One — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 issues discovered during the 2026-03-08 debugging session: Kismet device fetch failures, MapLibre style race condition, terminal WebSocket double-reconnection, SyntaxError verification, latency indicator redesign, Mesh dropdown placeholder data replacement, and TAK server zero-message investigation.

**Architecture:** Sequential fix order prioritizes data-flow correctness (Tasks 1, 7) before UI improvements (Tasks 5, 6). Each task is a self-contained commit. Tasks 2-4 are isolated race-condition/logging fixes with no cross-dependencies.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript strict, MapLibre GL, `@tak-ps/node-tak`, better-sqlite3, ws

---

## Execution Rules

1. **After each task**: Run code review agent, verify fix, commit.
2. **Track in Linear**: Create issues for each task before starting.
3. **Build check**: `npm run build` after every file change (catches .svelte import issues that tsc misses).
4. **No parallel typechecks**: Only one `svelte-check` at a time (lock file at `/tmp/argos-typecheck.lock`).
5. **Memory**: RPi 5 with ~2GB available. Avoid heavy operations.

---

### Task 1: Fix Kismet Device Fetching (Critical)

**Problem:** Every GET to `/api/kismet/devices` fails with `TypeError: Load failed` on client. The error logs as `{error: {}}` because TypeError doesn't serialize. Meanwhile `/api/kismet/control` POST works fine — the server is up.

**Root Cause Analysis:** The client-side `KismetService.fetchKismetDevices()` in `src/lib/tactical-map/kismet-service.ts:145-158` catches errors and logs `{ error }` — but TypeError has non-enumerable properties (`message`, `stack`), so it appears as `{}`. The actual "Load failed" is a WebKit network error meaning the request never completed. Most likely causes:

1. The fusion controller's `isReady()` always returns `true` (line 46 of fusion-controller.ts), so it always tries the fusion path
2. The fusion path calls `KismetProxy.getDevices()` which hits the local Kismet REST API — if Kismet is slow or the response is large, WebKit's fetch timeout fires
3. The `/api/kismet/devices` handler catches the error and calls `fetchKismetFallback()` which ALSO hits Kismet — doubling the time
4. If both take >60s combined, the browser's fetch aborts with "Load failed"

**Files:**

- Modify: `src/lib/tactical-map/kismet-service.ts:145-158`
- Modify: `src/routes/api/kismet/devices/+server.ts:105-113`

**Step 1: Fix error serialization in client-side fetch**

The logger sees `{error: {}}` because TypeError doesn't serialize. Extract the message explicitly.

```typescript
// src/lib/tactical-map/kismet-service.ts — in fetchKismetDevices() catch block (line 155)
// BEFORE:
} catch (error) {
    logger.error('Error fetching Kismet devices', { error });
    return [];
}
// AFTER:
} catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching Kismet devices', { error: msg });
    return [];
}
```

**Step 2: Add AbortController timeout to client-side fetch**

WebKit's "Load failed" happens when the request hangs. Add a 15s client-side timeout so the error is clear and controlled.

```typescript
// src/lib/tactical-map/kismet-service.ts — in fetchKismetDevices() (line 150)
// BEFORE:
const response = await fetch('/api/kismet/devices');
// AFTER:
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);
let response: Response;
try {
	response = await fetch('/api/kismet/devices', { signal: controller.signal });
} finally {
	clearTimeout(timeout);
}
```

**Step 3: Add timeout to server-side endpoint**

The `/api/kismet/devices` handler can hang if Kismet is slow. Add a server-side timeout so the endpoint always responds within a budget.

```typescript
// src/routes/api/kismet/devices/+server.ts — wrap the main try block (line 106-108)
const DEVICE_FETCH_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
		)
	]);
}

export const GET = createHandler(async () => {
	try {
		if (fusionKismetController.isReady()) {
			return await withTimeout(fetchFusionDevices(), DEVICE_FETCH_TIMEOUT_MS, 'Fusion fetch');
		}
		return await withTimeout(
			KismetService.getDevices(),
			DEVICE_FETCH_TIMEOUT_MS,
			'Kismet fetch'
		);
	} catch (error: unknown) {
		logger.error('Error in Kismet devices endpoint', { error: errMsg(error) });
		return { devices: [], error: errMsg(error), source: 'timeout' as const };
	}
});
```

Note: Remove `fetchKismetFallback()` — it doubles the failure time by retrying the same broken Kismet connection. If fusion fails, return empty with the error message immediately.

**Step 4: Run build to verify**

```bash
npm run build
```

**Step 5: Test manually**

Open dashboard in browser. Check console for:

- No more `{error: {}}` — should show actual error message
- If Kismet is slow, should see timeout error within 15s, not hang forever

**Step 6: Commit**

```bash
git add src/lib/tactical-map/kismet-service.ts src/routes/api/kismet/devices/+server.ts
git commit -m "fix(kismet): add fetch timeouts and fix error serialization in device polling

T001 — Kismet device fetch fails with TypeError: Load failed on every poll.
Root cause: no timeouts on client or server, error serializes as empty object.
Fix: 15s client AbortController, 10s server Promise.race, extract error.message."
```

---

### Task 2: Fix MapLibre Style Race Condition (Medium)

**Problem:** `Unable to perform style diff: undefined is not an object (evaluating 'this.style.setState'). Rebuilding the style from scratch.` — MapLibre tries to diff the style before internal `this.style` is initialized.

**Root Cause:** In `dashboard-map-logic.svelte.ts`, lines 133-138, the `$effect` calls `handleMapLoad()` when `map` becomes truthy. But `handleMapLoad()` (line 208) calls `setupMap()` which registers layers. Meanwhile, the `MapLibre` component in `DashboardMap.svelte` line 47 has `onload={ms.handleMapLoad}` — so `handleMapLoad` is called TWICE: once from the effect and once from the onload callback. The first call runs before the map's internal style is ready, causing the race.

**Files:**

- Modify: `src/lib/components/dashboard/dashboard-map-logic.svelte.ts:133-138, 208-223`

**Step 1: Remove the duplicate handleMapLoad effect**

The `onload` callback in the MapLibre component is the correct trigger. The `$effect` at lines 133-138 is redundant and fires too early.

```typescript
// src/lib/components/dashboard/dashboard-map-logic.svelte.ts
// REMOVE lines 133-138:
// $effect(() => {
//     if (map && !layersInitialized) {
//         handleMapLoad();
//         layersInitialized = true;
//     }
// });
```

**Step 2: Add guard to handleMapLoad to prevent double-init**

Keep `layersInitialized` as a guard in `handleMapLoad()` itself:

```typescript
function handleMapLoad() {
	if (!map || layersInitialized) return;
	layersInitialized = true;
	const m = map;
	const init = () => {
		const r = setupMap(m, (ev) => applyDeviceClick(m, ev), closeDevicePopup, layerVis$.current);
		satLayer = r.satLayer;
		symbolLayer = r.symbolLayer;
	};
	if (!m.loaded()) m.once('load', init);
	else init();
}
```

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Test manually**

Load dashboard. Check console — the "Unable to perform style diff" warning should be gone.

**Step 5: Commit**

```bash
git add src/lib/components/dashboard/dashboard-map-logic.svelte.ts
git commit -m "fix(map): remove duplicate handleMapLoad effect causing style race condition

T002 — MapLibre style diff fails because handleMapLoad fires twice: once from
effect and once from onload callback. Remove the effect, add layersInitialized
guard directly in handleMapLoad."
```

---

### Task 3: Investigate Terminal WebSocket Double Reconnection (Low)

**Problem:** Terminal sessions reconnect twice within 100ms, second restoration fires 33s later. May be HMR behavior or unnecessary churn.

**Files:**

- Read: `src/lib/stores/dashboard/terminal-store.ts`
- Read: Terminal tab content component

**Step 1: Investigate the terminal store restoration logic**

Read the terminal store to understand how sessions are restored. Look for:

- Multiple `onMount` or `$effect` hooks that both trigger reconnection
- Race between Svelte component mount and WebSocket reconnect
- HMR handling (Vite hot module replacement triggers remount)

**Step 2: If duplicate found, add guard**

If two reconnection paths exist, add a `reconnecting` flag to prevent the second. Pattern:

```typescript
let reconnecting = false;
function restoreSessions() {
	if (reconnecting) return;
	reconnecting = true;
	// ... restoration logic ...
	reconnecting = false;
}
```

**Step 3: If this is just HMR behavior, document it**

If the 33s delay is from Vite HMR reconnect, add a code comment explaining it's expected in dev mode only. No code change needed.

**Step 4: Build and test**

```bash
npm run build
```

**Step 5: Commit (only if code changed)**

```bash
git commit -m "fix(terminal): prevent duplicate WebSocket reconnection on mount

T003 — Terminal sessions reconnect twice in 100ms during page load."
```

---

### Task 4: Verify SyntaxError Source (Low — likely debugging artifact)

**Problem:** `SyntaxError: Invalid escape in identifier: '\'` appears at `/dashboard` line 1 and 17. Likely caused by cmux JavaScript injection during the debugging session.

**Files:**

- Read: `src/routes/dashboard/+page.svelte`
- Read: `src/hooks.client.ts` (client-side error handling)

**Step 1: Check for dynamic code execution**

Search for dynamic string execution patterns in the dashboard route and WebSocket handlers.

**Step 2: If no source found, mark as debugging artifact**

The timing (22:01:10-22:01:34) aligns with the cmux injection period. If no dynamic execution is found, this is a confirmed debugging artifact — no fix needed.

**Step 3: Commit (only if fix needed)**

---

### Task 5: Replace Network Latency Indicator with Real Measurements (Critical)

**Problem:** The latency button measures browser-to-Pi RTT (32ms), not the operationally useful Pi-to-internet or Pi-to-TAK-server latency. The jitter is fake (`latencyMs * 0.07`), packet loss is hardcoded `0.0%`.

**Files:**

- Create: `src/routes/api/system/network-latency/+server.ts`
- Modify: `src/lib/components/dashboard/status/LatencyDropdown.svelte`
- Modify: `src/lib/components/dashboard/TopStatusBar.svelte:136-146`

**Step 1: Create server-side latency measurement endpoint**

New API endpoint that pings both 8.8.8.8 and the TAK server from the Pi.

```typescript
// src/routes/api/system/network-latency/+server.ts
import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';
import { TakService } from '$lib/server/tak/tak-service';
import { logger } from '$lib/utils/logger';

interface PingResult {
	target: string;
	label: string;
	latencyMs: number | null;
	packetLoss: number;
	jitterMs: number | null;
	status: 'ok' | 'timeout' | 'error';
}

async function pingHost(host: string, label: string, count = 3): Promise<PingResult> {
	try {
		const { stdout } = await execFileAsync('ping', ['-c', String(count), '-W', '3', host]);
		const rttMatch = stdout.match(
			/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/
		);
		const lossMatch = stdout.match(/([\d.]+)% packet loss/);
		if (rttMatch) {
			return {
				target: host,
				label,
				latencyMs: Math.round(parseFloat(rttMatch[2]) * 10) / 10,
				packetLoss: lossMatch ? parseFloat(lossMatch[1]) : 0,
				jitterMs: Math.round(parseFloat(rttMatch[4]) * 10) / 10,
				status: 'ok'
			};
		}
		return {
			target: host,
			label,
			latencyMs: null,
			packetLoss: 100,
			jitterMs: null,
			status: 'timeout'
		};
	} catch {
		return {
			target: host,
			label,
			latencyMs: null,
			packetLoss: 100,
			jitterMs: null,
			status: 'error'
		};
	}
}

export const GET = createHandler(async () => {
	const takService = TakService.getInstance();
	const takStatus = takService.getStatus();
	const takHost = takStatus.serverHost?.split(':')[0];

	const results: PingResult[] = [];
	results.push(await pingHost('8.8.8.8', 'Internet (Google DNS)'));
	if (takHost) {
		results.push(await pingHost(takHost, `TAK Server (${takStatus.serverName || takHost})`));
	}
	return { results, timestamp: new Date().toISOString() };
});
```

**Step 2: Update LatencyDropdown to show real measurements**

Replace the single-latency display with a multi-target display. Accept `results: PingResult[]`, `loading: boolean`, and `onping: () => void` as props. Iterate over results showing each target with its latency, jitter, and packet loss. Keep the existing CSS structure and design language.

**Step 3: Update TopStatusBar to fetch from new endpoint**

Replace the `fetchStatusWithLatency()` RTT measurement with a call to `/api/system/network-latency`. Call every 30s (not 5s — pings are expensive on constrained hardware).

**Step 4: Build and test**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/routes/api/system/network-latency/+server.ts \
        src/lib/components/dashboard/status/LatencyDropdown.svelte \
        src/lib/components/dashboard/TopStatusBar.svelte
git commit -m "feat(latency): replace browser-to-Pi RTT with real Pi-to-internet and Pi-to-TAK measurements

T005 — Latency indicator showed browser-to-Pi, not operationally useful metrics.
New /api/system/network-latency endpoint pings 8.8.8.8 and TAK server from Pi.
Jitter and packet loss are now real values from ping statistics."
```

---

### Task 6: Replace Node Mesh Popup Placeholder Data with Real Data (Critical)

**Problem:** MeshDropdown.svelte has hardcoded fake peers (VIPER-6, REAPER-2, SHADOW-9, GHOST-1) and a non-existent "TAK BACKUP :8443" server. The Refresh button does nothing.

**Files:**

- Create: `src/routes/api/system/mesh-status/+server.ts`
- Modify: `src/lib/components/dashboard/status/MeshDropdown.svelte`
- Modify: `src/lib/components/dashboard/TopStatusBar.svelte` (pass mesh data)

**Step 1: Create mesh status endpoint**

Query Tailscale for peer status and combine with TAK connection status.

```typescript
// src/routes/api/system/mesh-status/+server.ts
import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';
import { TakService } from '$lib/server/tak/tak-service';
import { logger } from '$lib/utils/logger';

interface TailscalePeer {
	name: string;
	ipv4: string;
	online: boolean;
	lastSeen: string;
	os: string;
}

async function getTailscalePeers(): Promise<TailscalePeer[]> {
	try {
		const { stdout } = await execFileAsync('tailscale', ['status', '--json']);
		const data = JSON.parse(stdout);
		const peers: TailscalePeer[] = [];
		const peerMap = data.Peer || {};
		for (const [, peer] of Object.entries(peerMap)) {
			const p = peer as Record<string, unknown>;
			peers.push({
				name: (p.HostName as string) || 'unknown',
				ipv4: ((p.TailscaleIPs as string[]) || [])[0] || '',
				online: p.Online === true,
				lastSeen: (p.LastSeen as string) || '',
				os: (p.OS as string) || ''
			});
		}
		return peers;
	} catch (err) {
		logger.warn('Failed to get Tailscale peers', { error: String(err) });
		return [];
	}
}

export const GET = createHandler(async () => {
	const takService = TakService.getInstance();
	const takStatus = takService.getStatus();

	const takServers = [];
	if (takStatus.serverHost) {
		const parts = takStatus.serverHost.split(':');
		takServers.push({
			name: takStatus.serverName || 'TAK Server',
			host: parts[0],
			port: parts[1] || '8089',
			connected: takStatus.status === 'connected',
			uptime: takStatus.uptime,
			messageCount: takStatus.messageCount,
			tls: true
		});
	}

	const peers = await getTailscalePeers();
	let selfHostname = 'unknown';
	try {
		const { stdout } = await execFileAsync('hostname', []);
		selfHostname = stdout.trim();
	} catch {
		/* ignore */
	}

	return { takServers, peers, selfHostname };
});
```

**Step 2: Rewrite MeshDropdown to use real data**

Replace all hardcoded data. Accept mesh data prop instead of just `takStatus`. Show only real TAK servers, real Tailscale peers, and wire the Refresh button.

**Step 3: Update TopStatusBar to fetch mesh data**

Fetch from `/api/system/mesh-status` every 30s. Update `meshDisplay` to use real peer counts.

**Step 4: Build and test**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/routes/api/system/mesh-status/+server.ts \
        src/lib/components/dashboard/status/MeshDropdown.svelte \
        src/lib/components/dashboard/TopStatusBar.svelte
git commit -m "feat(mesh): replace hardcoded placeholder data with real Tailscale peers and TAK status

T006 — MeshDropdown showed fake peers and non-existent TAK BACKUP.
New /api/system/mesh-status endpoint queries Tailscale and TAK service.
Refresh button now functional. Count badge reflects real connected nodes."
```

---

### Task 7: Verify TAK Server Connection is Actually Exchanging Messages (High)

**Problem:** `/api/tak/connection` reports `connected` with `messageCount: 0` after 16+ minutes. A working TAK connection should have position reports flowing.

**Files:**

- Modify: `src/lib/server/tak/tak-service.ts:68-76`
- Modify: `src/lib/types/tak.ts`

**Step 1: Investigate the zero message count**

The `messageCount` is incremented on the `'cot'` event (tak-service.ts line 168). If it's zero after 16 minutes, either:

1. The TAK server isn't sending CoT messages (normal if no other TAK clients are connected)
2. The `'cot'` event isn't firing despite the connection being "open"
3. The connection is a zombie — TLS handshake completed but application layer is dead

**Step 2: Add connection health tracking to TakService**

Add a `lastActivity` timestamp and expose it in `getStatus()`:

```typescript
// In TakService class — add property:
private lastActivityAt: number | null = null;

// In setupEventHandlers(), update on cot and ping events:
this.tak.on('cot', (cot: CoT) => {
    this.messageCount++;
    this.lastActivityAt = Date.now();
    // ... existing code
});

this.tak.on('ping', () => {
    this.lastActivityAt = Date.now();
    if (!this.connectedAt) this.connectedAt = Date.now();
});

// In getStatus():
public getStatus(): TakStatus {
    const isOpen = !!this.tak?.open;
    const lastActivity = this.lastActivityAt;
    const staleMs = lastActivity ? Date.now() - lastActivity : null;
    return {
        status: isOpen ? 'connected' : 'disconnected',
        serverName: this.config?.name,
        serverHost: this.config?.hostname,
        uptime: this.getUptime(),
        messageCount: this.messageCount,
        lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
        staleSinceMs: staleMs,
        connectionHealth: isOpen
            ? (staleMs !== null && staleMs > 120_000 ? 'stale' : 'healthy')
            : 'disconnected'
    };
}
```

**Step 3: Update the TakStatus type**

```typescript
// src/lib/types/tak.ts — add to TakStatus interface:
lastActivityAt?: string | null;
staleSinceMs?: number | null;
connectionHealth?: 'healthy' | 'stale' | 'disconnected';
```

**Step 4: Check if outbound SA position reporting exists**

Search for any periodic position sender to TAK. If none exists, that explains zero messages — document for a future task.

**Step 5: Build and test**

```bash
npm run build
```

Check `/api/tak/connection` — should now include `connectionHealth`, `lastActivityAt`, and `staleSinceMs` fields.

**Step 6: Commit**

```bash
git add src/lib/server/tak/tak-service.ts src/lib/types/tak.ts
git commit -m "feat(tak): add connection health tracking to detect stale/zombie connections

T007 — TAK reports connected with 0 messages after 16min.
Added lastActivityAt, staleSinceMs, connectionHealth fields to status.
Stale threshold: 120s without any TAK event (cot, ping)."
```

---

## Summary

| Task                   | Severity | Type              | Est. Complexity                        |
| ---------------------- | -------- | ----------------- | -------------------------------------- |
| 1. Kismet device fetch | Critical | Bug fix           | Medium — timeout + error serialization |
| 2. MapLibre style race | Medium   | Bug fix           | Low — remove one $effect               |
| 3. Terminal WebSocket  | Low      | Investigation     | Low — may be HMR artifact              |
| 4. SyntaxError         | Low      | Investigation     | Low — likely debugging artifact        |
| 5. Latency indicator   | Critical | Feature           | High — new API + rewrite component     |
| 6. Mesh dropdown       | Critical | Feature           | High — new API + rewrite component     |
| 7. TAK zero messages   | High     | Bug fix + feature | Medium — health tracking               |

**Execution order:** 1 → 2 → 3 → 4 → 7 → 5 → 6

Rationale: Fix data-flow bugs first (1, 2), investigate low-priority items (3, 4), then TAK health tracking (7, needed by 5 and 6), then the two new features (5, 6) which both depend on new API endpoints.
