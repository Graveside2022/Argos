# Port Configuration Review for ArgosFinal

## Current Port Configuration

Based on the review, here's the actual port configuration:

- **Port 8005**: Express backend API server (TypeScript) - NOT the frontend
- **Port 8006**: SvelteKit frontend development server (as per user clarification)
- **Port 5173**: ArgosFinal SvelteKit development server (current migration target)
- **Port 8092**: HackRF Spectrum Analyzer
- **Port 2501**: Kismet API
- **Port 8000**: WigleToTAK API
- **Port 8073**: OpenWebRX

## Files That Need Updating

### 1. Migration Documentation

**File**: `/home/pi/projects/ArgosFinal/MIGRATION_SUMMARY.md`

- **Line 98**: States "Kismet Operations Center (currently on port 8005)" - This is incorrect
- **Line 99**: Should clarify that port 8005 is the backend API, not the frontend
- **Action**: Update to reflect that the frontend is on port 8006, backend API on port 8005

### 2. Environment Configuration

**File**: `/home/pi/projects/ArgosFinal/.env`

- Currently correct - no changes needed
- Already properly references the backend services

### 3. Frontend API Integration

All frontend components that make API calls need to ensure they're pointing to the correct backend port (8005):

#### Check and Update:

- Any files in `/src/lib/services/` that make API calls
- Any Svelte components that directly fetch from APIs
- WebSocket connections that might be hardcoded

### 4. Proxy Configuration

**File**: `/home/pi/projects/ArgosFinal/src/lib/server/kismet/kismetProxy.ts`

- Currently uses environment variables - no changes needed
- Properly configured to use `KISMET_PORT` from environment

### 5. WebSocket Manager

**File**: `/home/pi/projects/ArgosFinal/src/lib/server/kismet/webSocketManager.ts`

- **Line 31**: Uses hardcoded `http://localhost:2501` for Kismet
- **Action**: Ensure this matches the actual Kismet port configuration

### 6. Backend Server References

The actual backend server is at:

- `/home/pi/projects/stinkster_christian/stinkster/src/backend/server.ts`
- Running on port 8005 as an Express/TypeScript API server

## Recommended Actions

1. **Update Documentation**:
    - Fix MIGRATION_SUMMARY.md to correctly identify port 8005 as the backend API
    - Add clear documentation about port 8006 being the frontend dev server

2. **Create API Service Configuration**:
    - Create a centralized API configuration file that maps all backend endpoints
    - Ensure all API calls go through this configuration

3. **Add Development Notes**:

    ```typescript
    // In a new file: src/lib/config/api.ts
    export const API_ENDPOINTS = {
    	BACKEND: 'http://localhost:8005', // Express TypeScript API
    	KISMET: 'http://localhost:2501', // Kismet API
    	WIGLETOAK: 'http://localhost:8000', // WigleToTAK API
    	HACKRF: 'http://localhost:8092', // HackRF Spectrum Analyzer
    	OPENWEBRX: 'http://localhost:8073' // OpenWebRX
    };
    ```

4. **Update Frontend Components**:
    - Ensure all API calls use the correct backend port (8005)
    - Update any hardcoded references to use environment variables

5. **Testing Checklist**:
    - Test API connectivity from ArgosFinal (5173) to backend (8005)
    - Verify WebSocket connections work properly
    - Ensure proxy endpoints correctly forward to their respective services

## Integration Points to Verify

1. **Kismet Integration**:
    - Frontend (8006/5173) → Backend API (8005) → Kismet (2501)

2. **HackRF Integration**:
    - Frontend (8006/5173) → HackRF API (8092)

3. **WigleToTAK Integration**:
    - Frontend (8006/5173) → Backend API (8005) → WigleToTAK (8000)

## Notes

- The backend server at port 8005 appears to be a unified TypeScript API that consolidates multiple services
- It includes routes for Kismet, HackRF, system management, and more
- The migration should maintain API compatibility while moving the frontend from 8006 to the SvelteKit app
