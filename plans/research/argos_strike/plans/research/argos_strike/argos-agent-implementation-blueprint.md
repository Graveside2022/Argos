# Argos AI Agent Architecture: Implementation Blueprint

**Date:** 2026-02-13
**Based on:** Source code analysis of Shannon, PentAGI, PentestGPT, PentestAgent
**Existing Architecture:** Argos SDR & Network Analysis Console (SvelteKit + MapLibre + MCP)

---

## Design Philosophy

**PentestGPT proved Claude Code alone achieves 86.5% on security benchmarks.**
**PentestAgent proved plan-driven execution + knowledge graph makes it controllable.**
**Argos already has the AG-UI bridge, MCP servers, and tactical map.**

We combine all three: **Claude Code as the free agent loop** (Max plan), **PentestAgent's planning and graph patterns** for operator control, wired into **Argos's existing architecture** with zero framework rewrites.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARGOS TACTICAL MAP                          │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ MapLibre  │  │ Agent Status │  │  Knowledge  │  │   Agent    │  │
│  │   Map     │  │    Panel     │  │   Graph     │  │   Chat     │  │
│  │ (target   │  │ (plan steps  │  │  Overlay    │  │  (SSE      │  │
│  │  click)   │  │  progress)   │  │ (NetworkX)  │  │  stream)   │  │
│  └────┬──────┘  └──────┬───────┘  └──────┬──────┘  └─────┬──────┘  │
│       │                │                 │                │         │
│  ─────┴────────────────┴─────────────────┴────────────────┴─────── │
│                    agentContext Store (AG-UI Bridge)                │
│              + agentPlanStore + shadowGraphStore (NEW)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ SSE / REST
┌──────────────────────────────┴──────────────────────────────────────┐
│                         AGENT BACKEND                               │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────┐       │
│  │  Plan Engine (NEW)   │   │  Shadow Graph Engine (NEW)   │       │
│  │  - generatePlan()    │   │  - NetworkX-style (in-memory)│       │
│  │  - validatePlan()    │   │  - Entities: host, service,  │       │
│  │  - replanOnFailure() │   │    credential, vulnerability │       │
│  │  - markStepComplete()│   │  - Auto-extract from agent   │       │
│  └──────────┬───────────┘   │    tool results              │       │
│             │               │  - Attack path computation   │       │
│  ┌──────────┴───────────┐   │  - GeoJSON export for map    │       │
│  │  Agent Runtime       │   └──────────────────────────────┘       │
│  │  (Existing, Enhanced)│                                          │
│  │  - Claude Sonnet 4.5 │                                          │
│  │  - SSE streaming     │                                          │
│  │  - Tool dispatch     │                                          │
│  └──────────┬───────────┘                                          │
│             │                                                       │
│  ┌──────────┴───────────────────────────────────────────────┐      │
│  │                    MCP TOOL LAYER                         │      │
│  │                                                           │      │
│  │  EXISTING:                    NEW:                        │      │
│  │  ├─ system-inspector (5)     ├─ recon-agent (5)          │      │
│  │  ├─ hardware-debugger (5)    ├─ attack-agent (6)         │      │
│  │  ├─ database-inspector (5)   ├─ wireless-agent (4)       │      │
│  │  ├─ api-debugger (3)         └─ environment-scanner (2)  │      │
│  │  ├─ streaming-inspector (3)                               │      │
│  │  ├─ test-runner (3)                                       │      │
│  │  └─ gsm-evil (7)                                         │      │
│  └──────────────────────────────────────────────────────────┘      │
│             │                                                       │
│  ┌──────────┴───────────────────────────────────────────────┐      │
│  │              HOST EXECUTION LAYER                         │      │
│  │  nsenter → nmap, aircrack-ng, wifite, bettercap,         │      │
│  │            metasploit, hydra, reaver, gr-gsm, etc.        │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Plan Engine

**Pattern source:** PentestAgent's forced plan generation + replan on failure
**Location:** `src/lib/server/agent/plan-engine.ts` (NEW)

### Why Planning Matters

In a military training environment, the operator must:

1. See what the agent intends to do BEFORE it acts
2. Approve, modify, or reject the plan
3. Watch execution with step-by-step progress
4. Understand why the agent changed course

This maps to the OODA loop: Observe → Orient → **Decide** → Act.

### Plan Data Model

