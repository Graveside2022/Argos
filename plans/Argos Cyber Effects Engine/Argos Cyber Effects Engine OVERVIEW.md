**# ARGOS Cyber Effects Engine — Task Architect Decomposition & Dependency Verification**

---

**# PART 1: THE BRIEF**

**## Task Brief**

**CONTEXT:**
The operator is building Argos, a tactical pentesting dashboard built with TypeScript/SvelteKit, deployed on Raspberry Pi with Kali Linux. Argos already has: a SvelteKit UI, a Kismet integration (for network target discovery), a TAK integration (for tactical map display), and a working dashboard with panels. The operator wants to add an AI-powered "Cyber Effects Engine" that spans two domains — network pentesting (targets from Kismet) and RF/electronic warfare (targets from spectrum scanning via HackRF One). The AI backend is Anthropic Claude. The operator has identified 7 open-source repositories to extract architectural patterns from: 6 network pentest agent repos (Shannon, CAI, PentestAgent, Strix, HexStrike AI, PentAGI) and 1 RF framework (FISSURE).

The existing Argos codebase structure, current SvelteKit version, existing route layout, existing component library, existing TAK bridge implementation, and existing Kismet adapter are all unknown and must be inventoried before any implementation begins.

**PROBLEM:**
Argos currently has no AI-driven workflow capability. An operator looking at a Kismet target or a spectrum scan result has no way to invoke automated reconnaissance, vulnerability analysis, exploitation, or RF actions through Claude-powered reasoning. The Cyber Effects Engine does not exist yet — this is greenfield construction within an existing application.

**REQUIREMENTS:**

1. The operator can right-click a network target from Kismet (MAC, IP, SSID) and select a cyber effect action (Recon, Analyze, Exploit) from a context menu.
2. The operator can click a detected RF signal in a spectrum panel and select an investigation action (Capture, Analyze, Attack).
3. Selected actions trigger Claude-powered workflows that reason about the target, select appropriate tools, execute them, interpret results, and adapt strategy.
4. Passive reconnaissance and receive-only RF scanning execute automatically without operator confirmation (Tier 0).
5. Active probing and targeted signal capture require single operator confirmation before execution (Tier 1).
6. Exploitation, any RF transmission, credential brute forcing, and any environment-modifying action require explicit operator authorization with ROE justification (Tier 2).
7. Workflow progress streams in real-time to the operator dashboard, showing Claude's reasoning and tool outputs.
8. Discovered vulnerabilities, RF intel, and findings display in a structured findings panel.
9. All discovered targets, emitters, and findings push to TAK as Cursor-on-Target markers, integrating with Argos's existing TAK connection.
10. The system wraps Kali Linux tools (nmap, nikto, sqlmap, aircrack-ng) and SDR tools (hackrf_sweep, hackrf_transfer, GNU Radio) as callable functions for Claude's tool_use.
11. No existing Argos functionality breaks.

**CONSTRAINTS:**

- Must integrate into the existing Argos SvelteKit application without breaking existing functionality.
- Must run on Raspberry Pi (ARM architecture) — all tool choices must be ARM-compatible.
- AI backend is Anthropic Claude via `@anthropic-ai/sdk` — no LangChain, LiteLLM, or other abstraction layers.
- Authorization tiers are non-negotiable — no Tier 2 action may execute without explicit operator approval.
- All RF transmission requires human confirmation — no autonomous transmission under any circumstances.
- Must use existing Argos TAK integration, not build a new one.
- Must use existing Argos Kismet integration as a data source, not replace it.
- TypeScript for all new code (matching existing Argos codebase).
- The 7 reference repos are for pattern extraction only — no runtime dependency on any of them.

**SUCCESS CRITERIA:**

- The operator opens Argos, sees a network target from Kismet, right-clicks it, selects "Recon," and watches Claude reason through an nmap scan, service enumeration, and target profiling — with results appearing in the findings panel and on the TAK map.
- The operator opens Argos, sees a spectrum scan panel with detected signals, clicks "Investigate" on a hot frequency, and watches Claude capture the signal, analyze modulation, and identify the protocol — with the emitter appearing on the TAK map.
- The operator triggers an exploit workflow — Argos pauses, displays the proposed action with ROE context, and waits for explicit approval before proceeding.
- The operator triggers an RF replay — Argos pauses, displays the proposed transmission with frequency/power/duration, and waits for explicit approval.
- All passive recon and receive-only scanning proceeds without any confirmation dialogs.

**USER SUGGESTIONS:**

- The operator has identified 7 specific repos to extract patterns from (Shannon, CAI, PentestAgent, Strix, HexStrike AI, PentAGI, FISSURE). These are leads for architectural patterns, not confirmed choices — the extraction phase will determine which patterns are actually portable and useful.
- The operator suggests a specific file structure (`src/lib/cybereffects/...`). This is a reasonable starting point but must be validated against the existing Argos file structure.
- The operator suggests specific tool wrappers (nmap, nikto, sqlmap, aircrack-ng, hackrf_sweep, hackrf_transfer). These are reasonable choices for Kali Linux but must be verified for ARM compatibility on Raspberry Pi.

**INVESTIGATION ITEMS:**

1. **Existing Argos codebase inventory** — file structure, routes, components, state management, API layer, build configuration, dependency list with versions.
2. **Existing Kismet integration** — how Argos currently pulls data from Kismet, what REST API endpoints it uses, what data structures represent targets, where this code lives.
3. **Existing TAK integration** — how Argos currently sends data to TAK, what CoT schema it uses, what bridge code exists, where this code lives.
4. **SvelteKit version and configuration** — which version, what adapter (node? static?), what routing pattern, what state management approach.
5. **Raspberry Pi ARM compatibility** — verify that all proposed tools (GNU Radio, hackrf libraries, nmap, sqlmap, etc.) have ARM builds and work on Pi.
6. **Claude API constraints** — maximum context window for tool_use, token limits for streaming, rate limits, cost implications of multi-step reasoning workflows.
7. **HackRF One on Raspberry Pi** — USB bandwidth constraints, power requirements, driver compatibility, whether hackrf_sweep and hackrf_transfer work reliably on Pi's USB stack.
8. **Each of the 7 reference repos** — actual architecture, extractable patterns, portability to TypeScript. This is the purpose of Phases 2-5 in the original document.

---

Does this capture what you want? Anything I got wrong?

Questions requiring your judgment:
1. Does Argos currently have any Claude/AI integration at all, or is this entirely new?
2. Is the spectrum scanning panel already built in Argos, or does that need to be created as part of this work?
3. When you say "existing TAK integration" — is that sending CoT XML directly, using a TAK Server REST API, or something else?

**---
---**

**# PART 2: THE IMPLEMENTATION GUIDE**

**# Build the ARGOS Cyber Effects Engine**

**Task Summary:** Add an AI-powered Cyber Effects Engine to the existing Argos tactical dashboard that enables Claude-driven network pentesting and RF/EW workflows, with tiered human-in-the-loop authorization, real-time progress streaming, and TAK integration.

**End State:** The operator can select network targets from Kismet or RF signals from spectrum scanning, invoke Claude-powered workflows (recon, analysis, exploitation, RF capture/analysis/attack), see real-time reasoning and tool output, approve or deny active/offensive actions, view structured findings, and see all discoveries on the TAK tactical map.

**Prerequisites:** Must be determined in Phase 1 (Investigation). The existing Argos codebase, its dependencies, its current integrations, and the Raspberry Pi environment must be inventoried before any implementation begins.

**Assumptions:**
- ASSUMPTION A1: Argos is a working SvelteKit application that builds and runs. IF FALSE: must fix build before any new work.
- ASSUMPTION A2: Kismet is running and accessible via REST API on the same Pi or local network. IF FALSE: must set up Kismet first.
- ASSUMPTION A3: HackRF One is physically connected and recognized by the Pi. IF FALSE: must install drivers first.
- ASSUMPTION A4: The Pi has sufficient resources (CPU, RAM, USB bandwidth) to run Argos + Kismet + HackRF simultaneously. IF FALSE: must profile resource usage and potentially offload some components.
- ASSUMPTION A5: Claude API is accessible from the Pi (requires internet connectivity). IF FALSE: must determine network architecture (does the Pi have internet? Does it relay through a TAK network?).
- ASSUMPTION A6: The 7 reference repos contain extractable patterns that are portable to TypeScript. IF FALSE: some subsystems may need to be designed from scratch rather than adapted.

---

**## Phase 1: Investigation & Discovery**
**Purpose: Establish complete understanding of the existing Argos application, its environment, and its integrations before touching any code. Every subsequent phase depends on findings here.**

**### Step 1.1: Inventory the Existing Argos Codebase**

Clone or access the Argos repository. Produce a complete file inventory:

- List every file and directory under `src/` with one-sentence purpose descriptions.
- Identify the SvelteKit version from `package.json` (exact version, not range).
- List every dependency in `package.json` with exact installed versions (`npm ls --depth=0`).
- Identify the SvelteKit adapter in use (node, static, auto, etc.).
- Identify the routing pattern: file-based routes under `src/routes/`, list every route.
- Identify the state management approach: Svelte stores? Context? URL state? External library?
- Identify the CSS/styling approach: Tailwind? Plain CSS? SCSS? CSS modules?
- Identify the build configuration: `vite.config.ts`, `svelte.config.js`, `tsconfig.json`.
- Run `npm run build` and confirm it succeeds. Record any warnings.
- Run `npm run dev` and confirm the dev server starts. Record the port and any warnings.

**Why:** Every subsequent step depends on understanding what exists. Building without this inventory is building on assumptions.
**Verify:** Produce a file called `ARGOS_INVENTORY.md` containing the complete inventory. Every file relevant to the Cyber Effects integration is listed with its purpose and dependencies.

**### Step 1.2: Inventory the Existing Kismet Integration**

Locate and document Argos's current Kismet integration:

- Find every file that references "kismet" (case-insensitive grep across `src/`).
- For each file found: what does it export, what does it import, what is its purpose.
- What Kismet REST API endpoints does Argos currently call? List each with method, path, and response shape.
- What TypeScript types/interfaces represent Kismet data (devices, SSIDs, clients)? Show the full type definitions.
- How is Kismet data displayed in the UI? Which Svelte components render it?
- How is Kismet data refreshed? Polling interval? WebSocket? Server-sent events?
- Is there an existing way to select or interact with individual Kismet targets (click, right-click)?

**Why:** The Cyber Effects Engine's network workflows are triggered from Kismet targets. The integration point must be understood exactly.
**Verify:** Document the Kismet integration in `ARGOS_INVENTORY.md` — every endpoint, every type, every component. Confirm by cross-referencing with the running Kismet REST API (`http://<kismet-host>:2501/`).

**### Step 1.3: Inventory the Existing TAK Integration**

Locate and document Argos's current TAK integration:

- Find every file that references "tak", "cot", "cursor-on-target" (case-insensitive grep across `src/`).
- For each file found: what does it export, what does it import, what is its purpose.
- What TAK product does Argos talk to? (ATAK, WinTAK, TAK Server — which?)
- What protocol/format does it use? (CoT XML over TCP/UDP? TAK Server REST API? Protobuf?)
- What data does Argos currently send to TAK? What CoT types/schemas?
- Show the full CoT XML template or message construction code.
- What is the connection management code? (connect, reconnect, heartbeat, disconnect)
- Can the existing TAK bridge accept new marker types, or is it hardcoded to specific schemas?

**Why:** The Cyber Effects Engine must push findings to TAK using the existing bridge, not build a new one. Must understand the interface.
**Verify:** Document the TAK integration in `ARGOS_INVENTORY.md`. Confirm by sending a test CoT marker through the existing bridge and verifying it appears in ATAK/WinTAK/TAK Server.

**### Step 1.4: Verify Raspberry Pi Environment & Tool Availability**

On the target Raspberry Pi, verify every external tool the Cyber Effects Engine will depend on:

- `nmap --version` — record version. Confirm it runs.
- `nikto -Version` — record version. Confirm it runs.
- `sqlmap --version` — record version. Confirm it runs.
- `aircrack-ng --help` — record version. Confirm it runs.
- `hackrf_info` — confirm HackRF One is detected. Record firmware version.
- `hackrf_sweep -h` — confirm it runs. Test: `hackrf_sweep -f 400000000:500000000 -w 100000 -1` (single sweep of 400-500 MHz).
- `hackrf_transfer -h` — confirm it runs.
- `gnuradio-config-info --version` — confirm GNU Radio is installed. Record version.
- `python3 -c "import gnuradio; print(gnuradio.gr.version())"` — confirm GNU Radio Python bindings work.
- Check available RAM: `free -h`. Record total and available.
- Check CPU: `cat /proc/cpuinfo | grep "Model"`. Record model.
- Check USB: `lsusb` with HackRF connected. Record bus/device info.
- Test concurrent operation: run Kismet and hackrf_sweep simultaneously. Does the Pi handle it? Record results.

**Why:** If any tool is missing, incompatible, or the Pi can't handle concurrent loads, the build plan must adapt before implementation starts.
**Verify:** Produce an `ENVIRONMENT_MANIFEST.md` listing every tool with exact version, ARM compatibility status, and concurrent operation test results. Every "missing" or "fails" entry becomes a prerequisite to resolve before implementation.

**### Step 1.5: Verify Claude API Access & Constraints**

From the Raspberry Pi, verify Claude API connectivity and document constraints:

- Confirm the Pi can reach `api.anthropic.com` — `curl -I https://api.anthropic.com`.
- Confirm an API key is available and functional — make a test completion request.
- Record the model to use: `claude-sonnet-4-20250514` (for tool_use with reasonable cost) or `claude-opus-4-5-20250929` (for complex reasoning). Document the choice and rationale.
- Record context window limits for the chosen model.
- Record tool_use limits: maximum number of tools per request, maximum tool result size.
- Record rate limits for the API key tier.
- Record pricing per input/output token for the chosen model.
- Estimate cost per workflow: a typical recon workflow might involve 5-10 tool calls, each with ~2K tokens of tool results. Calculate approximate cost per workflow execution.

