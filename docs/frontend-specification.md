# Argos Front-End Specification Document

## 1. Executive Summary

Argos is a comprehensive RF (Radio Frequency) signal monitoring and analysis platform built with SvelteKit. The system provides real-time visualization, analysis, and tracking of various wireless signals including WiFi, cellular (GSM), drone communications, and general RF emissions. The front-end is designed as a mission-critical tactical intelligence platform with a focus on real-time data visualization and responsive performance.

## 2. Technology Stack

### Core Framework
- **SvelteKit** (v2.22.3) - Full-stack framework with SSR capabilities
- **Svelte** (v5.35.5) - Reactive component framework
- **TypeScript** (v5.8.3) - Type-safe development
- **Vite** (v7.0.3) - Build tool and dev server

### UI & Styling
- **Tailwind CSS** (v3.4.15) - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Custom Design System** - Monochromatic theme with tactical aesthetics
- **Glass Morphism Effects** - Modern UI with transparency and blur effects

### Data Visualization
- **Leaflet** (v1.9.4) - Interactive mapping library
- **Leaflet.heat** - Heatmap visualization
- **Leaflet.markercluster** - Marker clustering for performance
- **Cytoscape** (v3.32.0) - Network graph visualization
- **Deck.gl** (v9.1.12) - WebGL-powered data visualization

### Real-Time Communication
- **WebSockets** (ws v8.18.3) - Bidirectional real-time data streaming
- **Server-Sent Events** - Unidirectional event streaming
- **EventSource** - SSE client implementation

### Data Management
- **Svelte Stores** - Reactive state management
- **Better-SQLite3** (v12.2.0) - Embedded database
- **Zod** (v3.25.76) - Schema validation

## 3. Application Architecture

### 3.1 Project Structure

```
src/
├── routes/                    # SvelteKit pages and API endpoints
│   ├── +page.svelte          # Main dashboard/home page
│   ├── api/                  # RESTful API endpoints
│   ├── droneid/              # Drone ID detection interface
│   ├── fusion/               # Unified security center
│   ├── gsm-evil/             # GSM/cellular analysis
│   ├── hackrf/               # HackRF spectrum analysis
│   ├── kismet/               # WiFi network discovery
│   ├── rtl-433/              # RTL-SDR signal decoder
│   ├── tactical-map-simple/  # Signal visualization map
│   ├── usrpsweep/            # USRP spectrum sweep
│   └── wigletotak/           # Data broadcasting
├── lib/
│   ├── components/           # Reusable UI components
│   ├── services/             # Business logic and API clients
│   ├── stores/               # Svelte stores for state management
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   └── styles/               # Global styles and themes
└── app.css                   # Global application styles
```

### 3.2 Component Architecture

The application follows a hierarchical component structure:

1. **Page Components** (`routes/*/+page.svelte`)
   - Top-level views for each mission/feature
   - Handle route-level data loading and error boundaries
   - Compose smaller components

2. **Feature Components** (`lib/components/*/`)
   - Domain-specific UI modules (kismet, hackrf, map, etc.)
   - Self-contained with their own state and styles
   - Reusable across different pages

3. **Shared Components** (`lib/components/`)
   - Generic UI elements used throughout the app
   - Navigation, modals, alerts, status indicators

## 4. Routing & Navigation

### 4.1 Route Structure

The application uses file-based routing with the following main sections:

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/` | Main dashboard | Mission selection grid |
| `/kismet` | WiFi network discovery | Device list, map view, statistics |
| `/tactical-map-simple` | Signal visualization | Real-time heatmap, RSSI localization |
| `/hackrf` | Spectrum analysis | Waterfall display, frequency sweeping |
| `/usrpsweep` | USRP spectrum sweep | Advanced SDR control |
| `/gsm-evil` | GSM/cellular analysis | IMSI detection, tower mapping |
| `/fusion` | Security center | Unified dashboard, packet analysis |
| `/rtl-433` | Signal decoder | IoT device detection |
| `/droneid` | Drone detection | Remote ID monitoring |
| `/wigletotak` | TAK integration | Data export and broadcasting |

### 4.2 Navigation Pattern

- **Mission-based navigation**: Main dashboard presents all available missions
- **Persistent header/navigation**: Not used - each mission is self-contained
- **Back navigation**: Browser back button or explicit "Return to Console" links
- **Deep linking**: All major views support direct URL access

### 4.3 API Routes

RESTful API endpoints follow the pattern `/api/{service}/{action}`:

```
/api/kismet/start
/api/kismet/stop
/api/kismet/status
/api/hackrf/start-sweep
/api/hackrf/stop-sweep
/api/gsm-evil/scan
/api/signals/batch
```

## 5. UI/UX Design System

### 5.1 Visual Design Principles

1. **Tactical Aesthetic**: Military-inspired interface suitable for field operations
2. **Dark Theme**: Optimized for low-light conditions and reduced eye strain
3. **Monochromatic Base**: Grayscale palette with selective color for emphasis
4. **Information Density**: Maximum data visibility without clutter
5. **Real-time Focus**: Live data prominently displayed

### 5.2 Color Palette

```css
/* Core Monochromatic Palette */
--bg-primary: #0a0a0a;        /* Main background */
--bg-secondary: #141414;      /* Card backgrounds */
--text-primary: #ffffff;      /* Primary text */
--text-secondary: #a3a3a3;    /* Secondary text */
--border-primary: #262626;    /* Default borders */

