# Implementation Plan: GStreamer Media Pipeline Integration

**Branch**: `030-gstreamer-media-pipeline` | **Date**: 2026-02-26 | **Spec**: [specs/030-gstreamer-media-pipeline/spec.md](spec.md)
**Input**: Feature specification from `/specs/030-gstreamer-media-pipeline/spec.md`

## Summary

Introduce a `media-service` Docker container running GStreamer 1.28 with Python bindings (PyGObject) that sits between raw media sources (DSD-FME decoded audio, cameras, RTSP streams) and the Argos SvelteKit UI. All inter-service communication flows through a Mosquitto MQTT broker added to the Docker Compose stack. The media-service handles audio transcription (Whisper), optional audio cleanup (Demucs/fallback), video object detection (YOLOX), WebRTC streaming to the browser, dynamic recording, RTSP export for TAK, and pipeline health monitoring. The SvelteKit server bridges MQTT events to the existing WebSocket infrastructure for browser delivery.

P1 delivers the foundation: container infrastructure, audio ingest, transcription, streaming, recording, and health monitoring. P2 adds audio cleanup and video intelligence. P3 adds TAK media export. Each phase is independently deployable.

## Technical Context

**Language/Version**: Python 3.11 (media-service), TypeScript 5.x (SvelteKit bridge + UI components)
**Primary Dependencies**: GStreamer 1.28 (C core from apt, Rust plugins from source), PyGObject, paho-mqtt, Mosquitto 2, mqtt.js (browser)
**Storage**: SQLite (existing `rf_signals.db`) for transcription/detection persistence. Docker volumes for recordings and model files.
**Testing**: pytest (media-service unit tests), Vitest (SvelteKit bridge + UI component tests)
**Target Platform**: Raspberry Pi 5 (Kali Linux / Debian Bookworm), 8 GB RAM
**Project Type**: Docker containerized Python service + SvelteKit web application extensions
**Performance Goals**: Transcription < 5s latency (SC-001). Audio streaming < 500ms (SC-002). Video 10+ FPS at 640x480 (SC-003). Health in UI within 10s of startup (SC-005).
**Constraints**: < 512 MB RAM per mode (SC-007/SC-008). CPU budgets per mode. No direct Docker-to-host process communication — MQTT only.
**Scale/Scope**: ~15 new files in media-service, ~12 new files in SvelteKit, ~5 modified SvelteKit files. New Docker services: media-service + mosquitto. New npm dependency: mqtt.js.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article | Requirement | Status | Notes |
| --- | --- | --- | --- |
| I.1 Comprehension Lock | Confirmed understanding | PASS | End state: media pipeline container with MQTT integration. Current: no media processing. |
| I.2 Codebase Inventory | Search existing before creating | PASS | Full audit in research.md RQ-10. 12 reusable assets identified. |
| II.1 TypeScript Strict | No `any`, no `@ts-ignore` | PASS | SvelteKit bridge code and UI components in strict TypeScript. |
| II.2 Modularity | <300 lines/file, <50 lines/fn | PASS | Python files follow same constraint. Pipeline classes ~100 lines each. |
| II.3 Naming | kebab-case files, camelCase vars | PASS | Python: snake_case (PEP 8). TS: kebab-case files, camelCase vars. |
| II.6 Forbidden | No barrel files, no catch-all utils | PASS | `pipeline_builder.py` is domain-specific, not a catch-all. |
| III.1 Test-First | Tests before/alongside implementation | PASS | pytest for pipeline logic, Vitest for MQTT bridge and stores. |
| IV.1 Design Language | Lunaris, dark mode, design tokens | PASS | All UI components use existing Lunaris tokens. No hardcoded hex. |
| IV.3 State Communication | All states handled | PASS | Pipeline: running/paused/error/stopped/restarting. MQTT: connected/disconnected/reconnecting. |
| V.1 Real-Time | <16ms WebSocket, zero leaks | PASS | MQTT-to-WebSocket bridge. WebSocket broadcast reuses existing pattern. |
| V.3 Resources | <15% CPU, <200MB heap | PASS with notes | Media-service runs in separate container — SvelteKit heap unaffected. Pi 5 CPU shared. |
| VI.3 Forbidden | No `npm install` (for SvelteKit) | FAIL — needs mqtt.js | mqtt.js is required for MQTT-to-WebSocket bridge. Single new dependency. |
| VIII.1 Security | No secrets, validate inputs | PASS | MQTT broker internal to Docker network. No external exposure. Input validation on all MQTT payloads. |
| IX.1 Documents | spec → plan → tasks | PASS | This document. |

