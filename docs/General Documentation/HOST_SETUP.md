# Argos Host System Setup Guide

This guide documents all host system (Kali Linux) dependencies required for Argos hardware to function properly.

## Overview

Argos runs **natively on Raspberry Pi 5** (Kali Linux), not in Docker. Hardware access requires host system configuration:

- USB device permissions (udev rules)
- Hardware drivers (HackRF, USRP, GPS, WiFi adapters)
- SDR tools (gr-gsm, gr-osmosdr, kalibrate, SoapySDR)
- System packages (libusb, fftw, Node.js 22, etc.)
- Node.js runtime and npm dependencies
- System monitoring and diagnostic tools
- System optimizations (kernel parameters, zram swap, earlyoom)

## Quick Start

Run the interactive setup script (requires sudo):

```bash
sudo bash scripts/ops/setup-host.sh
```

This launches an interactive installer that guides you through component selection:

- **Express mode**: Install all 26 components with one keypress
- **Customize mode**: Choose individual optional components by group
- **Unattended mode**: Use `--yes` flag to skip prompts and install everything

The installation includes 4 groups of components:

**Core Infrastructure (11 components — always installed):**

- Network config (WiFi + DNS fallback)
- System packages (build tools, SDR drivers)
- Node.js 22 (app runtime)
- gpsd (GPS daemon)
- OpenSSH server (remote access)
- SDR udev rules (HackRF, RTL-SDR, USRP)
- SDR infrastructure (SoapySDR + UHD)
- npm dependencies (JavaScript libraries)
- Environment file (.env + API keys)
- EarlyOOM (prevents system freezes)
- cgroup memory limits (runaway process defense)

**SDR & Signal Tools (1 optional component):**

- GSM Evil (cell tower monitoring with gr-gsm)

**Development Tools (6 optional components):**

- Dev monitor (auto-restart dev server)
- Claude Code (AI coding assistant)
- Gemini CLI (Google AI assistant)
- Agent Browser (browser automation)
- ChromaDB (AI memory backend)
- Headless debug service (Chromium remote debugging)

**System Services (8 optional components):**

- Docker (OpenWebRX + Bettercap containers)
- zram compressed swap (4 GB)
- Text-mode boot (disable desktop)
- On-demand VNC (remote desktop)
- Tailscale (secure remote access)
- Zsh + dotfiles (shell environment)
- Set Zsh as default shell
- Persistent tmux sessions

## Installation Methods

### Automatic Installation (Recommended)

The interactive setup script is the recommended approach. It handles all 26 components, environment configuration, and systemd services:

```bash
sudo bash scripts/ops/setup-host.sh          # Express or Customize mode
sudo bash scripts/ops/setup-host.sh --yes    # Unattended mode (install all)
sudo bash scripts/ops/setup-host.sh -v       # Verbose mode (show raw output)
```

### Manual Setup by Component

For isolated troubleshooting or custom installations, individual components can be installed manually.

### 1. Docker & Container Runtime (Optional — System Services group)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Portainer
docker volume create portainer_data
docker run -d --name portainer --restart=always \
  -p 9000:9000 -p 9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

**Why needed**: Containers run the Argos application but need Docker runtime.

### 2. HackRF One SDR

```bash
# Install HackRF packages
sudo apt install -y hackrf libhackrf-dev libhackrf0 \
  libusb-1.0-0-dev libfftw3-dev

# Install SoapySDR for HackRF
sudo apt install -y libsoapysdr-dev soapysdr-tools \
  soapysdr-module-hackrf

# Configure udev rules for USB access
sudo tee /etc/udev/rules.d/53-hackrf.rules <<EOF
SUBSYSTEM=="usb", ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", MODE="0666", GROUP="plugdev"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Add user to plugdev group
sudo usermod -aG plugdev $USER

# Test HackRF detection
hackrf_info
```

**Why needed**: Containers need host USB access and libhackrf drivers to communicate with HackRF hardware.

**Troubleshooting**:

- If `hackrf_info` fails: Check USB connection and power
- If permission denied: Logout and login after adding to plugdev group
- Check device: `lsusb | grep HackRF`

### 3. Node.js Runtime (Core Infrastructure group)

```bash
# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Why needed**: Argos application requires Node.js 22+ runtime. The setup script installs this automatically.

### 4. Docker Compose

```bash
# Install Docker Compose
DOCKER_COMPOSE_VERSION="2.24.0"
sudo curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

**Why needed**: Multi-container orchestration for Argos services.

### 5. GSM Evil (Optional — SDR & Signal Tools group)

