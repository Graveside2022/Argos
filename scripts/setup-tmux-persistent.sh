#!/bin/bash
# Complete tmux persistent setup for DragonOS/Lubuntu with mouse support
# Enhanced version for Argos project

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up persistent tmux with mouse support...${NC}"

# Update system and install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
sudo apt update && sudo apt install -y tmux git

# Create tmux plugin directory
mkdir -p ~/.tmux/plugins

# Clone tmux plugin manager (TPM) if not exists
if [ ! -d ~/.tmux/plugins/tpm ]; then
    echo -e "${YELLOW}Installing tmux plugin manager...${NC}"
    git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
fi

# Create comprehensive tmux configuration with persistence and mouse support
cat > ~/.tmux.conf << 'EOF'
# ============================================
# Argos Project Tmux Configuration
# ============================================

# List of plugins
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-yank'

# ============================================
# Persistence Configuration
# ============================================

# Enable automatic restore
set -g @continuum-restore 'on'
set -g @continuum-boot 'on'
set -g @continuum-save-interval '15'

# Resurrect settings - capture everything
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-strategy-vim 'session'
set -g @resurrect-strategy-nvim 'session'
set -g @resurrect-processes 'ssh npm node python python3 htop btop'

# ============================================
# Mouse Support Configuration
# ============================================

# Enable full mouse support
set -g mouse on

# Mouse wheel scrolling
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'copy-mode -e; send-keys -M'"
bind -n WheelDownPane select-pane -t= \; send-keys -M

# Mouse selection and copy
bind-key -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "xclip -selection clipboard -i"
bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "xclip -selection clipboard -i"

# ============================================
# Basic Settings
# ============================================

# Terminal settings
set -g default-terminal "screen-256color"
set -ga terminal-overrides ',*256col*:Tc'

# History and indexing
set -g history-limit 50000
set -g base-index 1
setw -g pane-base-index 1

# Renumber windows when one is closed
set -g renumber-windows on

# Activity monitoring
setw -g monitor-activity on
set -g visual-activity off

# ============================================
# Key Bindings
# ============================================

# Reload config
bind r source-file ~/.tmux.conf \; display-message "Config reloaded!"

# Split panes using | and -
bind | split-window -h
bind - split-window -v
unbind '"'
unbind %

# Switch panes using Alt-arrow without prefix
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# ============================================
# Status Bar Configuration
# ============================================

# Status bar colors
set -g status-bg black
set -g status-fg white
set -g status-interval 5
set -g status-left-length 30
set -g status-left '#[fg=green](#S) #(whoami)@#H '
set -g status-right '#[fg=yellow]#(cut -d " " -f 1-3 /proc/loadavg)#[default] #[fg=white]%H:%M#[default]'

# Window status
setw -g window-status-current-style fg=white,bg=red,bright
setw -g window-status-style fg=white,bg=default,dim

# ============================================
# Pane Configuration
# ============================================

# Pane borders
set -g pane-border-style fg=colour235
set -g pane-active-border-style fg=colour240

# ============================================
# Copy Mode Configuration
# ============================================

# Use vim keybindings in copy mode
setw -g mode-keys vi

# Setup 'v' to begin selection as in Vim
bind-key -T copy-mode-vi v send-keys -X begin-selection
bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -selection clipboard -i"

# Update default binding of `Enter` to also use copy-pipe
unbind -T copy-mode-vi Enter
bind-key -T copy-mode-vi Enter send-keys -X copy-pipe-and-cancel "xclip -selection clipboard -i"

# ============================================
# Initialize TMUX plugin manager 
# (keep this line at the very bottom)
# ============================================
run '~/.tmux/plugins/tpm/tpm'
EOF

# Install plugins
echo -e "${YELLOW}Installing tmux plugins...${NC}"
~/.tmux/plugins/tpm/bin/install_plugins

# Create systemd user service for tmux autostart
echo -e "${YELLOW}Setting up systemd service...${NC}"
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/tmux-server.service << 'EOF'
[Unit]
Description=Tmux server for Argos project
After=default.target

[Service]
Type=forking
ExecStart=/usr/bin/tmux new-session -d -s default
ExecStop=/usr/bin/tmux kill-server
Restart=on-failure
RestartSec=10
Environment="DISPLAY=:0"

[Install]
WantedBy=default.target
EOF

# Enable and start the service
systemctl --user daemon-reload
systemctl --user enable tmux-server.service
systemctl --user start tmux-server.service

# Kill existing sessions if requested
if [ "$1" == "--reset" ]; then
    echo -e "${YELLOW}Killing existing tmux sessions...${NC}"
    tmux kill-server 2>/dev/null || true
    sleep 2
fi

# Create initial named sessions for Argos project
echo -e "${YELLOW}Creating Argos tmux sessions...${NC}"
sessions=(
    "1:Main"
    "2:HackRF"
    "3:Kismet"
    "4:GSM-Evil"
    "5:USRP"
    "6:Monitoring"
    "7:Database"
    "8:WebSocket"
    "9:Testing"
    "10:Logs"
    "11:Development"
    "12:Debug"
    "13:Analysis"
    "14:Scripts"
    "15:Backup"
)

for session in "${sessions[@]}"; do
    IFS=':' read -r num name <<< "$session"
    if ! tmux has-session -t "$num" 2>/dev/null; then
        tmux new-session -d -s "$num" -n "$name"
        echo -e "${GREEN}Created session $num ($name)${NC}"
    else
        echo -e "${YELLOW}Session $num already exists${NC}"
    fi
done

# Apply configuration to running server
tmux source-file ~/.tmux.conf 2>/dev/null || true

# Display session information
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}Tmux Persistent Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "\n${YELLOW}Current tmux sessions:${NC}"
tmux list-sessions

echo -e "\n${YELLOW}Mouse support features enabled:${NC}"
echo "  • Click to select panes"
echo "  • Drag to resize panes"
echo "  • Scroll with mouse wheel"
echo "  • Click and drag to select text"
echo "  • Right-click to paste (if terminal supports)"

echo -e "\n${YELLOW}Keyboard shortcuts:${NC}"
echo "  • Ctrl+b r    - Reload configuration"
echo "  • Ctrl+b |    - Split vertically"
echo "  • Ctrl+b -    - Split horizontally"
echo "  • Alt+Arrows  - Switch panes"
echo "  • Ctrl+b [    - Enter copy mode"
echo "  • v           - Start selection (in copy mode)"
echo "  • y           - Copy selection (in copy mode)"

echo -e "\n${YELLOW}Session persistence:${NC}"
echo "  • Sessions auto-save every 15 minutes"
echo "  • Sessions will auto-restore after reboot"
echo "  • Pane contents are preserved"

echo -e "\n${YELLOW}To attach to a session:${NC}"
echo "  tmux attach -t <session-number>"
echo -e "\n${GREEN}Setup complete!${NC}\n"