# Research: GStreamer Media Pipeline Integration

**Feature**: 021-gstreamer-media-pipeline | **Date**: 2026-02-26

---

## Research Questions & Findings

### RQ-1: GStreamer 1.28 Capabilities for Argos Use Cases

**Decision**: Use GStreamer 1.28.1 (released 25 February 2026) as the media framework. Build the Rust plugin set (`gst-plugins-rs`) from source for Whisper, Demucs, YOLOX, and WebRTC elements.

**Finding**: GStreamer 1.28 introduced a significant ML/AI inference layer, making it the first general-purpose media framework with native speech-to-text, object detection, and audio source separation integrated directly into the pipeline graph. Key elements relevant to Argos:

| Element                         | Plugin Set              | Language | Argos Use Case                           |
| ------------------------------- | ----------------------- | -------- | ---------------------------------------- |
| Whisper STT                     | gst-plugins-rs (1.28.1) | Rust     | Radio transcription (US-1)               |
| Demucs source separation        | gst-plugins-rs          | Rust     | Audio cleanup (US-2)                     |
| YOLOX tensor decoder            | gst-plugins-rs          | Rust     | Object detection (US-3)                  |
| ONNX Runtime inference          | gst-plugins-bad         | C        | Alternative inference backend for YOLOX  |
| LiteRT inference                | gst-plugins-bad         | C        | Lightweight inference for Pi 5 NPU       |
| `webrtcsink` / `webrtcsrc`      | gst-plugins-rs          | Rust     | Browser streaming (US-4)                 |
| `objectdetectionoverlay`        | gst-plugins-rs          | Rust     | Bounding box rendering (US-3)            |
| IoU object tracker              | gst-plugins-rs          | Rust     | Cross-frame detection correlation        |
| `facedetector`                  | gst-plugins-rs          | Rust     | Optional face detection (US-3)           |
| RTSP server (`gst-rtsp-server`) | Core library            | C        | TAK video export (US-5)                  |
| `deepgramtranscriber`           | gst-plugins-rs          | Rust     | Cloud STT fallback (if Whisper too slow) |
| `analyticscombiner`             | gst-plugins-rs          | Rust     | Multi-stream batching                    |

**Rationale**: No other framework combines audio transcription, source separation, video inference, WebRTC streaming, and RTSP serving in a single pipeline graph with Python control bindings. FFmpeg handles codec work but has no pipeline management, ML inference, or dynamic element linking. GNURadio is too heavy for Pi 5.

**Alternatives considered**:

