# Tasks: GStreamer Media Pipeline Integration

**Input**: Design documents from `/specs/021-gstreamer-media-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/media-service-api.md, quickstart.md

**Tests**: pytest for media-service Python code, Vitest for SvelteKit bridge + stores. Test tasks included for each phase.

**Organization**: Tasks grouped by implementation phase, with user story cross-references where applicable. Each phase is independently deployable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US4, US6)
- Include exact file paths in descriptions

---

## Phase 1: Docker Infrastructure + MQTT Bus (Foundation)

**Purpose**: Container infrastructure, MQTT message bus, base pipeline class, health monitoring, and SvelteKit MQTT bridge. No media processing yet — just plumbing.

- [ ] T001 [P] Create Mosquitto configuration at `docker/mosquitto/mosquitto.conf` — listeners on port 1883 (MQTT) and 9001 (WebSocket), allow anonymous connections within Docker network, log to stdout, max queued messages 1000
- [ ] T002 [P] Create media-service Dockerfile at `media-service/Dockerfile` — multi-stage build: Stage 1 (deps) installs apt GStreamer 1.22 + Python deps, Stage 2 (rust-builder) clones GStreamer monorepo at 1.28.1 and builds gst-plugins-rs with meson (whisper, rsyolox, webrtc, audiofx enabled), Stage 3 (runner) copies built .so plugins + Python source, runs `src/main.py`
- [ ] T003 [P] Create Docker Compose stack at `docker/docker-compose.media.yml` — services: mosquitto (eclipse-mosquitto:2, ports 1883/9001, config volume), media-service (build from ./media-service, depends_on mosquitto, ALSA + camera device mounts, model volume, recordings volume), shared `argos-dev-network` network
- [ ] T004 [P] Create media-service Python requirements at `media-service/requirements.txt` — paho-mqtt>=2.0, PyYAML>=6.0, psutil>=5.9
- [ ] T005 [P] Create default configuration at `media-service/config/media-service.yaml` — MQTT broker/port, model paths, recording directory, pipeline configs (radio-audio enabled by default, video-detection disabled by default), health interval 5s, max restart delay 30s
- [ ] T006 Create MQTT client wrapper at `media-service/src/mqtt_client.py` — `MqttClient` class: connect with auto-reconnect (exponential backoff 1s→30s), `publish(topic, payload_dict, qos, retain)` with JSON serialization, `subscribe(topic, callback)` with pattern matching, `on_disconnect` handler that logs and reconnects
- [ ] T007 Create base pipeline class at `media-service/src/pipelines/base.py` — `BasePipeline` class: `build()` abstract method returns `Gst.Pipeline`, `start()`/`stop()`/`restart()` lifecycle, GStreamer bus message handling (error, warning, EOS, state-changed), `get_health()` returns `PipelineState` dict, auto-restart with exponential backoff (`_schedule_restart()` via `GLib.timeout_add_seconds()`), backoff resets on successful start
- [ ] T008 Create health monitor at `media-service/src/health/monitor.py` — `HealthMonitor` class: collects `get_health()` from all registered pipelines, collects system metrics via `psutil` (cpu_percent, virtual_memory, disk_usage), publishes `HealthReport` JSON to `argos/media/health` every `health_interval_s` seconds with retain=true
- [ ] T009 Create main entry point at `media-service/src/main.py` — initialize GStreamer (`Gst.init()`), load config from YAML, create `MqttClient`, create `HealthMonitor`, register MQTT command handlers for pipeline start/stop/restart (`argos/media/pipeline/command`), start GLib main loop, handle SIGTERM for clean shutdown
- [ ] T010 Write unit tests for base pipeline at `media-service/tests/test_base_pipeline.py` — test health reporting, test auto-restart scheduling, test error handling on bus messages, test clean shutdown
- [ ] T011 [US6] Create SvelteKit MQTT types at `src/lib/server/services/media/mqtt-types.ts` — TypeScript interfaces matching data-model.md: `TranscriptionResult`, `DetectionEvent`, `HealthReport`, `PipelineState`, `SystemMetrics`, `RecordingStatus`, MQTT topic constants
- [ ] T012 [US6] Create SvelteKit MQTT bridge at `src/lib/server/services/media/mqtt-bridge.ts` — `MediaMqttBridge` class: connects to Mosquitto via `mqtt.js`, subscribes to `argos/media/#`, parses payloads against TypeScript types, re-broadcasts to WebSocket via existing `WebSocketManager.broadcast()` pattern, publishes UI commands (recording, toggle, source select) to MQTT on behalf of browser clients
- [ ] T013 [US6] Add media event types to WebSocket handlers in `src/lib/server/websocket-handlers.ts` — register `media_transcription`, `media_detection`, `media_health`, `media_recording`, `media_error` message types for WebSocket broadcast

