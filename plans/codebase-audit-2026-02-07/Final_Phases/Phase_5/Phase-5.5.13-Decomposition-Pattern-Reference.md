# Phase 5.5.13 -- Decomposition Pattern Reference

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.13                                                        |
| **Phase**            | 5.5.13                                                                     |
| **Title**            | Function Decomposition Pattern Reference                                   |
| **Risk Level**       | N/A (reference document, no code changes)                                  |
| **Prerequisites**    | None (reference for all Phase 5.5.x sub-tasks)                             |
| **Estimated Effort** | 0 hours (reference only)                                                   |
| **Files Touched**    | 0                                                                          |
| **Standards**        | MISRA C:2023 Rule 1.1, NASA/JPL Rule 2.4, CERT C MSC04-C, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Purpose

This document provides concrete, copy-paste-ready examples of each decomposition pattern referenced in all Phase 5.5.x sub-task documents. These examples use TypeScript syntax matching the Argos codebase conventions. Every sub-task references this document by pattern name.

---

## 2. Pattern Index

| Pattern # | Name                        | When to Use                                             | Typical Savings  |
| --------- | --------------------------- | ------------------------------------------------------- | ---------------- |
| 1         | Early-Return (Guard Clause) | Deep nesting, error/edge-case handling at top           | 10-20 lines      |
| 2         | Extract-and-Name            | Comment-delimited sections, sequential phases           | Variable         |
| 3         | Data-Driven (Lookup Table)  | Switch/if-else chains with similar branch structure     | 50-80% reduction |
| 4         | Builder                     | Complex object/HTML/config assembled section-by-section | 60-70% reduction |
| 5         | Store Action Extraction     | Svelte store factories with inline action handlers      | 70-85% reduction |

---

## 3. Pattern 1: Early-Return (Guard Clause Extraction)

### 3.1 When to Use

Function has deeply nested if/else blocks, especially for error/edge-case handling. The "happy path" is buried 3+ indentation levels deep.

### 3.2 Typical Savings

10-20 lines (reduced indentation, eliminated else blocks).

### 3.3 Before (90 lines, 4 levels of nesting)

```typescript
async function resolveGsmDatabasePath(config: GSMConfig): Promise<string> {
	const envPath = process.env.GSM_DB_PATH;
	if (envPath) {
		if (existsSync(envPath)) {
			const stats = statSync(envPath);
			if (stats.isFile()) {
				if (stats.size > 0) {
					return envPath;
				} else {
					// 20 lines of fallback logic for empty file...
					const defaultPath = path.join(config.dataDir, 'gsm.db');
					if (existsSync(defaultPath)) {
						logger.warn(`Empty file at ${envPath}, using default: ${defaultPath}`);
						return defaultPath;
					}
					logger.warn(`Empty file at ${envPath}, creating new database`);
					await createEmptyDatabase(envPath);
					return envPath;
				}
			} else {
				// 15 lines of directory handling...
				const dirContents = readdirSync(envPath);
				const dbFile = dirContents.find((f) => f.endsWith('.db'));
				if (dbFile) {
					return path.join(envPath, dbFile);
				}
				const newPath = path.join(envPath, 'gsm.db');
				await createEmptyDatabase(newPath);
				return newPath;
			}
		} else {
			// 15 lines of missing file handling...
			const dir = path.dirname(envPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			await createEmptyDatabase(envPath);
			return envPath;
		}
	} else {
		// 25 lines of default path resolution...
		const candidates = [
			path.join(config.dataDir, 'gsm.db'),
			path.join('/tmp', 'gsm.db'),
			path.join(process.cwd(), 'gsm.db')
		];
		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		const defaultPath = candidates[0];
		mkdirSync(path.dirname(defaultPath), { recursive: true });
		await createEmptyDatabase(defaultPath);
		return defaultPath;
	}
}
```

### 3.4 After (45 lines, 1 level of nesting)

