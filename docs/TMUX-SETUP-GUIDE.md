# Tmux Setup Guide for DragonOS/Argos

## Script Overview

You have **TWO scripts** with different purposes:

### 1. `setup-tmux-persistent.sh` - LOCAL MACHINE

**Run this ON the DragonOS/Raspberry Pi itself**

- Sets up tmux with full mouse support
- Creates persistent sessions that survive reboots
- Installs plugins for session restoration
- Creates 15 numbered tmux sessions

### 2. `setup-tmux-aliases.sh` - REMOTE MACHINE

**Run this on your LAPTOP/DESKTOP that connects TO the Pi**

- Creates SSH shortcuts to connect to the Pi's tmux sessions
- Allows quick access from any remote machine
- No need to remember SSH commands

---

## Fresh DragonOS Installation Instructions

### Step 1: On the DragonOS/Raspberry Pi

```bash
# 1. Clone or copy the Argos project
git clone [your-argos-repo] ~/projects/Argos
cd ~/projects/Argos

# 2. Run the tmux setup script
./scripts/setup-tmux-persistent.sh

# What this does:
# - Installs tmux if not present
# - Sets up mouse support (YES, FULL MOUSE CONTROL!)
# - Creates 15 persistent sessions
# - Configures auto-restore after reboot
# - Sets up systemd service for auto-start
```

#### After running, you get:

- ✅ **FULL MOUSE SUPPORT** - scroll, click panes, select text, resize
- ✅ 15 numbered sessions (1-15)
- ✅ Sessions persist across reboots
- ✅ Auto-save every 15 minutes
- ✅ Pane contents preserved

### Step 2: On Your Local Computer (Laptop/Desktop)

```bash
# 1. Copy the setup-tmux-aliases.sh script to your local machine
scp ubuntu@[PI-IP]:/home/ubuntu/projects/Argos/scripts/setup-tmux-aliases.sh ~/

# 2. Run it with your Pi's IP address
./setup-tmux-aliases.sh [PI-IP-ADDRESS] ubuntu Dragon

# Example with actual IP:
./setup-tmux-aliases.sh 192.168.1.100 ubuntu Dragon

# What this does:
# - Creates aliases like Dragon-1, Dragon-2, etc.
# - Adds them to your .bashrc/.zshrc
# - Allows instant connection to any tmux session
```

#### After running, you can:

```bash
Dragon-1     # Connect to tmux session 1 on the Pi
Dragon-2     # Connect to tmux session 2 on the Pi
Dragon-list  # See all tmux sessions on the Pi
Dragon-help  # Show all available commands
```

---

## Usage Scenarios

### Scenario 1: Fresh DragonOS Install (On the Pi itself)

```bash
# You're sitting at the Pi with keyboard/monitor attached
cd ~/projects/Argos
./scripts/setup-tmux-persistent.sh

# Test mouse support
tmux attach -t 1
# Now you can:
# - Click on panes to switch
# - Drag pane borders to resize
# - Scroll with mouse wheel
# - Select text with mouse
```

### Scenario 2: Remote Access Setup (From your laptop)

```bash
# You're on your laptop, want to access Pi's tmux sessions
# First, get the script from the Pi
scp ubuntu@192.168.1.100:~/projects/Argos/scripts/setup-tmux-aliases.sh ~/

# Run it locally on your laptop
./setup-tmux-aliases.sh 192.168.1.100 ubuntu Dragon

# Now you can instantly connect
Dragon-1  # Connects via SSH to tmux session 1
```

### Scenario 3: Daily Use

```bash
# From your laptop, after aliases are set up:
Dragon-1        # Work on main development
Dragon-2        # Monitor HackRF output
Dragon-3        # Watch Kismet scanning
Dragon-list     # Check what's running
Dragon-status   # See system status
```

---

## Mouse Control Features

When you run `setup-tmux-persistent.sh` on the Pi, you get:

| Feature          | How to Use                        |
| ---------------- | --------------------------------- |
| **Switch Panes** | Click on any pane                 |
| **Resize Panes** | Drag the pane borders             |
| **Scroll**       | Use mouse wheel                   |
| **Select Text**  | Click and drag                    |
| **Copy**         | Select text, it auto-copies       |
| **Paste**        | Middle-click (terminal dependent) |

---

## Important Notes

1. **Script Location Matters**:
    - `setup-tmux-persistent.sh` → Run ON the Pi
    - `setup-tmux-aliases.sh` → Run on your LOCAL computer

2. **Mouse Support**:
    - Only works when you're IN a tmux session
    - Works both locally and over SSH
    - Some terminals handle it better than others

3. **Session Persistence**:
    - Sessions auto-save every 15 minutes
    - Survive reboots automatically
    - Manual save: `Ctrl+b, Ctrl+s`
    - Manual restore: `Ctrl+b, Ctrl+r`

4. **If Sessions Don't Persist After Reboot**:

    ```bash
    # Check if systemd service is running
    systemctl --user status tmux-server.service

    # If not, enable it
    systemctl --user enable tmux-server.service
    systemctl --user start tmux-server.service
    ```

---

## Quick Commands Reference

### On the Pi (Local)

```bash
tmux ls                    # List sessions
tmux attach -t 1          # Attach to session 1
tmux kill-session -t 1    # Kill session 1
tmux kill-server          # Kill all sessions
```

### From Remote (After aliases setup)

```bash
Dragon-1                  # Connect to session 1
Dragon-list              # List all sessions
Dragon-killall           # Kill all sessions
Dragon-save              # Force save all sessions
Dragon-restore           # Force restore sessions
```

---

## Troubleshooting

### Mouse not working?

```bash
# Check if mouse is enabled in tmux
tmux show -g mouse
# Should return: mouse on

# If not, enable it
tmux set -g mouse on
```

### Sessions not persisting?

```bash
# Check plugins are installed
ls ~/.tmux/plugins/
# Should show: tpm, tmux-resurrect, tmux-continuum

# Reinstall plugins
~/.tmux/plugins/tpm/bin/install_plugins
```

### Aliases not working?

```bash
# Source the aliases file
source ~/.argos_tmux_aliases

# Check if added to shell config
grep argos_tmux_aliases ~/.bashrc
```