```typescript
// src/lib/types/agent-plan.ts (NEW)

export type PlanStepStatus =
	| 'pending'
	| 'approved'
	| 'in_progress'
	| 'completed'
	| 'failed'
	| 'skipped';

export interface PlanStep {
	id: string; // uuid
	order: number; // execution order
	phase: 'recon' | 'enumeration' | 'vulnerability' | 'exploitation' | 'post_exploitation';
	title: string; // "Capture WPA2 handshake"
	description: string; // "Use airodump-ng to capture 4-way handshake from target AP"
	tools: string[]; // ['airodump-ng', 'aireplay-ng']
	target: string; // MAC address or IP
	risk_level: 'low' | 'medium' | 'high';
	estimated_duration: string; // "30s", "2m"
	status: PlanStepStatus;
	output?: string; // result after execution
	error?: string; // error if failed
	started_at?: number;
	completed_at?: number;
}

export interface AttackPlan {
	id: string;
	target_id: string; // device MAC or network ID
	target_description: string; // "NETGEAR-5G WPA2 AP at -45dBm"
	objective: string; // "Gain network access via WPA2 handshake capture and crack"
	steps: PlanStep[];
	status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'replanning';
	created_at: number;
	approved_at?: number;
	completed_at?: number;
	replan_reason?: string; // "Handshake capture failed: client deauth unsuccessful"
}
```

### Plan Generation Flow

```
Operator clicks target on map
        │
        ▼
agentContext updated with target details
(SSID, BSSID, encryption, channel, signal strength, GPS, clients)
        │
        ▼
POST /api/agent/generate-plan
  → System prompt forces structured plan output
  → Claude returns JSON AttackPlan
  → Validate plan (no out-of-scope targets, risk assessment)
        │
        ▼
Plan displayed in Agent Status Panel
  → Operator reviews each step
  → Operator can: Approve All / Approve Step-by-Step / Modify / Reject
        │
        ▼
POST /api/agent/execute-plan
  → For each approved step:
     1. Update step status → 'in_progress'
     2. Stream to Agent Chat: "Executing step 3: Capturing handshake..."
     3. Execute via MCP tool (recon-agent or attack-agent)
     4. Parse result
     5. Update shadow graph with discoveries
     6. Update step status → 'completed' or 'failed'
     7. If failed → trigger replan:
        - Claude analyzes failure
        - Generates alternative steps
        - Operator approves new plan
        │
        ▼
Plan completed → generate after-action summary
```

### Plan System Prompt (Injected into Agent)

```typescript
// src/lib/server/agent/prompts/plan-generation.ts (NEW)

export function getPlanGenerationPrompt(context: AgentContext): string {
	return `You are an EW/cyber operations planning agent for Army training exercises.

OBJECTIVE: Generate a structured attack plan for the selected target.

TARGET CONTEXT:
${JSON.stringify(context.selectedDeviceDetails, null, 2)}

OPERATOR LOCATION: ${context.userLocation?.lat}, ${context.userLocation?.lon}
AVAILABLE TOOLS: ${context.availableTools?.join(', ')}

RULES:
1. Generate plan as JSON matching the AttackPlan schema
2. Each step must specify exact tool and arguments
3. Risk assessment required for each step
4. Recon BEFORE exploitation — never skip enumeration
5. All targets must be within the authorized training range
6. Include rollback/cleanup steps for exploitation phases

OUTPUT FORMAT: Respond with a single JSON object matching AttackPlan schema.`;
}
```

### API Endpoints

```typescript
// src/routes/api/agent/plan/+server.ts (NEW)

// POST /api/agent/plan — Generate plan for target
// GET  /api/agent/plan/:id — Get plan status
// PUT  /api/agent/plan/:id/approve — Approve plan (all or step-by-step)
// POST /api/agent/plan/:id/execute — Start execution
// POST /api/agent/plan/:id/replan — Trigger replan after failure
// DELETE /api/agent/plan/:id — Cancel/abort plan
```

---

## Component 2: Shadow Graph

**Pattern source:** PentestAgent's NetworkX auto-derived knowledge graph
**Location:** `src/lib/server/agent/shadow-graph.ts` (NEW)

### Why a Knowledge Graph

As the agent discovers hosts, services, credentials, and vulnerabilities, the operator needs to see the attack surface evolve on the tactical map. The shadow graph:

