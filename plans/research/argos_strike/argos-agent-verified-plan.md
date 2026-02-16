# Argos AI Agent: Dependency-Verified Implementation Plan

**Date:** 2026-02-13
**Verification Method:** Dependency Verification Rulebook v2.0 (8 phases)
**Inventory Source:** Direct file reads from Argos codebase

---

## PROOF DOCUMENT 1: Complete File Map

### Existing Files to Modify

| Existing File                                            | Change Required                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/server/agent/runtime.ts`                        | Add plan-aware system prompt builder, tool result interception for shadow graph             |
| `src/lib/server/agent/tools.ts`                          | Add plan management tools (generate_plan, approve_plan, execute_step) to `argosTools` array |
| `src/lib/server/agent/frontend-tools.ts`                 | Add `showPlanStatus`, `updateGraphOverlay` frontend tools to `frontendTools` array          |
| `src/lib/server/agent/index.ts`                          | Re-export new plan and graph modules                                                        |
| `src/routes/api/agent/stream/+server.ts`                 | Thread plan context through to agent runtime                                                |
| `src/lib/stores/dashboard/agent-context-store.ts`        | Add `currentPlan`, `shadowGraphData` to `agentContext` derived store                        |
| `src/lib/stores/dashboard/dashboard-store.ts`            | Add `'agent-status'` to `activePanel` type, add `'shadow-graph'` to `layerVisibility`       |
| `src/lib/components/dashboard/IconRail.svelte`           | Add agent-status icon to `topIcons` array                                                   |
| `src/lib/components/dashboard/PanelContainer.svelte`     | Add `AgentStatusPanel` conditional render block                                             |
| `src/lib/components/dashboard/DashboardMap.svelte`       | Add 2 GeoJSON sources + 3 layers for shadow graph overlay                                   |
| `src/lib/components/dashboard/panels/LayersPanel.svelte` | Add `shadowGraph` toggle to layer toggles                                                   |
| `src/lib/server/db/schema.sql`                           | Add `agent_plans`, `plan_steps`, `graph_entities`, `graph_relations` tables                 |
| `src/lib/server/db/database.ts`                          | Add plan and graph repository delegates to `RFDatabase` class                               |
| `src/lib/types/index.ts`                                 | Re-export new type files                                                                    |
| `package.json`                                           | Add npm scripts for new MCP servers                                                         |

### New Files to Create

| New File                                                      | Purpose                                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/types/agent-plan.ts`                                 | AttackPlan, PlanStep, PlanStepStatus types                                                                     |
| `src/lib/types/shadow-graph.ts`                               | GraphEntity, GraphRelation, AttackPath, EntityType, RelationType types                                         |
| `src/lib/types/playbook.ts`                                   | Playbook, PlaybookPhase, PlaybookTechnique types                                                               |
| `src/lib/server/agent/plan-engine.ts`                         | Plan generation, validation, step tracking, replan logic                                                       |
| `src/lib/server/agent/shadow-graph.ts`                        | In-memory graph engine, extractors, GeoJSON export, persistence                                                |
| `src/lib/server/agent/prompts/plan-generation.ts`             | System prompt template for plan generation                                                                     |
| `src/lib/server/agent/prompts/agent-execution.ts`             | Enhanced system prompt with plan + graph context                                                               |
| `src/lib/server/db/plan-repository.ts`                        | CRUD for agent_plans and plan_steps tables                                                                     |
| `src/lib/server/db/graph-repository.ts`                       | CRUD for graph_entities and graph_relations tables                                                             |
| `src/lib/stores/dashboard/agent-plan-store.ts`                | Svelte stores for plan state, progress, approval                                                               |
| `src/lib/stores/dashboard/shadow-graph-store.ts`              | Svelte stores for graph entities, GeoJSON exports                                                              |
| `src/lib/components/dashboard/panels/AgentStatusPanel.svelte` | Plan steps, progress, graph stats, controls                                                                    |
| `src/routes/api/agent/plan/+server.ts`                        | POST (generate), GET (status) endpoints                                                                        |
| `src/routes/api/agent/plan/[id]/+server.ts`                   | PUT (approve), DELETE (cancel) for specific plan                                                               |
| `src/routes/api/agent/plan/[id]/execute/+server.ts`           | POST to start plan execution                                                                                   |
| `src/routes/api/agent/graph/+server.ts`                       | GET graph data, GET GeoJSON export                                                                             |
| `src/lib/server/mcp/servers/recon-agent.ts`                   | MCP server: network_scan, dns_recon, service_fingerprint, wifi_survey, bluetooth_scan                          |
| `src/lib/server/mcp/servers/attack-agent.ts`                  | MCP server: wifi_attack, credential_attack, exploit_service, bluetooth_attack, network_mitm, post_exploitation |
| `src/lib/server/mcp/servers/environment-scanner.ts`           | MCP server: scan_available_tools, check_hardware_status                                                        |
| `src/lib/data/playbooks/wifi-wpa2-penetration.json`           | Playbook definition                                                                                            |
| `src/lib/data/playbooks/wifi-rogue-ap-detection.json`         | Playbook definition                                                                                            |
| `src/lib/data/playbooks/bluetooth-ble-exploitation.json`      | Playbook definition                                                                                            |
| `src/lib/data/playbooks/network-recon.json`                   | Playbook definition                                                                                            |
| `src/lib/data/playbooks/gsm-imsi-collection.json`             | Playbook definition                                                                                            |
| `src/lib/data/playbooks/rf-signal-hunt.json`                  | Playbook definition                                                                                            |
| `tests/unit/agent/plan-engine.test.ts`                        | Unit tests for plan engine                                                                                     |
| `tests/unit/agent/shadow-graph.test.ts`                       | Unit tests for shadow graph                                                                                    |
| `tests/unit/agent/prompts.test.ts`                            | Unit tests for prompt generation                                                                               |
| `tests/security/agent-plan-auth.test.ts`                      | Auth gate tests for plan endpoints                                                                             |
| `tests/integration/agent/plan-flow.test.ts`                   | Integration test for plan lifecycle                                                                            |

