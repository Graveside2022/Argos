# Argos Intelligence Roadmap v2

**Device Enrichment + Trunked Radio Integration**

**Date:** 2026-02-24
**Branch:** `016-code-expressiveness`
**Platform:** Raspberry Pi 5 (8 GB RAM) — Kali Linux — SvelteKit + TypeScript

> **See also:** [SoapySDR Integration Plan](../Argos_tools_integration/offnet/utilities/sdr-infrastructure/soapysdr.md) — SDR device management and arbitration layer. Tracks 4 and 5 in this roadmap depend on the `DeviceLockService` defined there for SDR hardware arbitration.

---

## Executive Summary

Argos surfaces ~30% of the intelligence Kismet already captures. The device table shows 11 columns from a narrow API slice. Meanwhile, the tool registry includes four trunked radio tools with no active integrations, and protocol-level visibility is nonexistent.

This document defines five integration tracks — three tiers of device enrichment plus two trunked radio tracks — that transform Argos from a passive device mapper into a multi-domain tactical intelligence console. Each track is independent and can be implemented in any order.

| Track | Strategy | What It Adds | RAM | Effort |
|-------|----------|-------------|-----|--------|
| **Tier 1** | Kismet deep extract | Probe requests, BLE UUIDs, 802.11 fingerprints, responded SSIDs | **0 MB** | ~1-2 days |
| **Tier 2** | NFStream protocol tagging (ONNET) | Per-device protocol badges (HTTP, MQTT, SSH, ⚠ DNS-Tunnel) | **~50 MB** | ~1 week |
| **Tier 3** | Activity profiling (OFFNET) | Behavioral classification (STREAMING, BURSTY, PERIODIC, IDLE) | **<1 MB** | Prototype |
| **Track 4** | Trunk Recorder + Rdio Scanner | P25 trunked radio monitoring with scanner UI | **~575 MB** | ~1 week |
| **Track 5** | DSD-FME multi-protocol decode | DMR, NXDN, D-STAR, EDACS, YSF voice decode → Rdio Scanner | **~50-100 MB** | ~3 days |

### Track Interdependencies

**What gets installed vs what's code-only:**

| Track | Installs External Tool? | What Gets Installed | Argos Code Changes |
|-------|------------------------|--------------------|--------------------|
| **Tier 1** | ❌ No — code only | Nothing | Parse more fields from existing Kismet API response |
| **Tier 2** | ✅ Yes | NFStream (`pip install nfstream`) + `nfstream-svc.py` microservice | New consumer, store, MCP tools |
| **Tier 3** | ❌ No — code only | Nothing | New classifier module using existing Kismet data |
| **Track 4** | ✅ Yes — two tools | Trunk Recorder (build/Docker) + Rdio Scanner (ARM64 binary) | New iframe view, WS consumer, store, MCP tools |
| **Track 5** | ✅ Yes | DSD-FME (build from source) | Rename `dsd-neo` → `dsd-fme` in tool registry |

**Integration dependency matrix — who feeds into whom:**

```
                    ┌─────────────────────────────────────────────────┐
                    │                ARGOS DASHBOARD                   │
                    │  (Device Table + Map + Iframe + MCP Agent)       │
                    └────┬──────────┬──────────┬──────────┬───────────┘
                         │          │          │          │
                    ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐
                    │ Tier 1 │ │ Tier 2 │ │ Tier 3 │ │Track 4 │
                    │Kismet  │ │NFStream│ │Activity│ │Scanner │
                    │Extract │ │Proto   │ │Profile │ │iframe  │
                    └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘
                         │          │          │          │
                    Kismet API  nfstream-  Kismet API  Rdio Scanner
                    (existing)  svc.py     (existing)  (:3000)
                                (new)                     ▲
                                                          │
                                              ┌───────────┴───────────┐
                                              │                       │
                                        Trunk Recorder          DSD-FME
                                        (rdioscanner_uploader)  (dirwatch)
                                        Track 4                 Track 5
```

**Which tools talk to each other (data flows):**

| From | To | Method | Dependency |
|------|----|--------|-----------|
| Kismet | Argos | REST API (existing) | Always-on, already integrated |
| NFStream | Argos | Unix socket (`/tmp/argos-nfstream.sock`) | Independent — no connection to Tracks 4/5 |
| Trunk Recorder | **Rdio Scanner** | `rdioscanner_uploader` plugin (POST `/api/call-upload`) | **TR requires Rdio Scanner running** |
| DSD-FME | **Rdio Scanner** | dirwatch (WAV files in `/var/lib/dsd-fme/recordings/`) | **DSD-FME requires Rdio Scanner running** |
| Trunk Recorder | Argos | WebSocket status (`:3005`) | Sidebar + map markers |
| Rdio Scanner | Argos | iframe embed (`:3000`) | Dashboard view |

**Required install order (due to dependencies):**

