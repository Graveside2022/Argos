# Sudoers Configuration for Argos

Argos requires passwordless sudo for specific commands used by the GSM Evil and Kismet subsystems.

## Required Sudoers Entries

Add to `/etc/sudoers.d/argos` (use `visudo -f /etc/sudoers.d/argos`):

```sudoers
# GSM Evil — SDR capture and process management
kali ALL=(ALL) NOPASSWD: /usr/bin/grgsm_livemon_headless
kali ALL=(ALL) NOPASSWD: /usr/bin/setsid
kali ALL=(ALL) NOPASSWD: /usr/bin/pkill
kali ALL=(ALL) NOPASSWD: /usr/bin/kill
kali ALL=(ALL) NOPASSWD: /usr/bin/timeout
kali ALL=(ALL) NOPASSWD: /usr/sbin/tcpdump
kali ALL=(ALL) NOPASSWD: /usr/bin/tshark
kali ALL=(ALL) NOPASSWD: /usr/bin/lsof
kali ALL=(ALL) NOPASSWD: /usr/bin/fuser
# Sparrow-WiFi — GUI launch (scoped to specific scripts)
kali ALL=(ALL) NOPASSWD: /usr/bin/python3 /opt/sparrow-wifi/sparrow-wifi.py
kali ALL=(ALL) NOPASSWD: /usr/bin/python3 /opt/sparrow-wifi/sparrowwifiagent.py *

# Kismet — WiFi discovery service
kali ALL=(ALL) NOPASSWD: /usr/bin/kismet
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop kismet
kali ALL=(ALL) NOPASSWD: /usr/sbin/iw
kali ALL=(ALL) NOPASSWD: /usr/sbin/ip

# HackRF — RF sweep
kali ALL=(ALL) NOPASSWD: /usr/bin/hackrf_info

# Argos process manager + CPU protector — restart critical services
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart earlyoom
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart gpsd
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart argos-final
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart argos-kismet
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-droneid
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-kismet
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop argos-headless
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-droneid
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-kismet
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl start argos-headless

# SDR hardware arbiter — stop competing services to free B205/HackRF before
# sparrow/kismet/bluehood start. See src/lib/server/hardware/b205-manager.ts
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop wardragon-fpv-detect
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop wardragon-fpv-detect.service
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl start sparrow-wifi-agent
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop sparrow-wifi-agent
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart sparrow-wifi-agent

# Sparrow auto-reset wlan1 mode — prior monitor-mode tools leave Alfa in
# type=monitor which breaks sparrow's iw scan (Error 161 / -95 EOPNOTSUPP)
kali ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlan1 *
kali ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlan2 *
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop zmq-decoder.service
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop zmq-decoder
kali ALL=(ALL) NOPASSWD: /usr/bin/pkill -f /opt/droneid-go/droneid

# Argos WiFi resilience — interface recovery
kali ALL=(ALL) NOPASSWD: /usr/sbin/ip link set wlan0 *
kali ALL=(ALL) NOPASSWD: /usr/bin/nmcli device reapply wlan0
kali ALL=(ALL) NOPASSWD: /usr/bin/nmcli device disconnect wlan0
kali ALL=(ALL) NOPASSWD: /usr/bin/nmcli device connect wlan0
```

## Why These Are Needed

| Command                  | Used By               | Purpose                            |
| ------------------------ | --------------------- | ---------------------------------- |
| `grgsm_livemon_headless` | GSM Evil scan/control | Capture GSM frames via HackRF      |
| `setsid`                 | GSM Evil control      | Daemonize background processes     |
| `pkill` / `kill`         | GSM Evil + Kismet     | Process lifecycle management       |
| `timeout`                | GSM Evil scan         | Time-bounded capture sessions      |
| `tcpdump` / `tshark`     | Intelligent scan      | Packet capture for GSMTAP analysis |
| `lsof` / `fuser`         | Health + control      | Port and process checking          |
| `python3`                | GSM Evil control      | Run GsmEvil2 web interface         |
| `kismet`                 | Kismet control        | WiFi discovery service             |
| `systemctl`              | Kismet + process-mgr  | Service lifecycle management       |
| `iw` / `ip`              | Kismet + WiFi resil.  | Monitor interface + link recovery  |
| `nmcli`                  | WiFi resilience       | wlan0 reconnection escalation      |
| `oom_score_adj`          | Vite OOM protect      | Set OOM score on Vite process tree |

## Installation

```bash
sudo cp deployment/SUDOERS.md /dev/null  # This is documentation only
sudo visudo -f /etc/sudoers.d/argos      # Create the actual sudoers file
# Paste the entries from the "Required Sudoers Entries" section above
sudo chmod 0440 /etc/sudoers.d/argos
```

The `scripts/ops/setup-host.sh` provisioning script handles this automatically.
