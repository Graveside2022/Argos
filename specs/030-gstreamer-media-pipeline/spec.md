# Feature Specification: GStreamer Media Pipeline Integration

**Feature Branch**: `030-gstreamer-media-pipeline`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "Introduce a media-service Docker container running GStreamer 1.28 with Python bindings. This service sits between raw media sources (DSD-FME decoded audio, cameras, RTSP streams) and the Argos UI, handling all media processing, transcription, recording, and streaming via MQTT."

## Context

Argos currently has no unified media processing layer. Decoded radio traffic from DSD-FME outputs to system audio or terminal — there is no transcription, no recording, no audio cleanup, and no way to stream media directly into the SvelteKit dashboard. Audio and video are first-class intelligence products in a tactical platform, and without a media pipeline, operators must listen to radio traffic in real time or miss it entirely, tolerate garbled audio, use separate applications for camera feeds, and manually manage recordings with ad-hoc shell scripts.

GStreamer 1.28 (released January 2026, point release 1.28.1 on February 2026) provides the exact capabilities needed: Whisper-based speech-to-text, Demucs audio source separation, YOLOX object detection, WebRTC streaming to browsers, and RTSP server for TAK — all running efficiently on a Raspberry Pi 5 with 8 GB RAM.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Live Radio Transcription (Priority: P1)

An operator has decoded radio traffic flowing from DSD-FME. They want that audio automatically transcribed to searchable text so they can review communications without listening to hours of recordings. The transcription feed appears in the Argos dashboard as a scrolling transcript with timestamps, and all transcripts are stored for search and replay.

**Why this priority**: Transcription converts ephemeral audio into a persistent, searchable intelligence product. Without it, any radio traffic the operator doesn't hear in real time is lost. This is the single highest-value capability the media pipeline delivers.

**Independent Test**: Start DSD-FME decoding radio traffic, verify transcribed text appears in the SvelteKit UI within 5 seconds of speech. Toggle transcription off from the UI — text stops appearing. Toggle on — transcription resumes.

**Acceptance Scenarios**:

1. **Given** DSD-FME is decoding radio traffic and media-service is running, **When** someone speaks on the monitored channel, **Then** transcribed text with a timestamp appears in the dashboard within 5 seconds.
2. **Given** transcription is active, **When** the operator toggles transcription off from the UI, **Then** the Whisper pipeline stops processing and no new transcripts appear.
3. **Given** transcription is active, **When** the operator searches for a keyword, **Then** matching transcripts from the SQLite store are returned with timestamps.
4. **Given** DSD-FME is not running or the ALSA loopback has no audio, **When** the operator views the transcript feed, **Then** a "No audio source" indicator is shown and no stale transcripts appear.

---

### User Story 2 - Audio Cleanup / Source Separation (Priority: P2)

The operator wants background noise and interference stripped from decoded radio audio so they can understand garbled transmissions and improve transcription accuracy. The Demucs source separation model isolates the voice stem from noise, and the cleaned audio can feed into the transcription pipeline (US-1) or stream to the browser for live monitoring.

**Why this priority**: Radio traffic often has interference, static, and overlapping signals. Source separation dramatically improves both human comprehension and Whisper transcription accuracy. However, it is resource-intensive and may require a lighter fallback on Pi 5.

**Independent Test**: Play a noisy radio recording through the ALSA loopback. With cleanup OFF, listen to raw audio in the browser and observe transcription errors. Toggle cleanup ON — audio quality improves audibly and transcription accuracy increases. Verify CPU usage stays below 40%.

**Acceptance Scenarios**:

1. **Given** audio cleanup is enabled, **When** decoded radio audio contains interference, **Then** the voice stem is isolated and noise is suppressed before streaming or transcription.
2. **Given** audio cleanup is enabled, **When** CPU usage exceeds 40% on Pi 5, **Then** the system automatically falls back to lightweight GStreamer `webrtcdsp` noise suppression.
3. **Given** audio cleanup is disabled (bypass mode), **When** audio flows through the pipeline, **Then** raw unprocessed audio passes through with zero additional latency.
4. **Given** the Demucs model file is missing, **When** the media-service starts, **Then** cleanup defaults to the lightweight fallback and a warning publishes to MQTT.

---

### User Story 3 - Video Intelligence (Priority: P2)

