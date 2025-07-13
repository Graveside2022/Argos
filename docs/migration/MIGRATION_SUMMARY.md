# ArgosFinal Migration Plan Summary

## Overview

The ArgosFinal project consolidates two existing applications into a single, unified SvelteKit application:

1. **HackRF Sweep Monitor** (currently on port 3002) - SDR frequency sweeping and spectrum analysis
2. **Kismet Operations Center** - WiFi scanning, GPS tracking, and TAK integration
    - Backend API: Express.js on port 8005 (provides REST endpoints, WebSocket services, and proxying)
    - Frontend UI: To be migrated to SvelteKit on port 8006

## Unified Technology Stack

Both applications will be migrated to use:

- **Frontend Framework**: Svelte/SvelteKit
- **Language**: TypeScript
- **Runtime**: Node.js with Express.js compatibility
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (for new components) + preserved original CSS
- **State Management**: Svelte stores
- **Real-time**: WebSockets and Server-Sent Events (SSE)

## Key Migration Principles

### 1. **Pixel-Perfect Design Preservation**

- **ZERO visual changes** - the migration is purely technical
- All existing CSS, animations, and layouts preserved exactly
- Original HTML structure maintained
- No "improvements" or "modernizations" allowed
- Success = users cannot tell any difference

### 2. **100% Functional Parity**

- All features work identically after migration
- API endpoints maintain backward compatibility
- Real-time data streams preserved (SSE/WebSocket)
- Hardware integration unchanged
- External service connections maintained

### 3. **Unified Codebase Benefits**

- Single deployment point for both applications
- Shared authentication and session management
- Common components and utilities
- Consistent error handling and logging
- Simplified maintenance and updates

## Migration Phases

### Phase 0: Design Preservation Audit

- Document every visual element from both applications
- Create screenshot references for all states
- Export all CSS files without modification
- Map all JavaScript-driven style changes

### Phase 1: Project Setup

- Configure ArgosFinal with proper environment variables
- Set up SvelteKit frontend server on port 8006
- Configure frontend to connect to Express backend API on port 8005
- Prepare for proxying to existing services during migration

### Phase 2: Backend API Migration

- **HackRF APIs**: Convert Express routes to SvelteKit API routes
    - `/api/hackrf/start-sweep`, `/stop-sweep`, `/cycle-status`
    - SSE endpoint for real-time spectrum data
- **Kismet APIs**: Migrate proxy and control endpoints
    - `/api/kismet/proxy/*`, `/api/kismet/wigle/*`
    - WebSocket handling for real-time updates

### Phase 3: Frontend Component Migration

- Convert vanilla JavaScript to Svelte components
- Preserve exact HTML structure and CSS classes
- Maintain all timing, animations, and interactions
- Create shared navigation and layout components

### Phase 4: State Management

- Implement Svelte stores for application state
- Set up real-time data flow (SSE/WebSocket)
- Handle cross-component communication
- Implement connection retry logic

### Phase 5: Styling Organization

- Copy all original CSS files verbatim
- Organize into `/src/lib/styles/hackrf/` and `/src/lib/styles/kismet/`
- Use CSS scoping to prevent conflicts
- Preserve all theme switching logic exactly

### Phase 6: Testing and Validation

- Visual regression testing (0% difference tolerance)
- Functional testing of all features
- Performance benchmarking
- Cross-browser compatibility verification

### Phase 7: Deployment Preparation

- Build configuration for production
- Systemd service setup
- Environment variable management
- Rollback strategy

### Phase 8: Cutover

- Staged deployment alongside existing services
- Gradual traffic migration
- Stop HackRF service on port 3002
- Keep Express backend running on port 8005
- Deploy SvelteKit frontend on port 8006
- Monitor for issues

## Architecture Overview

### Port Configuration

- **Port 8005**: Express.js Backend API
    - Handles all business logic
    - WebSocket server for real-time updates
    - Proxies to external services (Kismet, WigleToTAK, etc.)
    - RESTful API endpoints
- **Port 8006**: SvelteKit Frontend
    - Serves the user interface
    - Makes API calls to backend on port 8005
    - Handles client-side routing and state

### Data Flow

1. User accesses frontend on port 8006
2. Frontend makes API requests to backend on port 8005
3. Backend processes requests and communicates with services
4. Real-time updates flow through WebSocket connection to backend

## Project Structure

```
/home/pi/projects/ArgosFinal/ (SvelteKit Frontend - Port 8006)
├── src/
│   ├── routes/
│   │   ├── hackrf/          # HackRF Monitor pages
│   │   └── kismet/          # Kismet Operations pages
│   ├── lib/
│   │   ├── components/      # Shared Svelte components
│   │   ├── stores/          # State management
│   │   ├── styles/          # Preserved CSS files
│   │   │   ├── hackrf/      # HackRF original styles
│   │   │   └── kismet/      # Kismet original styles
│   │   └── services/        # API client services
│   │       ├── api/         # HTTP API clients
│   │       └── websocket/   # WebSocket clients
│   └── app.css              # Global styles (imports originals)

Express Backend (Port 8005) - Separate Project
├── routes/
│   ├── hackrf.js            # HackRF API endpoints
│   ├── kismet.js            # Kismet API endpoints
│   ├── system.js            # System API endpoints
│   └── wigleProxy.js        # WigleToTAK proxy endpoints
├── services/
│   ├── hackrfService.js     # HackRF business logic
│   ├── kismetService.js     # Kismet integration
│   └── websocketHandler.js  # WebSocket management
└── server.js                # Express server setup
```

## Success Criteria

### Design Preservation ✓

- Users see NO visual difference
- All animations work identically
- Theme switching preserved
- No layout shifts or changes

### Functional Preservation ✓

- All features work exactly the same
- API compatibility maintained
- Real-time updates functioning
- Hardware integration working

### Technical Success ✓

- Single unified codebase
- Improved developer experience
- Easier maintenance
- Better performance

## Timeline

- **Phase 0-1**: 4-6 hours (setup and audit)
- **Phase 2-3**: 18-28 hours (core migration)
- **Phase 4-5**: 10-14 hours (state and styling)
- **Phase 6-8**: 12-16 hours (testing and deployment)
- **Total**: 44-64 hours

## Critical Reminders

1. **This is NOT a redesign** - preserve everything exactly
2. **Any visual change is a failure**
3. **Do not "improve" anything during migration**
4. **Test visually at every step**
5. **Success = invisible migration to users**

## Next Steps

1. Complete design audit of both applications
2. Set up development environment
3. Begin with HackRF API migration (simpler architecture)
4. Migrate Kismet APIs with proxy handling
5. Convert frontend components one at a time
6. Extensive testing before any cutover

The goal is a seamless consolidation where users experience no change except potentially better performance and reliability from the unified architecture.
