# AG-UI + MCP Integration for Argos

## Overview

Argos now includes an AI agent layer that provides natural language control over SDR and network analysis tools through the AG-UI protocol and MCP (Model Context Protocol) server integration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Argos + AG-UI Stack                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Frontend   │◄────────┤   AG-UI      │                 │
│  │  (SvelteKit) │  events │   Client     │                 │
│  └──────────────┘         └──────┬───────┘                 │
│         ▲                        │                          │
│         │ UI resources           │ SSE Stream               │
│         ▼                        ▼                          │
│  ┌──────────────────────────────────────┐                  │
│  │        AG-UI Agent Runtime           │                  │
│  │  ┌────────────────────────────────┐  │                  │
│  │  │  Hybrid LLM Engine             │  │                  │
│  │  │  - Anthropic Claude (online)   │  │                  │
│  │  │  - Ollama (offline fallback)   │  │                  │
│  │  └────────┬───────────────────────┘  │                  │
│  └───────────┼──────────────────────────┘                  │
│              │                                              │
│              │ MCP Protocol                                 │
│              ▼                                              │
│  ┌─────────────────────────────────────┐                   │
│  │      Argos MCP Server               │                   │
│  │  ┌───────────────────────────────┐  │                   │
│  │  │ SDR Tools                     │  │                   │
│  │  │ - hackrf_spectrum_scan        │◄─┼── HackRF API     │
│  │  │ - kismet_scan_wifi            │◄─┼── Kismet API     │
│  │  │ - gsm_detect_imsi_catcher     │◄─┼── GSM Evil API   │
│  │  │ - gps_get_position            │◄─┼── GPS Service    │
│  │  │ - bettercap_wifi_deauth       │◄─┼── Bettercap API  │
│  │  └───────────────────────────────┘  │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. MCP Server (`src/lib/server/mcp/`)

Exposes all Argos capabilities as MCP tools:

**HackRF Tools:**

- `hackrf_spectrum_scan` - Start spectrum scan on frequency range
- `hackrf_get_status` - Get device status
- `hackrf_stop_scan` - Stop active scan

**GPS Tools:**

- `gps_get_position` - Get current GPS coordinates
- `gps_find_signals_near` - Find RF signals near GPS location

**Kismet Tools:**

- `kismet_scan_wifi` - Scan for WiFi APs and clients
- `kismet_get_device_details` - Get details for specific device
- `kismet_find_aps_near_gps` - Find APs within radius of coordinates

**Bettercap Tools:**

- `bettercap_get_status` - Get service status
- `bettercap_scan_network` - Scan local network
- `bettercap_wifi_deauth` - **[REQUIRES APPROVAL]** Send deauth frames

**GSM Tools:**

- `gsm_scan_cells` - Scan for GSM/LTE cells
- `gsm_detect_imsi_catcher` - Analyze for IMSI catcher indicators

### 2. Agent Runtime (`src/lib/server/agent/`)

**Hybrid LLM Engine:**

- **Primary**: Anthropic Claude Sonnet 4.5 (when online + API key set)
- **Fallback**: Ollama local model (offline mode)
- Automatic fallback with connectivity detection

### 3. Agent Chat UI (`src/lib/components/dashboard/AgentChatPanel.svelte`)

- Dark tactical theme matching Argos design
- Real-time streaming responses
- Message history with timestamps
- VS Code-style interface
- LLM provider status indicator

### 4. Tool Approval Dialog ~~`src/lib/components/dashboard/ToolApprovalDialog.svelte`~~ (REMOVED)

> **Note:** This component was removed during Phase 2 dead code elimination. Tool approval is now handled differently.

Original design - Human-in-the-loop approval for attack tools:

- Visual warning indicators
- Tool arguments display
- Category-based color coding
- Approve/Deny workflow

## Setup Instructions

### Prerequisites

**Option 1: Online Mode (Anthropic Claude)**

```bash
# Set API key in environment
export ANTHROPIC_API_KEY="your-api-key-here"
```

**Option 2: Offline Mode (Ollama)**

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model (1B parameter - safe for RPi 5 8GB RAM)
ollama pull llama3.2:1b

