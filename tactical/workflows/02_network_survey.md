# Workflow: Full Network Discovery Survey

**ID:** 02_network_survey
**Risk Level:** MEDIUM — Active scanning (port scan + service fingerprinting), no exploitation
**Estimated Duration:** 15-60 minutes depending on network size
**Requires:** Network connectivity to target subnet

## Objective

Discover all hosts on a target network, enumerate their open ports, identify running services, and fingerprint network devices. Creates a complete network inventory.

## Pre-Flight Checks

1. **Network connectivity:** `ping -c 1 <GATEWAY_IP>`
2. **Interface identification:** `ip route show default` — note interface and gateway
3. **Subnet calculation:** Determine CIDR range from interface IP (e.g., 192.168.1.0/24)

## Steps

### Step 1: ARP Host Discovery

```bash
npx tsx tactical/modules/module_runner.ts net_discover \
  --range <SUBNET>/24 \
  --interface <IFACE> \
  --count 3
```

**Expected:** `hosts` array with IP, MAC, vendor for each live host.
**Record:** Create a target list from discovered hosts.
**If 0 hosts:** Try `--count 5` or check if on the right subnet.

### Step 2: Port Scan Each Host

For each host from Step 1:

```bash
npx tsx tactical/modules/module_runner.ts port_scanner \
  --target <HOST_IP> \
  --ports "--top-ports 200" \
  --scan-type syn
```

**Expected:** Open ports with service names and versions.
**Parallelize:** Run up to 3 scans concurrently if the network allows.
**Record:** Build a service matrix — Host × Port × Service.

### Step 3: Device Identification (HTTP Services)

For each host with HTTP/HTTPS ports (80, 443, 8080, 8443):

```bash
npx tsx tactical/modules/module_runner.ts device_identifier \
  --target http://<HOST_IP>:<PORT>
```

**Expected:** Device type (firewall, router, AP, server) and product name.
**Record:** Map device types to the network inventory.

### Step 4: DNS Analysis

For any discovered domain names or DNS servers (port 53 open):

```bash
npx tsx tactical/modules/module_runner.ts dns_scanner \
  --domain <DOMAIN>
```

**Expected:** NS records, zone transfer test, DNS records.
**Flag:** Zone transfer possible = HIGH finding.

### Step 5: SSL/TLS Analysis

For each host with TLS ports (443, 8443, etc.):

```bash
npx tsx tactical/modules/module_runner.ts ssl_scanner \
  --host <HOST_IP> \
  --port <TLS_PORT>
```

**Expected:** Certificate details, expiry, issues.
**Flag:** Expired certs, self-signed certs, Heartbleed = findings.

## Reporting

Generate a network survey report:

- **Network map:** All hosts with IPs, MACs, vendors
- **Service matrix:** Table of Host × Open Ports × Services
- **Device inventory:** Type and product for identified devices
- **DNS findings:** Zone transfer results, record inventory
- **TLS findings:** Certificate issues, protocol vulnerabilities
- **Recommended next workflows:**
    - Hosts with SSH/FTP/MySQL/PostgreSQL → `03_service_exploitation`
    - Hosts on Windows domain → `04_credential_harvest`
    - WiFi APs discovered → `01_wifi_killchain`

## Abort Conditions

- Network connectivity lost (gateway unreachable)
- IDS/IPS detection (unusual packet drops, connection resets)
- Operator interrupt
- More than 50 hosts discovered — ask operator to narrow scope