---

## PROOF DOCUMENT 2: Complete Dependency List

### Existing Dependencies (No Changes Needed)

Every dependency needed is already in `package.json`:

| Package                     | Version    | Used For                                              |
| --------------------------- | ---------- | ----------------------------------------------------- |
| `@modelcontextprotocol/sdk` | `^1.26.0`  | MCP Server + StdioServerTransport for new MCP servers |
| `better-sqlite3`            | `^12.2.0`  | Plan and graph persistence tables                     |
| `@types/better-sqlite3`     | `^7.6.13`  | Type definitions for above                            |
| `svelte`                    | `^5.35.5`  | New AgentStatusPanel component                        |
| `@sveltejs/kit`             | `^2.22.3`  | New API route handlers                                |
| `svelte-maplibre-gl`        | `^1.0.3`   | New GeoJSON sources + layers for shadow graph         |
| `maplibre-gl`               | `^5.6.1`   | Underlying map rendering                              |
| `zod`                       | `^3.25.76` | Plan/step schema validation                           |
| `dotenv`                    | `^17.2.1`  | MCP server env loading                                |
| `ws`                        | `^8.18.3`  | WebSocket (existing pattern)                          |
| `typescript`                | `^5.8.3`   | Type system                                           |
| `vitest`                    | `^3.2.4`   | New test files                                        |
| `tsx`                       | `^4.20.3`  | MCP server execution (`npx tsx`)                      |

### New Dependencies Required: NONE

No new npm packages are needed. The plan uses only existing dependencies.

### Transitive Dependencies (Verified)

- `@modelcontextprotocol/sdk@1.26.0` depends on `zod` (already present) and `content-type` (already resolved)
- `better-sqlite3@12.2.0` has native binding (already compiled for container arch via `docker exec argos-dev npm rebuild`)
- `svelte-maplibre-gl@1.0.3` depends on `maplibre-gl` (already present as direct dependency)

### Phantom Dependencies (Made Explicit)

These are system tools the MCP servers will call via `hostExec()`. They must be installed on the Kali host:

| Tool           | Package       | Required By                                             | Verification          |
| -------------- | ------------- | ------------------------------------------------------- | --------------------- |
| `nmap`         | `nmap`        | recon-agent: `network_scan`                             | `which nmap`          |
| `airodump-ng`  | `aircrack-ng` | recon-agent: `wifi_survey`, attack-agent: `wifi_attack` | `which airodump-ng`   |
| `aireplay-ng`  | `aircrack-ng` | attack-agent: `wifi_attack`                             | `which aireplay-ng`   |
| `aircrack-ng`  | `aircrack-ng` | attack-agent: `credential_attack`                       | `which aircrack-ng`   |
| `reaver`       | `reaver`      | attack-agent: `wifi_attack` (WPS)                       | `which reaver`        |
| `hcxdumptool`  | `hcxdumptool` | attack-agent: `wifi_attack` (PMKID)                     | `which hcxdumptool`   |
| `hydra`        | `hydra`       | attack-agent: `credential_attack`                       | `which hydra`         |
| `bettercap`    | `bettercap`   | attack-agent: `bluetooth_attack`, `network_mitm`        | `which bettercap`     |
| `gatttool`     | `bluez`       | recon-agent: `bluetooth_scan`                           | `which gatttool`      |
| `dig`          | `dnsutils`    | recon-agent: `dns_recon`                                | `which dig`           |
| `hackrf_sweep` | `hackrf`      | Already used by Argos                                   | `which hackrf_sweep`  |
| `gr-gsm`       | `gr-gsm`      | Already used by gsm-evil                                | `which grgsm_livemon` |

The `environment-scanner` MCP server's `scan_available_tools` tool will verify these at runtime. Missing tools degrade gracefully (agent plans around unavailable tools).

### Environment Variables Required

| Variable            | Source   | Required By                     | Format                               |
| ------------------- | -------- | ------------------------------- | ------------------------------------ |
| `ARGOS_API_KEY`     | `.env`   | All MCP servers, all API routes | Min 32 chars hex                     |
| `ANTHROPIC_API_KEY` | `.env`   | `runtime.ts` → Anthropic API    | `sk-ant-...`                         |
| `DATABASE_PATH`     | `.env`   | Plan + graph persistence        | File path, default `./rf_signals.db` |
| `KISMET_API_URL`    | `.env`   | Kismet-dependent agent tools    | `http://host:port`                   |
| `ARGOS_API_URL`     | implicit | MCP servers via `api-client.ts` | Default `http://localhost:5173`      |

No new environment variables needed.

---

## PROOF DOCUMENT 3: Complete Type Inventory

### New Type File: `src/lib/types/agent-plan.ts`