1. **Auto-builds** from tool outputs (nmap XML, Kismet JSON, credential dumps)
2. **Computes attack paths** (multi-hop pivoting routes)
3. **Identifies high-value targets** (most connected, most vulnerable)
4. **Exports as GeoJSON** for MapLibre overlay rendering
5. **Persists to SQLite** for cross-session learning

### Graph Data Model

```typescript
// src/lib/types/shadow-graph.ts (NEW)

export type EntityType =
	| 'host' // IP address / MAC
	| 'service' // port + protocol
	| 'credential' // username + password/hash
	| 'vulnerability' // CVE or finding
	| 'network' // SSID / subnet
	| 'endpoint' // URL / API path
	| 'wireless_ap' // WiFi access point
	| 'bluetooth_dev' // BLE device
	| 'cell_tower'; // GSM/LTE tower

export type RelationType =
	| 'HOSTS_SERVICE' // host → service
	| 'HAS_VULNERABILITY' // service → vulnerability
	| 'AUTHENTICATES_WITH' // credential → service
	| 'CONNECTS_TO' // host → host (network link)
	| 'CLIENT_OF' // client → AP
	| 'MEMBER_OF' // host → network
	| 'EXPLOITED_VIA' // host → vulnerability (successful exploit)
	| 'BLOCKED_BY'; // vulnerability → defense (failed exploit)

export interface GraphEntity {
	id: string; // unique identifier
	type: EntityType;
	label: string; // display name
	properties: Record<string, unknown>; // type-specific data
	position?: { lat: number; lon: number }; // geo-location if known
	discovered_at: number;
	discovered_by: string; // plan step ID
	confidence: number; // 0-1
}

export interface GraphRelation {
	id: string;
	source: string; // entity ID
	target: string; // entity ID
	type: RelationType;
	properties: Record<string, unknown>;
	discovered_at: number;
	weight: number; // 0-1 strength
}

export interface ShadowGraph {
	entities: Map<string, GraphEntity>;
	relations: Map<string, GraphRelation>;

	// Computed properties
	attackPaths: AttackPath[]; // multi-hop routes to objectives
	highValueTargets: string[]; // entity IDs sorted by connectivity
	unusedCredentials: string[]; // creds not yet used against services
}

export interface AttackPath {
	id: string;
	source: string; // starting entity
	target: string; // objective entity
	hops: string[]; // entity IDs in order
	feasibility: number; // 0-1
	description: string; // human-readable path
}
```

### Auto-Extraction Patterns

When agent tools return results, the shadow graph engine parses them:

```typescript
// src/lib/server/agent/shadow-graph.ts (NEW)

export class ShadowGraphEngine {
	private entities = new Map<string, GraphEntity>();
	private relations = new Map<string, GraphRelation>();

	// Parse nmap XML output
	extractFromNmap(xml: string, stepId: string): void {
		// Extract: hosts, open ports, services, OS detection, scripts
		// Create: host entities, service entities, HOSTS_SERVICE relations
	}

	// Parse Kismet device data
	extractFromKismet(devices: KismetDevice[], stepId: string): void {
		// Extract: APs, clients, SSIDs, signal strength, encryption
		// Create: wireless_ap entities, CLIENT_OF relations, MEMBER_OF relations
	}

	// Parse credential findings
	extractFromCredentials(output: string, stepId: string): void {
		// Regex patterns for usernames, passwords, hashes
		// Create: credential entities, AUTHENTICATES_WITH relations
	}

	// Parse vulnerability scan output
	extractFromVulnScan(output: string, stepId: string): void {
		// Extract: CVEs, severity, affected service
		// Create: vulnerability entities, HAS_VULNERABILITY relations
	}

	// Compute attack paths (Dijkstra-like)
	computeAttackPaths(from: string, to: string): AttackPath[] {
		// BFS/Dijkstra over graph weighted by feasibility
		// Return top-3 paths sorted by feasibility score
	}

	// Get strategic insights (PentestAgent pattern)
	getStrategicInsights(): string[] {
		const insights: string[] = [];

		// Unused credentials
		const unusedCreds = this.findUnusedCredentials();
		if (unusedCreds.length > 0) {
			insights.push(
				`${unusedCreds.length} credentials not yet tested against discovered services`
			);
		}

		// High-connectivity hosts
		const hubs = this.findHubEntities(3);
		for (const hub of hubs) {
			insights.push(
				`${hub.label} connects to ${hub.degree} other entities — high-value target`
			);
		}

		// Unexplored services
		const unexplored = this.findUnexploredServices();
		insights.push(
			`${unexplored.length} services discovered but not yet tested for vulnerabilities`
		);

		return insights;
	}

	// Export as GeoJSON for MapLibre overlay
	toGeoJSON(): GeoJSON.FeatureCollection {
		// Entities with positions → Point features
		// Relations between positioned entities → LineString features
		// Properties include type, label, status for styling
	}

	// Persist to SQLite
	persist(db: RFDatabase): void {
		// Use existing network repository pattern:
		// storeNetworkGraph(db, nodes, edges)
	}
}
```

