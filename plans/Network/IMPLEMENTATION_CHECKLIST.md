# Argos Mesh Networking Implementation Checklist

## Overview

This document lists everything needed on each Raspberry Pi to enable mesh networking between Argos nodes. The architecture uses Tailscale VPN on the HOST and mesh logic in the DOCKER container.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Raspberry Pi 5 (Kali Linux Host)                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  HOST Services (Outside Docker)                        │ │
│  │  • Tailscale VPN (mesh networking)                     │ │
│  │  • Docker daemon                                       │ │
│  │  • USB hardware (HackRF, GPS, WiFi adapters)          │ │
│  │  • systemd services                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  argos-dev Container (network_mode: host)              │ │
│  │  • Argos SvelteKit app (port 5173)                     │ │
│  │  • WebSocket server                                    │ │
│  │  • SQLite database                                     │ │
│  │  • Mesh networking logic ← NEW                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Container uses `network_mode: host`, so it shares the host's network stack and can access Tailscale IPs directly.

---

## Part 1: HOST Setup (Raspberry Pi OS / Kali Linux)

### 1.1 Tailscale VPN Installation

#### Install Tailscale

```bash
# Install Tailscale package
curl -fsSL https://tailscale.com/install.sh | sh

# Start and enable service
sudo systemctl enable --now tailscaled

# Authenticate (opens browser or provides URL)
sudo tailscale up

# Verify connection
tailscale status
tailscale ip -4  # Get your Tailscale IP (100.x.x.x)
```

#### Configuration

```bash
# Enable IP forwarding (if acting as gateway)
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Set hostname for easy identification
sudo hostnamectl set-hostname argos-01  # or argos-02, argos-03, etc.

# Advertise routes (if needed for TAK server access)
sudo tailscale up --advertise-routes=192.168.1.0/24  # Example: local TAK server
```

#### Verification Checklist

- [ ] Tailscale installed and running
- [ ] Node has Tailscale IP address (100.x.x.x)
- [ ] Can ping other Tailscale nodes
- [ ] Hostname set (argos-01, argos-02, etc.)

---

### 1.2 Docker Configuration

#### Current Docker Setup

```bash
# Verify Docker is running
sudo systemctl status docker

# Check argos-dev container
docker ps | grep argos-dev

# Verify network_mode: host
docker inspect argos-dev | grep NetworkMode
# Should show: "NetworkMode": "host"
```

#### USB Device Passthrough

Ensure hardware devices are accessible to Docker:

```bash
# List USB devices
lsusb

# Example HackRF One
# Bus 001 Device 004: ID 1d50:6089 OpenMoko, Inc. Great Scott Gadgets HackRF One SDR

# Verify Docker has USB access (already configured in docker-compose.yml)
# --privileged or --device=/dev/bus/usb
```

#### Verification Checklist

- [ ] Docker daemon running
- [ ] argos-dev container uses network_mode: host
- [ ] USB devices accessible (HackRF, GPS, WiFi adapters)
- [ ] Container can bind to 0.0.0.0:5173

---

### 1.3 Firewall Configuration

#### Allow Argos Mesh Traffic

```bash
# If using UFW firewall
sudo ufw allow 5173/tcp comment "Argos WebSocket Mesh"

# If using iptables directly
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Tailscale automatically manages its own firewall rules
# but verify Argos ports are accessible from Tailscale network
```

#### Verification Checklist

- [ ] Port 5173 accessible from Tailscale network
- [ ] Can connect from peer node: `nc -zv <tailscale-ip> 5173`

---

### 1.4 System Services (Optional Production Hardening)

#### Create systemd service for Argos container

```bash
# File: /etc/systemd/system/argos-mesh.service
[Unit]
Description=Argos Mesh Networking Node
After=docker.service tailscaled.service
Requires=docker.service tailscaled.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/kali/Documents/Argos/Argos
ExecStart=/usr/bin/docker-compose -f docker/docker-compose.portainer-dev.yml up -d
ExecStop=/usr/bin/docker-compose -f docker/docker-compose.portainer-dev.yml down
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl daemon-reload
sudo systemctl enable argos-mesh.service
sudo systemctl start argos-mesh.service
```

#### Verification Checklist

- [ ] systemd service created (optional)
- [ ] Argos starts automatically on boot (optional)

---

## Part 2: DOCKER Container Setup (argos-dev)

### 2.1 Current Components (Already Exist)

✅ **Existing Infrastructure** (No changes needed):

- SvelteKit application (`src/routes/`)
- WebSocket server (`src/lib/server/websocket-server.ts`)
- SQLite database (`rf_signals.db`)
- Hardware integration services (HackRF, Kismet, GSM Evil)
- GPS tracking (`src/lib/stores/gpsStore.ts`)
- Tactical map UI (`src/lib/components/tactical-map/`)

