# ArgosFinal Quick Start Guide

## Get Running in 5 Minutes

### 1. Prerequisites Check

```bash
# Ensure these are running:
systemctl status express-backend  # Port 8005
lsusb | grep HackRF              # HackRF device connected
pgrep kismet                     # Kismet service
```

### 2. Start Development

```bash
cd /home/pi/projects/ArgosFinal
npm install  # First time only
npm run dev
```

Open http://localhost:8006

### 3. Test Key Features

- **HackRF**: Visit http://localhost:8006/hackrf
- **Kismet**: Visit http://localhost:8006/kismet
- **API Health**: http://localhost:8006/api/hackrf/health

## Most Common Development Tasks

### Working on HackRF UI

```bash
# Main component file
src/routes/hackrf/+page.svelte

# Update spectrum visualization
src/lib/components/hackrf/SpectrumChart.svelte

# Test with real device
curl -X POST http://localhost:8006/api/hackrf/start-sweep \
  -H "Content-Type: application/json" \
  -d '{"start_freq": 100000000, "end_freq": 1000000000}'
```

### Working on Kismet UI

```bash
# Main page
src/routes/kismet/+page.svelte

# Components to create
src/lib/components/kismet/DeviceList.svelte
src/lib/components/kismet/ServiceControl.svelte

# Test API
curl http://localhost:8006/api/kismet/devices/list
```

### Adding New API Endpoint

```typescript
// 1. Create route file
// src/routes/api/hackrf/new-endpoint/+server.ts

import { json } from '@sveltejs/kit';
import { sweepManager } from '$lib/server/hackrf';

export async function GET() {
	const data = await sweepManager.someMethod();
	return json(data);
}
```

### Connecting Component to API

```typescript
// In any Svelte component
<script lang="ts">
import { hackrfAPI } from '$lib/services/api';
import { onMount } from 'svelte';

onMount(async () => {
    const status = await hackrfAPI.getCycleStatus();
    console.log(status);
});
</script>
```

### Working with Real-time Data

```typescript
// SSE for HackRF spectrum data
import { hackrfWebSocket } from '$lib/services/websocket';

const unsubscribe = hackrfWebSocket.subscribe((data) => {
	// Update spectrum chart
	updateChart(data);
});

// Clean up
onDestroy(() => unsubscribe());
```

## Quick Troubleshooting

### "Cannot connect to backend API"

```bash
# Check if Express backend is running
curl http://localhost:8005/health

# If not, start it:
cd /path/to/express-backend
npm start
```

### "HackRF sweep won't start"

```bash
# Check device
hackrf_info

# Kill any existing sweeps
pkill hackrf_sweep

# Try API directly
curl -X POST http://localhost:8006/api/hackrf/emergency-stop
```

### "Kismet devices not showing"

```bash
# Test Kismet directly
curl -H "Cookie: KISMET=$KISMET_API_KEY" \
  http://localhost:2501/devices/all_devices.json

# Check proxy
curl http://localhost:8006/api/kismet/config
```

### "Styles look wrong"

```bash
# Ensure CSS imports in app.css:
cat src/app.css | grep @import

# Should show imports for:
# - hackrf styles
# - kismet styles
# - component styles
```

## Project Structure Cheat Sheet

```
Quick Navigation:
├── src/routes/          # Pages (URLs)
├── src/lib/
│   ├── components/      # UI pieces
│   ├── server/          # Backend logic
│   ├── services/api/    # API calls
│   ├── stores/          # App state
│   └── styles/          # CSS (DON'T EDIT)
```

## Key Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run check           # Type check
npm run build           # Production build

# Testing APIs
node test-sweep-manager.js     # Test HackRF
node test-kismet-proxy.js      # Test Kismet

# View logs
tail -f /home/pi/tmp/hackrf.log
journalctl -u kismet -f
```

## Important Migration Decisions

### Visual Preservation

- **ZERO** visual changes allowed
- All CSS copied verbatim to `/src/lib/styles/`
- HTML structure must match exactly
- Compare screenshots before/after

### Architecture Choices

- Frontend (SvelteKit) on port 8006
- Backend API (Express) stays on port 8005
- No direct hardware access from SvelteKit
- All hardware ops through Express backend

### State Management

- Svelte stores for UI state
- SSE for HackRF real-time data
- WebSockets for Kismet updates
- No Redux/MobX - keep it simple

### API Design

- RESTful endpoints under `/api/`
- Proxy pattern for Kismet
- SSE endpoint for spectrum data
- JSON responses throughout

## Next Steps Checklist

### If Working on HackRF

- [ ] Complete SpectrumChart.svelte with real D3/Chart.js
- [ ] Connect SSE stream to update chart
- [ ] Implement theme switching
- [ ] Test 10-second frequency cycling
- [ ] Verify emergency stop works

### If Working on Kismet

- [ ] Create DeviceList component
- [ ] Port map visualization
- [ ] Implement service controls
- [ ] Add script execution UI
- [ ] Test WebSocket updates

### If Testing

- [ ] Screenshot original vs new
- [ ] Test all API endpoints
- [ ] Verify real-time updates
- [ ] Check memory usage over time
- [ ] Test with multiple browsers

### If Deploying

- [ ] Build production bundle
- [ ] Create systemd service
- [ ] Configure nginx proxy
- [ ] Test alongside existing services
- [ ] Plan cutover timing

## Quick Visual Test

Open both versions side-by-side:

- Original HackRF: http://localhost:3002
- New HackRF: http://localhost:8006/hackrf

They should be **IDENTICAL**. Any difference is a bug.

## Remember

1. **Don't improve** - just migrate
2. **Test constantly** - small changes
3. **Match exactly** - pixel perfect
4. **Keep backend** - Express stays on 8005
5. **Document issues** - for next developer

## Getting Help

- Check `HANDOFF_DOCUMENT.md` for detailed info
- Review `PHASE_STATUS_DETAILED.md` for progress
- Look at test files for API examples
- Original apps are the source of truth

## You're Ready!

Start with `npm run dev` and pick a component to work on. The backend APIs are mostly done - focus on the frontend UI migration while preserving the exact look and feel.