```typescript
// Status progression: pending → approved → in_progress → completed|failed|skipped
export type PlanStepStatus =
	| 'pending'
	| 'approved'
	| 'in_progress'
	| 'completed'
	| 'failed'
	| 'skipped';

// Plan lifecycle: draft → approved → executing → completed|failed|replanning
export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'replanning';

export type AttackPhase =
	| 'recon'
	| 'enumeration'
	| 'vulnerability'
	| 'exploitation'
	| 'post_exploitation';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PlanStep {
	id: string; // crypto.randomUUID()
	order: number; // 1-based execution order
	phase: AttackPhase;
	title: string; // "Capture WPA2 handshake"
	description: string; // "Use airodump-ng to capture..."
	tools: string[]; // ['airodump-ng', 'aireplay-ng']
	target: string; // MAC address, IP, or hostname
	risk_level: RiskLevel;
	estimated_duration_s: number; // seconds
	status: PlanStepStatus;
	output?: string; // result after execution
	error?: string; // error message if failed
	started_at?: number; // Unix timestamp ms
	completed_at?: number; // Unix timestamp ms
}

export interface AttackPlan {
	id: string; // crypto.randomUUID()
	target_id: string; // device MAC or network ID
	target_description: string; // "NETGEAR-5G WPA2 AP at -45dBm"
	objective: string; // "Gain network access..."
	playbook_id?: string; // if generated from playbook
	steps: PlanStep[];
	status: PlanStatus;
	created_at: number; // Unix timestamp ms
	approved_at?: number;
	completed_at?: number;
	replan_reason?: string; // "Handshake capture failed..."
	replan_count: number; // max 3
}
```

**Used by:** `plan-engine.ts`, `plan-repository.ts`, `agent-plan-store.ts`, `AgentStatusPanel.svelte`, plan API routes

### New Type File: `src/lib/types/shadow-graph.ts`

```typescript
export type EntityType =
	| 'host' // IP address / MAC address
	| 'service' // port + protocol (e.g., "22/tcp SSH")
	| 'credential' // username + password/hash
	| 'vulnerability' // CVE or finding
	| 'network' // SSID / subnet
	| 'wireless_ap' // WiFi access point
	| 'bluetooth_dev' // BLE device
	| 'cell_tower'; // GSM/LTE tower

export type RelationType =
	| 'HOSTS_SERVICE' // host → service
	| 'HAS_VULNERABILITY' // service → vulnerability
	| 'AUTHENTICATES_WITH' // credential → service
	| 'CONNECTS_TO' // host → host
	| 'CLIENT_OF' // client → AP
	| 'MEMBER_OF' // host → network
	| 'EXPLOITED_VIA' // host → vulnerability (success)
	| 'BLOCKED_BY'; // vulnerability → defense (failed)

export interface GraphEntity {
	id: string; // crypto.randomUUID()
	type: EntityType;
	label: string; // "192.168.1.1" or "SSH"
	properties: Record<string, unknown>; // type-specific (port, version, etc.)
	position?: { lat: number; lon: number };
	discovered_at: number; // Unix timestamp ms
	discovered_by: string; // plan step ID
	confidence: number; // 0.0-1.0
}

export interface GraphRelation {
	id: string; // crypto.randomUUID()
	source_id: string; // GraphEntity.id
	target_id: string; // GraphEntity.id
	type: RelationType;
	properties: Record<string, unknown>;
	discovered_at: number;
	weight: number; // 0.0-1.0
}

export interface AttackPath {
	id: string;
	source_id: string; // starting entity
	target_id: string; // objective entity
	hops: string[]; // entity IDs in order
	feasibility: number; // 0.0-1.0
	description: string; // "SSH → pivot → web server"
}

// GeoJSON export types (for MapLibre)
export interface GraphGeoJSON {
	nodes: GeoJSON.FeatureCollection; // Point features
	edges: GeoJSON.FeatureCollection; // LineString features
}
```

**Used by:** `shadow-graph.ts`, `graph-repository.ts`, `shadow-graph-store.ts`, `DashboardMap.svelte`, graph API routes

### New Type File: `src/lib/types/playbook.ts`

```typescript
export interface PlaybookTechnique {
	name: string; // "Beacon Frame Analysis"
	tool: string; // "airodump-ng"
	description: string;
	example_command: string; // "airodump-ng wlan1"
	success_criteria: string; // "Captured 4-way handshake"
}

export interface PlaybookPhase {
	name: string; // "Passive Reconnaissance"
	description: string;
	techniques: PlaybookTechnique[];
}

export interface Playbook {
	id: string;
	name: string; // "WiFi AP Penetration"
	description: string;
	category: 'wifi' | 'bluetooth' | 'network' | 'cellular' | 'rf' | 'combined';
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	estimated_duration_s: number;
	required_tools: string[]; // must be installed
	required_hardware: string[]; // 'hackrf', 'alfa', 'gps', 'bluetooth'
	phases: PlaybookPhase[];
	training_objectives: string[];
}
```

**Used by:** `plan-engine.ts` (playbook → plan conversion), `AgentStatusPanel.svelte` (playbook selector)

### Existing Types Referenced (No Changes)

