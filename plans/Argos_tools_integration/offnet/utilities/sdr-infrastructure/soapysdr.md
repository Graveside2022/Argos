# SoapySDR — SDR Device Management & Arbitration

> **RISK CLASSIFICATION**: LOW RISK
> Passive device management layer. SoapySDR enumerates and probes SDR hardware — it does not transmit, receive, or process signals. Driver modules are loaded at runtime. Military education/training toolkit - Not for public release.

> **See also:** [Argos Intelligence Roadmap v2](../../../../argos-intelligence-roadmap-v2.md) — Tracks 4 (Trunk Recorder) and 5 (DSD-FME) depend on the `DeviceLockService` defined here for SDR hardware arbitration.

---

## Overview

SoapySDR is a **device manager** for SDR hardware. It provides a single command (`SoapySDRUtil --find`) that discovers every connected SDR regardless of brand. Each SDR brand still requires its own native driver. SoapySDR sits on top of those drivers and gives Argos a unified view.

```
Native drivers (installed separately per SDR):
  HackRF   → libhackrf           (already installed)
  RTL-SDR  → librtlsdr           (already installed)
  B205mini → libuhd              (apt install uhd-host)
  BladeRF  → libbladeRF          (apt install libbladerf-dev)
  PlutoSDR → libiio + libad9361  (apt install libiio-dev)
  LimeSDR  → LimeSuite           (apt install limesuite)

SoapySDR modules (thin wrappers that let SoapySDR see each device):
  SoapyHackRF, SoapyRTLSDR, SoapyUHD, SoapyBladeRF, etc.
```

**SoapySDR does NOT replace drivers.** It is the unified enumeration and status layer that feeds the Argos UI.

---

## Two UX Flows

### Flow 1: SDR Configuration Page

> **Location:** Settings → Hardware → SDR Configuration

This is the **admin/management** page. It shows all connected SDRs and lets the operator manage them.

```
┌──────────────────────────────────────────────────────────────────┐
│  SDR Configuration                                    [Scan]    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ● SDR-1: Node 1 HackRF                          [Rename]  │  │
│  │   Make: Great Scott Gadgets    Model: HackRF One           │  │
│  │   Serial: 00000054c4           Range: 1 MHz – 6 GHz       │  │
│  │   Firmware: 2024.02.1          Driver: libhackrf 2024.02  │  │
│  │   Status: ✅ Connected          Used by: None              │  │
│  │                                                            │  │
│  │   Update available (accent)    [Update Firmware]           │  │
│  │   📄 Docs  📦 GitHub  💾 Firmware                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ● SDR-2: RTL Dongle                              [Rename]  │  │
│  │   Make: Realtek               Model: RTL2832U + R820T2    │  │
│  │   Serial: 00000001            Range: 24 MHz – 1.766 GHz   │  │
│  │   Firmware: N/A (no updatable firmware)                    │  │
│  │   Status: ✅ Connected          Used by: Trunk Recorder    │  │
│  │                                                            │  │
│  │   📄 Docs  📦 GitHub                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ SDR-3: B205 Mini                               [Rename]  │  │
│  │   Make: Ettus Research        Model: USRP B205mini-i      │  │
│  │   Serial: 3179BF2             Range: 70 MHz – 6 GHz       │  │
│  │   Firmware: UHD 4.6.0         Driver: libuhd 4.6.0        │  │
│  │   Status: ⚠️ Firmware mismatch — images need update        │  │
│  │                                                            │  │
│  │   Update available (accent)    [Update Firmware]           │  │
│  │   📄 Docs  📦 GitHub  💾 Firmware                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ○ No additional devices found. Plug in an SDR and click Scan.  │
└──────────────────────────────────────────────────────────────────┘
```

**What this page does:**

