# Argos CI/CD Dockerfile — Lean build for testing and production images
# Argos runs natively on the host during development. This Dockerfile is
# only used for CI/CD builds and optional containerized deployment.

# Stage 1: Dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm ci --only=production --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    cp -R node_modules prod_node_modules && \
    npm ci --ignore-scripts && \
    npm rebuild better-sqlite3

# Stage 2: Builder
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wireless-tools iw usbutils procps curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV KISMET_API_URL=http://localhost:2501
ENV DATABASE_PATH=/app/rf_signals.db
RUN npm run build

# Stage 3: Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wireless-tools iw usbutils procps curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/prod_node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY static ./static

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173/api/health || exit 1

CMD ["node", "build"]
