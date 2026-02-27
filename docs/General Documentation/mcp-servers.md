# Argos MCP Servers

**Diagnostic Model Context Protocol servers for tactical RF intelligence**

Argos ships with 7 specialized diagnostic MCP servers (11 server + helper files total) that expose system diagnostics, hardware debugging, and RF/network analysis capabilities to Claude Code. Each server is purpose-aligned, independently deployable, and production-ready.

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
    ┌────┴──────────────────────────────────────────────────────────┐
    │                                                                │
┌───┴────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐│
│ Hardware   │  │ System   │  │Streaming │  │Database│  │  API   ││
│ Debugger   │  │Inspector │  │Inspector │  │Inspector│ │Debugger││
└────┬───────┘  └────┬─────┘  └────┬─────┘  └────┬───┘  └────┬───┘│
     │               │              │             │           │    │
     └───────────────┴──────────────┴─────────────┴───────────┘    │
                                    │                              │
                          ┌─────────┴──────┐                       │
                          │                │                       │
                     ┌────┴──────┐   ┌─────┴─────┐                │
                     │   Test    │   │ GSM Evil  │                │
                     │  Runner   │   │  Server   │                │
                     └────┬──────┘   └─────┬─────┘                │
                          │                │                       │
                          └────────┬───────┘                       │
                                   │                               │
                            ┌──────┴──────┐                        │
                            │  Argos API  │  (localhost:5173)      │
                            │  HTTP Auth  │                        │
                            └──────┬──────┘                        │
                                   │                               │
         ┌─────────────────────────┼───────────────────────────────┘
         │                         │                 │
    ┌────┴────┐              ┌─────┴─────┐    ┌─────┴─────┐
    │ HackRF  │              │  Kismet   │    │ GSM Evil  │
    │Hardware │              │ WiFi Scan │    │  Monitor  │
    └─────────┘              └───────────┘    └───────────┘