**Checkpoint**: `docker compose -f docker/docker-compose.media.yml up` — Mosquitto starts on 1883/9001, media-service starts and publishes health to MQTT every 5s. SvelteKit server subscribes to MQTT, health messages visible in browser dev console via WebSocket. `pytest media-service/tests/test_base_pipeline.py` passes.

---

## Phase 2: Audio Ingest + Transcription (US-1 Core)

**Purpose**: Radio audio flows from DSD-FME through GStreamer, Whisper transcribes to text, transcriptions publish to MQTT and display in UI.

**CRITICAL**: Depends on Phase 1 infrastructure (MQTT bus + base pipeline + health monitor).

- [ ] T014 [US1] Create pipeline builder helpers at `media-service/src/utils/pipeline_builder.py` — functions: `build_alsa_source(device)` returns pipeline fragment string, `build_fifo_source(path, sample_rate, channels)` for named pipe fallback, `build_audio_convert(target_rate, target_channels)` for format negotiation, `build_whisper_transcribe(model_path)` for Whisper element configuration
- [ ] T015 [US1] Create radio audio pipeline at `media-service/src/pipelines/radio_audio.py` — `RadioAudioPipeline(BasePipeline)`: builds pipeline `alsasrc → audioconvert → audioresample → whisper_transcribe → appsink`, `appsink` callback extracts transcription text/timestamp/confidence, publishes `TranscriptionResult` to `argos/media/transcription` via MQTT, handles ALSA loopback unavailability by falling back to `audiotestsrc` (silence) with warning
- [ ] T016 [US1] Write unit tests for radio pipeline at `media-service/tests/test_radio_pipeline.py` — test pipeline construction, test transcription callback with mock appsink data, test ALSA fallback behavior, test MQTT publish on transcription
- [ ] T017 [US1] Create SQLite migration for media tables at `src/lib/server/db/migrations/20260226_create_media_tables.ts` — create `media_transcriptions` table (id, text, timestamp, duration_ms, confidence, language, source_pipeline, cleanup_applied, created_at) and `media_detections` table (id, class_label, confidence, bbox coords, frame_timestamp, camera_id, tracking_id, created_at) with indexes per data-model.md
- [ ] T018 [US1] Create transcription store at `src/lib/stores/dashboard/transcription-store.ts` — reactive Svelte store: bounded ring buffer (500 entries), `addTranscription(result)`, `searchTranscriptions(query)` for text search, `clearTranscriptions()`, subscribes to `media_transcription` WebSocket events
- [ ] T019 [US1] Create TranscriptionFeed component at `src/lib/components/dashboard/panels/media/TranscriptionFeed.svelte` — scrolling list of transcription entries with timestamps, auto-scroll to bottom on new entries, search input at top filters displayed transcripts, empty state: "No transcriptions — waiting for audio", Lunaris dark theme styling with `--foreground` / `--text-secondary` tokens

**Checkpoint**: Feed audio through ALSA loopback (or test tone). Transcribed text appears in `argos/media/transcription` MQTT topic within 5 seconds. TranscriptionFeed.svelte displays transcript in browser. Search returns matching entries. `npm run build` succeeds.

---

## Phase 3: Streaming + Recording (US-4)

**Goal**: Audio streams to browser via WebRTC. Recording toggles dynamically.

**CRITICAL**: Depends on Phase 2 radio audio pipeline.

