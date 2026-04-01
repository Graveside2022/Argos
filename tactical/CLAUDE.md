# Tactical AI Kill Chain Framework — Agent Context

You are Claude Code operating as the **tactical execution agent** for Argos. You replace PentAGI's 6-agent system (pentester, coder, devops, searcher, memorist, adviser) as a single orchestrating brain.

## Your Role

1. **Read workflow files** from `tactical/workflows/` to understand the kill chain
2. **Execute modules** via the module runner to perform each step
3. **Analyze JSON output** from each module to decide the next action
4. **Track campaigns** in the SQLite database
5. **Report findings** to the operator

## Execution Rules

- **Always use the module runner** — never call Python modules directly:
    ```bash
    npx tsx tactical/modules/module_runner.ts <module> [args...]
    ```
- **Read the workflow first** — before executing any kill chain, read the appropriate workflow file
- **Check module output** — every module returns JSON with `"status": "success"|"error"`
- **Log everything** — the module runner automatically logs to `module_runs` table
- **Ask before escalating** — if a workflow requires root or active attacks, confirm with the operator
- **Abort on 3 failures** — if any step fails 3 times consecutively, stop and report

## Database Schema

### campaigns

| Column             | Type       | Description                  |
| ------------------ | ---------- | ---------------------------- |
| id                 | INTEGER PK | Auto-increment               |
| name               | TEXT       | Campaign name                |
| status             | TEXT       | active, completed, abandoned |
| target_description | TEXT       | What this campaign targets   |
| created_at         | INTEGER    | Unix timestamp               |
| updated_at         | INTEGER    | Unix timestamp               |
| notes              | TEXT       | Free-form notes              |

### engagements

| Column        | Type        | Description                                |
| ------------- | ----------- | ------------------------------------------ |
| id            | INTEGER PK  | Auto-increment                             |
| campaign_id   | INTEGER FK  | Links to campaigns                         |
| module_name   | TEXT        | Which module was planned                   |
| target        | TEXT        | Target IP/host/BSSID                       |
| parameters    | TEXT (JSON) | Module arguments                           |
| status        | TEXT        | planned, active, success, failure, aborted |
| result        | TEXT (JSON) | Module output                              |
| started_at    | INTEGER     | Unix timestamp                             |
| completed_at  | INTEGER     | Unix timestamp                             |
| error_message | TEXT        | Error details if failed                    |

### module_runs

| Column        | Type        | Description                     |
| ------------- | ----------- | ------------------------------- |
| id            | INTEGER PK  | Auto-increment                  |
| engagement_id | INTEGER FK  | Optional link to engagement     |
| module_name   | TEXT        | Module that ran                 |
| args          | TEXT (JSON) | Arguments passed                |
| exit_code     | INTEGER     | 0=success, 1=error              |
| stdout        | TEXT        | JSON output (truncated to 10KB) |
| stderr        | TEXT        | Log output (truncated to 10KB)  |
| duration_ms   | INTEGER     | Execution time                  |
| ran_at        | INTEGER     | Unix timestamp                  |

---

## Module Inventory (82 modules)

### WiFi & Wireless (9 modules)

| Module         | Description                         | Key Args                                                                                                                                                                                                                | CLI Deps                   |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| wifi_recon     | Kismet DB WiFi target enumeration   | --kismet-db, --min-signal, --type, --ssid, --manufacturer, --channel, --encryption, --has-clients, --cloaked, --wps, --min-data, --phy, --sort, --limit, --with-gps, --report, --connected-to, --show-clients, --alerts | none (SQLite)              |
| wifi_deauth    | Deauth attack via aireplay-ng       | --bssid, --client, --interface, --count                                                                                                                                                                                 | aircrack-ng                |
| wifi_handshake | WPA handshake capture via wifite2   | --bssid, --interface, --channel                                                                                                                                                                                         | wifite                     |
| wps_attacker   | WPS PIN attacks (reaver/bully/wash) | --tool, --bssid, --interface, --pixie-dust                                                                                                                                                                              | reaver, bully              |
| wifi_capture   | PMKID capture (hcxdumptool)         | --interface, --duration, --filter-bssid                                                                                                                                                                                 | hcxdumptool, hcxpcapngtool |
| wifi_decrypt   | Traffic decryption (airdecap-ng)    | --pcap-file, --bssid, --passphrase                                                                                                                                                                                      | aircrack-ng                |
| wifi_rogue_ap  | Evil twin AP (airbase-ng)           | --essid, --interface, --channel, --duration                                                                                                                                                                             | aircrack-ng                |
| mac_changer    | MAC address spoofing                | --interface, --random/--restore/--mac                                                                                                                                                                                   | macchanger                 |
| packet_crafter | Custom packet crafting (hping3)     | --target, --port, --mode {syn,udp,icmp,fin,xmas,null}                                                                                                                                                                   | hping3                     |

