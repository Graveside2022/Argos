# Workflow: Passive Reconnaissance

**ID:** 00_recon_only
**Risk Level:** LOW — No exploitation, no active probing beyond port scanning
**Estimated Duration:** 5-15 minutes

## Objective

Enumerate all visible WiFi targets and network hosts without modifying any system state or sending attack traffic. This workflow is safe for initial situation awareness.

## Pre-Flight Checks

Run all checks before proceeding. If any fail, resolve before continuing.

### 1. Kismet Liveness

```bash
pgrep -a kismet
```

**Expected:** At least one `kismet` process capturing on a wireless interface (e.g., `kismet -c wlan1`).
**If not running:** Start Kismet first — `sudo kismet -c wlan1:type=linuxwifi --no-ncurses --daemonize` or check the Argos dashboard.

### 2. Kismet Capture Database

```bash
ls -lt ~/Kismet-*.kismet | head -3
```

**Expected:** At least one `.kismet` file with a recent timestamp. The module auto-discovers the newest file.
**If empty:** Kismet may be configured to write elsewhere. Check `kismet.conf` for `log_prefix`.

### 3. Network Interface Discovery

```bash
ip route show default
ip -4 addr show | grep -E "inet " | grep -v "127.0.0.1"
```

**Record:** Note the default interface (e.g., `eth0`) and subnet (e.g., `192.168.8.0/24`). These are needed for Step 2.

### 4. Module Runner

```bash
npx tsx tactical/modules/module_runner.ts --runner-help 2>/dev/null | head -5
```

**Expected:** Module list output. If it fails, run `npm install` first.

## Steps

### Step 1: WiFi Target Enumeration (Kismet)

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon --type all --sort signal
```

The module auto-discovers the most recent `~/Kismet-*.kismet` file. To target a specific capture:

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon --kismet-db ~/Kismet-YYYYMMDD-HH-MM-SS-1.kismet --type all --sort signal
```

**Filter variants:**

- APs only: `--type ap`
- Clients only: `--type client`
- By SSID: `--ssid "ARRIS"`
- Strong signals only: `--min-signal -60`
- Sort by data volume: `--sort data`
- Last hour only: `--max-age 3600`

**Expected output:** JSON with `targets` array, `summary.by_type`, `summary.by_encryption`, and `summary.close_range_macs`.
**If 0 targets:** Kismet may not be running or no WiFi adapter is in monitor mode. Check pre-flight step 1.
**Record:** Note all targets with signal > -70 dBm — these are close enough for further operations. Note open networks and weak encryption (WEP, TKIP) as priority targets.

### Step 2: ARP Host Discovery (requires sudo)

```bash
sudo netdiscover -P -i <IFACE> -r <SUBNET>/24 -c 3
```

> **NOTE:** The `net_discover` module wraps `netdiscover` but does NOT auto-escalate to root. Use `sudo netdiscover` directly for reliable results.

**Replace:** `<IFACE>` and `<SUBNET>` with values from pre-flight step 3 (e.g., `eth0`, `192.168.8.0`).
**Expected output:** Table with IP, MAC, count, vendor for each live host.
**If no hosts found:** Try `--count 5` for more ARP rounds, or verify the interface is connected with `ip link show <IFACE>`.
**Record:** Create a target list of discovered hosts with IPs and vendors.

### Step 3: Port Scan Top Targets

For each host discovered in Step 2 (limit to top 5 by interest):

```bash
npx tsx tactical/modules/module_runner.ts port_scanner --target <IP> --ports "--top-ports 100" --scan-type connect --fast
```

**Expected output:** JSON with `ports` array showing open ports and services.
**Record:** Build a service matrix noting hosts with:

- SSH (22), Telnet (23) — remote access
- FTP (21) — file transfer
- HTTP (80), HTTPS (443), alt-HTTP (8080, 8443) — web interfaces
- DNS (53) — DNS server
- MySQL (3306), PostgreSQL (5432) — databases
- SMB (445), NetBIOS (139) — Windows/file sharing
- SNMP (161) — network management

### Step 4: HTTP Device Fingerprinting

For each host with HTTP/HTTPS ports open:

```bash
npx tsx tactical/modules/module_runner.ts device_identifier --target http://<IP>:<PORT>
```

**Expected output:** JSON with `page_title`, `server_header`, `headers`, and optional `device_type`.
**Record:** Map device identities — routers, APs, KVM switches, NAS, IoT devices. The `server_header` and `page_title` are the most useful fields.

### Step 5: Web Technology Fingerprinting (optional)

For HTTP services where device_identifier returned limited info:

```bash
npx tsx tactical/modules/module_runner.ts web_tech_identifier --url http://<IP>:<PORT> --aggression 3
```

> **NOTE:** This module uses `--url`, not `--target`.

**Expected output:** JSON with `technologies` array.

### Step 6: SSL/TLS Certificate Analysis

For each host with HTTPS ports (443, 8443, etc.):

```bash
npx tsx tactical/modules/module_runner.ts ssl_scanner --host <IP> --port 443
```

**Expected output:** JSON with cert details, protocol, cipher, and issues.
**Flag findings:**

- Self-signed certificates — indicates internal/dev infrastructure
- Expired certificates — poor security hygiene
- CN/SAN mismatch — device identity leakage (e.g., `console.gl-inet.com` reveals GL.iNet router)
- Weak protocols (TLSv1.0/1.1) or ciphers

### Step 7: DNS Analysis (if domain targets or DNS servers exist)

For hosts with port 53 open, or for any discovered domain names:

```bash
npx tsx tactical/modules/module_runner.ts dns_scanner --domain <DOMAIN>
```

**Expected output:** DNS records and zone transfer check.
**If zone transfer possible:** This is a HIGH finding — full internal DNS map exposed.

## Reporting

Summarize findings in this structure:

### Wireless Environment

| Metric                 | Value |
| ---------------------- | ----- |
| Total devices          |       |
| APs                    |       |
| Clients                |       |
| Bridged/Ad-Hoc         |       |
| Open networks          |       |
| WEP/TKIP (weak)        |       |
| WPA2                   |       |
| WPA3                   |       |
| Close range (>-70 dBm) |       |

**Priority wireless targets** (table of close-range APs with SSID, MAC, signal, encryption).

### Network Hosts

| IP  | MAC | Vendor | Open Ports | Device Identity |
| --- | --- | ------ | ---------- | --------------- |
|     |     |        |            |                 |

### Findings

- SSL/TLS issues (expired, self-signed, weak ciphers)
- DNS issues (zone transfers, misconfigurations)
- Open/unencrypted services
- Default/identifiable device admin panels

### Recommended Next Workflows

Based on findings, recommend applicable follow-on workflows:

| Finding              | Recommended Workflow                                                 |
| -------------------- | -------------------------------------------------------------------- |
| Open WiFi networks   | `08_wireless_full` — capture traffic, test for captive portal bypass |
| WEP/TKIP networks    | `01_wifi_killchain` — weak crypto, crackable                         |
| WPA2-PSK close range | `01_wifi_killchain` — handshake capture + crack                      |
| SSH/FTP services     | `03_service_exploitation` — credential testing                       |
| HTTP admin panels    | `05_web_app_pentest` — web vulnerability scanning                    |
| Windows/SMB hosts    | `04_credential_harvest` + `06_ad_attack_chain`                       |
| DNS zone transfer    | Already exploited — document internal map                            |
| Mobile hotspots      | Low value — skip unless specific target                              |

## Rules

- **DO NOT** run deauth, brute-force, or poisoning modules
- **DO NOT** change interface modes (no airmon-ng)
- **DO NOT** attempt any authentication against discovered services
- **DO NOT** modify any target system state
- Port scanning uses `-sT` (connect scan) — no SYN scan needed for recon
- `net_discover` requires root — use `sudo` directly for reliable results
- `web_tech_identifier` uses `--url`, not `--target`
- One module at a time on RPi 5 — do not parallelize

## Abort Conditions

- If any module crashes with a stack trace, stop and investigate
- If the operator interrupts, stop immediately
- If > 50 network hosts discovered, ask operator to narrow scope before port scanning
- If Kismet stops capturing mid-workflow, restart it before continuing