- [ ] T020 [US4] Extend radio audio pipeline for WebRTC streaming — modify `media-service/src/pipelines/radio_audio.py`: add `tee` element after audioconvert, one branch to Whisper (existing), one branch to `webrtcsink` with WHEP signaling endpoint on configurable port (default 8443)
- [ ] T021 [US4] Create recording pipeline at `media-service/src/pipelines/recording.py` — `RecordingPipeline` class: dynamically adds/removes recording bin (`queue ! audioconvert ! vorbisenc ! oggmux ! filesink`) to/from the tee element. `start_recording()` creates timestamped filename, adds bin, sets to PLAYING. `stop_recording()` sends EOS to recording bin, waits for flush, unlinks, removes. Publishes `RecordingStatus` to `argos/media/recording/status` on state changes
- [ ] T022 [US4] Add recording command handler to `media-service/src/main.py` — subscribe to `argos/media/recording/command`, parse `{ action: "start" | "stop" }`, delegate to RecordingPipeline
- [ ] T023 [US4] Write unit tests for recording toggle at `media-service/tests/test_recording_toggle.py` — test start creates file, test stop sends EOS and finalizes, test rapid start/stop doesn't crash, test filename format matches `argos-radio-YYYYMMDD-HHmmss.ogg`
- [ ] T024 [US4] Create AudioPlayer component at `src/lib/components/dashboard/panels/media/AudioPlayer.svelte` — creates `RTCPeerConnection`, connects to `webrtcsink` WHEP endpoint, attaches incoming audio stream to `<audio>` element, handles connection/disconnection states, shows "Connecting..." / "Playing" / "No audio source" states
- [ ] T025 [US4] Create media store at `src/lib/stores/dashboard/media-store.ts` — reactive Svelte store: `pipelineStates` (map of pipeline name → PipelineState), `recordingStatus` (RecordingStatus), `isRecording` derived, `pipelineHealth` derived from WebSocket `media_health` events, convenience actions: `toggleRecording()`, `toggleTranscription()`, `toggleCleanup()`, `toggleDetection()` — each publishes MQTT command via bridge
- [ ] T026 [US4] Create MediaControls component at `src/lib/components/dashboard/panels/media/MediaControls.svelte` — toggle buttons: Record (red when active), Transcription (on/off), Cleanup (on/off), Detection (on/off). Each toggle calls media store action. Uses existing toggle switch component pattern from Lunaris design system.
- [ ] T027 [US4] Create RecordingIndicator component at `src/lib/components/dashboard/panels/media/RecordingIndicator.svelte` — red pulsing dot + recording duration (MM:SS) + file size (auto-formatted KB/MB) when `isRecording` is true. Hidden when not recording. Matches existing status indicator patterns.
- [ ] T028 [US4] Add disk usage monitoring to health monitor in `media-service/src/health/monitor.py` — check `disk_usage(recording_dir)`. If free < `disk_warning_threshold_mb`, set `disk_warning: true` in health report. If free < 50 MB, auto-stop recording and publish error.

**Checkpoint**: Open browser, audio plays via WebRTC. Toggle recording ON — RecordingIndicator appears with duration counting. Toggle OFF — file finalized. Audio stream uninterrupted during both transitions. File exists at `/data/recordings/argos-radio-YYYYMMDD-HHmmss.ogg`.

---

## Phase 4: Audio Cleanup (US-2)

**Goal**: Optional Demucs source separation or lightweight fallback.

- [ ] T029 [US2] Benchmark Demucs on Pi 5 — create `media-service/tests/benchmark_demucs.py`: load Demucs element, process 30-second test audio, measure CPU (psutil), RAM (psutil), processing time. Log results. Determine if Demucs is viable (< 40% CPU, < 300 MB RAM, < 2x real-time).
- [ ] T030 [US2] Create audio cleanup pipeline at `media-service/src/pipelines/audio_cleanup.py` — `AudioCleanupPipeline(BasePipeline)`: if Demucs viable, builds `demucs_separate (voice stem)` element. If not, builds `webrtcdsp` noise suppression. Toggle-able via MQTT: when enabled, audio routes through cleanup element before downstream (Whisper, WebRTC). When disabled, bypass valve passes raw audio. Publishes cleanup state to health report.
- [ ] T031 [US2] Add cleanup toggle handler to `media-service/src/main.py` — subscribe to `argos/media/cleanup/toggle`, parse `{ enabled: bool }`, enable/disable cleanup element in pipeline

**Checkpoint**: Play noisy audio. Toggle cleanup ON — verify cleaner output in WebRTC stream. Check CPU < 40%. Toggle OFF — raw audio passes through. If Demucs fails benchmark, webrtcdsp fallback is active.

