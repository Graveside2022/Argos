# Conduct Survey — SITREP Runbook

Playbook Claude Code follows when operator says **"conduct a survey"** or **"run a spectrum survey [band]"**. Produces a SITREP PDF/HTML with a peak-hold composite PNG and a Claude-drafted Spectrum Analysis narrative.

## When to invoke

Operator cues:

- "conduct a survey"
- "run a spectrum survey on 925–960"
- "give me a SITREP on the GSM band"
- "what's on 2.4 GHz right now"

If the operator names a band in MHz, use it. If not, ask which band (typical Army EW default: 225–400 MHz air, 30–88 MHz ground, 925–960 MHz cellular).

## Pre-flight

```bash
free -h | head -2                     # require available >= 1.5 GiB
hackrf_info | head -6                 # must find 1 device, no 'Resource busy'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/api/health  # 200
```

If HackRF busy: `pkill -f hackrf_sweep` after confirming no legitimate sweep is running.

Load API key:

```bash
export ARGOS_API_KEY=$(grep '^ARGOS_API_KEY=' /home/kali/Documents/Argos/Argos/.env | cut -d= -f2-)
```

## Step 1 — Create mission

```bash
MISSION=$(curl -s -X POST http://localhost:5173/api/missions \
  -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"<short descriptive name>","type":"sitrep-loop","set_active":true}' \
  | jq -r '.mission.id')
echo "MISSION=$MISSION"
```

## Step 2 — Start narrow-band capture

```bash
CAPTURE=$(curl -s -X POST http://localhost:5173/api/captures/start \
  -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/json" \
  -d "{\"mission_id\":\"$MISSION\",\"role\":\"tick\",\"loadout\":{\"sensors\":[],\"spectrum_start_hz\":<START_HZ>,\"spectrum_end_hz\":<END_HZ>}}" \
  | jq -r '.capture.id')
echo "CAPTURE=$CAPTURE"
```

Default bin width: 3000 Hz (hackrf_sweep min 2445, rounded up). Dev server clamps automatically.

## Step 3 — Hold

Default: 60 seconds. Minimum useful: 15 s (enough passes for peak-hold to converge on bursty emitters). Maximum sane: 120 s (produces ~330 MB NDJSON).

```bash
sleep 60
```

## Step 4 — Stop capture

```bash
curl -s -X POST http://localhost:5173/api/captures/$CAPTURE/stop \
  -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/json" -d '{}'
```

Verify NDJSON growth:

```bash
wc -l data/captures/$CAPTURE/sweep.ndjson
head -1 data/captures/$CAPTURE/sweep.ndjson   # meta line
```

Require ≥ 5 frame lines. If only the meta line appears, sweep failed — check `/tmp/argos-dev.log` for `Line too long` or `argument error` and abort.

## Step 5 — Extract features

```bash
npx tsx scripts/spectrum-features.ts $CAPTURE > /tmp/features.json
```

Inspect:

```bash
jq '.noise_floor_dbm, .capture.total_frames, (.emitters | length), (.quiet_bands | length)' /tmp/features.json
jq '.emitters[:5]' /tmp/features.json
```

Sanity thresholds:

- `noise_floor_dbm` in typical range: −115 to −85 dBm (band-dependent)
- `emitters.length` ≥ 1 for any populated band
- Top emitter `peak_dbm > noise_floor + 15`

If noise floor looks wrong (> −60 dBm) the LNA/VGA gains are probably saturated on a strong emitter — note in narrative, do not retune.

## Step 6 — Draft narrative

Read `/tmp/features.json` and write 3–5 sentences in this shape:

> BLUF one-liner naming strongest emitter(s) with freq and dBm.
> Duty-cycle pattern observation (continuous carriers, bursts, hopping).
> Quiet band recommendation if relevant.
> Assessment of operational significance (1 sentence).

Constraints:

- Plain markdown, no headers, no bullets, no code fences
- No speculation beyond what features show
- Use MGRS / friendly terms only if the data contains them
- ≤ 10 000 characters total (API limit)
- Bottom-line up front

Example (925–960 MHz GSM band, 60 s capture):

> Continuous GSM900 BCCH activity dominates 935–960 MHz with strongest carrier at 942.4 MHz (-32 dBm, 98% duty cycle) consistent with a commercial cell site. Three additional 200 kHz carriers between 936–940 MHz show similar 100% duty patterns, indicating a co-located sector. The 925–934 MHz uplink slice is quiet (mean −108 dBm) and is a candidate passive collection band. No frequency-hopping or burst signatures observed in the 60-second window. Assessment: signal environment is commercial, no immediate tactical threat.

## Step 7 — Generate SITREP

```bash
NARRATIVE=$(cat /tmp/narrative.txt)   # or pass inline
REPORT=$(curl -s -X POST http://localhost:5173/api/reports/generate-sitrep \
  -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/json" \
  -d "$(jq -n --arg m "$MISSION" --arg n "$NARRATIVE" '{mission_id:$m,spectrum_analysis:$n}')" \
  | jq -r '.report.id')
echo "REPORT=$REPORT"
```

## Step 8 — Open report

Direct HTML:

```
http://localhost:5173/api/reports/$REPORT/view?format=html
```

Direct PDF:

```
http://localhost:5173/api/reports/$REPORT/view?format=pdf
```

Dashboard:

```
http://localhost:5173/dashboard -> Reports panel -> click the row
```

Verify:

- `data/reports/$REPORT/source.qmd` contains `## Spectrum Analysis` block with narrative.
- `grep -A10 'Spectrum Analysis' data/reports/$REPORT/source.html` shows rendered paragraph.
- Peak-hold PNG `peak-hold-*.png` in same dir is 1920×900.

## Failure modes

| Failure                      | Symptom              | Action                                                   |
| ---------------------------- | -------------------- | -------------------------------------------------------- |
| HackRF busy                  | capture start 500    | kill competing sweep, retry                              |
| NDJSON only meta line        | wc -l = 1 after stop | check dev log for `-w` error or line-too-long truncation |
| features.json empty emitters | `.emitters == []`    | band is truly quiet; narrative notes it                  |
| generate-sitrep 4xx          | bad narrative JSON   | re-escape with `jq -n --arg`                             |
| PNG missing                  | no `peak-hold-*.png` | NDJSON was empty or band outside capture range           |

## Cleanup

Old captures under `data/captures/` accumulate quickly (~3 MB/s). Manual cleanup:

```bash
ls -S data/captures/ | tail -n +11 | xargs -I{} rm -rf data/captures/{}
```

Or keep them for post-analysis — the NDJSON is the only ground truth and is cheap to re-process.
