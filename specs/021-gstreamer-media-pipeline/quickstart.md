# Quickstart: GStreamer Media Pipeline Development

**Feature**: 021-gstreamer-media-pipeline | **Date**: 2026-02-26

---

## Prerequisites

- Docker and Docker Compose installed on Pi 5 (or dev machine)
- Argos dev server running (`npm run dev`)
- ALSA loopback kernel module available (`snd-aloop`)
- DSD-FME running and outputting decoded audio (for full integration test)
- USB camera (optional, for video pipeline testing)
- Model files downloaded (see Step 0)

## Step 0: Download Model Files

```bash
mkdir -p models/

# Whisper base model (~142 MB)
wget -O models/whisper-base.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# YOLOX nano ONNX (~4 MB)
wget -O models/yolox-nano.onnx \
    https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx

# Demucs model (~80 MB, optional — download via Python)
pip install demucs
python3 -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')"
```

## Step 1: Load ALSA Loopback

```bash
# Load kernel module
sudo modprobe snd-aloop

# Verify
aplay -l | grep Loopback
# Expected: card X: Loopback [Loopback], device 0: Loopback PCM [Loopback PCM]

# Make persistent across reboots
echo "snd-aloop" | sudo tee /etc/modules-load.d/snd-aloop.conf
```

## Build Order

Implementation follows a bottom-up dependency chain. Each phase is independently testable.

### Phase 1: Docker Infrastructure + MQTT Bus

**Files to create**:

1. `docker/mosquitto/mosquitto.conf` — MQTT broker config
2. `docker/docker-compose.media.yml` — Docker Compose for media stack
3. `media-service/Dockerfile` — Multi-stage GStreamer + Python build
4. `media-service/requirements.txt` — Python deps
5. `media-service/config/media-service.yaml` — Default config
6. `media-service/src/mqtt_client.py` — MQTT wrapper
7. `media-service/src/pipelines/base.py` — Base pipeline class
8. `media-service/src/health/monitor.py` — Health publisher
9. `media-service/src/main.py` — Entry point

**Test**:

```bash
# Build and start media stack
docker compose -f docker/docker-compose.media.yml up --build

# In another terminal, subscribe to MQTT to verify health publishes
docker exec -it argos-mosquitto mosquitto_sub -t 'argos/media/#' -v
# Expected: argos/media/health {"timestamp":"...","pipelines":{...},"system":{...}} every 5s
```

**SvelteKit files to create**:

10. `src/lib/server/services/media/mqtt-types.ts` — TypeScript types
11. `src/lib/server/services/media/mqtt-bridge.ts` — MQTT → WebSocket bridge

**Test**:

```bash
# Install mqtt.js
npm install mqtt

# Start Argos dev server
npm run dev

# Verify MQTT bridge connects (check server logs)
# Verify health events appear in browser WebSocket messages
```

### Phase 2: Audio Ingest + Transcription (US-1)

**Files to create**:

12. `media-service/src/utils/pipeline_builder.py` — Pipeline construction helpers
13. `media-service/src/pipelines/radio_audio.py` — Audio ingest + Whisper
14. `src/lib/server/db/migrations/20260226_create_media_tables.ts` — SQLite migration
15. `src/lib/stores/dashboard/transcription-store.ts` — Transcription store
16. `src/lib/components/dashboard/panels/media/TranscriptionFeed.svelte` — Transcript UI

**Test**:

```bash
# Rebuild media-service with radio pipeline
docker compose -f docker/docker-compose.media.yml up --build

# Verify audio pipeline starts
docker exec -it argos-mosquitto mosquitto_sub -t 'argos/media/transcription' -v
# Speak near the audio source — expect transcription JSON within 5 seconds

# Python unit tests
docker exec -it argos-media-service pytest tests/test_radio_pipeline.py
```

### Phase 3: Streaming + Recording (US-4)

**Files to create/modify**:

17. Modify `media-service/src/pipelines/radio_audio.py` — Add tee + webrtcsink
18. `media-service/src/pipelines/recording.py` — Dynamic recording toggle
19. `src/lib/stores/dashboard/media-store.ts` — Media state store
20. `src/lib/components/dashboard/panels/media/AudioPlayer.svelte` — WebRTC player
21. `src/lib/components/dashboard/panels/media/MediaControls.svelte` — Toggle controls
22. `src/lib/components/dashboard/panels/media/RecordingIndicator.svelte` — Recording UI

**Test**:

```bash
# Open browser — verify audio plays via WebRTC
# Click Record — verify indicator appears
# Click Stop — verify file at /data/recordings/argos-radio-YYYYMMDD-HHmmss.ogg

# Recording unit tests
docker exec -it argos-media-service pytest tests/test_recording_toggle.py
```

### Phase 4: Audio Cleanup (US-2)

**Files to create**:

23. `media-service/src/pipelines/audio_cleanup.py` — Demucs or fallback

**Test**:

