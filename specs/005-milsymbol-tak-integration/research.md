# Research & Technical Decisions: MIL-STD-2525 & TAK Integration

**Feature**: `005-milsymbol-tak-integration`
**Date**: 2026-02-17

## 1. Symbol Rendering Library

**Decision**: Use [`@missioncommand/mil-sym-ts`](https://www.npmjs.com/package/@missioncommand/mil-sym-ts).

**Rationale**:

- **Compliance**: Supports MIL-STD-2525D and 2525E standards, ensuring interoperability with modern TAK clients.
- **Format**: Generates SVG strings, which can be directly used as `ImageSource` or `Marker` elements in MapLibre GL JS without canvas overhead if desired, or rendered to Canvas for performance.
- **TypeScript**: Native TypeScript support aligns with project standards.
- **Alternatives Considered**:
    - `milsymbol`: Older, less active maintenance for newer standards.
    - Custom SVG Sprites: Too complex to maintain 1000s of symbol combinations manually.

## 2. TAK Server Connectivity

**Decision**: Use [`@tak-ps/node-tak`](https://www.npmjs.com/package/@tak-ps/node-tak).

**Rationale**:

- **Protocol Support**: Handles the complexity of COT-over-TCP/TLS, including the specific framing required by TAK servers.
- **Authentication**: Built-in support for `.p12` certificate extraction and mutual TLS (mTLS), which is a hard requirement.
- **Event Driven**: Emits `cot` events that map cleanly to our internal event bus.
- **Alternatives Considered**:
    - `net` module (Raw TCP): Would require re-implementing the XML framing and CoT parsing logic, increasing risk of bugs.

## 3. Map Tile Strategy (Google Hybrid)

**Decision**: Use MapLibre `raster` source with XYZ templates.

**Rationale**:

- **Native Support**: MapLibre has built-in support for raster tiles.
- **Performance**: Raster tiles are performant on the GPU.
- **Flexibility**: Supports any XYZ provider (Google, Bing, Esri, OpenStreetMap).
- **Implementation**:
    ```typescript
    map.addSource('satellite-hybrid', {
    	type: 'raster',
    	tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
    	tileSize: 256
    });
    ```
- **Risk**: Google Maps Terms of Service. User must provide the URL or API key if we don't want to embed it directly (Project policy: "Custom Source Support").

## 4. Certificate Storage Security

**Decision**: Filesystem storage with restricted permissions (`0600`).

**Rationale**:

- **Persistence**: Certificates must survive reboots.
- **Security**: Storing in DB is risky if DB is exported. Filesystem ACLs are robust on Linux.
- **Path**: `data/certs/${userId}/client.p12`.
- **Permissions**:
    - Directory: `0700` (rwx------) - Owner only.
    - File: `0600` (rw-------) - Owner read/write only.

## 5. Data Flow (CoT Updates)

**Decision**: Bidirectional WebSocket Bridge.

**Rationale**:

- **Inbound (TAK -> Argos)**: `node-tak` receives TCP packet -> Parses XML -> Node.js Event -> WebSocket Server -> Frontend (GeoJSON).
- **Outbound (Argos -> TAK)**: Frontend Action / Auto-Update -> WebSocket Client -> Node.js Event -> `node-tak` (XML Builder) -> TCP Socket.
- **Latency**: WebSocket is the only viable option for < 16ms goal.
