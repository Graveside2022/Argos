---
title: 'Tactical AI Kill Chain Framework'
slug: 'tactical-ai-killchain'
created: '2026-03-02'
updated: '2026-03-02'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['python3', 'typescript-strict', 'better-sqlite3', 'claude-code-cli', 'zod']
files_to_modify:
    - 'NEW: src/lib/server/db/migrations/004_add_tactical_tables.sql'
    - 'NEW: tactical/CLAUDE.md'
    - 'NEW: tactical/modules/base_module.py'
    - 'NEW: tactical/modules/wifi_recon.py'
    - 'NEW: tactical/modules/wifi_deauth.py'
    - 'NEW: tactical/modules/wifi_handshake.py'
    - 'NEW: tactical/modules/port_scanner.py'
    - 'NEW: tactical/modules/ssh_bruter.py'
    - 'NEW: tactical/modules/ftp_bruter.py'
    - 'NEW: tactical/modules/mysql_bruter.py'
    - 'NEW: tactical/modules/postgresql_bruter.py'
    - 'NEW: tactical/modules/dns_scanner.py'
    - 'NEW: tactical/modules/device_identifier.py'
    - 'NEW: tactical/modules/web_bruter.py'
    - 'NEW: tactical/modules/ssl_scanner.py'
    - 'NEW: tactical/modules/net_discover.py'
    - 'NEW: tactical/modules/vuln_scanner.py'
    - 'NEW: tactical/modules/responder_poisoner.py'
    - 'NEW: tactical/modules/module_runner.ts'
    - 'NEW: tactical/workflows/00_recon_only.md'
    - 'NEW: tactical/workflows/01_wifi_killchain.md'
    - 'NEW: tactical/workflows/02_network_survey.md'
    - 'NEW: tactical/workflows/03_service_exploitation.md'
    - 'NEW: tactical/workflows/04_credential_harvest.md'
code_patterns:
    - 'execFileAsync() for safe subprocess execution (no shell injection)'
    - 'DB migration runner: SQL files in src/lib/server/db/migrations/, auto-applied on startup'
    - 'createTool() factory for static tool definitions (offnet-attack-wifi.ts)'
    - 'Existing Kismet integration pipes WiFi devices into rf_signals.db'
    - 'Artemis ArtemisBase module pattern: structured JSON output, CLI tool wrapping'
    - 'PentAGI agent delegation: markdown workflows guiding Claude Code reasoning'
test_patterns:
    - 'vitest for unit tests (src/**/*.test.ts)'
    - 'integration tests in tests/integration/'
    - 'security tests in tests/security/'
---

# Tech-Spec: Tactical AI Kill Chain Framework

**Created:** 2026-03-02
**Updated:** 2026-03-02

## Overview

### Problem Statement

Argos has 85+ offensive tools defined as static taxonomy entries (`src/lib/data/offnet-*.ts`, `onnet.ts`) but zero execution infrastructure. Only 14 tools are installed, and none have execution handlers. Operators must manually chain CLI tools in a separate terminal — there is no autonomous attack loop, no campaign tracking, and no structured workflow execution.

Meanwhile, two mature open-source projects solve parts of this problem:

