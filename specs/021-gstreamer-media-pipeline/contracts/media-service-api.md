# API Contracts: GStreamer Media Pipeline

**Feature**: 021-gstreamer-media-pipeline | **Date**: 2026-02-26

---

## Overview

The media pipeline feature introduces two communication channels:

1. **MQTT** — Primary message bus between the media-service container and the SvelteKit server. All media events (transcription, detection, health, recording status) and control commands flow through MQTT topics.
2. **WebRTC (WHEP)** — Direct browser-to-media-service streaming for audio and video. The browser's `RTCPeerConnection` negotiates with the `webrtcsink` WHEP endpoint.

No new SvelteKit REST API endpoints are required for P1. The SvelteKit server acts as an MQTT subscriber that re-broadcasts events to existing WebSocket clients.

---

## MQTT Topic Contracts

### Outbound: media-service → SvelteKit / UI

#### `argos/media/transcription` (QoS 1)

Published per transcription segment. SvelteKit bridge inserts into SQLite and broadcasts to WebSocket.

```json
{
	"id": "uuid-v4",
	"text": "Alpha team, move to checkpoint bravo",
	"timestamp": "2026-02-26T14:30:15.200Z",
	"duration_ms": 3200,
	"confidence": 0.87,
	"language": "en",
	"source_pipeline": "radio-audio",
	"cleanup_applied": false
}
```

#### `argos/media/detections` (QoS 0)

Published per detection per frame. High frequency — QoS 0 to avoid backpressure.

```json
{
	"id": "uuid-v4",
	"class_label": "person",
	"confidence": 0.82,
	"bbox_x": 0.35,
	"bbox_y": 0.2,
	"bbox_w": 0.15,
	"bbox_h": 0.45,
	"frame_timestamp": "2026-02-26T14:30:15.200Z",
	"camera_id": "usb-cam-0",
	"tracking_id": "track-42"
}
```

#### `argos/media/health` (QoS 0, retain=true)

Published every 5 seconds. Retained so new subscribers immediately get the last known state.

```json
{
	"timestamp": "2026-02-26T14:30:00Z",
	"pipelines": {
		"radio-audio": {
			"name": "radio-audio",
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
			"name": "video-detection",
			"state": "stopped",
			"latency_ms": 0,
			"buffer_pct": 0,
			"throughput": 0,
			"total_processed": 0,
			"uptime_s": 0,
			"last_error": null,
			"restart_count": 0
		},
		"recording": {
			"name": "recording",
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
		"disk_free_mb": 12400,
		"disk_warning": false
	}
}
```

#### `argos/media/errors` (QoS 1)

Published on GStreamer bus error or warning. Low frequency — QoS 1 for reliability.

```json
{
	"pipeline": "radio-audio",
	"error": "Resource not found",
	"debug": "gst_alsa_open(): Could not open audio device for playback",
	"severity": "error",
	"timestamp": "2026-02-26T14:30:15.200Z"
}
```

#### `argos/media/recording/status` (QoS 1)

Published on recording state changes.

```json
{
	"state": "recording",
	"pipeline_name": "radio-audio",
	"media_type": "audio",
	"file": "/data/recordings/argos-radio-20260226-143000.ogg",
	"format": "ogg",
	"started_at": "2026-02-26T14:30:00Z",
	"stopped_at": null,
	"bytes_written": 1048576,
	"duration_ms": 30000
}
```

#### `argos/media/export/ready` (QoS 1)

Published when a TAK export file is ready.

```json
{
	"type": "audio_clip",
	"format": "aac",
	"file": "/data/exports/argos-clip-20260226-143000.aac",
	"duration_ms": 30000,
	"bytes": 256000,
	"timestamp": "2026-02-26T14:30:30Z"
}
```

---

### Inbound: UI / SvelteKit → media-service

#### `argos/media/recording/command` (QoS 1)

```json
{
	"action": "start",
	"media_type": "audio"
}
```

```json
{
	"action": "stop",
	"media_type": "audio"
}
```

#### `argos/media/pipeline/command` (QoS 1)

```json
{
	"pipeline": "radio-audio",
	"action": "start"
}
```

Valid actions: `"start"`, `"stop"`, `"restart"`. Valid pipeline names: `"radio-audio"`, `"audio-cleanup"`, `"video-detection"`, `"recording"`, `"rtsp-server"`.

#### `argos/media/transcription/toggle` (QoS 1)

```json
{
	"enabled": true
}
```

#### `argos/media/cleanup/toggle` (QoS 1)

```json
{
	"enabled": true
}
```