/* Accent Colors (Used Sparingly) */
--accent-primary: #fb923c;    /* Orange - Primary actions */
--accent-success: #68d391;    /* Green - Success states */
--accent-warning: #fbbf24;    /* Yellow - Warnings */
--accent-danger: #dc2626;     /* Red - Errors/dangers */

/* Signal Strength Colors */
--signal-weak: #60a5fa;       /* Blue */
--signal-moderate: #fbbf24;   /* Yellow */
--signal-strong: #ff6b35;     /* Orange */
--signal-very-strong: #dc2626;/* Red */
```

### 5.3 Typography

- **Font Family**: System fonts for performance
- **Heading Hierarchy**: 
  - H1: 3rem (48px) - Page titles
  - H2: 2rem (32px) - Section headers
  - H3: 1.5rem (24px) - Subsections
  - Body: 1rem (16px) - Standard text
  - Small: 0.875rem (14px) - Secondary info

### 5.4 Component Patterns

1. **Glass Panels**: Semi-transparent backgrounds with backdrop blur
2. **Status Indicators**: Color-coded dots/badges for system states
3. **Data Cards**: Consistent card layout for information display
4. **Control Buttons**: Large touch targets for field use
5. **Real-time Updates**: Pulsing animations for live data

### 5.5 Responsive Design

- **Mobile First**: Optimized for tablets and phones
- **Breakpoints**:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
- **Touch Optimization**: Minimum 44px touch targets
- **Flexible Grids**: CSS Grid and Flexbox for layouts

## 6. State Management

### 6.1 Store Architecture

The application uses Svelte stores for reactive state management:

```typescript
// Connection State
export const connectionStatus: Writable<ConnectionStatus>

// Service-Specific Stores
export const spectrumData: Writable<SpectrumData>      // HackRF
export const kismetDevices: Writable<KismetDevice[]>    // Kismet
export const gsmData: Writable<GSMData>                 // GSM Evil
export const droneDetections: Writable<DroneDetection[]> // Drone ID

// UI State
export const notifications: Writable<Notification[]>
export const activeModals: Writable<Modal[]>
```

### 6.2 Data Flow Pattern

1. **API → Store**: Services fetch data and update stores
2. **Store → Component**: Components subscribe to store changes
3. **Component → API**: User actions trigger API calls
4. **Real-time Updates**: WebSocket/SSE updates stores directly

### 6.3 Store Features

- **Derived Stores**: Computed values from base stores
- **Custom Stores**: Extended functionality (e.g., `createWebSocketStore`)
- **Persistence**: Selected stores sync with localStorage
- **Reset Functions**: Clear state on navigation/logout

## 7. Real-Time Features

### 7.1 WebSocket Implementation

```typescript
// Connection management with auto-reconnect
class WebSocketManager {
  - Automatic reconnection with exponential backoff
  - Message queuing during disconnection
  - Connection state tracking
  - Error handling and recovery
}
```

### 7.2 Server-Sent Events

Used for unidirectional streaming:
- Signal detection events
- System status updates
- Progress indicators

### 7.3 Performance Optimizations

1. **Data Throttling**: Limit update frequency for high-volume streams
2. **Virtual Scrolling**: For large device/signal lists
3. **Web Workers**: Offload heavy computations (grid processing, interpolation)
4. **Selective Updates**: Only update changed DOM elements

## 8. Map & Visualization Features

### 8.1 Tactical Map

- **Base Layer**: OpenStreetMap or offline tiles
- **Signal Overlay**: Real-time heatmap visualization
- **Device Markers**: Clustered for performance
- **3D Terrain**: Optional elevation data
- **MGRS Grid**: Military grid reference system

### 8.2 Signal Visualization

1. **Heatmap Rendering**: WebGL-accelerated using deck.gl
2. **RSSI Localization**: Triangulation algorithms
3. **Time-based Filtering**: Historical playback
4. **Signal Clustering**: K-means clustering for patterns

### 8.3 Spectrum Analysis

- **Waterfall Display**: Real-time frequency visualization
- **FFT Processing**: Client-side signal processing
- **Peak Detection**: Automatic signal identification
- **Zoom & Pan**: Interactive frequency exploration

## 9. Component Library

### 9.1 Core Components

```
components/
├── kismet/
│   ├── DeviceList.svelte       # WiFi device listing
│   ├── MapView.svelte           # Device location mapping
│   ├── StatisticsPanel.svelte  # Network statistics
│   └── ServiceControl.svelte   # Start/stop controls
├── hackrf/
│   ├── SpectrumChart.svelte    # Frequency spectrum display
│   ├── SweepControl.svelte     # Sweep parameters
│   ├── SignalAnalysis.svelte   # Signal identification
│   └── TimeWindowControl.svelte # Time filtering
├── map/
│   ├── SignalOverlay.svelte    # Heatmap layer
│   ├── MapControls.svelte      # Zoom/pan/layers
│   ├── SignalList.svelte       # Signal sidebar
│   └── FilterControls.svelte   # Signal filtering
└── shared/
    ├── StatusIndicator.svelte   # Service status dots
    ├── ConnectionStatus.svelte  # WebSocket state
    ├── AlertPanel.svelte        # System notifications
    └── LoadingSpinner.svelte    # Loading states
