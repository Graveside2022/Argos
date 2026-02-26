# Data Model: GStreamer Media Pipeline Integration

**Feature**: 021-gstreamer-media-pipeline | **Date**: 2026-02-26

---

## Entities

### PipelineConfig

Configuration for a single GStreamer pipeline instance within the media-service.

```python
@dataclass
class PipelineConfig:
    """Configuration for a named GStreamer pipeline."""
    name: str                    # Unique pipeline identifier: 'radio-audio', 'video-detection', 'recording'
    enabled: bool                # Whether the pipeline should start automatically
    source_type: str             # 'alsa', 'fifo', 'v4l2', 'rtsp', 'test'
    source_device: str           # Device path: 'hw:Loopback,1,0', '/dev/video0', 'rtsp://...'
    sample_rate: int             # Audio sample rate (default: 16000 for Whisper)
    channels: int                # Audio channels (default: 1, mono)
    resolution: tuple[int, int]  # Video resolution (default: (640, 480))
    framerate: int               # Video framerate target (default: 15)
```

**Validation rules**:

- `name`: One of `'radio-audio'`, `'audio-cleanup'`, `'video-detection'`, `'recording'`, `'rtsp-server'`
- `source_type`: Must match hardware availability (checked at pipeline build time)
- `sample_rate`: 8000, 16000, 22050, 44100, or 48000 (Whisper requires 16000)
- `channels`: 1 or 2
- `resolution`: Min (160, 120), max (1920, 1080)
- `framerate`: 1-30

---

### PipelineState

Runtime state of a single pipeline, reported to MQTT health topic.

```python
@dataclass
class PipelineState:
    """Runtime health state of a GStreamer pipeline."""
    name: str                       # Pipeline identifier
    state: str                      # 'running', 'paused', 'error', 'stopped', 'restarting'
    latency_ms: float               # Current processing latency in milliseconds
    buffer_pct: float               # Queue fill percentage (0-100)
    throughput: float               # Samples/sec (audio) or FPS (video)
    total_processed: int            # Total samples or frames processed since start
    uptime_s: float                 # Seconds since last successful start
    last_error: str | None          # Most recent error message, if any
    restart_count: int              # Number of auto-restarts since service start
```

**State transitions**:

```
stopped → running    (on start command)
running → paused     (on pause command)
paused  → running    (on resume command)
running → error      (on GStreamer bus error)
error   → restarting (auto-restart triggered)
restarting → running (restart succeeds)
restarting → error   (restart fails, backoff increases)
*       → stopped    (on stop command)
```

---

### TranscriptionResult

A single transcription segment produced by the Whisper element.

```python
@dataclass
class TranscriptionResult:
    """A transcribed segment of radio audio."""
    id: str                   # UUID for deduplication
    text: str                 # Transcribed text content
    timestamp: str            # ISO 8601 timestamp of speech start
    duration_ms: int          # Duration of the audio segment in milliseconds
    confidence: float         # Whisper confidence score (0.0-1.0)
    language: str             # Detected language code (e.g., 'en')
    source_pipeline: str      # Pipeline that produced this: 'radio-audio'
    cleanup_applied: bool     # Whether audio cleanup was active for this segment
```

**Storage**: SQLite table `media_transcriptions`

```sql
CREATE TABLE IF NOT EXISTS media_transcriptions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    confidence REAL NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    source_pipeline TEXT NOT NULL,
    cleanup_applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transcriptions_timestamp ON media_transcriptions(timestamp);
CREATE INDEX idx_transcriptions_text ON media_transcriptions(text);
```

---

### DetectionEvent

An object detection result from YOLOX inference.

```python
@dataclass
class DetectionEvent:
    """A single object detection from video inference."""
    id: str                   # UUID
    class_label: str          # Detection class: 'person', 'vehicle', 'bicycle', etc.
    confidence: float         # Detection confidence (0.0-1.0)
    bbox_x: float             # Bounding box X (normalized 0.0-1.0)
    bbox_y: float             # Bounding box Y (normalized 0.0-1.0)
    bbox_w: float             # Bounding box width (normalized 0.0-1.0)
    bbox_h: float             # Bounding box height (normalized 0.0-1.0)
    frame_timestamp: str      # ISO 8601 timestamp of the video frame
    camera_id: str            # Source camera identifier
    tracking_id: str | None   # IoU tracker ID for cross-frame correlation (optional)
```

**Storage**: SQLite table `media_detections`

```sql
CREATE TABLE IF NOT EXISTS media_detections (
    id TEXT PRIMARY KEY,
    class_label TEXT NOT NULL,
    confidence REAL NOT NULL,
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_w REAL NOT NULL,
    bbox_h REAL NOT NULL,
    frame_timestamp TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    tracking_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_detections_timestamp ON media_detections(frame_timestamp);
CREATE INDEX idx_detections_class ON media_detections(class_label);
```

---

### RecordingSession

Metadata for an active or completed recording.