```bash
# Install GNU Radio, gr-gsm, and gr-osmosdr - ALL REQUIRED
sudo apt install -y gnuradio gr-gsm gr-osmosdr \
  kalibrate-hackrf kalibrate-rtl

# Install Osmocom libraries - REQUIRED for GSM Evil
sudo apt install -y libosmocore-dev libosmo-dsp-dev

# Install Python Flask ecosystem for GSM backend
sudo apt install -y python3-flask python3-flask-socketio python3-flask-cors
# OR via pip:
pip3 install Flask Flask-SocketIO Flask-CORS pyshark werkzeug

# Verify gr-gsm installation
grgsm_scanner --help

# Verify gr-osmosdr
python3 -c "import osmosdr"

# Test kalibrate
kal -s GSM900 -g 40
```

**Why needed**:

- gr-gsm: GNU Radio GSM decoder for processing GSM signals from HackRF/USRP
- gr-osmosdr: SDR abstraction layer for various hardware backends
- libosmocore/libosmo-dsp: Core Osmocom libraries for GSM protocol handling
- Flask: Python web framework for GSM Evil backend API

**Troubleshooting**:

- If gr-gsm not found: May need to build from source on some systems
- If gr-osmosdr fails: Check `sudo apt install -y libosmocore-dev`
- If Flask missing: Install via pip as shown above
- Alternative: Manual build from https://github.com/ptrkrysik/gr-gsm

### 6. USRP (Optional, for higher-end SDR)

```bash
# Install UHD drivers with Python bindings
sudo apt install -y libuhd-dev uhd-host soapysdr-module-uhd python3-uhd

# Download USRP firmware images (can take time)
sudo uhd_images_downloader

# Test USRP detection
uhd_find_devices
SoapySDRUtil --find="driver=uhd"

# Verify Python bindings
python3 -c "import uhd"
```

**Why needed**: USRP devices require UHD (USRP Hardware Driver) on the host. Python bindings enable programmatic control.

### 7. GPS Device Support

```bash
# Install gpsd
sudo apt install -y gpsd gpsd-clients

# Configure gpsd for USB auto-detection
sudo tee /etc/default/gpsd <<EOF
DEVICES=""
GPSD_OPTIONS=""
USBAUTO="true"
START_DAEMON="true"
EOF

# Enable and start gpsd
sudo systemctl enable gpsd
sudo systemctl restart gpsd

# Test GPS
gpsmon
cgps
```

**Why needed**: GPS coordinates for signal geolocation require gpsd daemon on the host.

**Troubleshooting**:

- Check GPS device: `ls /dev/ttyACM* /dev/ttyUSB*`
- Test manually: `gpsd -N -D 5 /dev/ttyACM0`

### 8. Kismet WiFi Scanning

```bash
# Add Kismet repository
wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | sudo apt-key add -
echo "deb https://www.kismetwireless.net/repos/apt/release/$(lsb_release -cs) $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/kismet.list

# Install Kismet
sudo apt update
sudo apt install -y kismet

# Add user to kismet group
sudo usermod -aG kismet $USER

# Configure WiFi adapter
# (Kismet auto-detects adapters, but verify in /etc/kismet/kismet.conf)
```

**Why needed**: Kismet requires direct access to WiFi adapters on the host.

**Troubleshooting**:

- Check WiFi adapters: `iwconfig`
- Test monitor mode: `sudo iw dev wlan0 set monitor none`

### 9. Extended Radio Tools (Optional)

```bash
# Install RTL-SDR tools
sudo apt install -y rtl-sdr

# Install multimon-ng (digital signal decoder)
sudo apt install -y multimon-ng

# Install GUI SDR tools (if on desktop system)
sudo apt install -y gqrx-sdr cubicsdr

# Test RTL-SDR
rtl_test -t

# Test multimon-ng
multimon-ng --help
```

**Why needed**: Extended support for RTL-SDR dongles and additional digital signal decoding capabilities.

**Tools included**:

- rtl-sdr: Cheap USB SDR dongle support (RTL2832U chipset)
- multimon-ng: Decode POCSAG, FLEX, EAS, UFSK, CLIPL, AFSK, etc.
- gqrx-sdr: GUI spectrum analyzer and receiver
- cubicsdr: Cross-platform SDR application

### 10. System Monitoring & Diagnostics (Optional)

```bash
# Install network monitoring tools
sudo apt install -y iotop nethogs iftop nload bmon vnstat tcpdump wireshark-common

# Install system analysis tools
sudo apt install -y lsof strace

# Install WiFi security tools
sudo apt install -y aircrack-ng

# Install modern CLI utilities
sudo apt install -y ripgrep fd-find bat exa fzf ncdu btop
```

