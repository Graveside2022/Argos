# media-service Dockerfile — Multi-stage build for GStreamer + Python on aarch64
# Stage 1: Install apt GStreamer 1.22 + Python deps
# Stage 2: Build gst-plugins-rs 1.28.1 from source (Whisper, YOLOX, WebRTC, AudioFX)
# Stage 3: Runner — copies built .so plugins + Python source

# ── Stage 1: Dependencies ─────────────────────────────────
FROM debian:bookworm-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-gi \
    python3-gst-1.0 \
    gir1.2-gst-plugins-base-1.0 \
    gir1.2-gstreamer-1.0 \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-alsa \
    gstreamer1.0-pulseaudio \
    gstreamer1.0-libav \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

# ── Stage 2: Rust plugin builder ──────────────────────────
FROM deps AS rust-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    pkg-config \
    meson \
    ninja-build \
    nasm \
    libssl-dev \
    libnice-dev \
    libglib2.0-dev \
    libopus-dev \
    libsrtp2-dev \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Clone gst-plugins-rs at 1.28.1 tag and build selected plugins
# NOTE: This build takes 30-60 minutes on Pi 5. Consider pre-building
# and caching the .so files in a registry for faster iteration.
ARG GST_PLUGINS_RS_TAG=gstreamer-1.28.1

RUN git clone --depth 1 --branch ${GST_PLUGINS_RS_TAG} \
    https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs.git \
    /opt/gst-plugins-rs || \
    echo "WARN: gst-plugins-rs clone failed — Rust plugins unavailable"

# Build only the plugins we need (if clone succeeded)
RUN if [ -d /opt/gst-plugins-rs ]; then \
    cd /opt/gst-plugins-rs && \
    cargo build --release \
        -p gst-plugin-whisper \
        -p gst-plugin-rswebrtc \
        -p gst-plugin-audiofx \
    2>/dev/null || echo "WARN: Some Rust plugins failed to build"; \
    fi

# Collect built .so files
RUN mkdir -p /opt/gst-rs-plugins && \
    if [ -d /opt/gst-plugins-rs/target/release ]; then \
        find /opt/gst-plugins-rs/target/release -name 'libgst*.so' \
            -exec cp {} /opt/gst-rs-plugins/ \; ; \
    fi

# ── Stage 3: Runner ───────────────────────────────────────
FROM deps AS runner

LABEL maintainer="Argos EW Team"
LABEL description="GStreamer media pipeline service for Argos"

# Copy Rust-built GStreamer plugins
COPY --from=rust-builder /opt/gst-rs-plugins/ /usr/lib/gstreamer-1.0/

# Create directories
RUN mkdir -p /data/recordings /data/exports /models

# Copy application source
COPY src/ /app/src/
COPY config/ /app/config/

WORKDIR /app

# Health check — verify GStreamer and Python can initialize
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python3 -c "import gi; gi.require_version('Gst', '1.0'); from gi.repository import Gst; Gst.init(None); print('ok')" || exit 1

# Run the media service
CMD ["python3", "-u", "src/main.py"]