---

### 2.2 NEW Components to Implement

#### 2.2.1 Backend API Endpoints (SvelteKit)

**File**: `src/routes/api/mesh/announce/+server.ts`

```typescript
// POST /api/mesh/announce
// Register this node with peers
export async function POST({ request }) {
	const { node_id, hostname, tailscale_ip, capabilities } = await request.json();
	// Store peer info in registry
	// Return success
}
```

**File**: `src/routes/api/mesh/nodes/+server.ts`

```typescript
// GET /api/mesh/nodes
// List all discovered nodes
export async function GET() {
	// Return list of known peers
}
```

**File**: `src/routes/api/mesh/connect/+server.ts`

```typescript
// WebSocket /api/mesh/connect
// Establish peer-to-peer connection
export async function GET({ request }) {
	// Upgrade to WebSocket
	// Handle mesh events
}
```

**Checklist**:

- [ ] Create `src/routes/api/mesh/announce/+server.ts`
- [ ] Create `src/routes/api/mesh/nodes/+server.ts`
- [ ] Create `src/routes/api/mesh/connect/+server.ts`

---

#### 2.2.2 Mesh Stores (Svelte State Management)

**File**: `src/lib/stores/mesh/nodeRegistry.ts`

```typescript
export interface ArgosNode {
	id: string; // "argos-01"
	hostname: string; // "kali-rpi-01"
	tailscaleIP: string; // "100.x.x.x"
	webSocketPort: number; // 5173
	capabilities: string[]; // ["hackrf", "kismet", "gps"]
	status: 'online' | 'offline';
	lastSeen: Date;
	location?: { lat: number; lon: number };
}

export const nodeRegistry = writable<Map<string, ArgosNode>>(new Map());
```

**File**: `src/lib/stores/mesh/peerConnections.ts`

```typescript
// Manages WebSocket connections to peer nodes
export const peerConnections = writable<Map<string, WebSocket>>(new Map());
```

**File**: `src/lib/stores/mesh/remoteDetections.ts`

```typescript
// Stores detections from peer nodes
export interface RemoteDetection {
	source_node: string;
	type: 'rf_signal' | 'wifi_device' | 'gsm_imsi';
	timestamp: Date;
	data: any;
}

export const remoteDetections = writable<RemoteDetection[]>([]);
```

**Checklist**:

- [ ] Create `src/lib/stores/mesh/nodeRegistry.ts`
- [ ] Create `src/lib/stores/mesh/peerConnections.ts`
- [ ] Create `src/lib/stores/mesh/remoteDetections.ts`

---

#### 2.2.3 Mesh Services (Business Logic)

**File**: `src/lib/services/mesh/peerDiscovery.ts`

```typescript
// Discover other Argos nodes on Tailscale network
export async function discoverPeers(): Promise<ArgosNode[]> {
	// Query Tailscale API or use mDNS/multicast
	// Return list of discovered nodes
}
```

**File**: `src/lib/services/mesh/peerConnection.ts`

```typescript
// Establish WebSocket connection to peer
export function connectToPeer(node: ArgosNode): WebSocket {
	const ws = new WebSocket(`ws://${node.tailscaleIP}:${node.webSocketPort}/api/mesh/connect`);
	// Handle connection, events, reconnection
	return ws;
}
```

**File**: `src/lib/services/mesh/dataAggregator.ts`

```typescript
// Aggregate local + remote detections for display
export function aggregateDetections() {
	// Merge local RF signals + remote RF signals
	// Merge local WiFi devices + remote WiFi devices
	// Return unified dataset
}
```

**File**: `src/lib/services/mesh/eventBroadcaster.ts`

```typescript
// Broadcast local detections to all connected peers
export function broadcastDetection(detection: Detection) {
	const message = {
		type: 'rf_signal_detected',
		node_id: getNodeId(),
		timestamp: new Date().toISOString(),
		data: detection
	};

	// Send to all connected peers
	peerConnections.update((peers) => {
		peers.forEach((ws) => ws.send(JSON.stringify(message)));
		return peers;
	});
}
```

**Checklist**:

- [ ] Create `src/lib/services/mesh/peerDiscovery.ts`
- [ ] Create `src/lib/services/mesh/peerConnection.ts`
- [ ] Create `src/lib/services/mesh/dataAggregator.ts`
- [ ] Create `src/lib/services/mesh/eventBroadcaster.ts`

---

#### 2.2.4 Configuration Files

**File**: `src/lib/config/mesh.ts`

```typescript
export const MESH_CONFIG = {
	NODE_ID: process.env.ARGOS_NODE_ID || hostname(),
	WEBSOCKET_PORT: 5173,
	HEARTBEAT_INTERVAL: 10000, // 10 seconds
	PEER_TIMEOUT: 30000, // 30 seconds
	AUTO_DISCOVER: true,
	BROADCAST_LOCAL_DETECTIONS: true
};
```

**File**: `.env` (add mesh config)

```bash
# Mesh Networking
ARGOS_NODE_ID=argos-01
ARGOS_TAILSCALE_IP=100.x.x.x  # Auto-detected or manual
MESH_AUTO_DISCOVER=true
```

**Checklist**:

- [ ] Create `src/lib/config/mesh.ts`
- [ ] Add mesh variables to `.env`

---

#### 2.2.5 UI Components

**File**: `src/lib/components/mesh/NodeStatusPanel.svelte`

```svelte
<!-- Display connected nodes and their status -->
<script>
	import { nodeRegistry } from '$lib/stores/mesh/nodeRegistry';
