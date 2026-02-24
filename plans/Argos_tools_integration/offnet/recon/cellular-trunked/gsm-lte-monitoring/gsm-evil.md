# GSM Evil

> **✅ ALREADY INTEGRATED IN ARGOS** — Custom Argos module wrapping `grgsm_livemon` + GsmEvil2 Python scripts. Argos integration: 14 server files in `src/lib/server/services/gsm-evil/`, 12 API routes at `/api/gsm-evil/*`, 6 UI components in `src/lib/components/gsm-evil/`, dedicated `gsm-evil-store.ts` (321 lines), SSE streaming via `intelligent-scan-stream`, iframe isolation on dashboard. Env var: `GSMEVIL_DIR`. **No additional integration work required.**
>
> **Future tool interactions:** `gr-gsm` (already integrated — provides `grgsm_livemon` binary this module wraps), `kalibrate-hackrf` (GSM frequency calibration — shares SDR hardware, run sequentially), `srsRAN` (complementary LTE monitoring), `IMSI-catcher` (overlapping capability — GSM Evil already captures IMSIs).

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> GSM signal monitoring and IMSI detection module. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** | Recommended: **NATIVE** (already part of Argos)

| Method               | Supported | Notes                                          |
| -------------------- | --------- | ---------------------------------------------- |
| **Docker Container** | N/A       | Integrated Argos module, not a standalone tool |
| **Native Install**   | YES       | **ACTIVE** — running as part of Argos application |

---

## Tool Description

Argos built-in GSM signal monitoring and IMSI detection module. Integrated directly into the Argos SvelteKit dashboard, providing real-time GSM frequency scanning, IMSI/TMSI detection, cell tower identification, and signal strength monitoring. Uses HackRF One for RF reception and presents data through the Argos web interface with tactical map overlay.

## Category

GSM IMSI Detection / Signal Monitoring

## Repository

Built-in Argos module (not a standalone tool)
Source: `/home/kali/Documents/Argos/Argos/src/routes/gsm-evil/`

---

## Docker Compatibility Analysis

### Can it run in Docker?

**N/A** - GSM Evil is an integrated Argos module, not a standalone tool. It runs as part of the Argos SvelteKit application and cannot be independently containerized.

### Host OS-Level Requirements

- Runs within the Argos application process
- HackRF One must be accessible to the Argos backend
- Node.js runtime (managed by Argos)

### Docker-to-Host Communication

- If Argos itself is containerized, GSM Evil would run inside that container
- Requires HackRF USB passthrough to the Argos container
- WebSocket communication between frontend and backend (internal to Argos)

---

## Install Instructions (Docker on Kali RPi 5)

### Not Applicable - Already Installed

GSM Evil is a built-in module of the Argos application. No separate installation required.

```bash
# GSM Evil is accessed via the Argos dashboard
npm run dev
# Navigate to: http://localhost:5173/gsm-evil
```

If Argos itself is containerized in the future, GSM Evil would be included automatically as part of the Argos Docker image.

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Already running on the RPi 5 as part of Argos.

### Hardware Constraints

- CPU: Minimal impact - signal processing handled by HackRF firmware
- RAM: Part of Argos Node.js process (~200MB shared)
- SDR: Requires HackRF One (installed)

### Verdict

**COMPATIBLE** - Already operational on RPi 5. No Docker deployment needed. This is a native Argos module.
