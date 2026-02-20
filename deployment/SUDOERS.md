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
kali ALL=(ALL) NOPASSWD: /usr/bin/python3

# Kismet — WiFi discovery service
kali ALL=(ALL) NOPASSWD: /usr/bin/kismet
kali ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop kismet
kali ALL=(ALL) NOPASSWD: /usr/sbin/iw
kali ALL=(ALL) NOPASSWD: /usr/sbin/ip

# HackRF — RF sweep
kali ALL=(ALL) NOPASSWD: /usr/bin/hackrf_info
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
| `systemctl`              | Kismet control        | Service lifecycle management       |
| `iw` / `ip`              | Kismet control        | Monitor interface cleanup          |

## Installation

```bash
sudo cp deployment/SUDOERS.md /dev/null  # This is documentation only
sudo visudo -f /etc/sudoers.d/argos      # Create the actual sudoers file
# Paste the entries from the "Required Sudoers Entries" section above
sudo chmod 0440 /etc/sudoers.d/argos
```

The `scripts/ops/setup-host.sh` provisioning script handles this automatically.
