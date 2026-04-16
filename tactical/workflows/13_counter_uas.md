# Workflow: Counter-UAS Kill Chain

**ID:** 13_counter_uas
**Risk Level:** HIGH — Active RF engagement phases require explicit authorization
**Estimated Duration:** Continuous (detection), 5-30 minutes (engagement)
**Requires:** Alfa WiFi adapter (monitor mode), HackRF One, GPS (gpsd), DragonSync + droneid-go installed
**Framework Reference:** [ASTRA](https://github.com/deepwoodssec/astra) (deepwoodssec)

## Objective

Detect, identify, track, assess, and (when authorized) engage unmanned aerial systems
using passive RF collection, FAA Remote ID decoding, spectrum analysis, and active
countermeasures. Six-phase kill chain derived from the ASTRA framework.

## Adversary Hardening Tiers

Assess the target before selecting countermeasures. Not all techniques work against
all drones. Be honest — if no viable countermeasure exists, report that.

| Tier                        | Description                                                 | Example Platforms                                | Viable Techniques                                       |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| **0 — COTS Unmodified**     | Stock firmware, no encryption, default protocols            | DJI Mini, Skydio 2, Autel EVO                    | All (Specter, Mirage, Fracture, Override, Sever)        |
| **1 — Protocol-Hardened**   | Encrypted command channel, signed firmware                  | DJI Matrice (latest FW), enterprise fleet drones | Specter, Mirage, Fracture, Sever                        |
| **2 — Sensor-Hardened**     | Multi-constellation GNSS, INS fallback, anti-spoof GPS      | Military COTS (L3Harris, AeroVironment RQ-20)    | Specter, Fracture, Sever                                |
| **3 — Full-Stack Hardened** | Military encryption, LPI waveforms, GPS M-code, anti-tamper | Group 3+ military UAS, hardened swarms           | Specter only (active techniques require novel research) |

### Assessment Flow

```
1. Is the command channel encrypted or signed?
     No  → Tier 0
     Yes → Continue

2. Is GPS authenticated or navigation multi-modal (INS/visual)?
     No  → Tier 1
     Yes → Continue

3. Anti-tamper, secure boot, LPI comms, adaptive failsafe logic?
     No  → Tier 2
     Yes → Tier 3
```

Real-world platforms may be mixed (Tier 1 comms, Tier 0 GPS). Evaluate viability
per attack vector, not per overall tier.

## Pre-Flight Checks

1. **DragonSync running:**

    ```bash
    systemctl status dragonsync.service
    # Or manual: python3 /opt/DragonSync/dragonsync.py -c /opt/DragonSync/config.ini
    ```

2. **droneid-go running:**

    ```bash
    systemctl status zmq-decoder.service
    # Or manual: sudo /opt/droneid-go/droneid -i wlan1 -g -z -zmqsetting 0.0.0.0:4224
    ```

3. **DragonSync API reachable:**

    ```bash
    curl -s http://127.0.0.1:8088/status | python3 -m json.tool
    curl -s http://127.0.0.1:8088/drones | python3 -m json.tool
    ```

4. **HackRF connected:** `hackrf_info` (should show serial number)

5. **GPS fix:** `gpspipe -w -n 5 | grep TPV` (confirm lat/lon populated)

6. **WiFi adapter in monitor mode:**
    ```bash
    # Use wlan1 or wlan2 (Alfa) — NEVER wlan0 (reserved for internet)
    sudo airmon-ng start wlan1
    ```

## Phase A — Detection

**Objective:** Discover UAS presence in the operational area via passive RF collection.

**Specter thread starts here and runs continuously through all phases.**

### Step A1: WiFi Remote ID Detection (Primary)

droneid-go captures FAA Remote ID WiFi beacons on 2.4/5 GHz via Alfa adapter.
DragonSync aggregates and exposes via API.

```bash
# Check for detected drones
curl -s http://127.0.0.1:8088/drones | python3 -c "
import json, sys
data = json.load(sys.stdin)
drones = data.get('drones', [])
print(f'Drones detected: {len(drones)}')
for d in drones:
    print(f'  {d[\"id\"]} | {d.get(\"ua_type_name\",\"?\")} | lat={d.get(\"lat\",0):.6f} lon={d.get(\"lon\",0):.6f} | alt={d.get(\"alt\",0)}m | RSSI={d.get(\"rssi\",\"?\")}dBm')
"
```

**Record:** Drone count, IDs, positions, UA types, RSSI.
**If drones detected:** Proceed to Phase B.
**If no drones:** Continue monitoring, proceed to Step A2.

### Step A2: Wideband Spectrum Sweep (Secondary)

Survey drone communication bands for uncooperative targets (no Remote ID):

```bash
# 2.4 GHz band (RC control, WiFi)
npx tsx tactical/modules/module_runner.ts spectrum_sweep \
  --freq-start 2400000000 --freq-end 2500000000 \
  --bin-width 100000 --duration 30

# 5.8 GHz band (video downlink, DJI OcuSync)
npx tsx tactical/modules/module_runner.ts spectrum_sweep \
  --freq-start 5725000000 --freq-end 5875000000 \
  --bin-width 100000 --duration 30

# 900 MHz band (long-range telemetry, LoRa, SiK radios)
npx tsx tactical/modules/module_runner.ts spectrum_sweep \
  --freq-start 900000000 --freq-end 930000000 \
  --bin-width 50000 --duration 30

# 433 MHz band (RC, telemetry — region dependent)
npx tsx tactical/modules/module_runner.ts spectrum_sweep \
  --freq-start 430000000 --freq-end 440000000 \
  --bin-width 50000 --duration 30
```

**Record:** Anomalous signals — new emitters, wideband FHSS patterns, OFDM signatures.
**Look for:** Periodic bursts (telemetry), continuous wideband (video), hopping patterns (FHSS control).

### Step A3: Kismet WiFi Detection (Supplementary)

DragonSync can ingest from Kismet. Check for drone-associated MACs:

```bash
npx tsx tactical/modules/module_runner.ts wifi_recon \
  --type ap --manufacturer DJI --min-signal -80

npx tsx tactical/modules/module_runner.ts wifi_recon \
  --type ap --manufacturer Skydio --min-signal -80

npx tsx tactical/modules/module_runner.ts wifi_recon \
  --type ap --manufacturer Autel --min-signal -80

npx tsx tactical/modules/module_runner.ts wifi_recon \
  --type ap --manufacturer Parrot --min-signal -80
```

**Record:** Drone manufacturer APs, BSSIDs, channels, signal strength.

### Phase A Outputs

| Output                 | Format                 | Feeds   |
| ---------------------- | ---------------------- | ------- |
| Drone detections (RID) | DragonSync JSON API    | Phase B |
| Spectrum anomalies     | Module runner JSON     | Phase B |
| Drone manufacturer APs | Kismet/wifi_recon JSON | Phase B |
| Detection confidence   | Operator assessment    | Phase D |

---

## Phase B — Identification

**Objective:** Classify detected platform by type, manufacturer, firmware, and protocol stack.
Transform "something is there" into "it is a specific platform with known characteristics."

### Step B1: Remote ID Classification

Extract identity from DragonSync tracks:

```bash
curl -s http://127.0.0.1:8088/drones | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data.get('drones', []):
    print(f'=== {d[\"id\"]} ===')
    print(f'  UA Type:      {d.get(\"ua_type_name\", \"Unknown\")} (code {d.get(\"ua_type\", \"?\")})')
    print(f'  ID Type:      {d.get(\"id_type\", \"?\")}')
    print(f'  Operator ID:  {d.get(\"operator_id\", \"N/A\")}')
    print(f'  Serial:       {d.get(\"id\", \"?\")}')
    print(f'  Transport:    {d.get(\"transport\", \"?\")}')
    print(f'  Frequency:    {d.get(\"freq\", \"?\")} MHz')
    print(f'  Description:  {d.get(\"description\", \"\")}')
    rid = d.get('rid', {})
    if rid.get('make') or rid.get('model'):
        print(f'  FAA RID:      {rid.get(\"make\", \"\")} {rid.get(\"model\", \"\")}')
        print(f'  RID Source:   {rid.get(\"source\", \"\")}')
    print(f'  Op Status:    {d.get(\"op_status\", \"?\")}')
    print()
"
```

**Record:** Platform class, manufacturer, serial number, FAA registration status.

### Step B2: RF Signature Analysis

For uncooperative targets detected via spectrum sweep:

```bash
# Capture signal of interest for analysis
npx tsx tactical/modules/module_runner.ts hackrf_capture \
  --frequency <FREQ_HZ> --sample-rate 2000000 \
  --duration 30 --output-file /tmp/drone_capture.raw
```

**Identify by RF signature:**

| Parameter        | What It Tells You                          |
| ---------------- | ------------------------------------------ |
| Center frequency | Band and likely protocol                   |
| Bandwidth        | Narrowband (telemetry) vs wideband (video) |
| Modulation       | FSK, OFDM, FHSS — narrows platform family  |
| Hopping pattern  | FHSS sequence identifies protocol          |
| Duty cycle       | Continuous (video) vs burst (telemetry)    |
| Power level      | Range estimation, platform size            |

### Step B3: Hardening Tier Assessment

Based on identification, classify the target:

```
┌─ Command channel encrypted/signed? ──── No ──→ TIER 0 (all techniques viable)
│
├─ Yes
│  └─ GPS authenticated or multi-modal? ── No ──→ TIER 1 (Override filtered out)
│
├─ Yes
│  └─ Anti-tamper, LPI, adaptive logic? ── No ──→ TIER 2 (Override + Mirage filtered)
│
└─ Yes ──────────────────────────────────────────→ TIER 3 (Specter only)
```

**Record:** Assessed hardening tier, confidence level, viable technique categories.

### Phase B Outputs

| Output                  | Format              | Feeds                          |
| ----------------------- | ------------------- | ------------------------------ |
| Platform classification | Operator log        | Phase D                        |
| Hardening tier          | Tier 0-3            | Phase D (technique filtering)  |
| RF signature profile    | Captured IQ file    | Phase F (pre-engagement intel) |
| FAA registration data   | DragonSync RID JSON | Reporting                      |

---

## Phase C — Tracking

**Objective:** Maintain continuous positional awareness of the target UAS, its operator,
and its home/launch point.

### Step C1: Real-Time Track Maintenance

DragonSync provides continuous tracking via API. Poll for updates:

```bash
# Continuous track monitor (Ctrl+C to stop)
watch -n 2 'curl -s http://127.0.0.1:8088/drones | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data.get(\"drones\", []):
    print(f\"{d[\\\"id\\\"]:20s} | pos=({d.get(\\\"lat\\\",0):.6f}, {d.get(\\\"lon\\\",0):.6f}) | alt={d.get(\\\"alt\\\",0):6.1f}m | spd={d.get(\\\"speed\\\",0):.1f}m/s | hdg={d.get(\\\"direction\\\",0)}° | pilot=({d.get(\\\"pilot_lat\\\",0):.6f}, {d.get(\\\"pilot_lon\\\",0):.6f})\")
"'
```

**Three markers per drone on the Argos tactical map:**

- **Drone position** (lat/lon/alt) — the aircraft
- **Pilot position** (pilot_lat/pilot_lon) — where the operator is standing
- **Home position** (home_lat/home_lon) — takeoff/RTH point

### Step C2: Track Quality Assessment

| Data Source              | Accuracy                           | Limitation                                    |
| ------------------------ | ---------------------------------- | --------------------------------------------- |
| WiFi RID (droneid-go)    | GPS-quality (from drone's own GPS) | Range limited to WiFi beacon range (~1-2 km)  |
| BLE RID (Sniffle dongle) | GPS-quality                        | BLE5 LR range ~1 km, requires dongle hardware |
| Spectrum sweep (HackRF)  | Bearing only (RSSI)                | No position fix without multiple sensors      |

**Record:** Track quality, update rate, position accuracy, coverage gaps.

### Phase C Outputs

| Output                   | Format                                | Feeds                             |
| ------------------------ | ------------------------------------- | --------------------------------- |
| Drone position track     | lat/lon/alt/heading/speed time series | Phase D, Argos map                |
| Pilot location           | lat/lon                               | Phase D (operator neutralization) |
| Home/RTH position        | lat/lon                               | Phase E (Mirage RTH redirect)     |
| Track quality assessment | Operator assessment                   | Phase D                           |

---

## Phase D — Decision

**Objective:** Select countermeasure based on identification, tracking quality,
hardening tier, and authorization level.

### Step D1: Technique Viability Matrix

Filter available techniques by assessed hardening tier:

| Tier  | Specter (Passive Intel) | Mirage (GPS Spoof) | Fracture (Failsafe Exploit) | Override (Command Inject) | Sever (Jamming/Denial) |
| ----- | ----------------------- | ------------------ | --------------------------- | ------------------------- | ---------------------- |
| **0** | ✅                      | ✅                 | ✅                          | ✅                        | ✅                     |
| **1** | ✅                      | ✅                 | ✅                          | ❌ encrypted              | ✅                     |
| **2** | ✅                      | ❌ multi-GNSS      | ✅                          | ❌                        | ✅                     |
| **3** | ✅                      | ❌                 | ⚠ requires research        | ❌                        | ⚠ anti-jam degrades   |

### Step D2: Countermeasure Selection

**Available on your hardware:**

| Technique                        | Tool                      | Hardware        | Risk         | Authorization Required                                       |
| -------------------------------- | ------------------------- | --------------- | ------------ | ------------------------------------------------------------ |
| **Specter** — Passive collection | DragonSync + HackRF sweep | Alfa, HackRF    | LOW          | Standing authority                                           |
| **Mirage** — GPS spoofing        | gps-sdr-sim               | HackRF One (TX) | **CRITICAL** | Explicit written authorization, RF-shielded or range control |
| **Sever** — WiFi deauth          | wifi_deauth module        | Alfa adapter    | HIGH         | Authorized engagement                                        |
| **Sever** — Broadband jam        | HackRF TX on control freq | HackRF One (TX) | **CRITICAL** | Explicit authorization, legal compliance                     |

**NOT available on your hardware:**

| Technique                        | Why Not                                   | Would Need                               |
| -------------------------------- | ----------------------------------------- | ---------------------------------------- |
| Override (MAVLink inject)        | No MAVLink TX capability, encrypted links | SDR + MAVLink stack + unencrypted target |
| Fracture (failsafe manipulation) | Requires protocol-specific exploits       | Target-specific research                 |
| DJI DroneID decode               | No PlutoSDR/ANTSDR                        | PlutoSDR (~$160)                         |

### Step D3: Authorization Gate

**WARNING:** Phases E engagement techniques involve active RF transmission.

```
┌─ Is this an authorized EW training exercise? ── No ──→ STOP. Phase A-C only.
│
├─ Yes
│  └─ Is GPS spoofing approved in the ROE? ── No ──→ Sever techniques only.
│
├─ Yes
│  └─ Is the range RF-controlled? ── No ──→ Mirage requires RF shielding.
│
└─ Yes ──→ Full engagement authorized. Proceed to Phase E.
```

**Record:** Selected technique, authorization level, ROE constraints.

---

## Phase E — Engagement

**⚠ REQUIRES EXPLICIT OPERATOR AUTHORIZATION BEFORE EACH TECHNIQUE ⚠**

**Specter runs continuously during engagement — it tells you if countermeasures are working.**

### Step E1: Sever — WiFi Deauthentication

Disrupt drone's WiFi control link (Tier 0 COTS drones using WiFi control):

```bash
# Target drone's WiFi control AP (BSSID from Phase B Kismet scan)
npx tsx tactical/modules/module_runner.ts wifi_deauth \
  --bssid <DRONE_BSSID> \
  --interface wlan1mon \
  --count 100
```

**Specter feedback:** Monitor DragonSync — if drone triggers RTH failsafe, track will
show heading change toward home position.

### Step E2: Mirage — GPS Spoofing (gps-sdr-sim)

Redirect drone to a capture point by spoofing GPS signals:

**⚠ CRITICAL: RF transmission. Legal in authorized military exercises only. ⚠**

```bash
# Generate GPS spoofing signal toward capture coordinates
# (gps-sdr-sim is in offnet/attack/drone-defeat-gps/)
gps-sdr-sim -e <EPHEMERIS_FILE> \
  -l <CAPTURE_LAT>,<CAPTURE_LON>,<CAPTURE_ALT> \
  -o /tmp/gpssim.bin

# Transmit via HackRF
hackrf_transfer -t /tmp/gpssim.bin -f 1575420000 -s 2600000 -a 1 -x 30
```

**Spoofing modes (from ASTRA):**

| Mode             | Effect                                    | Use Case                                   |
| ---------------- | ----------------------------------------- | ------------------------------------------ |
| Redirect         | Gradually shift position to capture point | Controlled landing at friendly location    |
| Geofence trigger | Spoof position inside a no-fly zone       | Force automatic landing via geofence       |
| RTH capture      | Spoof home position, then trigger RTH     | Drone "returns home" to your capture point |

**Specter feedback:** Monitor DragonSync track — position should shift toward
spoofed coordinates. If no shift, target may be Tier 2+ (multi-GNSS/INS).

### Step E3: Sever — RF Denial (Broadband)

Disrupt drone control/video on target frequency:

**⚠ CRITICAL: Active jamming. Legal only in authorized military exercises with range control. ⚠**

```bash
# Capture target frequency from Phase B, transmit noise
# WARNING: This affects ALL devices on the frequency
hackrf_transfer -t /dev/urandom -f <TARGET_FREQ_HZ> -s 2000000 -a 1 -x 47
```

**Specter feedback:** Monitor spectrum sweep — target signal should disappear.
Monitor DragonSync — drone should trigger failsafe (RTH or land).

### Engagement Documentation

Log every engagement action:

| Field            | Value                      |
| ---------------- | -------------------------- |
| Time (UTC)       | `date -u`                  |
| Target ID        | DragonSync drone ID        |
| Technique        | Sever/Mirage/Override      |
| Parameters       | Frequency, power, duration |
| Specter feedback | Observed target response   |
| Outcome          | Success/partial/failure    |
| Collateral       | Other affected systems     |

### Phase E Outputs

| Output                 | Format                           | Feeds        |
| ---------------------- | -------------------------------- | ------------ |
| Engagement outcome     | Structured log                   | Reporting    |
| Target final state     | Last known position, flight mode | Phase F      |
| Measured effectiveness | Success/failure per technique    | After-action |
| Engagement timeline    | Timestamped log                  | After-action |

---

## Phase F — Exploitation (Intelligence)

**Non-linear phase.** Runs in two modes that wrap around the engagement cycle:

```
F (pre-engagement) → informs → D (decision) → E (engagement)
                                                     ↓
                                              F (post-engagement)
```

### Mode 1: Pre-Engagement Intelligence

Before engagement, gather platform-specific vulnerability data:

```bash
# Search for known exploits for identified platform
npx tsx tactical/modules/module_runner.ts exploit_search \
  --query "DJI drone" --type remote

npx tsx tactical/modules/module_runner.ts exploit_search \
  --query "MAVLink" --type remote

npx tsx tactical/modules/module_runner.ts exploit_search \
  --query "ArduPilot" --type remote
```

**If physical access to same platform type available:**

```bash
# Firmware extraction and analysis
npx tsx tactical/modules/module_runner.ts binary_analyzer \
  --file <FIRMWARE_BIN> --extract --entropy --signature

npx tsx tactical/modules/module_runner.ts re_analyzer \
  --file <FIRMWARE_BIN> --mode info

npx tsx tactical/modules/module_runner.ts re_analyzer \
  --file <FIRMWARE_BIN> --mode strings
```

**Record:** Known CVEs, failsafe behavior, protocol vulnerabilities, encryption status.

### Mode 2: Post-Engagement Forensics

If a platform is recovered after engagement:

```bash
# Extract storage media and analyze
npx tsx tactical/modules/module_runner.ts disk_analyzer \
  --image <DRONE_STORAGE_IMG> --tool fls

npx tsx tactical/modules/module_runner.ts file_carver \
  --input-file <DRONE_STORAGE_IMG> --output-dir /tmp/drone_forensics \
  --scanners all

# Analyze recovered firmware
npx tsx tactical/modules/module_runner.ts binary_analyzer \
  --file <RECOVERED_FIRMWARE> --extract --entropy
```

**Record:** Flight logs, waypoints, operator data, firmware version, component attribution.

### Phase F Outputs

| Output                | Format                  | Feeds                                |
| --------------------- | ----------------------- | ------------------------------------ |
| Vulnerability profile | CVE list, exploit paths | Phase D (future engagements)         |
| Failsafe behavior map | Decision tree           | Phase D, Phase E technique selection |
| Firmware analysis     | binwalk/radare2 output  | Intelligence database                |
| Mission data recovery | Flight logs, media      | After-action intelligence            |

---

## Technique Reference (ASTRA Categories)

### Specter — Continuous Passive Intelligence

Runs across ALL phases. Not just reconnaissance — provides real-time engagement feedback.

| During Phase       | Specter Role                               |
| ------------------ | ------------------------------------------ |
| A (Detection)      | Initial discovery of RF emissions          |
| B (Identification) | RF fingerprinting, protocol classification |
| C (Tracking)       | Continuous position updates                |
| D (Decision)       | Environmental awareness                    |
| E (Engagement)     | **Real-time countermeasure feedback**      |
| F (Exploitation)   | Background collection during analysis      |

**Engagement feedback loop:**

| Countermeasure              | Specter Observable                                          |
| --------------------------- | ----------------------------------------------------------- |
| GPS spoof → redirect        | DragonSync track shows position shift toward spoofed coords |
| WiFi deauth → failsafe      | DragonSync track shows heading change toward home           |
| RF denial → link loss       | Target signal disappears from spectrum sweep                |
| Command inject → force land | DragonSync track shows descent rate change                  |

### Mirage — SENSE Loop Corruption (GPS Spoofing)

| Key Parameter  | Detail                                                         |
| -------------- | -------------------------------------------------------------- |
| Frequency      | 1575.42 MHz (GPS L1)                                           |
| Required power | Must exceed genuine GPS signal at target (~-130 dBm at ground) |
| Ramp rate      | Gradual drift avoids spoof detection in newer firmware         |
| Tool           | gps-sdr-sim + HackRF TX                                        |

### Override — ACT Loop Commandeering (MAVLink Injection)

Not currently available with your hardware. Requires:

- Target on unencrypted MAVLink (Tier 0 only)
- TX capability on target's telemetry frequency
- Correct MAVLink version (v1 or v2) with valid CRC

| MAVLink Command              | Effect                                           |
| ---------------------------- | ------------------------------------------------ |
| MAV_CMD_NAV_LAND             | Immediate landing at current position            |
| MAV_CMD_NAV_RETURN_TO_LAUNCH | Return to home (combine with Mirage for capture) |
| MAV_CMD_COMPONENT_ARM_DISARM | Disarm motors (catastrophic)                     |
| MAV_CMD_DO_FLIGHTTERMINATION | Terminate flight                                 |

### Fracture — DECIDE Loop Corruption

Target the drone's autonomous decision logic:

- Failsafe threshold manipulation (trigger battery/signal loss failsafe)
- Geofence exploitation (spoof position inside no-fly zone)
- Swarm coordination poisoning (multi-platform targets)

### Sever — Operational Continuity Disruption

| Mode                      | Method                                 | Effect                             |
| ------------------------- | -------------------------------------- | ---------------------------------- |
| WiFi deauth               | aireplay-ng on control channel         | Control link disruption → failsafe |
| Spot jamming              | HackRF TX on control frequency         | Total link denial on target freq   |
| Barrage jamming           | Wideband noise across band             | All devices on band affected       |
| Power budget exploitation | Force high-power mode via interference | Accelerated battery drain          |

---

## Abort Conditions

- Operator requests stop
- Unauthorized target detected (manned aircraft, friendly UAS)
- RF interference with critical infrastructure
- Collateral damage to friendly systems exceeds acceptable threshold
- Equipment failure (HackRF disconnect, GPS loss, adapter failure)
- Target assessed as Tier 3 with no viable countermeasure — report honestly
- Legal/authorization boundary reached

## Reporting

Summarize:

- **Phase A:** Detection method, number of UAS detected, first detection time
- **Phase B:** Platform classification, serial/registration, hardening tier assessment
- **Phase C:** Track duration, position accuracy, pilot/home locations identified
- **Phase D:** Selected countermeasure, authorization level, ROE constraints
- **Phase E:** Engagement timeline, technique used, Specter feedback, outcome
- **Phase F:** CVEs found, firmware analysis results, recovered intelligence
- **Recommendations:** Equipment gaps, technique effectiveness, lessons learned