| Type             | File                        | Fields Used                                                                       |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------- |
| `AgentContext`   | `agent-context-store.ts`    | `selectedDevice`, `selectedDeviceDetails`, `userLocation`, `kismetStatus`         |
| `KismetDevice`   | `types/kismet.ts`           | `mac`, `ssid`, `type`, `channel`, `frequency`, `encryption`, `signal.last_signal` |
| `SignalMarker`   | `types/signals.ts`          | `id`, `lat`, `lon`, `frequency`, `power`, `source`, `metadata`                    |
| `NetworkNode`    | `types/network.ts`          | `id`, `type`, `connections`, `metadata`                                           |
| `NetworkEdge`    | `types/network.ts`          | `source`, `target`, `type`, `strength`                                            |
| `DbRelationship` | `db/types.ts`               | `source_device_id`, `target_device_id`, `relationship_type`                       |
| `ToolDefinition` | `mcp/shared/base-server.ts` | `name`, `description`, `inputSchema`, `execute`                                   |

---

## PROOF DOCUMENT 4: Complete State Map

### New Stores

#### `src/lib/stores/dashboard/agent-plan-store.ts`

| Store               | Type                           | Initial Value                 | Reads                                                         | Writes                                         |
| ------------------- | ------------------------------ | ----------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `currentPlan`       | `Writable<AttackPlan \| null>` | `null`                        | AgentStatusPanel, DashboardMap, AgentChatPanel, agent runtime | Plan API response handlers, SSE event handlers |
| `planHistory`       | `Writable<AttackPlan[]>`       | `[]`                          | AgentStatusPanel (history view)                               | Plan completion handler                        |
| `currentStep`       | `Readable<PlanStep \| null>`   | derived from `currentPlan`    | AgentStatusPanel, AgentChatPanel                              | (derived)                                      |
| `planProgress`      | `Readable<number>`             | derived: `completed / total`  | AgentStatusPanel progress bar                                 | (derived)                                      |
| `planNeedsApproval` | `Readable<boolean>`            | derived: `status === 'draft'` | AgentStatusPanel approve button                               | (derived)                                      |

**State transitions for `currentPlan.status`:**

- `null` → `'draft'` : When `POST /api/agent/plan` returns
- `'draft'` → `'approved'` : When operator clicks Approve
- `'approved'` → `'executing'` : When `POST /api/agent/plan/:id/execute` is called
- `'executing'` → `'completed'` : When all steps completed
- `'executing'` → `'failed'` : When a step fails and replan limit exceeded (max 3)
- `'executing'` → `'replanning'` : When a step fails and replan triggered
- `'replanning'` → `'draft'` : When new plan generated (operator re-approves)

**State transitions for `PlanStep.status`:**

- `'pending'` → `'approved'` : On plan approval (batch)
- `'approved'` → `'in_progress'` : When step execution begins
- `'in_progress'` → `'completed'` : On success (output populated)
- `'in_progress'` → `'failed'` : On error (error populated)
- `'pending'` → `'skipped'` : On plan cancellation

#### `src/lib/stores/dashboard/shadow-graph-store.ts`

| Store                  | Type                                                                     | Initial Value              | Reads                                            | Writes                                        |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `shadowGraphEntities`  | `Writable<Map<string, GraphEntity>>`                                     | `new Map()`                | DashboardMap (GeoJSON), AgentStatusPanel (stats) | Shadow graph engine after tool result parsing |
| `shadowGraphRelations` | `Writable<Map<string, GraphRelation>>`                                   | `new Map()`                | DashboardMap (GeoJSON edges), AgentStatusPanel   | Shadow graph engine                           |
| `attackPaths`          | `Writable<AttackPath[]>`                                                 | `[]`                       | AgentStatusPanel (path display)                  | Shadow graph engine after recompute           |
| `shadowGraphNodes`     | `Readable<GeoJSON.FeatureCollection>`                                    | derived → empty collection | DashboardMap GeoJSONSource                       | (derived)                                     |
| `shadowGraphEdges`     | `Readable<GeoJSON.FeatureCollection>`                                    | derived → empty collection | DashboardMap GeoJSONSource                       | (derived)                                     |
| `graphStats`           | `Readable<{ hosts, services, vulnerabilities, credentials, relations }>` | derived → all zeros        | AgentStatusPanel                                 | (derived)                                     |

### Existing Stores Modified

| Store                                   | Modification                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `agentContext` (agent-context-store.ts) | Add `currentPlanId: string \| null` and `graphEntityCount: number` to derived output                         |
| `layerVisibility` (dashboard-store.ts)  | Add `shadowGraph: boolean` (default: `false`) to initial object                                              |
| `activePanel` type                      | Allow `'agent-status'` as valid value (currently: `'overview' \| 'tools' \| 'layers' \| 'settings' \| null`) |

---

## PROOF DOCUMENT 5: Complete API Map

### New API Endpoints

| Method | Path                           | Auth      | Request Body                                                          | Response                                        | Used By                           |
| ------ | ------------------------------ | --------- | --------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| `POST` | `/api/agent/plan`              | X-API-Key | `{ target_id: string, target_details: object, playbook_id?: string }` | `{ plan: AttackPlan }`                          | AgentStatusPanel                  |
| `GET`  | `/api/agent/plan/[id]`         | X-API-Key | —                                                                     | `{ plan: AttackPlan }`                          | AgentStatusPanel (polling)        |
| `PUT`  | `/api/agent/plan/[id]`         | X-API-Key | `{ action: 'approve' \| 'cancel', step_ids?: string[] }`              | `{ plan: AttackPlan }`                          | AgentStatusPanel (approve/cancel) |
| `POST` | `/api/agent/plan/[id]/execute` | X-API-Key | `{}`                                                                  | SSE stream (same format as `/api/agent/stream`) | AgentStatusPanel (execution)      |
| `GET`  | `/api/agent/graph`             | X-API-Key | query: `?format=geojson\|json`                                        | `GraphGeoJSON \| { entities, relations }`       | DashboardMap, AgentStatusPanel    |

