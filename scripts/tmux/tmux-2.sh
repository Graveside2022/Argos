#!/bin/bash
# VS Code Terminal Profile: Tmux 2
# Independent tmux session for secondary development work
# Based on: scripts/tmux-zsh-wrapper.sh (application use - do not modify)

TMUX_SESSION="tmux-2"

# Start in project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.." || exit 1

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