The operator wants a camera feed (USB, Pi Camera, or RTSP/IP camera) with real-time object and person detection displayed in the Argos dashboard. Detection events (class, confidence, bounding box, timestamp) are published via MQTT and stored for review.

**Why this priority**: Visual surveillance is a core tactical capability. Object detection on a camera feed provides automated alerting and frees the operator from constant monitoring. However, this is the most resource-intensive feature and must be independently toggleable.

**Independent Test**: Connect a USB camera, enable video detection in the UI. Verify bounding boxes appear around detected objects in the video feed. Verify detection events appear in MQTT. Disable detection — bounding boxes disappear but video feed continues.

**Acceptance Scenarios**:

1. **Given** a camera is connected and video detection is enabled, **When** a person or vehicle enters the frame, **Then** a bounding box with class label and confidence appears on the video feed within 200ms.
2. **Given** video detection is active, **When** a detection event fires, **Then** the event (class, confidence, bounding box coordinates, timestamp) publishes to `argos/media/detections` and is stored in SQLite.
3. **Given** the Pi 5 is under heavy load, **When** video detection is enabled at 640x480, **Then** the pipeline maintains at least 10 FPS.
4. **Given** no camera hardware is connected, **When** the operator enables video detection, **Then** a "No camera source" indicator is shown and the pipeline does not start.

---

### User Story 4 - Streaming & Recording (Priority: P1)

The operator wants to stream live decoded audio and camera feeds to the Argos dashboard, and toggle recording on or off to capture traffic only when needed. Recording writes to disk without interrupting the live stream.

**Why this priority**: Streaming is the delivery mechanism for all other media features — without it, nothing reaches the browser. Recording adds persistence for after-action review. Together, they form the transport layer the entire media pipeline depends on.

**Independent Test**: Verify decoded radio audio plays in the browser. Toggle recording ON — a recording indicator appears showing duration and file size. Toggle OFF — the file is finalized with a timestamp-based filename. Verify the audio stream continues uninterrupted during both state transitions.

**Acceptance Scenarios**:

1. **Given** the media-service is running and DSD-FME is active, **When** the operator opens the dashboard, **Then** decoded radio audio streams to the browser as playable audio via WebRTC.
2. **Given** audio is streaming, **When** the operator toggles recording ON, **Then** audio is simultaneously written to disk as `.ogg` with a timestamped filename, and the streaming continues uninterrupted.
3. **Given** recording is active, **When** the operator toggles recording OFF, **Then** the file sink receives EOS, flushes, and disconnects cleanly. The recording status publishes to MQTT.
4. **Given** disk usage falls below 500 MB, **When** the health monitor runs, **Then** a low-storage warning publishes to `argos/media/health` and the UI displays a warning indicator.

---

### User Story 5 - TAK Media Export (Priority: P3)

The operator wants media (audio clips, video snapshots, live RTSP streams) exported in formats compatible with TAK servers so remote operators using ATAK can receive media intelligence.

**Why this priority**: TAK integration extends media intelligence beyond the local Argos node to the wider tactical network. This is high value but depends on the tak-bridge service (already in `src/lib/server/tak/`) and requires all other media features to be operational first.

**Independent Test**: Trigger an audio clip export from the UI. Verify a WAV/AAC file is written and handed to the tak-bridge. Verify a CoT message referencing the media is sent. For video, verify an RTSP mount point is accessible from ATAK's video player.

**Acceptance Scenarios**:

1. **Given** the tak-bridge is configured and connected, **When** the operator triggers "export last 30 seconds of audio," **Then** an AAC clip is written and a CoT message referencing it is sent via tak-bridge.
2. **Given** video detection is active, **When** a detection event fires with an automation rule, **Then** a JPEG snapshot is exported and attached to a CoT marker.
3. **Given** the RTSP server is running, **When** an ATAK operator subscribes to the Argos RTSP URL, **Then** live video streams to the ATAK video player.

---

### User Story 6 - Pipeline Monitoring (Priority: P1)

The operator wants real-time visibility into the health of all media pipelines so they know immediately when something is degraded or broken. Pipeline health displays alongside existing hardware status indicators (HackRF, WiFi adapter, GPS) in the Argos dashboard.

**Why this priority**: A media pipeline that fails silently is worse than no pipeline at all. The operator needs confidence that transcription is running, recording is active, and detection is processing. Health monitoring is foundational infrastructure that all other stories depend on for operational trust.

