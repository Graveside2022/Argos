# TAK Integration Research: Architecture Overview

**Date:** 2026-02-16
**Purpose:** Research TAK (Team Awareness Kit) architecture and data flow for integration with Argos (SvelteKit on Raspberry Pi 5)
**Scope:** Pure research -- no code implementation

---

## 1. TAK Ecosystem Overview

### What is TAK?

TAK (Team Awareness Kit) is a suite of geospatial situational awareness applications originally developed by the Air Force Research Laboratory (AFRL) and maintained by the TAK Product Center (TPC) under the Department of Defense. It provides real-time Common Operating Picture (COP) capabilities for military, law enforcement, and emergency response teams.

TAK enables operators to share position data, sensor feeds, imagery, routes, and other tactical information on a shared map in real time. It uses the **Cursor on Target (CoT)** data format, an XML-based schema developed by MITRE Corporation for exchanging time-sensitive positional data -- the "what, when, and where" of moving objects.

### TAK Client Variants

| Client                 | Platform    | Primary Use Case                                                                                                                                                 |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ATAK** (Android TAK) | Android     | Field operators, dismounted soldiers, first responders. Most mature and feature-rich client. Extensible plugin architecture. Open-sourced as ATAK-CIV.           |
| **WinTAK**             | Windows     | Command centers, TOCs (Tactical Operations Centers). Larger screen real estate for mission planning and oversight.                                               |
| **iTAK**               | iOS/iPadOS  | Apple device users. More recent addition to the ecosystem.                                                                                                       |
| **WebTAK**             | Web browser | Browser-based client served by TAK Server. Accessible at `https://<server>:8446/webtak`. No installation required. Closest analog to what Argos would implement. |

All clients share the same underlying CoT protocol and can interoperate seamlessly through a TAK Server.

### TAK Server Architecture

TAK Server is the central hub that facilitates communication between TAK clients. It operates as a message broker, data store, and authentication authority.

**Core responsibilities:**

- **Message routing**: Receives CoT events from clients, routes them to other connected clients (unicast, multicast, or broadcast)
- **Data persistence**: Stores mission data, CoT events, data packages, and file shares in a database (PostgreSQL for official TAK Server)
- **Authentication & authorization**: Manages client certificates, user roles, and group-based access control
- **Mission management**: Supports "missions" as server-side data collections that clients can subscribe to for dynamic updates
- **Federation**: Connects multiple TAK Servers together for inter-organizational data sharing
- **REST API (Marti API)**: Exposes HTTPS endpoints for programmatic access to missions, data packages, contacts, and server configuration

### TAK Server Variants

There are three primary TAK Server implementations available:

#### Official TAK Server (TAK Product Center)

