# GQRX

## Status: REMOVED — Dead Software for Argos

## Reason for Removal

GQRX is a native Qt5/Qt6 desktop application requiring X11 display server and GNU Radio (8+ subcomponents). It has:

- **No web interface** — cannot be served through Argos web UI
- **No Docker support** — no Dockerfile in the repo
- **No headless mode** — fundamentally a GUI-only application
- **Massive dependency chain** — GNU Radio + Qt + gr-osmosdr on ARM64

## Already Covered By

- **OpenWebRX** — web-native SDR receiver, already installed on Argos
- **HackRF Spectrum** — Argos built-in, web-native spectrum analyzer
- **USRP Sweep** — Argos built-in, web-native spectrum analysis

## Repository

https://github.com/gqrx-sdr/gqrx

## Deployment Classification

**Incompatible** — Qt GUI desktop app, no path to web UI integration on RPi 5
