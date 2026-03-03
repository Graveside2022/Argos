# Workflow: Passive Reconnaissance

**ID:** 00_recon_only
**Risk Level:** LOW — No exploitation, no active probing beyond port scanning
**Estimated Duration:** 5-15 minutes

## Objective

Enumerate all visible WiFi targets and network hosts without modifying any system state or sending attack traffic. This workflow is safe for initial situation awareness.

## Pre-Flight Checks

1. Verify database exists: `sqlite3 ./rf_signals.db ".tables"` — should list `devices`, `signals`, `networks`
2. Verify modules load: `python3 tactical/modules/wifi_recon.py --help`

## Steps

### Step 1: WiFi Target Enumeration

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon --db-path ./rf_signals.db --type all --max-age 3600
```

**Expected output:** JSON with `targets` array and `networks` array.
**If 0 targets:** Kismet may not be running or no WiFi devices are in range. Check: `curl -s http://localhost:5173/api/kismet/status`
**Record:** Note all APs with signal > -70 dBm — these are close enough for further operations.

### Step 2: ARP Host Discovery (if network interface available)

```bash
npx tsx tactical/modules/module_runner.ts net_discover --range <SUBNET>/24 --interface <IFACE> --count 2
```

**Replace:** `<SUBNET>` with the local network (e.g., 192.168.1.0), `<IFACE>` with the active wired/wireless interface.
**Expected output:** JSON with `hosts` array containing IP, MAC, vendor.
**If no hosts found:** Network may be isolated or interface isn't connected. Check `ip addr show <IFACE>`.

### Step 3: Port Scan Top Targets

For each host discovered in Step 2 (limit to top 5 by interest):

```bash
npx tsx tactical/modules/module_runner.ts port_scanner --target <IP> --ports "--top-ports 100" --scan-type connect --fast
```

**Expected output:** JSON with `ports` array showing open ports and services.
**Record:** Note all hosts with SSH (22), FTP (21), HTTP (80/443), MySQL (3306), PostgreSQL (5432).

### Step 4: DNS Analysis (if domain targets exist)

For any discovered hostnames:

```bash
npx tsx tactical/modules/module_runner.ts dns_scanner --domain <DOMAIN>
```

**Expected output:** DNS records and zone transfer check.
**If zone transfer possible:** This is a significant finding — flag it.

### Step 5: SSL Certificate Check (for HTTPS services)

For hosts with port 443 open:

```bash
npx tsx tactical/modules/module_runner.ts ssl_scanner --host <IP> --port 443
```

## Reporting

Summarize findings:

- Total WiFi APs and clients visible
- Total network hosts discovered
- Open services per host (table format)
- DNS issues found
- SSL/TLS issues found
- Recommended next workflows based on findings

## Rules

- **DO NOT** run deauth, brute-force, or poisoning modules
- **DO NOT** change interface modes (no airmon-ng)
- **DO NOT** attempt any authentication against discovered services
- Port scanning uses `-sT` (connect scan) — no SYN scan needed for recon
- This workflow should complete without root privileges (except netdiscover)

## Abort Conditions

- If any module crashes with a stack trace, stop and investigate
- If the operator interrupts, stop immediately