**Why needed**: Troubleshooting hardware issues, monitoring system resources, analyzing network traffic.

**Tools included**:

- Network: iotop, nethogs, iftop, nload, bmon, vnstat, tcpdump
- System: lsof, strace, btop, ncdu
- WiFi: aircrack-ng (packet capture and analysis)
- CLI: ripgrep (fast grep), fd-find (fast find), bat (cat with syntax highlighting)

### 11. Python Development Packages

```bash
# Upgrade pip
sudo pip3 install --upgrade pip

# Install core packages
sudo pip3 install virtualenv setuptools wheel psutil requests pyyaml jinja2

# Install scientific computing
sudo pip3 install numpy scipy

# Install hardware interfacing
sudo pip3 install pyserial python-dotenv eventlet
```

**Why needed**: Python packages required for backend services, data analysis, and hardware control.

### 12. System Optimizations (COMPLETE)

```bash
# Complete kernel parameter tuning
sudo tee -a /etc/sysctl.conf <<'EOF'
# Argos System Optimizations
vm.max_map_count=262144               # USB buffer sizes for SDR
net.core.rmem_max = 16777216          # Network receive buffer
net.core.wmem_max = 16777216          # Network send buffer
net.core.netdev_max_backlog = 5000    # Network queue depth
vm.swappiness = 10                    # Reduce swap usage
fs.file-max = 65536                   # File descriptor limit
EOF

# File descriptor limits
sudo tee -a /etc/security/limits.conf <<'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

# SystemD limits
sudo mkdir -p /etc/systemd/system.conf.d
sudo tee /etc/systemd/system.conf.d/limits.conf <<'EOF'
[Manager]
DefaultLimitNOFILE=65536
EOF

# Apply kernel parameters immediately
sudo sysctl -p

# USB power optimization
sudo tee /etc/udev/rules.d/50-usb-power.rules <<'EOF'
SUBSYSTEM=="usb", ATTR{power/control}="on"
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger

# Disable Bluetooth to free USB power (Raspberry Pi only)
if [ -f /boot/firmware/config.txt ]; then
  echo 'dtoverlay=disable-bt' | sudo tee -a /boot/firmware/config.txt
  sudo systemctl disable hciuart bluetooth
fi
```

**Why needed**:

- USB buffers: SDR devices transfer large amounts of data over USB
- Network buffers: High-throughput WebSocket connections and data streaming
- File descriptors: Multiple concurrent connections and file handles
- USB power: Keep SDR devices from power-saving modes
- Bluetooth disable: Free USB power budget on Raspberry Pi

### 13. Argos Systemd Services (Automated)

Systemd service files are installed automatically by the setup script (located in `deployment/`). They include:

- `argos-final` — Main Argos application service
- `argos-headless` — Headless debug service (port 9224)
- `chroma-server` — ChromaDB vector database (if Claude Code selected)
- `argos-dev-monitor` — Dev server auto-restart monitor (if Dev Monitor selected)

**Why needed**: Auto-starts services after system reboot with proper resource limits and dependencies.

## Hardware Dependencies Summary

| Component         | Host Dependencies                                           | Test Command                |
| ----------------- | ----------------------------------------------------------- | --------------------------- |
| HackRF One        | hackrf, libhackrf, SoapySDR, udev rules                     | `hackrf_info`               |
| USRP              | uhd-host, libuhd-dev, python3-uhd, firmware                 | `uhd_find_devices`          |
| GPS               | gpsd, gpsd-clients                                          | `cgps`                      |
| WiFi Adapters     | kismet, wireless drivers                                    | `iwconfig`                  |
| GSM Evil          | gnuradio, gr-gsm, gr-osmosdr, kalibrate, libosmocore, Flask | `grgsm_scanner`             |
| RTL-SDR           | rtl-sdr tools                                               | `rtl_test -t`               |
| Node.js           | nodejs, npm                                                 | `node --version`            |
| Docker            | docker-ce, docker-compose                                   | `docker --version`          |
| Python Backend    | Flask, Flask-SocketIO, numpy, scipy, pyserial               | `python3 -c "import flask"` |
| System Monitoring | iotop, nethogs, tcpdump, aircrack-ng, btop                  | `nethogs --version`         |

## Common Issues

### "Permission denied" errors for USB devices

