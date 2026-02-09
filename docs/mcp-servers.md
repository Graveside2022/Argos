# Argos MCP Servers

**Modular Model Context Protocol servers for tactical RF intelligence**

Argos ships with 5 specialized MCP servers that expose RF/network analysis capabilities to Claude Code. Each server is hardware-aligned, independently deployable, and production-ready.

## Architecture

```
┌─────────────────┐
│  Claude Code    │
└────────┬────────┘
         │
    ┌────┴────┐
    │  MCP    │  (Model Context Protocol)
    └────┬────┘
         │
    ┌────┴─────────────────────────────────────┐
    │                                           │
┌───┴──────┐  ┌────────┐  ┌─────┐  ┌────────┐ │  ┌────────┐
│ HackRF   │  │Kismet  │  │ GPS │  │GSM Evil│ │  │System  │
│ Server   │  │Server  │  │Serv.│  │Server  │ │  │Server  │
└────┬─────┘  └────┬───┘  └──┬──┘  └────┬───┘ │  └────┬───┘
     │             │         │          │     │       │
     └─────────────┴─────────┴──────────┴─────┴───────┘
                           │
                    ┌──────┴──────┐
                    │  Argos API  │  (localhost:5173)
                    │  HTTP Auth  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌─────┴─────┐    ┌─────┴─────┐
    │ HackRF  │      │  Kismet   │    │ GSM Evil  │
    │Hardware │      │ WiFi Scan │    │  Monitor  │
    └─────────┘      └───────────┘    └───────────┘
```

**Key Design Principles:**

- **Hardware-aligned** - Each server maps to a physical device or subsystem
- **Isolated failure** - One server crash doesn't affect others
- **Modular activation** - Enable only needed servers to save RPi resources
- **Shared authentication** - All servers use ARGOS_API_KEY for HTTP API calls

## Server Catalog

### 1. HackRF Server (`argos-hackrf`)

**Purpose:** HackRF One SDR control and RF spectrum analysis

**Tools:**

- `get_status` - Hardware connection state, frequency, sample rate
- `start_sweep` - Begin spectrum scanning (multi-range, configurable cycle time)
- `stop_sweep` - Graceful halt of active sweep
- `emergency_stop` - Force-kill all HackRF processes
- `get_spectrum_data` - FFT power levels, frequency bins, signal peaks

**API Endpoints:**

- `/api/hackrf/status`
- `/api/hackrf/start-sweep`
- `/api/hackrf/stop-sweep`
- `/api/hackrf/emergency-stop`

**Use Cases:**

- Tactical spectrum mapping (900MHz, 2.4GHz, 5GHz bands)
- Signal detection and characterization
- Real-time FFT visualization for Claude analysis

---

### 2. Kismet Server (`argos-kismet`)

**Purpose:** WiFi scanning, device tracking, network intelligence

**Tools:**

- `get_status` - Service state, device count, interface, uptime
- `start_service` - Auto-detect ALFA adapter, start monitor mode
- `stop_service` - Graceful shutdown, cleanup monitor interfaces
- `get_devices` - Active WiFi devices (MAC, SSID, signal, encryption, location)
- `get_device_details` - Full device profile by MAC/SSID
- `analyze_security` - Encryption assessment (CRITICAL/HIGH/MEDIUM/LOW risk)

**API Endpoints:**

- `/api/kismet/status`
- `/api/kismet/control` (start/stop actions)
- `/api/kismet/devices`

**Use Cases:**

- WiFi network enumeration
- Rogue AP detection (evil twin analysis)
- WEP/WPA2 vulnerability assessment
- Device tracking over time

---

### 3. GPS Server (`argos-gps`)

**Purpose:** GPS positioning, location-based signal queries

**Tools:**

- `get_position` - Lat/lon, altitude, speed, heading, accuracy, satellite count, fix quality
- `get_nearby_signals` - R-tree spatial query for signals within radius
- `query_signal_history` - Temporal signal patterns (device tracking over time)

**API Endpoints:**

- `/api/gps/position`
- `/api/signals` (spatial queries)

**Use Cases:**

- Geolocation of RF emitters
- Drive-by signal mapping
- Tactical intelligence (correlate signals with GPS tracks)
- R-tree indexed spatial queries (O(log N) performance)

---

### 4. GSM Evil Server (`argos-gsm-evil`)

**Purpose:** GSM signal monitoring, IMSI detection, cellular intelligence

**Tools:**

