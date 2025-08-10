# Tmux Setup with Full Mouse Support

## ON THE PI:

```bash
cd ~/projects/Argos
./scripts/setup-tmux-persistent.sh
```

**✅ FULL MOUSE SUPPORT ENABLED** - Click panes, drag borders, scroll with wheel, select text

## ON YOUR MAC:

```bash
# Get the script
scp ubuntu@[PI-IP]:~/projects/Argos/scripts/setup-tmux-aliases.sh ~/

# Run it with your Pi's IP
./setup-tmux-aliases.sh [PI-IP] ubuntu Dragon

# Reload shell
source ~/.zshrc

# Connect to any session
Dragon-1   # Connect to session 1
Dragon-2   # Connect to session 2
# ... etc
```

## What You Get:

- **15 persistent tmux sessions** on the Pi
- **Full mouse control** in all sessions
- **Quick aliases** on your Mac to connect instantly
- **Sessions survive reboots** automatically

## Mouse Features:

- Click to switch panes
- Drag borders to resize
- Scroll with mouse wheel
- Click and drag to select text
- Auto-copies selection to clipboard

That's it. Two scripts, two commands.
