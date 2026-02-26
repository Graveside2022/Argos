# Feature Specification: GStreamer Media Pipeline Integration

**Feature Branch**: `021-gstreamer-media-pipeline`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "GStreamer media pipeline integration — media-service Docker container with GStreamer 1.28, Whisper transcription, Demucs audio cleanup, YOLOX detection, WebRTC streaming, recording, RTSP TAK export, MQTT communication"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Live Radio Transcription (Priority: P1)

An operator has decoded radio traffic flowing from DSD-FME. They want that audio automatically transcribed to searchable text so they can review communications without listening to hours of recordings. The transcription feed appears in the Argos dashboard as a scrolling transcript with timestamps, and all transcripts are stored for search and replay.

**Why this priority**: Transcription converts ephemeral audio into a persistent, searchable intelligence product. Without it, any radio traffic the operator doesn't hear in real time is lost. This is the single highest-value capability the media pipeline delivers.

**Independent Test**: Start DSD-FME decoding radio traffic, verify transcribed text appears in the dashboard within 5 seconds of speech. Toggle transcription off from the dashboard — text stops appearing. Toggle on — transcription resumes.

**Acceptance Scenarios**:

1. **Given** DSD-FME is decoding radio traffic and the media service is running, **When** someone speaks on the monitored channel, **Then** transcribed text with a timestamp appears in the dashboard within 5 seconds.
2. **Given** transcription is active, **When** the operator toggles transcription off from the dashboard, **Then** the transcription pipeline stops processing and no new transcripts appear.
3. **Given** transcription is active, **When** the operator searches for a keyword, **Then** matching transcripts are returned with timestamps.
4. **Given** DSD-FME is not running or no audio source is available, **When** the operator views the transcript feed, **Then** a "No audio source" indicator is shown and no stale transcripts appear.

---

### User Story 2 - Media Streaming & Recording (Priority: P1)

The operator wants to stream live decoded audio and camera feeds to the Argos dashboard, and toggle recording on or off to capture traffic only when needed. Recording writes to disk without interrupting the live stream.

**Why this priority**: Streaming is the delivery mechanism for all other media features — without it, nothing reaches the browser. Recording adds persistence for after-action review. Together, they form the transport layer the entire media pipeline depends on.

**Independent Test**: Verify decoded radio audio plays in the browser. Toggle recording ON — a recording indicator appears showing duration and file size. Toggle OFF — the file is finalized with a timestamp-based filename. Verify the audio stream continues uninterrupted during both state transitions.

**Acceptance Scenarios**:

1. **Given** the media service is running and DSD-FME is active, **When** the operator opens the dashboard, **Then** decoded radio audio streams to the browser as playable audio.
2. **Given** audio is streaming, **When** the operator toggles recording ON, **Then** audio is simultaneously written to disk with a timestamped filename, and the streaming continues uninterrupted.
3. **Given** recording is active, **When** the operator toggles recording OFF, **Then** the recording file is finalized cleanly and the recording status updates in the dashboard.
4. **Given** disk usage falls below 500 MB free space, **When** the health monitor runs, **Then** a low-storage warning appears in the dashboard.

---

### User Story 3 - Pipeline Health Monitoring (Priority: P1)

The operator wants real-time visibility into the health of all media pipelines so they know immediately when something is degraded or broken. Pipeline health displays alongside existing hardware status indicators (HackRF, WiFi adapter, GPS) in the Argos dashboard.

**Why this priority**: A media pipeline that fails silently is worse than no pipeline at all. The operator needs confidence that transcription is running, recording is active, and detection is processing. Health monitoring is foundational infrastructure that all other stories depend on for operational trust.

**Independent Test**: Start the media service. Verify health metrics appear in the dashboard every 5 seconds. Stop the audio pipeline — verify the health indicator changes to error state within 10 seconds and an auto-restart is attempted. Verify the pipeline recovers automatically.

**Acceptance Scenarios**:

1. **Given** the media service is running, **When** the health monitor publishes, **Then** pipeline state (running/paused/error/stopped), latency, buffer level, and throughput metrics appear in the dashboard every 5 seconds.
2. **Given** a pipeline enters error state, **When** the error is captured, **Then** the error is reported in the dashboard and the media service attempts auto-restart with exponential backoff (1s, 2s, 4s, 8s, max 30s).
3. **Given** the media service is healthy, **When** the operator views the health dashboard, **Then** CPU, memory, and disk metrics for the media service are included alongside pipeline metrics.
4. **Given** all pipelines are stopped, **When** the operator views the health dashboard, **Then** each pipeline shows "stopped" state with no false error indicators.

---

### User Story 4 - Audio Cleanup / Source Separation (Priority: P2)

The operator wants background noise and interference stripped from decoded radio audio so they can understand garbled transmissions and improve transcription accuracy. A source separation model isolates the voice from noise, and the cleaned audio can feed into transcription (US-1) or stream to the browser for live monitoring.