- **PentAGI** ([vxcontrol/pentagi](https://github.com/vxcontrol/pentagi)) — a fully autonomous multi-agent pentesting system with 6 specialized AI agents, 35 registered tools, and ~200 bundled CLI tools running in Docker-sandboxed containers. Its architecture uses a Go backend, PostgreSQL+pgvector, Neo4j knowledge graph, and 15 Docker services.
- **Artemis** ([CERT-Polska/Artemis](https://github.com/CERT-Polska/Artemis)) — a modular vulnerability scanner with 30+ scanning modules, 30 reporter modules, and 8 extra modules, built on the Karton distributed task framework with MongoDB and Redis.

Neither can run as-is on RPi 5 (8GB RAM, no Docker overhead budget). But their **modules and patterns** can be extracted and integrated natively with Claude Code as the orchestrating agent.

### Solution

Build a **tactical execution layer** that integrates real modules from PentAGI and Artemis, with Claude Code as the orchestrating brain (replacing PentAGI's 6-agent Go backend). This consists of:

1. **Extracted Artemis modules** — Standalone Python scripts adapted from Artemis's Karton-based scanners. The `ArtemisBase` framework dependency is replaced by a lightweight `base_module.py` that provides logging, JSON output, and DB logging. Modules retain their core scanning logic (paramiko for SSH, pymysql for MySQL, subprocess calls for CLI tools).

2. **PentAGI CLI tool wrappers** — Python modules wrapping the same CLI tools PentAGI bundles in its `vxcontrol/kali-linux` Docker image. Most are already installed on Kali (nmap, masscan, hydra, tshark, responder, netdiscover, sqlmap, nikto, gobuster, ffuf). For tools not installed (nuclei, subfinder, naabu, fingerprintx), we install them via `go install` or apt.

3. **Argos-native WiFi modules** — Custom modules for WiFi-specific attacks (aireplay-ng, wifite2, mdk4) that PentAGI lacks entirely (it has no WiFi/RF capability since it runs in Docker without USB passthrough).

4. **PentAGI-style markdown workflows** — Step-by-step kill chain guides that Claude Code reads and follows autonomously. These replace PentAGI's 6-agent delegation system with a single Claude Code agent following structured playbooks.

5. **Tactical database schema** — Campaign/engagement/module_runs tables in `rf_signals.db`, enabling joins between Kismet-discovered targets and tactical operations.

**Architecture**: Claude Code (brain) → Markdown Workflows (PentAGI pattern) → Extracted Modules (Artemis + PentAGI + Argos) → Local Hardware (HackRF/Alfa/GPS) + Native CLI Tools

**Operator workflow**: Open Argos dashboard → view targets → Terminal tab → `claude --dangerously-skip-permissions` → tell Claude to execute a workflow against a target.

### Scope

**In Scope (Phase 1 — WiFi/Network Focus, 19 modules):**

From Artemis (extracted standalone, Karton dependency removed):

- `port_scanner.py` — wraps nmap (Artemis uses naabu; we use nmap since it's installed)
- `ssh_bruter.py` — pure paramiko, trivial extraction
- `ftp_bruter.py` — pure ftplib, trivial extraction
- `mysql_bruter.py` — pure pymysql, trivial extraction
- `postgresql_bruter.py` — pure psycopg2, trivial extraction
- `dns_scanner.py` — pure dnspython, zone transfer detection
- `device_identifier.py` — HTTP response inspection for FortiOS/PaloAlto
- `web_bruter.py` — web path enumeration (directory/file brute-forcing)
- `ssl_scanner.py` — certificate validation + Heartbleed via sslyze

From PentAGI's CLI bundle (wrappers for already-installed Kali tools):

- `net_discover.py` — wraps netdiscover for ARP host discovery
- `vuln_scanner.py` — wraps nmap scripts + nuclei templates
- `responder_poisoner.py` — wraps responder for LLMNR/NBT-NS poisoning

Argos-native WiFi modules (not in PentAGI or Artemis):

- `wifi_recon.py` — queries Kismet data from rf_signals.db
- `wifi_deauth.py` — wraps aireplay-ng
- `wifi_handshake.py` — wraps wifite2 for WPA handshake capture

Infrastructure:

- `base_module.py` — shared base class replacing Artemis's ArtemisBase
- `module_runner.ts` — TypeScript orchestrator with DB logging
- DB migration for campaigns/engagements/module_runs tables
- `tactical/CLAUDE.md` — agent context file

Workflows (5):

- `00_recon_only.md` — passive WiFi/network enumeration
- `01_wifi_killchain.md` — WiFi deauth + handshake capture chain
- `02_network_survey.md` — full network discovery (ARP + port scan + service ID)
- `03_service_exploitation.md` — service-specific credential bruting chain
- `04_credential_harvest.md` — responder + credential capture chain

**Out of Scope:**

- PentAGI's Go backend, React frontend, PostgreSQL, Neo4j, Docker orchestration
- Artemis's Karton framework, MongoDB, Redis task queue
- PentAGI's 6-agent system (Claude Code replaces all 6 roles)
- Non-WiFi/network modules (RF jamming, GSM IMSI, cellular, Bluetooth) — future specs
- Metasploit/Impacket/Empire integration — future spec (complex, Windows-focused)
- Terminal tab or Agent Chat modifications
- UI changes to the Argos dashboard

## Context for Development

### Source Project Analysis

#### PentAGI Architecture (what we extract)

PentAGI's value for Argos is its **CLI tool curation** and **agent reasoning patterns**, not its infrastructure:

- **CLI tools**: ~200 tools installed in `vxcontrol/kali-linux` Docker image. Most already on Kali. The missing ProjectDiscovery suite (nuclei, subfinder, naabu, fingerprintx) should be installed.
- **Agent roles replaced by Claude Code**: pentester (→ Claude follows workflow), coder (→ Claude writes scripts), maintenance/devops (→ Claude manages env), searcher (→ Claude uses web search), memorist (→ Claude uses memory files), adviser (→ Claude self-reasons).
- **Tool registry pattern** (`registry.go`): 35 tools registered with JSON schema descriptions. We replicate this as the module inventory in `tactical/CLAUDE.md`.
- **Terminal execution** (`terminal.go`): Sandboxed Docker exec. We replace with direct `subprocess.run()` since Argos is native.
- **Memory system** (pgvector + Neo4j): We replace with SQLite `module_runs` table + Claude Code's auto-memory.

**Key PentAGI absence**: Zero WiFi/RF tools. No aircrack-ng, no Kismet, no monitor-mode support. Docker containers can't access USB WiFi adapters. This is the gap Argos fills.

#### Artemis Architecture (what we extract)

Artemis's value is its **module implementations** — battle-tested scanning logic used by CERT Poland at national scale:

- **Module pattern**: Each module extends `ArtemisBase` (Karton), accepts typed tasks, calls CLI tools or Python libraries, outputs structured results. We keep the scanning logic, replace `ArtemisBase` with our `base_module.py`.
- **Extraction difficulty by module**:
    - **Trivial** (5): ssh_bruter, ftp_bruter, mysql_bruter, postgresql_bruter, device_identifier — pure Python, 15-20 lines of core logic each
    - **Easy** (3): dns_scanner, bruter (web paths), reverse_dns_lookup — pure Python with dnspython/requests
    - **Moderate** (2): port_scanner (subprocess to naabu→nmap), ssl_checks (sslyze + chromium headless)
    - **Hard** (1): nuclei wrapper (complex template management, DAST fuzzing — use nuclei CLI directly instead)
- **Karton removal**: Replace `self.log` → Python logging, `self.db.save_task_result()` → SQLite insert, `self.add_task()` → JSON stdout, `self.http_get()` → requests.get(), `self.throttle_request()` → time.sleep(), `self.cache` → no-op or dict.

### Tool Availability on Kali (verified)

**Already installed:**
| Tool | Path | Used By |
|------|------|---------|
| nmap | /usr/bin/nmap | port_scanner, vuln_scanner |
| masscan | /usr/bin/masscan | port_scanner (fast mode) |
| hydra | /usr/bin/hydra | credential bruting (alternative to Artemis pure-Python bruters) |
| ncrack | /usr/bin/ncrack | network auth cracking |
| tshark | /usr/bin/tshark | packet capture/analysis |
| responder | /usr/sbin/responder | responder_poisoner |
| netdiscover | /usr/sbin/netdiscover | net_discover |
| sqlmap | /usr/bin/sqlmap | SQL injection (future) |
| nikto | /usr/bin/nikto | web vuln scanning (future) |
| gobuster | /usr/bin/gobuster | web_bruter |
| ffuf | /usr/bin/ffuf | web_bruter (alternative) |
| httpx | /usr/bin/httpx | HTTP probing |
| aireplay-ng | aircrack-ng suite | wifi_deauth |
| wifite2 | /usr/bin/wifite | wifi_handshake |

**Python libraries (already installed via pip):**
paramiko, pymysql, psycopg2, scapy, shodan, dnspython, sslyze, beautifulsoup4

**Need to install (ProjectDiscovery Go suite):**
| Tool | Install Method | Used By |
|------|---------------|---------|
| nuclei | `go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest` | vuln_scanner |
| subfinder | `go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest` | future subdomain enum |
| naabu | `go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest` | port_scanner (optional, nmap fallback) |
| fingerprintx | `go install github.com/praetorian-inc/fingerprintx/cmd/fingerprintx@latest` | service fingerprinting |

### Codebase Patterns

- **Service pattern**: Singleton services in `src/lib/server/services/` wrapping native CLI tools via `execFileAsync()` from `src/lib/server/exec.ts`. No shell injection — argument arrays only.
- **Database pattern**: Direct `better-sqlite3` calls. WAL mode, prepared statement cache. Migrations auto-applied on startup via `runMigrations()`. SQL files in `src/lib/server/db/migrations/`, sorted alphabetically. Idempotent.
- **Tool taxonomy**: 85+ tools defined across `src/lib/data/offnet-*.ts` and `onnet.ts` using `createTool()` factory. 14 marked installed. All `deployment: 'native'` or `'docker'` but no execution handlers.
- **Existing Kismet flow**: Kismet service → devices/signals/networks tables in `rf_signals.db` → WebSocket push to UI.
- **Terminal tab**: `config/vite-plugin-terminal.ts` provides persistent PTY sessions. Operator launches Claude Code directly. No changes needed.

### Database (schema.sql + database.ts)

- **6 tables**: devices, signals, networks, relationships, patterns, pattern_signals
- **3 views**: active_devices (5min), recent_signals (1min), network_summary
- **4 existing migrations**: cleanup features, altitude column, view fix, spatial index
- **Singleton**: `getRFDatabase()` with `.rawDb` accessor
- **DB path**: `./rf_signals.db` (relative to project root)
- **Key for Claude Code**: `sqlite3 ./rf_signals.db "SELECT ..."`

### Technical Decisions

- **Claude Code replaces PentAGI's 6-agent system**: One agent, multiple workflows. Simpler, no Go backend, no Docker orchestration, no pgvector/Neo4j. Claude Code's built-in reasoning + auto-memory replaces the memorist agent. Claude Code's web search replaces the searcher agent. Workflow markdown replaces the adviser agent.
- **Artemis modules extracted without Karton**: Each module becomes a standalone Python script with `base_module.py` providing the shared interface. No Redis, no MongoDB, no task queue. Claude Code is the task router — it reads module output JSON and decides what to run next.
- **nmap over naabu**: Artemis uses ProjectDiscovery's naabu for port scanning. nmap is already installed, more feature-rich, and operators know it. We wrap nmap instead. naabu can be added later as an optional fast-scan alternative.
- **`tactical/` directory at project root**: Modules and workflows live outside SvelteKit `src/`. Python modules don't belong in the TS build. Claude Code can `cd tactical/` and work directly.
- **Hybrid TS + Python**: TypeScript for module_runner.ts (orchestration, codebase pattern). Python for all scanning modules (matches Artemis source, uses Kali's Python ecosystem).
- **Existing DB**: Campaign/engagement tables via migration into `rf_signals.db`. Enables joins with Kismet-discovered devices.
- **Module output contract**: ALL modules output exactly one JSON object to stdout. Stderr for logs. Exit 0 = success, exit 1 = error (still valid JSON).

## Implementation Plan

### Tasks

#### Phase 1: Foundation (dependency: none)

- [ ] Task 1: Create tactical database migration
    - File: `src/lib/server/db/migrations/004_add_tactical_tables.sql`
    - Action: Create three tables in `rf_signals.db`:
        - `campaigns` (id, name, status, target_description, created_at, updated_at, notes)
        - `engagements` (id, campaign_id FK, module_name, target, parameters JSON, status, result JSON, started_at, completed_at, error_message)
        - `module_runs` (id, engagement_id FK nullable, module_name, args JSON, exit_code, stdout TEXT, stderr TEXT, duration_ms, ran_at)
    - Notes: `IF NOT EXISTS`. Indexes on status, campaign_id, engagement_id. Status enums: campaigns (active/completed/abandoned), engagements (planned/active/success/failure/aborted).

- [ ] Task 2: Create directory structure
    - Files: `tactical/`, `tactical/modules/`, `tactical/workflows/`, `tactical/wordlists/`
    - Notes: `tactical/wordlists/` holds credential lists extracted from Artemis's `data/common_sql_credentials.py`.

- [ ] Task 3: Create base module class
    - File: `tactical/modules/base_module.py`
    - Action: Shared Python base class replacing Artemis's `ArtemisBase`. Provides:
        - `argparse` setup with common args (`--db-path`, `--json`, `--timeout`)
        - Structured JSON output: `output_success(data)`, `output_error(message)`
        - DB logging: `log_run(module_name, args, exit_code, stdout, stderr, duration_ms)`
        - CLI tool execution: `run_tool(binary, args, timeout)` → `subprocess.run()` with capture
        - Input validation helpers (MAC, IP, interface name, port range)
    - Notes: No pip dependencies beyond stdlib + already-installed libs. All modules inherit from this.

- [ ] Task 4: Create TypeScript module runner
    - File: `tactical/modules/module_runner.ts`
    - Action: Orchestrator that runs any Python module, captures output, logs to DB. Claude Code calls this for structured execution with timing and error handling.
    - Notes: Runnable via `npx tsx tactical/modules/module_runner.ts <module> [args...]`

#### Phase 2: WiFi Modules — Argos Native (dependency: Phase 1)

These modules are unique to Argos. PentAGI has zero WiFi capability.

- [ ] Task 5: wifi_recon.py — Query Kismet DB for WiFi targets
    - Source: Custom (queries existing devices/signals/networks tables)
    - CLI deps: none (pure SQLite)
    - Args: `--db-path`, `--min-signal`, `--type` (ap/client/all)
    - Output: `{ status, targets: [{ device_id, mac, type, last_seen, signal_dbm, ssid, encryption, channel }], count }`

- [ ] Task 6: wifi_deauth.py — Deauthentication attack
    - Source: Wraps aireplay-ng (already in Argos taxonomy as `aireplay-ng`)
    - CLI deps: aircrack-ng suite (installed)
    - Args: `--bssid` (required), `--client`, `--interface`, `--count`, `--db-path`
    - Validates monitor mode via `/sys/class/net/{iface}/type` = 803
    - Output: `{ status, target_bssid, frames_sent, duration_ms, raw_output }`

- [ ] Task 7: wifi_handshake.py — WPA handshake capture
    - Source: Wraps wifite2 (already installed, marked in Argos taxonomy)
    - CLI deps: wifite (installed)
    - Args: `--bssid`, `--interface`, `--timeout`, `--output-dir`, `--db-path`
    - Output: `{ status, target_bssid, handshake_file, method, duration_ms }`

#### Phase 3: Artemis-Extracted Modules (dependency: Phase 1)

Extracted from CERT-Polska/Artemis. Karton dependency removed, `base_module.py` used instead.

- [ ] Task 8: port_scanner.py — Port scanning + service fingerprinting
    - Source: Artemis `port_scanner.py` (adapted: nmap instead of naabu)
    - CLI deps: nmap (installed)
    - Args: `--target` (IP or hostname), `--ports` (default top-1000), `--scan-type` (syn/connect/udp), `--db-path`
    - Output: `{ status, target, ports: [{ port, protocol, state, service, version }], scan_time_ms }`

- [ ] Task 9: ssh_bruter.py — SSH credential brute-forcing
    - Source: Artemis `ssh_bruter.py` (nearly verbatim — 20 lines of paramiko)
    - CLI deps: none (pure paramiko)
    - Args: `--host`, `--port` (default 22), `--credentials-file`, `--timeout`, `--db-path`
    - Default credentials: Artemis's 9 pairs (root/root, admin/admin, root/password, etc.)
    - Output: `{ status, host, port, found_credentials: [{ username, password }], attempts }`

- [ ] Task 10: ftp_bruter.py — FTP credential brute-forcing
    - Source: Artemis `ftp_bruter.py` (nearly verbatim — ftplib)
    - CLI deps: none (pure Python ftplib)
    - Args: `--host`, `--port` (default 21), `--credentials-file`, `--db-path`
    - Tests: anonymous access, TLS support, write access, directory listing
    - Output: `{ status, host, port, found_credentials, tls_supported, writable, files_sample }`

- [ ] Task 11: mysql_bruter.py — MySQL credential brute-forcing
    - Source: Artemis `mysql_bruter.py` (nearly verbatim — pymysql)
    - CLI deps: none (pure pymysql)
    - Args: `--host`, `--port` (default 3306), `--credentials-file`, `--db-path`
    - Output: `{ status, host, port, found_credentials, db_version }`

- [ ] Task 12: postgresql_bruter.py — PostgreSQL credential brute-forcing
    - Source: Artemis `postgresql_bruter.py` (nearly verbatim — psycopg2)
    - CLI deps: none (pure psycopg2)
    - Args: `--host`, `--port` (default 5432), `--credentials-file`, `--db-path`
    - Output: `{ status, host, port, found_credentials, db_version }`

- [ ] Task 13: dns_scanner.py — DNS zone transfer + record analysis
    - Source: Artemis `dns_scanner.py` (nearly verbatim — dnspython)
    - CLI deps: none (pure dnspython)
    - Args: `--domain`, `--db-path`
    - Output: `{ status, domain, zone_transfer_possible, nameservers, records, issues }`

- [ ] Task 14: device_identifier.py — Network device fingerprinting
    - Source: Artemis `device_identifier.py` (HTTP response inspection)
    - CLI deps: none (pure requests)
    - Args: `--target` (URL), `--db-path`
    - Identifies: FortiOS, Palo Alto GlobalProtect, generic device info
    - Output: `{ status, target, device_type, details }`

- [ ] Task 15: web_bruter.py — Web path/directory enumeration
    - Source: Artemis `bruter.py` (adapted to also support gobuster/ffuf)
    - CLI deps: gobuster or ffuf (installed), fallback to pure Python requests
    - Args: `--target` (base URL), `--wordlist`, `--extensions`, `--tool` (gobuster/ffuf/python), `--db-path`
    - Output: `{ status, target, found_paths: [{ url, status_code, size }], total_checked }`

- [ ] Task 16: ssl_scanner.py — TLS certificate + vulnerability scanning
    - Source: Artemis `ssl_checks.py` (adapted — sslyze without chromium)
    - CLI deps: none (pure sslyze + cryptography)
    - Args: `--host`, `--port` (default 443), `--db-path`
    - Output: `{ status, host, cert_valid, cert_expiry, cn, san, heartbleed_vulnerable, issues }`

#### Phase 4: PentAGI CLI Tool Wrappers (dependency: Phase 1)

Wrappers for CLI tools from PentAGI's `vxcontrol/kali-linux` tool bundle. These tools are already installed on Kali.

- [ ] Task 17: net_discover.py — ARP-based network host discovery
    - CLI deps: netdiscover (installed)
    - Args: `--interface`, `--range` (CIDR), `--timeout`, `--passive`, `--db-path`
    - Output: `{ status, interface, hosts: [{ ip, mac, vendor }], count, scan_time_ms }`

- [ ] Task 18: vuln_scanner.py — Vulnerability scanning
    - CLI deps: nmap (installed), nuclei (needs install)
    - Args: `--target`, `--scan-type` (nmap-scripts/nuclei/both), `--severity` (info/low/medium/high/critical), `--db-path`
    - Output: `{ status, target, vulnerabilities: [{ id, severity, description, evidence }], count }`
    - Notes: nmap `--script vuln` as baseline. nuclei if installed. Gracefully degrades.

- [ ] Task 19: responder_poisoner.py — LLMNR/NBT-NS/mDNS poisoning
    - CLI deps: responder (installed)
    - Args: `--interface`, `--timeout`, `--analyze-only`, `--db-path`
    - Output: `{ status, interface, captured_hashes: [{ protocol, client_ip, username, hash_type, hash }], duration_ms }`
    - Notes: `--analyze-only` mode for passive hash capture without poisoning.

#### Phase 5: Workflows (dependency: Phases 2-4)

PentAGI-style markdown workflows that Claude Code reads and follows autonomously.

- [ ] Task 20: 00_recon_only.md — Passive reconnaissance
    - Steps: wifi_recon → net_discover (passive) → port_scanner (top-100) → report
    - Rules: No exploitation. Read-only. No monitor mode changes.

- [ ] Task 21: 01_wifi_killchain.md — WiFi deauth + handshake chain
    - Steps: wifi_recon → pre-flight (monitor mode check) → wifi_deauth → wifi_handshake → verify → report
    - Retry logic: re-check target visibility, re-enable monitor mode, increase deauth count
    - Abort conditions: 3 failures, operator interrupt, target gone

- [ ] Task 22: 02_network_survey.md — Full network discovery
    - Steps: net_discover → port_scanner (each host) → device_identifier (HTTP services) → dns_scanner → ssl_scanner → report
    - Creates campaign, engagement per host

- [ ] Task 23: 03_service_exploitation.md — Credential bruting chain
    - Steps: port_scanner → identify services → ssh_bruter / ftp_bruter / mysql_bruter / postgresql_bruter → report
    - Runs appropriate bruter based on discovered services

- [ ] Task 24: 04_credential_harvest.md — Responder + credential capture
    - Steps: responder_poisoner (analyze mode) → capture hashes → report
    - Full mode: responder_poisoner (active) → capture → attempt crack with hashcat

#### Phase 6: Context File + Integration (dependency: all prior phases)

- [ ] Task 25: Write tactical/CLAUDE.md
    - Full agent context: role, constraints, DB schema (all tables), module inventory (19 modules with args/output), workflow inventory (5 workflows), execution rules, example interactions
    - Keep under 500 lines

- [ ] Task 26: Install ProjectDiscovery tools
    - Install nuclei, subfinder, naabu, fingerprintx via `go install`
    - Verify installation, add to PATH

- [ ] Task 27: End-to-end verification
    - Migration verification (3 tables exist)
    - Seed fake device/signal data
    - Run each module with `--help` and verify no import errors
    - Run wifi_recon against seeded data
    - Run port_scanner against localhost
    - Run ssh_bruter against localhost (should fail gracefully — no SSH on typical dev)
    - Verify CLAUDE.md loads from tactical/ directory

### Acceptance Criteria

- [ ] AC 1: `campaigns`, `engagements`, and `module_runs` tables exist in `rf_signals.db` after Argos startup.
- [ ] AC 2: All 15 Python modules execute without import errors when called with `--help`.
- [ ] AC 3: `wifi_recon.py` outputs valid JSON with seeded Kismet data.
- [ ] AC 4: `wifi_deauth.py` outputs `{"status": "error", ...}` gracefully when no monitor-mode interface exists.
- [ ] AC 5: `port_scanner.py` produces valid JSON scanning localhost.
- [ ] AC 6: `ssh_bruter.py`, `ftp_bruter.py`, `mysql_bruter.py`, `postgresql_bruter.py` output valid JSON with connection-refused errors (not crashes).
- [ ] AC 7: `dns_scanner.py` produces valid JSON for any public domain.
- [ ] AC 8: `module_runner.ts` runs any Python module, captures JSON output, and logs to `module_runs` table.
- [ ] AC 9: Claude Code launched from `tactical/` reads CLAUDE.md and knows all 19 modules and 5 workflows.
- [ ] AC 10: All module errors produce `{"status": "error", "message": "..."}` — never raw stack traces.
- [ ] AC 11: Each workflow file contains clear step-by-step instructions, retry logic, and abort conditions.

## Additional Context

### Dependencies

**Already installed on Kali:**

- aircrack-ng suite (aireplay-ng, airmon-ng, airodump-ng)
- nmap, masscan, hydra, ncrack, tshark, responder, netdiscover
- sqlmap, nikto, gobuster, ffuf, httpx
- Python3 with: paramiko, pymysql, psycopg2, scapy, shodan, dnspython, sslyze, beautifulsoup4
- sqlite3 CLI, wifite2
- Claude Code CLI (OAuth-authenticated)

**Need to install:**

- nuclei (`go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`)
- subfinder, naabu, fingerprintx (ProjectDiscovery Go suite)
- Go compiler (for `go install` — check if already present)

### Testing Strategy

**Unit Tests (vitest):**

- `tactical/modules/module_runner.test.ts` — Mocked Python subprocess output. JSON parsing, error handling, DB logging.

**Integration Tests:**

- `tests/integration/tactical-migration.test.ts` — Verify all 3 tables with correct columns/indexes.
- `tests/integration/tactical-modules.test.ts` — Run each module with `--help`, verify exit code 0 and no import errors.
- `tests/integration/tactical-recon.test.ts` — Seed DB, run wifi_recon.py, verify JSON schema.
- `tests/integration/tactical-portscan.test.ts` — Run port_scanner.py against localhost, verify JSON.
- `tests/integration/tactical-bruters-noservice.test.ts` — Run each bruter against unreachable host, verify graceful error JSON.

**No e2e/Playwright tests** — CLI-driven via Claude Code, not UI-driven.

### Module Output Contract

ALL modules MUST:

1. Output exactly one JSON object to stdout
2. Use stderr for human-readable logs/warnings only
3. Exit 0 for success JSON, exit 1 for error JSON (still valid JSON)
4. Include `"status": "success"|"error"` in all output
5. Include `"module": "<module_name>"` and `"timestamp": "<ISO>"` in all output
6. Never output raw stack traces to stdout

### Notes

- **PentAGI's WiFi gap**: PentAGI bundles ~200 CLI tools but zero WiFi-specific tools (no aircrack-ng, no Kismet, no monitor-mode support). Its Docker containers can't access USB WiFi adapters. Argos's WiFi modules (wifi_recon, wifi_deauth, wifi_handshake) fill this gap entirely.
- **Artemis module fidelity**: The bruter modules (ssh, ftp, mysql, postgresql) are extracted nearly verbatim from Artemis. Core scanning logic is unchanged. Only the Karton framework wrapper is replaced.
- **Claude Code as PentAGI replacement**: PentAGI's 6 agents (pentester, coder, devops, searcher, memorist, adviser) are all roles that Claude Code already performs natively. The workflow markdown files serve as the "adviser" role, guiding Claude's reasoning. Claude's auto-memory serves as the "memorist" role.
- **Memory constraint**: RPi 5 has 8GB RAM. Claude Code CLI uses ~150-350MB. Only one session at a time.
- **Security**: `--dangerously-skip-permissions` required for autonomous execution. Acceptable in controlled training environments (NTC/JMRC). Workflow files are the authorization boundary.
- **Future modules**: After Phase 1, add: `bt_recon.py` (Bluetooth enum), `rf_jamming.py` (HackRF TX), `gsm_monitor.py` (grgsm wrapper), `impacket_*.py` (Windows AD attacks), `metasploit_handler.py` (MSF RPC). Each follows the same base_module.py pattern.