---

## Phase 5: Video Intelligence (US-3)

**Goal**: Camera ingest, YOLOX detection, bounding box overlay, video WebRTC streaming.

**Note**: Can run in parallel with Phase 4 (independent pipeline).

- [ ] T032 [P] [US3] Create video detection pipeline at `media-service/src/pipelines/video_detection.py` — `VideoDetectionPipeline(BasePipeline)`: builds `v4l2src → videoconvert → videoscale (640x480) → tee → [branch 1: rsyolox_infer → objectdetectionoverlay → webrtcsink] [branch 2: appsink for detection event extraction]`. Detection events extracted from GStreamer analytics meta, published as `DetectionEvent` to `argos/media/detections`. Supports source switching via pipeline rebuild (v4l2src ↔ rtspsrc).
- [ ] T033 [P] [US3] Add video pipeline command handlers to `media-service/src/main.py` — subscribe to `argos/media/detection/toggle` (enable/disable detection), `argos/media/source/select` (switch camera source — requires pipeline stop/rebuild/start)
- [ ] T034 [US3] Create VideoFeed component at `src/lib/components/dashboard/panels/media/VideoFeed.svelte` — WebRTC video player connecting to `webrtcsink` WHEP endpoint for video. `<video>` element with detection event overlay (bounding boxes rendered via `<canvas>` overlay or native WebRTC video). Opens as modal/overlay from Media panel. Shows "No camera" / "Connecting..." / "Streaming" states. FPS counter display.
- [ ] T035 [US3] Add detection events to transcription store — extend `src/lib/stores/dashboard/media-store.ts` with `detectionEvents` ring buffer (100 entries), `addDetection(event)` from WebSocket `media_detection` events, `latestDetections` derived for overlay rendering

**Checkpoint**: Connect USB camera. Video feed in browser with bounding boxes. Detection events in MQTT. FPS >= 10. Disable detection — boxes disappear, video continues.

---

## Phase 6: UI Integration + Media Panel

**Goal**: Full Media panel in the Argos dashboard with transcript feed, controls, health, and video.

- [ ] T036 [US6] Create MediaHealth component at `src/lib/components/dashboard/panels/media/MediaHealth.svelte` — pipeline status cards showing state (running=green, paused=yellow, error=red, stopped=gray) for each pipeline (radio-audio, video-detection, recording). CPU, RAM, disk metrics. Matches existing hardware health indicator patterns in TopStatusBar.
- [ ] T037 [US6] Add Media panel to PanelContainer in `src/lib/components/dashboard/PanelContainer.svelte` — add `{:else if $activePanel === 'media'}` case, render Media panel composed of: TranscriptionFeed (top), MediaControls (middle), RecordingIndicator (inline with controls), MediaHealth (bottom). VideoFeed launched as overlay from a "Open Camera" button in controls.
- [ ] T038 [US6] Add Media button to IconRail in `src/lib/components/dashboard/IconRail.svelte` — new button: `title="Media"`, icon `Radio` or `Activity` from Lucide, `onclick={() => handleClick('media')}`, positioned after existing buttons
- [ ] T039 [US6] Add media health indicator to TopStatusBar in `src/lib/components/dashboard/TopStatusBar.svelte` — small status dot (green/yellow/red) representing aggregate media pipeline health, next to existing HackRF/WiFi/GPS indicators. Tooltip shows pipeline states. Hidden when media-service is not connected.
- [ ] T040 Run full SvelteKit verification: `npx tsc --noEmit`, `npx eslint --config config/eslint.config.js` on new files, `npx vitest run` on new test files, `npm run build`

**Checkpoint**: Media icon in rail. Panel opens with transcript feed, controls, health. Pipeline status shows green/red correctly. TopStatusBar shows media health dot. `npm run build` succeeds.

---

## Phase 7: TAK Media Export (US-5)

**Goal**: RTSP server for TAK video, audio/image clip export for TAK attachments.