</script>

<div class="node-status-panel">
	{#each $nodeRegistry as [id, node]}
		<div class="node-card">
			<span class={node.status}>{node.hostname}</span>
			<span>{node.tailscaleIP}</span>
			<span>{node.capabilities.join(', ')}</span>
		</div>
	{/each}
</div>
```

**File**: `src/lib/components/tactical-map/MultiNodeMap.svelte`

```svelte
<!-- Extend existing tactical map to show multi-node data -->
<script>
	import { localDetections } from '$lib/stores/detections';
	import { remoteDetections } from '$lib/stores/mesh/remoteDetections';

	// Merge and display all detections with source attribution
	const allDetections = derived([localDetections, remoteDetections], ([$local, $remote]) => [
		...$local,
		...$remote
	]);
</script>
```

**Checklist**:

- [ ] Create `src/lib/components/mesh/NodeStatusPanel.svelte`
- [ ] Extend `src/lib/components/tactical-map/` for multi-node view
- [ ] Add data source filtering UI

---

#### 2.2.6 Database Schema (Optional)

**File**: `src/lib/server/db/migrations/add_mesh_tables.sql`

```sql
-- Store known peer nodes (optional persistence)
CREATE TABLE IF NOT EXISTS mesh_nodes (
  id TEXT PRIMARY KEY,
  hostname TEXT,
  tailscale_ip TEXT,
  capabilities TEXT,  -- JSON array
  last_seen INTEGER,  -- Unix timestamp
  status TEXT DEFAULT 'offline'
);

-- Store remote detections (optional caching)
CREATE TABLE IF NOT EXISTS remote_detections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_node_id TEXT,
  detection_type TEXT,
  timestamp INTEGER,
  data TEXT,  -- JSON
  FOREIGN KEY (source_node_id) REFERENCES mesh_nodes(id)
);
```

**Checklist**:

- [ ] Create migration for mesh tables (optional)
- [ ] Run `npm run db:migrate` (if using persistence)

---

## Part 3: Integration Points

### 3.1 Extend Existing WebSocket Server

**File**: `src/lib/server/websocket-server.ts`

Add mesh event handling to existing WebSocket server:

```typescript
// Existing server handles local hardware events
// Add mesh peer connection handling

wss.on('connection', (ws, req) => {
	const url = new URL(req.url, 'http://localhost');

	if (url.pathname === '/api/mesh/connect') {
		// This is a peer connection
		handlePeerConnection(ws);
	} else {
		// Existing local client connection
		handleLocalClient(ws);
	}
});

function handlePeerConnection(ws: WebSocket) {
	// Receive events from peer node
	ws.on('message', (data) => {
		const event = JSON.parse(data);
		// Store in remoteDetections store
		// Broadcast to local clients for display
	});
}
```

**Checklist**:

- [ ] Extend `src/lib/server/websocket-server.ts` with mesh handling
- [ ] Add peer authentication (shared secret or certificate)

---

### 3.2 Broadcast Local Detections to Peers

When local hardware detects something, broadcast to peers:

**File**: `src/lib/services/hackrf/signalProcessor.ts` (example)

```typescript
import { broadcastDetection } from '$lib/services/mesh/eventBroadcaster';

// Existing code detects RF signal
const detection = {
	frequency: 2437000000,
	power: -45,
	gps: { lat: 35.123, lon: -118.456 }
};

// NEW: Broadcast to mesh
broadcastDetection({
	type: 'rf_signal_detected',
	data: detection
});
```

**Repeat for**:

- Kismet WiFi detections
- GSM Evil IMSI captures
- GPS position updates

**Checklist**:

- [ ] Add broadcast calls to HackRF signal processor
- [ ] Add broadcast calls to Kismet integration
- [ ] Add broadcast calls to GSM Evil integration
- [ ] Add broadcast calls to GPS tracking

---

### 3.3 Node Discovery on Startup

**File**: `src/hooks.server.ts` (SvelteKit server hook)

```typescript
import { discoverPeers, connectToPeer } from '$lib/services/mesh/peerDiscovery';
import { nodeRegistry, peerConnections } from '$lib/stores/mesh';