### MapLibre Rendering

```typescript
// In DashboardMap.svelte — new GeoJSON source + layers

// Source: agent shadow graph
<GeoJSONSource id="shadow-graph-nodes" data={$shadowGraphNodes}>
  <CircleLayer
    id="graph-entity-circles"
    paint={{
      'circle-radius': ['match', ['get', 'type'],
        'host', 6,
        'service', 4,
        'vulnerability', 5,
        'credential', 4,
        3  // default
      ],
      'circle-color': ['match', ['get', 'type'],
        'host', '#4a9eff',           // blue
        'service', '#4ade80',        // green
        'vulnerability', '#ff6b6b', // red
        'credential', '#facc15',    // yellow
        '#9aa0a6'                   // gray default
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1
    }}
  />
  <SymbolLayer
    id="graph-entity-labels"
    layout={{ 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.5] }}
    paint={{ 'text-color': '#e8eaed' }}
  />
</GeoJSONSource>

<GeoJSONSource id="shadow-graph-edges" data={$shadowGraphEdges}>
  <LineLayer
    id="graph-relation-lines"
    paint={{
      'line-color': ['match', ['get', 'type'],
        'EXPLOITED_VIA', '#ff6b6b',  // red for successful exploits
        'BLOCKED_BY', '#facc15',     // yellow for blocked
        '#4a9eff40'                  // dim blue for discovery
      ],
      'line-width': 1.5,
      'line-dasharray': [2, 2]
    }}
  />
</GeoJSONSource>
```

---

## Component 3: New MCP Servers

**Pattern source:** Argos existing BaseMCPServer + PentestAgent environment detection
**Location:** `src/lib/server/mcp/servers/` (NEW files)

### recon-agent MCP Server (5 tools)

```typescript
// src/lib/server/mcp/servers/recon-agent.ts (NEW)

export class ReconAgentServer extends BaseMCPServer {
	tools: ToolDefinition[] = [
		{
			name: 'network_scan',
			description: 'Run nmap scan against target. Returns XML for shadow graph extraction.',
			inputSchema: {
				type: 'object',
				properties: {
					target: { type: 'string', description: 'IP, CIDR, or hostname' },
					scan_type: { type: 'string', enum: ['quick', 'service', 'vuln', 'os', 'full'] },
					ports: { type: 'string', description: 'Port spec (e.g. "1-1000", "22,80,443")' }
				},
				required: ['target', 'scan_type']
			},
			execute: async (args) => {
				// Validate inputs using input-sanitizer
				// Map scan_type to nmap flags:
				//   quick  → -sn (ping scan)
				//   service → -sV -sC (version + scripts)
				//   vuln → -sV --script=vuln
				//   os → -O -sV
				//   full → -A -T4
				// Execute via hostExec()
				// Return raw XML output (shadow graph extracts entities)
			}
		},
		{
			name: 'dns_recon',
			description: 'DNS enumeration (subdomain discovery, zone transfer attempts)'
			// ... dnsenum, dig, host commands
		},
		{
			name: 'service_fingerprint',
			description: 'Deep service fingerprinting on specific port'
			// ... nmap scripts, banner grab, SSL cert inspection
		},
		{
			name: 'wifi_survey',
			description: 'Wireless environment survey (requires Alfa adapter)'
			// ... airodump-ng output parsing
		},
		{
			name: 'bluetooth_scan',
			description: 'BLE device enumeration and GATT service discovery'
			// ... bettercap BLE module
		}
	];
}
```

### attack-agent MCP Server (6 tools)

