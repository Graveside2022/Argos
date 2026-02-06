#!/bin/bash
# Setup script for ZSH environment in Argos container
# Installs: Oh My Zsh, Powerlevel10k, plugins, Atuin, Nerd Fonts, Claude Code

set -e

echo "=== Setting up ZSH environment ==="

# Install required packages
apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    fontconfig \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Oh My Zsh (unattended)
echo "Installing Oh My Zsh..."
export RUNZSH=no
export CHSH=no
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Install Powerlevel10k theme
echo "Installing Powerlevel10k..."
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k

# Install ZSH plugins
echo "Installing ZSH plugins..."
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-completions

# Install Nerd Fonts (MesloLGS NF - recommended for p10k)
echo "Installing Nerd Fonts (MesloLGS NF)..."
mkdir -p /usr/share/fonts/truetype/meslo
cd /tmp
wget -q https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Regular.ttf -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Regular.ttf"
wget -q https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold.ttf -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold.ttf"
wget -q https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Italic.ttf -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Italic.ttf"
wget -q https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold%20Italic.ttf -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold Italic.ttf"
fc-cache -fv

# Install Atuin (shell history)
echo "Installing Atuin..."
curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh

# Install batcat
apt-get update && apt-get install -y --no-install-recommends bat && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
echo "Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

echo "=== Shell setup complete ==="
echo "Note: Copy your .zshrc and .p10k.zsh configs to complete the setup"