// Run on server startup
export async function handle({ event, resolve }) {
	if (!globalThis.meshInitialized) {
		globalThis.meshInitialized = true;

		// Discover peers on Tailscale network
		const peers = await discoverPeers();

		// Connect to each peer
		peers.forEach((peer) => {
			const ws = connectToPeer(peer);
			peerConnections.update((conns) => conns.set(peer.id, ws));
		});

		console.log(`Connected to ${peers.length} Argos peers`);
	}

	return resolve(event);
}
```

**Checklist**:

- [ ] Add mesh initialization to `src/hooks.server.ts`
- [ ] Implement peer discovery (Tailscale API or mDNS)
- [ ] Implement auto-reconnection on connection loss

---

## Part 4: Testing Setup

### 4.1 Two-Node Test Environment

**Node 1 (argos-01)**:

```bash
# On Raspberry Pi 1
sudo hostnamectl set-hostname argos-01
export ARGOS_NODE_ID=argos-01

# Start Argos
cd /home/kali/Documents/Argos/Argos
npm run dev
```

**Node 2 (argos-02)**:

```bash
# On Raspberry Pi 2
sudo hostnamectl set-hostname argos-02
export ARGOS_NODE_ID=argos-02

# Start Argos
cd /home/kali/Documents/Argos/Argos
npm run dev
```

### 4.2 Verification Tests

```bash
# From Node 1, test connection to Node 2
curl http://<node2-tailscale-ip>:5173/api/mesh/nodes

# From Node 2, test connection to Node 1
curl http://<node1-tailscale-ip>:5173/api/mesh/nodes

# Check WebSocket connection (use websocat tool)
websocat ws://<peer-tailscale-ip>:5173/api/mesh/connect
```

**Checklist**:

- [ ] Both nodes can reach each other via Tailscale IPs
- [ ] API endpoints respond correctly
- [ ] WebSocket connections establish successfully
- [ ] Detections appear on both nodes' maps

---

## Part 5: Deployment Checklist (Per Node)

### Pre-Deployment

- [ ] Tailscale installed and authenticated
- [ ] Unique hostname set (argos-01, argos-02, etc.)
- [ ] Docker container running with network_mode: host
- [ ] Firewall allows port 5173 from Tailscale network
- [ ] USB hardware accessible (HackRF, GPS, WiFi)

### Application Setup

- [ ] Mesh stores implemented
- [ ] Mesh services implemented
- [ ] API endpoints created
- [ ] WebSocket server extended
- [ ] UI components added
- [ ] Configuration files updated

### Runtime Verification

- [ ] Node announces itself to peers
- [ ] Peer connections established
- [ ] Local detections broadcast to peers
- [ ] Remote detections received and displayed
- [ ] Tactical map shows multi-node data
- [ ] Node status panel shows all peers

### Production Hardening

- [ ] systemd service configured (optional)
- [ ] Auto-reconnection tested
- [ ] Bandwidth monitoring enabled
- [ ] Authentication between nodes (shared secret)
- [ ] Data integrity verification (message signing)

---

## Quick Start Commands (Per Node)

```bash
# 1. Install Tailscale on host
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# 2. Set hostname
sudo hostnamectl set-hostname argos-01  # Change per node

# 3. Get Tailscale IP
tailscale ip -4

# 4. Start Argos container
cd /home/kali/Documents/Argos/Argos
docker-compose -f docker/docker-compose.portainer-dev.yml up -d

# 5. Verify mesh connectivity (from another node)
curl http://<this-node-tailscale-ip>:5173/api/health
```

---

## Summary: What's Missing

### HOST (Raspberry Pi):

- [x] Tailscale VPN (likely not installed yet)
- [x] Hostname configuration
- [x] Firewall rules for mesh traffic

### DOCKER (argos-dev):

- [ ] Mesh API endpoints (3 new files)
- [ ] Mesh stores (3 new files)
- [ ] Mesh services (4 new files)
- [ ] Configuration updates
- [ ] UI components (2 new files)
- [ ] WebSocket server extension
- [ ] Hardware integration broadcasting

**Total New Code**: ~10-12 files, plus modifications to 5-6 existing files.

---

## Next Steps

1. **Phase 1**: Install Tailscale on both Raspberry Pis
2. **Phase 2**: Implement mesh stores and services
3. **Phase 3**: Create API endpoints
4. **Phase 4**: Extend WebSocket server
5. **Phase 5**: Update UI components
6. **Phase 6**: Test two-node connection
7. **Phase 7**: Add TAK integration (separate phase)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-06
**Target**: Argos Mesh Networking MVP
