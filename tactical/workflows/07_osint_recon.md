# Workflow: OSINT Reconnaissance

**ID:** 07_osint_recon
**Risk Level:** LOW — Passive data collection from public sources
**Estimated Duration:** 10-30 minutes per domain
**Requires:** Internet access, API keys for Shodan/Censys (optional)

## Objective

Gather intelligence about a target domain through passive reconnaissance:
subdomains, email addresses, DNS records, and internet-exposed services.

## Pre-Flight Checks

1. **Internet access:**

    ```bash
    ping -c 1 8.8.8.8
    ```

2. **Tools available:**

    ```bash
    which amass theHarvester dnsenum dnsrecon recon-ng
    ```

3. **API keys (optional but recommended):**
    ```bash
    echo "SHODAN: ${SHODAN_API_KEY:-(not set)}"
    echo "CENSYS: ${CENSYS_API_ID:-(not set)}"
    ```

## Steps

### Step 1: Subdomain Enumeration

```bash
npx tsx tactical/modules/module_runner.ts subdomain_enum \
  --domain TARGET.COM --passive --timeout 300
```

**Record:** All discovered subdomains.
**If amass is slow:** Use `--max-dns-queries 2000` to limit scope.

### Step 2: DNS Enumeration

Run both tools for broader coverage:

```bash
npx tsx tactical/modules/module_runner.ts dns_enum --domain TARGET.COM

npx tsx tactical/modules/module_runner.ts dns_recon --domain TARGET.COM --type std
```

**Also try zone transfer:**

```bash
npx tsx tactical/modules/module_runner.ts dns_recon --domain TARGET.COM --type axfr
```

### Step 3: Email Harvesting

```bash
npx tsx tactical/modules/module_runner.ts email_harvester \
  --domain TARGET.COM --source all --limit 500
```

**Record:** Email addresses for credential spraying, hosts for further scanning.

### Step 4: Shodan/Censys (if API keys available)

```bash
# Shodan
npx tsx tactical/modules/module_runner.ts shodan_search \
  --query "hostname:TARGET.COM" --limit 50

# Censys
npx tsx tactical/modules/module_runner.ts censys_search \
  --query "TARGET.COM" --limit 50
```

**Record:** Exposed services, open ports, known vulnerabilities.

### Step 5: Recon-ng Integration

```bash
npx tsx tactical/modules/module_runner.ts osint_framework \
  --domain TARGET.COM --workspace target_recon
```

**Review workspace data:**

```bash
npx tsx tactical/modules/module_runner.ts osint_framework \
  --workspace target_recon --show hosts
```

## Abort Conditions

- Target domain doesn't resolve (invalid domain)
- API rate limits hit (wait and retry)
- Operator interrupt

## Reporting

Summarize:

- Subdomains discovered: list with IPs
- Email addresses found: list for social engineering / credential spraying
- DNS records: NS, MX, TXT (SPF/DKIM/DMARC analysis), zone transfer results
- Exposed services: from Shodan/Censys with versions and vulns
- Recommended next steps: active scanning (port_scanner), web testing, credential spraying