- [ ] T041 [US5] Create RTSP server pipeline at `media-service/src/pipelines/rtsp_server.py` — `RtspServerPipeline`: uses `gst-rtsp-server` library to create a mount point (`/live`) serving H.264-encoded video from the detection pipeline. Configurable port (default 8554). Starts on demand via MQTT command.
- [ ] T042 [US5] Create TAK export pipeline at `media-service/src/pipelines/tak_export.py` — `TakExportPipeline`: audio clip export (`valve → audioconvert → avenc_aac → mp4mux → filesink`), video snapshot export (`valve → jpegenc → filesink`). Triggered by MQTT command `argos/media/export/command` with `{ type, duration_s, output_path }`. Publishes `argos/media/export/ready` when file is written.
- [ ] T043 [US5] Add export command handler to `media-service/src/main.py` — subscribe to `argos/media/export/command`, delegate to TakExportPipeline, publish completion event

**Checkpoint**: Trigger audio export — AAC file written. Trigger snapshot — JPEG file written. Start RTSP server — `ffplay rtsp://localhost:8554/live` shows video. Export ready events publish to MQTT.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies — start immediately. T001-T005 are all parallel (different files). T006-T009 are sequential (MQTT client → base pipeline → health → main). T011-T013 are parallel with Python work (different language/codebase).
- **Phase 2 (Transcription)**: Depends on Phase 1 MQTT + base pipeline. T014-T016 (Python) and T017-T019 (TypeScript) can run in parallel.
- **Phase 3 (Streaming + Recording)**: Depends on Phase 2 audio pipeline. T020-T023 (Python) and T024-T028 (TypeScript) can run in parallel.
- **Phase 4 (Audio Cleanup)**: Depends on Phase 2 audio pipeline. T029 (benchmark) must complete before T030-T031 (implementation decision).
- **Phase 5 (Video)**: Depends on Phase 1 infrastructure only. Can run in parallel with Phases 3-4. T032-T033 (Python) and T034-T035 (TypeScript) can run in parallel.
- **Phase 6 (UI Panel)**: Depends on Phase 2 (transcript) + Phase 3 (controls/recording). Can start after Phase 2.
- **Phase 7 (TAK Export)**: Depends on Phase 3 (recording patterns) + Phase 5 (video pipeline).

### Parallel Opportunities

```
Phase 1: T001 ║ T002 ║ T003 ║ T004 ║ T005   (all different files, zero deps)
Phase 1: T011 ║ T012 ║ T013                  (TypeScript, parallel with Python T006-T009)
Phase 2: T014-T016 (Python) ║ T017-T019 (TypeScript)
Phase 3: T020-T023 (Python) ║ T024-T028 (TypeScript)
Phase 4 ║ Phase 5                             (independent pipelines)
Phase 5: T032 ║ T033 (Python) ║ T034-T035 (TypeScript)
Phase 6: T036 ║ T037 ║ T038 ║ T039          (different UI components)
```

---

## Implementation Strategy

### MVP First (Phases 1-3)

1. Complete Phase 1: Docker + MQTT + health (T001-T013)
2. Complete Phase 2: Audio transcription (T014-T019)
3. Complete Phase 3: Streaming + recording (T020-T028)
4. **STOP AND VALIDATE**: Audio transcription in browser, recording works, health visible
5. This is a fully usable feature: radio audio → transcription → searchable text → recording

### Incremental Delivery

1. Phases 1-3 → MVP: Audio transcription + streaming + recording → **Deployable**
2. Phase 4 → Audio cleanup (Demucs or fallback) → **Deployable**
3. Phase 5 → Video intelligence → **Deployable**
4. Phase 6 → Full UI integration → **Deployable**
5. Phase 7 → TAK media export → **Final**

Each increment adds value without breaking previous functionality.

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- Python media-service code uses snake_case (PEP 8). SvelteKit code uses kebab-case files / camelCase variables.
- The media-service container has its own Dockerfile and codebase — separate from the SvelteKit `docker/Dockerfile`
- All MQTT payloads are JSON. Schemas defined in `data-model.md` and enforced in `mqtt-types.ts`.
- The `webrtcsink` WHEP endpoint port must be exposed from the Docker container to the host for browser access
- Model files (Whisper, YOLOX, Demucs) are NOT included in the Docker image — mounted as a read-only volume from the host
- SQLite tables for transcriptions and detections live in the existing `rf_signals.db` database, not in a separate media database
- The MQTT bridge in SvelteKit is server-side only — no MQTT client runs in the browser bundle