```typescript
async function resolveGsmDatabasePath(config: GSMConfig): Promise<string> {
	const envPath = process.env.GSM_DB_PATH;
	if (!envPath) {
		return resolveDefaultPath(config);
	}
	if (!existsSync(envPath)) {
		return handleMissingPath(envPath, config);
	}
	const stats = statSync(envPath);
	if (!stats.isFile()) {
		return handleDirectoryPath(envPath, config);
	}
	if (stats.size === 0) {
		return handleEmptyFile(envPath, config);
	}
	return envPath;
}

async function resolveDefaultPath(config: GSMConfig): Promise<string> {
	const candidates = [
		path.join(config.dataDir, 'gsm.db'),
		path.join('/tmp', 'gsm.db'),
		path.join(process.cwd(), 'gsm.db')
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	const defaultPath = candidates[0];
	mkdirSync(path.dirname(defaultPath), { recursive: true });
	await createEmptyDatabase(defaultPath);
	return defaultPath;
}

async function handleMissingPath(envPath: string, config: GSMConfig): Promise<string> {
	const dir = path.dirname(envPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	await createEmptyDatabase(envPath);
	return envPath;
}

async function handleDirectoryPath(envPath: string, config: GSMConfig): Promise<string> {
	const dirContents = readdirSync(envPath);
	const dbFile = dirContents.find((f) => f.endsWith('.db'));
	if (dbFile) return path.join(envPath, dbFile);
	const newPath = path.join(envPath, 'gsm.db');
	await createEmptyDatabase(newPath);
	return newPath;
}

async function handleEmptyFile(envPath: string, config: GSMConfig): Promise<string> {
	const defaultPath = path.join(config.dataDir, 'gsm.db');
	if (existsSync(defaultPath)) {
		logger.warn(`Empty file at ${envPath}, using default: ${defaultPath}`);
		return defaultPath;
	}
	logger.warn(`Empty file at ${envPath}, creating new database`);
	await createEmptyDatabase(envPath);
	return envPath;
}
```

### 3.5 Key Rules

- Each guard clause tests the NEGATIVE condition and returns/throws early
- The "happy path" flows straight through without nesting
- Extracted helper functions are named after the ERROR CONDITION they handle (`handleMissingPath`, `handleEmptyFile`)
- Maximum 1 level of nesting in the main function

---

## 4. Pattern 2: Extract-and-Name

### 4.1 When to Use

Function contains comment blocks like `// Step 1: Initialize...`, `// Parse the response...`, `// Calculate metrics...`. Each commented section is an implicit function waiting to be named.

### 4.2 Typical Savings

Variable. The original function shrinks by the sum of extracted sections minus one call-site line per extraction.

### 4.3 Rule of Thumb

If you can describe what 10+ consecutive lines do in a single sentence, those lines are a function.

### 4.4 Before (97 lines)

```typescript
function initializeWebSocketServer(server: HttpServer): WebSocketServer {
	// Configure compression (15 lines)
	const perMessageDeflate = {
		zlibDeflateOptions: {
			chunkSize: 1024,
			memLevel: 7,
			level: 3
		},
		zlibInflateOptions: {
			chunkSize: 10 * 1024
		},
		clientNoContextTakeover: true,
		serverNoContextTakeover: true,
		serverMaxWindowBits: 10,
		concurrencyLimit: 10,
		threshold: 1024
	};

	// Create WebSocket server (10 lines)
	const wss = new WebSocket.Server({
		server,
		perMessageDeflate,
		maxPayload: 1024 * 1024,
		path: '/ws'
	});
	logger.info('WebSocket server created');

	// Register message handlers (30 lines)
	wss.on('connection', (ws, req) => {
		const clientId = generateClientId();
		logger.info(`Client connected: ${clientId}`);

		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				switch (message.type) {
					case 'subscribe':
						handleSubscribe(ws, message.channel);
						break;
					case 'unsubscribe':
						handleUnsubscribe(ws, message.channel);
						break;
					case 'command':
						handleCommand(ws, message);
						break;
					default:
						ws.send(JSON.stringify({ error: 'Unknown message type' }));
				}
			} catch (e) {
				ws.send(JSON.stringify({ error: 'Invalid JSON' }));
			}
		});

		ws.on('close', () => {
			logger.info(`Client disconnected: ${clientId}`);
			cleanupClient(clientId);
		});

		ws.on('error', (err) => {
			logger.error(`WebSocket error for ${clientId}:`, err);
		});
	});

	// Setup heartbeat (20 lines)
	const heartbeatInterval = setInterval(() => {
		wss.clients.forEach((ws) => {
			if (!ws.isAlive) {
				ws.terminate();
				return;
			}
			ws.isAlive = false;
			ws.ping();
		});
	}, 30000);

	// Cleanup on server close (10 lines)
	wss.on('close', () => {
		clearInterval(heartbeatInterval);
		wss.clients.forEach((ws) => ws.terminate());
		logger.info('WebSocket server closed');
	});

	return wss;
}
```