| Step | What | Why |
|------|------|-----|
| 1 | **Rdio Scanner** | Hub — both TR and DSD-FME feed audio into it |
| 2 | **Trunk Recorder** | Depends on Rdio Scanner for audio delivery |
| 3 | **DSD-FME** | Depends on Rdio Scanner's dirwatch |
| 4 | **NFStream** | Independent — install anytime |

> **Key insight:** Rdio Scanner is the central audio hub. Trunk Recorder and DSD-FME are independent audio *sources* that both feed into it. NFStream is completely orthogonal — it has zero connection to the radio stack.

---

## Tool Repository & Documentation Reference

### NFStream — Network Flow Analysis Framework (Tier 2)

| | Link |
|---|---|
| **GitHub** | https://github.com/nfstream/nfstream |
| **Website** | https://www.nfstream.org |
| **API Docs** | https://nfstream.org/docs/api |
| **License** | LGPLv3 |
| **Language** | Python (C engine via CFFI) |
| **Stars** | ⭐ 1,200+ |
| **Releases** | [78 releases](https://github.com/nfstream/nfstream/releases) |
| **DPI Engine** | [nDPI](https://github.com/ntop/nDPI) (⭐ 4,200+, 171 contributors) |
| **ARM64 support** | Since v6.5.2 |
| **Research citations** | [100+ papers](https://scholar.google.com/scholar?cites=14084093141225707606) |
| **Key features** | Encrypted app identification, TLS/SSH/DHCP/HTTP metadata, flow statistics, process visibility (PID/name) |

**Why NFStream over nDPId:**
- Same nDPI engine underneath — identical protocol detection quality
- 1,200+ stars vs nDPId's 26 — much larger community
- `pip install nfstream` — no build from source, ARM64 wheels available
- Richer output: flow statistics (bytes, packets, duration, inter-arrival times) alongside protocol labels
- Process visibility: can identify which local process generated a flow (PID + process name)
- Plugin system (NFPlugins) for custom flow features in Python
- Published in Computer Networks journal, 100+ research papers use it

**Install on RPi 5:**
```bash
# Ensure Python 3.9+ and libpcap
sudo apt-get install -y python3-pip libpcap-dev

# Install NFStream (ARM64 wheel available)
pip install nfstream

# Verify
python3 -c "from nfstream import NFStreamer; print('NFStream OK')"
```

**Argos integration — Python microservice:**
```bash
# nfstream-svc.py runs as a systemd service
# Captures on managed mode interfaces only (e.g., eth0, wlan0).
# IMPORTANT: Do not bind to monitor mode interfaces used by Kismet (e.g. wlan1, wlan2),
# as NFStream requires L3 IP connectivity and cannot parse raw 802.11 radiotap headers.
# Streams per-flow JSON over Unix socket.
# Argos consumer reads from /tmp/argos-nfstream.sock
python3 /opt/argos/nfstream-svc.py
```

**Environment variables (`.env.example`):**
```bash
# NFStream Protocol Tagging (Tier 2)
NFSTREAM_ENABLED=false
NFSTREAM_SOCKET_PATH=/tmp/argos-nfstream.sock
NFSTREAM_INTERFACE=eth0
NFSTREAM_IDLE_TIMEOUT=30
NFSTREAM_ACTIVE_TIMEOUT=300
```

---

### Trunk Recorder — P25 Trunked Radio Recording (Track 4)

| | Link |
|---|---|
| **GitHub** | https://github.com/TrunkRecorder/trunk-recorder |
| **Documentation** | https://trunkrecorder.com/docs/intro |
| **Wiki** | https://github.com/robotastic/trunk-recorder/wiki |
| **Discord** | https://discord.gg/btJAhESnks |
| **License** | GPL-3.0 |
| **Language** | C++ (GNU Radio) |
| **Version** | v5.0 |
| **Stars** | ⭐ 900+ |
| **Releases** | [42 releases](https://github.com/TrunkRecorder/trunk-recorder/releases) |
| **RPi Install Guide** | [INSTALL-PI.md](https://github.com/TrunkRecorder/trunk-recorder/blob/master/docs/Install/INSTALL-PI.md) |
| **Docker Install** | [INSTALL-DOCKER.md](https://github.com/TrunkRecorder/trunk-recorder/blob/master/docs/Install/INSTALL-DOCKER.md) |
| **Video Walkthrough** | [YouTube](https://youtu.be/DizBtDZ6kE8) |
| **Supports** | P25 Phase 1/2, SmartNet, conventional P25/DMR/analog |
| **SDRs** | RTL-SDR, HackRF, Airspy, BladeRF, USRP (via osmosdr/SoapySDR) |
| **Status server** | WebSocket (configurable port, default 3005) |
| **Plugin** | `rdioscanner_uploader` (built-in, ships with TR) |

**Install (RPi 5 from source):**
```bash
# Use the official install script
cd /opt
git clone https://github.com/TrunkRecorder/trunk-recorder.git
cd trunk-recorder
# Follow INSTALL-PI.md or run:
sudo bash install.sh

# Or Docker:
# See INSTALL-DOCKER.md
```

---

### Rdio Scanner — Scanner UI for Radio Recordings (Track 4)

| | Link |
|---|---|
| **GitHub** | https://github.com/chuot/rdio-scanner |
| **Wiki** | https://github.com/chuot/rdio-scanner/wiki |
| **Discord** | https://discord.gg/rdio-scanner |
| **Docker Hub** | https://hub.docker.com/r/chuot/rdio-scanner |
| **License** | MIT |
| **Language** | Go (backend) + Angular (frontend) |
| **Version** | v6.6.3 |
| **Stars** | ⭐ 230+ |
| **Releases** | [46 releases](https://github.com/chuot/rdio-scanner/releases) |
| **ARM64 binary** | `rdio-scanner-linux-arm64-v6.6.3.zip` (precompiled, no build needed) |
| **Admin panel** | `http://localhost:3000/admin` |
| **Ingest methods** | API (`/api/call-upload`), dirwatch (filesystem monitor) |

> ⚠️ **IMPORTANT:** Docker image **disables dirwatch** due to filesystem event limitations on mounted volumes. For DSD-FME integration (Track 5), Rdio Scanner **must** run as a **native binary**, not Docker.

**Install (native ARM64 binary on RPi 5):**
```bash
# Download precompiled ARM64 binary
cd /opt
wget https://github.com/chuot/rdio-scanner/releases/download/v6.6.3/rdio-scanner-linux-arm64-v6.6.3.zip
unzip rdio-scanner-linux-arm64-v6.6.3.zip -d rdio-scanner
cd rdio-scanner

# Run
./rdio-scanner
# Access admin: http://localhost:3000/admin
# Access scanner UI: http://localhost:3000

# Configure in admin panel:
# 1. Create system (e.g., "P25 County")
# 2. Upload talkgroups.csv
# 3. Generate API key for Trunk Recorder
# 4. Add dirwatch entry for DSD-FME output directory
```

**Compatible recorders:** Trunk Recorder, RTLSDR-Airband, SDRTrunk, DSD-FME (via dirwatch), DSDPlus Fast Lane, voxcall, ProScan.

---

### DSD-FME — Multi-Protocol Digital Voice Decoder (Track 5)

| | Link |
|---|---|
| **GitHub** | https://github.com/lwvmobile/dsd-fme |
| **License** | ISC / GPL-2.0 |
| **Language** | C |
| **Stars** | ⭐ 291 |
| **Forks** | 60 |
| **Branch** | `audio_work` (recommended) |
| **Protocols** | DMR, P25 Phase 1/2, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF |
| **Per-call WAV patch** | `patch/g_dmr_per_call_wav_file_fixes_w_custom_wav_dir_20240730.patch` |

**Install (build from source on RPi 5):**
```bash
# Dependencies
sudo apt-get install -y build-essential cmake libpulse-dev librtlsdr-dev libncurses-dev

# Clone and apply per-call WAV fix
cd /opt
git clone https://github.com/lwvmobile/dsd-fme
cd dsd-fme
git checkout audio_work
git apply patch/g_dmr_per_call_wav_file_fixes_w_custom_wav_dir_20240730.patch

# Build
mkdir build && cd build
cmake ..
make -j4
sudo make install

# Create recording directory
sudo mkdir -p /var/lib/dsd-fme/recordings
sudo chown $USER:$USER /var/lib/dsd-fme/recordings

# Test: Decode DMR from RTL-SDR device 1
dsd-fme -fs -i rtl:1:438.5M:40 -7 /var/lib/dsd-fme/recordings/ -P -N 2> /var/log/dsd-fme.ans
```

---

## Part A: Device Table Enrichment (Tiers 1-3)

### Current Device Table

```
MAC / SSID | RSSI | TYPE | VENDOR | CH | FREQ | ENC | PKTS | DATA | AGE | LAST
```

11 columns from `DEVICE_FIELDS` in `src/lib/server/kismet/kismet-proxy.ts`. The `dot11.device` blob is already fetched but most of its contents are discarded by the transform layer.

---

### Tier 1: Kismet Deep Extract (Highest Value, Zero Cost)

**Principle:** Extract data Kismet already captures but Argos currently discards.

**New fields from `dot11.device` (already in the API response):**

| Field Path | Intelligence | Display |
|-----------|-------------|---------|
| `dot11.device.probed_ssid_map` | Networks the device has searched for ("HomeNet-5G", "Marriott_WiFi") — reveals device owner, travel history | PROBES column |
| `dot11.device.responded_ssid_map` | Networks the device has associated with | PROBES column (merged) |
| `dot11.device.advertised_ssid_map` | Hidden SSID names being broadcast | INTEL column |
| `dot11.device.last_bssid` | Last AP this client connected to | INTEL column |
| `dot11.device.probe_fingerprint` | 802.11 Information Element hash — fingerprints device generation even with MAC randomization | INTEL column |
| `dot11.device.response_fingerprint` | Same for AP responses | INTEL column |
| `dot11.device.num_retries` / `num_fragments` | Network quality indicators | Expand row |

**New field from `ble.device` (requires adding to DEVICE_FIELDS — 1 line change):**

| Field Path | Intelligence | Display |
|-----------|-------------|---------|
| `ble.device.ble_adv_service_uuids` | BLE service UUIDs → identifies "Heart Rate Monitor", "AirTag", "Tile Tracker" | INTEL column |

**Code changes:**

| File | Change |
|------|--------|
| `src/lib/server/kismet/kismet-proxy.ts` | Add `'ble.device'` to `DEVICE_FIELDS` array |
| `src/lib/server/kismet/kismet-proxy-transform.ts` | Add `extractProbeSSIDs()`, `extractRespondedSSIDs()`, `extractFingerprints()`, `extractBLEServices()` |
| `src/lib/server/kismet/types.ts` + `src/lib/kismet/types.ts` | Add `probeRequests`, `respondedSSIDs`, `bleServiceUUIDs`, `dot11Fingerprint` to `KismetDevice` |
| `src/lib/components/dashboard/panels/devices/DeviceTable.svelte` | Add PROBES and INTEL columns |
| `src/lib/components/dashboard/panels/devices/DeviceSubRows.svelte` | Add probe history and BLE services to expand row |

**Table after Tier 1 (13 columns):**
```
MAC/SSID | RSSI | TYPE | VENDOR | CH | FREQ | ENC | PROBES | INTEL | PKTS | DATA | AGE | LAST
```

**Resource cost:** 0 MB additional RAM (same API call, just parsing more JSON).
**Effort:** ~1-2 days.

---

### Tier 2: NFStream Protocol Tagging (ONNET Only)

**Principle:** Passive protocol identification for devices on networks the Pi is connected to.

**Scope constraint:** NFStream operates at Layer 3+ (requires IP connectivity). It can only tag devices that are ONNET — connected to a network the Pi can see traffic on. OFFNET devices (detected by Kismet via monitor mode only) show `—` in the PROTO column. This is physics, not a limitation.

**Architecture:**
```
nfstream-svc.py (Python, live capture) → Unix socket /tmp/argos-nfstream.sock → nfstream-consumer.ts → IP↔MAC correlation → nfstream-store.ts → KismetDevice enrichment
```

NFStream provides per-flow: `application_name` (e.g. "TLS.Facebook"), `application_category_name` (e.g. "SocialNetwork"), `client_fingerprint` (JA3), `server_fingerprint`, `requested_server_name` (SNI), packet/byte stats, and optionally `system_process_name` + `system_process_pid`.

IP↔MAC correlation uses: (a) `/proc/net/arp` system table, (b) Kismet's own IP association data from `dot11.device`.

**New column: PROTO**

| Device Context | PROTO Display |
|---------------|---------------|
| ONNET, benign | `HTTP` `MQTT` `mDNS` |
| ONNET, suspicious | `⚠ DNS-Tunnel` `SSH` |
| ONNET, unclassified | `?` (nDPI "not-detected" on high-traffic flow) |
| OFFNET | `—` |

**Map indicators:**
- Blue dot: interesting protocols (MQTT, CoAP, IoT)
- Yellow dot: unusual port usage, unclassified high-traffic flows
- Red pulsing dot: DNS tunneling, C2 beaconing patterns

**Alternatives evaluated:**
- nDPId: Same nDPI engine but only 26 GitHub stars, build-from-source only, no ARM64 packages
- Zeek: 500+ MB RAM, overkill for protocol tagging
- ntopng: 1.3 GB RAM, full monitoring suite — too heavy for just protocol labels
- Suricata: IDS not classifier
- p0f: unmaintained

**New files:**

| File | Purpose |
|------|---------|
| `scripts/services/nfstream-svc.py` | Python microservice: live capture → per-flow JSON → Unix socket |
| `src/lib/server/nfstream/nfstream-consumer.ts` | Unix socket client (reads JSON lines from `nfstream-svc.py`) |
| `src/lib/server/nfstream/arp-reader.ts` | IP→MAC from `/proc/net/arp` + Kismet data |
| `src/lib/stores/tactical-map/nfstream-store.ts` | Protocol enrichment store |
| `src/lib/server/mcp/nfstream-tools.ts` | MCP tools: `get_device_protocols`, `get_suspicious_activity` |

**Resource cost:** ~50 MB RAM (Python process + nDPI engine).
**Effort:** ~1 week.

**Table after Tier 1+2 (14 columns):**
```
MAC/SSID | RSSI | TYPE | VENDOR | CH | FREQ | ENC | PROBES | INTEL | PROTO | PKTS | DATA | AGE | LAST
```

---

### Tier 3: Activity Profiling (OFFNET Exploration)

**Principle:** Infer behavioral categories for OFFNET devices from frame metadata — not payload content.

**What's observable from encrypted 802.11 frames:** Frame sizes, timing, inter-arrival patterns, retry/fragment flags, direction, data rate changes. **What's NOT observable:** Specific protocols, specific services, URLs, hostnames.

**Recommended approach — stats-derived classifier:**

Compute rate-of-change from `packets.total` and `dataSize` fields Kismet already provides (polled every 5 seconds). Classify into:

| Label | Criteria | Example |
|-------|----------|---------|
| STREAMING | Sustained high rate, low variance | Video call, music stream |
| BURSTY | Intermittent, high variance | Web browsing, app refreshes |
| PERIODIC | Regular intervals, consistent size | IoT sensor, heartbeat |
| IDLE | <1 pkt/s sustained | Sleeping device |

**Resource cost:** <1 MB RAM (ring buffer of last N samples per device).
**Effort:** Prototype in an afternoon.

**Table after all tiers (15 columns):**
```
MAC/SSID | RSSI | TYPE | VENDOR | CH | FREQ | ENC | PROBES | INTEL | PROTO | ACT | PKTS | DATA | AGE | LAST
```

---

## Part B: Trunked Radio Integration (Tracks 4-5)

### Track 4: Trunk Recorder + Rdio Scanner

**Three components, each with a distinct role:**

| Component | Job | How It Integrates With Argos |
|-----------|-----|------------------------------|
| **Trunk Recorder** | Automated P25 trunked radio recording (headless, unattended) | WebSocket status → Argos sidebar + map markers |
| **Rdio Scanner** | Scanner UI — live audio, talkgroup filtering, call history, replay | iframe embedded in Argos dashboard (port 3000) |
| **talkgroups.csv** | Maps numeric P25 talkgroup IDs to human-readable names | Pre-deployment config from RadioReference.com |

**Data flow:**

```
RTL-SDR dongle (dedicated to P25)
    │
    ▼
Trunk Recorder (C++ / Docker or native)
    │
    ├──── WebSocket status ──► tr-ws-consumer.ts ──► trunked-radio-store.ts ──► sidebar + map
    │     (call_start, call_end,
    │      systems, recorders, rates)
    │
    └──── rdioscanner_uploader plugin
          │
          ▼
    POST /api/call-upload (WAV + JSON metadata)
          │
          ▼
    Rdio Scanner (Go binary, port 3000)
          │
          ▼
    Scanner UI ──► iframe in Argos (RdioScannerView.svelte)
```

**Argos sidebar panel (native, from WebSocket data):**

| Field | Source |
|-------|--------|
| Active call count | `calls_active` messages |
| Talkgroup name, source radio, frequency | `call_start` / `call_end` |
| Emergency flag | `call.emergency` field (red highlight) |
| Encrypted indicator | `call.encrypted` field (lock icon) |
| Decode rate | `rates` messages |

**Argos map integration:**

Active talkgroups appear as markers at the Pi's GPS position (P25 does not provide per-radio geolocation). Emergency calls render as red diamonds (MIL-STD-2525C hostile affiliation). Regular calls render as yellow rectangles (unknown affiliation). Multiple active talkgroups fan out to avoid stacking.

**Rdio Scanner iframe (RdioScannerView.svelte):**

Follows the exact pattern of `src/lib/components/dashboard/views/KismetView.svelte` and `src/lib/components/dashboard/views/OpenWebRXView.svelte`:
- ToolViewWrapper provides back button and title bar
- iframe points to `http://{hostname}:3000`
- Operator clicks "Trunk Recorder" in tool hierarchy → Rdio Scanner view opens
- Clicking "Back" returns to map — scanner continues recording in background

**Trunk Recorder config.json (key sections):**

```json
{
  "ver": 2,
  "sources": [{
    "center": 460000000,
    "rate": 2048000,
    "driver": "osmosdr",
    "device": "rtl=0",
    "gain": 40
  }],
  "systems": [{
    "shortName": "CNTY",
    "type": "p25",
    "control_channels": [460012500, 460037500],
    "talkgroupsFile": "talkgroups.csv"
  }],
  "statusServer": "ws://0.0.0.0:3005",
  "plugins": [{
    "name": "rdioscanner_uploader",
    "library": "librdioscanner_uploader.so",
    "server": "http://127.0.0.1:3000",
    "apiKey": "YOUR_RDIO_SCANNER_API_KEY",
    "systemId": 1
  }]
}
```

**New Argos files for Track 4:**

| File | Purpose |
|------|---------|
| `src/lib/components/dashboard/views/RdioScannerView.svelte` | iframe embedding (same pattern as KismetView) |
| `src/lib/server/trunk-recorder/tr-ws-consumer.ts` | WebSocket client connecting to TR status server |
| `src/lib/stores/tactical-map/trunked-radio-store.ts` | Active calls, recent calls, system health store |
| `src/lib/server/mcp/trunked-radio-tools.ts` | MCP tools: `get_trunked_radio_status`, `get_call_history` |

**Modified Argos files:**

| File | Change |
|------|--------|
| `src/lib/stores/dashboard/dashboard-store.ts` | Add `'rdio-scanner'` to `ActiveView` union (line 58) |
| `src/lib/data/offnet-recon-signals.ts` | Set `trunk-recorder` to `isInstalled: true`, `viewName: 'rdio-scanner'`, `canOpen: true`, `deployment: 'native'` |
| `src/routes/dashboard/+page.svelte` | Add `RdioScannerView` to view router |
| `src/lib/map/symbols/symbol-factory.ts` | Add `p25_talkgroup` and `p25_emergency` SIDC mappings |
| `.env.example` | Add `TR_WS_URL`, `RDIO_SCANNER_URL`, `RDIO_SCANNER_API_KEY` |

**Device locking (requires [SoapySDR DeviceLockService](../Argos_tools_integration/offnet/utilities/sdr-infrastructure/soapysdr.md#device-arbitration-devicelockservice)):**

Trunk Recorder and Rdio Scanner must acquire device locks before claiming SDR hardware. The TR entrypoint script should POST to `/api/hardware/devices/[id]/lock` on startup and DELETE on shutdown.

**Failure policy:** If Argos is unreachable when TR starts, TR should log a warning and proceed (graceful degradation). The `DeviceLockService` will auto-detect device conflicts on the next `SoapySDRUtil --find` scan.

**Deployment:**

Trunk Recorder: **native** install with systemd service, start/stop per operation (~500 MB RAM, ties up RTL-SDR).
Rdio Scanner: native ARM64 binary, systemd service, always-on or paired with TR (~75 MB RAM).

---

### Track 5: DSD-FME Multi-Protocol Decode

**What DSD-FME adds that Trunk Recorder cannot do:**

Trunk Recorder only speaks P25 (and SmartNet). DSD-FME decodes **11 digital voice protocols**: DMR, P25 Phase 1/2, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF. When the HackRF spectrum view shows unknown digital signals on non-P25 frequencies, DSD-FME is the tool that identifies and decodes them.

**Why DSD-FME over DSD-Neo:**

DSD-Neo is a fork of DSD-FME that refactors it into clean modular libraries. Better code architecture, but:
- 40 stars / 3 watchers / 3 contributors vs DSD-FME's 291 stars / 39 watchers / 60 forks
- No stable release (downloads page says "TBD")
- README warns "Expect breaking changes" and "main branch may be volatile"
- No community-documented Rdio Scanner integration
- No field deployment reports

DSD-FME has: proven Rdio Scanner dirwatch pipeline, active developer who debugs real-world trunking issues on RadioReference forums, 1,497 commits of battle-tested code, documented DMR/NXDN/EDACS trunking against real systems. DSD-Neo is worth watching for future adoption once it stabilizes.

**Integration with Rdio Scanner — dirwatch pipeline:**

```
RTL-SDR dongle #2 (or HackRF audio pipe)
    │
    ▼
DSD-FME (C binary, native install)
    │   CLI: dsd-fme -fs -i rtl:1:438.5M:40 -7 /var/lib/dsd-fme/recordings/ -P -N 2> log.ans
    │
    └──── Per-call WAV files ──► /var/lib/dsd-fme/recordings/
                                      │
                                      ▼
                               Rdio Scanner dirwatch
                               (monitors directory, ingests WAV files)
                                      │
                                      ▼
                               Scanner UI (same iframe, same interface)
                               P25 calls from TR + DMR/NXDN/etc from DSD-FME
                               all appear in one unified scanner
```

**Rdio Scanner dirwatch configuration:**

In the Rdio Scanner admin panel (`http://pi-address:3000/admin`):
1. Create a new dirwatch entry
2. Directory: `/var/lib/dsd-fme/recordings/`
3. Extension: `wav`
4. Delay: 2000ms (wait for WAV file to be fully written before ingest)
5. Delete After: enabled

**Known integration issues:**

| Issue | Status | Mitigation |
|-------|--------|-----------|
| WAV ingested before call completes | Resolved | Community patch renames file on completion |
| No talkgroup in DSD-FME filename for some protocols | Known | Rdio Scanner auto-creates talkgroup entries |
| Per-call recording requires ncurses mode | By design | Run with `-P -N 2> log.ans` for headless |

**DSD-FME trunking capabilities (independent of Trunk Recorder):**

| Protocol | Trunking Support | Config Required |
|----------|-----------------|-----------------|
| DMR Capacity Plus | Yes | Channel map CSV |
| DMR Connect Plus | Yes | Channel map CSV |
| NXDN Type-C/D | Yes | Channel map CSV |
| EDACS | Yes | Channel map CSV + RIGCTL/RTL |
| P25 | Yes (but Trunk Recorder is better) | Control channel freq |

**Argos integration for DSD-FME:**

DSD-FME doesn't need its own Argos view component. Its audio flows into Rdio Scanner, which is already embedded. The only Argos-side changes are:

| File | Change |
|------|--------|
| `src/lib/data/offnet-recon-signals.ts` | Rename `dsd-neo` (line 195) to `dsd-fme`, set `isInstalled: true`, `deployment: 'native'` |
| Tool hierarchy UI | Show DSD-FME status (running/stopped, current frequency, protocol detected) |

**Device locking (requires [SoapySDR DeviceLockService](../Argos_tools_integration/offnet/utilities/sdr-infrastructure/soapysdr.md#device-arbitration-devicelockservice)):**

DSD-FME's wrapper script should POST to `/api/hardware/devices/[id]/lock` on startup (e.g., locking `rtlsdr-1`) and DELETE on shutdown. Same failure policy as Track 4: log warning and proceed if Argos is unreachable.

**Resource cost:** ~50-100 MB RAM, ~5-10% CPU single-channel decode.

---

## Part C: Combined Architecture

### Full Stack When All Tracks Active

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARGOS (SvelteKit)                              │
│                                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────────────┐ │
│  │ NFStream     │  │ Trunk Recorder   │  │ Rdio Scanner iframe            │ │
│  │ Consumer     │  │ WS Consumer      │  │ (Trunk Recorder P25 calls      │ │
│  │ (Unix sock)  │  │ (WS :3005)       │  │  + DSD-FME DMR/NXDN/etc calls │ │
│  └──────┬───────┘  └────────┬─────────┘  │  unified in one scanner UI)    │ │
│         │                   │            └────────────────────────────────┘ │
│         ▼                   ▼                                               │
│  ┌──────────────┐  ┌──────────────────┐                                     │
│  │ nfstream     │  │ trunked-radio    │                                     │
│  │ -store       │  │ -store           │                                     │
│  └──────┬───────┘  └────────┬─────────┘                                     │
│         │                   │                                               │
│         ▼                   ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Device Table (15 columns) + Map (protocol dots + talkgroup markers)    │ │
│  │ MCP Agent (cross-tool queries: protocols + calls + devices)            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

External processes:
  Kismet ──(REST API)──────────────────────────────────────► Argos (always-on)
  nfstream-svc.py ──(Unix socket)──────────────────────────► Argos (always-on)
  Trunk Recorder ──(WebSocket :3005)───────────────────────► Argos (during radio ops)
  Trunk Recorder ──(POST /api/call-upload)─────────────────► Rdio Scanner
  DSD-FME ──(per-call WAV files → directory)───────────────► Rdio Scanner (dirwatch)
  Rdio Scanner ──(iframe :3000)────────────────────────────► Argos dashboard
```

### Resource Budget

| Component | RAM | When Active | Port |
|-----------|-----|-------------|------|
| Argos (SvelteKit) | ~300 MB | Always | 5173 |
| Kismet | ~500 MB | Always | 2501 |
| OS + services | ~1,500 MB | Always | — |
| NFStream (nfstream-svc.py) | ~50 MB | Always-on | Unix socket |
| Trunk Recorder | ~500 MB | During radio ops | 3005 (WS) |
| Rdio Scanner | ~75 MB | With TR / DSD-FME | 3000 |
| DSD-FME | ~50-100 MB | Interactive decode | — |
| Activity Profiler (Tier 3) | <1 MB | Always-on | — |

**Always-on baseline:** ~2.35 GB → **5.65 GB headroom**
**Full trunked radio ops (TR + Rdio + DSD-FME):** ~2.98 GB → **5.02 GB headroom**

Memory is not a constraint for any track.

### Hardware Requirements

| SDR Device | Used By | Notes |
|-----------|---------|-------|
| HackRF One | Spectrum analysis, OpenWebRX | Wideband (1 MHz–6 GHz) |
| Internal WiFi + BT | Kismet | Monitor mode |
| RTL-SDR #1 | Trunk Recorder | Dedicated to P25 control channel |
| RTL-SDR #2 | DSD-FME | DMR/NXDN/EDACS decode (or pipe from HackRF) |
| NFStream | No hardware | Monitors eth0/wlan0 traffic |

---

## Part D: Implementation Sequence

### Phase 1: Tier 1 — Kismet Deep Extract (do first)

Highest value, lowest effort. Probe requests alone transform anonymous clients into identifiable devices. Zero additional RAM, zero new services — just extract data from JSON already being fetched.

### Phase 2: Track 4 — Trunk Recorder + Rdio Scanner (parallel workstream)

Independent of Tier 1. Establishes the trunked radio pipeline and the Rdio Scanner iframe. Once Rdio Scanner is running and embedded in Argos, Track 5 plugs in trivially.

### Phase 3: Track 5 — DSD-FME (after Rdio Scanner is stable)

Depends on Rdio Scanner being deployed and working (from Phase 2).

### Phase 4: Tier 2 — NFStream Protocol Tagging (independent)

Can run in parallel with Phases 2-3. No dependencies on trunked radio stack. `pip install nfstream` — no build step.

### Phase 5: Tier 3 — Activity Profiling (exploration)

Start with stats-derived approach after Tiers 1+2 are stable. Prototype in an afternoon.

---

## Part E: New and Modified Files Summary

### New Files

| File | Track | Purpose |
|------|-------|---------|
| `src/lib/components/dashboard/views/RdioScannerView.svelte` | 4 | Rdio Scanner iframe embedding |
| `src/lib/server/trunk-recorder/tr-ws-consumer.ts` | 4 | WebSocket client for TR status server |
| `src/lib/stores/tactical-map/trunked-radio-store.ts` | 4 | Active calls, recent calls, system health |
| `src/lib/server/mcp/trunked-radio-tools.ts` | 4 | MCP tools: `get_trunked_radio_status`, `get_call_history` |
| `scripts/services/nfstream-svc.py` | 2 | Python microservice: live capture → per-flow JSON → Unix socket |
| `src/lib/server/nfstream/nfstream-consumer.ts` | 2 | Unix socket client (reads JSON lines from nfstream-svc.py) |
| `src/lib/server/nfstream/arp-reader.ts` | 2 | IP→MAC correlation |
| `src/lib/stores/tactical-map/nfstream-store.ts` | 2 | Protocol enrichment store |
| `src/lib/server/mcp/nfstream-tools.ts` | 2 | MCP tools: `get_device_protocols`, `get_suspicious_activity` |
| `src/lib/server/activity/activity-profiler.ts` | 3 | Rate-of-change classifier |

### Modified Files

| File | Track | Change |
|------|-------|--------|
| `src/lib/server/kismet/kismet-proxy.ts` | 1 | Add `'ble.device'` to DEVICE_FIELDS |
| `src/lib/server/kismet/kismet-proxy-transform.ts` | 1 | New extraction functions for probes, fingerprints, BLE |
| `src/lib/server/kismet/types.ts` + `src/lib/kismet/types.ts` | 1,2,3 | Extend KismetDevice with all new fields |
| `src/lib/components/dashboard/panels/devices/DeviceTable.svelte` | 1,2,3 | Add PROBES, INTEL, PROTO, ACT columns |
| `src/lib/components/dashboard/panels/devices/DeviceSubRows.svelte` | 1,2 | Probe history, BLE services, protocol detail sections |
| `src/lib/stores/dashboard/dashboard-store.ts` | 4 | Add `'rdio-scanner'` to `ActiveView` union (line 58) |
| `src/lib/data/offnet-recon-signals.ts` | 4,5 | Mark trunk-recorder installed + `deployment: 'native'`; rename `dsd-neo` → `dsd-fme` + `deployment: 'native'` |
| `src/routes/dashboard/+page.svelte` | 4 | Add RdioScannerView to view router |
| `src/lib/map/symbols/symbol-factory.ts` | 4 | Add p25_talkgroup and p25_emergency SIDC mappings |
| `src/lib/server/mcp/dynamic-server-tools.ts` | 2,4 | Register NFStream and TR MCP tools |
| `.env.example` | 2,4 | Add NFSTREAM_*, TR_WS_URL, RDIO_SCANNER_* variables |

---

## Confirmed Decisions

1. **DSD-FME** (not DSD-Neo) for multi-protocol digital voice decode — battle-tested, community-supported, proven Rdio Scanner integration
2. **Rdio Scanner native binary** (not Docker) — dirwatch requires native filesystem events
3. **dirwatch** (not API upload) for DSD-FME → Rdio Scanner — no middleware needed, WAV files in a directory
4. **rdioscanner_uploader plugin** for Trunk Recorder → Rdio Scanner — native integration, zero custom code
5. **Tier 1 first** — highest ROI, zero cost, transforms device table immediately
6. **Per-call WAV patch** applied to DSD-FME at build time — prevents partial file ingest
7. **Two RTL-SDRs** for full radio ops (one for TR/P25, one for DSD-FME/other protocols)
8. **Rename `dsd-neo` → `dsd-fme`** in `src/lib/data/offnet-recon-signals.ts` (line 195)
9. **NFStream** (not nDPId) for protocol tagging — 1,200+ stars, pip install, same nDPI engine, ARM64 wheels, 100+ research citations
10. **Trunk Recorder native install** (not Docker) — systemd-managed, matches Rdio Scanner deployment model
11. **Device locking via `DeviceLockService`** for Tracks 4 and 5 — TR and DSD-FME wrapper scripts POST/DELETE to `/api/hardware/devices/[id]/lock` (see [SoapySDR plan](../Argos_tools_integration/offnet/utilities/sdr-infrastructure/soapysdr.md))
12. **Graceful degradation lock policy** — if Argos is unreachable, external tools log a warning and proceed; `DeviceLockService` auto-detects conflicts on next scan
13. **NFStream env vars formalized** — `NFSTREAM_ENABLED`, `NFSTREAM_SOCKET_PATH`, `NFSTREAM_INTERFACE`, `NFSTREAM_IDLE_TIMEOUT`, `NFSTREAM_ACTIVE_TIMEOUT`
