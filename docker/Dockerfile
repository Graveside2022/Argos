# Multi-stage Dockerfile for Argos with Kismet support

# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production deps first (skip prepare scripts like husky)
RUN npm ci --only=production --ignore-scripts && \
    cp -R node_modules prod_node_modules && \
    npm ci --ignore-scripts

# Stage 2: Builder (Development with Kismet)
FROM node:20-bookworm AS builder
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
    && rm -rf /var/lib/apt/lists/* \
    && echo "gps=gpsd:host=localhost,port=2947" > /etc/kismet/kismet_site.conf

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
FROM node:20-bookworm-slim AS runner
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
    && rm -rf /var/lib/apt/lists/* \
    && echo "gps=gpsd:host=localhost,port=2947" > /etc/kismet/kismet_site.conf

# Copy production dependencies
COPY --from=deps /app/prod_node_modules ./node_modules

# Copy built application
COPY --from=builder /app/build ./build
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