- Cause: User not in plugdev/dialout group or udev rules not loaded
- Fix: `sudo usermod -aG plugdev,dialout $USER` then logout/login
- Verify: `groups` should show plugdev

### HackRF not detected in container

- Cause: Container needs `--device /dev/bus/usb` and `--privileged`
- Fix: Check container deployment includes USB device passthrough
- Test: `docker exec openwebrx-hackrf hackrf_info`

### GSM Evil missing gr-gsm tools

- Cause: gr-gsm not installed on host
- Fix: `sudo apt install -y gnuradio gr-gsm kalibrate-hackrf`
- Test: `grgsm_scanner --help`

### GPS not providing coordinates

- Cause: gpsd not configured for USB auto-detection
- Fix: Set `USBAUTO="true"` in `/etc/default/gpsd`
- Test: `gpsmon` should show satellites

### Kismet can't access WiFi adapter

- Cause: User not in kismet group or adapter in use
- Fix: `sudo usermod -aG kismet $USER`
- Check: `sudo kismet -c wlan0` (replace wlan0 with your adapter)

### gr-osmosdr Python bindings missing

- Cause: gr-osmosdr installed but Python module not found
- Fix: `sudo apt install -y gr-osmosdr` or rebuild from source
- Test: `python3 -c "import osmosdr"`
- Alternative: Build from https://github.com/osmocom/gr-osmosdr

### Python Flask not found for GSM Evil backend

- Cause: Flask ecosystem not installed via apt or pip
- Fix (via apt): `sudo apt install -y python3-flask python3-flask-socketio`
- Fix (via pip): `pip3 install Flask Flask-SocketIO Flask-CORS pyshark`
- Test: `python3 -c "import flask; import flask_socketio"`

### libosmocore-dev installation fails

- Cause: Osmocom packages not available in distribution repositories
- Fix: Build from source:
    ```bash
    git clone https://gitea.osmocom.org/osmocom/libosmocore
    cd libosmocore
    autoreconf -fi && ./configure && make && sudo make install
    ```
- Documentation: https://osmocom.org/projects/libosmocore/wiki

### Node.js version mismatch

- Cause: System has old Node.js version
- Fix: Install from NodeSource repository:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt install -y nodejs
    ```
- Verify: `node --version` should show v20.x.x

### Docker Compose not found

- Cause: Docker Compose not installed or not in PATH
- Fix: Download binary manually:
    ```bash
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    ```
- Verify: `docker-compose --version`

## Post-Setup Verification

After completing host setup, verify all components:

```bash
# Core Infrastructure
node --version                    # Should show v20.x.x
npm --version
docker --version
docker-compose --version
docker ps                         # Should show running containers

# SDR Hardware
hackrf_info                       # Should detect HackRF One
uhd_find_devices                  # USRP (optional)
rtl_test -t                       # RTL-SDR (optional)

# GSM Evil (CRITICAL - all must pass)
grgsm_scanner --help              # gr-gsm command line tool
python3 -c "import osmosdr"       # gr-osmosdr Python bindings
python3 -c "import flask"         # Flask for backend
kal -h                            # kalibrate frequency tool

# GPS
cgps                              # Should show satellites
gpsd -V                           # gpsd version

# Kismet
kismet --version
iwconfig                          # Show WiFi adapters

# Python Packages
python3 -c "import numpy, scipy, flask, serial"

# System Groups (after logout/login)
groups                            # Should show: docker, plugdev, kismet, dialout
```

## Next Steps

After `setup-host.sh` completes:

1. **Edit .env**: Configure API keys (optional):

    ```bash
    nano .env
    ```

    - `STADIA_MAPS_API_KEY` — Vector map tiles (stadiamaps.com)
    - `OPENCELLID_API_KEY` — Cell tower database (opencellid.org)

2. **Start Application**:

    ```bash
    npm run dev
    ```

3. **Access Dashboard**: Open `http://<pi-ip>:5173` in your browser

4. **Optional: Download Cell Tower Database**:
    ```bash
    bash scripts/ops/import-celltowers.sh
    ```

## Troubleshooting

If the setup script fails:

1. Check error messages — most failures are due to missing dependencies
2. Run with verbose mode: `sudo bash scripts/ops/setup-host.sh -v`
3. Install Node.js manually: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -`
4. Verify OS: Kali Linux or Parrot OS recommended (Raspberry Pi 5 or x86)

## See Also

- [README.md](../../README.md) — Installation quick start
- [CODEBASE_MAP.md](../CODEBASE_MAP.md) — Project structure and architecture
- [API Authentication](./security-architecture.md) — API key and auth details