**Independent Test**: Start the media-service. Verify health metrics appear in the dashboard every 5 seconds. Kill the audio pipeline — verify the health indicator turns red within 10 seconds and an auto-restart attempt is logged. Verify the pipeline recovers automatically.

**Acceptance Scenarios**:

1. **Given** the media-service is running, **When** the health monitor publishes, **Then** pipeline state (running/paused/error/stopped), latency, buffer level, and throughput metrics appear on `argos/media/health` every 5 seconds.
2. **Given** a pipeline enters error state (GST_MESSAGE_ERROR), **When** the error is captured, **Then** it publishes to `argos/media/errors` and the media-service attempts auto-restart with exponential backoff (1s, 2s, 4s, 8s, max 30s).
3. **Given** the media-service container is healthy, **When** the UI requests health status, **Then** CPU, memory, and disk metrics for the media-service are included alongside pipeline metrics.
4. **Given** all pipelines are stopped, **When** the operator views the health dashboard, **Then** each pipeline shows "stopped" state with no false error indicators.

---

### Edge Cases

- What happens when DSD-FME is restarted while the media-service is running? The ALSA loopback source should detect silence, and the pipeline should remain in a ready state. When DSD-FME resumes output, the pipeline should resume processing without manual intervention.
- What happens when the MQTT broker (Mosquitto) is unavailable? The media-service should buffer messages in memory (bounded queue) and retry connection with exponential backoff. Media processing (transcription, detection) should continue locally even if MQTT is down — results queue for later delivery.
- What happens when all features are enabled simultaneously and exceed the Pi 5 resource budget? The UI should enforce resource-aware mode selection: "Comms Mode" (audio + transcription + recording, ~45% CPU), "Surveillance Mode" (video + detection + recording, ~55% CPU), or "Full Mode" (reduced quality — 5 FPS video, no Demucs, ~70% CPU).
- What happens when the Whisper model file is corrupt or missing? The transcription pipeline should fail gracefully with a clear error on `argos/media/errors`, and the audio pipeline should continue streaming without transcription.
- What happens when the recording directory fills up? The health monitor should warn at configurable threshold (default 500 MB free). If disk reaches 0, recording should stop automatically and publish an error — streaming continues.
- What happens when a camera is disconnected mid-stream? The video pipeline should enter error state, publish to MQTT, and attempt reconnection with exponential backoff. The UI video feed should show a "Camera disconnected" placeholder.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a `media-service` Docker container running GStreamer 1.28 with Python bindings (PyGObject) that communicates exclusively via MQTT.
- **FR-002**: System MUST ingest decoded audio from DSD-FME via ALSA loopback device (`snd-aloop` kernel module) or named pipe fallback.
- **FR-003**: System MUST transcribe decoded radio audio to text using the GStreamer Whisper element with latency under 5 seconds from speech to text.
- **FR-004**: System MUST publish transcription results to MQTT topic `argos/media/transcription` with timestamps.
- **FR-005**: System MUST store transcription results in SQLite for search and replay.
- **FR-006**: System SHOULD provide audio source separation (Demucs) to isolate voice from noise, with automatic fallback to lightweight noise suppression (`webrtcdsp`) if CPU exceeds 40%.
- **FR-007**: System MUST stream decoded audio to the SvelteKit UI via WebRTC or WebSocket audio transport.
- **FR-008**: System MUST support dynamic recording toggle — operator can start/stop recording from the UI without interrupting live streaming.
- **FR-009**: System MUST save recordings with timestamped filenames (`argos-radio-YYYYMMDD-HHmmss.ogg` for audio, `argos-video-YYYYMMDD-HHmmss.mkv` for video) to a configurable directory.
- **FR-010**: System MUST ingest video from USB camera (`v4l2src`), Raspberry Pi Camera Module, or RTSP/IP camera (`rtspsrc`).
- **FR-011**: System MUST perform real-time object detection using YOLOX nano inference element at 10-15 FPS on 640x480 resolution.
- **FR-012**: System MUST publish detection events (class, confidence, bounding box, timestamp) to MQTT topic `argos/media/detections`.
- **FR-013**: System MUST stream video with detection overlays to the SvelteKit UI via WebRTC.
- **FR-014**: System MUST publish pipeline health metrics (state, latency, buffer level, throughput, CPU, memory, disk) to MQTT topic `argos/media/health` at 5-second intervals.
- **FR-015**: System MUST auto-restart failed pipelines with exponential backoff (1s, 2s, 4s, 8s, max 30s) per the Argos constitution's auto-recovery rule.
- **FR-016**: System MUST capture GStreamer bus errors (`GST_MESSAGE_ERROR`, `GST_MESSAGE_WARNING`) and publish to `argos/media/errors`.
- **FR-017**: System SHOULD export audio clips (WAV/AAC), video snapshots (JPEG), and live video (RTSP) in TAK-compatible formats.
- **FR-018**: System MUST allow independent enable/disable of each pipeline (transcription, cleanup, detection, recording) from the UI via MQTT commands.
- **FR-019**: System MUST include a Mosquitto MQTT broker in the Docker Compose stack as the message bus between media-service and argos-ui.
- **FR-020**: System MUST provide pipeline control commands via MQTT topics (`argos/media/pipeline/command`, `argos/media/recording/command`, toggle topics).

