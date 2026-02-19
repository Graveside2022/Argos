# MCP Server Development & Usage

This file provides specific context for working with the Model Context Protocol (MCP) servers in `src/lib/server/mcp/`.

## 🛠️ Active MCP Servers

| Server                  | Purpose                         | Key Tools                                  |
| :---------------------- | :------------------------------ | :----------------------------------------- |
| **system-inspector**    | Health, Docker, Memory          | `get_system_health`, `check_docker_status` |
| **hardware-debugger**   | RF Device Locks (HackRF/Kismet) | `scan_usb_devices`, `check_resource_locks` |
| **streaming-inspector** | SSE/WebSocket Debugging         | `inspect_stream_status`                    |
| **database-inspector**  | SQLite R-tree/Schema            | `get_table_schema`, `execute_read_query`   |
| **api-debugger**        | Endpoint Testing                | `test_endpoint`                            |
| **gsm-evil**            | GSM Monitoring                  | `scan_towers`, `capture_imsi`              |
| **svelte**              | Component Docs & Fixes          | `svelte-autofixer`, `get-documentation`    |

## ⚡️ Development Rules

1. **Architecture**: Each server runs as a standalone process via `npx tsx`.
    - **NO** importing SvelteKit internals (runs outside Kit context).
    - **NO** shared state between servers.
2. **Communication**: All servers communicate via HTTP API to `localhost:5173`.
3. **Security**: All requests require `ARGOS_API_KEY` (min 32 chars).
4. **Resource Limits**: ~30 processes total. ~800MB RAM usage.

## 🔍 Troubleshooting

- **Stream Failures**: Check `streaming-inspector`.
- **Device Conflicts**: Check `hardware-debugger` for USB locks.
- **High Latency**: Use `system-inspector` to check load.