```python
@dataclass
class RecordingSession:
    """A bounded recording session."""
    id: str                   # UUID
    pipeline_name: str        # Source pipeline: 'radio-audio' or 'video-detection'
    media_type: str           # 'audio' or 'video'
    state: str                # 'recording', 'finalizing', 'completed', 'error'
    filename: str             # Full path: /data/recordings/argos-radio-20260226-143000.ogg
    format: str               # File format: 'ogg', 'mkv', 'wav', 'aac'
    started_at: str           # ISO 8601 start timestamp
    stopped_at: str | None    # ISO 8601 stop timestamp (None if still recording)
    bytes_written: int        # Current file size in bytes
    duration_ms: int          # Recording duration in milliseconds
```

**State transitions**:

```
(none)     → recording    (on start command)
recording  → finalizing   (on stop command, EOS sent to file sink)
finalizing → completed    (EOS received, file flushed and closed)
recording  → error        (pipeline error during recording)
finalizing → error        (flush/close fails)
```

---

### HealthReport

The top-level health message published to `argos/media/health` every 5 seconds.

```python
@dataclass
class HealthReport:
    """Periodic health snapshot of all media pipelines and system resources."""
    timestamp: str                              # ISO 8601
    pipelines: dict[str, PipelineState]         # Keyed by pipeline name
    system: SystemMetrics                       # Container-level metrics

@dataclass
class SystemMetrics:
    """System resource usage for the media-service container."""
    cpu_pct: float         # CPU usage percentage (0-100)
    mem_mb: float          # Memory usage in MB
    disk_free_mb: float    # Free disk space in recordings directory
```

**MQTT payload example** (matches schema from spec):

```json
{
	"timestamp": "2026-02-26T14:30:00Z",
	"pipelines": {
		"radio-audio": {
			"state": "running",
			"latency_ms": 120,
			"buffer_pct": 45,
			"throughput": 16000,
			"total_processed": 1584000,
			"uptime_s": 3600,
			"last_error": null,
			"restart_count": 0
		},
		"video-detection": {
			"state": "running",
			"latency_ms": 85,
			"buffer_pct": 30,
			"throughput": 12.4,
			"total_processed": 44640,
			"uptime_s": 3600,
			"last_error": null,
			"restart_count": 0
		},
		"recording": {
			"state": "stopped",
			"latency_ms": 0,
			"buffer_pct": 0,
			"throughput": 0,
			"total_processed": 0,
			"uptime_s": 0,
			"last_error": null,
			"restart_count": 0
		}
	},
	"system": {
		"cpu_pct": 38.2,
		"mem_mb": 512,
		"disk_free_mb": 12400
	}
}
```

---

### MediaServiceConfig

Top-level configuration for the media-service, loaded from YAML.

```python
@dataclass
class MediaServiceConfig:
    """Top-level media-service configuration."""
    mqtt_broker: str              # Mosquitto hostname (default: 'mosquitto')
    mqtt_port: int                # MQTT port (default: 1883)
    recording_dir: str            # Path to recordings directory
    disk_warning_threshold_mb: int  # Low-storage warning threshold (default: 500)
    whisper_model: str            # Path to Whisper model file
    yolox_model: str              # Path to YOLOX ONNX model file
    demucs_model: str | None      # Path to Demucs model (None = disabled)
    rtsp_port: int                # RTSP server port (default: 8554)
    health_interval_s: int        # Health publish interval (default: 5)
    max_restart_delay_s: int      # Maximum auto-restart backoff (default: 30)
    pipelines: dict[str, PipelineConfig]  # Pipeline configurations by name
```

---

## Relationships

```
MediaServiceConfig ──1:N──> PipelineConfig       (one config per pipeline)
PipelineConfig     ──1:1──> PipelineState         (runtime state per pipeline)
PipelineState      ──N:1──> HealthReport.pipelines (all states in one report)
radio-audio pipeline ──1:N──> TranscriptionResult  (one per utterance)
video-detection pipeline ──1:N──> DetectionEvent   (one per detection per frame)
recording pipeline ──1:1──> RecordingSession       (one active session at a time per media type)
HealthReport ──1:1──> SystemMetrics               (container-level metrics)
```

---

## Storage

### Python-Side (media-service container)

- **Configuration**: YAML file at `config/media-service.yaml`, overridable by environment variables
- **Models**: Read-only volume mount at `/models/` (Whisper, YOLOX, Demucs binaries)
- **Recordings**: Docker volume or bind mount at `/data/recordings/`
- **No database in media-service**: All persistence is via MQTT → SvelteKit server → SQLite

### SvelteKit-Side (existing Argos database)

- **Transcriptions**: `media_transcriptions` table in existing `rf_signals.db` (via migration)
- **Detections**: `media_detections` table in existing `rf_signals.db` (via migration)
- **Recording metadata**: Transient (in memory via Svelte store), not persisted to DB

### MQTT (Mosquitto broker)

- **No persistence**: All topics are ephemeral. The broker does not retain messages across restarts.
- **Retained messages**: `argos/media/health` publishes with retain=true so new subscribers immediately get the last known state.
