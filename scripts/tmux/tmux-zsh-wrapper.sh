#!/bin/bash
# Tmux + zsh wrapper for terminal

TMUX_SESSION="argos-claude"

# Start in project directory
cd /home/kali/Documents/Argos/Argos || exit 1

# Set terminal to support 256 colors and UTF-8
export TERM=xterm-256color
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Create or attach to tmux session with zsh and proper terminal support
# -A: Attach if exists, create if doesn't
# -s: Session name
# -2: Force 256 color support
# -u: Force UTF-8 support
# Resolve tmux config path
if [ -f "$(dirname "$0")/tmux.conf" ]; then
	TMUX_CONF="$(dirname "$0")/tmux.conf"
fi

exec tmux -2 -u ${TMUX_CONF:+-f "$TMUX_CONF"} new-session -A -s "${TMUX_SESSION}" zsh
