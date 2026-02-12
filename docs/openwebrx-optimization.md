# OpenWebRX Optimization for HackRF One

## Research Summary

Deep web research conducted on 2026-02-12 to optimize OpenWebRX configuration for tactical Army EW training applications.

### HackRF One Gain Architecture

The HackRF One has three independent receive gain stages:

1. **RF Amplifier**: Binary on/off (~11 dB when enabled)
    - Should be **OFF** for most applications
    - Only enable for extremely weak signals
    - When on, increases noise floor and risk of overload

2. **IF/LNA Gain**: 0-40 dB in 8 dB steps
    - **Most critical gain stage** for SNR optimization
    - Default: 16 dB (good baseline for general use)
    - Adjust based on signal strength

3. **Baseband/VGA Gain**: 0-62 dB in 2 dB steps
    - Fine-tuning for ADC input levels
    - Default: 16 dB (optimal starting point)
    - Prevents ADC saturation

### Optimized Settings Applied

```json
{
	"rf_gain": 0, // RF amp OFF (was "auto")
	"lna_gain": 16, // IF/LNA at baseline
	"vga_gain": 16, // VGA at baseline
	"amp": false, // Explicit RF amp disable
	"bot_ban_enabled": false // Disable anti-bot for single-operator use
}
```

**Total receive gain**: ~32 dB (without RF amp)

**Bot ban disabled**: Single-operator tactical system doesn't need robot detection (prevents false positives during rapid reconnections)

### Tactical Frequency Profiles

Expanded from 4 profiles to **11 tactical profiles** covering military EW training scenarios:

#### HF Bands (NVIS/Long-Range Communications)

- **80m (3.65 MHz)**: NVIS propagation, tactical HF
- **40m (7.1 MHz)**: Regional HF communications
- **20m (14.15 MHz)**: Long-range HF, existing profile retained

#### VHF Military Spectrum

- **VHF Military (55 MHz)**: 30-88 MHz tactical VHF monitoring
- **FM Broadcast (98 MHz)**: Commercial FM for situational awareness
- **VHF Airband (121.5 MHz)**: Aviation communications monitoring

#### UHF Tactical Spectrum

- **UHF Military (312.5 MHz)**: 225-400 MHz military UHF band
- **ISM 433 MHz**: Common tactical radio band
- **UHF PMR446 (446 MHz)**: PMR/FRS tactical communications
- **ISM 900 MHz**: Sensor networks, telemetry

#### General Purpose

- **Wideband (100 MHz)**: General spectrum monitoring

### Technical Rationale

1. **RF Amp Disabled**: Prevents frontend overload in field environments with strong signals
2. **Fixed Gain Values**: More predictable than "auto" mode for tactical operations
3. **20 MHz Sample Rate**: Optimal for HackRF One (maximum stable rate)
4. **Profile Coverage**: Addresses SIGINT collection requirements across HF/VHF/UHF tactical bands

### Configuration Location

- **Container Path**: `/var/lib/openwebrx/settings.json`
- **Docker Volume**: `openwebrx-hackrf-settings`
- **Host Path**: `/var/lib/docker/volumes/openwebrx-hackrf-settings/_data/`

### Applied Changes

- Fixed out-of-range start_freq warnings
- Changed rf_gain from "auto" to explicit 0
- Added 7 new tactical frequency profiles
- Maintained 20 MHz sample rate (HackRF optimal)

### Verification

```bash
# Check configuration loaded
docker logs openwebrx-hackrf 2>&1 | grep "Ready to serve"

# Access OpenWebRX
http://localhost:8073

# Credentials
Username: admin
Password: password
```

### Future Tuning

Gain adjustments should be made per-profile based on:

- Signal environment (urban vs rural)
- Target signal strength
- Desired dynamic range
- Noise floor characteristics

**Field operators**: Start with these baseline settings, adjust IF/LNA gain first if signals are weak/strong.

---

**Date Applied**: 2026-02-13
**Research Agent**: Claude Sonnet 4.5
**Verification**: OpenWebRX container restarted successfully, no configuration errors