### 4.5 After (30 lines for main function)

```typescript
function initializeWebSocketServer(server: HttpServer): WebSocketServer {
	const compression = configureCompression();
	const wss = new WebSocket.Server({
		server,
		perMessageDeflate: compression,
		maxPayload: 1024 * 1024,
		path: '/ws'
	});
	logger.info('WebSocket server created');

	registerMessageHandlers(wss);
	const heartbeatInterval = setupHeartbeat(wss);
	registerCleanupHandler(wss, heartbeatInterval);

	return wss;
}

function configureCompression(): PerMessageDeflateOptions {
	return {
		zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
		zlibInflateOptions: { chunkSize: 10 * 1024 },
		clientNoContextTakeover: true,
		serverNoContextTakeover: true,
		serverMaxWindowBits: 10,
		concurrencyLimit: 10,
		threshold: 1024
	};
}

function registerMessageHandlers(wss: WebSocketServer): void {
	wss.on('connection', (ws, req) => {
		const clientId = generateClientId();
		logger.info(`Client connected: ${clientId}`);
		ws.on('message', (data) => handleMessage(ws, data));
		ws.on('close', () => handleDisconnect(clientId));
		ws.on('error', (err) => logger.error(`WebSocket error for ${clientId}:`, err));
	});
}

function handleMessage(ws: WebSocket, data: WebSocket.RawData): void {
	try {
		const message = JSON.parse(data.toString());
		switch (message.type) {
			case 'subscribe':
				handleSubscribe(ws, message.channel);
				break;
			case 'unsubscribe':
				handleUnsubscribe(ws, message.channel);
				break;
			case 'command':
				handleCommand(ws, message);
				break;
			default:
				ws.send(JSON.stringify({ error: 'Unknown message type' }));
		}
	} catch {
		ws.send(JSON.stringify({ error: 'Invalid JSON' }));
	}
}

function setupHeartbeat(wss: WebSocketServer): NodeJS.Timeout {
	return setInterval(() => {
		wss.clients.forEach((ws) => {
			if (!ws.isAlive) {
				ws.terminate();
				return;
			}
			ws.isAlive = false;
			ws.ping();
		});
	}, 30000);
}

function registerCleanupHandler(wss: WebSocketServer, heartbeatInterval: NodeJS.Timeout): void {
	wss.on('close', () => {
		clearInterval(heartbeatInterval);
		wss.clients.forEach((ws) => ws.terminate());
		logger.info('WebSocket server closed');
	});
}
```

### 4.6 Key Rules

- Each extracted function is named with a VERB matching its responsibility
- The orchestrator reads like a high-level recipe
- Comment blocks in the original become function names in the refactored code
- No anonymous inline callbacks longer than 5 lines

---

## 5. Pattern 3: Data-Driven (Lookup Table / Strategy Map)

### 5.1 When to Use

Function contains a large `switch` statement, if-else chain, or sequential series of similar conditional blocks. Each branch performs the same kind of operation on different data.

### 5.2 Typical Savings

Eliminates N branches in favor of an O(1) lookup. Often cuts function size by 50-80%.

### 5.3 Before (98 lines)

