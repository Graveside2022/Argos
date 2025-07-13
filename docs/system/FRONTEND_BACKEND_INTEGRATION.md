# Frontend-Backend Integration Guide

## Quick Reference

- **Frontend (SvelteKit)**: Port 8006
- **Backend (Express API)**: Port 8005
- **Data Flow**: Frontend (8006) → API calls → Backend (8005) → External Services

## Setting Up API Client Services

### 1. Create Base API Client

```typescript
// src/lib/services/api/client.ts
const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8005';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
	const url = `${API_BASE_URL}/api${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		},
		credentials: 'include' // Include cookies for session
	});

	if (!response.ok) {
		throw new Error(`API request failed: ${response.statusText}`);
	}

	return response.json();
}
```

### 2. Create Service Modules

```typescript
// src/lib/services/api/hackrf.ts
import { apiRequest } from './client';

export const hackrfAPI = {
	getStatus: () => apiRequest('/hackrf/status'),
	startSweep: (config: any) =>
		apiRequest('/hackrf/start-sweep', {
			method: 'POST',
			body: JSON.stringify(config)
		}),
	stopSweep: () => apiRequest('/hackrf/stop-sweep', { method: 'POST' }),
	getCycleStatus: () => apiRequest('/hackrf/cycle-status')
};

// src/lib/services/api/kismet.ts
import { apiRequest } from './client';

export const kismetAPI = {
	getDevices: () => apiRequest('/kismet/devices'),
	getStatus: () => apiRequest('/kismet/status'),
	runScript: (script: string) =>
		apiRequest('/kismet/run-script', {
			method: 'POST',
			body: JSON.stringify({ script })
		})
};
```

### 3. WebSocket Connection

```typescript
// src/lib/services/websocket/client.ts
import { writable } from 'svelte/store';

const WS_URL = import.meta.env.PUBLIC_WS_URL || 'ws://localhost:8005';

export function createWebSocketStore() {
	const { subscribe, set, update } = writable({
		connected: false,
		messages: []
	});

	let ws: WebSocket;

	function connect() {
		ws = new WebSocket(WS_URL);

		ws.onopen = () => {
			update((state) => ({ ...state, connected: true }));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			update((state) => ({
				...state,
				messages: [...state.messages, data]
			}));
		};

		ws.onclose = () => {
			update((state) => ({ ...state, connected: false }));
			// Reconnect after 3 seconds
			setTimeout(connect, 3000);
		};
	}

	function send(message: any) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	connect();

	return {
		subscribe,
		send,
		disconnect: () => ws.close()
	};
}
```

## Using in Svelte Components

### Example: HackRF Status Component

```svelte
<!-- src/routes/hackrf/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { hackrfAPI } from '$lib/services/api/hackrf';
	import { createWebSocketStore } from '$lib/services/websocket/client';

	let status = {};
	let error = null;
	const ws = createWebSocketStore();

	onMount(async () => {
		try {
			status = await hackrfAPI.getStatus();
		} catch (err) {
			error = err.message;
		}
	});

	// Listen for real-time updates
	$: if ($ws.messages.length > 0) {
		const lastMessage = $ws.messages[$ws.messages.length - 1];
		if (lastMessage.type === 'hackrf_update') {
			status = lastMessage.data;
		}
	}

	async function handleStartSweep() {
		try {
			await hackrfAPI.startSweep({
				startFreq: 88000000,
				endFreq: 108000000
			});
		} catch (err) {
			error = err.message;
		}
	}
</script>

<div>
	{#if error}
		<p class="error">{error}</p>
	{/if}

	<h1>HackRF Status</h1>
	<pre>{JSON.stringify(status, null, 2)}</pre>

	<button on:click={handleStartSweep}>Start Sweep</button>

	<p>WebSocket: {$ws.connected ? 'Connected' : 'Disconnected'}</p>
</div>
```

## Server-Side Data Fetching

For SSR and better performance, fetch data in `+page.server.ts`:

```typescript
// src/routes/kismet/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		// Use internal fetch that works during SSR
		const response = await fetch('http://localhost:8005/api/kismet/devices');
		const devices = await response.json();

		return {
			devices
		};
	} catch (error) {
		return {
			devices: [],
			error: 'Failed to load devices'
		};
	}
};
```

## Handling CORS in Development

The Express backend should already have CORS configured, but if you encounter issues:

1. **Backend CORS Setup** (Express - Port 8005):

```javascript
import cors from 'cors';

app.use(
	cors({
		origin: 'http://localhost:8006',
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		allowedHeaders: ['Content-Type', 'Authorization']
	})
);
```

2. **Frontend Proxy Alternative** (vite.config.ts):

```typescript
export default defineConfig({
	server: {
		port: 8006,
		proxy: {
			'/api': {
				target: 'http://localhost:8005',
				changeOrigin: true
			}
		}
	}
});
```

## Environment Variables

Make sure these are set in your `.env` file:

```bash
# Frontend port
PORT=8006

# Backend API
PUBLIC_API_BASE_URL=http://localhost:8005
PUBLIC_WS_URL=ws://localhost:8005
```

## Testing the Integration

1. **Start Backend** (Terminal 1):

```bash
cd /path/to/express-backend
npm run dev  # Should start on port 8005
```

2. **Start Frontend** (Terminal 2):

```bash
cd /home/pi/projects/ArgosFinal
npm run dev  # Should start on port 8006
```

3. **Verify Connection**:
    - Open http://localhost:8006
    - Check browser DevTools Network tab
    - API calls should go to http://localhost:8005/api/\*
    - WebSocket should connect to ws://localhost:8005

## Common Issues and Solutions

### Issue: API calls return 404

**Solution**: Ensure the backend is running on port 8005 and has the correct routes defined.

### Issue: CORS errors

**Solution**: Check that the backend allows origin `http://localhost:8006`.

### Issue: WebSocket won't connect

**Solution**: Verify the WebSocket server is running on the backend and the URL is correct.

### Issue: Session/auth not working

**Solution**: Ensure `credentials: 'include'` is set in fetch options and CORS allows credentials.

## Production Considerations

1. Update environment variables for production URLs
2. Use HTTPS for both frontend and backend
3. Implement proper authentication
4. Set up reverse proxy (nginx) if needed
5. Configure PM2 or systemd for process management