```typescript
// src/lib/server/mcp/servers/attack-agent.ts (NEW)

export class AttackAgentServer extends BaseMCPServer {
	tools: ToolDefinition[] = [
		{
			name: 'wifi_attack',
			description: 'WiFi attack execution (handshake capture, deauth, WPS)',
			inputSchema: {
				type: 'object',
				properties: {
					target_bssid: { type: 'string' },
					attack_type: {
						type: 'string',
						enum: ['handshake_capture', 'deauth', 'wps_pin', 'pmkid']
					},
					interface: { type: 'string', default: 'wlan1' },
					duration_seconds: { type: 'number', default: 60 }
				},
				required: ['target_bssid', 'attack_type']
			},
			execute: async (args) => {
				// Validate BSSID format, interface name
				// handshake_capture → airodump-ng + aireplay-ng deauth
				// deauth → aireplay-ng --deauth
				// wps_pin → reaver / pixiewps
				// pmkid → hcxdumptool
				// Return capture file path + status
			}
		},
		{
			name: 'credential_attack',
			description: 'Password/credential attack (brute force, dictionary, hash cracking)'
			// ... hydra, aircrack-ng (for handshakes), hashcat
		},
		{
			name: 'exploit_service',
			description: 'Exploit a specific vulnerability on a service'
			// ... metasploit msfconsole -x, or direct exploit scripts
		},
		{
			name: 'bluetooth_attack',
			description: 'BLE exploitation (GATT write, pairing attack)'
			// ... bettercap BLE, gatttool
		},
		{
			name: 'network_mitm',
			description: 'Man-in-the-middle positioning (ARP spoof, DNS spoof)'
			// ... bettercap MITM modules
		},
		{
			name: 'post_exploitation',
			description: 'Post-exploitation actions (pivot, persist, exfiltrate)'
			// ... lateral movement, data collection
		}
	];
}
```

### wireless-agent MCP Server (4 tools)

```typescript
// src/lib/server/mcp/servers/wireless-agent.ts (NEW)

export class WirelessAgentServer extends BaseMCPServer {
	tools: ToolDefinition[] = [
		{
			name: 'spectrum_analyze',
			description: 'HackRF spectrum analysis for specific frequency range'
			// ... hackrf_sweep, output FFT data
		},
		{
			name: 'signal_classify',
			description: 'Classify detected RF signal (modulation, protocol)'
			// ... rfml model inference or heuristic classification
		},
		{
			name: 'direction_find',
			description: 'Signal direction finding using signal strength triangulation'
			// ... multi-sample RSSI with GPS correlation
		},
		{
			name: 'jam_signal',
			description:
				'Targeted RF jamming (TRAINING USE ONLY — requires spectrum coordinator approval)'
			// ... hackrf_transfer with appropriate waveform
			// MUST validate authorization token before execution
		}
	];
}
```

### environment-scanner MCP Server (2 tools)

**Pattern source:** PentestAgent scans for 200+ tools at startup

```typescript
// src/lib/server/mcp/servers/environment-scanner.ts (NEW)

export class EnvironmentScannerServer extends BaseMCPServer {
	tools: ToolDefinition[] = [
		{
			name: 'scan_available_tools',
			description: 'Detect which security tools are installed on this system',
			execute: async () => {
				// Check 200+ tools across categories using `which` / `command -v`
				const categories = {
					network_scanning: ['nmap', 'masscan', 'unicornscan', 'zmap'],
					wifi_attack: [
						'aircrack-ng',
						'airodump-ng',
						'aireplay-ng',
						'wifite',
						'reaver',
						'pixiewps',
						'hcxdumptool',
						'hcxpcapngtool'
					],
					bluetooth: ['bettercap', 'gatttool', 'hcitool', 'bluetoothctl'],
					exploitation: [
						'msfconsole',
						'searchsploit',
						'hydra',
						'medusa',
						'john',
						'hashcat'
					],
					web: ['nikto', 'gobuster', 'dirb', 'sqlmap', 'wpscan', 'burpsuite'],
					sdr: [
						'hackrf_info',
						'hackrf_sweep',
						'hackrf_transfer',
						'gr-gsm',
						'gqrx',
						'rtl_fm'
					],
					credential: ['responder', 'crackmapexec', 'mimikatz', 'impacket-smbclient'],
					forensics: ['volatility', 'binwalk', 'foremost', 'steghide'],
					osint: ['subfinder', 'amass', 'theHarvester', 'shodan'],
					post_exploit: ['chisel', 'socat', 'proxychains', 'sshuttle']
				};
				// Return categorized inventory
			}
		},
		{
			name: 'check_hardware_status',
			description: 'Check status of all connected RF/network hardware',
			execute: async () => {
				// Check HackRF, Alfa, GPS, Bluetooth adapter
				// Return status, conflicts, recommendations
			}
		}
	];
}
```