### Key Entities

- **Media Pipeline**: A named GStreamer processing graph (radio-audio, video-detection, recording) with lifecycle management, health monitoring, and auto-restart. Each pipeline has a state (running, paused, error, stopped), configuration, and metrics.
- **Transcription Result**: A timestamped text segment produced by the Whisper element — includes the transcribed text, start/end timestamps, confidence score, and source pipeline identifier.
- **Detection Event**: An object detection result from YOLOX inference — includes class label, confidence score, bounding box coordinates (x, y, width, height), frame timestamp, and source camera identifier.
- **Recording Session**: A bounded period of media capture — includes start time, stop time, filename, format, file size, and associated pipeline.
- **Pipeline Health Report**: A periodic snapshot of all pipeline states and system resource usage — the operator's window into whether media processing is healthy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Transcription latency is under 5 seconds from speech to text display in the UI.
- **SC-002**: Audio streaming to the browser has less than 500ms end-to-end latency.
- **SC-003**: Video detection achieves at least 10 FPS at 640x480 resolution on Pi 5.
- **SC-004**: Recording toggle (start/stop) completes without dropping frames or interrupting the live stream.
- **SC-005**: Pipeline health metrics appear in the UI within 10 seconds of media-service startup.
- **SC-006**: Auto-restart recovers a failed pipeline within 30 seconds (max backoff).
- **SC-007**: "Comms Mode" (audio + transcription + recording) uses less than 50% CPU and less than 512 MB RAM on Pi 5.
- **SC-008**: "Surveillance Mode" (video + detection + recording) uses less than 60% CPU and less than 512 MB RAM on Pi 5.
- **SC-009**: The media-service container starts and passes its healthcheck within 30 seconds.
- **SC-010**: All MQTT topics publish valid JSON matching their documented schemas.

## Assumptions

- DSD-FME is the primary decoded audio source. The ALSA loopback device (`snd-aloop` kernel module) is available on the host and DSD-FME is configured to output to the loopback playback device.
- The Raspberry Pi 5 with 8 GB RAM is the target platform. Resource budgets are based on this hardware.
- Debian Bookworm is the base OS. GStreamer base plugins install from apt (1.22.x), but the 1.28 Rust-based elements (Whisper, Demucs, YOLOX, WebRTC sink) require building `gst-plugins-rs` from source.
- A Mosquitto MQTT broker will be added to the Docker Compose stack. The SvelteKit UI connects to MQTT via WebSocket bridge for real-time subscriptions.
- Whisper "base" model (~142 MB) is the default for Pi 5 — balances speed and accuracy. The "small" model (~466 MB) is available if RAM allows.
- YOLOX "nano" variant (~4 MB ONNX) is the default for Pi 5 — optimized for edge inference at the cost of detection accuracy compared to larger variants.
- Demucs `htdemucs_ft` model (~80 MB) may be too resource-intensive for real-time operation on Pi 5. The spec explicitly defines a lightweight fallback path.
- Not all features will run simultaneously. The UI provides mode selection to manage resource contention.
- The existing tak-bridge service (`src/lib/server/tak/tak-service.ts`) handles CoT message formatting and TLS transport. The media-service provides media in TAK-compatible formats; the tak-bridge handles delivery.
- WebRTC is the preferred streaming protocol for browser delivery. WebSocket audio chunks are the fallback if browser WebRTC compatibility is an issue.
