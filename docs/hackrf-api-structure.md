# HackRF API Structure

## Phase 2.1 Completed: SvelteKit API Structure

### Created Directory Structure

```
src/
├── routes/
│   └── api/
│       └── hackrf/
│           ├── +server.ts              # Main API info endpoint
│           ├── health/
│           │   └── +server.ts          # GET /api/hackrf/health
│           ├── start-sweep/
│           │   └── +server.ts          # POST /api/hackrf/start-sweep
│           ├── stop-sweep/
│           │   └── +server.ts          # POST /api/hackrf/stop-sweep
│           ├── cycle-status/
│           │   └── +server.ts          # GET /api/hackrf/cycle-status
│           ├── emergency-stop/
│           │   └── +server.ts          # POST /api/hackrf/emergency-stop
│           ├── force-cleanup/
│           │   └── +server.ts          # POST /api/hackrf/force-cleanup
│           └── data-stream/
│               └── +server.ts          # GET /api/hackrf/data-stream (SSE)
└── lib/
    └── server/
        └── hackrf/
            ├── index.ts                # Export barrel file
            ├── types.ts                # TypeScript interfaces
            └── sweepManager.ts         # Core sweep logic (placeholder)
```

### API Endpoints

1. **GET /api/hackrf** - Returns API information and available endpoints
2. **GET /api/hackrf/health** - Check HackRF connection and device status
3. **POST /api/hackrf/start-sweep** - Start a new frequency sweep
4. **POST /api/hackrf/stop-sweep** - Gracefully stop current sweep
5. **GET /api/hackrf/cycle-status** - Get current sweep status
6. **POST /api/hackrf/emergency-stop** - Force stop all operations
7. **POST /api/hackrf/force-cleanup** - Clean up zombie processes
8. **GET /api/hackrf/data-stream** - Server-Sent Events for real-time spectrum data

### Type Definitions

Created comprehensive TypeScript interfaces in `types.ts`:

- `SweepConfig` - Configuration for sweep operations
- `SweepStatus` - Current state and progress
- `SpectrumData` - Frequency/power data points
- `HackRFHealth` - Device health information
- `ApiResponse<T>` - Standard API response wrapper

### Sweep Manager

Created `sweepManager.ts` with placeholder implementation:

- Event-driven architecture using EventEmitter
- Methods for start/stop/emergency operations
- Health check functionality
- Singleton pattern for global access

### Testing

All endpoints tested and working:

```bash
# Test health endpoint
curl http://localhost:5173/api/hackrf/health

# Test start sweep
curl -X POST http://localhost:5173/api/hackrf/start-sweep \
  -H "Content-Type: application/json" \
  -d '{"centerFrequency": 433920000, ...}'

# Test status
curl http://localhost:5173/api/hackrf/cycle-status
```

### Next Steps

1. **Phase 2.2**: Implement actual HackRF communication in sweepManager.ts
2. **Phase 2.3**: Add WebSocket support for real-time data
3. **Phase 2.4**: Integrate with existing Python backend
4. **Phase 2.5**: Update frontend to use new API endpoints
