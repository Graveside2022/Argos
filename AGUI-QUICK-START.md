# AG-UI Quick Start Guide

## What Was Implemented

Your Argos SDR console now has an AI agent that understands natural language and can control all your hardware/tools through conversation.

## 🚀 Get Started in 3 Steps

### Step 1: Configure Claude API

**Set up Anthropic Claude API**

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-key-here"

# Add to .env file for persistence
echo 'ANTHROPIC_API_KEY=your-key-here' >> .env
```

**Get an API key:**

1. Visit https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys
4. Generate a new key and copy it

### Step 2: Start Argos

```bash
npm run dev
```

### Step 3: Open Agent Chat

1. Navigate to http://localhost:5173/dashboard
2. Click the **stacked layers icon** (3rd from top in left rail)
3. Agent panel opens - start typing!

## 💬 Example Commands

### Spectrum Analysis

```
"Scan 2.4-2.5 GHz for WiFi networks"
"What's the HackRF device status?"
"Start a sweep from 400-500 MHz"
```

### GPS & Location

```
"Where am I?"
"Find all WiFi APs within 1km of my position"
"Show me signals detected near grid 35.29/-116.68"
```

### WiFi Reconnaissance

```
"Scan for WiFi networks"
"Show me details for BSSID AA:BB:CC:DD:EE:FF"
"Find all APs with signal strength above -60 dBm"
```

### GSM Intelligence

```
"Scan for GSM cells"
"Check for IMSI catchers"
"What cellular towers are nearby?"
```

### Network Ops (Requires Approval)

```
"Deauth clients from SSID 'TargetNetwork'"
→ Approval dialog appears
→ Shows attack details
→ Must click "Approve & Execute"
```

## 🎯 How It Works

### 1. You Type Natural Language

```
Operator: "Find WiFi APs near my GPS position"
```

### 2. Agent Understands & Plans

```
Agent thinks:
- Need GPS coordinates → call gps_get_position()
- Need WiFi scan → call kismet_scan_wifi()
- Cross-reference both
```

### 3. Agent Executes MCP Tools

```
[Calling hackrf_spectrum_scan...]
[Calling gps_get_position...]
[Calling kismet_find_aps_near_gps...]
```

### 4. You See Streaming Results

```
Agent: "I found 12 WiFi access points within 500m:
- SSID: TrainingNet, Signal: -45 dBm, Distance: 120m
- SSID: OPFOR-MESH, Signal: -67 dBm, Distance: 380m
..."
```

## 🔒 Safety Features

### Human-in-the-Loop

All attack tools require explicit approval:

1. Agent requests: "Execute bettercap_wifi_deauth"
2. **Dialog appears** showing:
    - Tool name
    - Target BSSID/arguments
    - Attack category (red badge)
    - Warning message
3. You must click **"Approve & Execute"**
4. Agent proceeds only if approved

### Tool Categories

- 🔴 **WIFI_DISRUPTION** - Always requires approval
- 🟠 **NETWORK_ATTACK** - Always requires approval
- 🟡 **RECONNAISSANCE** - Auto-approved (passive)
- 🟢 **MONITORING** - Auto-approved (read-only)

## 🌐 Online vs Offline

### Claude (Online)

- **Pros**: Smarter, faster, better understanding
- **Cons**: Needs internet, API costs, data leaves device
- **Use When**: All deployments (online connectivity required)

## 🛠 Available MCP Tools

### HackRF (SDR)

- `hackrf_spectrum_scan` - Frequency sweep
- `hackrf_get_status` - Device info
- `hackrf_stop_scan` - Stop sweep

### GPS

- `gps_get_position` - Current location
- `gps_find_signals_near` - Spatial query

### Kismet (WiFi)

- `kismet_scan_wifi` - Network scan
- `kismet_get_device_details` - Device info
- `kismet_find_aps_near_gps` - Location-based

### Bettercap (Network)

- `bettercap_scan_network` - Host discovery
- `bettercap_wifi_deauth` - 🔴 Deauth attack

### GSM Evil

- `gsm_scan_cells` - Cell tower scan
- `gsm_detect_imsi_catcher` - Threat analysis

## 📊 Check Status

```bash
# Is agent online?
curl http://localhost:5173/api/agent/status

# What tools are available?
curl http://localhost:5173/api/mcp
```

## ⚡ Keyboard Shortcuts

| Key             | Action              |
| --------------- | ------------------- |
| `Ctrl + ``      | Toggle terminal     |
| `Escape`        | Close agent panel   |
| `Enter`         | Send message        |
| `Shift + Enter` | New line in message |

## 🐛 Troubleshooting

### "Agent unavailable"

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Or add to .env file
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
```

### Agent responds slowly

- Claude API typically responds in <500ms
- Check internet connectivity
- Verify RPi 5 isn't running heavy background tasks

### Tool calls fail

- Check Argos services are running (HackRF, Kismet, etc.)
- Verify API endpoints: `curl http://localhost:5173/api/hackrf/status`
- Check logs in browser console

### Chat won't send

- Check LLM provider status (top right badge)
- Green = online, red = offline
- Click badge to see details

## 🎮 Tactical Scenarios

### Scenario: Quick Recon

```
"Scan 2.4 GHz WiFi and GPS position"
→ Agent executes both in parallel
→ Results appear in real-time
→ Tactical map auto-updates
```

### Scenario: Threat Hunt

```
"Check for IMSI catchers and rogue WiFi APs"
→ Agent runs GSM + WiFi scans
→ Correlates anomalies
→ Highlights threats
```

### Scenario: Precision Strike

```
"Deauth all clients from BSSID AA:BB:CC:DD:EE:FF"
→ Approval dialog: "WIFI_DISRUPTION - 10 deauth frames"
→ Click approve
→ Bettercap executes
→ Results streamed back
```

## 📖 Full Documentation

See `docs/AG-UI-INTEGRATION.md` for:

- Complete architecture diagrams
- All event types
- API reference
- Security considerations
- Performance tuning

---

**Questions?**

- Integration guide: `docs/AG-UI-INTEGRATION.md`
- AG-UI protocol: https://github.com/ag-ui-protocol/ag-ui
- MCP protocol: https://modelcontextprotocol.io/

**Status**: ✅ Ready to use
**Next**: Click the agent icon and start chatting!