**Why this priority**: Radio traffic often has interference, static, and overlapping signals. Source separation dramatically improves both human comprehension and transcription accuracy. However, it is resource-intensive and may require a lighter fallback on the target hardware.

**Independent Test**: Play a noisy radio recording through the audio pipeline. With cleanup OFF, listen to raw audio in the browser and observe transcription errors. Toggle cleanup ON — audio quality improves audibly and transcription accuracy increases. Verify resource usage stays within budget.

**Acceptance Scenarios**:

1. **Given** audio cleanup is enabled, **When** decoded radio audio contains interference, **Then** the voice is isolated and noise is suppressed before streaming or transcription.
2. **Given** audio cleanup is enabled, **When** resource usage exceeds the cleanup budget, **Then** the system automatically falls back to lightweight noise suppression.
3. **Given** audio cleanup is disabled (bypass mode), **When** audio flows through the pipeline, **Then** raw unprocessed audio passes through with zero additional latency.
4. **Given** the cleanup model file is missing, **When** the media service starts, **Then** cleanup defaults to the lightweight fallback and a warning is published.

---

### User Story 5 - Video Intelligence (Priority: P2)

The operator wants a camera feed (USB, Pi Camera, or IP camera) with real-time object and person detection displayed in the Argos dashboard. Detection events (class, confidence, bounding box, timestamp) are published and stored for review.

**Why this priority**: Visual surveillance is a core tactical capability. Object detection on a camera feed provides automated alerting and frees the operator from constant monitoring. However, this is the most resource-intensive feature and must be independently toggleable.

**Independent Test**: Connect a USB camera, enable video detection in the dashboard. Verify bounding boxes appear around detected objects in the video feed. Verify detection events are recorded. Disable detection — bounding boxes disappear but video feed continues.

**Acceptance Scenarios**:

1. **Given** a camera is connected and video detection is enabled, **When** a person or vehicle enters the frame, **Then** a bounding box with class label and confidence appears on the video feed within 200ms.
2. **Given** video detection is active, **When** a detection event fires, **Then** the event (class, confidence, bounding box coordinates, timestamp) is stored and available for review.
3. **Given** the system is under heavy load, **When** video detection is enabled at 640x480, **Then** the pipeline maintains at least 10 FPS.
4. **Given** no camera hardware is connected, **When** the operator enables video detection, **Then** a "No camera source" indicator is shown and the pipeline does not start.

---

### User Story 6 - TAK Media Export (Priority: P3)

The operator wants media (audio clips, video snapshots, live video streams) exported in formats compatible with TAK servers so remote operators using ATAK can receive media intelligence.

**Why this priority**: TAK integration extends media intelligence beyond the local Argos node to the wider tactical network. This is high value but depends on the existing TAK bridge and requires all other media features to be operational first.

**Independent Test**: Trigger an audio clip export from the dashboard. Verify an audio file is written and handed to the TAK bridge. Verify a CoT message referencing the media is sent. For video, verify a streaming mount point is accessible from ATAK's video player.

**Acceptance Scenarios**:

1. **Given** the TAK bridge is configured and connected, **When** the operator triggers "export last 30 seconds of audio," **Then** an audio clip is written and a CoT message referencing it is sent via TAK bridge.
2. **Given** video detection is active, **When** a detection event fires with an automation rule, **Then** an image snapshot is exported and attached to a CoT marker.
3. **Given** the video streaming server is running, **When** a remote ATAK operator subscribes to the Argos video URL, **Then** live video streams to the ATAK video player.

---

### Edge Cases