**Why:** Claude API constraints directly shape the orchestrator design — context window limits affect how much tool output can be fed back, rate limits affect concurrency, cost affects how aggressively the system can reason.
**Verify:** Document in `ENVIRONMENT_MANIFEST.md`. Confirm with a test tool_use request that includes a dummy tool definition and invocation.

**### Step 1.6: Clone and Extract Patterns from Reference Repos**

Clone all 7 reference repositories:

```
mkdir -p ~/argos-research && cd ~/argos-research
git clone https://github.com/KeygraphHQ/shannon.git
git clone https://github.com/aliasrobotics/cai.git
git clone https://github.com/GH05TCREW/pentestagent.git
git clone https://github.com/usestrix/strix.git
git clone https://github.com/0x4m4/hexstrike-ai.git
git clone https://github.com/vxcontrol/pentagi.git
git clone https://github.com/ainfosec/FISSURE.git
```

For each of the 6 network pentest repos, produce an `ARCHITECTURE_EXTRACT.md` answering:
- Primary language, entry point, LLM integration method.
- Agent roles (by class/module name) and orchestration pattern.
- Tool registry: every external tool, how invoked, how registered, how results parsed.
- Recon pipeline: stages, data structures, completion criteria.
- HITL/authorization gate: where it pauses, what data it presents, how denial changes flow.
- What is directly portable to TypeScript + Claude `tool_use`.

For FISSURE, produce an `ARCHITECTURE_EXTRACT.md` answering:
- SDR hardware abstraction: how it controls HackRF, what interface, what parameters.
- Spectrum scanning: what tool (hackrf_sweep, soapy_power, GNU Radio), what data format, how it detects signals.
- Signal analysis pipeline: detection → demodulation → decoding → classification.
- Attack/transmission: replay, jam, craft, fuzz — what tools, what parameters, what safety checks.
- TAK integration: what data sent, what format, what bridge code.
- Protocol library: what protocols known, what metadata per protocol.

**Why:** These extractions feed the synthesis in Step 1.7 and inform every design decision in Phases 2-5.
**Verify:** 7 `ARCHITECTURE_EXTRACT.md` files exist, each with concrete code references (file paths, class names, function signatures) rather than vague descriptions. If a repo turns out to be poorly documented or non-extractable, note that explicitly.

**### Step 1.7: Synthesize Best-of-Breed Patterns**

With all 7 architecture extracts complete, produce a `SYNTHESIS.md` that selects the best pattern for each subsystem:

- **Agent Orchestrator**: which repo's pattern, why, and how it maps to TypeScript + Claude SDK.
- **Tool Registry (Network)**: which repo's pattern for wrapping Kali tools as Claude tool_use functions.
- **Tool Registry (RF/SDR)**: which repo's pattern (likely FISSURE) for wrapping SDR tools.
- **Recon Pipeline (Network)**: which repo's multi-stage recon pattern.
- **Recon Pipeline (RF)**: which repo's spectrum scan → signal analysis pattern.
- **HITL Authorization Gate**: which repo's human-in-the-loop pattern, adapted for 3-tier system.
- **Report/Findings Generation**: which repo's pattern for structured output.
- **Knowledge Persistence**: which repo's pattern for cross-engagement memory (if any are viable).

For each selection: identify the source files, the key interfaces/classes, and a concrete mapping to TypeScript equivalents.

**Why:** This synthesis is the bridge between research and implementation. Without it, the build phase is designing from scratch rather than adapting proven patterns.
**Verify:** `SYNTHESIS.md` exists with concrete selections. Each selection cites specific source files and provides a TypeScript interface sketch. If no repo provides a usable pattern for a subsystem, that subsystem is flagged for original design.

---

**## Phase 2: Core Engine — Types & Orchestrator**
**Purpose: Build the foundational TypeScript interfaces and the workflow orchestrator that all tools and workflows depend on. No UI, no tools — just the engine skeleton.**

**### Step 2.1: Define Core TypeScript Interfaces**

Using findings from Step 1.7 (synthesis), create `src/lib/cybereffects/types.ts` containing:

**TargetInfo** — unified representation of a network target OR RF target:
```typescript
interface TargetInfo {
  id: string;                          // Unique identifier
  domain: 'network' | 'rf';           // Which domain
  // Network fields (optional — present when domain === 'network')
  mac?: string;
  ip?: string;
  ssid?: string;
  hostname?: string;
  manufacturer?: string;
  openPorts?: Array;
  os?: string;
  // RF fields (optional — present when domain === 'rf')
  frequency?: number;                  // Hz
  bandwidth?: number;                  // Hz
  powerLevel?: number;                 // dBm
  modulationType?: string;
  protocol?: string;
  // Common
  firstSeen: Date;
  lastSeen: Date;
  location?: { lat: number; lng: number; alt?: number };
  metadata: Record;
}
```

**ToolDefinition** — Claude tool_use compatible:
```typescript
interface ToolDefinition {
  name: string;                        // e.g., 'nmap_scan'
  description: string;                 // Human-readable description for Claude
  input_schema: Record; // JSON Schema for Claude tool_use
  authorizationTier: 0 | 1 | 2;       // Which tier this tool requires
  domain: 'network' | 'rf' | 'common';
  timeout: number;                     // Max execution time in ms
  execute: (params: Record) => Promise;
}
```

**ToolResult:**
```typescript
interface ToolResult {
  success: boolean;
  toolName: string;
  executionTime: number;               // ms
  rawOutput: string;                   // Stdout/stderr from tool
  structuredData: Record; // Parsed, structured results
  errors?: string[];
}
```

**AuthorizationRequest:**
```typescript
interface AuthorizationRequest {
  id: string;
  workflowId: string;
  tier: 1 | 2;                         // Tier 0 never generates a request
  proposedAction: string;              // Human-readable description
  toolName: string;
  toolParams: Record;
  target: TargetInfo;
  roeJustification?: string;           // Required for Tier 2
  riskAssessment: string;
  timestamp: Date;
}
```

**AuthorizationResponse:**
```typescript
interface AuthorizationResponse {
  requestId: string;
  approved: boolean;
  operatorId?: string;
  justification?: string;              // Why approved/denied
  timestamp: Date;
}
```

**WorkflowEvent** — for real-time streaming:
```typescript
interface WorkflowEvent {
  workflowId: string;
  timestamp: Date;
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'authorization_required' |
        'authorization_response' | 'finding' | 'error' | 'complete';
  data: unknown;                       // Shape depends on type
}
```

**CyberEffect** — a workflow module:
```typescript
interface CyberEffect {
  id: string;
  name: string;
  description: string;
  domain: 'network' | 'rf' | 'combined';
  applicableTo: (target: TargetInfo) => boolean;  // Can this effect run on this target?
  requiredTools: string[];             // Tool names this workflow needs
  maxAuthorizationTier: 0 | 1 | 2;    // Highest tier any step might require
  execute: (
    target: TargetInfo,
    orchestrator: WorkflowOrchestrator,
    onEvent: (event: WorkflowEvent) => void
  ) => Promise;
}
```

**FindingReport:**
```typescript
interface FindingReport {
  id: string;
  workflowId: string;
  target: TargetInfo;
  findings: Array<{
    id: string;
    type: 'vulnerability' | 'information' | 'rf_signal' | 'rf_protocol' | 'warning';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    evidence: string;                  // Raw tool output supporting this finding
    confirmed: boolean;                // Verified vs. suspected
    cwe?: string;                      // CWE ID if applicable
    recommendations: string[];
  }>;
  timestamp: Date;
  duration: number;                    // Total workflow time in ms
  toolsUsed: string[];
  authorizationEvents: AuthorizationRequest[];
}
```

**RulesOfEngagement:**
```typescript
interface RulesOfEngagement {
  id: string;
  name: string;
  allowedTiers: Array<0 | 1 | 2>;
  allowedDomains: Array;
  targetRestrictions: {
    allowedNetworks: string[];         // CIDR ranges
    deniedNetworks: string[];          // CIDR ranges (takes precedence)
    allowedFrequencyRanges: Array;  // Hz
    deniedFrequencyRanges: Array;
  };
  maxTransmitPower?: number;           // dBm
  timeRestrictions?: {
    allowedHours: { start: string; end: string };  // HH:MM
  };
  notes: string;
}
```

**Why:** Every tool, workflow, orchestrator, and UI component depends on these types. They must be defined first and correctly, or everything built on top is built on sand.
**Verify:** `src/lib/cybereffects/types.ts` compiles with zero errors. Import it from a test file and confirm all types are accessible. Cross-reference every type against the requirements — each requirement should be expressible using these types.

**### Step 2.2: Build the Tool Registry**

Create `src/lib/cybereffects/tool-registry.ts`:

- Implement a `ToolRegistry` class that:
  - Stores `ToolDefinition` objects in a `Map<string, ToolDefinition>`.
  - `register(tool: ToolDefinition): void` — adds a tool, throws if name already registered.
  - `get(name: string): ToolDefinition | undefined` — retrieves a tool by name.
  - `getAll(): ToolDefinition[]` — returns all registered tools.
  - `getByDomain(domain: 'network' | 'rf' | 'common'): ToolDefinition[]` — filters by domain.
  - `getClaudeToolDefinitions(): Array<{name, description, input_schema}>` — returns all tools formatted for Claude's `tools` parameter in the API request.
  - Validates tool definitions on registration (name is non-empty, input_schema is valid JSON Schema, execute is a function, timeout is positive).

**Why:** The orchestrator needs a registry to look up tools when Claude requests them via tool_use. Claude needs the tool definitions formatted for its API. The registry is the bridge.
**Verify:** Create a test that registers a dummy tool, retrieves it by name, retrieves it by domain, and gets the Claude-formatted definition. Confirm the Claude format matches the Anthropic tool_use schema (object with `name: string`, `description: string`, `input_schema: object`).

**### Step 2.3: Build the Authorization Gate**

Create `src/lib/cybereffects/authorization.ts`:

- Implement an `AuthorizationGate` class that:
  - Accepts a `RulesOfEngagement` configuration.
  - `async authorize(toolDef: ToolDefinition, params: Record<string, unknown>, target: TargetInfo): Promise<AuthorizationResponse>` — the core method.
  - For Tier 0 tools: returns `{ approved: true }` immediately. No UI interaction.
  - For Tier 1 tools: emits an `AuthorizationRequest` event and waits for operator response. Timeout after configurable duration (default: 5 minutes). Timeout = denied.
  - For Tier 2 tools: emits an `AuthorizationRequest` event with mandatory ROE justification field. Waits for operator response. Timeout after configurable duration (default: 10 minutes). Timeout = denied. Logs the request and response regardless of outcome.
  - Validates all actions against the ROE before even presenting to the operator:
    - If the target IP is in `deniedNetworks`, deny immediately (no operator prompt).
    - If the target frequency is in `deniedFrequencyRanges`, deny immediately.
    - If the current time is outside `allowedHours`, deny immediately.
    - If transmit power exceeds `maxTransmitPower`, deny immediately.
  - Maintains an audit log of all authorization events (requests, responses, auto-denials).
  - Uses an EventEmitter pattern (or Svelte writable store) to communicate with the UI.

**Why:** This is the safety-critical component. Every active and offensive action must pass through this gate. ROE violations must be caught before the operator is even asked.
**Verify:** Write tests for:
  1. Tier 0 tool → approved immediately, no event emitted.
  2. Tier 1 tool → event emitted, simulate approval → returns approved.
  3. Tier 1 tool → event emitted, simulate denial → returns denied.
  4. Tier 1 tool → event emitted, no response → times out → returns denied.
  5. Tier 2 tool → same as Tier 1 but with ROE justification required.
  6. ROE violation (denied network) → denied immediately, no event emitted, logged.
  7. ROE violation (denied frequency) → denied immediately.
  8. ROE violation (outside hours) → denied immediately.

**### Step 2.4: Build the Workflow Orchestrator**

Create `src/lib/cybereffects/orchestrator.ts`:

- Implement a `WorkflowOrchestrator` class that:
  - Accepts a `ToolRegistry`, `AuthorizationGate`, and Claude API client (`@anthropic-ai/sdk`).
  - `async executeWorkflow(effect: CyberEffect, target: TargetInfo, onEvent: (event: WorkflowEvent) => void): Promise<FindingReport>` — the core method.
  - Internally runs a Claude conversation loop:
    1. Constructs a system prompt describing the workflow, available tools, target info, and ROE constraints.
    2. Sends the initial message to Claude with the target info and the workflow's objective.
    3. Receives Claude's response. If it contains `tool_use` blocks:
       a. For each tool call: look up the tool in the registry.
       b. Check authorization via the gate.
       c. If authorized: execute the tool, emit `tool_call` and `tool_result` events.
       d. If denied: emit the denial, send the denial back to Claude so it can adapt.
       e. Collect all tool results and send them back to Claude as `tool_result` content blocks.
    4. If Claude's response contains text (reasoning): emit a `reasoning` event.
    5. Repeat until Claude indicates the workflow is complete (returns a structured finding).
    6. Parse the final response into a `FindingReport`.
  - Handles context window management:
    - Tracks token count of the conversation.
    - If approaching the limit: summarize earlier tool results (keep only structured findings, drop raw output).
    - Maximum conversation rounds: configurable (default: 20). If exceeded, force completion.
  - Handles errors:
    - Tool execution failure: send the error to Claude, let it decide whether to retry or adapt.
    - Claude API error: retry with exponential backoff (max 3 retries).
    - Tool timeout: kill the subprocess, report timeout to Claude.
    - Unrecoverable error: emit error event, return partial report.
  - Tracks state:
    - `Map<string, WorkflowState>` for concurrent workflows.
    - Each workflow state: target, effect, conversation history, tool results, status, start time.
  - Supports cancellation: operator can cancel a running workflow.