```

### 9.2 Component Patterns

1. **Props Interface**: TypeScript interfaces for all props
2. **Event Dispatching**: Custom events for parent communication
3. **Slot Usage**: Flexible content projection
4. **Accessibility**: ARIA labels and keyboard navigation

## 10. Performance Considerations

### 10.1 Optimization Strategies

1. **Code Splitting**: Route-based chunking
2. **Lazy Loading**: Components loaded on demand
3. **Image Optimization**: WebP format, responsive images
4. **Bundle Size**: Tree shaking, minification
5. **Caching**: Service worker for offline support

### 10.2 Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 500KB initial load
- **Memory Usage**: < 200MB typical operation

## 11. Security Features

### 11.1 Client-Side Security

1. **Input Validation**: Zod schemas for all user input
2. **XSS Prevention**: Svelte's automatic escaping
3. **CSP Headers**: Content Security Policy
4. **Secure WebSockets**: WSS protocol only

### 11.2 Authentication

- **Session-based**: HttpOnly cookies
- **API Token**: Bearer tokens for API access
- **Role-based Access**: Admin/operator/viewer roles

## 12. Testing Strategy

### 12.1 Test Coverage

```
tests/
├── unit/           # Component logic tests
├── integration/    # API integration tests
├── e2e/           # End-to-end user flows
├── visual/        # Visual regression tests
└── performance/   # Load and performance tests
```

### 12.2 Testing Tools

- **Vitest**: Unit and integration testing
- **Playwright**: E2E testing
- **Testing Library**: Component testing
- **Puppeteer**: Visual regression

## 13. Build & Deployment

### 13.1 Build Process

```bash
npm run build
# - TypeScript compilation
# - Svelte compilation
# - CSS processing
# - Bundle optimization
# - Asset hashing
```

### 13.2 Deployment Targets

- **Development**: Local Raspberry Pi
- **Production**: DragonOS on field devices
- **Docker**: Containerized deployment
- **SystemD**: Service management

## 14. Browser Support

- **Chrome/Chromium**: Full support (primary)
- **Firefox**: Full support
- **Safari**: Limited WebGL features
- **Mobile**: iOS Safari, Chrome Android

## 15. Future Enhancements

1. **Progressive Web App**: Offline functionality
2. **WebRTC**: Peer-to-peer data sharing
3. **Machine Learning**: Signal classification
4. **AR Visualization**: Augmented reality overlay
5. **Multi-language**: i18n support

## 16. Developer Guidelines

### 16.1 Code Style

- **ESLint**: Enforce code standards
- **Prettier**: Consistent formatting
- **TypeScript**: Strict mode enabled
- **Naming Conventions**: 
  - Components: PascalCase
  - Files: kebab-case
  - Variables: camelCase

### 16.2 Git Workflow

- **Branch Naming**: feature/*, fix/*, docs/*
- **Commit Messages**: Conventional commits
- **PR Process**: Review required
- **CI/CD**: Automated testing

### 16.3 Documentation

- **Component Docs**: JSDoc comments
- **API Docs**: OpenAPI specification
- **User Guides**: Markdown in /docs
- **Architecture Decisions**: ADR format

---

This specification serves as the authoritative reference for the Argos front-end implementation. All development should align with these patterns and principles to maintain consistency and quality across the platform.