### Existing API Endpoints (Unchanged, Consumed by New Code)

| Method | Path                   | Consumed By                      |
| ------ | ---------------------- | -------------------------------- |
| `POST` | `/api/agent/stream`    | AgentChatPanel (unchanged)       |
| `GET`  | `/api/agent/status`    | AgentChatPanel (unchanged)       |
| `GET`  | `/api/kismet/devices`  | `get_active_devices` agent tool  |
| `GET`  | `/api/hackrf/status`   | `get_spectrum_data` agent tool   |
| `GET`  | `/api/gps/position`    | Agent context                    |
| `GET`  | `/api/hardware/status` | `check_hardware_status` MCP tool |

### MCP Server Tool APIs

| MCP Server          | Tool Name               | Calls                                                 | Via          |
| ------------------- | ----------------------- | ----------------------------------------------------- | ------------ |
| recon-agent         | `network_scan`          | `nmap`                                                | `hostExec()` |
| recon-agent         | `dns_recon`             | `dig`, `host`, `dnsenum`                              | `hostExec()` |
| recon-agent         | `service_fingerprint`   | `nmap --script`                                       | `hostExec()` |
| recon-agent         | `wifi_survey`           | `airodump-ng`                                         | `hostExec()` |
| recon-agent         | `bluetooth_scan`        | `bettercap`, `hcitool`                                | `hostExec()` |
| attack-agent        | `wifi_attack`           | `aireplay-ng`, `airodump-ng`, `reaver`, `hcxdumptool` | `hostExec()` |
| attack-agent        | `credential_attack`     | `aircrack-ng`, `hydra`, `hashcat`                     | `hostExec()` |
| attack-agent        | `exploit_service`       | `msfconsole -x`                                       | `hostExec()` |
| attack-agent        | `bluetooth_attack`      | `bettercap`, `gatttool`                               | `hostExec()` |
| attack-agent        | `network_mitm`          | `bettercap`                                           | `hostExec()` |
| attack-agent        | `post_exploitation`     | various                                               | `hostExec()` |
| environment-scanner | `scan_available_tools`  | `which` (200+ tools)                                  | `hostExec()` |
| environment-scanner | `check_hardware_status` | `/api/hardware/status`                                | `apiFetch()` |

---

## PROOF DOCUMENT 6: Migration Order (Critical Path)

### Dependency-Ordered Implementation Sequence

```
CRITICAL PATH: 1 → 2 → 3 → 5 → 7 → 9 → 11 → 13 → 15 → 17 → 18 → 19
FLOAT ITEMS: 4, 6, 8, 10, 12, 14, 16, 20 (can be delayed)
```

| Order  | Item                                                                          | Depends On              | Type | Duration Est.                         |
| ------ | ----------------------------------------------------------------------------- | ----------------------- | ---- | ------------------------------------- |
| **1**  | Type definitions (`agent-plan.ts`, `shadow-graph.ts`, `playbook.ts`)          | Nothing                 | FS   | Types must exist before any code      |
| **2**  | DB schema additions (4 new tables in `schema.sql`)                            | 1                       | FS   | Tables must exist before repositories |
| **3**  | DB repositories (`plan-repository.ts`, `graph-repository.ts`)                 | 1, 2                    | FS   | Repos before engine                   |
| **4**  | DB integration into `RFDatabase` class                                        | 3                       | FS   | Adds delegates                        |
| **5**  | Plan Engine (`plan-engine.ts`)                                                | 1, 3                    | FS   | Core business logic                   |
| **6**  | Shadow Graph Engine (`shadow-graph.ts`)                                       | 1, 3                    | FS   | Can parallel with 5                   |
| **7**  | Prompt templates (`plan-generation.ts`, `agent-execution.ts`)                 | 1                       | FS   | Needed by runtime                     |
| **8**  | Agent tools additions (plan tools in `tools.ts`)                              | 1, 5                    | FS   | Can parallel with 9                   |
| **9**  | Agent runtime modifications (`runtime.ts`)                                    | 5, 6, 7                 | FS   | Integrates plan+graph                 |
| **10** | Plan API routes (`/api/agent/plan/...`)                                       | 5, 9                    | FS   | HTTP layer                            |
| **11** | Graph API route (`/api/agent/graph`)                                          | 6                       | FS   | HTTP layer                            |
| **12** | Svelte stores (`agent-plan-store.ts`, `shadow-graph-store.ts`)                | 1                       | FS   | Before UI                             |
| **13** | Existing store modifications (`agent-context-store.ts`, `dashboard-store.ts`) | 12                      | FS   | Add new fields                        |
| **14** | AgentStatusPanel component                                                    | 1, 12                   | FS   | New panel                             |
| **15** | IconRail + PanelContainer modifications                                       | 14                      | FS   | Register panel                        |
| **16** | DashboardMap shadow graph layers                                              | 12 (shadow-graph-store) | FS   | Map overlay                           |
| **17** | LayersPanel toggle for shadow graph                                           | 13 (layerVisibility)    | FS   | UI toggle                             |
| **18** | environment-scanner MCP server                                                | Nothing (standalone)    | —    | Can start anytime                     |
| **19** | recon-agent MCP server                                                        | Nothing (standalone)    | —    | Can start anytime                     |
| **20** | attack-agent MCP server                                                       | Nothing (standalone)    | —    | Can start anytime                     |
| **21** | Playbook JSON files                                                           | 1 (types)               | —    | Can start anytime                     |
| **22** | Unit tests                                                                    | All above               | FF   | Must finish after code                |
| **23** | Security tests                                                                | 10, 11 (API routes)     | FF   | Test auth gates                       |
| **24** | Integration tests                                                             | 9 (runtime)             | FF   | Test full flow                        |
| **25** | `index.ts` barrel exports                                                     | All modules             | FF   | Final wiring                          |