**Gate result: PASS with exception** — VI.3: `mqtt.js` is a required new npm dependency for the MQTT-to-WebSocket bridge in the SvelteKit server. This is justified because there is no existing MQTT client in the codebase, and the media-service architecture requires MQTT as the communication bus.

## Project Structure

### Documentation (this feature)

```text
specs/030-gstreamer-media-pipeline/
├── spec.md                         # Feature specification
├── plan.md                         # This file
├── research.md                     # Phase 0 research findings
├── data-model.md                   # Entity definitions and MQTT schemas
├── quickstart.md                   # Build order and verification
├── contracts/
│   └── media-service-api.md        # MQTT topic contracts + REST endpoints
├── checklists/
│   └── requirements.md             # Specification quality checklist
└── tasks.md                        # Phase 2 output (task breakdown)
```

### Source Code: media-service (new Docker container)

```text
media-service/
├── Dockerfile                      # NEW — Multi-stage: deps → rust-plugins → runner
├── requirements.txt                # NEW — paho-mqtt, PyGObject
├── config/
│   └── media-service.yaml          # NEW — Pipeline configs, model paths, MQTT settings
├── models/                         # MOUNT — Read-only volume with model files
│   ├── whisper-base.bin            # Whisper base model (~142 MB)
│   ├── yolox-nano.onnx             # YOLOX nano model (~4 MB)
│   └── demucs-htdemucs_ft.pt      # Demucs model (~80 MB, optional)
├── src/
│   ├── __init__.py                 # NEW
│   ├── main.py                     # NEW — Entry point, MQTT connection, pipeline orchestration
│   ├── mqtt_client.py              # NEW — MQTT pub/sub wrapper with reconnection
│   ├── pipelines/
│   │   ├── __init__.py             # NEW
│   │   ├── base.py                 # NEW — Base pipeline class: health, auto-restart, bus handling
│   │   ├── radio_audio.py          # NEW — ALSA ingest + Whisper transcription
│   │   ├── audio_cleanup.py        # NEW — Demucs source separation + fallback
│   │   ├── video_detection.py      # NEW — Camera ingest + YOLOX inference
│   │   ├── recording.py            # NEW — Dynamic tee + filesink for record toggle
│   │   ├── rtsp_server.py          # NEW — GStreamer RTSP server for TAK export
│   │   └── tak_export.py           # NEW — Audio clip / JPEG snapshot export
│   ├── health/
│   │   ├── __init__.py             # NEW
│   │   └── monitor.py              # NEW — Pipeline health collector, publishes to MQTT
│   └── utils/
│       ├── __init__.py             # NEW
│       └── pipeline_builder.py     # NEW — GStreamer pipeline string construction helpers
└── tests/
    ├── test_base_pipeline.py       # NEW — Unit tests for base pipeline class
    ├── test_radio_pipeline.py      # NEW — Unit tests for radio audio pipeline
    ├── test_recording_toggle.py    # NEW — Unit tests for dynamic recording
    └── test_health_monitor.py      # NEW — Unit tests for health reporting
```

### Source Code: Docker infrastructure (new + modified)

```text
docker/
├── docker-compose.media.yml        # NEW — media-service + mosquitto services
├── mosquitto/
│   └── mosquitto.conf              # NEW — Mosquitto config (listeners, websocket, ACL)
├── docker-compose.portainer-dev.yml  # MODIFY — Add media-service and mosquitto to stack
```

### Source Code: SvelteKit (new + modified)

