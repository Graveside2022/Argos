# Workflow: SDR Signals Intelligence

**ID:** 12_sdr_sigint
**Risk Level:** MEDIUM — Active RF transmission (replay only)
**Estimated Duration:** 5-60 minutes
**Requires:** HackRF One (or compatible SDR), antenna

## Objective

Perform signals intelligence using HackRF One: spectrum survey, signal capture,
GSM decoding, and RF replay for authorized testing.

## Pre-Flight Checks

1. **HackRF connected:** `hackrf_info` (should show Serial number)
2. **Tools available:** `which hackrf_transfer hackrf_sweep grgsm_decode`
3. **Antenna attached:** Correct antenna for target frequency band

## Steps

### Step 1: Wideband Spectrum Sweep

Survey the RF environment to identify active signals:

```bash
npx tsx tactical/modules/module_runner.ts spectrum_sweep \
  --freq-start 70000000 --freq-end 6000000000 \
  --bin-width 100000 --duration 30
```

**Record:** Peak frequencies, signal strengths. Identify active bands.

### Step 2: Targeted Capture

Once a signal of interest is identified, capture raw IQ data:

```bash
npx tsx tactical/modules/module_runner.ts hackrf_capture \
  --frequency <FREQ_HZ> --sample-rate 2000000 \
  --duration 30 --output-file /tmp/capture.raw
```

**Record:** File size, sample rate, center frequency.

### Step 3: GSM Decoding (if GSM signal found)

For GSM downlink signals (typically 935-960 MHz or 1805-1880 MHz):

```bash
npx tsx tactical/modules/module_runner.ts gsm_decoder \
  --input-file /tmp/capture.cfile \
  --timeslot 0 --burst-type normal
```

**Record:** Decoded frames, channel info, ARFCN.

### Step 4: Signal Analysis with Process Tracing

For unknown protocols, trace tool execution for deeper analysis:

```bash
npx tsx tactical/modules/module_runner.ts process_tracer \
  --command "hackrf_transfer -r /dev/null -f <FREQ> -s 2000000" \
  --duration 10 --filter trace
```

### Step 5: RF Replay (authorized testing only)

**WARNING:** RF transmission requires explicit authorization. Verify legal compliance.

```bash
npx tsx tactical/modules/module_runner.ts rf_replay \
  --input-file /tmp/capture.raw --frequency <FREQ_HZ> \
  --sample-rate 2000000 --tx-gain 30
```

**Verify:** Target device responds to replayed signal.

## Abort Conditions

- HackRF disconnected (USB error)
- Unauthorized frequency band
- Operator requests stop
- Signal interference with critical infrastructure detected

## Reporting

- Spectrum survey: active bands, peak frequencies, signal types
- Captures: frequency, duration, file size, sample rate
- GSM decoding: ARFCN, timeslots, decoded frame count
- Replay results: success/failure, target response
- Recommendations: further analysis, equipment needed
