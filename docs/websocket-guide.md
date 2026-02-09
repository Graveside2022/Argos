# WebSocket Architecture

## Real-Time Data Flow

```
Hardware → Python/Service → WebSocket Server → Svelte Store → UI
   ↓            ↓                  ↓               ↓           ↓
HackRF    hackrf_emitter    websocket-server  stores/*.ts  Auto-update
Kismet    Kismet daemon     Connection pool   Reactive     Live data
GPS       gpsd daemon       Health checks     Subscribe    Components
```

## Implementation

**Server:** [src/lib/server/websocket-server.ts](../src/lib/server/websocket-server.ts)

- Compression enabled
- Connection pooling
- 256KB payload limit (Phase 2.1.6)
- Automatic reconnection handling

**Client Stores:**

- Svelte 5 runes pattern (`$effect()`)
- Auto-cleanup on component unmount
- Typed message handlers
- Backpressure handling

## Authentication

**Auth happens in connection handler** (lines 79-100), NOT `verifyClient` callback.

**Token sources:**

1. Query param: `?token=...` (WebSocket upgrade requests don't leak to logs)
2. `X-API-Key` header
3. Cookie fallback (for browser clients)

**Pattern:**

```typescript
const url = new URL(request.url, `http://${request.headers.host}`);
const apiKey = url.searchParams.get('token') || request.headers['x-api-key'];
// Build mock Request with headers + cookies for validateApiKey()
```

**Gotcha:** `noServer: true` mode doesn't support `verifyClient`. Must extract token manually.

## Backpressure Handling

**Check buffer before sending:**

```typescript
if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1024 * 1024) {
	ws.send(JSON.stringify(data));
} else {
	// Drop message or queue (don't block)
}
```

## Message Batching

**Batch for efficiency:**

```typescript
// ❌ WRONG - 1000 individual messages
for (const signal of signals) {
	ws.send(JSON.stringify(signal));
}

// ✅ RIGHT - Single batched message
ws.send(JSON.stringify({ type: 'batch', signals }));
```

## Edge Cases

**Buffered Amount Growth:**

- Check `ws.bufferedAmount` before sending
- Drop messages if buffer exceeds threshold

**Reconnection Storms:**

- Implement exponential backoff on client
- Limit reconnection attempts