- **Source**: [TAK-Product-Center/Server](https://github.com/TAK-Product-Center/Server) on GitHub
- **Language**: Java
- **Database**: PostgreSQL (with PostGIS for spatial queries)
- **License**: Released as open source in 2022
- **Features**: Full feature set -- TLS, federation, certificate enrollment, groups/channels, device profiles, Marti REST API, WebTAK hosting
- **Deployment**: Docker or bare-metal. Runs on Raspberry Pi but resource-heavy
- **Actively developed**: Yes

#### FreeTAKServer (FTS)

- **Source**: [FreeTAKTeam/FreeTakServer](https://github.com/FreeTAKTeam/FreeTakServer) on GitHub
- **Language**: Python 3
- **Database**: SQLite (default) via SQLAlchemy
- **License**: Eclipse Public License
- **Architecture**: MVC pattern with domain classes generated from UML models using Model Driven Architecture
- **Features**: TCP/SSL, data packages, DataSync, ExCheck, video streaming, Node-RED integration, REST API, web UI
- **Limitations**: No certificate enrollment, no groups/channels, no federation (recently), no EUD authentication
- **Status**: Development has slowed significantly; marked as not actively developed in feature comparisons
- **Default ports**: CoT TCP 8087, SSL CoT 8089, API 19023, Federation 9000

#### OpenTAKServer (OTS)

- **Source**: [brian7704/OpenTAKServer](https://github.com/brian7704/OpenTAKServer) on GitHub
- **Language**: Python
- **Database**: PostGIS (default) via SQLAlchemy
- **License**: Open source
- **Features**: Superset of FreeTAKServer capabilities -- automatic CA generation, certificate enrollment, video recording/playback, Meshtastic support, ADS-B integration, Mumble server auth, device profiles, groups/channels
- **Explicitly supports Raspberry Pi**: Yes
- **Actively developed**: Yes
- **Best choice for RPi5 deployment**: Lightweight, feature-rich, actively maintained

**Feature Comparison Summary:**

| Feature                | Official TAK Server | FreeTAKServer | OpenTAKServer  |
| ---------------------- | ------------------- | ------------- | -------------- |
| TCP/SSL                | Yes                 | Yes           | Yes            |
| Certificate Enrollment | Yes                 | No            | Yes            |
| Auto CA Generation     | No                  | No            | Yes            |
| Federation             | Yes                 | Yes           | Coming (1.7.0) |
| Data Packages          | Yes                 | Yes           | Yes            |
| Groups/Channels        | Yes                 | No            | Yes            |
| Runs on RPi            | Yes (heavy)         | Yes           | Yes            |
| Meshtastic Support     | No                  | No            | Yes            |
| Actively Developed     | Yes                 | No            | Yes            |

---

## 2. Data Flow Architecture

### How Data Flows Between TAK Clients and TAK Server

The fundamental data unit in TAK is a **CoT (Cursor on Target) event** -- an XML document describing a "thing" at a location at a time. Every position update, chat message, sensor reading, route waypoint, and alert is encoded as a CoT event.

```
                    CoT Events (TCP/TLS)
  +-----------+     ===================>     +------------+
  | ATAK      | <========================== | TAK Server |
  | (Android) |     CoT Events (TCP/TLS)    |            |
  +-----------+                              |  - Routes  |
                                             |  - Stores  |
  +-----------+     ===================>     |  - Auth    |
  | WinTAK    | <========================== |  - API     |
  | (Windows) |                              |            |
  +-----------+                              +-----+------+
                                                   |
  +-----------+     ===================>           |
  | Argos     | <=========================        |
  | (RPi5)    |     CoT Events (TCP/TLS)          |
  +-----------+                                    |
                                                   |
  +-----------+     HTTPS (Marti API)              |
  | WebTAK    | <=================================-+
  | (Browser) |     Port 8443/8446
  +-----------+
```

### Connection Lifecycle

1. **Client connects** to TAK Server on the CoT streaming port (TCP 8087 or TLS 8089)
2. **TLS handshake** (if using secure port): Mutual TLS authentication using client certificate + server certificate. Both parties validate each other's identity.
3. **Client sends SA (Situational Awareness) message**: An initial CoT event announcing the client's UID, callsign, type (e.g., `a-f-G-U-C` for friendly ground unit combat), and position
4. **Server acknowledges** and begins forwarding CoT events from other connected clients
5. **Continuous exchange**: Client periodically sends position updates (SA messages). Server forwards events from all other clients to this client. Default SA broadcast interval: at least every 60 seconds for mesh, configurable for server connections.
6. **Stale timeout**: If a client stops sending updates, its marker on other clients' maps goes "stale" (grayed out) after the `stale` timestamp in its last CoT event passes. Typically 2-5 minutes.
7. **Disconnection**: Client closes TCP connection. Server removes client from active routing. Other clients see the marker go stale.

### Protocols and Transports

TAK supports multiple transport mechanisms:

#### TCP (Plain Text) -- Port 8087

- **Use case**: Development, testing, trusted networks
- **Format**: CoT XML or TAK Protocol v1 (Protobuf) over raw TCP stream
- **No encryption**: Data transmitted in clear text
- **Simplest integration path** for initial development

#### TLS (Encrypted) -- Port 8089

- **Use case**: Production deployments, classified/sensitive operations
- **Format**: Same CoT payloads, wrapped in TLS
- **Mutual authentication**: Both client and server present X.509 certificates
- **Certificate distribution**: Via "data packages" (ZIP files containing truststore, client cert, and connection preferences)
- **Required for operational use**

#### HTTPS REST API (Marti API) -- Port 8443

- **Use case**: Programmatic access to server data, mission management, data package upload/download
- **Authentication**: Client certificate or admin certificate
- **Key endpoints**:
    - `GET /Marti/api/missions` -- List missions
    - `PUT /Marti/api/missions/<name>` -- Create mission
    - `GET /Marti/api/contacts/all` -- List connected contacts
    - `POST /Marti/api/sync/upload` -- Upload data package
    - `GET /Marti/api/cot/xml/<uid>` -- Get latest CoT for a UID

#### UDP Multicast (Mesh SA) -- 239.2.3.1:6969

- **Use case**: Peer-to-peer, no server required, tactical mesh networks
- **Format**: One CoT XML message per UDP datagram
- **Range**: Local network only (multicast does not traverse routers without special configuration)
- **Default multicast address**: `239.2.3.1`, port `6969`
- **Not relevant for Argos-to-TAK-Server integration** but important context for understanding TAK

#### WebTAK -- Port 8446

- **Use case**: Browser-based access
- **Protocol**: HTTPS + WebSocket for real-time updates
- **Served by TAK Server itself** (the WebTAK HTML/JS app is hosted on the server)

### TAK Protocol Versions

TAK has evolved its wire protocol over time:

#### Version 0 (Legacy XML)

- Pure CoT XML transmitted as plain text over TCP/UDP
- No framing header -- XML documents concatenated in the TCP stream
- Still supported for backward compatibility

#### Version 1 (Protobuf with TAK Header)

- Google Protocol Buffer encoding of CoT events
- Custom header format for message framing:
    - **Magic byte**: `0xBF` (191 decimal)
    - **Protocol version**: `0x00` for XML, `0x01` for Protobuf
    - Two sub-formats depending on transport:

**Mesh format** (UDP multicast):

```
[0xBF] [0x01] [0xBF] [protobuf payload]
```

Static 3-byte header: magic, version, magic, then payload.

**Stream format** (TCP to TAK Server):

```
[0xBF] [varint payload length] [protobuf payload]
```

Dynamic header: magic byte, then a varint-encoded payload length, then payload. The varint allows the TCP receiver to know exactly how many bytes to read for the complete message.

The Protobuf payload is a serialized `atakmap.commoncommo.v1.TakMessage` message. The `.proto` definition is available in the [AndroidTacticalAssaultKit-CIV](https://github.com/deptofdefense/AndroidTacticalAssaultKit-CIV/tree/main/commoncommo/core/impl/protobuf) repository.

### CoT XML Structure

Every CoT event follows this structure:

```xml
<event version="2.0"
       uid="ANDROID-deadbeef"
       type="a-f-G-U-C"
       how="m-g"
       time="2026-02-16T14:30:00.000Z"
       start="2026-02-16T14:30:00.000Z"
       stale="2026-02-16T14:35:00.000Z">

  <point lat="32.3732"
         lon="-86.2998"
         hae="125.0"
         ce="9.9"
         le="9999999.0"/>

  <detail>
    <contact callsign="ARGOS-01"/>
    <__group name="Cyan" role="Team Member"/>
    <status battery="87"/>
    <track speed="0.0" course="270.0"/>
    <remarks>Argos EW station alpha</remarks>
    <precisionlocation altsrc="GPS" geopointsrc="GPS"/>
  </detail>
</event>
```

**Event attributes:**

- `uid`: Globally unique identifier for this entity (persists across messages)
- `type`: Hierarchical classification string (see below)
- `how`: How the position was determined (`m-g` = machine GPS, `h-e` = human estimated)
- `time`: When the event was generated
- `start`: When the event became relevant
- `stale`: When the event should be considered outdated

**Type field hierarchy** (hyphen-delimited):

```
a - f - G - U - C
|   |   |   |   |
|   |   |   |   +-- Function: Combat (from MIL-STD-2525)
|   |   |   +------ Dimension detail: Unit
|   |   +---------- Battle dimension: Ground
|   +-------------- Affiliation: Friendly
+------------------ Root: Atom (real-world object)
```

Common affiliation codes: `f` (friendly), `h` (hostile), `u` (unknown), `n` (neutral), `s` (suspect), `a` (assumed friend), `p` (pending)

Common roots: `a` (atoms/objects), `b` (bits/data), `t` (tasking), `r` (reservation)

**Point attributes:**

- `lat`, `lon`: WGS-84 coordinates
- `hae`: Height above ellipsoid (meters)
- `ce`: Circular error (meters) -- horizontal accuracy
- `le`: Linear error (meters) -- vertical accuracy

**Detail sub-elements** (partial list):

- `contact`: Callsign, frequency, email, phone
- `__group`: Team color and role
- `status`: Battery level, readiness
- `track`: Speed and course
- `remarks`: Free-text annotations
- `sensor`: Sensor field-of-view and orientation
- `shape`: Complex geometries (ellipse, polyline)
- `link`: References to other entities
- `__serverdestination`: Message routing directives
- `__flow-tags__`: Processing chain fingerprints

---

## 3. Lightweight TAK Client on RPi5

### What a Minimal TAK Client Needs

For Argos integration, the TAK client does not need to be a full-featured ATAK equivalent. It needs to:

1. **Connect** to a TAK Server via TCP (port 8087) or TLS (port 8089)
2. **Authenticate** using client certificate (for TLS connections)
3. **Send SA (self-announcement)** CoT events periodically with the RPi5's GPS position, identifying Argos as a friendly ground unit
4. **Receive CoT events** from other connected clients (blue force tracking positions, alerts, chat messages)
5. **Maintain heartbeat**: Send position updates at regular intervals (typically every 15-60 seconds) to prevent stale timeout
6. **Parse incoming CoT**: Extract position, type, callsign, and relevant detail fields from received events
7. **Handle reconnection**: Automatically reconnect if the TCP/TLS connection drops

### Option A: PyTAK (Python, asyncio)

**Repository**: [snstac/pytak](https://github.com/snstac/pytak)
**Install**: `pip install pytak`
**License**: Open source

PyTAK is the most mature and widely-used Python library for TAK integration. It uses Python's `asyncio` framework with a queue-based worker architecture.

**Architecture:**

```
+------------------+
| CLITool          |  <-- Initializes queues and tasks, runs event loop
|  +-------------+ |
|  | tx_queue     | |  <-- Outbound CoT events (Argos -> TAK Server)
|  +-------------+ |
|  | rx_queue     | |  <-- Inbound CoT events (TAK Server -> Argos)
|  +-------------+ |
|  | Workers:     | |
|  |  Sender      | |  <-- QueueWorker subclass, generates CoT, puts on tx_queue
|  |  Receiver    | |  <-- QueueWorker subclass, reads from rx_queue, processes
|  |  Transmitter | |  <-- Built-in, sends tx_queue items to TAK Server
|  |  Receiver    | |  <-- Built-in, receives from TAK Server, puts on rx_queue
|  +-------------+ |
+------------------+
```

**Example -- sending position updates:**

```python
import asyncio
import pytak

class ArgosSender(pytak.QueueWorker):
    async def handle_data(self, data):
        """Called by run() to generate CoT events."""
        await self.put_queue(data)

    async def run(self):
        """Periodically send Argos position as CoT SA event."""
        while self.running:
            cot_xml = self._build_sa_event()
            await self.handle_data(cot_xml)
            await asyncio.sleep(30)  # Every 30 seconds

    def _build_sa_event(self):
        return f'''<event version="2.0" uid="ARGOS-RPI5-01"
            type="a-f-G-E-S" how="m-g"
            time="{now}" start="{now}" stale="{stale}">
          <point lat="{lat}" lon="{lon}" hae="{alt}" ce="10" le="999"/>
          <detail>
            <contact callsign="ARGOS-EW-01"/>
            <__group name="Yellow" role="Team Member"/>
            <remarks>EW Sensor Station</remarks>
          </detail>
        </event>'''

class ArgosReceiver(pytak.QueueWorker):
    async def handle_data(self, data):
        """Process incoming CoT events from TAK Server."""
        # Parse XML, extract position/type/callsign
        # Forward to Argos via HTTP API or IPC
        pass

    async def run(self):
        while self.running:
            data = await self.queue.get()
            await self.handle_data(data)

async def main():
    config = {
        "COT_URL": "tcp://takserver.example.com:8087",
        # For TLS: "COT_URL": "tls://takserver.example.com:8089",
        # "PYTAK_TLS_CLIENT_CERT": "/path/to/client.pem",
        # "PYTAK_TLS_CLIENT_KEY": "/path/to/client.key",
    }
    clitool = pytak.CLITool(config)
    await clitool.setup()
    clitool.add_tasks(set([ArgosSender(clitool.tx_queue), ArgosReceiver(clitool.rx_queue)]))
    await clitool.run()

asyncio.run(main())
```

**Pros:**

- Mature, well-documented, actively maintained
- Handles TCP/TLS/UDP transport automatically
- Supports both XML and Protobuf (with `takproto` module)
- Asyncio architecture fits well with event-driven patterns
- Lightweight, no external dependencies beyond Python stdlib

**Cons:**

- Python process -- requires running alongside the Node.js SvelteKit app
- IPC needed between Python TAK client and Node.js (HTTP API, Unix socket, or stdin/stdout)
- Adds Python dependency to the deployment

### Option B: @tak-ps/node-tak + @tak-ps/node-cot (Node.js/TypeScript)

**Repositories**:

- [dfpc-coe/node-tak](https://github.com/dfpc-coe/node-tak) -- TAK Server connection management + REST API SDK
- [dfpc-coe/node-CoT](https://github.com/dfpc-coe/node-CoT) -- CoT XML/Protobuf parsing and GeoJSON conversion

**Install**: `npm install @tak-ps/node-tak @tak-ps/node-cot`
**License**: MIT

This is the most compelling option for Argos because it is **native TypeScript** and runs in the same Node.js process as SvelteKit.

**Connection example:**

```typescript
import TAK from '@tak-ps/node-tak';
import CoT from '@tak-ps/node-cot';

// Connect to TAK Server via TLS
const tak = await TAK.connect('argos-ew-01', new URL('ssl://takserver.example.com:8089'), {
	key: fs.readFileSync('/path/to/client.key'),
	cert: fs.readFileSync('/path/to/client.pem')
});

// Receive CoT events from other TAK clients
tak.on('cot', async (cot: CoT) => {
	const geojson = cot.to_geojson();
	// Forward to Argos WebSocket clients for map rendering
	broadcastToClients('tak:cot', geojson);
});

tak.on('end', async () => {
	console.error('TAK connection closed, reconnecting...');
	// Implement reconnection logic
});

tak.on('error', async (err) => {
	console.error('TAK connection error:', err);
});

// Send Argos position as CoT event
function sendPosition(lat: number, lon: number, alt: number) {
	const cot = new CoT(`
    <event version="2.0" uid="ARGOS-RPI5-01"
      type="a-f-G-E-S" how="m-g"
      time="${new Date().toISOString()}"
      start="${new Date().toISOString()}"
      stale="${new Date(Date.now() + 120000).toISOString()}">
      <point lat="${lat}" lon="${lon}" hae="${alt}" ce="10" le="999"/>
      <detail>
        <contact callsign="ARGOS-EW-01"/>
      </detail>
    </event>
  `);
	tak.write(cot);
}
```

**CoT to GeoJSON conversion:**

```typescript
import CoT from '@tak-ps/node-cot';

const cot = new CoT('<event ...>...</event>');

// Convert to GeoJSON Feature (directly compatible with MapLibre GL)
const feature = cot.to_geojson();
// {
//   type: "Feature",
//   id: "ANDROID-deadbeef",
//   geometry: { type: "Point", coordinates: [-86.2998, 32.3732, 125.0] },
//   properties: {
//     callsign: "ALPHA-01",
//     type: "a-f-G-U-C",
//     speed: 0,
//     course: 270,
//     ...
//   }
// }
```

**REST API access (Marti API):**

```typescript
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

const api = await TAKAPI.init(
	new URL('https://takserver.example.com:8443'),
	new APIAuthCertificate(cert, key)
);

const missions = await api.Mission.list();
const contacts = await api.Contact.list();
```

**Pros:**

- **Native TypeScript** -- runs in the same Node.js process as SvelteKit
- **No IPC overhead** -- direct function calls, shared memory
- **GeoJSON output** from node-cot maps directly to MapLibre GL layers
- **Typed SDK** for the Marti REST API
- **MIT licensed**, actively maintained by Colorado DFPC Center of Excellence
- **CLI tool included** for testing connections

**Cons:**

- Newer library, smaller community than PyTAK
- API still evolving (frequent releases, 722+ versions for CloudTAK ecosystem)
- Less documentation than PyTAK

### Option C: tak.js (Lightweight Alternative)

**Repository**: [vidterra/tak.js](https://github.com/vidterra/tak.js)
**Install**: `npm install @vidterra/tak.js`

Lighter-weight library focused purely on message parsing (XML/Protobuf conversion). Does not handle TCP/TLS connections itself -- you would need to implement the transport layer manually.

**Pros:** Very lightweight, focused scope
**Cons:** API in development (v0.0.8), breaking changes expected, no connection management

### Option D: Custom TCP/TLS Client

For maximum control, implement a raw TCP/TLS client using Node.js `net` and `tls` modules.

```typescript
import * as tls from 'tls';
import * as fs from 'fs';

const options = {
	host: 'takserver.example.com',
	port: 8089,
	key: fs.readFileSync('client.key'),
	cert: fs.readFileSync('client.pem'),
	ca: fs.readFileSync('truststore-root.pem'),
	rejectUnauthorized: true
};

const socket = tls.connect(options, () => {
	console.log('Connected to TAK Server');
	// Send initial SA event
	socket.write(buildSAEvent());
});

let buffer = '';
socket.on('data', (data) => {
	buffer += data.toString();
	// Parse CoT XML events from buffer
	// Handle TAK Protocol v1 headers if present
	const events = extractCoTEvents(buffer);
	for (const event of events) {
		processCoTEvent(event);
	}
});
```

**Pros:** Zero dependencies, complete control over protocol handling
**Cons:** Must implement XML parsing, protocol header handling, reconnection logic, heartbeat management manually. Significant development effort.

### Recommended Approach for Argos

**Primary: `@tak-ps/node-tak` + `@tak-ps/node-cot`** (Option B)

Rationale:

1. Native TypeScript eliminates IPC complexity
2. Runs in the same Node.js process as SvelteKit server
3. GeoJSON output maps directly to existing MapLibre GL map layers in `DashboardMap.svelte`
4. Typed Marti API SDK for server-side operations
5. MIT license, active development, production-proven in CloudTAK

### Resource Considerations for RPi5

The Raspberry Pi 5 (8GB RAM, 4x Cortex-A76 @ 2.4GHz) is well-suited for running a TAK client alongside Argos:

| Component                        | RAM Estimate             | CPU Impact                                    |
| -------------------------------- | ------------------------ | --------------------------------------------- |
| Node.js (SvelteKit + TAK client) | ~200-400MB               | Low (event-driven, mostly I/O)                |
| CoT XML parsing                  | ~5-20MB per burst        | Negligible (small XML documents, ~1-5KB each) |
| GeoJSON conversion               | ~10-50MB for 100+ tracks | Low                                           |
| TLS handshake                    | Brief spike              | One-time per connection                       |
| Protobuf decoding                | ~2-5MB                   | Lower than XML parsing                        |

A typical TAK network with 20-50 active clients generates roughly 1-3 CoT events per second. Each event is 1-5KB of XML. This is trivially handled by the RPi5.

**Key constraint**: Argos already runs with `--max-old-space-size=1024` (1GB Node.js heap). The TAK client module must be memory-conscious -- avoid buffering large histories of CoT events in memory. Use the existing SQLite database for persistence if historical track data is needed.

---

## 4. Integration Architecture for Argos

### Current Argos Architecture Context

Argos is a SvelteKit application running on Raspberry Pi 5 with:

- **MapLibre GL** map rendering in `DashboardMap.svelte` with GeoJSON data sources
- **WebSocket server** (`src/lib/server/websocket-server.ts`) for real-time HackRF FFT and Kismet device data streaming to the browser
- **GPS integration** via `src/routes/api/gps/` endpoints feeding the `gpsStore`
- **Kismet integration** for WiFi device tracking on the tactical map
- **HackRF integration** for RF spectrum analysis
- **Authenticated API** with `ARGOS_API_KEY` and client certificates

### Proposed Integration Data Flow

```
+-------------------+         +---------------------------+
|   TAK Server      |         |   Argos (SvelteKit)       |
|                   |  TLS    |                           |
|  Port 8089 -------+-------->|  TAK Client Module        |
|  (CoT Stream)     |  TCP    |  (server-side only)       |
|                   |<--------+                           |
|  Port 8443 -------+-------->|  Marti API Client         |
|  (REST API)       |  HTTPS  |  (optional, for missions) |
+-------------------+         |                           |
                              |  +---------------------+  |
                              |  | CoT -> GeoJSON      |  |
                              |  | Transformer         |  |
                              |  | (@tak-ps/node-cot)  |  |
                              |  +----------+----------+  |
                              |             |              |
                              |             v              |
                              |  +---------------------+  |
                              |  | TAK Store            |  |
                              |  | (Svelte store)       |  |
                              |  | - contacts[]         |  |
                              |  | - tracks Map<uid>    |  |
                              |  | - alerts[]           |  |
                              |  +----------+----------+  |
                              |             |              |
                              |     SSE or  | WebSocket    |
                              |             v              |
                              |  +---------------------+  |
                              |  | Browser              |  |
                              |  | DashboardMap.svelte  |  |
                              |  | (MapLibre GL)        |  |
                              |  | - TAK contacts layer |  |
                              |  | - Track history      |  |
                              |  | - Alert markers      |  |
                              |  +---------------------+  |
                              +---------------------------+
```

### Component Breakdown

#### 1. TAK Client Module (Server-Side)

Location: `src/lib/server/tak/tak-client.ts`

Responsibilities:

- Establish and maintain TCP/TLS connection to TAK Server
- Send Argos position as periodic SA events (using GPS data from existing `gpsStore`)
- Receive and buffer incoming CoT events
- Automatic reconnection with exponential backoff
- Connection state management (connected, connecting, disconnected, error)

#### 2. CoT Transformer

Location: `src/lib/server/tak/cot-transformer.ts`

Responsibilities:

- Convert incoming CoT XML/Protobuf to GeoJSON Features using `@tak-ps/node-cot`
- Enrich with Argos-specific properties (signal correlation, device matching)
- Filter irrelevant event types (e.g., chat messages if not needed)
- Handle the CoT type hierarchy to assign appropriate map symbology

#### 3. TAK Store (Reactive State)

Location: `src/lib/stores/tactical-map/tak-store.ts`

Responsibilities:

- Maintain a Map of active TAK contacts (keyed by UID)
- Track contact history (last N positions for track lines)
- Emit updates when contacts change (new, moved, stale, removed)
- Provide GeoJSON FeatureCollection for MapLibre consumption

#### 4. TAK API Routes

Location: `src/routes/api/tak/`

Endpoints:

- `GET /api/tak/status` -- Connection state, server info, contact count
- `GET /api/tak/contacts` -- List of active TAK contacts as GeoJSON
- `POST /api/tak/send` -- Send a CoT event to TAK Server (e.g., alert, marker)
- `GET /api/tak/config` -- Current TAK connection configuration

#### 5. Map Layer (Browser)

Location: Addition to `src/lib/components/dashboard/DashboardMap.svelte`

Rendering:

- New GeoJSON source: `tak-contacts` fed from TAK store
- Symbol layer for contact icons (MIL-STD-2525 symbology or simplified icons)
- Line layer for track history
- Circle layer for position accuracy rings
- Popup with contact details (callsign, type, age, speed, course)

### How WebTAK Does It (Closest Analog)

WebTAK, the official browser-based TAK client, provides useful architectural reference:

- **Served by TAK Server** at `https://<server>:8446/webtak`
- **Authentication**: Client certificate loaded into the browser, or username/password
- **Real-time updates**: WebSocket connection from browser to TAK Server's WebSocket endpoint
- **Map rendering**: Custom map engine (not MapLibre, but similar concept)
- **Direct server connection**: The browser connects directly to TAK Server -- there is no intermediate application server

**Key difference with Argos**: Argos cannot connect directly from the browser to TAK Server because:

1. The browser would need the client certificate (security risk exposing certs to the browser)
2. CORS restrictions would block direct browser-to-TAK-Server connections
3. Argos needs to correlate TAK data with Kismet/HackRF/GPS data server-side

Therefore, the **server-side TAK client** architecture is correct for Argos: the SvelteKit server maintains the persistent TAK connection, processes events, and streams results to the browser via the existing WebSocket infrastructure.

### CloudTAK Architecture Reference

[CloudTAK](https://github.com/dfpc-coe/CloudTAK) is the most architecturally relevant reference implementation:

- **Frontend**: Vue.js with MapLibre GL (similar to Argos using SvelteKit + MapLibre GL)
- **Backend**: Node.js/TypeScript API server
- **TAK connection**: Server-side via `@tak-ps/node-tak` (same library recommended for Argos)
- **CoT processing**: `@tak-ps/node-cot` for parsing and GeoJSON conversion
- **ETL pipeline**: Brings non-TAK data into TAK format (analogous to Argos bringing Kismet/HackRF data into TAK)
- **Database**: PostgreSQL (Argos uses SQLite)
- **Deployment**: AWS CloudFormation or Docker Compose

CloudTAK proves that the `node-tak` + `node-cot` stack is production-viable for web-based TAK clients with MapLibre maps.

---

## 5. Network Requirements

### TAK Server Connectivity

For Argos on RPi5 to communicate with a TAK Server, the following network requirements must be met:

#### Ports (Outbound from RPi5)

| Port | Protocol | Purpose                            | Required?  |
| ---- | -------- | ---------------------------------- | ---------- |
| 8087 | TCP      | CoT streaming (plaintext)          | Dev only   |
| 8089 | TCP+TLS  | CoT streaming (encrypted)          | Production |
| 8443 | HTTPS    | Marti REST API                     | Optional   |
| 8446 | HTTPS    | WebTAK (reference only)            | No         |
| 9000 | TCP      | Federation (server-to-server only) | No         |

RPi5 initiates all connections (outbound). No inbound ports need to be opened on the RPi5 firewall for TAK client functionality.

### Tailscale VPN for RPi5 to TAK Server

In an Army EW training deployment, the TAK Server may be on a separate network (TOC network, NIPR, or cloud-hosted). Tailscale provides a zero-config WireGuard mesh VPN that simplifies connectivity.

**Architecture with Tailscale:**

```
+-------------------+          +------------------+         +---------------+
| RPi5 (Field)      |          | Tailscale Mesh   |         | TAK Server    |
| 100.x.y.z        |--------->| WireGuard tunnel |-------->| 100.a.b.c     |
| (tailscale0 iface)|          | (encrypted)      |         | Port 8089     |
+-------------------+          +------------------+         +---------------+
```

**Benefits for TAK integration:**

- RPi5 and TAK Server appear to be on the same network (Tailscale assigns stable 100.x.y.z IPs)
- All traffic encrypted by WireGuard (even if using TCP port 8087, the VPN encrypts the transport)
- No firewall rules to configure -- Tailscale handles NAT traversal
- Works across cellular, WiFi, satellite links
- MagicDNS provides hostnames: `tak-server.tailnet-name.ts.net`
- RPi5 already has Tailscale installed and configured (per project memory)

**TAK connection URL via Tailscale:**

```
tcp://tak-server.tailnet-name.ts.net:8087    # Dev (plaintext over encrypted VPN)
ssl://tak-server.tailnet-name.ts.net:8089    # Production (double encrypted)
```

Using plaintext TCP (port 8087) over Tailscale is a reasonable operational choice: the VPN already provides encryption, and eliminating TLS reduces certificate management complexity. However, for defense-in-depth, TLS (port 8089) is recommended even over VPN.

### Certificate-Based Authentication for TLS

TAK Server uses mutual TLS (mTLS) authentication. Both the client and server present X.509 certificates and validate each other.

**Certificate chain:**

```
Root CA (self-signed or organizational CA)
  |
  +-- TAK Server Certificate (server identity)
  |
  +-- Client Certificates (one per TAK client)
       |
       +-- ARGOS-RPI5-01.p12 (Argos client cert)
       +-- ALPHA-ATAK-01.p12 (soldier's ATAK cert)
       +-- BRAVO-WINTAK.p12 (TOC WinTAK cert)
```

**What Argos needs for TLS:**

1. **Client certificate** (`client.pem` or `.p12`): Identifies Argos to the TAK Server. Generated by the TAK Server admin.
2. **Client private key** (`client.key`): The private key for the client certificate.
3. **Truststore/CA certificate** (`truststore-root.pem` or `.p12`): The root CA certificate that signed the TAK Server's certificate. Used by Argos to verify the server's identity.

**How certificates are distributed in TAK:**

TAK Server generates a "data package" (ZIP file) for each client containing:

```
DataPackage.zip
  ├── certs/
  │   ├── truststore-intermediate-ca.p12   # CA cert (truststore)
  │   └── argos-rpi5-01.p12               # Client cert + key (PKCS12)
  ├── MANIFEST/
  │   └── manifest.xml                     # Package metadata
  └── preference.pref                      # Connection settings (server address, port)
```

The `.p12` (PKCS12) files are password-protected. For Node.js usage, they can be converted to PEM format:

```bash
# Extract client certificate
openssl pkcs12 -in argos-rpi5-01.p12 -clcerts -nokeys -out client.pem

# Extract client private key
openssl pkcs12 -in argos-rpi5-01.p12 -nocerts -nodes -out client.key

# Extract CA certificate from truststore
openssl pkcs12 -in truststore-intermediate-ca.p12 -clcerts -nokeys -out ca.pem
```

**Storage on RPi5:**

- Store certificates in `/home/kali/.config/argos/tak-certs/` (outside the git repo)
- Reference via environment variables in `.env`:
    ```
    TAK_SERVER_URL=ssl://tak-server.ts.net:8089
    TAK_CLIENT_CERT=/home/kali/.config/argos/tak-certs/client.pem
    TAK_CLIENT_KEY=/home/kali/.config/argos/tak-certs/client.key
    TAK_CA_CERT=/home/kali/.config/argos/tak-certs/ca.pem
    TAK_CLIENT_UID=ARGOS-RPI5-01
    TAK_CLIENT_CALLSIGN=ARGOS-EW-01
    ```

### Firewall Requirements

**RPi5 (client side):**

- Outbound TCP to TAK Server on ports 8087, 8089, 8443 -- ALLOW
- No inbound ports required for TAK client operation
- Tailscale (UDP 41641) must be allowed for VPN connectivity

**TAK Server (server side):**

- Inbound TCP on 8087, 8089, 8443 from RPi5's Tailscale IP -- ALLOW
- If using Tailscale ACLs, ensure the RPi5 node is authorized to reach the TAK Server node on the required ports

### Bandwidth Considerations

TAK is designed for low-bandwidth tactical networks. Typical bandwidth usage:

| Scenario                                    | Bandwidth                   |
| ------------------------------------------- | --------------------------- |
| 20 clients, position updates every 30s      | ~5-10 Kbps                  |
| 50 clients, position updates every 15s      | ~20-40 Kbps                 |
| Burst (mission sync, data package download) | ~100-500 Kbps               |
| Protobuf vs XML                             | Protobuf is ~50-70% smaller |

This is negligible compared to Argos's HackRF FFT streaming (~500 Kbps) and Kismet device polling.

---

## References

- [TAK Product Center - Official TAK Server](https://github.com/TAK-Product-Center/Server)
- [FreeTAKServer](https://github.com/FreeTAKTeam/FreeTakServer) and [Documentation](https://freetakteam.github.io/FreeTAKServer-User-Docs/About/architecture/cot_domain/)
- [OpenTAKServer](https://github.com/brian7704/OpenTAKServer) and [Feature Comparison](https://docs.opentakserver.io/feature_comparison.html)
- [PyTAK](https://github.com/snstac/pytak) and [Documentation](https://pytak.readthedocs.io/en/latest/)
- [@tak-ps/node-tak](https://github.com/dfpc-coe/node-tak) -- TAK Server NodeJS SDK
- [@tak-ps/node-cot](https://github.com/dfpc-coe/node-CoT) -- Cursor-on-Target TypeScript library
- [tak.js](https://github.com/vidterra/tak.js) -- Lightweight JS TAK message parser
- [CloudTAK](https://github.com/dfpc-coe/CloudTAK) -- Browser-based TAK client (Vue + MapLibre + node-tak)
- [TAK Protocol Description](https://takproto.readthedocs.io/en/latest/tak_protocols/) -- Protocol version details
- [De-mystifying the TAK Protocol](https://www.ballantyne.online/de-mystifying-the-tak-protocol/) -- Protocol header analysis
- [ATAK-CIV Source (DoD)](https://github.com/deptofdefense/AndroidTacticalAssaultKit-CIV) -- Official ATAK source including Protobuf definitions
- [TAK Server Configuration Guide v5.2](https://static1.squarespace.com/static/5404b7d2e4b0feb6e5d9636b/t/6756e17b053bbe305668a08f/1733747077204/TAK_Server_Configuration_Guide_5.2.pdf)
- [Android Team Awareness Kit - Wikipedia](https://en.wikipedia.org/wiki/Android_Team_Awareness_Kit)
- [TAK Ecosystem Overview (Hackaday)](https://hackaday.com/2022/09/08/the-tak-ecosystem-military-coordination-goes-open-source/)
- [CoT Developer's Guide](https://tutorials.techrad.co.za/wp-content/uploads/2021/06/The-Developers-Guide-to-Cursor-on-Target-1.pdf)
- [OpenTAKServer Certificate Enrollment](https://docs.opentakserver.io/certificate_enrollment.html)
- [MITRE CoT Router User's Guide](https://www.mitre.org/sites/default/files/pdf/09_4937.pdf)
- [TAK Overview - DHS](https://www.dhs.gov/sites/default/files/publications/tactical_awareness_kit_508.pdf)
- [How the TAK System Works (Simplico)](https://simplico.net/2025/06/04/how-the-tak-system-works-a-complete-guide-for-real-time-situational-awareness/)
- [takpak - Python CoT library](https://github.com/pinztrek/takpak)
