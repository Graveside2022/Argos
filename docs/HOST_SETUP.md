# Argos Host System Setup Guide

This guide documents all host system (Kali Linux) dependencies required for Argos hardware to function properly.

## Overview

Argos runs in Docker containers, but **hardware access requires host system configuration**:

- USB device permissions (udev rules)
- Hardware drivers (HackRF, USRP, GPS, WiFi adapters)
- SDR tools (gr-gsm, kalibrate, SoapySDR)
- System packages (libusb, fftw, etc.)

## Quick Start

Run the master setup script (requires sudo):

```bash
sudo ./scripts/setup-host-complete.sh
```

This installs all dependencies for:

- Docker & Portainer
- HackRF One
- USRP (optional)
- GPS devices
- Kismet WiFi scanning
- GSM Evil (gr-gsm)
- System optimizations

## Manual Setup by Component

### 1. Docker & Container Runtime

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

### 3. GSM Evil (gr-gsm Tools)

```bash
# Install GNU Radio and gr-gsm
sudo apt install -y gnuradio gr-gsm \
  kalibrate-hackrf kalibrate-rtl

# Install GSM scanning tools
sudo apt install -y libosmocore-dev libosmo-dsp-dev

# Verify gr-gsm installation
grgsm_scanner --help

# Test kalibrate
kal -s GSM900 -g 40
```

**Why needed**: GSM Evil requires gr-gsm (GNU Radio GSM) tools installed on the host to process GSM signals from HackRF/USRP.

**Troubleshooting**:

- If gr-gsm not found: May need to build from source on some systems
- Alternative: `sudo apt install -y gr-gsm` on Kali/Ubuntu

### 4. USRP (Optional, for higher-end SDR)

```bash
# Install UHD drivers
sudo apt install -y libuhd-dev uhd-host

# Download USRP firmware images
sudo uhd_images_downloader

# Install SoapySDR UHD module
sudo apt install -y soapysdr-module-uhd

# Test USRP detection
uhd_find_devices
SoapySDRUtil --find="driver=uhd"
```

**Why needed**: USRP devices require UHD (USRP Hardware Driver) on the host.

### 5. GPS Device Support

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

### 6. Kismet WiFi Scanning

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

### 7. System Optimizations

```bash
# Increase USB buffer size for SDR
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf

# Increase file descriptor limits
echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65536' | sudo tee -a /etc/security/limits.conf

# Apply immediately
sudo sysctl -p

# Disable Bluetooth to free USB power (Raspberry Pi)
echo 'dtoverlay=disable-bt' | sudo tee -a /boot/firmware/config.txt
sudo systemctl disable hciuart bluetooth

# Optimize USB for high-speed devices
echo 'SUBSYSTEM=="usb", ATTR{power/control}="on"' | sudo tee /etc/udev/rules.d/50-usb-power.rules
```

**Why needed**: SDR devices transfer large amounts of data over USB and need optimized buffers and power.

### 8. Argos Auto-Start Service

```bash
# Install startup check service
sudo tee /etc/systemd/system/argos-startup.service <<EOF
[Unit]
Description=Argos Startup Check
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/home/$USER/Documents/Argos/Argos/scripts/startup-check.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable argos-startup.service
```

**Why needed**: Auto-starts containers and checks services after system reboot.

## Hardware Dependencies Summary

| Hardware      | Host Dependencies                     | Test Command       |
| ------------- | ------------------------------------- | ------------------ |
| HackRF One    | hackrf, libhackrf, libusb, udev rules | `hackrf_info`      |
| USRP          | uhd-host, libuhd-dev, firmware images | `uhd_find_devices` |
| GPS           | gpsd, gpsd-clients                    | `cgps`             |
| WiFi Adapters | kismet, wireless drivers              | `iwconfig`         |
| GSM Scanning  | gnuradio, gr-gsm, kalibrate           | `grgsm_scanner`    |

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

## Post-Setup Verification

After completing host setup, verify all components:

```bash
# Verify Docker
docker --version
docker ps

# Verify HackRF
hackrf_info

# Verify GPS
cgps

# Verify Kismet
kismet --version

# Verify gr-gsm (if using GSM Evil)
grgsm_scanner --help

# Verify USRP (if installed)
uhd_find_devices
```

## Next Steps

After host setup is complete:

1. **Deploy Containers**: Run `./scripts/deploy-containers.sh`
2. **Start Application**: Containers auto-start via systemd service
3. **Access Dashboard**: `http://localhost:5173`
4. **Configure Tools**: Each tool in Dashboard → Tools panel

## See Also

- [Container Deployment](../config/openwebrx/README.md)
- [OpenWebRX Configuration](../config/openwebrx/README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- Automated Setup: `scripts/setup-host-complete.sh`