```text
src/lib/
├── server/
│   └── services/
│       └── media/
│           ├── mqtt-bridge.ts      # NEW — MQTT subscriber → WebSocket broadcast
│           └── mqtt-types.ts       # NEW — TypeScript types for MQTT payloads
├── stores/
│   └── dashboard/
│       ├── media-store.ts          # NEW — Reactive store for media pipeline state
│       └── transcription-store.ts  # NEW — Reactive store for transcription feed
├── components/
│   └── dashboard/
│       └── panels/
│           └── media/
│               ├── TranscriptionFeed.svelte    # NEW — Scrolling transcript with timestamps
│               ├── MediaControls.svelte        # NEW — Record toggle, pipeline toggles
│               ├── MediaHealth.svelte          # NEW — Pipeline status indicators
│               ├── RecordingIndicator.svelte   # NEW — Red dot + duration + file size
│               ├── AudioPlayer.svelte          # NEW — WebRTC audio playback
│               └── VideoFeed.svelte            # NEW — WebRTC video with detection overlay

src/lib/server/db/migrations/
    └── 20260226_create_media_tables.ts  # NEW — media_transcriptions + media_detections tables

src/lib/server/websocket-handlers.ts     # MODIFY — Add media event types to broadcast
src/lib/components/dashboard/
    ├── PanelContainer.svelte            # MODIFY — Add 'media' panel case
    ├── IconRail.svelte                  # MODIFY — Add Media icon rail button
    └── TopStatusBar.svelte              # MODIFY — Add media pipeline health indicator
```

**Structure Decision**: The media-service is a standalone Docker container with its own Python codebase, following the existing pattern of third-party tool containers in `docker/docker-compose.portainer-dev.yml`. The SvelteKit additions are minimal — an MQTT bridge service, reactive stores, and UI components. The bridge pattern (MQTT → WebSocket) mirrors how Kismet data already flows (HTTP polling → WebSocket broadcast via WebSocketManager).

## Implementation Phases

### Phase 1: Docker Infrastructure + MQTT Bus (Foundation)

**Goal**: media-service container starts, connects to Mosquitto, publishes health. SvelteKit server subscribes to MQTT and re-broadcasts to WebSocket.

**New files**:

- `docker/docker-compose.media.yml` — Docker Compose for media-service + mosquitto
- `docker/mosquitto/mosquitto.conf` — Mosquitto config with MQTT (1883) + WebSocket (9001) listeners
- `media-service/Dockerfile` — Multi-stage build: Debian Bookworm + GStreamer apt + Rust plugins from source
- `media-service/requirements.txt` — Python dependencies
- `media-service/config/media-service.yaml` — Default configuration
- `media-service/src/main.py` — Entry point with MQTT connection and GLib main loop
- `media-service/src/mqtt_client.py` — MQTT wrapper with auto-reconnect
- `media-service/src/pipelines/base.py` — BasePipeline class with health monitoring + auto-restart
- `media-service/src/health/monitor.py` — Health collector, publishes to `argos/media/health`
- `src/lib/server/services/media/mqtt-bridge.ts` — SvelteKit MQTT subscriber → WebSocket broadcast
- `src/lib/server/services/media/mqtt-types.ts` — TypeScript types matching MQTT payload schemas

**Modified files**:

- `docker/docker-compose.portainer-dev.yml` — Add mosquitto and media-service services
- `src/lib/server/websocket-handlers.ts` — Add media event types to broadcast handler

**Key design decisions**:

- Mosquitto runs as a Docker service on the `argos-dev-network`. Internal only — no external port exposure.
- The media-service Dockerfile uses a multi-stage build: Stage 1 installs apt GStreamer, Stage 2 builds Rust plugins from gst-plugins-rs 1.28.1, Stage 3 copies built plugins + Python code.
- The SvelteKit MQTT bridge uses `mqtt.js` to subscribe to `argos/media/#` and re-broadcasts to existing WebSocket clients via `WebSocketManager.broadcast()`.
- Health monitor collects pipeline states + `psutil` system metrics, publishes JSON to `argos/media/health` every 5 seconds with retain=true.

**Test**: `docker compose -f docker/docker-compose.media.yml up` — verify media-service starts, connects to Mosquitto, publishes health. Verify SvelteKit server logs MQTT connection and health messages appear in browser console.

---

### Phase 2: Audio Ingest + Transcription (US-1 Core)

**Goal**: DSD-FME decoded audio flows through GStreamer, Whisper transcribes to text, transcriptions publish to MQTT and display in UI.