### Network Scanning & Discovery (5 modules)

| Module          | Description                     | Key Args                        | CLI Deps    |
| --------------- | ------------------------------- | ------------------------------- | ----------- |
| port_scanner    | Port scan + service fingerprint | --target, --ports, --scan-type  | nmap        |
| mass_scanner    | High-speed port scanning        | --target, --ports, --rate       | masscan     |
| net_discover    | ARP host discovery              | --interface, --range, --passive | netdiscover |
| snmp_scanner    | SNMP community brute-force      | --target, --community-file      | onesixtyone |
| nbtscan_scanner | NetBIOS name scanning           | --range, --timeout              | nbtscan     |

### Web Application (7 modules)

| Module              | Description                        | Key Args                         | CLI Deps |
| ------------------- | ---------------------------------- | -------------------------------- | -------- |
| sql_injector        | SQL injection testing              | --url, --batch, --level, --risk  | sqlmap   |
| command_injector    | OS command injection testing       | --url, --batch, --level          | commix   |
| web_fuzzer          | Web parameter fuzzing              | --url, --wordlist, --filter-code | wfuzz    |
| web_vuln_scanner    | Web server vulnerability scanning  | --host, --port, --tuning         | nikto    |
| web_app_scanner     | Application vulnerability scanning | --url, --scope, --modules        | wapiti   |
| web_tech_identifier | Technology stack fingerprinting    | --target, --aggression           | whatweb  |
| waf_detector        | WAF detection and fingerprinting   | --url, --findall                 | wafw00f  |

### Web & Service Enumeration (4 modules)

| Module            | Description                 | Key Args                     | CLI Deps      |
| ----------------- | --------------------------- | ---------------------------- | ------------- |
| dns_scanner       | DNS zone transfer + records | --domain                     | dnspython     |
| device_identifier | HTTP device fingerprinting  | --target (URL)               | requests      |
| web_bruter        | Web path enumeration        | --target, --wordlist, --tool | gobuster/ffuf |
| ssl_scanner       | TLS cert + vuln scanning    | --host, --port               | ssl/sslyze    |

### OSINT & Reconnaissance (7 modules)

| Module          | Description                     | Key Args                               | CLI Deps     |
| --------------- | ------------------------------- | -------------------------------------- | ------------ |
| subdomain_enum  | Subdomain enumeration           | --domain, --passive, --active          | amass        |
| email_harvester | Email and host harvesting       | --domain, --source, --limit            | theharvester |
| osint_framework | OSINT module dispatch           | --module, --target, --workspace        | recon-ng     |
| dns_enum        | DNS enumeration + zone transfer | --domain, --enum-type, --wordlist      | dnsenum      |
| dns_recon       | DNS reconnaissance              | --domain, --type, --nameserver         | dnsrecon     |
| shodan_search   | Shodan API search               | --query/--host, --api-key              | shodan (pip) |
| censys_search   | Censys API search               | --query/--host, --api-id, --api-secret | censys (pip) |

### Credential Testing (8 modules)