- `get_status` - Service state, captured IMSI data, GSMTAP health
- `start_monitoring` - Acquire HackRF, start grgsm + GsmEvil2 pipeline
- `stop_monitoring` - Graceful shutdown, release hardware
- `scan_towers` - Intelligent band scan (GSM900/DCS1800/ALL)
- `get_imsi_data` - Captured mobile subscriber identities
- `get_frames` - Raw GSM layer 2/3 frames (GSMTAP)
- `get_activity` - Timeline of IMSI captures, tower changes, channel activity

**API Endpoints:**

- `/api/gsm-evil/status`
- `/api/gsm-evil/control` (start/stop actions)
- `/api/gsm-evil/scan`
- `/api/gsm-evil/imsi-data`
- `/api/gsm-evil/frames`
- `/api/gsm-evil/activity`

**Use Cases:**

- IMSI catcher detection
- GSM tower enumeration
- Mobile subscriber tracking
- Cellular protocol analysis

---

### 5. System Server (`argos-system`)

**Purpose:** System monitoring, hardware scanning, infrastructure diagnostics

**Tools:**

- `get_stats` - CPU, memory, hostname, uptime, process health (RPi5 monitoring)
- `scan_hardware` - Detect all RF/network hardware (SDR, WiFi, GPS, cellular, serial)
- `scan_installed_tools` - Enumerate 90+ OFFNET/ONNET tools (Docker/native/systemd)
- `get_cell_towers` - OpenCellID tower lookup (LTE/GSM/UMTS, MCC/MNC, LAC, cell ID)

**API Endpoints:**

- `/api/system/stats`
- `/api/hardware/scan`
- `/api/tools/scan`
- `/api/cell-towers/nearby`

**Use Cases:**