- **FFmpeg + standalone Whisper + OpenCV DNN**: Three separate processes, manual thread management, no dynamic pipeline modification (e.g., can't add/remove recording sink at runtime without restarting).
- **GNURadio**: Designed for SDR signal processing, not media processing. 2-4x the memory footprint of GStreamer on Pi 5. No native video, no WebRTC, no ML inference.
- **Custom Python pipeline (PyAudio + whisper.cpp + OpenCV)**: Maximum flexibility but no framework benefits — must implement buffering, thread safety, error recovery, format negotiation, and streaming protocols manually.

---

### RQ-2: GStreamer Version Strategy — Apt Base + Rust Plugins from Source

**Decision**: Install GStreamer base from Debian Bookworm apt (1.22.x) and build `gst-plugins-rs` from the GStreamer 1.28.1 monorepo for the Rust-based ML/AI elements.

**Finding**: Debian Bookworm ships GStreamer 1.22.x. The core C elements (alsasrc, audioconvert, audioresample, v4l2src, videoconvert, tee, queue, filesink, oggmux, vorbisenc) are stable across versions and work from apt. The 1.28-specific features live exclusively in the Rust plugin set (`gst-plugins-rs`), which compiles against the system GStreamer headers.

**Build approach**:

```
1. apt-get install gstreamer1.0-* (base C plugins, 1.22.x)
2. Clone GStreamer monorepo at tag 1.28.1
3. Build only gst-plugins-rs with meson (Whisper, YOLOX, WebRTC, Demucs, audiofx)
4. Install .so files to /usr/local/lib/gstreamer-1.0/
5. Verify with gst-inspect-1.0
```

**Build time estimate**: 30-60 minutes natively on Pi 5. Cross-compilation from x86_64 to aarch64 is faster but requires a properly configured meson cross-file.

**Alternative rejected**: Building the entire GStreamer monorepo from source (1.28.1). This is unnecessary — the base C plugins from apt are sufficient, and a full build takes 2+ hours on Pi 5.

---

### RQ-3: Audio Ingest from DSD-FME — ALSA Loopback vs Named Pipe

**Decision**: ALSA loopback (preferred) with named pipe fallback.

**Option A — ALSA Loopback (`snd-aloop`)**:

```bash
# Load kernel module
sudo modprobe snd-aloop
# DSD-FME outputs to hw:Loopback,0,0
# GStreamer reads from hw:Loopback,1,0
```

Advantages:

- Kernel-level audio routing — zero-copy, no user-space buffering
- Works with any application that outputs via ALSA (DSD-FME doesn't need modification)
- Handles sample rate and format negotiation transparently
- Survives application restarts (loopback device persists)

Disadvantages:

- Requires `snd-aloop` kernel module (available on Kali Linux / Debian Bookworm)
- Adds a virtual sound card to the system (may confuse other audio applications)
- Requires correct device naming (hw:Loopback,1,0 — the capture side)

**Option B — Named Pipe (FIFO)**:

```bash
mkfifo /tmp/dsd-fme-audio
# DSD-FME writes raw PCM to /tmp/dsd-fme-audio
# GStreamer reads via: filesrc location=/tmp/dsd-fme-audio ! rawaudioparse ! ...
```

Advantages:

- Simple, no kernel module needed
- Works on any Linux system

Disadvantages:

- Requires DSD-FME to be configured to output to the FIFO
- No format negotiation — must hardcode sample rate and format
- Blocking I/O semantics can cause pipeline stalls if writer stops

**Rationale**: ALSA loopback is the standard approach for inter-application audio routing on Linux. It requires no changes to DSD-FME and handles format negotiation at the kernel level. The named pipe fallback is for environments where `snd-aloop` is unavailable.

---

### RQ-4: Whisper Model Selection for Pi 5

**Decision**: Default to Whisper "base" model (~142 MB). Allow operator to select "small" (~466 MB) if RAM permits.

| Model  | Size   | RAM (inference) | Speed on Pi 5 (est.) | WER (Word Error Rate) |
| ------ | ------ | --------------- | -------------------- | --------------------- |
| tiny   | 39 MB  | ~60 MB          | ~0.5x real-time      | ~12%                  |
| base   | 142 MB | ~200 MB         | ~1.2x real-time      | ~8%                   |
| small  | 466 MB | ~400 MB         | ~3x real-time        | ~5%                   |
| medium | 1.5 GB | ~1.2 GB         | Too slow             | ~4%                   |

**Rationale**: "Base" provides the best speed/accuracy tradeoff for real-time transcription on Pi 5. At ~1.2x real-time, 5 seconds of audio takes ~6 seconds to transcribe — within the 5-second latency target (SC-001) when processing in overlapping chunks. "Small" is more accurate but ~3x real-time, which means 5 seconds of audio takes ~15 seconds — too slow for real-time display but acceptable for batch processing.

**Radio-specific concern**: Whisper was trained on clean speech and podcast audio. Compressed, noisy radio traffic with military jargon will have higher WER than the benchmarks above. Audio cleanup (US-2) feeding cleaned audio into Whisper is expected to improve accuracy by 20-40% based on published source separation + ASR studies.

---

### RQ-5: Demucs Feasibility on Pi 5

**Decision**: Attempt Demucs first. If CPU exceeds 40% threshold, fall back to GStreamer built-in noise suppression.

**Finding**: Demucs `htdemucs_ft` model performs audio source separation — isolating voice from noise, music, and interference. On desktop hardware, it runs at ~10x real-time. On Pi 5 (ARM Cortex-A76 @ 2.4 GHz, no GPU acceleration), estimated performance is ~1.5-2.5x real-time, consuming 20-35% CPU and ~300 MB RAM.

**Risk**: HIGH likelihood that Demucs is too resource-intensive for real-time operation alongside Whisper transcription. Running both simultaneously would consume ~55-60% CPU and ~500 MB RAM, leaving insufficient headroom for the SvelteKit app and other services.

**Fallback chain**:

1. **Demucs** (best quality) — if CPU < 40% with all pipelines running
2. **GStreamer `webrtcdsp`** (good quality) — built-in WebRTC-based noise suppression, < 5% CPU
3. **GStreamer `audiodynamic`** (basic) — simple dynamic range compression, < 1% CPU
4. **Bypass** (no processing) — raw audio passthrough, 0% CPU

**Benchmark plan**: Phase 2 implementation must include a benchmark step that measures Demucs CPU/RAM on Pi 5 with a 30-second test clip before enabling it in production configuration.

---

### RQ-6: MQTT Architecture — New Bus or Extend Existing WebSocket

**Decision**: Add Mosquitto MQTT broker as a new Docker service. The media-service communicates exclusively via MQTT. The SvelteKit UI bridges MQTT to the browser via a WebSocket-to-MQTT proxy (or MQTT over WebSocket).

**Finding**: Argos currently uses WebSocket (via `ws` library) and Server-Sent Events (SSE) for real-time communication. There is no MQTT broker in the stack. The media-service runs in a separate Docker container, so it cannot directly access the SvelteKit WebSocket server.

**Why MQTT instead of extending WebSocket**:

1. **Container isolation**: The media-service is a Python process in a separate container. It cannot import SvelteKit's `WebSocketManager`. MQTT provides a language-agnostic message bus.
2. **Pub/sub semantics**: MQTT topics map directly to media events (transcription, detection, health). Multiple consumers can subscribe without coordination.
3. **Reliability**: MQTT QoS levels provide at-least-once delivery guarantees. WebSocket has no built-in message acknowledgment.
4. **Existing ecosystem**: Mosquitto is battle-tested, runs in < 10 MB RAM, and has clients for Python (`paho-mqtt`) and JavaScript (`mqtt.js`).
5. **Future multi-node**: When Argos scales to multi-node (mesh networking), MQTT bridges between nodes naturally. WebSocket is point-to-point.

**Integration with existing WebSocket**:

The SvelteKit server subscribes to MQTT topics and re-broadcasts to existing WebSocket clients. This preserves the current UI subscription model while adding MQTT as the backend bus. A thin MQTT-to-WebSocket bridge in `src/lib/server/` handles this:

```
media-service → MQTT (Mosquitto) → SvelteKit server (MQTT subscriber)
                                  → WebSocket broadcast → Browser clients
```

Alternatively, Mosquitto's built-in WebSocket listener (port 9001) can allow the browser to subscribe directly — bypassing the SvelteKit server for media events.

**Alternatives considered**:

- Extending the existing WebSocket server to accept connections from media-service: Would require exposing the WebSocket server to Docker's network, adding Python WebSocket client code, and breaking the current auth model.
- Redis Pub/Sub: Heavier than MQTT, no built-in WebSocket bridge, adds another dependency.
- Direct HTTP polling from media-service to SvelteKit: High latency, wasteful, doesn't support push semantics.

---

### RQ-7: YOLOX Model Selection for Pi 5

**Decision**: YOLOX "nano" ONNX model (~4 MB). Target 10-15 FPS at 640x480 resolution.

| Model      | Size   | Params | FPS on Pi 5 (est.)  | mAP (COCO val) |
| ---------- | ------ | ------ | ------------------- | -------------- |
| YOLOX-Nano | 3.9 MB | 0.91M  | 10-15 FPS @ 640x480 | 25.8%          |
| YOLOX-Tiny | 20 MB  | 5.06M  | 5-8 FPS @ 640x480   | 32.8%          |
| YOLOX-S    | 35 MB  | 9.0M   | 2-4 FPS @ 640x480   | 40.5%          |

**Rationale**: Nano is the only variant that maintains acceptable frame rates on Pi 5 CPU-only inference. The lower mAP (25.8%) is sufficient for person/vehicle detection at tactical ranges (< 50 meters). For higher accuracy needs, resolution can be reduced to 320x240 to recover FPS headroom.

**Inference backend options in GStreamer 1.28**:

1. **Burn framework** (Rust, compile-time model) — built-in YOLOX support, most efficient
2. **ONNX Runtime** (C) — flexible, supports VeriSilicon NPU backend for SoCs with NPUs
3. **LiteRT** (C, formerly TF Lite) — embedded-optimized, uses ModelInfo sidecar file

For Pi 5 (no NPU), Burn or ONNX Runtime with CPU execution provider are equivalent. Burn avoids the ONNX Runtime dependency.

---

### RQ-8: WebRTC Streaming to Browser

**Decision**: Use `webrtcsink` from gst-plugins-rs for both audio and video streaming to the SvelteKit UI. WHEP (WebRTC-HTTP Egress Protocol) for signaling.

**Finding**: GStreamer 1.28 provides three WebRTC approaches:

1. **`webrtcsink`** (high-level) — serves a fixed set of streams to any number of browser consumers. Handles SDP negotiation, ICE, DTLS, and codec selection automatically. Supports WHEP signaling for simple HTTP-based session establishment.
2. **`webrtcbin`** (low-level) — full control over SDP, ICE, and transceivers. More complex API.
3. **WHIP/WHEP elements** — HTTP-based signaling compatible with Dolby Millicast, LiveKit, Cloudflare Stream.

**`webrtcsink`** is the right choice for Argos because:

- Single element handles all browser delivery
- No external signaling server needed (built-in WHEP)
- Automatically negotiates codecs (Opus for audio, VP8/H.264 for video)
- Supports multiple simultaneous browser consumers
- Works with standard browser WebRTC APIs (`RTCPeerConnection`)

**SvelteKit integration**: The browser uses `RTCPeerConnection` to connect to the `webrtcsink` WHEP endpoint. The SvelteKit UI components (`AudioPlayer.svelte`, `VideoFeed.svelte`) create peer connections and attach incoming streams to `<audio>` and `<video>` elements.

**Fallback**: If WebRTC has browser compatibility issues, fall back to WebSocket-based audio chunks (PCM → Opus → WebSocket → AudioWorklet in browser). This is more fragile but works in all browsers.

---

### RQ-9: Docker Container Architecture

**Decision**: Single `media-service` container running GStreamer + Python, alongside a `mosquitto` container for MQTT.

**Finding**: Argos currently runs natively on the host in development, with Docker used for CI/CD and optional containerized deployment. Third-party tools (OpenWebrx, Bettercap) use Docker Compose with profiles. The media-service follows this pattern — it's a third-party-style service that runs alongside Argos.

**Container requirements**:

- **Base image**: `python:3.11-bookworm` (not Alpine — GStreamer needs glibc and extensive system libraries)
- **GStreamer from apt**: Core plugins from Debian Bookworm (1.22.x)
- **Rust plugins from source**: Built in a multi-stage Docker build, targeting GStreamer 1.28.1
- **Python deps**: `paho-mqtt`, `PyGObject` (GObject bindings for GStreamer control)
- **Device access**: ALSA (`/dev/snd`), USB camera (`/dev/video0`), both via volume mounts and group-add
- **Model files**: Mounted as read-only volume from `./models/` on host
- **Recordings**: Written to a Docker volume or bind-mounted directory

**Mosquitto container**:

- **Image**: `eclipse-mosquitto:2` (official, ~12 MB)
- **Ports**: 1883 (MQTT), 9001 (WebSocket for browser direct connect)
- **Config**: Allow anonymous connections within the Docker network (security handled at app level)
- **Persistence**: Messages are ephemeral (no persistence needed for real-time events)

---

### RQ-10: Existing Infrastructure Reuse Audit

| Need                           | Existing Argos Asset                                      | Reuse Strategy                                                        |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Docker Compose structure       | `docker/docker-compose.portainer-dev.yml`                 | Extend with `media-service` and `mosquitto` services                  |
| Dockerfile multi-stage pattern | `docker/Dockerfile`                                       | Follow same build pattern (deps → builder → runner)                   |
| WebSocket broadcast to UI      | `src/lib/server/kismet/web-socket-manager.ts`             | Add MQTT subscriber that re-broadcasts to WebSocket                   |
| TAK integration                | `src/lib/server/tak/tak-service.ts`                       | Media export hands files to tak-bridge via shared volume or MQTT      |
| Auto-reconnect pattern         | `src/lib/server/tak/tak-service.ts` (exponential backoff) | Mirror in Python BasePipeline class                                   |
| Health monitoring pattern      | `/api/hardware/status` endpoint + TopStatusBar            | Add media pipeline health alongside existing hardware health          |
| Database (SQLite)              | `src/lib/server/db/database.ts` + better-sqlite3          | Add transcription + detection tables via migration                    |
| Hardware detection             | `src/lib/server/hardware/detection/`                      | Extend to detect ALSA loopback and camera devices                     |
| Retry utilities                | `src/lib/server/retry.ts`                                 | Pattern reuse in MQTT bridge connection logic                         |
| Singleton pattern              | `globalThis` pattern in WebSocketManager                  | Pattern reuse for MQTT client singleton in SvelteKit server           |
| Service directory structure    | `src/lib/server/services/` subdirectories                 | Add `src/lib/server/services/media/` for MQTT bridge code             |
| UI component patterns          | Existing dashboard panels, health indicators              | Extend with media components (TranscriptionFeed, MediaControls, etc.) |
| Svelte store patterns          | `src/lib/stores/dashboard/`                               | Add media stores subscribed to MQTT-bridged WebSocket events          |

---

### RQ-11: MQTT Topic Design

**Decision**: Flat topic hierarchy under `argos/media/` prefix, matching the pattern used in the spec.

| Topic                              | Direction    | QoS | Payload                                                  | Rate              |
| ---------------------------------- | ------------ | --- | -------------------------------------------------------- | ----------------- |
| `argos/media/transcription`        | service → UI | 1   | `{ text, timestamp, confidence, duration_ms }`           | Per utterance     |
| `argos/media/detections`           | service → UI | 0   | `{ class, confidence, bbox, timestamp, camera_id }`      | Per detection     |
| `argos/media/health`               | service → UI | 0   | `{ timestamp, pipelines: {...}, system: {...} }`         | Every 5s          |
| `argos/media/errors`               | service → UI | 1   | `{ pipeline, error, debug, timestamp }`                  | On error          |
| `argos/media/recording/status`     | service → UI | 1   | `{ state, file, started, bytes_written }`                | On state change   |
| `argos/media/recording/command`    | UI → service | 1   | `{ action: "start" \| "stop" }`                          | On user action    |
| `argos/media/pipeline/command`     | UI → service | 1   | `{ pipeline, action: "start" \| "stop" \| "restart" }`   | On user action    |
| `argos/media/transcription/toggle` | UI → service | 1   | `{ enabled: bool }`                                      | On user toggle    |
| `argos/media/cleanup/toggle`       | UI → service | 1   | `{ enabled: bool }`                                      | On user toggle    |
| `argos/media/detection/toggle`     | UI → service | 1   | `{ enabled: bool }`                                      | On user toggle    |
| `argos/media/source/select`        | UI → service | 1   | `{ type: "camera" \| "audio", source_id }`               | On user selection |
| `argos/media/export/command`       | UI → service | 1   | `{ type: "audio_clip" \| "snapshot" \| "rtsp", params }` | On user action    |

**QoS rationale**: Control commands and transcription use QoS 1 (at-least-once) because dropped commands or transcripts are unacceptable. Detection events and health use QoS 0 (at-most-once) because they're high-frequency and a missed frame detection is tolerable.

---

## Summary

GStreamer 1.28.1 is a strong fit for Argos. The key technical risks are:

1. **Demucs on Pi 5** (HIGH risk) — mitigated by fallback chain
2. **Rust plugin compilation for aarch64** (MEDIUM risk) — mitigated by native build or Docker multi-stage with QEMU
3. **Whisper accuracy on radio traffic** (MEDIUM risk) — mitigated by audio cleanup feeding cleaner audio to Whisper
4. **Resource contention when multiple features active** (HIGH risk) — mitigated by mode-based UI that limits concurrent pipelines

The research confirms the architecture proposed in the spec: a Python-controlled GStreamer service communicating via MQTT, with the SvelteKit UI bridging MQTT to the browser via WebSocket or direct MQTT-over-WebSocket.