### Critical Path Analysis

**Longest chain (determines minimum time):**
Types → DB schema → Repositories → Plan Engine → Runtime modifications → Plan API routes → Stores → Panel component → Icon/Panel registration → Verification

**Parallelizable work:**

- Shadow Graph Engine (step 6) can be built alongside Plan Engine (step 5)
- All 3 MCP servers (steps 18-20) can be built in parallel with everything else
- Playbook JSONs (step 21) are independent of all code
- Unit tests can be written alongside the code they test

### Hard Constraints (Non-Negotiable)

1. Types before any code that references them
2. DB schema before repositories
3. Repositories before engines (plan-engine, shadow-graph)
4. Engines before runtime modifications
5. Stores before UI components
6. `agentContext` store changes before AgentStatusPanel (it reads the store)
7. MCP server `BaseMCPServer` must not be modified (existing servers depend on it)

### Soft Constraints (Can Be Adjusted)

1. Playbooks can ship after core plan engine (plans can be generated without playbooks)
2. Shadow graph map overlay can ship after plan execution (plan works without graph visualization)
3. attack-agent MCP can ship after recon-agent (recon is useful standalone)

---

## PROOF DOCUMENT 7: Environment and Infrastructure Manifest

| Requirement                      | Type             | Where Set                 | What Breaks If Missing                                   |
| -------------------------------- | ---------------- | ------------------------- | -------------------------------------------------------- |
| `ARGOS_API_KEY` (min 32 chars)   | env var          | `.env`                    | **System refuses to start** (`src/lib/server/env.ts`)    |
| `ANTHROPIC_API_KEY`              | env var          | `.env`                    | Agent returns "unavailable" (graceful degradation)       |
| `DATABASE_PATH`                  | env var          | `.env`                    | Falls back to `./rf_signals.db`                          |
| Node.js 20.x                     | runtime          | system                    | SvelteKit won't start                                    |
| `--max-old-space-size=1024`      | Node flag        | `package.json` dev script | Already set, OOM protection                              |
| SQLite WAL mode                  | DB pragma        | `database.ts` constructor | Already set                                              |
| Docker `pid:host` + `privileged` | container config | `docker-compose.yml`      | `hostExec()` fails → MCP tools can't run system commands |
| Kali Linux security tools        | system packages  | Host OS                   | MCP tools degrade (environment-scanner reports missing)  |
| USB 3.0 powered hub              | hardware         | Physical                  | HackRF + Alfa can't run simultaneously                   |
| Alfa wireless adapter            | hardware         | USB                       | WiFi survey/attack tools fail                            |
| HackRF One                       | hardware         | USB                       | Spectrum analysis tools fail                             |
| GPS receiver                     | hardware         | Serial/USB                | Location data unavailable                                |
| Network connectivity to target   | network          | Training range            | All attack tools fail                                    |

---

## PROOF DOCUMENT 8: Risk and Assumption Register