- RPi5 resource monitoring (OOM protection context)
- Hardware auto-detection and validation
- Tool availability checking (what's installed?)
- Cellular infrastructure mapping

## Installation

### Automatic (Recommended)

**Host environment:**

```bash
npm run mcp:install-b
```

**Docker container:**

```bash
npm run mcp:install-c
```

This generates `~/.claude/mcp.json` with all 5 servers configured.

### Manual Configuration

**1. Generate config:**

```bash
npm run mcp:config-b  # Host
npm run mcp:config-c  # Container
```

**2. Copy output to `~/.claude/mcp.json`**

**3. Restart Claude Code**

### Configuration Format

```json
{
  "mcpServers": {
    "argos-hackrf": {
      "command": "npx",
      "args": ["tsx", "/app/src/lib/server/mcp/servers/hackrf-server.ts"],
      "env": {
        "NODE_ENV": "development",
        "ARGOS_API_URL": "http://localhost:5173",
        "ARGOS_API_KEY": "<your-api-key>"
      }
    },
    "argos-kismet": { ... },
    "argos-gps": { ... },
    "argos-gsm-evil": { ... },
    "argos-system": { ... }
  }
}
```

## Running Servers

### All Servers (Production)

MCP servers start automatically when Claude Code invokes them. No manual startup required.

### Individual Servers (Development/Testing)

```bash
npm run mcp:hackrf      # HackRF server only
npm run mcp:kismet      # Kismet server only
npm run mcp:gps         # GPS server only
npm run mcp:gsm-evil    # GSM Evil server only
npm run mcp:system      # System server only
```

**Note:** Servers communicate with Argos via HTTP API, so ensure `npm run dev` is running.

## Docker Integration

MCP servers are **shipped with the Docker container** and require no additional installation.

### Container Configuration

**1. MCP servers use `~/.claude/mcp.json` inside container**

- Host: `~/.claude/mcp.json`
- Container: `/root/.claude/mcp.json` (volume mount)

**2. API URL for container:**

```json
"ARGOS_API_URL": "http://host.docker.internal:5173"
```

(Container connects to host-side Argos app)

**3. Volume mount (already configured in docker-compose):**

```yaml
volumes:
    - ${HOME}/.claude:/root/.claude:rw
```

## Authentication

All MCP servers authenticate with Argos API using `ARGOS_API_KEY`.

**Requirements:**

- `ARGOS_API_KEY` must be set in `.env` (min 32 chars)
- Same key used for all servers (shared authentication)
- Key validated on every API call (fail-closed security)

**Generate key:**

```bash
openssl rand -hex 32
```

## Tool Namespacing

Tools are namespaced by server for clarity:

```
mcp__argos-hackrf__get_status
mcp__argos-kismet__get_devices
mcp__argos-gps__get_position
mcp__argos-gsm-evil__scan_towers
mcp__argos-system__scan_hardware
```

This prevents naming collisions and makes server ownership explicit.

## Troubleshooting

### Server won't start

**Symptom:** MCP server fails to connect

**Solutions:**

1. Check Argos app is running: `curl http://localhost:5173/api/health`
2. Verify `ARGOS_API_KEY` in `.env` and MCP config match
3. Check server logs: `npm run mcp:hackrf` (etc.) for error messages
4. Validate config: `cat ~/.claude/mcp.json` (ensure paths are correct)

### "Cannot reach Argos" error

**Symptom:** `Error: Cannot reach Argos at http://localhost:5173`

**Solutions:**

1. Start Argos: `npm run dev`
2. Check firewall/network (especially in Docker)
3. For container: Use `http://host.docker.internal:5173` in config

### Hardware not detected

**Symptom:** HackRF/Kismet tools return "disconnected"

**Solutions:**

1. Check USB connections: `lsusb` (should see HackRF, ALFA adapter)
2. Verify Docker USB passthrough: `--device=/dev/bus/usb`
3. Run hardware scan: `curl http://localhost:5173/api/hardware/scan`
4. Check hardware manager logs in Argos

### Authentication failures

**Symptom:** `401 Unauthorized` errors

**Solutions:**

1. Verify `ARGOS_API_KEY` is set in `.env`
2. Check MCP config has `ARGOS_API_KEY` in env block
3. Restart MCP servers after updating key
4. Confirm key is at least 32 characters

## Performance Considerations

**RPi5 Resource Constraints:**

- Total Node.js heap: 1024MB (OOM protection)
- Each MCP server is a separate process (memory overhead)
- Enable only needed servers to conserve resources

**Recommendations:**

- **Field deployment:** All 5 servers (full capabilities)
- **Development:** Only active servers (e.g., just HackRF during spectrum work)
- **Low memory:** Disable unused servers in `~/.claude/mcp.json`

## Security

**Authentication:**

- Fail-closed design (no API key = no access)
- HMAC session cookies for browser, X-API-Key header for programmatic
- All `/api/*` routes protected except `/api/health`

**Input Validation:**

- All user inputs sanitized (Phase 2.1.2 shell injection elimination)
- Frequency bounds checking (800-6000 MHz)
- PID validation (1-4194304, Linux pid_max)
- Interface name regex (`/^[a-zA-Z0-9_-]{1,15}$/`)

**Rate Limiting:**

- Hardware endpoints: Token bucket algorithm
- Body limits: 64KB hardware, 10MB general
- Pattern: `/api/(hackrf|kismet|gsm-evil|rf)/`

## Development

### Adding New Tools

**1. Edit server file** (e.g., `src/lib/server/mcp/servers/hackrf-server.ts`):

```typescript
{
  name: 'new_tool',
  description: 'Tool description',
  inputSchema: {
    type: 'object' as const,
    properties: {
      param: { type: 'string', description: 'Parameter description' }
    },
    required: ['param']
  },
  execute: async (args: Record<string, unknown>) => {
    const resp = await apiFetch('/api/new-endpoint');
    return await resp.json();
  }
}
```

**2. Test:**

```bash
npm run mcp:hackrf  # Start server
# In Claude Code: invoke new tool
```

**3. Commit changes:**

```bash
git add src/lib/server/mcp/servers/hackrf-server.ts
git commit -m "feat(mcp): add new_tool to HackRF server"
```

### Creating New Servers

Follow the pattern in `src/lib/server/mcp/servers/`:

1. Extend `BaseMCPServer` class
2. Define `serverName` and `tools` array
3. Add npm script in `package.json`
4. Update `config-generator.ts` to include new server
5. Document in this file

## Migration from Legacy Server

**Old (monolithic):**

```json
{
  "mcpServers": {
    "argos-tools": { ... }  // All 12 tools in one server
  }
}
```

**New (modular):**

```json
{
  "mcpServers": {
    "argos-hackrf": { ... },    // 5 tools
    "argos-kismet": { ... },    // 6 tools
    "argos-gps": { ... },       // 3 tools
    "argos-gsm-evil": { ... },  // 7 tools
    "argos-system": { ... }     // 4 tools
  }
}
```

**To migrate:**

```bash
npm run mcp:install-b  # Overwrites old config with modular servers
```

**Backward compatibility:** The legacy `dynamic-server.ts` remains for compatibility but is deprecated.

## References

- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [Argos Security Architecture](./security-architecture.md)
- [Hardware Integration Patterns](./hardware-patterns.md)
- [Deployment Guide](./deployment.md)

## Support

**Issues:** https://github.com/Graveside2022/Argos/issues
**Docs:** `/docs` directory in Argos repository