**Why:** This is the brain of the system — it drives the Claude conversation loop that reasons through workflows. Everything else feeds into or out of this orchestrator.
**Verify:** Write an integration test that:
  1. Registers a dummy tool that returns mock data.
  2. Creates a dummy CyberEffect that asks Claude to use the tool.
  3. Executes the workflow with a mock target.
  4. Confirms events are emitted in the correct order: reasoning → tool_call → tool_result → ... → complete.
  5. Confirms the final FindingReport contains the expected structure.
  6. Test error handling: register a tool that throws, confirm Claude receives the error and adapts.

**### Step 2.5: Build the ROE Configuration Module**

Create `src/lib/cybereffects/roe.ts`:

- Implement ROE configuration loading and validation:
  - Load ROE from a JSON/YAML configuration file at `~/.argos/roe.json` (or similar).
  - Provide a default ROE that permits all Tier 0 actions, requires confirmation for Tier 1, and requires authorization for Tier 2, with no network/frequency restrictions.
  - Validate ROE on load: CIDR ranges are valid, frequency ranges are valid (min < max, positive Hz), time format is valid.
  - Provide runtime ROE updates (operator changes ROE via UI without restart).
  - Export the current ROE as a human-readable summary for inclusion in Claude's system prompt (so Claude knows what it can and cannot do).

**Why:** The authorization gate depends on ROE. Claude needs to know the ROE to reason about what actions are available. The operator needs to configure ROE for their specific mission.
**Verify:** Load a test ROE configuration. Confirm validation catches invalid CIDR, invalid frequency ranges, invalid time formats. Confirm the human-readable summary accurately reflects the configuration.

---

**## Phase 3: Network Tool Wrappers**
**Purpose: Wrap each Kali Linux network tool as a ToolDefinition that the orchestrator can invoke via Claude tool_use. Each wrapper converts subprocess output into structured data.**

**### Step 3.1: Build the Base Tool Wrapper**

Create `src/lib/cybereffects/tools/base-tool.ts`:

- Implement a `BaseToolWrapper` class or factory function that:
  - Spawns a subprocess using Node.js `child_process.spawn` (not `exec` — spawn handles large outputs).
  - Captures stdout and stderr.
  - Enforces a timeout (kills the process if exceeded).
  - Returns a `ToolResult` with raw output and a parsed `structuredData` field.
  - Handles common error cases: command not found, permission denied, timeout, segfault.
  - Sanitizes inputs: reject any input containing shell metacharacters (`;`, `|`, `&`, `` ` ``, `$()`, etc.) to prevent command injection.

**Why:** Every tool wrapper shares the same subprocess execution pattern. Extracting it prevents duplication and ensures consistent error handling and input sanitization across all tools.
**Verify:** Test with a simple command (`echo "test"`). Confirm stdout capture, timeout enforcement (test with `sleep 999`), and input sanitization (test with `; rm -rf /` in a parameter — must be rejected).

**### Step 3.2: Build the Nmap Tool Wrapper**

Create `src/lib/cybereffects/tools/network/nmap.ts`:

Register the following tool definitions with the ToolRegistry:

**nmap_port_scan:**
- Authorization Tier: 0 (SYN scan is passive from target's perspective).
- Input schema: `{ target: string (IP or CIDR), ports: string (optional, e.g., "1-1000"), timing: string (optional, T0-T5, default T3) }`.
- Executes: `nmap -sS -oX - <target> -p <ports> -T<timing>`.
- Parses: XML output (`-oX -` outputs to stdout as XML). Extract hosts, ports, services, states.
- Structured output: `{ hosts: Array<{ ip, mac, hostname, ports: Array<{ port, state, service, version }> }> }`.

**nmap_service_detection:**
- Authorization Tier: 1 (active probing of services).
- Input schema: `{ target: string, ports: string }`.
- Executes: `nmap -sV -oX - <target> -p <ports>`.
- Parses: same XML format, but with version info populated.

**nmap_os_detection:**
- Authorization Tier: 1 (active OS fingerprinting).
- Input schema: `{ target: string }`.
- Executes: `nmap -O -oX - <target>`.
- Parses: OS match entries from XML.

**nmap_vuln_scan:**
- Authorization Tier: 1 (runs NSE scripts that probe services).
- Input schema: `{ target: string, ports: string }`.
- Executes: `nmap --script=vuln -oX - <target> -p <ports>`.
- Parses: script output entries from XML.

**Why:** Nmap is the primary reconnaissance tool. These four modes cover the progression from passive discovery to active vulnerability identification.
**Verify:** For each tool: invoke against a known test target (e.g., `scanme.nmap.org` or a local VM). Confirm the raw output is captured, the XML is parsed correctly into the structured format, and the ToolResult matches the expected shape. Test with an invalid target — confirm error handling works.

**### Step 3.3: Build the Kismet Data Adapter**

Create `src/lib/cybereffects/tools/network/kismet-adapter.ts`:

This is NOT a subprocess wrapper — it calls Kismet's REST API directly.

**kismet_get_devices:**
- Authorization Tier: 0 (read-only query of already-collected data).
- Input schema: `{ filter?: string (optional Kismet filter expression) }`.
- Executes: HTTP GET to Kismet REST API endpoint for device list (determined in Step 1.2).
- Structured output: Array of `TargetInfo` objects in the `network` domain.

**kismet_get_device_detail:**
- Authorization Tier: 0.
- Input schema: `{ deviceKey: string }`.
- Executes: HTTP GET to Kismet REST API for specific device detail.
- Structured output: Full `TargetInfo` with all available fields populated.

Use the Kismet REST API endpoints and authentication method discovered in Step 1.2.

**Why:** The Kismet adapter bridges existing Kismet data into the Cyber Effects workflow system, allowing Claude to query Kismet for additional target information during a workflow.
**Verify:** With Kismet running, call `kismet_get_devices` and confirm it returns a non-empty array of valid `TargetInfo` objects. Call `kismet_get_device_detail` with a known device key and confirm the full detail is returned.

**### Step 3.4: Build the Nikto Tool Wrapper**

Create `src/lib/cybereffects/tools/network/nikto.ts`:

**nikto_web_scan:**
- Authorization Tier: 1 (active web vulnerability scanning).
- Input schema: `{ target: string (URL or IP), port: number (default 80), ssl: boolean (default false) }`.
- Executes: `nikto -h <target> -p <port> -Format json -output -` (JSON output to stdout).
- Parses: JSON output into structured findings.
- Structured output: `{ vulnerabilities: Array<{ id, method, url, description, osvdbId }> }`.
- Timeout: 300 seconds (nikto can be slow).

**Why:** Nikto is the standard web vulnerability scanner. It identifies server misconfigurations, dangerous files, and known vulnerabilities.
**Verify:** Run against a known test target with known vulnerabilities. Confirm JSON parsing works and the structured output matches expected findings.

**### Step 3.5: Build the SQLMap Tool Wrapper**

Create `src/lib/cybereffects/tools/network/sqlmap.ts`:

**sqlmap_test:**
- Authorization Tier: 1 (active SQL injection testing).
- Input schema: `{ url: string, method: string (GET/POST), param: string (parameter to test), data?: string (POST body) }`.
- Executes: `sqlmap -u <url> --method=<method> -p <param> --batch --output-dir=/tmp/sqlmap-<id> --flush-session`.
- Parses: Read sqlmap's output log file for results.
- Structured output: `{ vulnerable: boolean, injectionType?: string, dbms?: string, details?: string }`.
- Timeout: 600 seconds.
- NOTE: `--batch` flag is critical — it auto-answers prompts, preventing the subprocess from hanging.

**sqlmap_dump (Tier 2):**
- Authorization Tier: 2 (data exfiltration).
- Input schema: `{ url: string, method: string, param: string, table: string }`.
- Executes: `sqlmap -u <url> -p <param> --dump -T <table> --batch`.
- Requires explicit ROE authorization because it extracts data from the target.

**Why:** SQL injection testing is a core vulnerability assessment capability. The two-tier approach (test at Tier 1, dump at Tier 2) enforces ROE.
**Verify:** Test against a deliberately vulnerable application (e.g., DVWA or SQLi-labs if available). Confirm `sqlmap_test` correctly identifies vulnerabilities and `sqlmap_dump` requires Tier 2 authorization.

**### Step 3.6: Build the Aircrack-ng Tool Wrapper**

Create `src/lib/cybereffects/tools/network/aircrack.ts`:

**aircrack_scan:**
- Authorization Tier: 0 (passive WiFi monitoring).
- Input schema: `{ interface: string (wireless interface name), duration: number (seconds) }`.
- Executes: `airodump-ng <interface> --write /tmp/airodump-<id> --output-format csv -w 1` for `<duration>` seconds, then kills.
- Parses: CSV output file.
- Structured output: `{ accessPoints: Array<{ bssid, channel, encryption, essid, power }>, clients: Array<{ station, bssid, power, probes }> }`.

**aircrack_deauth (Tier 2):**
- Authorization Tier: 2 (active denial of service — deauthentication attack).
- Input schema: `{ interface: string, bssid: string, client?: string, count: number }`.
- Executes: `aireplay-ng --deauth <count> -a <bssid> [-c <client>] <interface>`.
- This is an active attack and requires Tier 2 authorization.

**Why:** WiFi security assessment requires both passive monitoring and active testing. Deauth is explicitly Tier 2 as it disrupts service.
**Verify:** Test `aircrack_scan` with a monitor-mode interface (confirm interface exists first). Test that `aircrack_deauth` triggers Tier 2 authorization.

---

**## Phase 4: RF Tool Wrappers**
**Purpose: Wrap SDR tools as ToolDefinitions for Claude's RF/EW workflows. These tools control the HackRF One hardware.**

**### Step 4.1: Build the HackRF Control Wrapper**

Create `src/lib/cybereffects/tools/rf/hackrf-control.ts`:

**hackrf_sweep:**
- Authorization Tier: 0 (receive-only).
- Input schema: `{ freqStart: number (Hz), freqEnd: number (Hz), binWidth: number (Hz, default 100000) }`.
- Executes: `hackrf_sweep -f <freqStart/1e6>:<freqEnd/1e6> -w <binWidth> -1` (single sweep, -1 flag).
- Parses: CSV-like output. Each line: `timestamp, freq_start, freq_end, bin_width, num_samples, power1, power2, ...`.
- Structured output: `{ sweepData: Array<{ freqStart: number, freqEnd: number, powers: number[] }>, noiseFloor: number (calculated), hotFrequencies: Array<{ frequency: number, power: number, bandwidth: number }> }`.
- Post-processing: calculate noise floor as median power across all bins. Flag any frequency with power > noiseFloor + 10dB as a "hot frequency."

**Why:** Spectrum sweeping is the RF equivalent of a port scan — it discovers what's active in the electromagnetic environment.
**Verify:** Run a sweep of 400-500 MHz. Confirm output is parsed correctly. If any FM radio stations are in range, confirm they appear as hot frequencies.

**### Step 4.2: Build the Signal Recorder**

Create `src/lib/cybereffects/tools/rf/signal-recorder.ts`:

**hackrf_record:**
- Authorization Tier: 1 (targeted capture at specific frequency — operator should know what's being recorded).
- Input schema: `{ frequency: number (Hz), sampleRate: number (Hz, default 2000000), gain: number (dB, default 40), duration: number (seconds) }`.
- Executes: `hackrf_transfer -r /tmp/capture-<id>.raw -f <frequency> -s <sampleRate> -a 1 -l <gain> -g <gain>` for `<duration>` seconds, then SIGTERM.
- Output file: raw IQ samples in 8-bit signed format.
- Structured output: `{ filePath: string, frequency: number, sampleRate: number, duration: number, fileSize: number, format: 'int8_iq' }`.
- Note: Raw IQ files can be very large (2 Msps × 2 bytes × duration seconds). For a 10-second capture at 2 Msps = ~40 MB. Ensure `/tmp` has space.

**Why:** Signal recording captures the raw IQ data needed for offline analysis, demodulation, and protocol identification.
**Verify:** Record 2 seconds at a known active frequency (e.g., local FM station at ~100 MHz). Confirm the file is created with expected size (~8 MB for 2 seconds at 2 Msps). Confirm the structured output is correct.

**### Step 4.3: Build the Signal Analyzer**

Create `src/lib/cybereffects/tools/rf/signal-analyzer.ts`:

**signal_analyze:**
- Authorization Tier: 0 (analysis of already-captured data, no transmission).
- Input schema: `{ filePath: string, sampleRate: number, centerFrequency: number }`.
- Executes a Python analysis script (created in Step 4.3b) that:
  1. Loads raw IQ data.
  2. Computes FFT to identify signal bandwidth and center frequency offset.
  3. Estimates modulation type (AM, FM, OOK, FSK, PSK) using spectral analysis heuristics.
  4. If OOK/ASK detected: extract bit timing and payload.
  5. Compares signal characteristics against a protocol database (created in Step 4.4).
- Structured output: `{ bandwidth: number, modulationType: string, bitRate?: number, protocol?: string, confidence: number, rawBits?: string, spectrumImage?: string (base64 PNG of FFT plot) }`.

**Step 4.3b: Create the Python analysis script** at `src/lib/cybereffects/tools/rf/analyze_signal.py`:
- Uses numpy for FFT and signal processing.
- Uses matplotlib for spectrum visualization (saves to PNG).
- Accepts command-line arguments: `--file`, `--sample-rate`, `--center-freq`, `--output-json`.
- Outputs JSON to the specified path.
- This is a Python script called as a subprocess because GNU Radio and numpy are Python ecosystems. The TypeScript wrapper spawns it and reads the JSON output.

**Why:** Signal analysis converts raw IQ captures into actionable intelligence — what kind of signal, what protocol, what's it doing.
**Verify:** Analyze the FM radio capture from Step 4.2. Confirm it identifies FM modulation with reasonable confidence. Test with a known OOK signal (e.g., from rtl_433 test data) to confirm OOK detection works.

**### Step 4.4: Build the Protocol Database**

Create `src/lib/cybereffects/tools/rf/protocol-db.ts` and `src/lib/cybereffects/tools/rf/protocols.json`:

The protocol database stores known RF protocol signatures:

```typescript
interface ProtocolSignature {
  name: string;                        // e.g., 'Garage Door (300MHz OOK)'
  frequencyRanges: Array;  // Hz
  modulationTypes: string[];           // e.g., ['OOK', 'ASK']
  commonBitRates?: number[];           // bps
  packetLength?: { min: number; max: number };  // bits
  preamble?: string;                   // bit pattern
  description: string;
  threatLevel: 'info' | 'low' | 'medium' | 'high';
  references: string[];                // URLs or document references
}
```

Populate with common protocols (from FISSURE's protocol library if extractable, otherwise from public references):
- WiFi (2.4 GHz, 5 GHz)
- Bluetooth (2.4 GHz)
- Zigbee (2.4 GHz, 868/915 MHz)
- Z-Wave (908.42 MHz US)
- LoRa (various ISM bands)
- TPMS (315/433 MHz)
- Garage door openers (300/315/390 MHz, OOK)
- Weather stations (433 MHz, OOK/FSK)
- Key fobs / car remotes (315/433 MHz)
- ADS-B (1090 MHz)
- FRS/GMRS (462/467 MHz)
- MURS (151/154 MHz)
- ISM band devices (902-928 MHz)

**Why:** Claude needs protocol signatures to reason about detected signals. Without this database, signal identification is manual.
**Verify:** Load the protocol database. Query with frequency=433MHz, modulation=OOK — confirm it returns relevant matches (TPMS, garage doors, weather stations). Query with frequency=2.4GHz, modulation=OFDM — confirm it returns WiFi.

**### Step 4.5: Build the Replay/Transmit Wrapper**

Create `src/lib/cybereffects/tools/rf/replay-transmit.ts`:

**hackrf_replay:**
- Authorization Tier: 2 (RF transmission — ALWAYS requires explicit operator authorization).
- Input schema: `{ filePath: string, frequency: number (Hz), sampleRate: number (Hz), gain: number (dB, default 40), repeat: number (default 1) }`.
- Executes: `hackrf_transfer -t <filePath> -f <frequency> -s <sampleRate> -a 1 -x <gain>` repeated `<repeat>` times.
- Pre-execution safety checks (enforced by the wrapper, not just the authorization gate):
  1. Verify the file exists and is non-empty.
  2. Verify the frequency is within the ROE's allowed frequency ranges.
  3. Verify the gain does not exceed the ROE's max transmit power.
  4. Log the transmission parameters (frequency, power, duration, timestamp) to an immutable audit log.
- Structured output: `{ transmitted: boolean, frequency: number, duration: number, power: number }`.

**hackrf_jam (Tier 2):**
- Authorization Tier: 2.
- Input schema: `{ frequency: number (Hz), bandwidth: number (Hz), duration: number (seconds), gain: number (dB) }`.
- Executes: generates noise or continuous wave at the target frequency for the specified duration.
- Same safety checks as replay.
- NOTE: Jamming is illegal in most jurisdictions outside of authorized military/government operations. The tool must log a warning about this.

**Why:** Replay and jamming are offensive RF capabilities that require the highest authorization tier and multiple safety checks.
**Verify:** Test that invoking `hackrf_replay` triggers Tier 2 authorization. Test that the safety checks reject: nonexistent file, frequency outside ROE, gain exceeding ROE max. Confirm audit logging works. DO NOT test actual transmission without proper authorization and legal authority.

---

**## Phase 5: Workflow Modules (CyberEffects)**
**Purpose: Build the high-level workflow modules that combine tools into multi-step operations, each driven by Claude's reasoning.**

**### Step 5.1: Build the Network Recon Workflow**

Create `src/lib/cybereffects/workflows/network-recon.ts`:

Implements the `CyberEffect` interface.

**Workflow logic (expressed as Claude's system prompt for this workflow):**
1. Claude receives a network target (IP/MAC from Kismet).
2. Claude calls `nmap_port_scan` to discover open ports (Tier 0 — auto).
3. Claude examines results, then calls `nmap_service_detection` on interesting ports (Tier 1 — confirm).
4. Claude calls `nmap_os_detection` if not already known (Tier 1 — confirm).
5. If web ports (80, 443, 8080, etc.) are found, Claude calls `nikto_web_scan` (Tier 1 — confirm).
6. Claude calls `kismet_get_device_detail` for additional context.
7. Claude synthesizes all results into a `FindingReport` with a structured target profile.

**Claude system prompt for this workflow:**
```
You are a penetration testing assistant conducting network reconnaissance on a target.
Your goal is to build a comprehensive target profile by discovering open ports, services,
operating system, and potential vulnerabilities.

Available tools: [dynamically populated from registry]
Rules of Engagement: [dynamically populated from ROE config]
Target: [dynamically populated]

Proceed methodically. Start with a port scan, then enumerate services on open ports,
then identify the operating system. If web services are found, scan for web vulnerabilities.
Always explain your reasoning before calling a tool.

When you have gathered sufficient information, produce your findings in this JSON format:
{
  "findings": [...],
  "targetProfile": { ... },
  "recommendedNextSteps": [...]
}
```

**Why:** This is the most common workflow — the first thing an operator will use when investigating a network target.
**Verify:** Execute against a test target. Confirm Claude progresses through the expected tool sequence. Confirm Tier 1 tools trigger authorization requests. Confirm the final FindingReport contains a valid target profile. Confirm events stream correctly to the callback.

**### Step 5.2: Build the Vulnerability Analysis Workflow**

Create `src/lib/cybereffects/workflows/vuln-analysis.ts`:

Takes a target that has already been through recon (has open ports and services identified).

**Workflow logic:**
1. Claude receives the target profile from a previous recon.
2. Claude identifies high-value services (databases, admin panels, APIs).
3. Claude calls `nmap_vuln_scan` on relevant ports (Tier 1).
4. Claude calls `sqlmap_test` on any web endpoints with parameters (Tier 1).
5. Claude synthesizes findings, classifying each by severity (critical/high/medium/low/info).
6. Claude produces a FindingReport with confirmed and suspected vulnerabilities.

**Why:** Vulnerability analysis follows recon. It's a separate workflow because the operator may want to do recon without vuln scanning.
**Verify:** Execute with a pre-populated target profile. Confirm Claude selects appropriate tools for the discovered services. Confirm findings are classified by severity.

**### Step 5.3: Build the Exploit Workflow**

Create `src/lib/cybereffects/workflows/exploit.ts`:

Takes a confirmed vulnerability from the vuln analysis.

**Workflow logic:**
1. Claude receives a specific vulnerability finding.
2. Claude reasons about exploitation approach (ENTIRELY Tier 2).
3. Claude proposes the exploitation step — authorization gate pauses for operator approval.
4. If approved: Claude executes the exploitation tool.
5. Claude documents the result — success/failure, evidence captured.
6. Produces a FindingReport with exploitation results.

**CRITICAL CONSTRAINT:** This workflow MUST present the full exploitation plan to the operator BEFORE executing any tool. The operator must see exactly what will happen and approve it with ROE justification.

**Why:** Exploitation is the highest-risk operation. Full Tier 2 authorization with ROE justification is mandatory.
**Verify:** Confirm the workflow pauses at authorization. Confirm denial aborts the workflow cleanly. Confirm the operator sees the full plan before any action is taken.

**### Step 5.4: Build the RF Spectrum Scan Workflow**

Create `src/lib/cybereffects/workflows/rf-spectrum-scan.ts`:

**Workflow logic:**
1. Claude receives a frequency range to scan (or uses defaults: common ISM bands).
2. Claude calls `hackrf_sweep` over the range (Tier 0 — auto).
3. Claude examines the results — identifies hot frequencies above noise floor.
4. For each hot frequency, Claude queries the protocol database for matches.
5. Claude produces a FindingReport listing detected signals with protocol guesses and threat assessments.
6. Claude recommends which signals warrant further investigation.

**Why:** Spectrum scanning is the RF equivalent of network recon — it discovers what's active in the electromagnetic environment.
**Verify:** Execute a sweep of 400-500 MHz. Confirm hot frequencies are detected. Confirm protocol database matches are attempted. Confirm the FindingReport contains detected signals with metadata.

**### Step 5.5: Build the RF Signal Analysis Workflow**

Create `src/lib/cybereffects/workflows/rf-signal-analysis.ts`:

**Workflow logic:**
1. Claude receives a specific frequency to investigate (from spectrum scan results).
2. Claude calls `hackrf_record` to capture the signal (Tier 1 — confirm).
3. Claude calls `signal_analyze` on the captured data (Tier 0 — analysis only).
4. Claude examines analysis results — modulation type, bit rate, protocol match.
5. If a protocol is identified, Claude explains what the signal is, who might be using it, and whether it's a threat.
6. Claude produces a FindingReport with RF intelligence.

**Why:** Signal analysis converts a detected frequency into actionable intelligence about what device is transmitting and what protocol it's using.
**Verify:** Execute against a known active frequency. Confirm the capture → analyze → identify pipeline works end-to-end. Confirm the FindingReport contains meaningful RF intel.

**### Step 5.6: Build the RF Attack Workflow**

Create `src/lib/cybereffects/workflows/rf-attack.ts`:

**Workflow logic:**
1. Claude receives an analyzed signal (from signal analysis results).
2. Claude reasons about possible RF actions: replay, jam, or protocol-specific attack.
3. Claude proposes the action — ENTIRELY Tier 2, authorization gate pauses.
4. If approved: Claude executes the action (replay, jam, or craft).
5. Claude monitors results (if possible) and documents outcome.
6. Produces a FindingReport with attack results.

**CRITICAL CONSTRAINT:** Same as exploit — full plan presented to operator, explicit Tier 2 approval with ROE justification required. No autonomous transmission.

**Why:** RF attacks are the highest-risk RF operations. Same safety constraints as network exploitation.
**Verify:** Confirm Tier 2 authorization is required. Confirm the operator sees the full transmission plan. Confirm denial aborts cleanly.

**### Step 5.7: Build the Combined Recon Workflow**

Create `src/lib/cybereffects/workflows/combined-recon.ts`:

**Workflow logic:**
1. Runs `NetworkReconWorkflow` and `RFSpectrumScanWorkflow` concurrently.
2. Correlates results: if a WiFi AP is found in both Kismet data and RF scan, merge the information.
3. Produces a unified FindingReport covering both domains.

**Why:** Real-world situational awareness requires understanding both network and RF environments simultaneously.
**Verify:** Execute and confirm both workflows run concurrently. Confirm correlation works when the same device appears in both domains (e.g., WiFi access point visible to both Kismet and HackRF).

---

**## Phase 6: SvelteKit UI Integration**
**Purpose: Connect the Cyber Effects Engine to the Argos user interface. NOTE: This phase depends heavily on the findings from Step 1.1 (Argos codebase inventory). The specific component structure, route patterns, and integration points will be determined by what already exists.**

**### Step 6.1: Create the Workflow API Routes**

Create SvelteKit API routes (exact paths depend on existing route structure discovered in Step 1.1):

**POST /api/workflow/trigger:**
- Accepts: `{ effectId: string, targetId: string, targetInfo: TargetInfo }`.
- Starts a workflow execution via the orchestrator.
- Returns: `{ workflowId: string, status: 'started' }`.

**GET /api/workflow/[id]/status:**
- Returns current workflow status: `{ status: 'running' | 'awaiting_authorization' | 'complete' | 'error', events: WorkflowEvent[] }`.
- Supports Server-Sent Events (SSE) for real-time streaming: `Accept: text/event-stream`.

**POST /api/workflow/[id]/authorize:**
- Accepts: `{ requestId: string, approved: boolean, justification?: string }`.
- Sends the authorization response to the waiting gate.
- Returns: `{ acknowledged: true }`.

**GET /api/workflow/[id]/results:**
- Returns the final FindingReport when the workflow is complete.

**Why:** API routes are the bridge between the SvelteKit frontend and the Node.js backend where the orchestrator runs.
**Verify:** Test each endpoint with curl or a test script. Confirm SSE streaming works (events arrive in real-time as the workflow progresses).

**### Step 6.2: Build the Workflow Progress Panel**

Create `src/lib/components/cybereffects/WorkflowPanel.svelte` (path may vary based on existing component structure):

- Connects to the SSE stream from `/api/workflow/[id]/status`.
- Displays events in a scrolling feed:
  - `reasoning` events: show Claude's text in a distinct style (e.g., AI reasoning indicator).
  - `tool_call` events: show which tool is being called and with what parameters.
  - `tool_result` events: show tool output (collapsible for long outputs).
  - `authorization_required` events: trigger the Authorization Dialog (Step 6.3).
  - `finding` events: highlight discovered findings.
  - `error` events: show errors with context.
  - `complete` events: show summary and link to findings panel.
- Supports cancellation: "Cancel Workflow" button that POSTs to a cancel endpoint.

**Why:** The operator must see what Claude is doing in real-time — both for situational awareness and to maintain trust in the automated system.
**Verify:** Trigger a network recon workflow. Confirm events appear in the panel in real-time. Confirm the panel updates without page refresh (SSE). Confirm long tool outputs are collapsible.

**### Step 6.3: Build the Authorization Dialog**

Create `src/lib/components/cybereffects/AuthorizationDialog.svelte`:

- Appears as a modal when an `authorization_required` event is received.
- Displays:
  - What action is proposed (human-readable description).
  - What tool will be used with what parameters.
  - What target this affects.
  - What tier this is (Tier 1 or Tier 2).
  - If Tier 2: a required text field for ROE justification.
  - Risk assessment from Claude.
- Buttons: "Approve" and "Deny" with visual distinction (Approve is prominent but not default — operator must actively choose).
- Auto-deny on timeout (countdown timer visible to operator).
- Deny requires no justification. Approve requires confirmation click (prevent accidental approval).

**Why:** This is the human-in-the-loop safety mechanism. It must be clear, unambiguous, and resistant to accidental approval.
**Verify:** Trigger a Tier 1 action — confirm dialog appears, confirm approval sends the response, confirm workflow continues. Trigger a Tier 2 action — confirm ROE justification field is required. Confirm denial stops the workflow. Confirm timeout triggers auto-deny.

**### Step 6.4: Build the Findings Panel**

Create `src/lib/components/cybereffects/FindingsPanel.svelte`:

- Displays all FindingReports from completed workflows.
- Groups findings by severity (critical → high → medium → low → info).
- Each finding shows: title, severity badge, description, evidence (collapsible), recommendations.
- Findings are filterable by: domain (network/RF), severity, target, confirmed/unconfirmed.
- Clicking a finding scrolls to or highlights the associated target in the Kismet panel or spectrum panel.

**Why:** Findings are the primary output of the Cyber Effects Engine. The operator needs to review them in a structured, prioritized format.
**Verify:** Complete a workflow, then view the findings panel. Confirm findings are displayed correctly, grouped by severity, and filterable. Confirm clicking a finding navigates to the relevant target.

**### Step 6.5: Build the Spectrum Panel**

Create `src/lib/components/cybereffects/SpectrumPanel.svelte`:

- Displays spectrum scan results as a frequency vs. power chart (waterfall or line chart).
- Hot frequencies are highlighted with markers.
- Each hot frequency marker has an "Investigate" button that triggers the RF Signal Analysis workflow.
- If a protocol match exists, show the protocol name next to the frequency.
- The panel can trigger a new spectrum scan (via the orchestrator).

**Why:** The spectrum panel is the RF equivalent of the Kismet panel — it shows what's active in the RF environment and provides the entry point for RF workflows.
**Verify:** Run a spectrum scan. Confirm the chart renders with correct frequency/power axes. Confirm hot frequencies are marked. Confirm the "Investigate" button triggers the analysis workflow.

**### Step 6.6: Add Context Menu to Kismet Panel**

Modify the existing Kismet panel component (identified in Step 1.2) to add:

- Right-click context menu on any target row/card.
- Menu items:
  - "Recon" → triggers NetworkReconWorkflow.
  - "Vulnerability Scan" → triggers VulnAnalysisWorkflow (grayed out if no recon has been done on this target).
  - "Exploit" → triggers ExploitWorkflow (grayed out if no vulnerabilities found).
  - "Combined Recon" → triggers CombinedReconWorkflow.
- Each menu item sends a POST to `/api/workflow/trigger` with the target info and effect ID.
- Opens the Workflow Progress Panel to show real-time execution.

**Why:** The context menu is the primary entry point for network-domain cyber effects. The operator interacts with Kismet targets and invokes effects directly.
**Verify:** Right-click a Kismet target. Confirm the context menu appears with the correct options. Confirm selecting "Recon" triggers the workflow and opens the progress panel. Confirm grayed-out options are not clickable when prerequisites aren't met.

**### Step 6.7: Push Findings to TAK**

Extend the existing TAK bridge (identified in Step 1.3) to accept Cyber Effects findings:

- When a FindingReport is generated, convert relevant findings into CoT markers:
  - Network targets: use the target's IP/location to place a marker with details.
  - RF emitters: use the detected frequency and estimated location (if available from direction-finding or signal strength triangulation — if not, use the sensor's location).
  - Vulnerability findings: use a distinct icon/type to differentiate from plain targets.
- Use the existing TAK connection method (CoT XML, REST API, or protobuf — determined in Step 1.3).
- Marker attributes should include: finding type, severity, description, timestamp.

**Why:** The TAK tactical map is where the operator builds situational awareness. Cyber effects findings must appear alongside other tactical data.
**Verify:** Complete a workflow that produces findings. Confirm markers appear in ATAK/WinTAK/TAK Server at the correct locations with correct attributes.

---

**## Phase 7: Integration Testing & Hardening**
**Purpose: Verify the complete system works end-to-end and harden for field use.**

**### Step 7.1: End-to-End Network Workflow Test**

Execute the full network workflow chain against a controlled test target (a local VM or authorized network device):

1. Target appears in Kismet panel.
2. Right-click → "Recon" → workflow starts.
3. Confirm progress streams in real-time.
4. Confirm Tier 1 authorizations are requested for active probes.
5. Confirm findings appear in the findings panel.
6. Confirm the target marker appears in TAK.
7. Right-click → "Vulnerability Scan" → second workflow starts.
8. Confirm it uses the recon data from the first workflow.
9. Confirm vulnerability findings appear with correct severity.

**Why:** End-to-end testing catches integration issues that unit tests miss.
**Verify:** All 9 steps above complete successfully. Screenshot or log evidence for each step.

**### Step 7.2: End-to-End RF Workflow Test**

Execute the full RF workflow chain:

1. Trigger a spectrum scan.
2. Confirm hot frequencies appear in the spectrum panel.
3. Click "Investigate" on a hot frequency.
4. Confirm the signal analysis workflow runs (capture → analyze → identify).
5. Confirm the Tier 1 authorization request for signal capture.
6. Confirm RF findings appear in the findings panel.
7. Confirm the emitter marker appears in TAK.

**Why:** Same as Step 7.1 but for the RF domain.
**Verify:** All 7 steps above complete successfully.

**### Step 7.3: Authorization Hardening Test**

Test every authorization scenario:

1. Tier 0 action: confirm it executes without any dialog.
2. Tier 1 action: confirm dialog appears, test approve and deny.
3. Tier 2 action: confirm dialog appears with ROE justification field, test approve (with justification) and deny.
4. ROE violation: configure ROE to deny a specific network range, attempt to scan it — confirm auto-denial with no operator prompt.
5. Timeout: trigger Tier 1 action, do not respond — confirm auto-denial after timeout.
6. Rapid succession: trigger 3 Tier 1 actions quickly — confirm each gets its own dialog and they don't interfere.

**Why:** The authorization system is safety-critical. Every path must be verified.
**Verify:** All 6 scenarios pass. Audit log contains correct entries for all authorization events.

**### Step 7.4: Error Recovery Testing**

Test error scenarios:

1. Claude API unreachable: confirm workflow reports error and retries.
2. Tool crashes (kill nmap mid-scan): confirm error is reported to Claude, workflow adapts or reports failure.
3. HackRF disconnected mid-capture: confirm error is handled gracefully.
4. Context window overflow: send a huge nmap result — confirm summarization kicks in.
5. Operator cancels mid-workflow: confirm clean shutdown, partial results preserved.

**Why:** Field deployment on a Raspberry Pi means unreliable conditions. The system must degrade gracefully.
**Verify:** Each error scenario produces a meaningful error message or graceful degradation, not a crash.

**### Step 7.5: Verify No Existing Functionality Broken**

Run the existing Argos test suite (if one exists). Manually verify:

1. Kismet panel still works as before — data refreshes, targets appear, existing interactions work.
2. TAK integration still works as before — existing markers still send correctly.
3. All existing routes still load.
4. The build still succeeds with zero new warnings.

**Why:** Requirement 11: "No existing Argos functionality breaks."
**Verify:** All existing functionality confirmed working. Build produces no new warnings.

---

**Completion Criteria:**
1. Operator can right-click a Kismet target, select a cyber effect, and watch Claude execute a workflow with real-time progress streaming.
2. Operator can trigger a spectrum scan, see hot frequencies, and investigate them via Claude-driven RF analysis.
3. All Tier 0 actions execute automatically. All Tier 1 actions require single confirmation. All Tier 2 actions require ROE-justified authorization.
4. Findings display in a structured panel, grouped by severity.
5. Discoveries push to TAK as CoT markers.
6. All existing Argos functionality remains intact.

**Risks and Watchpoints:**
1. **Raspberry Pi performance:** The Pi may not have sufficient CPU/RAM for concurrent Kismet + HackRF + Claude API workflows. | **Impact:** Workflows may be slow or fail. | **Recovery:** Offload Claude API calls to a remote server, keep only tool execution on the Pi.
2. **Claude context window limits:** Large nmap or signal analysis results may exceed the context window. | **Impact:** Claude loses track of earlier findings. | **Recovery:** Aggressive summarization of tool results before feeding to Claude.
3. **HackRF USB stability on Pi:** The Pi's USB stack may not handle sustained HackRF capture reliably. | **Impact:** Captures fail or produce corrupted data. | **Recovery:** Add USB error detection and retry logic. Consider USB hub with external power.
4. **ARM compatibility:** Some tools or GNU Radio modules may not have ARM builds. | **Impact:** RF analysis pipeline partially functional. | **Recovery:** Identified in Step 1.4; substitute tools or use Docker with QEMU emulation.
5. **Claude API cost:** Multi-step workflows with many tool calls could be expensive at scale. | **Impact:** Operational cost concern. | **Recovery:** Use claude-sonnet-4-20250514 instead of Opus for routine workflows. Cache common reasoning patterns.

**Open Questions:**
1. Does Argos have an existing test suite? (Determines whether Step 7.5 is automated or manual.)
2. Does the Pi have internet access directly or through a gateway? (Affects Claude API access architecture.)
3. Is there an existing Argos component library or design system? (Affects UI component styling in Phase 6.)

**Traceability:**
- Requirement 1 (right-click Kismet target) → Satisfied by Steps 6.6
- Requirement 2 (click RF signal) → Satisfied by Steps 6.5
- Requirement 3 (Claude-powered workflows) → Satisfied by Steps 2.4, 5.1-5.7
- Requirement 4 (Tier 0 auto) → Satisfied by Steps 2.3, 3.2 (Tier 0 tools), 4.1
- Requirement 5 (Tier 1 confirm) → Satisfied by Steps 2.3, 6.3
- Requirement 6 (Tier 2 ROE auth) → Satisfied by Steps 2.3, 2.5, 6.3
- Requirement 7 (real-time streaming) → Satisfied by Steps 6.1, 6.2
- Requirement 8 (findings panel) → Satisfied by Step 6.4
- Requirement 9 (TAK integration) → Satisfied by Step 6.7
- Requirement 10 (tool wrappers) → Satisfied by Steps 3.1-3.6, 4.1-4.5
- Requirement 11 (no breakage) → Satisfied by Steps 7.5

**---
---**

**# PART 3: VERIFICATION ARTIFACTS**

**## Verification Status: PASSED WITH INVESTIGATION**

Multiple items require executor discovery during Phase 1 before implementation can proceed. The plan accounts for this by front-loading investigation steps that produce the required proof documents.

---

**### Proof Document 1: File Map**

**New files to create:**

| **File Path** | **Purpose** |
|-----------|---------|
| `src/lib/cybereffects/types.ts` | All TypeScript interfaces |
| `src/lib/cybereffects/orchestrator.ts` | WorkflowOrchestrator — Claude conversation loop |
| `src/lib/cybereffects/tool-registry.ts` | ToolRegistry — register and invoke tools |
| `src/lib/cybereffects/authorization.ts` | AuthorizationGate — tiered HITL system |
| `src/lib/cybereffects/roe.ts` | Rules of Engagement config loading and validation |
| `src/lib/cybereffects/tools/base-tool.ts` | Base subprocess wrapper |
| `src/lib/cybereffects/tools/network/nmap.ts` | Nmap tool definitions |
| `src/lib/cybereffects/tools/network/kismet-adapter.ts` | Kismet REST API adapter |
| `src/lib/cybereffects/tools/network/nikto.ts` | Nikto web scanner wrapper |
| `src/lib/cybereffects/tools/network/sqlmap.ts` | SQLMap wrapper |
| `src/lib/cybereffects/tools/network/aircrack.ts` | Aircrack-ng wrapper |
| `src/lib/cybereffects/tools/rf/hackrf-control.ts` | HackRF sweep wrapper |
| `src/lib/cybereffects/tools/rf/signal-recorder.ts` | Signal capture wrapper |
| `src/lib/cybereffects/tools/rf/signal-analyzer.ts` | Signal analysis wrapper (calls Python) |
| `src/lib/cybereffects/tools/rf/analyze_signal.py` | Python signal analysis script |
| `src/lib/cybereffects/tools/rf/protocol-db.ts` | Protocol database interface |
| `src/lib/cybereffects/tools/rf/protocols.json` | Protocol signature data |
| `src/lib/cybereffects/tools/rf/replay-transmit.ts` | Replay and jam wrappers |
| `src/lib/cybereffects/workflows/network-recon.ts` | Network recon workflow |
| `src/lib/cybereffects/workflows/vuln-analysis.ts` | Vulnerability analysis workflow |
| `src/lib/cybereffects/workflows/exploit.ts` | Exploit workflow |
| `src/lib/cybereffects/workflows/rf-spectrum-scan.ts` | RF spectrum scan workflow |
| `src/lib/cybereffects/workflows/rf-signal-analysis.ts` | RF signal analysis workflow |
| `src/lib/cybereffects/workflows/rf-attack.ts` | RF attack workflow |
| `src/lib/cybereffects/workflows/combined-recon.ts` | Combined network+RF recon |
| `src/routes/api/workflow/trigger/+server.ts` | Workflow trigger endpoint |
| `src/routes/api/workflow/[id]/status/+server.ts` | Workflow status + SSE stream |
| `src/routes/api/workflow/[id]/authorize/+server.ts` | Authorization response endpoint |
| `src/routes/api/workflow/[id]/results/+server.ts` | Workflow results endpoint |
| `src/lib/components/cybereffects/WorkflowPanel.svelte` | Real-time workflow progress UI |
| `src/lib/components/cybereffects/AuthorizationDialog.svelte` | HITL confirmation modal |
| `src/lib/components/cybereffects/FindingsPanel.svelte` | Findings display |
| `src/lib/components/cybereffects/SpectrumPanel.svelte` | Spectrum scan visualization |

**Existing files to modify:**
- Kismet panel component (path TBD in Step 1.2) — add context menu.
- TAK bridge module (path TBD in Step 1.3) — add finding-to-CoT conversion.
- `package.json` — add new dependencies.
- Root layout or dashboard page — add new panel components.

**Executor must produce in Step 1.1:** Complete inventory of existing Argos files that will be affected.

---

**### Proof Document 2: Dependency List**

**New NPM dependencies:**

| **Package** | **Version** | **Purpose** |
|---------|---------|---------|
| `@anthropic-ai/sdk` | Executor must determine current stable version in Step 1.5 | Claude API client |
| `zod` | Executor must determine current stable version | Runtime validation of tool results |

**Existing dependencies (must verify in Step 1.1):**
- SvelteKit (version TBD)
- Vite (version TBD)
- Tailwind CSS (if used — TBD)
- Any existing HTTP client library (for Kismet adapter)

**System dependencies (must verify in Step 1.4):**

| **Tool** | **Version** | **ARM Compatible?** |
|------|---------|----------------|
| nmap | TBD in Step 1.4 | Expected yes |
| nikto | TBD | Expected yes |
| sqlmap | TBD | Expected yes (Python) |
| aircrack-ng | TBD | Expected yes |
| hackrf (libhackrf) | TBD | Expected yes |
| hackrf_sweep | TBD | Part of hackrf |
| hackrf_transfer | TBD | Part of hackrf |
| gnuradio | TBD | Expected yes (may need ARM build) |
| python3 + numpy | TBD | Expected yes |
| python3 + matplotlib | TBD | Expected yes |

**Executor must produce in Step 1.4:** Exact versions and ARM compatibility confirmation for all system dependencies.

---

**### Proof Document 3: Type Inventory**

All shared types defined in Step 2.1 (`types.ts`):

| **Type** | **Fields** | **Used By** |
|------|--------|---------|
| `TargetInfo` | id, domain, mac?, ip?, ssid?, hostname?, frequency?, bandwidth?, powerLevel?, modulationType?, protocol?, firstSeen, lastSeen, location?, metadata | Every workflow, every UI component, TAK bridge |
| `ToolDefinition` | name, description, input_schema, authorizationTier, domain, timeout, execute | ToolRegistry, Orchestrator |
| `ToolResult` | success, toolName, executionTime, rawOutput, structuredData, errors? | All tool wrappers, Orchestrator |
| `AuthorizationRequest` | id, workflowId, tier, proposedAction, toolName, toolParams, target, roeJustification?, riskAssessment, timestamp | AuthorizationGate, AuthorizationDialog |
| `AuthorizationResponse` | requestId, approved, operatorId?, justification?, timestamp | AuthorizationGate, AuthorizationDialog |
| `WorkflowEvent` | workflowId, timestamp, type, data | Orchestrator, WorkflowPanel, SSE stream |
| `CyberEffect` | id, name, description, domain, applicableTo, requiredTools, maxAuthorizationTier, execute | All workflows, context menu, trigger endpoint |
| `FindingReport` | id, workflowId, target, findings[], timestamp, duration, toolsUsed, authorizationEvents | All workflows, FindingsPanel, TAK bridge |
| `RulesOfEngagement` | id, name, allowedTiers, allowedDomains, targetRestrictions, maxTransmitPower?, timeRestrictions?, notes | AuthorizationGate, ROE config, Claude system prompts |
| `ProtocolSignature` | name, frequencyRanges, modulationTypes, commonBitRates?, packetLength?, preamble?, description, threatLevel, references | Protocol database, signal analyzer |

---

**### Proof Document 4: State Map**

| **State** | **Location** | **Reads** | **Writes** | **Type** | **Initial** |
|-------|----------|-------|--------|------|---------|
| Active workflows | Orchestrator (in-memory Map) | WorkflowPanel, status endpoint | Orchestrator.executeWorkflow | `Map<string, WorkflowState>` | Empty map |
| Pending authorizations | AuthorizationGate (in-memory Map) | AuthorizationDialog, authorize endpoint | AuthorizationGate.authorize | `Map<string, { request, resolve }>` | Empty map |
| Tool registry | ToolRegistry (in-memory Map) | Orchestrator, Claude tool definitions | Registration at startup | `Map<string, ToolDefinition>` | Empty, populated on init |
| Current ROE | ROE module (in-memory) | AuthorizationGate, Claude system prompts | ROE config load, runtime update | `RulesOfEngagement` | Default permissive ROE |
| Findings history | Svelte store (writable) | FindingsPanel, TAK bridge | Workflow completion callbacks | `FindingReport[]` | Empty array |
| Spectrum scan data | Svelte store (writable) | SpectrumPanel | RF spectrum scan workflow | Sweep data structure | null |
| SSE connections | Status endpoint (in-memory Map) | SSE write loop | Client connect/disconnect | `Map<string, WritableStream>` | Empty map |

**Executor must discover in Step 1.1:** Any existing Svelte stores, context providers, or global state in Argos that the new components must integrate with.

---

**### Proof Document 5: API Map**

**Internal APIs (new SvelteKit routes):**

| **Endpoint** | **Method** | **Request** | **Response** | **Auth** | **Used By** |
|----------|--------|---------|----------|------|---------|
| `/api/workflow/trigger` | POST | `{ effectId, targetId, targetInfo }` | `{ workflowId, status }` | None (local only) | Context menu, Spectrum panel |
| `/api/workflow/[id]/status` | GET | SSE: `Accept: text/event-stream` | Stream of `WorkflowEvent` | None | WorkflowPanel |
| `/api/workflow/[id]/authorize` | POST | `{ requestId, approved, justification? }` | `{ acknowledged }` | None | AuthorizationDialog |
| `/api/workflow/[id]/results` | GET | None | `FindingReport` | None | FindingsPanel |

**External APIs:**

| **API** | **Endpoint** | **Method** | **Request** | **Response** | **Auth** | **Used By** |
|-----|----------|--------|---------|----------|------|---------|
| Anthropic Claude | `https://api.anthropic.com/v1/messages` | POST | Messages + tools | Completion with tool_use | API key header | Orchestrator |
| Kismet REST | TBD in Step 1.2 | GET | TBD | TBD | TBD (likely API key or session) | Kismet adapter |
| TAK Server | TBD in Step 1.3 | TBD | CoT XML (TBD) | TBD | TBD | TAK bridge |

**Executor must produce in Steps 1.2 and 1.3:** Complete Kismet and TAK API maps with exact endpoints, methods, request/response shapes, and authentication.

---

**### Proof Document 6: Execution Order**

| **Order** | **Step** | **Depends On** | **Rationale** |
|-------|------|------------|-----------|
| 1 | Step 1.1: Argos inventory | Nothing | Must know what exists before changing anything |
| 2 | Step 1.2: Kismet integration inventory | Step 1.1 | Kismet is a key integration point |
| 3 | Step 1.3: TAK integration inventory | Step 1.1 | TAK is a key integration point |
| 4 | Step 1.4: Pi environment verification | Nothing (parallel with 1-3) | Can run independently |
| 5 | Step 1.5: Claude API verification | Step 1.4 (needs Pi network) | Confirms API access from Pi |
| 6 | Step 1.6: Repo extraction | Nothing (parallel with 1-5) | Independent research activity |
| 7 | Step 1.7: Synthesis | Steps 1.1-1.6 (all investigation) | Requires all findings to synthesize |
| 8 | Step 2.1: Types | Step 1.7 | Types informed by synthesis and inventory |
| 9 | Step 2.2: Tool Registry | Step 2.1 | Uses ToolDefinition type |
| 10 | Step 2.3: Authorization Gate | Step 2.1 | Uses AuthorizationRequest/Response types |
| 11 | Step 2.4: Orchestrator | Steps 2.1, 2.2, 2.3, 1.5 | Uses types, registry, gate, and Claude API |
| 12 | Step 2.5: ROE config | Steps 2.1, 2.3 | ROE feeds into authorization gate |
| 13 | Step 3.1: Base tool wrapper | Step 2.1 | Uses ToolResult type |
| 14 | Steps 3.2-3.6: Network tools | Steps 3.1, 2.2, 1.4 | Use base wrapper, register with registry, need verified tools |
| 15 | Steps 4.1-4.5: RF tools | Steps 3.1, 2.2, 1.4 | Same as network tools, parallel track |
| 16 | Steps 5.1-5.7: Workflows | Steps 2.4, 3.x, 4.x | Use orchestrator and all tools |
| 17 | Steps 6.1-6.7: UI integration | Steps 5.x, 1.1-1.3 | Use workflows and existing Argos components |
| 18 | Steps 7.1-7.5: Integration testing | All above | Tests complete system |

**Critical path:** 1.1 → 1.7 → 2.1 → 2.2/2.3 → 2.4 → 5.x → 6.x → 7.x

Steps 1.4, 1.5, and 1.6 can run in parallel with 1.1-1.3. Steps 3.x and 4.x can run in parallel after 3.1. Steps 6.x can begin as soon as the corresponding workflows are complete.

---

**### Proof Document 7: Environment & Infrastructure Manifest**

| **Item** | **Expected Value** | **Where Set** | **What Breaks If Missing** |
|------|---------------|-----------|----------------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Environment variable or `.env` | All Claude API calls fail |
| Node.js runtime | v18+ (TBD exact in Step 1.1) | System install | Argos won't run |
| Python 3 | 3.8+ (TBD exact in Step 1.4) | System install | Signal analysis fails |
| numpy | TBD | pip install | Signal analysis fails |
| matplotlib | TBD | pip install | Spectrum visualization fails |
| hackrf drivers | TBD | System install | All RF tools fail |
| GNU Radio | TBD | System install | Advanced signal analysis fails |
| Kismet | Running and accessible | Separate service | Network target discovery fails |
| TAK Server | Running and accessible | Separate service | TAK integration fails |
| HackRF One hardware | Connected via USB | Physical connection | All RF tools fail |
| Sufficient `/tmp` space | ≥500MB free | Filesystem | IQ captures fail |
| Internet connectivity | From Pi to api.anthropic.com | Network config | Claude API calls fail |

**Executor must complete in Step 1.4:** Fill in all TBD values with exact versions.

---

**### Proof Document 8: Risk & Assumption Register**

| **ID** | **Type** | **Description** | **Impact** | **Mitigation** | **Tripwire** |
|----|------|-------------|--------|------------|----------|
| A1 | Assumption | Argos is a working SvelteKit app | High — can't build on broken foundation | Step 1.1 verifies build succeeds | `npm run build` fails |
| A2 | Assumption | Kismet REST API is accessible | High — no network targets | Step 1.2 tests API access | Kismet endpoint unreachable |
| A3 | Assumption | HackRF One works on Pi | High — no RF capabilities | Step 1.4 tests with hackrf_info | hackrf_info fails or hangs |
| A4 | Assumption | Pi has sufficient resources | Medium — may need architecture change | Step 1.4 tests concurrent load | OOM killer activates, system becomes unresponsive |
| A5 | Assumption | Claude API is reachable from Pi | High — no AI reasoning | Step 1.5 tests connectivity | API calls fail with network error |
| A6 | Assumption | Reference repos have extractable patterns | Medium — may need original design | Step 1.6 evaluates each repo | Repos are undocumented or non-functional |
| R1 | Risk | Context window overflow with large tool outputs | Medium — Claude loses context | Summarization in orchestrator (Step 2.4) | Claude responses become incoherent or miss earlier findings |
| R2 | Risk | HackRF USB stability | Medium — captures fail | USB error detection + retry (Step 4.2) | Repeated USB disconnect errors in dmesg |
| R3 | Risk | GNU Radio not ARM-compatible | Medium — RF analysis limited | Identified in Step 1.4; fallback to numpy-only analysis | gnuradio import fails on ARM |
| R4 | Risk | Claude API cost at scale | Low — operational concern | Use Sonnet for routine, Opus for complex | Monthly API bill exceeds budget |
| R5 | Risk | Accidental RF transmission without authorization | Critical — safety violation | Triple-layer safety: ROE check → auth gate → wrapper check (Steps 2.3, 2.5, 4.5) | Any Tier 2 action executes without operator approval |
| R6 | Risk | Command injection via tool parameters | Critical — security vulnerability | Input sanitization in base tool wrapper (Step 3.1) | Shell metacharacters in tool parameters |
| R7 | Risk | SSE connection drops on slow Pi network | Low — UI stops updating | Reconnect logic in WorkflowPanel | Events stop appearing but workflow continues |
| R8 | Risk | Existing Argos functionality breaks | High — violates Requirement 11 | Regression testing in Step 7.5 | Existing features fail after new code deployed |

---

**### Dependency Chains (Critical)**

**Highest blast radius steps (if wrong, most downstream steps break):**

1. **Step 2.1 (Types)** — Every file in the project imports from types.ts. A type error here propagates everywhere.
2. **Step 2.4 (Orchestrator)** — Every workflow depends on the orchestrator. A bug in the Claude conversation loop breaks all workflows.
3. **Step 2.3 (Authorization Gate)** — Safety-critical. A bug here could allow unauthorized actions (R5).
4. **Step 3.1 (Base Tool Wrapper)** — Every tool wrapper inherits from this. An input sanitization failure here is a security vulnerability across all tools (R6).

These four steps must be verified most rigorously before proceeding to steps that depend on them.

---

**### Unresolved Items**

All unresolved items map to investigation steps in Phase 1:

| **Item** | **Required For** | **Investigation Step** |
|------|-------------|-------------------|
| Argos codebase structure | All UI integration (Phase 6) | Step 1.1 |
| Kismet REST API details | Kismet adapter (Step 3.3) | Step 1.2 |
| TAK bridge implementation | TAK output (Step 6.7) | Step 1.3 |
| Tool versions and ARM compatibility | All tool wrappers (Phases 3-4) | Step 1.4 |
| Claude API access from Pi | Orchestrator (Step 2.4) | Step 1.5 |
| Extractable patterns from repos | Design decisions (Step 2.1 onward) | Step 1.6 | | Best-of-breed pattern selections | All implementation (Phases 2-5) | Step 1.7 | | Existing Svelte stores and global state | UI integration (Phase 6) | Step 1.1 | | Existing component library/design system | UI component styling (Phase 6) | Step 1.1 | | Existing test suite (if any) | Regression testing (Step 7.5) | Step 1.1 | | Pi internet connectivity method | Claude API architecture | Step 1.4, 1.5 | | Kismet authentication method | Kismet adapter (Step 3.3) | Step 1.2 | | TAK connection protocol (TCP/UDP/REST) | TAK bridge extension (Step 6.7) | Step 1.3 | | CoT schema extensibility | TAK marker creation (Step 6.7) | Step 1.3 | | Wireless interface availability for aircrack-ng | WiFi tool wrappers (Step 3.6) | Step 1.4 | | /tmp free space on Pi | IQ capture file storage (Step 4.2) | Step 1.4 | | Python numpy/matplotlib ARM status | Signal analysis script (Step 4.3b) | Step 1.4 | | GNU Radio ARM build status | Advanced RF analysis (Step 4.3) | Step 1.4 |

**### Proof Document 9: Traceability Matrix**
Every requirement from the brief must map to implementation steps, deliverables, and verification methods. No orphaned requirements.
**Req ID
Requirement
Implementing Steps
Deliverable(s)
Verification Method**
R1
Right-click Kismet target → context menu with cyber effect actions
6.6
Modified Kismet panel component
Trigger: right-click target in Kismet panel. Observe: context menu with Recon, Vuln Scan, Exploit, Combined Recon. Confirm: selecting Recon triggers workflow.
R2
Click RF signal → investigation action
6.5
SpectrumPanel.svelte
Trigger: click "Investigate" on hot frequency. Observe: RF Signal Analysis workflow starts. Confirm: progress streams in WorkflowPanel.
R3
Claude-powered workflows with reasoning, tool selection, execution, interpretation, adaptation
2.4, 5.1–5.7
orchestrator.ts, all workflow files
Trigger: any workflow. Observe: Claude reasons, selects tools, executes, interprets results, adapts if tool fails or is denied. Confirm: WorkflowEvents stream in correct order.
R4
Tier 0 actions auto-execute without confirmation
2.3 (Tier 0 logic), 3.2 (nmap_port_scan), 4.1 (hackrf_sweep)
authorization.ts
Trigger: workflow calls Tier 0 tool. Observe: no dialog appears. Confirm: tool executes immediately, audit log shows auto-approved.
R5
Tier 1 actions require single operator confirmation
2.3 (Tier 1 logic), 6.3
authorization.ts, AuthorizationDialog.svelte
Trigger: workflow calls Tier 1 tool. Observe: dialog appears with action details. Confirm: approve → tool executes; deny → workflow adapts.
R6
Tier 2 actions require explicit authorization with ROE justification
2.3 (Tier 2 logic), 2.5, 6.3
authorization.ts, roe.ts, AuthorizationDialog.svelte
Trigger: workflow calls Tier 2 tool. Observe: dialog with ROE justification field. Confirm: cannot approve without justification text; approve → executes; deny → aborts cleanly.
R7
Real-time streaming of Claude reasoning and tool outputs
6.1 (SSE endpoint), 6.2
status/+server.ts, WorkflowPanel.svelte
Trigger: start workflow. Observe: events appear in panel as they occur (no page refresh). Confirm: reasoning, tool_call, tool_result events all render distinctly.
R8
Structured findings panel grouped by severity
6.4
FindingsPanel.svelte
Trigger: complete a workflow. Observe: findings appear grouped critical → high → medium → low → info. Confirm: filterable by domain, severity, target, confirmed status.
R9
Discoveries push to TAK as CoT markers
6.7
Modified TAK bridge module
Trigger: workflow produces findings. Observe: markers appear in ATAK/WinTAK/TAK Server. Confirm: marker attributes include finding type, severity, description, timestamp, correct location.
R10
Kali tools (nmap, nikto, sqlmap, aircrack-ng) and SDR tools (hackrf_sweep, hackrf_transfer, GNU Radio) wrapped as Claude tool_use functions
3.1–3.6, 4.1–4.5
All tool wrapper files
Trigger: Claude requests each tool in a workflow. Observe: tool executes via subprocess, output is captured. Confirm: ToolResult contains valid rawOutput and structuredData.
R11
No existing Argos functionality breaks
7.5
Test results
Trigger: run existing test suite (if any) + manual verification. Observe: Kismet panel refreshes data, TAK markers send, all routes load, build succeeds. Confirm: zero regressions.
**Gap check:** All 11 requirements have implementing steps, deliverables, and verification methods. No orphaned requirements.

**### Proof Document 10: Critical Path Analysis**
**Critical path** (longest chain of Finish-to-Start dependencies determining minimum completion time):
Step 1.1 ──FS──▶ Step 1.2 ──FS──▶ Step 1.3 ──FS──▶ Step 1.7 ──FS──▶ Step 2.1 ──FS──▶ Step 2.2 ──FS──▶ Step 2.4 ──FS──▶ Step 5.1 ──FS──▶ Step 6.1 ──FS──▶ Step 6.6 ──FS──▶ Step 7.1 ──FS──▶ Step 7.5
                                                                              │
                                                                         FS──▶ Step 2.3 ──FS──▶ Step 2.4 (merges)
**Tasks on the critical path (zero slack):**
**Step
Task
Dependency Type
Why Critical**
1.1
Argos codebase inventory
Start node
Every subsequent step depends on knowing what exists
1.2
Kismet integration inventory
FS from 1.1
Kismet adapter and context menu depend on this
1.3
TAK integration inventory
FS from 1.1
TAK bridge extension depends on this
1.7
Synthesis
FS from 1.1–1.6
All design decisions flow from synthesis
2.1
Core types
FS from 1.7
Every file in the project imports types.ts
2.2
Tool registry
FS from 2.1
Orchestrator and all tools depend on registry
2.3
Authorization gate
FS from 2.1
Orchestrator depends on gate; safety-critical
2.4
Orchestrator
FS from 2.1, 2.2, 2.3
Every workflow depends on orchestrator
5.1
Network recon workflow
FS from 2.4, 3.x
First testable end-to-end workflow
6.1
Workflow API routes
FS from 5.x
UI depends on API layer
6.6
Kismet context menu
FS from 6.1, 1.2
Primary user entry point
7.1
End-to-end network test
FS from 6.x
Final validation
7.5
Regression verification
FS from all above
Must be last
**Tasks with float (can be parallelized without extending critical path):**
**Step
Task
Float / Parallelism**
1.4
Pi environment verification
Can run in parallel with 1.1–1.3
1.5
Claude API verification
Can run in parallel with 1.1–1.3 (after 1.4 confirms network)
1.6
Repo extraction
Can run in parallel with 1.1–1.5 (independent research)
3.1
Base tool wrapper
Can start immediately after 2.1; parallel with 2.2–2.3
3.2–3.6
Network tool wrappers
Can run in parallel with each other after 3.1
4.1–4.5
RF tool wrappers
Can run in parallel with 3.2–3.6 after 3.1
5.2–5.7
Additional workflows
Can follow 5.1 in parallel tracks after orchestrator is proven
6.2–6.5
UI panels
Can run in parallel with each other after 6.1
**Near-critical path (could become critical if delayed):**
Step 1.4 ──FS──▶ Step 3.1 ──FS──▶ Step 3.2 ──FS──▶ Step 5.1
If Pi environment verification (1.4) reveals missing tools, the delay in installing them shifts this path onto the critical path.

**### Proof Document 11: Pre-Mortem Analysis**
**Assumption of failure:** This plan was executed exactly as written. It failed completely. The Cyber Effects Engine was unusable and had to be redesigned. Here is why.
**#
Failure Scenario
Category
Likelihood
Mitigated In Plan?
Mitigation / Addition**
PM1
The Pi runs out of RAM when Kismet + HackRF + Node.js + Claude API calls all run concurrently. OOM killer terminates Argos mid-workflow.
Resource exhaustion
Medium-High
Partially — Step 1.4 tests concurrent load. Risk R1 in register.
**Addition:** Step 1.4 must include a specific load test: start Kismet, run hackrf_sweep, start Argos dev server, and make a Claude API call simultaneously. Record peak memory with free -h every 5 seconds for 60 seconds. If peak exceeds 80% of total RAM, flag as critical blocker with specific remediation options (offload Claude to remote, reduce Kismet polling frequency, use swap).
PM2
The existing Argos SvelteKit version is old enough that the API route patterns (+server.ts) used in Phase 6 don't exist. Routes work differently.
Framework version mismatch
Low-Medium
Yes — Step 1.1 checks SvelteKit version.
**Verify:** If SvelteKit < 1.0, the route patterns in the plan need rewriting. Step 1.1 must flag this with a tripwire: "If SvelteKit version < 1.0, STOP. Phase 6 route design must be revised."
PM3
Claude's tool_use responses for multi-step workflows hit context window limits after 3-4 tool calls because nmap XML output is enormous (20K+ tokens for a /24 scan). The orchestrator's summarization (Step 2.4) is insufficient.
Context window overflow
Medium
Partially — Step 2.4 mentions summarization. Risk R1 in register.
**Addition:** Step 2.4 must specify a concrete summarization strategy: after each tool result, if raw output exceeds 2000 tokens, summarize to structured data only (drop raw XML/text). Include a hard token budget: reserve 40% of context window for Claude's reasoning, 40% for accumulated tool results, 20% for system prompt and tool definitions. Implement token counting before each API call.
PM4
The base tool wrapper's input sanitization (Step 3.1) blocks legitimate nmap arguments that contain characters like : (port ranges) or / (CIDR notation). Every scan fails with "input rejected."
Over-aggressive sanitization
Medium
Partially — Step 3.1 mentions sanitization but the blocked character list includes /.
**Addition:** Step 3.1 must define a per-tool allowlist approach instead of a global blocklist. Each tool wrapper declares which characters are valid for each parameter. For nmap target parameter: allow [0-9a-fA-F.:/-]. For nmap ports parameter: allow [0-9,:-]. The base wrapper enforces the allowlist from the tool definition, not a universal blocklist.
PM5
HackRF USB bandwidth on Raspberry Pi cannot sustain 2 Msps capture for more than a few seconds without dropping samples. Captured IQ data is corrupted.
Hardware limitation
Medium
Partially — Step 1.4 tests HackRF and Risk R2 in register.
**Addition:** Step 1.4 hackrf_transfer test must verify sample integrity: capture 5 seconds at 2 Msps, then analyze for dropped samples (check for repeated zero blocks in the raw file). If drops are detected, reduce default sample rate to 1 Msps or lower until stable. Record the maximum stable sample rate in ENVIRONMENT_MANIFEST.md.
PM6
The 7 reference repos are all poorly documented, use Python/Go/Rust (not TypeScript), and their patterns don't port cleanly. Step 1.6 produces 7 "non-extractable" reports. Step 1.7 synthesis has nothing to synthesize. Phases 2-5 must be designed from scratch.
No extractable patterns
Low-Medium
Yes — Assumption A6 and Risk register note this. Step 1.7 flags subsystems for original design.
**Verify existing mitigation is sufficient.** The plan already handles this: each subsystem in Step 1.7 is flagged for original design if no repo provides a usable pattern. The plan does NOT depend on the repos succeeding — they are accelerators, not prerequisites. No additional mitigation needed.
PM7
The SSE (Server-Sent Events) implementation for real-time streaming doesn't work on the Pi because the SvelteKit adapter in use doesn't support streaming responses.
Framework capability gap
Low
Partially — Step 1.1 identifies the adapter.
**Addition:** Step 1.1 must include a specific check: determine if the SvelteKit adapter supports streaming responses. If adapter is @sveltejs/adapter-static, SSE is impossible (no server). If adapter is @sveltejs/adapter-node, SSE works. If adapter is unknown or unsupported, add a step to switch to adapter-node or implement WebSocket fallback.
PM8
The existing Kismet panel has no concept of individual target selection. Targets are displayed as a non-interactive list or summary view. Adding right-click context menus requires restructuring the entire component.
Unknown existing UI complexity
Medium
Partially — Step 1.2 asks about existing interaction patterns.
**Addition:** Step 1.2 investigation must explicitly answer: "Can the operator currently click on or select an individual target in the Kismet panel?" If NO, Step 6.6 must include restructuring the Kismet panel to support per-row selection before adding the context menu. This could add significant scope. Flag in Risk register as R9.
PM9
The authorization gate's EventEmitter/store pattern creates a race condition: two Tier 1 authorizations arrive at the same time, but the UI only shows one dialog. The second authorization is silently dropped or auto-denied.
Concurrency bug in safety-critical component
Medium
Partially — Step 7.3 test #6 checks rapid succession.
**Addition:** Step 2.3 must specify a queuing mechanism: authorization requests go into a FIFO queue. The UI pops one at a time. While one dialog is active, additional requests wait in queue with a visible "N pending" indicator. No request is silently dropped. Add this to Step 6.3 UI spec as well.
PM10
The signal analyzer Python script (Step 4.3b) produces incorrect modulation classifications because the FFT-based heuristics are naive. Claude receives wrong protocol identifications and makes bad recommendations.
Analysis quality
Medium-High
Not mitigated.
**Addition:** Step 4.3b must include a confidence threshold: if the modulation classifier's confidence is below 60%, report "unknown/uncertain" rather than guessing. Step 4.4 protocol database queries must also return "no confident match" rather than the closest match when the match score is low. Claude's RF workflow system prompt (Step 5.5) must instruct Claude to treat low-confidence results as uncertain and recommend manual analysis.

**### Proof Document 12: Consistency Verification**
**Version consistency:**
**Check
Status
Notes**
TypeScript version consistent across plan
DEFERRED
Exact version TBD in Step 1.1. All new code is TypeScript — no conflict possible once version is known.
SvelteKit version consistent across plan
DEFERRED
Exact version TBD in Step 1.1. Plan uses +server.ts route convention (SvelteKit 1.0+). Tripwire: if < 1.0, Phase 6 must be revised.
@anthropic-ai/sdk version consistent
DEFERRED
Exact version TBD in Step 1.5. Only one consumer (orchestrator.ts).
Node.js version supports all features used
DEFERRED
Plan uses child_process.spawn, EventEmitter, async/await — all available in Node 18+. TBD in Step 1.1.
Python version supports numpy + matplotlib
DEFERRED
TBD in Step 1.4. Requires Python 3.8+.
**Naming consistency:**
**Check
Status
Notes**
TargetInfo used consistently
PASS
Used in types.ts, all workflows, all UI components, TAK bridge. Same shape everywhere.
ToolDefinition used consistently
PASS
Defined in types.ts, registered in tool-registry.ts, consumed by orchestrator.ts. Same shape.
WorkflowEvent.type enum values consistent
PASS
Seven values defined in types.ts: reasoning, tool_call, tool_result, authorization_required, authorization_response, finding, error, complete. WorkflowPanel.svelte handles all eight (seven + complete). Correction: complete is listed — eight values total. All accounted for in Step 6.2.
API route paths match between Phase 6 steps
PASS
/api/workflow/trigger (6.1) referenced by context menu (6.6) and spectrum panel (6.5). /api/workflow/[id]/status (6.1) referenced by WorkflowPanel (6.2). /api/workflow/[id]/authorize (6.1) referenced by AuthorizationDialog (6.3). Consistent.
Tool names in registry match tool names in workflows
PASS
Workflows reference: nmap_port_scan, nmap_service_detection, nmap_os_detection, nmap_vuln_scan, nikto_web_scan, sqlmap_test, sqlmap_dump, kismet_get_devices, kismet_get_device_detail, aircrack_scan, aircrack_deauth, hackrf_sweep, hackrf_record, signal_analyze, hackrf_replay, hackrf_jam. All defined in Steps 3.2–3.6 and 4.1–4.5.
**Behavioral consistency:**
**Check
Status
Notes**
Authorization tiers match between tool definitions and gate logic
PASS
Each tool's authorizationTier field feeds into AuthorizationGate.authorize(). Gate handles 0/1/2 uniformly.
ROE validation in gate vs. ROE validation in replay wrapper
PASS
Step 4.5 (replay-transmit.ts) has wrapper-level safety checks AND goes through authorization gate. Layered defense, not contradictory. Gate checks ROE first, then wrapper double-checks frequency/power.
FindingReport shape consistent between workflows and UI
PASS
All workflows return FindingReport (types.ts). FindingsPanel.svelte (6.4) reads findings[] array with severity, type, description, evidence. TAK bridge (6.7) reads findings for CoT conversion. Same shape throughout.
**Temporal consistency:**
**Check
Status
Notes**
Execution order matches dependency chain
PASS
Proof Document 6 verified. No step references a future step's output.
Types defined before consumers
PASS
Step 2.1 (types) precedes all steps that import types.
Registry exists before tools registered
PASS
Step 2.2 (registry) precedes Steps 3.2–3.6 and 4.1–4.5.
Orchestrator exists before workflows
PASS
Step 2.4 precedes Steps 5.1–5.7.
API routes exist before UI components consume them
PASS
Step 6.1 precedes Steps 6.2–6.6.

**### Proof Document 13: Definition of Done**
**Task-level Definition of Done:**
The Cyber Effects Engine is DONE when ALL of the following are true:
	1	All 11 requirements from the brief are satisfied (verified via Traceability Matrix, Proof Document 9).
	2	All 5 success criteria from the brief are demonstrable.
	3	All integration tests in Steps 7.1–7.4 pass.
	4	Regression test in Step 7.5 confirms no existing functionality is broken.
	5	npm run build succeeds with zero new warnings.
	6	npm run dev starts and all new routes are accessible.
	7	ARGOS_INVENTORY.md, ENVIRONMENT_MANIFEST.md, and all ARCHITECTURE_EXTRACT.md files exist and are current.
	8	Audit logging works: every authorization event (approve, deny, auto-deny, timeout) is recorded.
**What is explicitly OUT OF SCOPE:**
	•	Direction-finding / geolocation of RF emitters (mentioned as "if available" in Step 6.7 — not a deliverable).
	•	Persistent storage of findings across Argos restarts (findings are in-memory Svelte stores per State Map).
	•	Multi-user authorization (single operator assumed).
	•	Automated ROE generation (ROE is manually configured).
	•	Docker containerization or QEMU emulation (mentioned as fallback in Risk R4 — only if ARM compatibility fails).
	•	Mobile/responsive UI (Argos is a dashboard for a fixed workstation).
**Step-level Definition of Done (for highest-blast-radius steps):**
**Step
Done When
Regression Check**
2.1 (Types)
types.ts compiles with zero errors. A test file imports every exported type and TypeScript reports no errors. Every type has all fields defined with correct optionality.
N/A — new file, no regression.
2.2 (Tool Registry)
Unit tests pass: register, get, getAll, getByDomain, getClaudeToolDefinitions. Claude format matches Anthropic tool_use schema. Duplicate registration throws.
N/A — new file.
2.3 (Authorization Gate)
All 8 test cases from Step 2.3 pass. Audit log contains correct entries. No Tier 2 action can execute without ROE justification. Timeout results in denial.
N/A — new file.
2.4 (Orchestrator)
Integration test passes: mock tool registered, dummy effect executed, events emitted in correct order, FindingReport returned with correct structure. Error handling test: tool throws → Claude receives error → workflow adapts. Context management: token counting active, summarization triggers when threshold exceeded.
N/A — new file.
3.1 (Base Tool)
Subprocess captures stdout/stderr. Timeout kills process. Per-tool input allowlists enforced. Shell metacharacters in parameters rejected.
N/A — new file.
6.6 (Context Menu)
Right-click on Kismet target shows menu. Menu items correctly enabled/disabled based on prior workflow state. Selecting an item triggers POST to /api/workflow/trigger. Workflow starts and progress appears in WorkflowPanel.
Existing Kismet panel still functions: data refreshes, displays targets, all prior interactions work.
6.7 (TAK Push)
Finding-to-CoT conversion produces valid XML/protobuf. Markers appear in TAK client with correct attributes.
Existing TAK markers still send correctly. Sending a finding marker does not disrupt existing marker flow.

**### Proof Document 14: Dependency Type Classification**
All dependencies between major steps, classified by type (per Critical Path Method):
**From
To
Type
Hard/Soft
Rationale**
1.1
1.2
FS
Hard
Must know file structure to locate Kismet code
1.1
1.3
FS
Hard
Must know file structure to locate TAK code
1.1
1.7
FS
Hard
Synthesis needs codebase knowledge
1.2
1.7
FS
Hard
Synthesis needs Kismet integration details
1.3
1.7
FS
Hard
Synthesis needs TAK integration details
1.4
1.5
FS
Hard
Must confirm Pi has network before testing Claude API
1.4
3.x
FS
Hard
Must confirm tools exist before wrapping them
1.5
2.4
FS
Hard
Must confirm Claude API access before building orchestrator
1.6
1.7
FS
Hard
Synthesis needs repo extractions
1.7
2.1
FS
Hard
Type design informed by synthesis
2.1
2.2
FS
Hard
Registry uses ToolDefinition type
2.1
2.3
FS
Hard
Gate uses AuthorizationRequest/Response types
2.1
3.1
FS
Hard
Base wrapper uses ToolResult type
2.2
2.4
FS
Hard
Orchestrator depends on registry
2.3
2.4
FS
Hard
Orchestrator depends on gate
2.5
2.3
FS
Hard
Gate depends on ROE config
3.1
3.2–3.6
FS
Hard
All network tools use base wrapper
3.1
4.1–4.5
FS
Hard
All RF tools use base wrapper
2.4
5.x
FS
Hard
All workflows depend on orchestrator
3.x
5.1–5.3
FS
Hard
Network workflows need network tools
4.x
5.4–5.6
FS
Hard
RF workflows need RF tools
5.x
6.1
FS
Hard
API routes invoke workflows
6.1
6.2–6.6
FS
Hard
UI components consume API routes
1.2
6.6
FS
Hard
Context menu modifies Kismet panel (must know its structure)
1.3
6.7
FS
Hard
TAK push extends existing bridge (must know its interface)
6.x
7.x
FS
Hard
Integration tests need complete system
1.4
4.1–4.5
SS
Hard
RF tool development can start once environment is confirmed
5.1–5.7
6.1
FF
Soft
API routes can be developed in parallel with workflows but cannot be finalized until workflows are stable
3.2–3.6
3.2–3.6
None
N/A
Network tool wrappers are independent of each other — can be built in any order or in parallel
4.1–4.5
4.1–4.5
Partial
Soft
4.3 (analyzer) benefits from 4.2 (recorder) output for testing, but not a hard dependency — can use test data

**### Additions to Risk & Assumption Register (from Pre-Mortem)**
**ID
Type
Description
Impact
Mitigation
Tripwire**
R9
Risk
Kismet panel has no per-target selection/interaction capability
High — context menu (Step 6.6) needs restructuring of Kismet component
Step 1.2 explicitly answers target interactivity question. If no selection exists, add panel restructuring step before 6.6.
Step 1.2 reveals no click/select handlers on target rows
R10
Risk
SvelteKit adapter doesn't support SSE streaming
High — real-time progress (Step 6.2) falls back to polling
Step 1.1 identifies adapter. If static adapter, switch to adapter-node or implement WebSocket fallback.
SvelteKit adapter is @sveltejs/adapter-static
R11
Risk
Nmap XML output exceeds Claude context budget after 3-4 scans in a workflow
Medium — Claude loses earlier findings, recommendations degrade
Step 2.4 implements token budget: 40% reasoning / 40% tool results / 20% system prompt. Summarize tool results exceeding 2000 tokens to structured data only.
Claude responses become incoherent or reference findings it should have seen
R12
Risk
Authorization queue race condition — multiple Tier 1 requests arrive simultaneously
Medium — second request silently dropped
Step 2.3 implements FIFO queue. Step 6.3 shows "N pending" indicator. No silent drops.
Two workflows running concurrently, both hit Tier 1 at same time
R13
Risk
Signal analyzer produces false-positive protocol identifications
Medium — Claude makes bad RF recommendations
Step 4.3b enforces 60% confidence threshold. Below threshold → "unknown/uncertain." Step 5.5 system prompt instructs Claude to treat low confidence as uncertain.
Analyzer consistently returns wrong modulation types for known test signals
R14
Risk
Base tool wrapper input sanitization blocks legitimate tool arguments
Medium — nmap port ranges and CIDR notation rejected
Step 3.1 uses per-tool parameter allowlists instead of global blocklist. Each tool declares valid character set per parameter.
First nmap scan attempt is rejected by sanitizer
R15
Risk
HackRF sample drops at 2 Msps on Pi USB
Medium — corrupted IQ captures
Step 1.4 tests capture integrity at 2 Msps. If drops detected, reduce default to maximum stable rate. Document in ENVIRONMENT_MANIFEST.md.
Zero blocks detected in raw capture file

**### Final Verification Status**
**Verification Rule
Status
Notes**
Rule 1: Inventory
DEFERRED TO PHASE 1
Cannot inventory existing codebase without access. Steps 1.1–1.3 produce the inventory.
Rule 2: Transitive Dependencies
PARTIAL
Direct dependencies listed (Proof Doc 2). Transitive deps and phantom deps discoverable only after Step 1.1.
Rule 3: Concreteness
PASS
All plan items expanded per Phase 2.3. No placeholder language remains. Every "implement," "build," "configure" has been decomposed.
Rule 4: Dependency Chains
PASS
Proof Documents 6, 10, 14 trace all chains. Critical path identified.
Rule 5: Critical Path
PASS
Proof Document 10. Zero-slack steps identified. Parallel tracks identified. Near-critical path flagged.
Rule 6: Framework Translation
NOT APPLICABLE
No framework migration. New code is TypeScript/SvelteKit, same as existing Argos. Pattern extraction from other-language repos (Step 1.6) is design inspiration, not code porting.
Rule 7: Missing Piece Detector
PASS
Cross-reference complete (Proof Doc 9). All requirements mapped. Pre-mortem additions integrated.
Rule 8: Cross-Reference Completeness
PASS
Traceability Matrix (Proof Doc 9) shows all requirements → steps → deliverables → verification. No orphaned requirements or deliverables.
Rule 9: Proof Documents
PASS
14 proof documents produced (8 core + 6 additional from pre-mortem and consistency checks). Deferred items map to Phase 1 investigation steps.
Rule 10: Challenge
PASS
Three questions answered for all high-blast-radius steps (2.1, 2.3, 2.4, 3.1).
Rule 11: Pre-Mortem
PASS
10 failure scenarios analyzed (Proof Doc 11). 8 required plan additions, all integrated. 2 already mitigated.
Rule 12: Definition of Done
PASS
Task-level and step-level DoD defined (Proof Doc 13). Out of scope explicitly stated.
Rule 13: Consistency
PASS
Version, naming, behavioral, and temporal consistency verified (Proof Doc 12). No contradictions found.
**Overall Verification Status: PASSED WITH INVESTIGATION**
All verification rules are satisfied or explicitly deferred to Phase 1 investigation steps. No rule is unaddressed. The plan is executable once Phase 1 produces the required inventories and manifests.
push