---

## Component 4: Playbooks

**Pattern source:** PentestAgent's structured attack templates
**Location:** `src/lib/server/agent/playbooks/` (NEW directory)

### Playbook Data Model

```typescript
// src/lib/types/playbook.ts (NEW)

export interface Playbook {
	id: string;
	name: string; // "WiFi AP Penetration"
	description: string;
	category: 'wifi' | 'bluetooth' | 'network' | 'cellular' | 'rf' | 'combined';
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	estimated_duration: string; // "15m", "1h"
	required_tools: string[]; // must be installed
	required_hardware: string[]; // HackRF, Alfa, GPS
	phases: PlaybookPhase[];
	training_objectives: string[]; // what the operator learns
}

export interface PlaybookPhase {
	name: string; // "Passive Reconnaissance"
	description: string;
	techniques: PlaybookTechnique[];
}

export interface PlaybookTechnique {
	name: string; // "Beacon Frame Analysis"
	tool: string; // "airodump-ng"
	description: string;
	example_command: string;
	expected_output: string;
	success_criteria: string;
}
```

### Built-in Playbooks

```
playbooks/
├── wifi-wpa2-penetration.json      — Full WPA2 AP attack (handshake → crack)
├── wifi-rogue-ap-detection.json    — Identify unauthorized APs on range
├── bluetooth-ble-exploitation.json — BLE device enumeration → GATT exploitation
├── network-pivot.json              — Compromise host → lateral movement
├── gsm-imsi-collection.json        — GSM tower survey → IMSI capture
├── rf-signal-hunt.json             — HackRF spectrum → classify → locate emitter
└── combined-ew-exercise.json       — Multi-domain: WiFi + BLE + GSM + RF
```

### Playbook → Plan Conversion

When operator selects a playbook, it seeds the plan generation prompt:

```typescript
export function playookToPlanPrompt(playbook: Playbook, context: AgentContext): string {
	return `Execute the "${playbook.name}" playbook against the selected target.

PLAYBOOK PHASES:
${playbook.phases
	.map(
		(p) => `
Phase: ${p.name}
Techniques:
${p.techniques.map((t) => `  - ${t.name}: ${t.tool} — ${t.description}`).join('\n')}
`
	)
	.join('\n')}

TARGET: ${JSON.stringify(context.selectedDeviceDetails)}

Generate an AttackPlan that follows these phases and techniques,
adapted to the specific target characteristics.`;
}
```

---

## Component 5: Enhanced Agent Runtime

**Location:** `src/lib/server/agent/runtime.ts` (MODIFY existing)

### Changes to Existing Runtime

The existing runtime already supports SSE streaming and tool dispatch. We add:

1. **Plan-aware system prompt** — inject current plan state, shadow graph insights
2. **Tool result interception** — feed tool outputs to shadow graph engine
3. **Step tracking** — map tool executions to plan steps
4. **Replan trigger** — detect failures and trigger replanning

```typescript
// Enhanced system prompt builder
export function buildAgentSystemPrompt(
	context: AgentContext,
	plan: AttackPlan | null,
	graph: ShadowGraph,
	availableTools: string[]
): string {
	let prompt = BASE_SYSTEM_PROMPT;

	// Inject available tools (PentestAgent pattern)
	prompt += `\n\nAVAILABLE SECURITY TOOLS:\n${availableTools.join(', ')}`;

	// Inject current plan state
	if (plan) {
		const currentStep = plan.steps.find((s) => s.status === 'in_progress');
		prompt += `\n\nCURRENT PLAN: ${plan.objective}`;
		prompt += `\nCURRENT STEP: ${currentStep?.title || 'None'}`;
		prompt += `\nCOMPLETED: ${plan.steps.filter((s) => s.status === 'completed').length}/${plan.steps.length}`;
	}

	// Inject shadow graph insights (PentestAgent pattern)
	const insights = graph.getStrategicInsights();
	if (insights.length > 0) {
		prompt += `\n\nINTELLIGENCE FROM SHADOW GRAPH:\n${insights.map((i) => `• ${i}`).join('\n')}`;
	}

	return prompt;
}
```

