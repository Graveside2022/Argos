#!/bin/bash
# Tmux SSH Session Aliases Setup for Argos Project
# This script creates convenient aliases for remote tmux access

# Configuration
REMOTE_HOST="${1:-100.112.117.73}"  # Default to your IP, can override with argument
REMOTE_USER="${2:-ubuntu}"          # Default to ubuntu user
ALIAS_PREFIX="${3:-Dragon}"         # Default prefix for aliases

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up tmux SSH aliases for $REMOTE_USER@$REMOTE_HOST${NC}"

# Create aliases file
ALIAS_FILE="$HOME/.argos_tmux_aliases"

cat > "$ALIAS_FILE" << EOF
# ============================================
# Argos Tmux SSH Session Aliases
# Generated on $(date)
# Host: $REMOTE_HOST
# ============================================

# Numbered session aliases with descriptions
alias ${ALIAS_PREFIX}-1="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 1 || tmux new-session -s 1 -n Main'"
alias ${ALIAS_PREFIX}-2="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 2 || tmux new-session -s 2 -n HackRF'"
alias ${ALIAS_PREFIX}-3="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 3 || tmux new-session -s 3 -n Kismet'"
alias ${ALIAS_PREFIX}-4="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 4 || tmux new-session -s 4 -n GSM-Evil'"
alias ${ALIAS_PREFIX}-5="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 5 || tmux new-session -s 5 -n USRP'"
alias ${ALIAS_PREFIX}-6="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 6 || tmux new-session -s 6 -n Monitoring'"
alias ${ALIAS_PREFIX}-7="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 7 || tmux new-session -s 7 -n Database'"
alias ${ALIAS_PREFIX}-8="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 8 || tmux new-session -s 8 -n WebSocket'"
alias ${ALIAS_PREFIX}-9="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 9 || tmux new-session -s 9 -n Testing'"
alias ${ALIAS_PREFIX}-10="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 10 || tmux new-session -s 10 -n Logs'"
alias ${ALIAS_PREFIX}-11="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 11 || tmux new-session -s 11 -n Development'"
alias ${ALIAS_PREFIX}-12="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 12 || tmux new-session -s 12 -n Debug'"
alias ${ALIAS_PREFIX}-13="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 13 || tmux new-session -s 13 -n Analysis'"
alias ${ALIAS_PREFIX}-14="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 14 || tmux new-session -s 14 -n Scripts'"
alias ${ALIAS_PREFIX}-15="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 15 || tmux new-session -s 15 -n Backup'"

# Service-specific aliases
alias ${ALIAS_PREFIX}-hackrf="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 2 || tmux new-session -s 2 -n HackRF'"
alias ${ALIAS_PREFIX}-kismet="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 3 || tmux new-session -s 3 -n Kismet'"
alias ${ALIAS_PREFIX}-gsm="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 4 || tmux new-session -s 4 -n GSM-Evil'"
alias ${ALIAS_PREFIX}-usrp="ssh -t $REMOTE_USER@$REMOTE_HOST 'tmux attach-session -t 5 || tmux new-session -s 5 -n USRP'"

# Management aliases
alias ${ALIAS_PREFIX}-list="ssh $REMOTE_USER@$REMOTE_HOST 'tmux list-sessions'"
alias ${ALIAS_PREFIX}-killall="ssh $REMOTE_USER@$REMOTE_HOST 'tmux kill-server'"
alias ${ALIAS_PREFIX}-status="ssh $REMOTE_USER@$REMOTE_HOST 'echo \"=== Tmux Sessions ===\"; tmux list-sessions 2>/dev/null || echo \"No sessions\"; echo \"\n=== Argos Services ===\"; systemctl --user status argos-dev 2>/dev/null | head -n 3'"

# Advanced management
alias ${ALIAS_PREFIX}-save="ssh $REMOTE_USER@$REMOTE_HOST 'tmux run-shell ~/.tmux/plugins/tmux-resurrect/scripts/save.sh'"
alias ${ALIAS_PREFIX}-restore="ssh $REMOTE_USER@$REMOTE_HOST 'tmux run-shell ~/.tmux/plugins/tmux-resurrect/scripts/restore.sh'"
alias ${ALIAS_PREFIX}-new="ssh -t $REMOTE_USER@$REMOTE_HOST 'read -p \"Session name: \" name; tmux new-session -s \"\$name\"'"

# SSH with X11 forwarding for GUI apps
alias ${ALIAS_PREFIX}-gui="ssh -X $REMOTE_USER@$REMOTE_HOST"

# Quick command execution
alias ${ALIAS_PREFIX}-cmd="ssh $REMOTE_USER@$REMOTE_HOST"

# Help function
${ALIAS_PREFIX}-help() {
    echo "Argos Tmux SSH Aliases:"
    echo "  ${ALIAS_PREFIX}-1 to ${ALIAS_PREFIX}-15   : Connect to numbered sessions"
    echo "  ${ALIAS_PREFIX}-hackrf/kismet/gsm/usrp   : Connect to service sessions"
    echo "  ${ALIAS_PREFIX}-list                      : List all tmux sessions"
    echo "  ${ALIAS_PREFIX}-killall                   : Kill all tmux sessions"
    echo "  ${ALIAS_PREFIX}-status                    : Show system status"
    echo "  ${ALIAS_PREFIX}-save/restore              : Save/restore session state"
    echo "  ${ALIAS_PREFIX}-new                       : Create new named session"
    echo "  ${ALIAS_PREFIX}-gui                       : SSH with X11 forwarding"
    echo "  ${ALIAS_PREFIX}-cmd                       : Direct SSH access"
}
EOF

# Add to shell configuration
SHELL_RC="$HOME/.bashrc"
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

# Check if already sourced
if ! grep -q "argos_tmux_aliases" "$SHELL_RC"; then
    echo -e "\n# Argos tmux aliases" >> "$SHELL_RC"
    echo "[ -f ~/.argos_tmux_aliases ] && source ~/.argos_tmux_aliases" >> "$SHELL_RC"
    echo -e "${GREEN}Added aliases to $SHELL_RC${NC}"
else
    echo -e "${YELLOW}Aliases already in $SHELL_RC${NC}"
fi

# Source immediately for current session
source "$ALIAS_FILE"

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}Tmux SSH Aliases Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "\nAliases created with prefix: ${YELLOW}${ALIAS_PREFIX}-${NC}"
echo -e "Type ${YELLOW}${ALIAS_PREFIX}-help${NC} to see all available commands"
echo -e "\nTo use in current session: ${YELLOW}source ~/.argos_tmux_aliases${NC}"
echo -e "Aliases will be available automatically in new terminals"