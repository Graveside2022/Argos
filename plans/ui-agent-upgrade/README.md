# Plan 2: AG-UI Agent & Advanced Visualization Upgrade

> **STATUS: DISCUSSION ONLY — DO NOT EXECUTE. This is a proposal to be reviewed and discussed before any implementation begins.**

## Overview

Four recommendations using the packages already installed in `package.json` (ag-ui, deck.gl, cytoscape) to enhance the AI agent experience and add GPU-powered data visualization.

**Total effort**: ~12-16 days
**New packages needed**: None (all already installed)
**Dependencies**: Independent — can start anytime after cleanup

---

## All 13 Reserved Packages — What They Do & Which Plan Uses Them

| Package                      | What It Does                                                  | Used In                                         |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `@ag-ui/client`              | Connects AI agents to chat UIs with real-time streaming       | This plan                                       |
| `@ag-ui/core`                | Foundation library for @ag-ui/client                          | This plan                                       |
| `@ag-ui/mcp-apps-middleware` | Routes AI agent requests through MCP protocol                 | This plan                                       |
| `@deck.gl/core`              | GPU engine for rendering millions of data points on maps      | This plan                                       |
| `@deck.gl/layers`            | Pre-built visual layers (heatmaps, arcs, scatter) for deck.gl | This plan                                       |
| `deck.gl`                    | All-in-one bundle of both deck.gl packages                    | This plan (use this OR the two above, not both) |
| `cytoscape`                  | Draws interactive network relationship graphs                 | This plan                                       |
| `cytoscape-cola`             | Auto-arranges graph nodes to minimize visual overlap          | This plan                                       |
| `cytoscape-dagre`            | Arranges graph nodes in hierarchical tree shapes              | This plan                                       |
| `eventsource`                | Lets Node.js listen to Server-Sent Events from other servers  | This plan (agent streaming)                     |
| `eventsource-parser`         | Decodes raw SSE text format                                   | This plan (agent streaming)                     |
| `node-fetch`                 | HTTP requests for Node.js (like browser fetch on server)      | This plan (agent API calls)                     |
| `ts-interface-checker`       | Validates data matches TypeScript types at runtime            | This plan (agent response validation)           |

---

## 1. GPU-Accelerated Signal Heatmap (deck.gl)

**In plain English**: Instead of showing individual signal detections as dots on the map, this shows signal strength as a **color heat map** — like a weather radar map. Blue areas = weak signals, red areas = strong signals. The GPU graphics chip renders the entire heatmap in one shot, handling 100,000+ data points at 60 frames per second without breaking a sweat.

**Uses**: `@deck.gl/core`, `@deck.gl/layers` (already installed)

**What it does**:

- Each signal detection (location + power level) becomes a weighted heat point
- GPU renders the entire heatmap in one draw call
- Color gradient: blue (weak, -90dBm) → red (strong, -30dBm)
- Operators instantly see RF coverage patterns, dead zones, and signal concentration areas
- deck.gl has a Leaflet/MapLibre integration — drops on top of the existing map

**Operator benefit**: "Where are the strongest signals?" becomes a glance at a color map instead of reading a table of numbers.

**Effort**: Medium (2-3 days).

---

## 2. Network Relationship Graph (cytoscape)

**In plain English**: Same concept as Plan 1's network topology (showing WiFi devices as a visual web instead of a list), but using the cytoscape library that's already installed. Cytoscape is good for smaller networks (under 5,000 devices) and has nice automatic layout plugins already installed (cola for organic layouts, dagre for tree/hierarchy layouts).

**Uses**: `cytoscape`, `cytoscape-cola`, `cytoscape-dagre` (already installed)

**What it does**:

- Access points as large nodes, client devices as smaller nodes
- Lines show which devices are connected to which routers
- Line thickness = signal strength
- Color coding: known/trusted (green), unknown (yellow), suspicious (red)
- Cola layout auto-arranges to prevent overlap
- Dagre layout shows router → access point → device hierarchy
- Click a node to see device details

**Operator benefit**: Visualize device-to-AP relationships. Spot rogue access points. See network structure at a glance.

**Effort**: Medium (3-4 days).

---

## 3. AI Agent Chat Enhancement (ag-ui)

**In plain English**: The Ollama AI assistant currently shows plain text responses in a basic chat window. ag-ui upgrades that experience:

- **Tool-use visualization**: When the agent is checking Kismet devices, querying the spectrum, or looking up cell towers, you can SEE what it's doing in real-time instead of just waiting for text
- **Structured output**: Agent responses can include tables, charts, and formatted data instead of just plain text paragraphs
- **Conversation management**: Better handling of conversation history, branching, and context
- **MCP integration**: The middleware package connects the agent chat directly to Argos MCP tools, so the agent can use all 12 MCP tools through a standardized protocol instead of the custom HTTP bridge

**Uses**: `@ag-ui/client`, `@ag-ui/core`, `@ag-ui/mcp-apps-middleware` (already installed)

**Operator benefit**: The AI assistant becomes more interactive and transparent. You can see what tools it's using and get richer formatted responses instead of plain text.

**Effort**: High (5-7 days). Requires reworking the Ollama streaming endpoint and agent chat component.

---

## 4. RF Coverage Overlay (deck.gl ArcLayer)

**In plain English**: Cell tower data currently shows tower locations as dots on the map. This upgrade draws visual connections and coverage areas:

- **Arcs** (curved lines) from your device to the cell tower it's connected to, colored by signal quality (green = strong, red = weak)
- **Coverage circles** showing the estimated range of each tower
- **Animated arcs** during active scanning so you can see connections forming in real-time

**Uses**: `deck.gl` (already installed)

**Operator benefit**: "Am I in range of this tower?" and "Where does coverage overlap?" become visual instead of guesswork.

**Effort**: Low-Medium (1-2 days).

---

## Priority Matrix

| Rank  | Feature                    | Packages Used         | Effort   | Operator Impact                          |
| ----- | -------------------------- | --------------------- | -------- | ---------------------------------------- |
| **1** | GPU signal heatmap         | deck.gl (installed)   | 2-3 days | **High** — transforms signal awareness   |
| **2** | Network relationship graph | cytoscape (installed) | 3-4 days | **High** — visualizes device connections |
| **3** | RF coverage overlay        | deck.gl (installed)   | 1-2 days | **Medium** — cell tower visualization    |
| **4** | AI agent chat upgrade      | ag-ui (installed)     | 5-7 days | **Medium** — richer agent experience     |

---

## Overlap Note with Plan 1

Both plans include a network visualization feature:

- **Plan 1** uses Sigma.js (faster, WebGL, handles 10K+ nodes)
- **Plan 2** uses Cytoscape (already installed, good under 5K nodes, nicer layout plugins)

You can build both and let operators choose, or pick one after testing. They solve the same problem differently.

---

## Both Plans Side by Side

|                            | Plan 1: Tactical UI Overhaul    | Plan 2: AG-UI Agent Upgrade            |
| -------------------------- | ------------------------------- | -------------------------------------- |
| **Folder**                 | `plans/ui-tactical-overhaul/`   | `plans/ui-agent-upgrade/`              |
| **Focus**                  | Military-grade tactical display | AI agent + advanced data visualization |
| **Features**               | 6 recommendations               | 4 recommendations                      |
| **New packages**           | milsymbol, sigma, graphology    | None (all already installed)           |
| **Existing packages used** | MapLibre GL JS                  | ag-ui, deck.gl, cytoscape              |
| **Total effort**           | ~16-21 days                     | ~12-16 days                            |
| **Dependencies**           | Independent                     | Independent                            |