### Tool Result → Shadow Graph Pipeline

```typescript
// After every tool execution:
function processToolResult(toolName: string, result: string, stepId: string): void {
	// Route to appropriate extractor
	switch (toolName) {
		case 'network_scan':
			shadowGraph.extractFromNmap(result, stepId);
			break;
		case 'wifi_survey':
		case 'get_active_devices':
			shadowGraph.extractFromKismet(JSON.parse(result), stepId);
			break;
		case 'credential_attack':
			shadowGraph.extractFromCredentials(result, stepId);
			break;
		case 'exploit_service':
			shadowGraph.extractFromVulnScan(result, stepId);
			break;
	}

	// Recompute attack paths
	shadowGraph.computeAttackPaths();

	// Update GeoJSON for map
	shadowGraphStore.set(shadowGraph.toGeoJSON());

	// Persist to SQLite
	shadowGraph.persist(db);
}
```

---

## Component 6: New Svelte Stores

**Location:** `src/lib/stores/dashboard/` (NEW files)

```typescript
// src/lib/stores/dashboard/agent-plan-store.ts (NEW)

import { writable, derived } from 'svelte/store';
import type { AttackPlan, PlanStep } from '$lib/types/agent-plan';

export const currentPlan = writable<AttackPlan | null>(null);
export const planHistory = writable<AttackPlan[]>([]);

export const currentStep = derived(currentPlan, ($plan) => {
	if (!$plan) return null;
	return $plan.steps.find((s) => s.status === 'in_progress') ?? null;
});

export const planProgress = derived(currentPlan, ($plan) => {
	if (!$plan) return 0;
	const completed = $plan.steps.filter((s) => s.status === 'completed').length;
	return completed / $plan.steps.length;
});

export const planNeedsApproval = derived(currentPlan, ($plan) => {
	return $plan?.status === 'draft';
});
```

```typescript
// src/lib/stores/dashboard/shadow-graph-store.ts (NEW)

import { writable, derived } from 'svelte/store';
import type { GraphEntity, GraphRelation, AttackPath } from '$lib/types/shadow-graph';

export const shadowGraphEntities = writable<Map<string, GraphEntity>>(new Map());
export const shadowGraphRelations = writable<Map<string, GraphRelation>>(new Map());
export const attackPaths = writable<AttackPath[]>([]);

// GeoJSON exports for MapLibre
export const shadowGraphNodes = derived(shadowGraphEntities, ($entities) => {
	// Convert entities with positions to GeoJSON FeatureCollection of Points
});

export const shadowGraphEdges = derived(
	[shadowGraphEntities, shadowGraphRelations],
	([$entities, $relations]) => {
		// Convert relations between positioned entities to GeoJSON LineStrings
	}
);

// Statistics
export const graphStats = derived(
	[shadowGraphEntities, shadowGraphRelations],
	([$entities, $relations]) => ({
		hosts: [...$entities.values()].filter((e) => e.type === 'host').length,
		services: [...$entities.values()].filter((e) => e.type === 'service').length,
		vulnerabilities: [...$entities.values()].filter((e) => e.type === 'vulnerability').length,
		credentials: [...$entities.values()].filter((e) => e.type === 'credential').length,
		relations: $relations.size
	})
);
```

---

## Component 7: Agent Status Panel (UI)

**Location:** `src/lib/components/dashboard/panels/AgentStatusPanel.svelte` (NEW)

### Panel Layout

```
┌─────────────────────────────┐
│ ⚡ AGENT STATUS             │
├─────────────────────────────┤
│ TARGET: NETGEAR-5G          │
│ OBJECTIVE: WPA2 crack       │
│ STATUS: ● EXECUTING         │
│ PROGRESS: ████████░░ 80%    │
├─────────────────────────────┤
│ PLAN STEPS:                 │
│ ✓ 1. Passive recon          │
│ ✓ 2. Identify clients       │
│ ✓ 3. Deauth client          │
│ ● 4. Capture handshake      │  ← currently executing
│ ○ 5. Crack with wordlist    │
│ ○ 6. Validate access        │
├─────────────────────────────┤
│ SHADOW GRAPH: 12 entities   │
│ • 3 hosts, 5 services       │
│ • 2 vulns, 2 credentials    │
│ INSIGHTS:                   │
│ • admin:password123 not     │
│   tested against SSH on     │
│   192.168.1.1               │
├─────────────────────────────┤
│ [APPROVE] [PAUSE] [ABORT]   │
└─────────────────────────────┘
```