- What happens when DSD-FME is restarted while the media service is running? The audio source should detect silence, and the pipeline should remain in a ready state. When DSD-FME resumes output, the pipeline should resume processing without manual intervention.
- What happens when the inter-service message broker is unavailable? The media service should buffer messages in memory (bounded queue) and retry connection with exponential backoff. Media processing (transcription, detection) should continue locally even if the broker is down — results queue for later delivery.
- What happens when all features are enabled simultaneously and exceed the resource budget? The dashboard should enforce resource-aware mode selection: "Comms Mode" (audio + transcription + recording), "Surveillance Mode" (video + detection + recording), or "Full Mode" (reduced quality).
- What happens when the transcription model file is corrupt or missing? The transcription pipeline should fail gracefully with a clear error, and the audio pipeline should continue streaming without transcription.
- What happens when the recording directory fills up? The health monitor should warn at a configurable threshold (default 500 MB free). If disk reaches 0, recording should stop automatically and publish an error — streaming continues.
- What happens when a camera is disconnected mid-stream? The video pipeline should enter error state, report the disconnection, and attempt reconnection with exponential backoff. The dashboard video feed should show a "Camera disconnected" placeholder.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a containerized media service that handles all media processing (transcription, audio cleanup, video detection, streaming, recording) in isolation from the main application.
- **FR-002**: System MUST ingest decoded audio from DSD-FME via a kernel-level audio routing mechanism (with a fallback path if the primary mechanism is unavailable).
- **FR-003**: System MUST transcribe decoded radio audio to text with latency under 5 seconds from speech to displayed text.
- **FR-004**: System MUST publish transcription results with timestamps to the main application in real time.
- **FR-005**: System MUST persist transcription results for keyword search and replay.
- **FR-006**: System SHOULD provide audio source separation to isolate voice from noise, with automatic fallback to lightweight noise suppression if resource usage exceeds budget.
- **FR-007**: System MUST stream decoded audio to the Argos dashboard with less than 500ms end-to-end latency.
- **FR-008**: System MUST support dynamic recording toggle — operator can start/stop recording from the dashboard without interrupting live streaming.
- **FR-009**: System MUST save recordings with timestamped filenames to a configurable directory.
- **FR-010**: System MUST ingest video from USB cameras, Raspberry Pi Camera Module, or IP cameras.
- **FR-011**: System MUST perform real-time object detection at 10-15 FPS on 640x480 resolution on the target hardware.
- **FR-012**: System MUST publish detection events (class, confidence, bounding box, timestamp) and store them for review.
- **FR-013**: System MUST stream video with detection overlays to the Argos dashboard.
- **FR-014**: System MUST publish pipeline health metrics (state, latency, buffer level, throughput, resource usage) at 5-second intervals.
- **FR-015**: System MUST auto-restart failed pipelines with exponential backoff (1s, 2s, 4s, 8s, max 30s).
- **FR-016**: System MUST capture and report all pipeline errors and warnings to the dashboard.
- **FR-017**: System SHOULD export audio clips, video snapshots, and live video streams in TAK-compatible formats.
- **FR-018**: System MUST allow independent enable/disable of each pipeline (transcription, cleanup, detection, recording) from the dashboard.
- **FR-019**: System MUST include a message broker for communication between the media service and the main application.
- **FR-020**: System MUST provide pipeline control commands (start, stop, pause, configure) from the dashboard.

### Key Entities

- **Media Pipeline**: A named processing graph (radio-audio, video-detection, recording) with lifecycle management, health monitoring, and auto-restart. Each pipeline has a state (running, paused, error, stopped), configuration, and metrics.
- **Transcription Result**: A timestamped text segment produced by speech-to-text — includes the transcribed text, start/end timestamps, confidence score, and source pipeline identifier.
- **Detection Event**: An object detection result — includes class label, confidence score, bounding box coordinates (x, y, width, height), frame timestamp, and source camera identifier.
- **Recording Session**: A bounded period of media capture — includes start time, stop time, filename, format, file size, and associated pipeline.
- **Pipeline Health Report**: A periodic snapshot of all pipeline states and system resource usage — the operator's window into whether media processing is healthy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Operators can read transcribed radio text in the dashboard within 5 seconds of speech occurring on a monitored channel.
- **SC-002**: Audio streaming reaches the operator's browser with less than 500ms end-to-end latency.
- **SC-003**: Video detection maintains at least 10 FPS at 640x480 on the target hardware with overlays visible to the operator.
- **SC-004**: Operators can toggle recording on/off without any visible interruption to the live audio or video stream.
- **SC-005**: Pipeline health indicators appear in the dashboard within 10 seconds of media service startup.
- **SC-006**: A failed pipeline recovers automatically within 30 seconds without operator intervention.
- **SC-007**: "Comms Mode" (audio + transcription + recording) consumes less than 50% CPU and less than 512 MB RAM on the target hardware.
- **SC-008**: "Surveillance Mode" (video + detection + recording) consumes less than 60% CPU and less than 512 MB RAM on the target hardware.
- **SC-009**: The media service container starts and passes its health check within 30 seconds.
- **SC-010**: Operators can search transcription history by keyword and retrieve results with timestamps.

## Assumptions

- DSD-FME is the primary decoded audio source and is configured to output to a shared audio routing mechanism on the host.
- The Raspberry Pi 5 with 8 GB RAM is the target deployment platform. All resource budgets are based on this hardware.
- Not all media features will run simultaneously. The dashboard provides mode selection to manage resource contention between audio-focused and video-focused workloads.
- The existing TAK bridge service handles CoT message formatting and TLS transport. The media service provides media in compatible formats; the TAK bridge handles delivery.
- The speech-to-text model used is sized for edge hardware (roughly 140 MB) balancing speed and accuracy.
- The object detection model used is sized for edge hardware (roughly 4 MB) optimized for inference speed at the cost of detection accuracy compared to larger variants.
- Audio cleanup (source separation) may be too resource-intensive for real-time operation on the target hardware. The spec explicitly defines a lightweight fallback path.
- A message broker will be added to the deployment stack as the communication bus between the media service and the main Argos application.