```bash
# Benchmark Demucs
docker exec -it argos-media-service python3 tests/benchmark_demucs.py
# Expected output: CPU %, RAM MB, processing time

# Toggle cleanup via MQTT
docker exec -it argos-mosquitto mosquitto_pub \
    -t 'argos/media/cleanup/toggle' -m '{"enabled": true}'
# Verify cleaned audio in WebRTC stream
```

### Phase 5: Video Intelligence (US-3)

**Files to create**:

24. `media-service/src/pipelines/video_detection.py` — Camera + YOLOX
25. `src/lib/components/dashboard/panels/media/VideoFeed.svelte` — Video player

**Test**:

```bash
# Ensure camera is connected and passed through to container
# Enable detection via MQTT
docker exec -it argos-mosquitto mosquitto_pub \
    -t 'argos/media/detection/toggle' -m '{"enabled": true}'

# Verify detection events
docker exec -it argos-mosquitto mosquitto_sub -t 'argos/media/detections' -v

# Verify video in browser with bounding boxes
```

### Phase 6: UI Integration

**Files to create/modify**:

26. `src/lib/components/dashboard/panels/media/MediaHealth.svelte` — Health display
27. Modify `PanelContainer.svelte` — Add media panel
28. Modify `IconRail.svelte` — Add media button
29. Modify `TopStatusBar.svelte` — Add media health dot

### Phase 7: TAK Media Export (US-5)

**Files to create**:

30. `media-service/src/pipelines/rtsp_server.py` — RTSP for TAK
31. `media-service/src/pipelines/tak_export.py` — Clip/snapshot export

**Test**:

```bash
# Start RTSP server
docker exec -it argos-mosquitto mosquitto_pub \
    -t 'argos/media/pipeline/command' \
    -m '{"pipeline": "rtsp-server", "action": "start"}'

# Verify RTSP
ffplay rtsp://localhost:8554/live

# Test audio export
docker exec -it argos-mosquitto mosquitto_pub \
    -t 'argos/media/export/command' \
    -m '{"type": "audio_clip", "duration_s": 10, "format": "aac", "output_path": "/data/exports/"}'
```

---

## Verification Checklist

```bash
# Docker stack health
docker compose -f docker/docker-compose.media.yml ps
# Expected: mosquitto (healthy), media-service (healthy)

# MQTT health messages
docker exec -it argos-mosquitto mosquitto_sub -t 'argos/media/health' -C 1
# Expected: JSON health report

# GStreamer verification inside container
docker exec -it argos-media-service gst-inspect-1.0 --version
docker exec -it argos-media-service gst-inspect-1.0 rswhisper
docker exec -it argos-media-service gst-inspect-1.0 rsyolox
docker exec -it argos-media-service gst-inspect-1.0 webrtcsink

# Python bindings verification
docker exec -it argos-media-service python3 -c "
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst
Gst.init(None)
print(f'GStreamer {Gst.version_string()}')
print(f'Plugins: {len(Gst.Registry.get().get_plugin_list())}')
"

# Python unit tests
docker exec -it argos-media-service pytest tests/ -v

# SvelteKit type check
npx tsc --noEmit

# SvelteKit lint (new files)
npx eslint src/lib/server/services/media/ src/lib/stores/dashboard/media-store.ts src/lib/stores/dashboard/transcription-store.ts --config config/eslint.config.js

# SvelteKit build
npm run build
```

## Key Gotchas

1. **ALSA device naming**: The loopback capture device is `hw:Loopback,1,0` (card Loopback, device 1, subdevice 0). DSD-FME outputs to `hw:Loopback,0,0`. Getting these backwards means silence.
2. **Docker device passthrough**: ALSA devices (`/dev/snd`) and camera devices (`/dev/video0`) must be mounted into the container. The `audio` and `video` group-adds must match the host GIDs.
3. **GStreamer plugin path**: Built Rust plugins (.so files) must be in `/usr/local/lib/gstreamer-1.0/` or `GST_PLUGIN_PATH` must be set in the container environment.
4. **Whisper model format**: The GStreamer Whisper element expects ggml format (from whisper.cpp). OpenAI's original .pt models won't work.
5. **WebRTC WHEP port**: The `webrtcsink` WHEP endpoint port (default 8443) must be exposed from the Docker container to the host for browser access. Add to docker-compose port mapping.
6. **MQTT reconnection**: If Mosquitto restarts, both media-service and SvelteKit MQTT bridge must reconnect automatically. Test this during development.
7. **Recording directory permissions**: The Docker volume for `/data/recordings/` must be writable by the container's user. Use a named volume or ensure bind-mount permissions are correct.
8. **Rust plugin build time**: Building gst-plugins-rs from source takes 30-60 minutes on Pi 5. Use Docker build caching aggressively — separate the Rust build into its own stage so it only rebuilds when the GStreamer version changes.
9. **Memory budget**: Monitor `docker stats` during development. If media-service + Mosquitto exceed 600 MB total, reduce model sizes or disable features.
10. **MQTT topic typos**: A typo in a topic string means silent message loss — no error, just no delivery. Use constants for topic strings in both Python and TypeScript.
