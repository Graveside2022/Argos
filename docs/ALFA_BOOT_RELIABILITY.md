# ALFA AWUS036AXML Boot Reliability Guide

## The Problem

Even with proper USB power configuration, the ALFA adapter may occasionally fail to initialize at boot due to:

- Module loading timing issues
- USB enumeration delays
- Power management interference
- NetworkManager conflicts

## The Solution: Multi-Layer Protection

### Run the Setup Script

```bash
sudo bash /home/ubuntu/projects/Argos/scripts/ensure-alfa-boot.sh
```

This implements 10 protective measures:

### 1. **Force Module Loading at Boot**

Creates `/etc/modules-load.d/mt7921u.conf` to ensure MT7921U modules load early in boot sequence.

### 2. **Optimize Module Parameters**

Sets `/etc/modprobe.d/mt7921u-options.conf`:

- Disables USB scatter-gather (stability)
- Disables power saving mode
- Optimizes for reliability over power efficiency

### 3. **Udev Detection Rules**

Creates `/etc/udev/rules.d/90-alfa-mt7921u.rules`:

- Triggers when ALFA USB device appears
- Disables USB autosuspend for this specific device
- Runs detection scripts automatically

### 4. **Boot Verification Service**

`alfa-boot-verify.service` runs at boot to:

- Wait up to 20 seconds for adapter
- Load modules if missing
- Apply configurations
- Log detection status

### 5. **NetworkManager Exclusion**

Prevents NetworkManager from managing the ALFA adapter, avoiding conflicts with Kismet.

### 6. **USB Autosuspend Disabled**

Two methods:

- Kernel parameter: `usbcore.autosuspend=-1`
- Udev rule for specific device

### 7. **Detection Logging**

All boot events logged to `/var/log/alfa-boot.log` for troubleshooting.

### 8. **Emergency Reset Script**

`/usr/local/bin/alfa-emergency-reset.sh` provides manual recovery:

```bash
sudo /usr/local/bin/alfa-emergency-reset.sh
```

### 9. **Interface Power Management**

Automatically disables WiFi power saving on the interface.

### 10. **Automatic Module Reload**

If interface doesn't appear within timeout, modules are reloaded automatically.

## How It Works

### Boot Sequence:

1. **Early Boot**: Kernel loads MT7921U modules
2. **USB Detection**: Udev rules trigger on device connection
3. **Verification**: Systemd service confirms adapter is ready
4. **Configuration**: Power management disabled, alias applied
5. **Ready**: Interface available for Kismet

### Monitoring:

```bash
# Check boot log
tail -f /var/log/alfa-boot.log

# Verify service status
systemctl status alfa-boot-verify.service

# Check if adapter is detected
ip link show | grep wlx

# Check USB device
lsusb | grep 0e8d:7961
```

## Troubleshooting

### If Adapter Not Detected After Reboot:

1. **Check USB Power:**

```bash
grep usb_max_current /boot/firmware/config.txt
# Should show: usb_max_current_enable=1
```

2. **Check Modules:**

```bash
lsmod | grep mt7921
# Should show mt7921u and related modules
```

3. **Run Emergency Reset:**

```bash
sudo /usr/local/bin/alfa-emergency-reset.sh
```

4. **Check Physical Connection:**

- Unplug and replug the adapter
- Try different USB port
- Check adapter LED

5. **Review Logs:**

```bash
sudo dmesg | grep -E "mt7921|usb.*0e8d"
cat /var/log/alfa-boot.log
```

## Success Indicators

After reboot, you should see:

- ✅ Interface `wlxbee1d69fa811` in `ip link show`
- ✅ Alias `wlan1_kismet` applied
- ✅ MT7921U modules loaded
- ✅ USB device `0e8d:7961` in lsusb
- ✅ Log entry: "ALFA adapter ready" in `/var/log/alfa-boot.log`

## Why This Works

This approach addresses all common failure modes:

- **Timing issues**: Service waits for device
- **Power issues**: Multiple autosuspend disables
- **Module issues**: Force loading at boot
- **Detection issues**: Udev rules trigger on USB events
- **Recovery**: Automatic and manual reset options

The adapter should now reliably connect on every boot!