```typescript
function getDeviceType(device: KismetDevice): DeviceType {
	if (device.type === 'Wi-Fi AP' && device.encryption === 'WPA3') {
		return { category: 'access-point', icon: 'ap-secure', threat: 'low' };
	} else if (device.type === 'Wi-Fi AP' && device.encryption === 'WPA2') {
		return { category: 'access-point', icon: 'ap-secure', threat: 'low' };
	} else if (device.type === 'Wi-Fi AP' && device.encryption === 'WPA') {
		return { category: 'access-point', icon: 'ap-weak', threat: 'medium' };
	} else if (device.type === 'Wi-Fi AP' && device.encryption === 'WEP') {
		return { category: 'access-point', icon: 'ap-weak', threat: 'high' };
	} else if (device.type === 'Wi-Fi AP' && device.encryption === 'Open') {
		return { category: 'access-point', icon: 'ap-open', threat: 'high' };
	} else if (device.type === 'Wi-Fi Client') {
		return { category: 'client', icon: 'client', threat: 'medium' };
	} else if (device.type === 'Wi-Fi Bridge') {
		return { category: 'infrastructure', icon: 'bridge', threat: 'low' };
	} else if (device.type === 'Bluetooth') {
		return { category: 'bluetooth', icon: 'bt', threat: 'low' };
	} else if (device.type === 'Bluetooth LE') {
		return { category: 'bluetooth', icon: 'btle', threat: 'low' };
	} else if (device.type === 'BTLE Beacon') {
		return { category: 'bluetooth', icon: 'beacon', threat: 'info' };
	} else if (device.type === 'Wi-Fi Ad-Hoc') {
		return { category: 'adhoc', icon: 'adhoc', threat: 'high' };
	} else if (device.type === 'Zigbee') {
		return { category: 'iot', icon: 'zigbee', threat: 'medium' };
	} else if (device.type === 'Z-Wave') {
		return { category: 'iot', icon: 'zwave', threat: 'medium' };
	} else if (device.type === 'Drone') {
		return { category: 'aerial', icon: 'drone', threat: 'critical' };
	} else if (device.type === 'Unknown') {
		return { category: 'unknown', icon: 'unknown', threat: 'medium' };
	} else {
		return { category: 'unknown', icon: 'unknown', threat: 'unknown' };
	}
}
```

### 5.4 After (25 lines for function + 40 lines for data table)

```typescript
// Module-level data table (does NOT count toward function-line limits)
const ENCRYPTION_THREAT: Record<string, { icon: string; threat: string }> = {
	WPA3: { icon: 'ap-secure', threat: 'low' },
	WPA2: { icon: 'ap-secure', threat: 'low' },
	WPA: { icon: 'ap-weak', threat: 'medium' },
	WEP: { icon: 'ap-weak', threat: 'high' },
	Open: { icon: 'ap-open', threat: 'high' }
};

const DEVICE_TYPE_MAP: Record<string, (d: KismetDevice) => DeviceType> = {
	'Wi-Fi AP': (d) => {
		const enc = ENCRYPTION_THREAT[d.encryption] ?? { icon: 'ap-unknown', threat: 'medium' };
		return { category: 'access-point', icon: enc.icon, threat: enc.threat };
	},
	'Wi-Fi Client': () => ({ category: 'client', icon: 'client', threat: 'medium' }),
	'Wi-Fi Bridge': () => ({ category: 'infrastructure', icon: 'bridge', threat: 'low' }),
	'Wi-Fi Ad-Hoc': () => ({ category: 'adhoc', icon: 'adhoc', threat: 'high' }),
	Bluetooth: () => ({ category: 'bluetooth', icon: 'bt', threat: 'low' }),
	'Bluetooth LE': () => ({ category: 'bluetooth', icon: 'btle', threat: 'low' }),
	'BTLE Beacon': () => ({ category: 'bluetooth', icon: 'beacon', threat: 'info' }),
	Zigbee: () => ({ category: 'iot', icon: 'zigbee', threat: 'medium' }),
	'Z-Wave': () => ({ category: 'iot', icon: 'zwave', threat: 'medium' }),
	Drone: () => ({ category: 'aerial', icon: 'drone', threat: 'critical' }),
	Unknown: () => ({ category: 'unknown', icon: 'unknown', threat: 'medium' })
};

function getDeviceType(device: KismetDevice): DeviceType {
	const resolver = DEVICE_TYPE_MAP[device.type];
	if (!resolver) {
		return { category: 'unknown', icon: 'unknown', threat: 'unknown' };
	}
	return resolver(device);
}
```

### 5.5 Key Rules

- The data table (`DEVICE_TYPE_MAP`) is a module-level constant, NOT inside any function
- It does NOT count toward function-line limits
- It IS counted toward file-line limits (max-lines: 300). If the data table pushes the file over 300 lines, extract it to a separate data file per Phase 5.4 rules
- Use `Record<string, ...>` for string-keyed lookups; use arrays for sequential matching
- Always include a fallback for unmatched keys

