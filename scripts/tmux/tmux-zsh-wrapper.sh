#!/bin/bash
# Tmux + zsh wrapper for terminal (works in both container and host)

TMUX_SESSION="argos-claude"

# Start in appropriate directory
if [ -d "/app" ]; then
	# Inside Docker container
	cd /app || exit 1
else
	# On host - go to project root
	cd /home/kali/Documents/Argos/Argos || exit 1
fi

# Set terminal to support 256 colors and UTF-8
export TERM=xterm-256color
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Create or attach to tmux session with zsh and proper terminal support
# -A: Attach if exists, create if doesn't
# -s: Session name
# -2: Force 256 color support
# -u: Force UTF-8 support
exec tmux -2 -u new-session -A -s "${TMUX_SESSION}" zsh