```

**Key Design Principles:**

- **Purpose-aligned** - Each server maps to a diagnostic category (system, hardware, streaming, database, API, testing, RF operations)
- **Isolated failure** - One server crash doesn't affect others
- **Modular activation** - Enable only needed servers to save RPi resources
- **Shared authentication** - All servers use ARGOS_API_KEY for HTTP API calls

## Server Catalog

### 1. Hardware Debugger (`argos-hardware-debugger`)

**Purpose:** Unified HackRF/Kismet/GPS diagnostics, USB conflict detection, hardware recovery

**Tools (5):**

- `diagnose_hardware` - Complete hardware health check (HackRF, Kismet, GPS) with connection status, conflicts, operational issues, recovery recommendations
- `detect_conflicts` - USB contention, port conflicts, process locks detection
- `suggest_recovery` - Auto-recovery suggestions for failed hardware
- `test_hardware_capability` - Quick capability check without starting full operations
- `quick_hardware_status` - One-line status for all hardware (non-diagnostic)

**Use Cases:**

- **Use FIRST** when investigating hardware problems
- USB resource conflicts between HackRF and WiFi adapter
- GPS connection issues
- Kismet service failures
- Hardware validation before operations

**Critical Rule:** Always run `diagnose_hardware` BEFORE debugging specific hardware issues.

---

### 2. System Inspector (`argos-system-inspector`)

**Purpose:** System health diagnostics, Docker monitoring, memory pressure analysis, service validation

**Tools (5):**

- `diagnose_system` - Complete system health check (Docker status, service health, memory pressure, recent errors, actionable recommendations)
- `check_docker_health` - Container status, resource usage, restart recommendations
- `analyze_memory_pressure` - System memory, Node.js heap, OOM risk, mitigation strategies
- `get_recent_errors` - Aggregated errors from all services (Node.js, Docker, Kismet, systemd)
- `verify_dev_environment` - Dev server (port 5173), Docker, services, hardware detection

**Use Cases:**

- **Use FIRST** for performance issues, crashes, or multi-service errors
- System slowdowns or unexpected behavior
- Docker container misbehavior
- Memory exhaustion investigation
- Development environment validation at session start

**Critical Rule:** Always run `diagnose_system` BEFORE debugging system-level issues.

---

### 3. Streaming Inspector (`argos-streaming-inspector`)

**Purpose:** SSE/WebSocket stream debugging, real-time data validation, throughput analysis

**Tools (3):**

- `inspect_sse_stream` - Monitor live SSE stream, capture events, validate data structure, measure throughput/latency
- `test_sse_connection` - Quick connectivity test (connect, wait for first event, disconnect)
- `list_sse_endpoints` - List all available SSE streaming endpoints with descriptions

**Supported Streams:**

- `/api/hackrf/data-stream` - HackRF spectrum FFT data
- `/api/gsm-evil/intelligent-scan-stream` - GSM tower scan progress
- `/api/rf/data-stream` - RF signal data stream

**Use Cases:**

- HackRF FFT stream not updating
- GSM scan progress not streaming
- WebSocket connection failures
- Data validation and structure debugging

---

### 4. Database Inspector (`argos-database-inspector`)

**Purpose:** SQLite schema inspection, safe read-only queries, spatial index debugging, data integrity

**Tools (5):**

- `inspect_schema` - Database schema (tables, indexes, views), row counts, statistics
- `query_database` - Safe SELECT queries (read-only, automatic LIMIT enforcement, max 1000 rows)
- `analyze_database_health` - Orphaned records, stale data, large tables, missing indexes, data corruption
- `get_recent_activity` - Recent database activity (last N minutes: new signals, active devices, network changes)
- `debug_spatial_index` - R-tree spatial index performance testing, grid-based indexing validation

**Security:**

- **Auto-blocks** INSERT/UPDATE/DELETE queries
- **Max 1000 rows** per query (automatic LIMIT enforcement)
- **Read-only** access for safety

**Use Cases:**

- Database structure exploration before writing queries
- Data integrity validation
- R-tree spatial query debugging ("find signals within N meters")
- Verify data capture is working correctly

---

### 5. API Debugger (`argos-api-debugger`)

**Purpose:** API endpoint testing, connectivity validation, auth/CORS diagnostics

**Tools (3):**

- `test_api_endpoint` - Test specific endpoint connectivity and auth, response time measurement
- `list_api_endpoints` - List all 68 API endpoints organized by category with descriptions
- `diagnose_api_issues` - Common API issues (auth failures, connectivity, CORS, rate limiting)

**API Categories:**

- HackRF, Kismet, GPS, GSM Evil, System, Streaming, Database

**Use Cases:**

- Verify API endpoint is reachable before debugging
- Auth troubleshooting (401 errors)
- CORS and connectivity issues
- Discover available endpoints

---

### 6. Test Runner (`argos-test-runner`)

**Purpose:** Test suite execution, type checking, linting validation

**Tools (3):**

- `run_tests` - Run test suites (unit/integration/e2e/all) with pass/fail status, test counts, failed test details
- `run_typecheck` - TypeScript type checking (svelte-check) with type errors and file locations
- `run_lint` - ESLint checks with errors/warnings and file locations (auto-fix option)

**Use Cases:**

- Verify functionality after code changes
- Type safety validation after TypeScript changes
- Code style validation before commits
- Pre-PR validation

**Critical Rule:** Always run tests BEFORE committing code changes.

---

### 7. GSM Evil Server (`argos-gsm-evil`)

**Purpose:** GSM signal monitoring, IMSI detection, cellular intelligence, tower scanning

**Tools (7):**

- `get_status` - Service state, captured IMSI data, GSMTAP pipeline health
- `start_monitoring` - Acquire HackRF, start grgsm + GsmEvil2 pipeline
- `stop_monitoring` - Graceful shutdown, release hardware
- `scan_towers` - Intelligent band scan (GSM900/DCS1800/ALL) with signal strength, MCC/MNC detection
- `get_imsi_data` - Captured mobile subscriber identities with timestamps and tower info
- `get_frames` - Raw GSM layer 2/3 frames (GSMTAP) for protocol analysis
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

**Critical Rule:** Requires **exclusive HackRF access** (cannot run simultaneously with HackRF spectrum sweeps).

---

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

This generates `~/.claude/mcp.json` with all 7 servers configured.

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
    "argos-hardware-debugger": {
      "command": "npx",
      "args": ["tsx", "/home/kali/Documents/Argos/Argos/src/lib/server/mcp/servers/hardware-debugger.ts"],
      "env": {
        "NODE_ENV": "development",
        "ARGOS_API_URL": "http://localhost:5173",
        "ARGOS_API_KEY": "<your-api-key>"
      }
    },
    "argos-system-inspector": { ... },
    "argos-streaming-inspector": { ... },
    "argos-database-inspector": { ... },
    "argos-api-debugger": { ... },
    "argos-test-runner": { ... },
    "argos-gsm-evil": { ... }
  }
}
```