---

## 6. Pattern 4: Builder

### 6.1 When to Use

Function constructs a complex object, HTML string, or configuration step-by-step. Each step adds one section/field to the result.

### 6.2 Typical Savings

Converts one large function into N small section-builder functions plus one assembler.

### 6.3 Before (121 lines)

```typescript
function createSystemInfoContent(info: SystemInfo): string {
	let html = '<div class="system-info">';

	// CPU section (20 lines)
	html += '<div class="section">';
	html += '<h3>CPU</h3>';
	html += `<p>Usage: ${info.cpu.usage.toFixed(1)}%</p>`;
	html += `<p>Load: ${info.cpu.load1.toFixed(2)} / ${info.cpu.load5.toFixed(2)} / ${info.cpu.load15.toFixed(2)}</p>`;
	html += `<p>Temperature: ${info.cpu.temperature ? info.cpu.temperature.toFixed(1) + ' C' : 'N/A'}</p>`;
	html += `<p>Cores: ${info.cpu.cores}</p>`;
	html += `<p>Model: ${info.cpu.model}</p>`;
	html += '<div class="progress-bar">';
	html += `<div class="fill" style="width:${info.cpu.usage}%"></div>`;
	html += '</div>';
	html += '</div>';

	// Memory section (15 lines)
	html += '<div class="section">';
	html += '<h3>Memory</h3>';
	html += `<p>Used: ${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)}</p>`;
	html += `<p>Available: ${formatBytes(info.memory.available)}</p>`;
	html += `<p>Swap: ${formatBytes(info.memory.swapUsed)} / ${formatBytes(info.memory.swapTotal)}</p>`;
	html += '<div class="progress-bar">';
	html += `<div class="fill" style="width:${((info.memory.used / info.memory.total) * 100).toFixed(0)}%"></div>`;
	html += '</div>';
	html += '</div>';

	// Network section (20 lines)
	html += '<div class="section">';
	html += '<h3>Network</h3>';
	for (const iface of info.network.interfaces) {
		html += `<div class="interface">`;
		html += `<p><strong>${iface.name}</strong>: ${iface.status}</p>`;
		html += `<p>IP: ${iface.ipv4 || 'N/A'}</p>`;
		html += `<p>RX: ${formatBytes(iface.rxBytes)} | TX: ${formatBytes(iface.txBytes)}</p>`;
		html += `</div>`;
	}
	html += '</div>';

	// GPS section (15 lines)
	html += '<div class="section">';
	html += '<h3>GPS</h3>';
	html += `<p>Fix: ${info.gps.hasFix ? 'Yes' : 'No'}</p>`;
	if (info.gps.hasFix) {
		html += `<p>Lat: ${info.gps.latitude.toFixed(6)}</p>`;
		html += `<p>Lng: ${info.gps.longitude.toFixed(6)}</p>`;
		html += `<p>Alt: ${info.gps.altitude?.toFixed(1) ?? 'N/A'} m</p>`;
	}
	html += `<p>Satellites: ${info.gps.satellites}</p>`;
	html += '</div>';

	// Services section (20 lines)
	html += '<div class="section">';
	html += '<h3>Services</h3>';
	for (const svc of info.services) {
		const statusClass = svc.running ? 'status-ok' : 'status-error';
		html += `<p class="${statusClass}">${svc.name}: ${svc.running ? 'Running' : 'Stopped'}</p>`;
	}
	html += '</div>';

	html += '</div>';
	return html;
}
```

### 6.4 After (18 lines + 5 section builders at 15-20 lines each)