### Registration in Dashboard

Add to `PanelContainer.svelte`:

```svelte
{:else if $activePanel === 'agent-status'}
  <AgentStatusPanel />
```

Add icon to `IconRail.svelte` (use existing pattern).

---

## Operator Workflow: End-to-End

### Scenario: WiFi AP Penetration During Training Exercise

```
1. OBSERVE
   - Argos tactical map shows WiFi APs detected by Kismet
   - Operator sees "OPFOR-WiFi" AP at bearing 045°, -52dBm
   - 3 clients connected, WPA2-PSK encryption

2. ORIENT
   - Operator clicks "OPFOR-WiFi" on map
   - Agent Status Panel auto-populates with device details
   - Shadow graph shows this AP connected to 3 client devices

3. DECIDE
   - Operator clicks "Generate Attack Plan"
   - Agent returns structured plan:
     Step 1: Monitor channel 6 for 30s (passive recon)
     Step 2: Identify most active client (packet analysis)
     Step 3: Deauth target client (aireplay-ng)
     Step 4: Capture WPA2 handshake (airodump-ng)
     Step 5: Crack with rockyou.txt (aircrack-ng)
     Step 6: Connect and validate access
   - Operator reviews, approves all steps

4. ACT
   - Agent executes steps sequentially
   - Each step streams output to Agent Chat
   - Plan progress bar updates in real-time
   - Shadow graph grows: new credential entity discovered
   - On success: after-action report generated

5. ADAPT (if step fails)
   - Step 3 fails: "No client responded to deauth"
   - Agent auto-replans: "Try PMKID capture instead (no client needed)"
   - New step inserted, operator approves
   - Execution continues with modified plan
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1-2)

1. Plan Engine (`plan-engine.ts`) — plan generation, validation, step tracking
2. Plan API endpoints (`/api/agent/plan/`)
3. Agent Plan Store (`agent-plan-store.ts`)
4. Agent Status Panel (`AgentStatusPanel.svelte`)
5. Enhanced system prompt with plan awareness

### Phase 2: Execution (Week 3-4)

6. `recon-agent` MCP server (nmap, dns, fingerprint, wifi survey, BLE scan)
7. `attack-agent` MCP server (wifi attack, credential, exploit, BLE, MITM)
8. `environment-scanner` MCP server (tool inventory)
9. Tool result → plan step status pipeline
10. Replan on failure flow

### Phase 3: Intelligence (Week 5-6)

11. Shadow Graph Engine (`shadow-graph.ts`)
12. Auto-extraction from tool outputs
13. Shadow Graph Store + GeoJSON export
14. MapLibre overlay layers (entities + relations)
15. Attack path computation and display

### Phase 4: Training (Week 7-8)

16. Playbook data model and JSON definitions
17. Playbook → Plan conversion
18. Playbook selector UI
19. After-action report generation
20. `wireless-agent` MCP server (spectrum, classify, direction find)

---

## What We Are NOT Building

- **Custom agent loop** — Claude Code's built-in loop is proven sufficient
- **Neo4j/Graphiti** — in-memory graph + SQLite persistence is enough
- **pgvector** — no vector embeddings needed; Claude's context window handles memory
- **Temporal/workflow engine** — single-operator use doesn't need distributed durability
- **Model routing** — Max plan provides unlimited Claude usage
- **Custom ReAct loop** — agent reasoning happens inside Claude, not our code
- **Docker execution sandbox** — RPi5 runs tools natively on Kali Linux

---

## Security Considerations

All new MCP tools MUST follow Argos security rules:

1. **Input validation** — every tool argument validated via `input-sanitizer.ts`
2. **execFile() only** — never `exec()` with string interpolation
3. **Rate limiting** — hardware-touching tools rate-limited (existing pattern)
4. **Auth required** — all `/api/agent/plan/` endpoints behind API key
5. **Plan approval gate** — agent cannot execute without operator approval
6. **Target scope validation** — plans validated against authorized target list
7. **Audit logging** — every tool execution logged to SQLite with timestamp, operator, result