## Running Servers

### All Servers (Production)

MCP servers start automatically when Claude Code invokes them. No manual startup required.

### Individual Servers (Development/Testing)

```bash
npm run mcp:system           # System health diagnostics
npm run mcp:streaming        # SSE/WebSocket stream debugging
npm run mcp:hardware         # HackRF/Kismet/GPS unified diagnostics
npm run mcp:database         # SQLite schema & query inspection
npm run mcp:api              # API endpoint testing & debugging
npm run mcp:test             # Test suite execution & validation
npm run mcp:gsm-evil         # GSM monitoring & IMSI capture
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
mcp__argos-hardware-debugger__diagnose_hardware
mcp__argos-system-inspector__diagnose_system
mcp__argos-streaming-inspector__inspect_sse_stream
mcp__argos-database-inspector__query_database
mcp__argos-api-debugger__test_api_endpoint
mcp__argos-test-runner__run_tests
mcp__argos-gsm-evil__scan_towers
```

This prevents naming collisions and makes server ownership explicit.

## Usage Workflow

**System-Level Investigation:**

1. **Start with** `system-inspector.diagnose_system` - Get full system health overview
2. **Then** `hardware-debugger.diagnose_hardware` - If hardware issues detected
3. **Then** specific diagnostics based on findings

**Hardware Problems:**

1. **Start with** `hardware-debugger.diagnose_hardware` - Complete hardware check
2. **If conflicts** → `hardware-debugger.detect_conflicts`
3. **For recovery** → `hardware-debugger.suggest_recovery`

**Streaming Issues:**

1. **Test connectivity** → `streaming-inspector.test_sse_connection`
2. **If connected but broken** → `streaming-inspector.inspect_sse_stream`
3. **Validate data structure** and throughput

**Database Queries:**

1. **Explore schema first** → `database-inspector.inspect_schema`
2. **Run safe queries** → `database-inspector.query_database`
3. **Validate health** → `database-inspector.analyze_database_health`

**Before Commits:**

1. **Run tests** → `test-runner.run_tests`
2. **Type check** → `test-runner.run_typecheck`
3. **Lint** → `test-runner.run_lint`

## Troubleshooting

### Server won't start

**Symptom:** MCP server fails to connect

**Solutions:**

1. Check Argos app is running: `curl http://localhost:5173/api/health`
2. Verify `ARGOS_API_KEY` in `.env` and MCP config match
3. Check server logs: `npm run mcp:system` (etc.) for error messages
4. Validate config: `cat ~/.claude/mcp.json` or `cat .mcp.json` (ensure paths are correct)

### "Cannot reach Argos" error

**Symptom:** `Error: Cannot reach Argos at http://localhost:5173`

**Solutions:**

1. Start Argos: `npm run dev`
2. Check firewall/network (especially in Docker)
3. For container: Use `http://host.docker.internal:5173` in config

### Hardware not detected

**Symptom:** Hardware tools return "disconnected"

**Solutions:**

1. Run `hardware-debugger.diagnose_hardware` for complete analysis
2. Check USB connections: `lsusb` (should see HackRF, ALFA adapter)
3. Verify Docker USB passthrough: `--device=/dev/bus/usb`
4. Run hardware scan: `curl http://localhost:5173/api/hardware/scan`

### Authentication failures

**Symptom:** `401 Unauthorized` errors

**Solutions:**

