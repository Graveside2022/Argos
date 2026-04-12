# Argos NovaSDR Dockerfile
#
# Builds NovaSDR (https://github.com/Steven9101/NovaSDR) pinned to a release
# tag into a runtime image that shares the HackRF with openwebrx-hackrf.
#
# Divergences from upstream NovaSDR Dockerfile:
#   - Clones from a pinned git tag (NOVASDR_REF build arg) rather than
#     assuming the repo is the build context, so this Dockerfile lives in
#     the Argos repo and not the NovaSDR repo.
#   - CPU-only build (--features "soapysdr"), no clfft/vkfft. GPU FFT
#     support is unreliable on RPi 5 VideoCore VII.
#   - Installs soapysdr0.8-module-hackrf in the runtime stage — upstream
#     only ships the RTL-SDR driver.
#   - Skips ws_probe (we only need novasdr-server).
#
# Build:
#   docker compose --profile tools build novasdr
# Override version:
#   docker compose --profile tools build --build-arg NOVASDR_REF=0.3.8 novasdr

ARG NOVASDR_REF=0.3.7

# ============================================================================
# Stage 1: Clone NovaSDR source (pinned to a release tag)
# ============================================================================
FROM debian:bookworm-slim AS source

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ARG NOVASDR_REF
RUN git clone --recurse-submodules --depth 1 --branch ${NOVASDR_REF} \
    https://github.com/Steven9101/NovaSDR.git /src

# ============================================================================
# Stage 2: Build the frontend (Node/Vite)
# ============================================================================
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY --from=source /src/frontend/package*.json ./
RUN npm ci

COPY --from=source /src/frontend/ ./
RUN npm run build

# ============================================================================
# Stage 3: Build the Rust backend (SoapySDR from source, no clfft)
# ============================================================================
FROM rustlang/rust:nightly-bookworm-slim AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config \
    clang libclang-dev \
    swig python3 python3-dev python3-numpy \
    libusb-1.0-0-dev libopus-dev libhackrf-dev \
    git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build SoapySDR core from source — matches upstream NovaSDR Dockerfile for
# maximum compatibility with the novasdr-server Rust bindings.
RUN git clone https://github.com/pothosware/SoapySDR.git /tmp/SoapySDR && \
    cd /tmp/SoapySDR && \
    mkdir build && cd build && \
    cmake .. && \
    make -j"$(nproc)" && \
    make install && \
    ldconfig && \
    rm -rf /tmp/SoapySDR

# Build SoapyHackRF from source against the source-built SoapySDR core so the
# HackRF plugin ABI matches (0.8-3). The apt-packaged soapysdr0.8-module-hackrf
# is ABI 0.8 and is rejected at load time by the newer core.
RUN git clone https://github.com/pothosware/SoapyHackRF.git /tmp/SoapyHackRF && \
    cd /tmp/SoapyHackRF && \
    mkdir build && cd build && \
    cmake .. && \
    make -j"$(nproc)" && \
    make install && \
    ldconfig && \
    rm -rf /tmp/SoapyHackRF

WORKDIR /build
COPY --from=source /src/Cargo.toml ./
COPY --from=source /src/Cargo.lock* ./
COPY --from=source /src/crates/ ./crates/

# Build novasdr-server with CPU-only SoapySDR feature (no clfft/vkfft).
RUN cargo build --release --features "soapysdr" -p novasdr-server

# ============================================================================
# Stage 4: Minimal runtime image
# ============================================================================
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libusb-1.0-0 libopus0 \
    libhackrf0 \
    && rm -rf /var/lib/apt/lists/*

# Copy source-built SoapySDR core shared libraries + the source-built SoapyHackRF
# plugin from the backend builder stage. Both match ABI 0.8-3 because they were
# compiled against the same SoapySDR headers. libhackrf0 (apt) provides the
# runtime library the plugin dlopen()s.
COPY --from=backend-builder /usr/local/lib/libSoapySDR* /usr/local/lib/
COPY --from=backend-builder /usr/local/lib/SoapySDR /usr/local/lib/SoapySDR
COPY --from=backend-builder /usr/local/bin/SoapySDRUtil /usr/local/bin/
RUN ldconfig

# Copy the NovaSDR binary and built frontend.
COPY --from=backend-builder /build/target/release/novasdr-server /app/novasdr-server
COPY --from=frontend-builder /build/dist /app/frontend/dist

# Copy resources (default bands, etc.) from the source stage.
COPY --from=source /src/crates/novasdr-server/resources/ /app/resources/

WORKDIR /app
EXPOSE 9002

# Config is bind-mounted from the host at runtime under /config.
CMD ["/app/novasdr-server", "-c", "/config/config.json", "-r", "/config/receivers.json"]