| Feature | Source | Notes |
|---|---|---|
| Auto-detect make/model/serial | `SoapySDRUtil --find` + `--probe` | SoapySDR returns this automatically |
| Editable device names | SQLite persistence (`sdr_devices` table) | User can rename any device (keyed by serial) |
| Firmware version | Device-specific CLI (`hackrf_info`, `uhd_find_devices`, etc.) | Real metrics from the device |
| Driver version | Package manager / `SoapySDRUtil --info` | Shows installed module version |
| "Update available" indicator | Compare installed vs latest release on GitHub API | Accent-colored text, low cognitive complexity |
| "Update Firmware" button | Device-specific (`hackrf_spiflash`, `uhd_images_downloader`) | Only shown where one-click update is possible |
| Documentation/GitHub/Firmware links | Static per-device-type config | Direct links to vendor resources |
| Connection health | `SoapySDRUtil --check` + USB device presence | Real hardware status |
| "Used by" indicator | `DeviceLockService.getStatus()` | Shows which tool currently holds the device |

**Not all SDRs support one-click firmware updates.** Where it's too complex (build from source), the button is omitted and only the firmware download link and documentation link are shown.

---

### Flow 2: Tool Launch Configuration

> **Location:** Zap icon → Tools → e.g. GSM Evil → Start → **Configuration panel loads in map area**

When the user clicks **Start** on any tool that uses an SDR, the map area is replaced with a configuration panel. The tool does NOT start immediately.

```
┌──────────────────────────────────────────────────────────────────┐
│  GSM Evil — Launch Configuration                                 │
│                                                                  │
│  Select SDR Device:                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ◉ SDR-1: Node 1 HackRF                                    │  │
│  │   HackRF One • 1 MHz – 6 GHz • ✅ Available                │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ SDR-2: RTL Dongle                                        │  │
│  │   RTL2832U • 24 MHz – 1.766 GHz • 🔒 In use: Trunk Rec.   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ○ SDR-3: B205 Mini                                         │  │
│  │   USRP B205mini • 70 MHz – 6 GHz • ⚠️ Firmware mismatch   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Only showing SDRs compatible with GSM Evil.                     │
│                                                                  │
│                              [Cancel]        [Launch GSM Evil]   │
└──────────────────────────────────────────────────────────────────┘
```

**What this panel does:**

| Feature | Details |
|---|---|
| Shows only **compatible** SDRs | Filtered by tool requirements (freq range, duplex, etc.) |
| Grays out / locks SDRs in use | `DeviceLockService` status — can't select an occupied device |
| Shows health warnings | Firmware mismatch, disconnected, etc. |
| User selects SDR and clicks Launch | `DeviceLockService.acquire()` → tool starts with that device |
| Remembers last selection | SQLite — next time GSM Evil starts, pre-selects the same SDR |

---

## Device Arbitration (DeviceLockService)

Simple lock-based system to prevent two tools from claiming the same hardware device simultaneously. In-memory map with lock file persistence for crash recovery.

### Service Design

**New file:** `src/lib/server/services/device-lock/device-lock-service.ts`

```typescript
// Singleton via globalThis (same pattern as SweepManager in
// src/lib/server/hackrf/sweep-manager.ts)
interface DeviceLock {
  deviceId: string;    // e.g. "hackrf-0", "rtlsdr-0", "wlan0"
  tool: string;        // e.g. "GSM Evil", "Spectrum Analyzer"
  pid?: number;        // Process ID if a child process
  since: number;       // Date.now() timestamp
}

class DeviceLockService {
  private locks = new Map<string, DeviceLock>();

  acquire(deviceId, tool, pid?): { ok: true } | { ok: false; heldBy: string }
  release(deviceId, tool): void
  releaseAll(tool): void         // Cleanup when a tool crashes
  isAvailable(deviceId): boolean
  getStatus(): DeviceLock[]      // For both UI flows

  // Enumeration (calls SoapySDRUtil via execFileAsync for SDRs, and parses /sys/class/net/ for Wi-Fi interfaces)
  enumerate(): Promise<SdrDevice[]>      // --find + native Linux network interfaces
  probe(deviceId): Promise<SdrCaps>      // --probe
}
```

### Integration Points