**New files**:

- `media-service/src/pipelines/radio_audio.py` — ALSA loopback ingest + audioconvert + audioresample + Whisper element + appsink → MQTT publish
- `media-service/src/utils/pipeline_builder.py` — Helper functions for constructing GStreamer pipeline description strings
- `media-service/tests/test_radio_pipeline.py` — Unit tests with audiotestsrc (mock audio source)
- `src/lib/stores/dashboard/transcription-store.ts` — Reactive store for transcription feed
- `src/lib/components/dashboard/panels/media/TranscriptionFeed.svelte` — Scrolling transcript with timestamps and search
- `src/lib/server/db/migrations/20260226_create_media_tables.ts` — SQLite migration for `media_transcriptions` and `media_detections` tables

**Key design decisions**:

- The radio audio pipeline uses `alsasrc device="hw:Loopback,1,0"` as primary source. If ALSA loopback is not available, falls back to `filesrc` on a named pipe.
- Whisper element receives 16 kHz mono audio. `audioconvert` and `audioresample` handle format negotiation upstream.
- Transcription text is extracted via `appsink` callback, wrapped in `TranscriptionResult` JSON, and published to `argos/media/transcription`.
- The SvelteKit MQTT bridge forwards transcription events to WebSocket. The `transcription-store.ts` maintains a bounded ring buffer (last 500 transcripts) for UI display.
- SQLite persistence happens in the SvelteKit server (not the media-service) — the MQTT bridge inserts transcription rows on receipt.

**Test**: Feed audio through ALSA loopback (or `audiotestsrc` with spoken WAV file), verify transcribed text appears in browser within 5 seconds. Search for a word — matching transcript returned.

---

### Phase 3: Streaming + Recording (US-4)

**Goal**: Audio streams to the browser via WebRTC. Recording starts/stops dynamically from the UI without interrupting the stream.

**New files**:

- `media-service/src/pipelines/recording.py` — Dynamic tee + filesink add/remove for recording toggle
- `media-service/tests/test_recording_toggle.py` — Unit tests for recording start/stop lifecycle
- `src/lib/stores/dashboard/media-store.ts` — Reactive store for media pipeline state (recording, pipeline health, controls)
- `src/lib/components/dashboard/panels/media/AudioPlayer.svelte` — WebRTC audio player connecting to `webrtcsink` WHEP endpoint
- `src/lib/components/dashboard/panels/media/MediaControls.svelte` — Record toggle, transcription toggle, cleanup toggle
- `src/lib/components/dashboard/panels/media/RecordingIndicator.svelte` — Red dot + duration + file size when recording

**Modified files**:

- `media-service/src/pipelines/radio_audio.py` — Add `tee` element splitting to WebRTC sink + recording branch
- `media-service/src/main.py` — Add MQTT command handlers for `argos/media/recording/command` and toggle topics

**Key design decisions**:

- The `webrtcsink` element serves audio via WHEP (HTTP-based signaling). The browser creates an `RTCPeerConnection` and negotiates via the WHEP endpoint exposed by the media-service container.
- Recording uses GStreamer's dynamic pipeline modification: a `tee` always splits the stream. The recording bin (`queue ! audioconvert ! vorbisenc ! oggmux ! filesink`) is added/removed at runtime.
- Stop recording sends EOS only to the recording branch, waits for flush, then unlinks and removes the bin. The live stream continues uninterrupted.
- The `MediaControls.svelte` component publishes MQTT commands via the SvelteKit server's MQTT bridge (or directly via MQTT-over-WebSocket if Mosquitto's WebSocket listener is used).

**Test**: Open browser, verify audio plays. Toggle recording ON — recording indicator appears. Toggle OFF — file finalized. Verify audio stream was uninterrupted during both transitions.

---

### Phase 4: Audio Cleanup (US-2)

**Goal**: Optional Demucs source separation isolates voice from noise. Falls back to lightweight noise suppression if too resource-intensive.

**New files**:

- `media-service/src/pipelines/audio_cleanup.py` — Demucs element or webrtcdsp/audiodynamic fallback chain

**Modified files**:

- `media-service/src/pipelines/radio_audio.py` — Insert cleanup element between ingest and Whisper/streaming
- `media-service/src/main.py` — Add MQTT command handler for `argos/media/cleanup/toggle`

**Key design decisions**:

- Phase 4 begins with a benchmark: run Demucs on a 30-second test clip on Pi 5 and measure CPU/RAM. If CPU > 40%, default to `webrtcdsp` fallback.
- The cleanup element is inserted as a switchable branch: when enabled, audio routes through cleanup → downstream. When disabled, audio bypasses directly to downstream.
- Toggle is instantaneous — no pipeline restart needed. The `valve` element gates the cleanup branch.
- Cleaned audio feeds both the Whisper transcription and the WebRTC stream, improving both accuracy and operator listening experience.

**Test**: Play noisy audio through loopback. Toggle cleanup ON — verify cleaner audio in browser and improved transcription. Monitor CPU — verify < 40%. Toggle OFF — raw audio passes through.

---

### Phase 5: Video Intelligence (US-3)

**Goal**: Camera feed ingested, YOLOX detects objects, bounding boxes overlay on video, video streams to browser via WebRTC.

**New files**:

- `media-service/src/pipelines/video_detection.py` — Camera ingest + videoconvert + videoscale + YOLOX inference + objectdetectionoverlay + webrtcsink
- `src/lib/components/dashboard/panels/media/VideoFeed.svelte` — WebRTC video player with detection event overlay

**Modified files**:

- `media-service/src/main.py` — Add MQTT command handler for `argos/media/detection/toggle` and `argos/media/source/select`
- `media-service/src/health/monitor.py` — Add video pipeline metrics (FPS, frames processed)

**Key design decisions**:

- Video source is selected via MQTT: `v4l2src` for USB camera, `rtspsrc` for IP camera. The pipeline must be stopped and rebuilt when switching sources (GStreamer cannot change source elements at runtime).
- YOLOX nano model with Burn inference backend (compile-time model selection, most efficient for Pi 5).
- `objectdetectionoverlay` renders bounding boxes directly on the video frames before `webrtcsink`.
- Detection events are extracted from the GStreamer analytics meta (new in 1.28) via `appsink` callback and published to `argos/media/detections`.
- Resolution defaults to 640x480 at 15 FPS. If CPU > 60%, auto-reduce to 320x240 at 10 FPS.
- Face detection is an independent toggle element (`facedetector`) that can be enabled/disabled alongside YOLOX.

**Test**: Connect USB camera. Verify video feed in browser. Place objects in frame — verify bounding boxes appear. Check MQTT — detection events published. Monitor FPS — verify >=10 FPS.

---

### Phase 6: UI Integration + Panel (SvelteKit UI)

**Goal**: Media pipeline controls and health integrated into the Argos dashboard with a dedicated Media panel.

**New files**:

- `src/lib/components/dashboard/panels/media/MediaHealth.svelte` — Pipeline status indicators (running/error/stopped per pipeline)

**Modified files**:

- `src/lib/components/dashboard/PanelContainer.svelte` — Add `'media'` panel case rendering media components
- `src/lib/components/dashboard/IconRail.svelte` — Add Media button (Radio/Activity icon from Lucide)
- `src/lib/components/dashboard/TopStatusBar.svelte` — Add media pipeline health indicator dot alongside existing hardware indicators

**Key design decisions**:

- The Media panel is a new icon rail entry, not a subview of Map Settings. Media is a separate domain from map configuration.
- Panel layout: TranscriptionFeed (top, scrolling), MediaControls (middle, toggles + recording), MediaHealth (bottom, pipeline status).
- VideoFeed opens as a modal/overlay when video detection is active — video takes significant screen real estate and shouldn't be permanently embedded in the narrow sidebar panel.
- All UI components subscribe to media stores, which are populated by the MQTT-to-WebSocket bridge.
- Components follow existing Lunaris design language: dark theme, design tokens, no hardcoded hex values.

**Test**: Click Media icon in rail. Verify panel opens with transcript feed, controls, and health. Toggle recording from UI — verify indicator appears. Pipeline errors show red status. Video feed opens in overlay.

---

### Phase 7: TAK Media Export (US-5)

**Goal**: Audio clips, video snapshots, and live RTSP streams exported in TAK-compatible formats.