```typescript
function createSystemInfoContent(info: SystemInfo): string {
	const sections = [
		buildCPUSection(info),
		buildMemorySection(info),
		buildNetworkSection(info),
		buildGPSSection(info),
		buildServiceSection(info)
	];
	return `<div class="system-info">${sections.join('')}</div>`;
}

function buildCPUSection(info: SystemInfo): string {
	return `<div class="section">
		<h3>CPU</h3>
		<p>Usage: ${info.cpu.usage.toFixed(1)}%</p>
		<p>Load: ${info.cpu.load1.toFixed(2)} / ${info.cpu.load5.toFixed(2)} / ${info.cpu.load15.toFixed(2)}</p>
		<p>Temperature: ${info.cpu.temperature ? info.cpu.temperature.toFixed(1) + ' C' : 'N/A'}</p>
		<p>Cores: ${info.cpu.cores}</p>
		<p>Model: ${info.cpu.model}</p>
		<div class="progress-bar"><div class="fill" style="width:${info.cpu.usage}%"></div></div>
	</div>`;
}

function buildMemorySection(info: SystemInfo): string {
	const usagePct = ((info.memory.used / info.memory.total) * 100).toFixed(0);
	return `<div class="section">
		<h3>Memory</h3>
		<p>Used: ${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)}</p>
		<p>Available: ${formatBytes(info.memory.available)}</p>
		<p>Swap: ${formatBytes(info.memory.swapUsed)} / ${formatBytes(info.memory.swapTotal)}</p>
		<div class="progress-bar"><div class="fill" style="width:${usagePct}%"></div></div>
	</div>`;
}

function buildNetworkSection(info: SystemInfo): string {
	const interfaces = info.network.interfaces
		.map(
			(iface) =>
				`<div class="interface">
			<p><strong>${iface.name}</strong>: ${iface.status}</p>
			<p>IP: ${iface.ipv4 || 'N/A'}</p>
			<p>RX: ${formatBytes(iface.rxBytes)} | TX: ${formatBytes(iface.txBytes)}</p>
		</div>`
		)
		.join('');
	return `<div class="section"><h3>Network</h3>${interfaces}</div>`;
}

function buildGPSSection(info: SystemInfo): string {
	const coords = info.gps.hasFix
		? `<p>Lat: ${info.gps.latitude.toFixed(6)}</p>
		   <p>Lng: ${info.gps.longitude.toFixed(6)}</p>
		   <p>Alt: ${info.gps.altitude?.toFixed(1) ?? 'N/A'} m</p>`
		: '';
	return `<div class="section">
		<h3>GPS</h3>
		<p>Fix: ${info.gps.hasFix ? 'Yes' : 'No'}</p>
		${coords}
		<p>Satellites: ${info.gps.satellites}</p>
	</div>`;
}

function buildServiceSection(info: SystemInfo): string {
	const services = info.services
		.map((svc) => {
			const cls = svc.running ? 'status-ok' : 'status-error';
			return `<p class="${cls}">${svc.name}: ${svc.running ? 'Running' : 'Stopped'}</p>`;
		})
		.join('');
	return `<div class="section"><h3>Services</h3>${services}</div>`;
}
```

### 6.5 Key Rules

- The assembler function joins sections and wraps in a container
- Each section builder is independently testable
- Section builders use template literals, not string concatenation
- If a section builder exceeds 25 lines, decompose further (e.g., extract loop body)

---

## 7. Pattern 5: Store Action Extraction

### 7.1 When to Use

Svelte store factory functions (`createXStore`) that define action handlers inline. This is the most common cause of >150-line functions in the Argos codebase (3 of 25 Phase 5.5 CRITICAL functions).

### 7.2 Typical Savings

Reduces store factory from 150-320 lines to 30-50 lines.

### 7.3 Structural Rule

The store creation function (writable declaration, derived stores, subscribe setup) stays in the store file. Action handler implementations move to a sibling `*Actions.ts` file. The store file imports and delegates to the action file.

### 7.4 Before (`createGSMEvilStore`, 318 lines)

```typescript
export function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(initialState);

	return {
		subscribe,
		startScan: async (freq: number) => {
			update((s) => ({ ...s, scanning: true, error: null }));
			try {
				const res = await fetch('/api/gsm-evil/scan', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ frequency: freq })
				});
				if (!res.ok) {
					const err = await res.text();
					update((s) => ({ ...s, error: `Scan failed: ${err}`, scanning: false }));
					return;
				}
				const data = await res.json();
				update((s) => ({ ...s, scanResult: data, scanning: false }));
			} catch (e) {
				update((s) => ({ ...s, error: `Network error: ${String(e)}`, scanning: false }));
			}
		},
		stopScan: async () => {
			try {
				await fetch('/api/gsm-evil/scan/stop', { method: 'POST' });
				update((s) => ({ ...s, scanning: false }));
			} catch (e) {
				update((s) => ({ ...s, error: String(e) }));
			}
		}
		// ... 12 more action handlers, each 10-30 lines ...
	};
}
```