1. Verify `ARGOS_API_KEY` is set in `.env`
2. Check MCP config has `ARGOS_API_KEY` in env block
3. Restart MCP servers after updating key
4. Confirm key is at least 32 characters

### MCP servers not appearing in Claude Code

**Symptom:** Servers configured but not showing in MCP manager

**Solutions:**

1. **Check config precedence:** Project `.mcp.json` > `~/.claude.json` project-specific > `~/.claude/mcp.json` global
2. **Update project config:** If `.mcp.json` exists in project root, it overrides all other configs
3. **Restart Claude Code** after config changes
4. **Verify paths** are absolute (host) or relative (container)

## Performance Considerations

**RPi5 Resource Constraints:**

- Total Node.js heap: 1024MB (OOM protection)
- Each MCP server is a separate process (memory overhead)
- **All 7 servers** spawn ~30 processes consuming ~800MB RAM
- **Avoid running 2+ Claude Code instances simultaneously** (each spawns full server set)

**Recommendations:**

- **Field deployment:** All 7 servers (full capabilities)
- **Development:** All 7 servers (diagnostic coverage critical)
- **Multiple Claude instances:** Avoid on RPi5 (memory exhaustion)

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

**Database Security:**

- `database-inspector` is **read-only** (auto-blocks INSERT/UPDATE/DELETE)
- Max 1000 rows per query (prevents memory exhaustion)
- Parameterized queries only (SQL injection protection)

## Development

### Adding New Tools

**1. Edit server file** (e.g., `src/lib/server/mcp/servers/hardware-debugger.ts`):

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
npm run mcp:hardware  # Start server
# In Claude Code: invoke new tool
```

**3. Commit changes:**

```bash
git add src/lib/server/mcp/servers/hardware-debugger.ts
git commit -m "feat(mcp): add new_tool to hardware-debugger"
```

### Creating New Servers

Follow the pattern in `src/lib/server/mcp/servers/`:

1. Create new server file (e.g., `performance-inspector.ts`)
2. Define tools array with MCP tool schema
3. Add npm script in `package.json`: `"mcp:performance": "npx tsx src/lib/server/mcp/servers/performance-inspector.ts"`
4. Update `config-generator.ts` to include new server
5. Document in this file

## Migration from Legacy Servers

**Old (hardware-aligned, deprecated):**

```json
{
  "mcpServers": {
    "argos-tools": { ... },      // Monolithic dynamic server
    "argos-hackrf": { ... },     // Hardware-specific
    "argos-kismet": { ... },     // Hardware-specific
    "argos-gps": { ... },        // Hardware-specific
    "argos-gsm-evil": { ... },   // Kept in new architecture
    "argos-system": { ... }      // Hardware-specific
  }
}
```

**New (diagnostic-aligned, current):**

```json
{
  "mcpServers": {
    "argos-hardware-debugger": { ... },    // 5 tools - unified hardware diagnostics
    "argos-system-inspector": { ... },     // 5 tools - system health
    "argos-streaming-inspector": { ... },  // 3 tools - SSE/WebSocket
    "argos-database-inspector": { ... },   // 5 tools - SQLite
    "argos-api-debugger": { ... },         // 3 tools - API testing
    "argos-test-runner": { ... },          // 3 tools - test execution
    "argos-gsm-evil": { ... }              // 7 tools - GSM operations
  }
}
```

**To migrate:**

```bash
npm run mcp:install-b  # Overwrites old config with diagnostic servers
```

**Key Changes:**

- **Hardware consolidation:** HackRF/Kismet/GPS tools → `hardware-debugger` (unified diagnostics)
- **Purpose alignment:** System monitoring → `system-inspector`, API testing → `api-debugger`, etc.
- **Diagnostic focus:** Servers now organized by diagnostic category, not hardware type

## References

- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [Argos Security Architecture](./security-architecture.md)
- [Hardware Integration Patterns](./hardware-patterns.md)
- [Deployment Guide](./deployment.md)

## Support

**Issues:** https://github.com/Graveside2022/Argos/issues
**Docs:** `/docs` directory in Argos repository
