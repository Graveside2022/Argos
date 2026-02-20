# Meshtastic Frequency Calculator

> **RISK CLASSIFICATION**: MODERATE RISK - ENABLES TARGETED RF MONITORING
> Calculates exact LoRa frequency slots from Meshtastic channel names, enabling precision targeting of specific mesh channels for monitoring or jamming. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python stdlib-only script, no dependencies

| Method               | Supported | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| **Docker Container** | YES       | Trivial to containerize but unnecessary; no external dependencies     |
| **Native Install**   | YES       | Single Python script with no pip dependencies; runs on any Python 3.x |

---

## Tool Description

The Meshtastic Frequency Calculator is a Python utility that computes exact LoRa frequency slots for any given Meshtastic channel name using the djb2 hash algorithm. Meshtastic devices derive their operating frequency within the 902-928 MHz ISM band (US region) from a hash of the channel name. This tool replicates that calculation offline, enabling an operator to determine precisely which frequency slot a target Meshtastic mesh network is using without scanning the entire band. A web-based version is also available at calc.mesh.badpirate.net for quick field calculations.

## Category

LoRa Frequency Analysis / Meshtastic Targeting / RF Planning

## Repository

https://github.com/heypete/meshtastic_frequency_slot_calculator

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Lightweight Python script with no external dependencies beyond the Python standard library. No hardware access required. Runs entirely as a computational tool.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required
- No kernel modules required
- No `--net=host` required
- No persistent state or network connections

### Docker-to-Host Communication

- None required. This is a standalone computational utility with no network dependencies. Input is a channel name string; output is the calculated frequency slot.

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN git clone https://github.com/heypete/meshtastic_frequency_slot_calculator.git \
    /opt/meshtastic-freq-calc

WORKDIR /opt/meshtastic-freq-calc

ENTRYPOINT ["python", "frequency_slot.py"]
```

### Build and Run

```bash
# Build
docker build -t argos/meshtastic-freq-calc .

# Calculate frequency for a channel name
docker run --rm argos/meshtastic-freq-calc "LongFast"

# Calculate frequency for a custom channel
docker run --rm argos/meshtastic-freq-calc "MySecretChannel"

# Interactive mode (if supported)
docker run -it --rm argos/meshtastic-freq-calc
```

### Native Install (alternative -- no Docker overhead needed)

```bash
# Clone the repository
git clone https://github.com/heypete/meshtastic_frequency_slot_calculator.git \
    /opt/meshtastic-freq-calc

# Run directly
cd /opt/meshtastic-freq-calc
python3 frequency_slot.py "LongFast"
```

### Web Version

For quick field calculations without any local installation:

- URL: https://calc.mesh.badpirate.net
- Enter the channel name to get the frequency slot
- No installation required -- browser-based

### How the djb2 Hash Works

```
1. Start with hash value 5381
2. For each character in the channel name:
   hash = ((hash << 5) + hash) + char
3. Result modulo number_of_frequency_slots = frequency slot index
4. Map slot index to actual MHz frequency in the 902-928 MHz band
```

### Common Default Channel Frequencies

| Channel Name | Frequency Slot | Notes                       |
| ------------ | -------------- | --------------------------- |
| LongFast     | Default slot 0 | Most common default channel |
| MediumSlow   | Varies         | Medium range preset         |
| ShortFast    | Varies         | Short range, fast data rate |

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python script using only the standard library. No compiled dependencies. Runs on any Python 3.x interpreter without modification.

### Hardware Constraints

- **CPU**: Negligible - single hash computation completes in microseconds.
- **RAM**: < 10MB total footprint.
- **Hardware**: None required. This is a purely computational tool.
- **Note**: To act on the calculated frequencies (monitor or jam), separate RF hardware is required (HackRF, RTL-SDR, or LoRa transceiver).

### Verdict

**COMPATIBLE** - Runs trivially on Raspberry Pi 5. Docker is optional for this tool; native Python execution is equally valid and avoids container overhead. Primary value is rapid frequency planning for Meshtastic mesh network targeting -- compute the channel frequency, then point HackRF or RTL-SDR at that exact slot.
