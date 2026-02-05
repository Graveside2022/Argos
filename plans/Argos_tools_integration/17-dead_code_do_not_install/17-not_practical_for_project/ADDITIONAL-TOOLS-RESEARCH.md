# Additional Tools Research for Argos — FINAL LIST

> **Date**: 2026-02-05
> **Platform**: RPi 5 (ARM64/aarch64), Kali 2025.4, Docker v27.5.1
> **Primary SDR**: HackRF One | Also: USRP B205/B210, RTL-SDR
> **Status**: APPROVED — 11 tools selected for installation

---

## Master Installation Table

| #   | Tool               | GitHub (verified)                                                                                           | RPi 5 Docker                                                  | ARM64 Native                         | SDR Hardware                                         | Key Dependencies                                 | Target Folder                        | Filename            |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------ | ------------------- |
| 1   | **trunk-recorder** | [TrunkRecorder/trunk-recorder](https://github.com/TrunkRecorder/trunk-recorder)                             | **YES** — `robotastic/trunk-recorder:latest` (official arm64) | YES                                  | HackRF, RTL-SDR, USRP, Airspy, SoapySDR              | GNU Radio 3.10, gr-osmosdr, libboost, ffmpeg     | `02-cellular-attacks/trunked-radio/` | `trunk-recorder.md` |
| 2   | **dsd-neo**        | [arancormonk/dsd-neo](https://github.com/arancormonk/dsd-neo)                                               | **NO** — needs custom Dockerfile                              | YES (aarch64 AppImage available)     | RTL-SDR direct; any SDR via audio pipe               | CMake, mbe-neo, libsndfile, ncurses, portaudio   | `02-cellular-attacks/trunked-radio/` | `dsd-neo.md`        |
| 3   | **acarsdec**       | [f00b4r0/acarsdec](https://github.com/f00b4r0/acarsdec)                                                     | **YES** — `sdr-enthusiasts/docker-acarshub` (community arm64) | YES (pure C)                         | RTL-SDR, Airspy, SoapySDR (HackRF via SoapyHackRF)   | CMake, librtlsdr or libairspy or SoapySDR        | `09-aircraft-ship-tracking/`         | `acarsdec.md`       |
| 4   | **dumpvdl2**       | [szpajder/dumpvdl2](https://github.com/szpajder/dumpvdl2)                                                   | **YES** — `fredclausen/dumpvdl2:latest` (community arm64)     | YES (pure C, RPi documented)         | RTL-SDR, SoapySDR (HackRF), SDRPlay                  | CMake, glib-2.0, libacars >= 2.1.0               | `09-aircraft-ship-tracking/`         | `dumpvdl2.md`       |
| 5   | **multimon-ng**    | [EliasOenal/multimon-ng](https://github.com/EliasOenal/multimon-ng)                                         | **YES** — `boxel/multimon-ng:latest` (community arm64)        | YES (`apt-get install multimon-ng`)  | None direct — audio pipe from any SDR                | CMake only (PulseAudio optional)                 | `10-rfid-subghz/`                    | `multimon-ng.md`    |
| 6   | **SigMF**          | [sigmf/SigMF](https://github.com/sigmf/SigMF) + [sigmf/sigmf-python](https://github.com/sigmf/sigmf-python) | N/A — `pip install sigmf`                                     | YES (pure Python)                    | None — metadata standard for IQ files                | Python 3.7+, numpy, jsonschema                   | `08-sdr-frameworks/`                 | `sigmf.md`          |
| 7   | **OP25**           | [boatbod/op25](https://github.com/boatbod/op25)                                                             | **PARTIAL** — `zentec/op25` (community, snapshot arm64 tags)  | YES (RPi 3B+ documented, install.sh) | HackRF, RTL-SDR, USRP, Airspy (via gr-osmosdr)       | GNU Radio 3.10, gr-osmosdr, pybind11, numpy      | `02-cellular-attacks/trunked-radio/` | `op25.md`           |
| 8   | **SoapyRemote**    | [pothosware/SoapyRemote](https://github.com/pothosware/SoapyRemote)                                         | **NO** — needs custom Dockerfile (simple)                     | YES (Debian `any` arch)              | All SoapySDR devices (HackRF, RTL-SDR, USRP, Airspy) | SoapySDR >= 0.8.1, libavahi-client (optional)    | `08-sdr-frameworks/`                 | `soapy-remote.md`   |
| 9   | **gr-iridium**     | [muccc/gr-iridium](https://github.com/muccc/gr-iridium)                                                     | **NO** — needs custom Dockerfile with GNU Radio               | YES (RPi 4 documented in README)     | HackRF, USRP, RTL-SDR (limited), SoapySDR            | GNU Radio >= 3.10, libvolk, pybind11             | `09-aircraft-ship-tracking/`         | `gr-iridium.md`     |
| 10  | **osmo-tetra**     | [sq5bpf/osmo-tetra-sq5bpf](https://github.com/sq5bpf/osmo-tetra-sq5bpf)                                     | **NO** — needs custom Dockerfile                              | YES (pure C, Makefile)               | Any SDR via demodulator (RTL-SDR, USRP typical)      | libosmocore, GNU Radio (demod component)         | `02-cellular-attacks/trunked-radio/` | `osmo-tetra.md`     |
| 11  | **gr-satellites**  | [daniestevez/gr-satellites](https://github.com/daniestevez/gr-satellites)                                   | **NO** — needs custom Dockerfile with GNU Radio               | YES (Debian `any` arch)              | Any GNU Radio source (HackRF, RTL-SDR, USRP)         | GNU Radio >= 3.10, pybind11, construct, requests | `09-aircraft-ship-tracking/`         | `gr-satellites.md`  |

---

## Hardware Compatibility Quick Reference

Which tools work with which SDR you have:

| Tool               | HackRF One          | RTL-SDR                     | USRP B205/B210      | Notes                                    |
| ------------------ | ------------------- | --------------------------- | ------------------- | ---------------------------------------- | ------------ | -------- |
| **trunk-recorder** | YES                 | YES                         | YES                 | All via gr-osmosdr/SoapySDR              |
| **dsd-neo**        | via audio pipe      | YES (direct)                | via audio pipe      | Pipe: `hackrf_transfer                   | sox          | dsd-neo` |
| **acarsdec**       | via SoapyHackRF     | YES (direct)                | via SoapySDR        | Needs SoapySDR bridge for HackRF         |
| **dumpvdl2**       | via SoapyHackRF     | YES (direct)                | via SoapySDR        | Needs SoapySDR bridge for HackRF         |
| **multimon-ng**    | via audio pipe      | via audio pipe              | via audio pipe      | Pipe: `rtl_fm                            | multimon-ng` |
| **SigMF**          | N/A                 | N/A                         | N/A                 | Metadata library, no SDR                 |
| **OP25**           | YES                 | YES                         | YES                 | All via gr-osmosdr                       |
| **SoapyRemote**    | YES                 | YES                         | YES                 | Streams any SoapySDR device over network |
| **gr-iridium**     | YES (best)          | PARTIAL (bandwidth limited) | YES                 | Needs 10+ MSPS; HackRF ideal at 1626 MHz |
| **osmo-tetra**     | via GNU Radio demod | via GNU Radio demod         | via GNU Radio demod | Processes demodulated baseband           |
| **gr-satellites**  | YES                 | YES                         | YES                 | Any GNU Radio source block               |

---

## File Placement Instructions

### New folders to create

```
02-cellular-attacks/trunked-radio/       <-- NEW subfolder (4 tools)
```

### File creation list

Each `.md` file should follow the same standardized format as existing tool files in folders 01-15 (with `## Deployment Classification` banner).

| #   | Create File         | Full Path                                                                           |
| --- | ------------------- | ----------------------------------------------------------------------------------- |
| 1   | `trunk-recorder.md` | `plans/Argos_tools_integration/02-cellular-attacks/trunked-radio/trunk-recorder.md` |
| 2   | `dsd-neo.md`        | `plans/Argos_tools_integration/02-cellular-attacks/trunked-radio/dsd-neo.md`        |
| 3   | `op25.md`           | `plans/Argos_tools_integration/02-cellular-attacks/trunked-radio/op25.md`           |
| 4   | `osmo-tetra.md`     | `plans/Argos_tools_integration/02-cellular-attacks/trunked-radio/osmo-tetra.md`     |
| 5   | `acarsdec.md`       | `plans/Argos_tools_integration/09-aircraft-ship-tracking/acarsdec.md`               |
| 6   | `dumpvdl2.md`       | `plans/Argos_tools_integration/09-aircraft-ship-tracking/dumpvdl2.md`               |
| 7   | `gr-iridium.md`     | `plans/Argos_tools_integration/09-aircraft-ship-tracking/gr-iridium.md`             |
| 8   | `gr-satellites.md`  | `plans/Argos_tools_integration/09-aircraft-ship-tracking/gr-satellites.md`          |
| 9   | `multimon-ng.md`    | `plans/Argos_tools_integration/10-rfid-subghz/multimon-ng.md`                       |
| 10  | `sigmf.md`          | `plans/Argos_tools_integration/08-sdr-frameworks/sigmf.md`                          |
| 11  | `soapy-remote.md`   | `plans/Argos_tools_integration/08-sdr-frameworks/soapy-remote.md`                   |

---

## Docker Readiness Summary

| Readiness                                  | Tools                                                       | Action Needed                                                           |
| ------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Ready — official/community arm64 image** | trunk-recorder, acarsdec, dumpvdl2, multimon-ng             | Pull and run                                                            |
| **Ready — trivial containerization**       | SigMF                                                       | `pip install` in any Python image                                       |
| **Partial — community arm64 snapshots**    | OP25                                                        | Use `zentec/op25` arm64 tags or native install                          |
| **Needs custom Dockerfile**                | dsd-neo, SoapyRemote, gr-iridium, osmo-tetra, gr-satellites | Build from source in `debian:bookworm-slim` or `gnuradio/gnuradio` base |

### Docker base images for custom builds

```bash
# C tools without GNU Radio (dsd-neo, SoapyRemote)
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y build-essential cmake git

# C tools WITH GNU Radio (gr-iridium, osmo-tetra, gr-satellites)
FROM gnuradio/gnuradio:latest    # verify arm64 support
RUN apt-get update && apt-get install -y cmake git pybind11-dev

# Python tools (SigMF)
FROM python:3.11-slim

# HackRF USB passthrough (all tools that interface with hardware)
docker run --privileged --device=/dev/bus/usb -v /dev/bus/usb:/dev/bus/usb
```

---

## Detailed Tool Descriptions

### 1. trunk-recorder

> **Records and decodes calls from P25 & SmartNet trunked radio systems**

| Field           | Details                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/TrunkRecorder/trunk-recorder                                       |
| **Stars**       | 1,050                                                                                 |
| **License**     | GPL-3.0                                                                               |
| **Language**    | C++ (GNU Radio based)                                                                 |
| **Docker**      | `robotastic/trunk-recorder:latest` — official multi-arch (amd64, arm64) — 180K+ pulls |
| **SDR Support** | RTL-SDR, HackRF, USRP, BladeRF, Airspy, SoapySDR, FreeSRP, XTRX                       |
| **ARM64**       | YES — official arm64 Docker image, RPi explicitly documented                          |

**What it does**: Automatically monitors P25 and SmartNet trunked radio control channels, follows conversations as they hop frequencies, and records each talkgroup conversation as a separate audio file. Supports multiple simultaneous SDR sources and has a plugin architecture for streaming, uploading, and scripting.

**Relevance**: P25 is the standard US public safety/military radio system. At NTC/JMRC training, P25 traffic is everywhere. This fills a major gap — no existing tool in folders 01-15 handles trunked radio.

---

### 2. dsd-neo

> **Modern digital voice decoder: DMR, P25, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF**

| Field           | Details                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/arancormonk/dsd-neo                                        |
| **Stars**       | 67                                                                            |
| **License**     | Open source                                                                   |
| **Language**    | C/C++ (C11/C++14)                                                             |
| **Docker**      | None — needs custom Dockerfile. Pre-built aarch64 AppImage available.         |
| **SDR Support** | RTL-SDR (direct USB + RTL-TCP), any SDR via audio pipe (hackrf_transfer, sox) |
| **ARM64**       | YES — aarch64 AppImage nightly builds provided                                |

**What it does**: Takes raw audio from any SDR and decodes digital voice protocols. Successor to the classic DSD (Digital Speech Decoder). Outputs decoded audio. Lightweight C with no GNU Radio dependency.

**Protocols decoded**: DMR (Motorola TRBO, Hytera), P25 Phase 1/2, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF

**Relevance**: Universal digital radio decoder. Complements trunk-recorder — where trunk-recorder records P25 trunked calls, dsd-neo decodes voice from many more protocol types.

---

### 3. acarsdec

> **ACARS (Aircraft Communications Addressing and Reporting System) decoder**

| Field           | Details                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/f00b4r0/acarsdec                                                                   |
| **Stars**       | 48 (active fork — original TLeconte/acarsdec is ARCHIVED)                                             |
| **License**     | GPL-2.0                                                                                               |
| **Language**    | C                                                                                                     |
| **Docker**      | `sdr-enthusiasts/docker-acarshub` — community arm64 image with web UI (98 stars, actively maintained) |
| **SDR Support** | RTL-SDR (direct), Airspy (direct), SoapySDR (HackRF via SoapyHackRF)                                  |
| **ARM64**       | YES — pure C, compiles on ARM64                                                                       |

**What it does**: Decodes ACARS text messages from aircraft on VHF ~131 MHz. ACARS carries position reports, weather requests, maintenance alerts, gate assignments, and free-text pilot-ground communications. Decodes multiple channels simultaneously. JSON output.

**NOTE**: The original `TLeconte/acarsdec` is **archived**. Use the active continuation at `f00b4r0/acarsdec`. The Docker option `sdr-enthusiasts/docker-acarshub` bundles acarsdec + web UI.

**Relevance**: You already have ADS-B (dump1090/readsb) for aircraft position. ACARS adds aircraft communications content — different intelligence entirely.

---

### 4. dumpvdl2

> **VDL Mode 2 (VHF Data Link) message decoder and protocol analyzer**

| Field           | Details                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/szpajder/dumpvdl2                                                   |
| **Stars**       | 236                                                                                    |
| **License**     | GPL-3.0                                                                                |
| **Language**    | C                                                                                      |
| **Docker**      | `fredclausen/dumpvdl2:latest` — community multi-arch (amd64, arm64, armv7, armv6, 386) |
| **SDR Support** | RTL-SDR (direct), SoapySDR (HackRF), SDRPlay, Mirics                                   |
| **ARM64**       | YES — README includes "raspberry-pi" topic; Raspbian install instructions provided     |

**What it does**: Decodes VDL Mode 2, the digital successor to ACARS. Carries ACARS messages plus CPDLC (Controller-Pilot Data Link Communications) and ADS-C (Automatic Dependent Surveillance - Contract). JSON output, StatsD metrics, optional SQLite aircraft database.

**Relevance**: Higher-value digital aviation intel than ACARS. Pairs naturally with acarsdec. Same frequency range, different protocol. JSON output integrates easily into Argos.

---

### 5. multimon-ng

> **Multi-protocol decoder: POCSAG, FLEX, EAS, DTMF, AFSK, ZVEI, Morse, and more**

| Field           | Details                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/EliasOenal/multimon-ng                                                |
| **Stars**       | 1,077                                                                                    |
| **License**     | GPL-2.0                                                                                  |
| **Language**    | C                                                                                        |
| **Docker**      | `boxel/multimon-ng:latest` — community arm64 image                                       |
| **SDR Support** | None direct — audio pipe model. Pipe from `rtl_fm`, `hackrf_transfer`, `sox`, or any SDR |
| **ARM64**       | YES — `apt-get install multimon-ng` on Kali/Debian                                       |

**What it does**: Swiss-army decoder for analog and low-data-rate digital signals. Pipe audio from any SDR and it decodes: POCSAG pagers (512/1200/2400), FLEX pagers, EAS Emergency Alerts, DTMF touch-tones, AFSK1200 (APRS packets), ZVEI/CCIR/EEA/EIA paging, FSK9600, Morse CW, X10 home automation, FMS.

**Relevance**: Covers signals that rtl-433 doesn't — pagers (still used at military bases, hospitals), APRS, emergency alerts. Trivially installable via apt.

---

### 6. SigMF (Signal Metadata Format)

> **Standardized metadata format for IQ signal recordings**

| Field               | Details                                 |
| ------------------- | --------------------------------------- |
| **GitHub (spec)**   | https://github.com/sigmf/SigMF          |
| **GitHub (python)** | https://github.com/sigmf/sigmf-python   |
| **Stars**           | 431 + 60                                |
| **License**         | Open source                             |
| **Language**        | Spec + Python library                   |
| **Docker**          | N/A — `pip install sigmf`               |
| **SDR Support**     | N/A — metadata library, not an SDR tool |
| **ARM64**           | YES — pure Python, platform-independent |

**What it does**: Industry standard JSON sidecar format for annotating IQ recordings with metadata: center frequency, sample rate, hardware used, signal annotations, timestamps. Think "EXIF for RF recordings."

**Relevance**: Makes IQ recordings interoperable with FISSURE, IQEngine, and other tools. Adopt as standard for all Argos IQ captures. `pip install sigmf` — zero effort.

---

### 7. OP25

> **Open source P25 trunked radio decoder with real-time audio and web UI**

| Field           | Details                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/boatbod/op25                                                              |
| **Stars**       | 431                                                                                          |
| **License**     | GPL-3.0                                                                                      |
| **Language**    | Python / C++ (GNU Radio OOT module)                                                          |
| **Docker**      | `zentec/op25` — community arm64/v8 tags (snapshot builds, e.g. `arm64_202505081148_3fe1908`) |
| **SDR Support** | HackRF, RTL-SDR, USRP, Airspy (all via gr-osmosdr)                                           |
| **ARM64**       | YES — RPi 3B+ install documented; `install.sh` targets Raspbian/Debian                       |

**What it does**: Real-time P25 Phase I/II decoding with live audio output. Follows trunking control channels, shows active talkgroups, detects encrypted channels. Includes web-based UI for monitoring. TDMA support.

**Relevance**: Complements trunk-recorder. trunk-recorder is better for recording everything unattended; OP25 is better for live interactive monitoring with its web UI. Both handle P25, different operational modes.

---

### 8. SoapyRemote

> **Stream any SoapySDR device over the network**

| Field           | Details                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/pothosware/SoapyRemote                                        |
| **Stars**       | 142                                                                              |
| **License**     | Boost                                                                            |
| **Language**    | C++                                                                              |
| **Docker**      | None official — custom Dockerfile needed (simple: CMake + SoapySDR)              |
| **SDR Support** | ALL SoapySDR devices — HackRF, RTL-SDR, USRP, Airspy, BladeRF, LimeSDR, PlutoSDR |
| **ARM64**       | YES — Debian packages `Architecture: any`; SoapySDR confirmed on RPi ARM64       |

**What it does**: Makes any SDR available over the network. Run SDR hardware on one device, process IQ data on another. Low-latency TCP/UDP streaming. Automatic device discovery via Avahi/mDNS.

**Relevance**: Enables future multi-node Argos deployments — SDR at a remote observation post, processing back at the TOC. Not needed for single-node but valuable infrastructure for scaling.

---

### 9. gr-iridium

> **Iridium satellite burst detector and demodulator**

| Field           | Details                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **GitHub**      | https://github.com/muccc/gr-iridium                                                              |
| **Stars**       | 457                                                                                              |
| **License**     | GPL-3.0                                                                                          |
| **Language**    | Python / C++ (GNU Radio OOT)                                                                     |
| **Docker**      | None official — `thebiggerguy/gr-iridium` (community, 125 pulls)                                 |
| **SDR Support** | HackRF (best), USRP, RTL-SDR (limited — bandwidth too narrow), SoapySDR                          |
| **ARM64**       | YES — README documents "Ubuntu 22.04 on Raspberry Pi 4 (from source)" with ARM optimization tips |

**What it does**: Detects and demodulates Iridium satellite bursts at 1626 MHz. Combined with `iridium-toolkit`, decodes pager messages, position information, and ring alerts from the Iridium satellite constellation. Needs 10+ MSPS bandwidth — HackRF (20 MSPS) is ideal, RTL-SDR (2.4 MSPS) too narrow.

**Relevance**: Iridium is used by military/government for satellite communications. HackRF covers 1626 MHz. Provides satellite SIGINT capability. Computationally intensive on RPi — use `--samples_per_symbol` flag for ARM optimization.

---

### 10. osmo-tetra

> **TETRA protocol decoder with voice and SDS message decoding**

| Field           | Details                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/sq5bpf/osmo-tetra-sq5bpf                                              |
| **Stars**       | 59                                                                                       |
| **License**     | GPL (Osmocom)                                                                            |
| **Language**    | C                                                                                        |
| **Docker**      | None current — stale community image from 2015 (ignore it)                               |
| **SDR Support** | Any SDR via GNU Radio demodulator (USRP, RTL-SDR typical); also SDR++ TETRA plugin       |
| **ARM64**       | YES (likely) — pure C with Makefile, needs libosmocore (available in Debian ARM64 repos) |

**What it does**: Decodes TETRA (Terrestrial Trunked Radio) digital radio: voice, SDS (Short Data Service) text messages, and control channels. Companion tool `telive` provides display interface. TETRA operates at 380-400 MHz (EU emergency) and 410-430 MHz.

**Relevance**: TETRA is the European military/emergency radio standard. Relevant at JMRC (Germany) and NATO exercises. Not used in the US (NTC uses P25). Install if deploying to European exercises.

---

### 11. gr-satellites

> **GNU Radio decoder for 100+ amateur and research satellites**

| Field           | Details                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| **GitHub**      | https://github.com/daniestevez/gr-satellites                               |
| **Stars**       | 910                                                                        |
| **License**     | GPL-3.0                                                                    |
| **Language**    | Python / C++ (GNU Radio OOT)                                               |
| **Docker**      | None current — stale community image (v1.8 on Ubuntu 19.10, ignore it)     |
| **SDR Support** | Any GNU Radio source block — HackRF, RTL-SDR, USRP, Airspy, SoapySDR       |
| **ARM64**       | YES (likely) — Debian `Architecture: any`; standard GNU Radio OOT patterns |

**What it does**: Decodes telemetry from 100+ satellites: CCSDS, AX.25, GOMspace modems, FUNcube protocol, and many ad-hoc protocols. Shows what satellites are transmitting overhead. Can decode amateur satellite beacons, weather satellite data, and research telemetry.

**Relevance**: Provides overhead signals awareness — know what's transmitting from space above your AO. HackRF covers satellite downlink frequencies. Lower priority than aviation/trunked radio tools but adds a unique SIGINT dimension.

---

## Tools Removed from Consideration

The following tools from the original research were evaluated and **removed**:

| Tool               | Reason Removed                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| python_hackrf      | **INTEGRATED** (v1.5.0.1) — replaced pyhackrf in `hackrf_emitter/backend/requirements.txt`; native API for device detection, transmission, and sweep |
| intercept          | Removed from final list                                                                                                                              |
| SDRAngel           | x86 mainly, heavy Qt GUI, duplicates Argos web approach                                                                                              |
| IQEngine           | Post-mission only; Argos already has spectrum visualization                                                                                          |
| spectre            | Partially covered by HackRF sweep; lower priority                                                                                                    |
| dumphfdl           | VHF tools (acarsdec/dumpvdl2) cover most use cases first                                                                                             |
| ShinySDR           | Dead project since 2020                                                                                                                              |
| SIGpi              | Reference only, not a tool — it's an installer script                                                                                                |
| gr-correctiq       | Only for GNU Radio flowgraphs, not needed                                                                                                            |
| meshing-around     | Meshtastic automation, lower priority                                                                                                                |
| gr-dsd             | dsd-neo does same thing without GNU Radio                                                                                                            |
| gr-smart_meters    | Very niche, rtl-433 covers most of these                                                                                                             |
| gr-dect2           | Most modern DECT encrypted, niche                                                                                                                    |
| gr-nrsc5           | HD Radio not relevant to EW training                                                                                                                 |
| WHAD               | HackRF support experimental; dedicated BLE/Zigbee tools exist                                                                                        |
| gnss-sdr           | Computationally brutal on RPi 5                                                                                                                      |
| NRF24-BTLE-Decoder | HackRF weak at 2.4 GHz; dedicated BLE tools exist                                                                                                    |

---

## Tools Already Present (folders 01-15)

| Tool                        | Existing Location                             |
| --------------------------- | --------------------------------------------- |
| FISSURE                     | `08-sdr-frameworks/fissure.md`                |
| AIS-catcher                 | `09-aircraft-ship-tracking/ais-catcher.md`    |
| dump1090 / readsb / tar1090 | `09-aircraft-ship-tracking/`                  |
| Kismet                      | `14-wardriving/kismet.md`                     |
| Sparrow-WiFi                | `14-wardriving/sparrow-wifi.md`               |
| RFSec-ToolKit               | `08-sdr-frameworks/rfsec-toolkit.md`          |
| QSpectrumAnalyzer           | `08-sdr-frameworks/qspectrumanalyzer.md`      |
| OpenWebRX                   | `08-sdr-frameworks/openwebrx.md`              |
| Universal Radio Hacker      | `08-sdr-frameworks/universal-radio-hacker.md` |
| Inspectrum                  | `08-sdr-frameworks/inspectrum.md`             |
| Bettercap                   | `11-network-recon/bettercap.md`               |
| gr-gsm                      | `02-cellular-attacks/imsi-catching/gr-gsm.md` |
| rtl-433                     | `04-iot-exploits/rtl-433.md`                  |

---

_Research conducted 2026-02-05 using GitHub code search, GitHub repository search, and Docker Hub verification. All GitHub links verified active. acarsdec original archived — replaced with active fork f00b4r0/acarsdec._