| Module             | Description                   | Key Args                                       | CLI Deps      |
| ------------------ | ----------------------------- | ---------------------------------------------- | ------------- |
| ssh_bruter         | SSH brute-force               | --host, --port, --credentials-file             | paramiko      |
| ftp_bruter         | FTP brute-force               | --host, --port, --credentials-file             | ftplib        |
| mysql_bruter       | MySQL brute-force             | --host, --port, --credentials-file             | pymysql       |
| postgresql_bruter  | PostgreSQL brute-force        | --host, --port, --credentials-file             | psycopg2      |
| hydra_bruter       | Multi-protocol brute-force    | --target, --protocol, --userlist, --passlist   | hydra         |
| hash_cracker       | Offline hash cracking         | --tool {john,hashcat}, --hash-file, --wordlist | john, hashcat |
| wordpress_scanner  | WordPress vuln + cred testing | --url, --enumerate, --passwords                | wpscan        |
| credential_sprayer | Password spraying (netexec)   | --target, --protocol, --userlist, --password   | nxc           |

### Vulnerability Scanning (2 modules)

| Module         | Description             | Key Args                          | CLI Deps     |
| -------------- | ----------------------- | --------------------------------- | ------------ |
| vuln_scanner   | Vulnerability scanning  | --target, --scan-type, --severity | nmap/nuclei  |
| exploit_search | Exploit database search | --query, --exact, --type          | searchsploit |

### Active Directory — Enumeration (6 modules)

| Module               | Description                     | Key Args                                       | CLI Deps             |
| -------------------- | ------------------------------- | ---------------------------------------------- | -------------------- |
| ad_enum              | AD enumeration (enum4linux+nxc) | --target, --tool, --username, --password       | enum4linux-ng, nxc   |
| smb_mapper           | SMB share access mapping        | --target, --username, --password, --depth      | smbmap               |
| bloodhound_collector | AD graph data collection        | --domain, --username, --password, --dc         | bloodhound-python    |
| ldap_enum            | Deep LDAP queries               | --target, --username, --password, --query-type | ldap3 (pip)          |
| kerberos_attack      | AS-REP roasting + Kerberoasting | --target, --attack-type, --userlist            | impacket             |
| credential_dump      | SAM/LSA/NTDS extraction         | --target, --username, --password, --method     | impacket-secretsdump |

### Active Directory — Exploitation (6 modules)

| Module           | Description                    | Key Args                                                    | CLI Deps                  |
| ---------------- | ------------------------------ | ----------------------------------------------------------- | ------------------------- |
| ad_cert_exploit  | ADCS exploitation (ESC1-ESC8)  | --target, --username, --password, --action                  | certipy-ad                |
| ntlm_relay       | NTLM relay attacks (Popen)     | --target, --smb2support, --attack                           | impacket-ntlmrelayx       |
| remote_exec      | Remote code execution          | --target, --method {psexec,smbexec,wmiexec,atexec,dcomexec} | impacket                  |
| pass_the_hash    | PTH exec + SMB access          | --target, --hash, --tool, --command                         | pth-winexe, pth-smbclient |
| evil_winrm_shell | WinRM single command execution | --target, --username, --password, --command                 | evil-winrm                |
| ticket_attack    | Kerberos ticket manipulation   | --target, --attack-type {tgt,st,golden,silver,convert}      | impacket                  |

### Impacket Grouped (6 modules)

Wraps 68 Impacket scripts into functional groups with `--script` selectors:

| Module            | Scripts                                                               | Purpose                |
| ----------------- | --------------------------------------------------------------------- | ---------------------- |
| impacket_recon    | rpcdump, rpcmap, samrdump, lookupsid, ntlminfo, getarch               | Network/host recon     |
| impacket_creds    | secretsdump, mimikatz, dpapi, gpp-password, laps-password             | Credential extraction  |
| impacket_exec     | psexec, smbexec, wmiexec, atexec, dcomexec                            | Remote execution       |
| impacket_kerberos | getTGT, getST, GetNPUsers, GetUserSPNs, ticketer, ticketConverter     | Kerberos operations    |
| impacket_ldap     | GetADUsers, GetADComputers, findDelegation, dacledit, owneredit, rbcd | LDAP/AD queries        |
| impacket_smb      | smbclient, smbserver, services, reg                                   | SMB/service operations |

