# Kismet WiFi Adapter Configuration Explained

## Current Interface Status

Your system has **THREE wireless interfaces**:

1. **wlan0** - Raspberry Pi built-in WiFi (Broadcom chip)
    - MAC: d8:3a:dd:f3:42:ba
    - Status: DOWN (not being used by Kismet)
    - Type: Managed mode

2. **wlxbee1d69fa811** - Your ALFA AWUS036AXML adapter (MediaTek MT7921U)
    - MAC: be:e1:d6:9f:a8:11
    - Physical interface name (based on MAC address)
    - This IS your ALFA adapter

3. **kismon0** - Virtual monitor interface created FROM the ALFA adapter
    - MAC: be:e1:d6:9f:a8:11 (same as ALFA)
    - Type: Monitor mode
    - Created by Kismet for packet capture

## Interface Naming Explained

### Why "wlxbee1d69fa811" instead of "wlan1"?

Modern Linux uses **Predictable Network Interface Names**:

- USB WiFi adapters get names starting with `wlx` followed by MAC address
- `wlxbee1d69fa811` = wlx + bee1d69fa811 (MAC address without colons)
- This ensures the SAME adapter ALWAYS gets the SAME name

### What is "kismon0"?

- **Virtual monitor interface** created by Kismet
- Created FROM your ALFA adapter (wlxbee1d69fa811)
- Used for actual packet capture
- Automatically created when Kismet starts

## Adapter Identification Answers

### Q: Should the ALFA adapter have a custom name like "WLAN1_Kismet"?

**No.** The predictable naming is actually BETTER:

- `wlxbee1d69fa811` is unique to YOUR specific ALFA card
- It will ALWAYS be the same on this Pi
- Custom names would require manual configuration

### Q: Will the Pi ALWAYS identify 'kismon0' automatically?

**Yes**, but with clarification:

- `kismon0` is CREATED by Kismet when it starts
- Kismet creates it FROM the ALFA adapter (wlxbee1d69fa811)
- As long as the ALFA is connected, Kismet will create kismon0

### Q: What if I switch to a different ALFA card?

If you swap ALFA cards:

1. New card gets a DIFFERENT name (e.g., `wlxaabbccddeeff`)
2. You'd need to update Kismet config to use the new interface
3. Or configure Kismet to auto-detect ANY mt7921u device

## kismon0 vs wlxbee1d69fa811 - Which to Use?

### Using kismon0 (RECOMMENDED)

- Already in monitor mode
- Ready for packet capture
- Kismet manages it automatically
- Better performance

### Using wlxbee1d69fa811 directly

- Kismet would need to switch it to monitor mode
- Might interfere with NetworkManager
- Less efficient

## Why Isn't wlan0 (Built-in WiFi) Showing?

The Raspberry Pi's built-in WiFi (wlan0) isn't showing in Kismet because:

1. **NetworkManager is using it** - It's managed for normal WiFi connections
2. **Not in monitor mode** - It's in managed mode for regular networking
3. **Kismet prefers the ALFA** - Better hardware for packet capture

To make wlan0 available to Kismet:

```bash
# Stop NetworkManager from controlling it
sudo nmcli device set wlan0 managed no

# Or add to Kismet manually
kismet -c wlan0:type=linuxwifi
```

## Persistence Configuration

To ensure Kismet ALWAYS uses your ALFA adapter:

### Option 1: MAC-based Configuration (Current)

```bash
# In /etc/kismet/kismet_site.conf
source=wlxbee1d69fa811:type=linuxwifi
```

### Option 2: Driver-based Auto-detection

```bash
# Automatically use ANY mt7921u device
source=mt7921u:type=linuxwifi
```

### Option 3: First Available USB WiFi

```bash
# Use first USB WiFi adapter found
source=wlx*:type=linuxwifi
```

## Summary

- **wlxbee1d69fa811** = Your ALFA adapter (physical interface)
- **kismon0** = Monitor interface created FROM your ALFA
- **wlan0** = Pi's built-in WiFi (not used by Kismet)
- The naming is CORRECT and PERSISTENT
- Your ALFA will ALWAYS be recognized

The current setup is optimal - Kismet automatically:

1. Finds your ALFA adapter (wlxbee1d69fa811)
2. Creates monitor interface (kismon0)
3. Uses it for packet capture
4. Ignores the built-in WiFi (wlan0)