**New files**:

- `media-service/src/pipelines/rtsp_server.py` — GStreamer RTSP server for TAK video streaming
- `media-service/src/pipelines/tak_export.py` — Audio clip (WAV/AAC) and JPEG snapshot export

**Modified files**:

- `media-service/src/main.py` — Add MQTT command handler for `argos/media/export/command`
- (TAK bridge coordination via shared volume or MQTT event)

**Key design decisions**:

- The RTSP server uses `gst-rtsp-server` to expose a mount point (e.g., `/live`) that ATAK can subscribe to.
- Audio clip export uses a `valve` element (normally closed) that opens for a specified duration, encoding audio to AAC via `avenc_aac` → `mp4mux` → `filesink`.
- Video snapshot export captures a single frame, encodes to JPEG via `jpegenc`, and writes to the shared export directory.
- Exported media files are placed in a shared volume accessible to the tak-bridge service. The media-service publishes an MQTT event (`argos/media/export/ready`) that the tak-bridge can subscribe to for attaching media to CoT messages.
- The existing TAK service (`src/lib/server/tak/tak-service.ts`) handles CoT formatting and TLS transport — the media-service only provides the media files.

**Test**: Trigger audio export from UI. Verify AAC file written. Verify tak-bridge receives export notification. Start RTSP server — verify ATAK can connect and display video.

---

## Dependency Graph

```
Phase 1: Docker Infrastructure + MQTT Bus (no dependencies)
    ↓
Phase 2: Audio Ingest + Transcription (depends on Phase 1 MQTT bus)
    ↓
Phase 3: Streaming + Recording (depends on Phase 2 audio pipeline)
    ↓                              ↓
Phase 4: Audio Cleanup             Phase 5: Video Intelligence
(depends on Phase 2 audio)        (depends on Phase 1 infrastructure)
    ↓                              ↓
Phase 6: UI Integration (depends on Phases 2-5 for full feature set,
         but can start after Phase 2 for transcript + health display)
    ↓
Phase 7: TAK Media Export (depends on Phases 3 + 5 for media sources)
```

Note: Phase 5 (Video) can run in parallel with Phases 3-4 (Audio streaming/cleanup) since they are independent pipelines. Phase 6 (UI) can start incrementally after Phase 2 — the transcript feed and health indicators work before video or cleanup are available.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Demucs too resource-intensive for real-time on Pi 5 | HIGH | MEDIUM | Fallback chain: webrtcdsp → audiodynamic → bypass. Benchmark in Phase 4 before enabling. |
| GStreamer 1.28 Rust plugins fail to build for aarch64 in Docker | MEDIUM | HIGH | Build natively on Pi 5 (slower). Use Docker multi-stage with QEMU emulation. Pre-build .so files and cache in registry. |
| Whisper accuracy degraded on compressed radio audio with jargon | MEDIUM | MEDIUM | Audio cleanup (US-2) feeds cleaner audio to Whisper. Allow operator to select Whisper "small" model if RAM permits. |
| WebRTC browser compatibility issues with webrtcsink WHEP | LOW | MEDIUM | Fallback to WebSocket audio chunks (PCM → Opus → WebSocket → AudioWorklet). HLS as last resort. |
| All features active simultaneously exceeds Pi 5 resource budget | HIGH | MEDIUM | UI enforces mode selection: Comms Mode, Surveillance Mode, Full Mode (reduced quality). |
| ALSA loopback conflicts with DSD-FME audio configuration | MEDIUM | LOW | Fallback to named pipe (Option B in research). Document ALSA device setup in quickstart. |
| Mosquitto MQTT broker adds single point of failure | LOW | HIGH | Mosquitto is mature and lightweight (~10 MB RAM). Auto-restart via Docker `restart: unless-stopped`. Media-service buffers messages during broker unavailability. |
| Docker Compose stack complexity increases deployment burden | MEDIUM | LOW | Separate `docker-compose.media.yml` with profiles — media services are opt-in, not required for base Argos operation. |
| New npm dependency (mqtt.js) increases SvelteKit bundle | LOW | LOW | mqtt.js is ~30 KB gzipped. Server-side only import — no impact on client bundle. |