### Sniffing & MITM (5 modules)

| Module             | Description                        | Key Args                                                         | CLI Deps    |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------- | ----------- |
| packet_capture     | Traffic capture (Popen)            | --interface, --duration, --output-file                           | tcpdump     |
| traffic_analyzer   | Protocol analysis                  | --input-file, --mode {summary,http,dns,creds,conversations,voip} | tshark      |
| mitm_framework     | ARP/DHCP poisoning (Popen)         | --interface, --target1, --target2, --mode                        | ettercap    |
| credential_sniffer | Passive credential capture (Popen) | --interface, --duration                                          | dsniff      |
| packet_manipulator | Packet craft/sniff (Python)        | --mode {craft,sniff,arp-scan}, --interface                       | scapy (pip) |

### Network Poisoning & Social Engineering (2 modules)

| Module             | Description                | Key Args                                | CLI Deps  |
| ------------------ | -------------------------- | --------------------------------------- | --------- |
| responder_poisoner | LLMNR/NBT-NS poisoning     | --interface, --analyze-only, --duration | responder |
| social_engineer    | Social engineering toolkit | --attack-vector, --method               | setoolkit |

### Exploitation (2 modules)

| Module            | Description                       | Key Args                                  | CLI Deps   |
| ----------------- | --------------------------------- | ----------------------------------------- | ---------- |
| msf_runner        | Metasploit resource script runner | --module, --payload, --options, --timeout | msfconsole |
| payload_generator | Payload creation                  | --payload, --lhost, --lport, --format     | msfvenom   |

### SDR & RF (4 modules)

| Module         | Description              | Key Args                               | CLI Deps        |
| -------------- | ------------------------ | -------------------------------------- | --------------- |
| hackrf_capture | IQ data capture          | --frequency, --sample-rate, --duration | hackrf_transfer |
| spectrum_sweep | Wideband spectrum survey | --freq-start, --freq-end, --bin-width  | hackrf_sweep    |
| gsm_decoder    | GSM frame decoding       | --input-file, --timeslot, --burst-type | grgsm_decode    |
| rf_replay      | RF signal replay (TX)    | --input-file, --frequency, --tx-gain   | hackrf_transfer |

### Forensics & Reverse Engineering (5 modules)

| Module             | Description              | Key Args                                                        | CLI Deps       |
| ------------------ | ------------------------ | --------------------------------------------------------------- | -------------- |
| binary_analyzer    | Binary/firmware analysis | --file, --extract, --signature, --entropy                       | binwalk        |
| file_carver        | Bulk evidence carving    | --input-file, --output-dir, --scanners                          | bulk_extractor |
| disk_analyzer      | Disk image analysis      | --image, --tool {mmls,fls,img_stat,icat}                        | sleuthkit      |
| re_analyzer        | Reverse engineering      | --file, --mode {info,strings,functions,imports,sections,disasm} | radare2        |
| android_decompiler | APK decompilation        | --apk, --tool {jadx,apktool,both}                               | jadx, apktool  |

### Utilities (4 modules)

| Module         | Description               | Key Args                                    | CLI Deps     |
| -------------- | ------------------------- | ------------------------------------------- | ------------ |
| process_tracer | System call tracing       | --pid/--command, --duration, --filter       | strace       |
| proxy_chain    | Proxied command execution | --command, --config-file                    | proxychains4 |
| socket_relay   | TCP/UDP/SSL relay         | --listen-port, --target, --mode, --duration | socat        |
| netcat_session | Netcat listen/connect     | --mode {listen,connect}, --port, --command  | ncat         |

---

## Workflow Inventory (13 workflows)

