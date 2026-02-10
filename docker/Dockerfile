# Multi-stage Dockerfile for Argos with Kismet support

# Stage 1: Dependencies
# Node 22 LTS — must match host version (v22.x) to ensure ABI compatibility
# for native modules (better-sqlite3) across host/container boundary.
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Install build tools required for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install production deps first (skip prepare scripts like husky)
# Then rebuild native modules (better-sqlite3) for the target architecture
RUN npm ci --only=production --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    cp -R node_modules prod_node_modules && \
    npm ci --ignore-scripts && \
    npm rebuild better-sqlite3

# Stage 2: Builder (Development with Kismet)
FROM node:22-bookworm AS builder
WORKDIR /app

# Install Kismet from official repository and wireless dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg \
    wget \
    ca-certificates \
    && wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | gpg --dearmor -o /usr/share/keyrings/kismet-archive-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release/bookworm bookworm main' > /etc/apt/sources.list.d/kismet.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    kismet \
    wireless-tools \
    iw \
    usbutils \
    pciutils \
    procps \
    curl \
    net-tools \
    gpsd-clients \
    zsh \
    git \
    fontconfig \
    unzip \
    bat \
    && rm -rf /var/lib/apt/lists/* \
    && echo "gps=gpsd:host=localhost,port=2947" > /etc/kismet/kismet_site.conf

# Install Oh My Zsh, Powerlevel10k, plugins, and tools
ENV RUNZSH=no CHSH=no HOME=/root
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended \
    && git clone --depth=1 https://github.com/romkatv/powerlevel10k.git /root/.oh-my-zsh/custom/themes/powerlevel10k \
    && git clone https://github.com/zsh-users/zsh-autosuggestions /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
    && git clone https://github.com/zsh-users/zsh-syntax-highlighting /root/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting \
    && git clone https://github.com/zsh-users/zsh-completions /root/.oh-my-zsh/custom/plugins/zsh-completions

# Install Nerd Fonts (MesloLGS NF for Powerlevel10k)
RUN mkdir -p /usr/share/fonts/truetype/meslo \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Regular.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Regular.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Italic.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Italic.ttf" \
    && wget -q "https://github.com/romkatv/powerlevel10k-media/raw/master/MesloLGS%20NF%20Bold%20Italic.ttf" -O "/usr/share/fonts/truetype/meslo/MesloLGS NF Bold Italic.ttf" \
    && fc-cache -fv

# Install Atuin (shell history sync)
RUN curl --proto '=https' --tlsv1.2 -LsSf https://setup.atuin.sh | sh

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy ZSH configuration files into the image (baked in, not mounted)
COPY docker/.zshrc /root/.zshrc
COPY docker/.p10k.zsh /root/.p10k.zsh

# Set ZSH as default shell
RUN chsh -s /bin/zsh root

# Fix ZSH "no matches found" error for /etc/profile.d/*.sh glob
# Create empty placeholder so glob doesn't fail in ZSH
RUN mkdir -p /etc/profile.d && touch /etc/profile.d/00-zsh-compat.sh

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy scripts for Kismet management
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Build the application
ENV NODE_ENV=production
ENV KISMET_API_URL=http://localhost:2501
ENV DATABASE_PATH=/app/rf_signals.db
RUN npm run build

# Stage 3: Runner (Production)
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies for Kismet from official repository
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg \
    wget \
    ca-certificates \
    && wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | gpg --dearmor -o /usr/share/keyrings/kismet-archive-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release/bookworm bookworm main' > /etc/apt/sources.list.d/kismet.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    kismet \
    wireless-tools \
    iw \
    usbutils \
    procps \
    curl \
    gpsd-clients \
    zsh \
    && rm -rf /var/lib/apt/lists/* \
    && echo "gps=gpsd:host=localhost,port=2947" > /etc/kismet/kismet_site.conf

# Copy production dependencies
COPY --from=deps /app/prod_node_modules ./node_modules

# Copy built application
COPY --from=builder /app/.svelte-kit ./.svelte-kit
COPY --from=builder /app/package.json ./package.json

# Copy scripts for Kismet management
COPY scripts ./scripts
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Copy static assets
COPY static ./static

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Expose ports (SvelteKit + Kismet)
EXPOSE 5173 2501

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173/health || exit 1

# Start the application (as root for hardware access)
CMD ["node", "build"]