# Verify it's running
curl http://localhost:11434/api/tags
```

**Option 3: Hybrid (Recommended)**

- Set `ANTHROPIC_API_KEY` for online mode
- Install Ollama for offline fallback
- Agent automatically chooses best available

### Installation

Dependencies are already installed via `package.json`:

```bash
npm install @modelcontextprotocol/sdk @ag-ui/core @ag-ui/mcp-apps-middleware
```

### Usage

1. **Open Dashboard**
    - Navigate to `/dashboard`

2. **Click Agent Icon**
    - Third icon from top in left rail (stacked layers icon)
    - Panel opens on left side

3. **Type Natural Language Commands**

Examples:

```
"Scan 2.4-2.5 GHz for WiFi networks"
"Find all APs near my current GPS position"
"What GSM cells are nearby?"
"Show me the HackRF device status"
"Scan for IMSI catchers"
```

4. **Attack Tools Require Approval**

When agent requests attack tools (e.g., WiFi deauth):

- Approval dialog appears
- Shows tool name, arguments, category
- Must explicitly approve before execution

## LLM Provider Status

Check which LLM is active:

```bash
curl http://localhost:5173/api/agent/status
```

Response:

```json
{
	"provider": "anthropic", // or "ollama" or "unavailable"
	"available": {
		"anthropic": true,
		"ollama": false
	},
	"message": "Claude Sonnet 4.5 online"
}
```

## API Endpoints

### Agent Stream

`POST /api/agent/stream`

Streams AG-UI events (SSE format):

```json
{
	"message": "Scan 2.4 GHz",
	"threadId": "optional-thread-id",
	"runId": "optional-run-id"
}
```

### MCP Tools List

`GET /api/mcp`

Returns all available MCP tools.

### MCP Tool Execution

`POST /api/mcp`

Execute MCP tool:

```json
{
	"method": "tools/call",
	"params": {
		"name": "hackrf_spectrum_scan",
		"arguments": {
			"startFreq": 2400000000,
			"endFreq": 2500000000
		}
	}
}
```

## Event Types

AG-UI streams these events to the frontend:

| Event Type           | Description                  |
| -------------------- | ---------------------------- |
| `RunStarted`         | Agent begins processing      |
| `TextMessageStart`   | Agent starts responding      |
| `TextMessageContent` | Streaming text delta         |
| `TextMessageEnd`     | Response complete            |
| `ToolCallStart`      | Tool execution begins        |
| `ToolCallArgs`       | Tool arguments (streaming)   |
| `ToolCallEnd`        | Tool call complete           |
| `ToolCallResult`     | Tool execution result        |
| `StateSnapshot`      | Full state sync              |
| `StateDelta`         | Incremental state update     |
| `RunFinished`        | Agent completed successfully |
| `RunError`           | Agent encountered error      |

## Tool Approval Categories

Tools are classified by risk level:

| Category          | Color  | Description          | Requires Approval |
| ----------------- | ------ | -------------------- | ----------------- |
| `WIFI_DISRUPTION` | Red    | WiFi deauth, jamming | ✅ Yes            |
| `NETWORK_ATTACK`  | Orange | ARP spoofing, MITM   | ✅ Yes            |
| `RECONNAISSANCE`  | Yellow | Active scanning      | ❌ No             |
| Default           | Green  | Passive monitoring   | ❌ No             |

## Keyboard Shortcuts

| Shortcut        | Action                 |
| --------------- | ---------------------- |
| `Ctrl + \``     | Toggle terminal        |
| `Escape`        | Close agent panel      |
| `Enter`         | Send message (in chat) |
| `Shift + Enter` | New line (in chat)     |

## Tactical Use Cases

### Scenario 1: Automated Spectrum Triage

**Operator**: "Scan 400-500 MHz and identify any unusual activity"

**Agent**:

1. Calls `hackrf_spectrum_scan(400e6, 500e6)`
2. Streams results to chat
3. Cross-references with known frequencies
4. Highlights anomalies

### Scenario 2: GPS-Based Threat Detection

**Operator**: "Find all WiFi APs within 1km of grid 35.29/-116.68"

**Agent**:

1. Calls `kismet_find_aps_near_gps(35.29, -116.68, 1000)`
2. Returns list with signal strength
3. Updates tactical map
4. Flags unknown SSIDs

### Scenario 3: IMSI Catcher Detection

**Operator**: "Check for IMSI catchers"

**Agent**:

1. Calls `gsm_scan_cells()`
2. Calls `gsm_detect_imsi_catcher()`
3. Analyzes LAC changes, fake towers
4. Emits threat alerts

### Scenario 4: Human-in-the-Loop Attack

**Operator**: "Deauth all clients from SSID 'OPFOR-MESH'"

**Agent**:

1. Finds BSSID for 'OPFOR-MESH'
2. Requests approval via dialog
3. **WAITS for operator to approve**
4. Executes `bettercap_wifi_deauth()` only if approved

## Troubleshooting

### Agent Shows "Unavailable"

```bash
# Check Ollama
systemctl status ollama
curl http://localhost:11434/api/tags

# Check Anthropic API
echo $ANTHROPIC_API_KEY

# Check agent status
curl http://localhost:5173/api/agent/status
```

### Streaming Fails

- Check browser console for SSE errors
- Verify `/api/agent/stream` endpoint is accessible
- Check Node.js memory: `--max-old-space-size=2048`

### MCP Tools Not Listed

```bash
# Test MCP endpoint
curl http://localhost:5173/api/mcp

# Check MCP server implementations (tools are embedded in servers)
ls -la src/lib/server/mcp/servers/*.ts
```

### Ollama Model Missing

```bash
# List installed models
ollama list

# Pull recommended model (1B - optimized for RPi 5 8GB RAM)
ollama pull llama3.2:1b
```

## Performance Notes

### RPi 5 Constraints

- **8GB RAM**: Use `llama3.2:1b` model (~1.8GB loaded, leaves headroom for other services)
- **CPU**: 4x Cortex-A76 sufficient for Ollama inference
- **Latency**: ~2-3 seconds per response (offline)
- **Anthropic API**: ~500ms per response (online)

### Optimization

- Hybrid mode prioritizes Claude API when online
- Fallback to Ollama preserves functionality offline
- MCP tools execute locally (no API calls needed)

## Security Considerations

1. **API Keys**: Store `ANTHROPIC_API_KEY` in `.env`, never commit
2. **Tool Approval**: All attack tools require explicit operator approval
3. **Audit Log**: All AG-UI events are timestamped and structured
4. **Local Execution**: Ollama keeps all data on-device (OPSEC)
5. **Network Isolation**: Works offline at NTC/JMRC with Ollama

## Future Enhancements

- [ ] Multi-agent coordination (A2A protocol)
- [ ] Persistent conversation history
- [ ] Voice input for hands-free operation
- [ ] Custom tool creation via UI
- [ ] Integration with after-action review (AAR) systems
- [ ] Real-time collaborative intelligence sharing across platoon

## References

- [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Ollama](https://ollama.com/)
- [Anthropic Claude API](https://docs.anthropic.com/)

---

**Status**: ✅ Implemented and integrated into Argos dashboard
**Test**: Click the agent icon (stacked layers) in the dashboard left rail