| Existing Service | File | Lock Action |
|---|---|---|
| **SweepManager** | `src/lib/server/hackrf/sweep-manager.ts` | acquire before `hackrf_sweep` spawn, release on stop |
| **GsmEvilService** | `src/lib/server/services/gsm-evil/` | acquire before `grgsm_livemon` spawn, release on stop |
| **KismetService** | `src/lib/server/services/kismet/kismet-control-service.ts` | acquire Wi-Fi interface (e.g. `wlan1`) on start, release on stop |
| **OpenWebRX** | Docker via `docker/docker-compose.portainer-dev.yml` | Argos acquires lock before starting container, releases on stop (see [OpenWebRX Docker Lock Mechanism](#openwebrx-docker-lock-mechanism)) |
| **Trunk Recorder**| Native binary, systemd service | POST to `/api/hardware/devices/[id]/lock` on startup via entrypoint script (see [Failure Policy](#failure-policy-for-external-tools)) |
| **DSD-FME** | Native binary wrapper | POST to `/api/hardware/devices/[id]/lock` on startup via wrapper script (see [Failure Policy](#failure-policy-for-external-tools)) |

### Lock Files (Crash Recovery)

Each `acquire()` writes `/tmp/argos-device-{deviceId}.lock`. On startup, dead PIDs are cleaned up automatically.

### Failure Policy for External Tools

External tools (Trunk Recorder, DSD-FME, OpenWebRX) should attempt to acquire locks via the Argos API, but **must not fail to start** if Argos is unreachable. The policy is:

| Scenario | Behavior |
|----------|----------|
| Argos reachable, device available | Acquire lock, proceed normally |
| Argos reachable, device locked | Fail to start — display which tool holds the device |
| Argos unreachable (network, not running) | **Log warning and proceed** (graceful degradation) |
| Lock acquired, Argos restarts mid-operation | Lock file in `/tmp/` persists; `DeviceLockService` re-reads on startup |
| Tool crashes without releasing lock | Dead PID cleanup on next `DeviceLockService` init |

The `DeviceLockService` auto-detects device conflicts on the next `SoapySDRUtil --find` scan, even if a tool started without acquiring a lock.

### OpenWebRX Docker Lock Mechanism

OpenWebRX runs in Docker and cannot directly call the Argos API from inside the container. Lock acquisition is handled by **Argos managing the container lifecycle**:

1. User clicks "Start OpenWebRX" in Argos UI
2. Argos calls `DeviceLockService.acquire()` for the selected SDR
3. If successful, Argos starts the Docker container via the Docker API / `docker compose`
4. On "Stop OpenWebRX", Argos stops the container and calls `DeviceLockService.release()`

This keeps the lock logic server-side and avoids requiring the container to know about Argos internals.

### API Endpoints

Extends existing `/api/hardware/*` (3 routes at `src/routes/api/hardware/`):

| Route | Method | Purpose |
|---|---|---|
| `/api/hardware/devices` | GET | **MODIFY** — SoapySDR enumeration + lock status + device names |
| `/api/hardware/devices/[id]/lock` | POST | **NEW** — Acquire lock |
| `/api/hardware/devices/[id]/lock` | DELETE | **NEW** — Release lock |
| `/api/hardware/devices/[id]/name` | PUT | **NEW** — Rename device |
| `/api/hardware/devices/[id]/firmware` | GET | **NEW** — Check firmware version + update availability |
| `/api/hardware/devices/[id]/firmware` | POST | **NEW** — Trigger firmware update (where supported) |

### Firmware Update Security Controls

> [!CAUTION]
> Firmware flashing (`hackrf_spiflash`, `uhd_images_downloader`) is a privileged, irreversible operation. The following safeguards apply:

| Control | Implementation |
|---------|---------------|
| **Rate limiting** | Hardware-tier rate limit (30 req/min, existing) applies to firmware endpoints |
| **UI confirmation** | Frontend must show a confirmation dialog before POST — "Flash firmware to {device}? This cannot be undone." |
| **Localhost-only restriction** | Firmware POST endpoint returns `403 Forbidden` for non-localhost requests (Tailscale, remote) |
| **Audit logging** | All firmware operations logged with timestamp, device serial, user, and result |
| **No rollback** | Firmware flashing is one-way for most SDRs. The UI must clearly state this. If the flash fails mid-operation, the device may become unresponsive — operator must use vendor recovery procedures. |

---

## Repository & Documentation

### Core Library

| | Link |
|---|---|
| **GitHub** | https://github.com/pothosware/SoapySDR |
| **Wiki** | https://github.com/pothosware/SoapySDR/wiki |
| **API Docs** | https://pothosware.github.io/SoapySDR/doxygen/latest/index.html |
| **License** | Boost Software License 1.0 (permissive) |

### Hardware Driver Modules

| Module | GitHub | Wiki | Hardware | Install |
|---|---|---|---|---|
| **SoapyHackRF** | [repo](https://github.com/pothosware/SoapyHackRF) | [wiki](https://github.com/pothosware/SoapyHackRF/wiki) | HackRF One | `apt install soapysdr-module-hackrf` |
| **SoapyRTLSDR** | [repo](https://github.com/pothosware/SoapyRTLSDR) | [wiki](https://github.com/pothosware/SoapyRTLSDR/wiki) | RTL-SDR v3 | `apt install soapysdr-module-rtlsdr` |
| **SoapyUHD** | [repo](https://github.com/pothosware/SoapyUHD) | [wiki](https://github.com/pothosware/SoapyUHD/wiki) | Ettus B205mini/B210 | `apt install soapysdr-module-uhd` |
| **SoapyBladeRF** | [repo](https://github.com/pothosware/SoapyBladeRF) | [wiki](https://github.com/pothosware/SoapyBladeRF/wiki) | BladeRF x40/xA4 | `apt install soapysdr-module-bladerf` |
| **SoapyAirspy** | [repo](https://github.com/pothosware/SoapyAirspy) | [wiki](https://github.com/pothosware/SoapyAirspy/wiki) | Airspy R2/Mini | `apt install soapysdr-module-airspy` |
| **SoapyAirspyHF** | [repo](https://github.com/pothosware/SoapyAirspyHF) | [wiki](https://github.com/pothosware/SoapyAirspyHF/wiki) | Airspy HF+ | `apt install soapysdr-module-airspyhf` |
| **SoapySDRPlay3** | [repo](https://github.com/pothosware/SoapySDRPlay3) | [wiki](https://github.com/pothosware/SoapySDRPlay3/wiki) | SDRplay RSP1A/dx | `apt install soapysdr-module-sdrplay3` |
| **SoapyPlutoSDR** | [repo](https://github.com/pothosware/SoapyPlutoSDR) | [wiki](https://github.com/pothosware/SoapyPlutoSDR/wiki) | ADALM-Pluto | Build from source |
| **SoapyOsmo** | [repo](https://github.com/pothosware/SoapyOsmo) | [wiki](https://github.com/pothosware/SoapyOsmo/wiki) | gr-osmosdr bridge | `apt install soapysdr-module-osmosdr` |

### Firmware Resources Per Device

| SDR | Firmware Check CLI | Update CLI | Firmware Link |
|---|---|---|---|
| HackRF One | `hackrf_info` | `hackrf_spiflash` | [github.com/greatscottgadgets/hackrf/releases](https://github.com/greatscottgadgets/hackrf/releases) |
| RTL-SDR | N/A (no updatable firmware) | N/A | — |
| B205mini | `uhd_find_devices --args="type=b200"` | `uhd_images_downloader` | [files.ettus.com/manual/page_images.html](https://files.ettus.com/manual/page_images.html) |
| BladeRF | `bladeRF-cli -e version` | `bladeRF-cli -f <image>` | [github.com/Nuand/bladeRF/releases](https://github.com/Nuand/bladeRF/releases) |
| LimeSDR | `LimeUtil --find` | `LimeUtil --update` | [github.com/myriadrf/LimeSuite/releases](https://github.com/myriadrf/LimeSuite/releases) |
| PlutoSDR | `iio_info -s` | Manual (build from source) | [github.com/analogdevicesinc/plutosdr-fw/releases](https://github.com/analogdevicesinc/plutosdr-fw/releases) |
| Airspy | `airspy_info` | Manual | [airspy.com/download](https://airspy.com/download/) |
| SDRplay | `sdrplay_apiService` | Manual (vendor installer) | [sdrplay.com/downloads](https://www.sdrplay.com/downloads/) |

---

## Install Instructions (Kali RPi 5)

### Step 1: Core + Current Hardware

```bash
sudo apt-get update && sudo apt-get install -y \
  soapysdr-tools \
  libsoapysdr-dev \
  soapysdr-module-hackrf \
  soapysdr-module-rtlsdr

# Verify
SoapySDRUtil --info
SoapySDRUtil --find
```

### Step 2: Additional SDRs (as you acquire hardware)

```bash
sudo apt install -y soapysdr-module-uhd       # B205mini
sudo apt install -y soapysdr-module-bladerf    # BladeRF
sudo apt install -y soapysdr-module-airspy     # Airspy
sudo apt install -y soapysdr-module-airspyhf   # Airspy HF+
sudo apt install -y soapysdr-module-sdrplay3   # SDRplay
sudo apt install -y soapysdr-module-osmosdr    # gr-osmosdr bridge

# SoapySDR auto-discovers new modules — no restart needed
SoapySDRUtil --info  # Verify new module loaded
```

### Key Commands

| Command | Purpose |
|---|---|
| `SoapySDRUtil --info` | List version + all installed modules |
| `SoapySDRUtil --find` | Enumerate all connected SDRs |
| `SoapySDRUtil --probe="driver=hackrf"` | Device capabilities |
| `SoapySDRUtil --check="driver=hackrf"` | Self-test device |

> [!NOTE]
> `SoapySDRUtil --check` may not be available in all SoapySDR versions. Verify with `SoapySDRUtil --help` on the target system. If unavailable, use `--probe` with a 5-second timeout as the health check fallback: if `--probe` returns valid JSON within the timeout, the device is healthy.

---

## Tool-SDR Compatibility Matrix

Not every tool works with every SDR. This matrix determines which SDRs appear in the Tool Launch Configuration panel:

| Tool | HackRF | RTL-SDR | B205mini | BladeRF | PlutoSDR | Airspy | Notes |
|---|---|---|---|---|---|---|---|
| **Spectrum Analyzer** (`hackrf_sweep`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | HackRF-only binary |
| **GSM Evil** (`grgsm_livemon`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Via gr-osmosdr/SoapySDR |
| **OpenWebRX** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Already uses SoapySDR |
| **Trunk Recorder** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | RTL-SDR primary |
| **DSD-FME** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | Multi-protocol digital voice decode |
| **ADS-B** (`dump1090`) | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | RTL-SDR/Airspy |
| **AIS** (`aisdecoder`) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | RTL-SDR only |

This matrix is used to filter the SDR dropdown in the Tool Launch Configuration panel.

---

## Implementation File Summary

| File | Action | Lines (est.) |
|---|---|---|
| `src/lib/server/services/device-lock/device-lock-service.ts` | **NEW** | ~120 |
| `src/lib/server/services/device-lock/device-lock-types.ts` | **NEW** | ~25 |
| `src/lib/server/services/device-lock/sdr-compatibility.ts` | **NEW** — tool-SDR compatibility matrix | ~30 |
| `src/lib/server/hackrf/sweep-manager.ts` | **MODIFY** — add acquire/release | ~+10 |
| `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts` | **MODIFY** — add acquire/release | ~+10 |
| `src/lib/server/services/kismet/kismet-control-service.ts` | **MODIFY** — add acquire/release | ~+10 |
| `src/routes/api/hardware/devices/+server.ts` | **MODIFY** — SoapySDR + locks + names | ~+20 |
| `src/routes/api/hardware/devices/[id]/lock/+server.ts` | **NEW** — POST/DELETE lock | ~40 |
| `src/routes/api/hardware/devices/[id]/name/+server.ts` | **NEW** — PUT rename | ~20 |
| `src/routes/api/hardware/devices/[id]/firmware/+server.ts` | **NEW** — GET check / POST update | ~50 |
| SQLite migration: `sdr_devices` table | **NEW** — serial, name, last_tool columns | ~15 |

**Total: ~250 lines new code, ~50 lines modified, 1 migration.**

Uses existing patterns: `globalThis` singleton, `execFileAsync()` from `src/lib/server/exec.ts`, `safe()` from `src/lib/server/result.ts`, Zod validation.

---

## RPi 5 Compatibility

- **ARM64 NATIVE** — all packages available as `.deb` in Kali repos
- **RAM**: < 5MB for SoapySDR + modules
- **CPU**: Negligible — thin enumeration layer
- **Verdict**: **COMPATIBLE**