### 7.5 After (`createGSMEvilStore`, 40 lines)

```typescript
// src/lib/stores/gsm-evil/gsmEvilStore.ts
import {
	startGSMScan,
	stopGSMScan,
	updateScanFrequency,
	setTargetARFCN,
	fetchCapturedIMSIs,
	performHealthCheck,
	updateScanProgress,
	handleScanResult,
	resetScanState,
	toggleAutoScan,
	updateConfiguration,
	handleError,
	exportResults,
	importConfiguration
} from './gsmEvilActions';

export function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(initialState);

	return {
		subscribe,
		startScan: (freq: number) => startGSMScan(update, freq),
		stopScan: () => stopGSMScan(update),
		updateFrequency: (freq: number) => updateScanFrequency(update, freq),
		setARFCN: (arfcn: number) => setTargetARFCN(update, arfcn),
		fetchIMSIs: () => fetchCapturedIMSIs(update),
		checkHealth: () => performHealthCheck(update),
		updateProgress: (data: ScanProgress) => updateScanProgress(update, data),
		handleResult: (result: ScanResult) => handleScanResult(update, result),
		reset: () => resetScanState(update),
		toggleAuto: (enabled: boolean) => toggleAutoScan(update, enabled),
		updateConfig: (config: ScanConfig) => updateConfiguration(update, config),
		onError: (error: unknown) => handleError(update, error),
		export: () => exportResults(get({ subscribe })),
		importConfig: (config: ScanConfig) => importConfiguration(update, config)
	};
}
```

### 7.6 Action File Structure

```typescript
// src/lib/stores/gsm-evil/gsmEvilActions.ts
import type { GSMEvilState, ScanProgress, ScanResult, ScanConfig } from './types';

type StateUpdater = (fn: (state: GSMEvilState) => GSMEvilState) => void;

export async function startGSMScan(update: StateUpdater, frequency: number): Promise<void> {
	update((s) => ({ ...s, scanning: true, error: null }));
	try {
		const res = await fetch('/api/gsm-evil/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ frequency })
		});
		if (!res.ok) {
			const err = await res.text();
			update((s) => ({ ...s, error: `Scan failed: ${err}`, scanning: false }));
			return;
		}
		const data = await res.json();
		update((s) => ({ ...s, scanResult: data, scanning: false }));
	} catch (e) {
		update((s) => ({ ...s, error: `Network error: ${String(e)}`, scanning: false }));
	}
}

export async function stopGSMScan(update: StateUpdater): Promise<void> {
	try {
		await fetch('/api/gsm-evil/scan/stop', { method: 'POST' });
		update((s) => ({ ...s, scanning: false }));
	} catch (e) {
		update((s) => ({ ...s, error: String(e) }));
	}
}

// ... remaining action functions follow the same pattern ...
```

### 7.7 Key Rules

- All extracted action functions receive `update: StateUpdater` as their first parameter
- The `subscribe` function is NOT passed to action handlers (actions write, they do not read via subscription)
- If a function needs current state, accept it as a parameter rather than subscribing
- Each action function is independently testable by mocking the `update` callback
- Create a barrel `index.ts` that re-exports the store and types
- Create a barrel re-export at the original file path during migration

---

## 8. Pattern Selection Guide

Use this decision tree to select the correct pattern for a given function:

```
Is the function a Svelte store factory with inline action handlers?
  YES -> Pattern 5 (Store Action Extraction)
  NO  -> Continue

Does the function contain a switch/if-else chain with 5+ branches
doing similar work?
  YES -> Pattern 3 (Data-Driven)
  NO  -> Continue

Does the function build a complex HTML string, popup, or
configuration object section-by-section?
  YES -> Pattern 4 (Builder)
  NO  -> Continue

Does the function have 3+ levels of nesting with guard conditions?
  YES -> Pattern 1 (Early-Return)
  NO  -> Continue

Does the function have 2+ comment-delimited sections
("Step 1:", "Parse...", "Calculate...")?
  YES -> Pattern 2 (Extract-and-Name)
  NO  -> Pattern 2 is the fallback for any function >60 lines
```

---

**END OF DOCUMENT**