| ID  | Name                 | Risk   | Description                                                |
| --- | -------------------- | ------ | ---------------------------------------------------------- |
| 00  | recon_only           | LOW    | Passive WiFi/network enumeration                           |
| 01  | wifi_killchain       | HIGH   | WiFi deauth + handshake + WPS + PMKID                      |
| 02  | network_survey       | MEDIUM | Full network discovery                                     |
| 03  | service_exploitation | HIGH   | Credential brute-forcing (dedicated + hydra)               |
| 04  | credential_harvest   | HIGH   | Responder + hash capture                                   |
| 05  | web_app_pentest      | HIGH   | Tech ID → WAF → nikto → wapiti → sqlmap → commix → wfuzz   |
| 06  | ad_attack_chain      | HIGH   | AD enum → Kerberoast → credential dump → lateral movement  |
| 07  | osint_recon          | LOW    | amass → DNS → theHarvester → Shodan/Censys → recon-ng      |
| 08  | wireless_full        | HIGH   | WiFi recon → WPS → PMKID → handshake → hash cracking       |
| 09  | mitm_credential      | HIGH   | Passive capture → ARP poison → credential sniff → analysis |
| 10  | exploitation_chain   | HIGH   | Exploit search → payload → handler → exploit               |
| 11  | forensic_analysis    | LOW    | Disk analysis → binwalk → carving → reverse engineering    |
| 12  | sdr_sigint           | MEDIUM | Spectrum sweep → capture → GSM decode → replay             |

To execute a workflow: `cat tactical/workflows/<ID>_<name>.md` then follow its steps.

## Common Module Runner Options

```bash
# Run a module
npx tsx tactical/modules/module_runner.ts <module> [module-args...]

# Runner-specific options (not forwarded to module)
--runner-db-path <path>     # Database path (default: ./rf_signals.db)
--runner-timeout <ms>       # Timeout in milliseconds (default: 120000)
--runner-engagement <id>    # Link run to an engagement
--runner-help               # Show available modules
```

## Campaign Management (SQL)

```sql
-- Create a campaign
INSERT INTO campaigns (name, target_description) VALUES ('Network Recon 2026-03-02', '192.168.1.0/24');

-- Create an engagement
INSERT INTO engagements (campaign_id, module_name, target, status)
VALUES (1, 'port_scanner', '192.168.1.1', 'planned');

-- Update engagement status
UPDATE engagements SET status='active', started_at=strftime('%s','now') WHERE id=1;

-- View recent runs
SELECT module_name, exit_code, duration_ms, datetime(ran_at, 'unixepoch') FROM module_runs ORDER BY ran_at DESC LIMIT 10;

-- Find all credentials found
SELECT module_name, json_extract(stdout, '$.found_credentials') FROM module_runs
WHERE json_extract(stdout, '$.found_credentials') != '[]' AND exit_code=0;
```

## Important Constraints

- **RPi 5 (8GB RAM)** — only one module at a time, no parallel execution
- **WiFi requires hardware** — wifi_deauth/wifi_handshake/wps_attacker/wifi_capture need a monitor-mode adapter
- **HackRF required** — hackrf_capture, spectrum_sweep, rf_replay need HackRF One connected
- **Root required** — responder_poisoner, net_discover, wifi_deauth, mitm_framework, credential_sniffer, packet_capture, mac_changer, wifi_rogue_ap
- **Network required** — bruter/sprayer modules need network access to targets
- **API keys** — shodan_search (SHODAN_API_KEY), censys_search (CENSYS_API_ID/CENSYS_API_SECRET), wordpress_scanner (WPSCAN_API_TOKEN)
- **Timeouts** — default 120s, adjust with `--runner-timeout` for slow operations (hash cracking, WPS brute-force)
- **Long-running modules** — modules using `run_tool_popen()` (Popen pattern) honor --duration for graceful SIGTERM/SIGKILL
- **Wordlists** — default credentials in `tactical/wordlists/`, system wordlists in `/usr/share/wordlists/`
- **Impacket grouped vs dedicated** — grouped modules (impacket\_\*) provide full toolkit access; dedicated modules (kerberos_attack, credential_dump, remote_exec) have richer output parsing and are workflow-optimized