#### `argos/media/detection/toggle` (QoS 1)

```json
{
	"enabled": true
}
```

#### `argos/media/source/select` (QoS 1)

```json
{
	"type": "camera",
	"source_id": "/dev/video0"
}
```

```json
{
	"type": "audio",
	"source_id": "hw:Loopback,1,0"
}
```

#### `argos/media/export/command` (QoS 1)

```json
{
	"type": "audio_clip",
	"duration_s": 30,
	"format": "aac",
	"output_path": "/data/exports/"
}
```

```json
{
	"type": "snapshot",
	"format": "jpeg",
	"output_path": "/data/exports/"
}
```

---

## WebRTC WHEP Endpoints

The `webrtcsink` element exposes WHEP (WebRTC-HTTP Egress Protocol) endpoints for browser signaling.

### Audio Stream

```
POST http://<media-service-host>:8443/whep/audio
Content-Type: application/sdp

[SDP Offer from browser RTCPeerConnection]

Response: 201 Created
Content-Type: application/sdp
Location: /whep/audio/session/<session-id>

[SDP Answer]
```

### Video Stream

```
POST http://<media-service-host>:8443/whep/video
Content-Type: application/sdp

[SDP Offer]

Response: 201 Created
Content-Type: application/sdp
Location: /whep/video/session/<session-id>

[SDP Answer]
```

### Browser Integration Pattern

```typescript
// AudioPlayer.svelte / VideoFeed.svelte
const pc = new RTCPeerConnection();
pc.addTransceiver('audio', { direction: 'recvonly' }); // or 'video'
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const response = await fetch('http://media-service:8443/whep/audio', {
	method: 'POST',
	headers: { 'Content-Type': 'application/sdp' },
	body: offer.sdp
});
const answerSdp = await response.text();
await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

// Incoming audio/video arrives via ontrack event
pc.ontrack = (event) => {
	audioElement.srcObject = event.streams[0]; // or videoElement
};
```

---

## RTSP Server Endpoint (TAK)

The GStreamer RTSP server exposes a mount point for TAK/ATAK video consumption.

```
rtsp://<media-service-host>:8554/live
```

- Codec: H.264 (Baseline profile for compatibility)
- Container: RTP over RTSP
- Authentication: None (internal network only)

ATAK video player configuration:

```
URL: rtsp://<argos-node-ip>:8554/live
Protocol: TCP
```

---

## SvelteKit WebSocket Events

The MQTT bridge re-broadcasts media events to existing WebSocket clients using these message types:

| WebSocket Message Type | Source MQTT Topic              | Payload                                           |
| ---------------------- | ------------------------------ | ------------------------------------------------- |
| `media_transcription`  | `argos/media/transcription`    | `TranscriptionResult`                             |
| `media_detection`      | `argos/media/detections`       | `DetectionEvent`                                  |
| `media_health`         | `argos/media/health`           | `HealthReport`                                    |
| `media_error`          | `argos/media/errors`           | `{ pipeline, error, debug, severity, timestamp }` |
| `media_recording`      | `argos/media/recording/status` | `RecordingStatus`                                 |

These message types are added to the existing WebSocket handler in `src/lib/server/websocket-handlers.ts` and consumed by Svelte stores in the browser.

---

## Existing API Dependencies (consumed, not modified)

### Hardware Status (consumed by media health dashboard)

```
GET /api/hardware/status
Response: { sdr: { sdrState, hackrf: {...} }, wifi: {...}, gps: {...} }
Polling interval: 5s (TopStatusBar)
Used for: Displaying media health alongside hardware health
```

### TAK Service (consumed for media export delivery)

```
Existing: src/lib/server/tak/tak-service.ts
Used for: Sending CoT messages with media attachments
Integration: media-service writes export files to shared volume,
             publishes argos/media/export/ready to MQTT,
             tak-bridge subscribes and attaches to CoT
```

---

## No New SvelteKit REST Endpoints

P1/P2/P3 require **zero new REST API routes** in SvelteKit. All communication flows through:

1. **MQTT** — media-service ↔ SvelteKit server (via mqtt.js)
2. **WebSocket** — SvelteKit server → browser (existing infrastructure)
3. **WebRTC WHEP** — media-service → browser (direct)

Future phases may add REST endpoints for:

- `GET /api/media/transcriptions?q=<search>&from=<date>&to=<date>` — search transcription history
- `GET /api/media/detections?class=<label>&from=<date>&to=<date>` — search detection history
- `GET /api/media/recordings` — list recording files

These are deferred until the MVP is validated.