| #   | Risk/Assumption                                                          | Evidence                                                                                             | Impact                                                                 | Mitigation                                                                                                                                                            | Tripwire                                                    |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R1  | **Anthropic API rate limits during plan execution**                      | Agent makes 10-50 API calls per plan step. Rate limits vary by plan.                                 | High — execution stalls mid-plan                                       | Implement exponential backoff in runtime. Step timeout with graceful failure. Replan on timeout.                                                                      | SSE stream returns `RunError` with "rate_limit"             |
| R2  | **hostExec() command injection via tool parameters**                     | MCP tools pass user-influenced target data to shell commands                                         | Critical — shell injection on host                                     | Every MCP tool MUST validate inputs via `input-sanitizer.ts` validators. Use `execFile()` with array args, never template strings.                                    | Security tests with injection payloads                      |
| R3  | **Shadow graph memory growth on long engagements**                       | Each tool result adds entities. 100+ tool calls → potentially thousands of entities in-memory        | Medium — 1GB Node heap limit                                           | Cap graph at 500 entities, 1000 relations. Prune lowest-confidence entities. Persist to SQLite and query on demand vs. holding all in memory.                         | Monitor `process.memoryUsage()`, warn at 800MB              |
| R4  | **Plan step timeout — tool hangs**                                       | `nmap -A` can take 10+ minutes on slow networks. `aircrack-ng` dictionary attack is unbounded.       | Medium — plan execution blocks                                         | `hostExec()` already supports timeout. Set per-tool timeouts: nmap 120s, aircrack 300s, default 60s.                                                                  | Step `started_at` age exceeds `estimated_duration_s * 3`    |
| R5  | **WiFi adapter not in monitor mode**                                     | `wifi_survey` and `wifi_attack` require monitor mode on Alfa adapter                                 | High — tools fail silently or with cryptic errors                      | MCP tools check `iwconfig wlan1` for Mode:Monitor before executing. Return clear error if not set.                                                                    | Tool output contains "not in monitor mode" or empty results |
| R6  | **GeoJSON source performance with large graph**                          | MapLibre re-renders on every store update. 500+ features = lag on RPi5                               | Medium — map becomes sluggish                                          | Debounce store updates (200ms). Use MapLibre `setData()` instead of reactive binding for large updates.                                                               | FPS drops below 15 on map interaction                       |
| R7  | **Agent generates unsafe plan steps**                                    | LLM might propose `rm -rf`, `reboot`, or attacks outside scope                                       | Critical — destructive actions on host                                 | Plan validation in `plan-engine.ts`: whitelist allowed tools, blacklist dangerous commands, validate target is in authorized range. Operator approval is a hard gate. | Plan validation rejects step                                |
| R8  | **SQLite write contention during plan execution**                        | Agent writes plan step updates + graph entities + signals simultaneously                             | Low — SQLite WAL handles concurrent reads, but writes are serialized   | Already using WAL mode. Batch graph entity writes. Use transactions for multi-row updates.                                                                            | `SQLITE_BUSY` errors in logs                                |
| R9  | **MCP server process count**                                             | Each new MCP server is a separate `npx tsx` process (~200MB each). 3 new servers = ~600MB additional | High — RPi5 has 8GB total, existing MCP servers use ~800MB             | Only start MCP servers on demand, not all at boot. Add `--lazy` flag to MCP config.                                                                                   | System RAM usage exceeds 6GB                                |
| R10 | **Nmap XML parsing fails on unexpected output**                          | Different nmap versions produce slightly different XML. Non-standard scripts add custom elements.    | Low — shadow graph misses entities                                     | Use tolerant XML parsing (regex extraction as fallback). Log unparseable sections without crashing.                                                                   | Graph entity count is 0 after nmap scan completes           |
| A1  | **Assumption: Anthropic API key is always present**                      | Required by env validation                                                                           | If wrong: agent endpoints return 500 instead of graceful "unavailable" | `runtime.ts` already checks `isAnthropicAvailable()`. Plan endpoints should check before calling Claude.                                                              | `/api/agent/status` returns `unavailable`                   |
| A2  | **Assumption: MapLibre GL supports dynamic GeoJSON source updates**      | Documentation confirms `setData()` on GeoJSONSource                                                  | If wrong: shadow graph overlay won't update reactively                 | Tested by existing device layer which updates from kismetStore. Same pattern.                                                                                         | Graph layer shows stale data                                |
| A3  | **Assumption: Existing database.ts schema migration handles new tables** | `schema.sql` is read by `database.ts` constructor via `readFileSync`                                 | If wrong: new tables don't exist                                       | Verify `schema.sql` is loaded idempotently (CREATE TABLE IF NOT EXISTS). Migration script handles additions.                                                          | `SQLITE_ERROR: no such table: agent_plans`                  |

---

## PHASE 7: Pre-Mortem Results

**Scenario: "The plan was executed. It failed completely."**

### Failure Mode 1: Plan generation returns invalid JSON

**Why:** Claude returns markdown-wrapped JSON or extra commentary instead of raw JSON.
**Mitigated by:** Use Zod schema validation on Claude's response. If parse fails, retry with explicit "respond with ONLY JSON" instruction (max 2 retries). Already present in concept but must be implemented in `plan-engine.ts`.
**Added to plan:** Zod schema for `AttackPlan` in `plan-engine.ts`, retry with stricter prompt on parse failure.

### Failure Mode 2: Agent executes MCP tool that isn't registered

**Why:** Plan references `network_scan` but MCP server isn't running.
**Mitigated by:** Plan validation step checks all `step.tools` against registered MCP tools. If tool unavailable, plan generation prompt includes only available tools (from `scan_available_tools`).
**Added to plan:** `validatePlanTools()` function in plan engine.

### Failure Mode 3: Step-by-step approval UX blocks the operator

**Why:** Operator has to click Approve for every step. Tedious during training exercise.
**Mitigated by:** "Approve All" button approves entire plan at once. Individual step approval is optional.
**Already in plan:** Approve All is the primary action.

### Failure Mode 4: Shadow graph entities lack GPS coordinates

**Why:** Nmap returns IPs, not locations. No way to place on map without GPS.
**Mitigated by:** Entities without position get the operator's current GPS position (from `gpsStore`). When triangulation data is available from multiple observations, position is refined.
**Added to plan:** Default entity position = operator GPS. `positionSource: 'operator' | 'observed' | 'triangulated'` field.

### Failure Mode 5: Existing tests break from store modifications

**Why:** Adding fields to `agentContext` derived store changes its shape. Existing tests may assert on exact shape.
**Mitigated by:** New fields are additive (new optional fields). Existing fields unchanged. Run `npm run test:unit` after every store modification.
**Verification:** Search for test files that import `agentContext` and verify they don't assert on exact shape.

---

## PHASE 8: Consistency Verification

### Version Consistency

