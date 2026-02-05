# SDR Frameworks & Spectrum Analysis

Software-defined radio frameworks for wideband spectrum monitoring, signal detection, classification, protocol analysis, demodulation, and RF transmission.

---

## Installed on Argos (6)

| Tool                       | Type              | Description                                                                                                             |
| -------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **HackRF Spectrum**        | Spectrum Analysis | Argos built-in wideband spectrum analyzer - uses hackrf_sweep for 8 GHz/sec scanning, waterfall display, signal hunting |
| **RF Emitter**             | RF Transmission   | Argos built-in HackRF signal transmission and RF testing module                                                         |
| **USRP Sweep**             | Spectrum Analysis | Argos built-in USRP wideband spectrum sweep analyzer                                                                    |
| **OpenWebRX**              | SDR Web Interface | Web-based SDR interface for HackRF spectrum analysis - remote monitoring via browser                                    |
| **Universal Radio Hacker** | Protocol Analysis | Complete wireless protocol investigation - demodulation, analysis, attack tools, supports all SDR hardware              |
| **RFSec-ToolKit**          | RF Reference      | Collection of RF security research tools and resources                                                                  |

---

## Available for Integration (3)

| Tool              | Repository                          | Capabilities                                                                                                                                           | Argos Integration                                                    | Maturity                         |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------- |
| FISSURE           | github.com/ainfosec/FISSURE         | **Comprehensive RF framework** - signal detection, classification, protocol discovery, attack execution, fuzzing, TAK integration, 100+ attack scripts | **VERY HIGH** - Python, TAK integration, modular, covers 24-6000 MHz | MATURE (1871 stars, gov/mil use) |
| QSpectrumAnalyzer | github.com/xmikos/qspectrumanalyzer | Real-time spectrum analyzer GUI using hackrf_sweep or rtl_power - waterfall display, peak detection                                                    | **MEDIUM** - Qt-based, can extract data                              | MATURE                           |
| Inspectrum        | github.com/miek/inspectrum          | RF signal analysis tool - visualize and decode recorded RF signals, drag-to-measure, demodulation                                                      | **MEDIUM** - GUI analysis tool                                       | MATURE                           |

## Hardware Requirements

- HackRF One (installed - HackRF Spectrum, RF Emitter, OpenWebRX)
- USRP (installed - USRP Sweep)
- RTL-SDR (QSpectrumAnalyzer, Inspectrum)

## Priority Note

**FISSURE** is the #1 priority integration target - all-in-one RF framework with TAK integration, 100+ attack scripts, signal classification, and protocol discovery. Already used in government/military contexts.