- All new code uses TypeScript 5.8.3 (same as project)
- All new MCP servers use `@modelcontextprotocol/sdk ^1.26.0` (same as existing)
- All new stores use `svelte/store` from Svelte 5.35.5 (same as project)
- All new DB code uses `better-sqlite3 ^12.2.0` (same as project)
- No new dependencies = no version conflicts possible

### Naming Consistency

- New type files follow existing pattern: `src/lib/types/{domain}.ts`
- New store files follow existing pattern: `src/lib/stores/dashboard/{feature}-store.ts`
- New MCP servers follow existing pattern: `src/lib/server/mcp/servers/{name}.ts`
- New API routes follow existing pattern: `src/routes/api/agent/{feature}/+server.ts`
- New panel follows existing pattern: `src/lib/components/dashboard/panels/{Name}Panel.svelte`
- Tool names use snake_case (matching existing `get_device_details`, `get_nearby_signals`)
- Store exports use camelCase (matching existing `kismetStore`, `gpsStore`)

### Behavioral Consistency

- Plan API endpoints return JSON (matching all existing API endpoints)
- Plan execution streams SSE (matching existing `/api/agent/stream`)
- New MCP servers extend `BaseMCPServer` (same as all 7 existing servers)
- New MCP servers use `apiFetch()` for API calls (same as all existing servers)
- New stores use `writable()` and `derived()` (same as all existing stores)
- Auth enforced at `hooks.server.ts` for all new `/api/agent/*` routes (existing pattern matches `HARDWARE_PATH_PATTERN` — plan routes don't need special rate limiting since they don't touch hardware directly)
- Input validation uses `validateMacAddress()`, `validateNumericParam()`, etc. from `input-sanitizer.ts`
- Error responses use `safeErrorResponse()` from `error-response.ts`

### Temporal Consistency

- Types (step 1) before code that imports them (steps 3-25)
- Schema (step 2) before repositories (step 3)
- Repositories (step 3) before engines (steps 5-6)
- Engines (steps 5-6) before runtime (step 9)
- Stores (step 12) before UI components (steps 14-17)
- No circular dependencies detected:
    - `plan-engine.ts` → `plan-repository.ts` → `db/types.ts` (one-way)
    - `shadow-graph.ts` → `graph-repository.ts` → `db/types.ts` (one-way)
    - `runtime.ts` → `plan-engine.ts` + `shadow-graph.ts` (one-way)
    - `AgentStatusPanel.svelte` → `agent-plan-store.ts` → `types/agent-plan.ts` (one-way)

---

## TRACEABILITY MATRIX

| Requirement                             | Plan Step(s) | Deliverable(s)                                          | Verification                                                           |
| --------------------------------------- | ------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Operator clicks target → plan generated | 5, 7, 10     | plan-engine.ts, plan-generation.ts, plan API            | Integration test: POST /api/agent/plan with target returns valid plan  |
| Operator reviews and approves plan      | 12, 14, 15   | agent-plan-store.ts, AgentStatusPanel, IconRail         | Manual test: plan appears in panel, Approve button works               |
| Agent executes plan steps sequentially  | 5, 8, 9      | plan-engine.ts, tools.ts, runtime.ts                    | Integration test: plan execution streams step progress                 |
| Tool results build shadow graph         | 6, 11        | shadow-graph.ts, graph API                              | Unit test: nmap XML → graph entities                                   |
| Shadow graph renders on map             | 12, 16, 17   | shadow-graph-store.ts, DashboardMap layers, LayersPanel | Manual test: entities appear on map after tool execution               |
| Failed step triggers replan             | 5, 9         | plan-engine.ts, runtime.ts                              | Unit test: step failure → replan_count increments, new steps generated |
| MCP servers wrap security tools         | 18, 19, 20   | recon-agent, attack-agent, environment-scanner          | Unit test: tool execution returns valid output                         |
| Input validation on all MCP tools       | 18, 19, 20   | Each tool's execute() function                          | Security test: injection payloads rejected                             |
| Auth required on all new endpoints      | 10, 11       | API route handlers                                      | Security test: request without API key returns 401                     |
| All state persists to SQLite            | 2, 3, 4      | schema.sql, repositories, RFDatabase                    | Unit test: insert + query round-trip                                   |
| Memory stays under 1GB                  | All          | All                                                     | Performance test: memory monitoring during full plan execution         |
| No new npm dependencies                 | All          | package.json                                            | Verification: `git diff package.json` shows only script additions      |

---

## DEFINITION OF DONE

### Task-Level Done

The overall task is DONE when:

1. `npm run typecheck` passes with 0 errors
2. `npm run lint` passes with 0 errors
3. `npm run test:unit` passes — including new test files
4. `npm run test:security` passes — including new auth tests
5. `npm run build` succeeds
6. Operator can: click device on map → see plan → approve → watch execution → see graph on map
7. No new npm dependencies added
8. All new API endpoints require authentication
9. All MCP tool inputs validated via `input-sanitizer.ts`
10. All errors use `safeErrorResponse()` — no stack traces leaked

### Out of Scope (Explicitly)

- Custom agent loop (Claude Code's loop is sufficient)
- Neo4j or any external graph database
- Vector embeddings or pgvector
- Temporal workflow engine
- Model routing or multi-provider support
- Real-time collaboration (single operator)
- Wireless-agent MCP server (Phase 4 — deferred)
- RF signal classification ML model integration (separate effort)
- Combined multi-domain playbook execution (individual playbooks first)
