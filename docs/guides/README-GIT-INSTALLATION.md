# 🚀 Argos Git Installation Guide

## One-Command Installation from Git

Your Argos project now supports **complete installation from git clone** on Dragon OS or any Debian/Ubuntu system.

## 📦 Quick Start

```bash
# Clone the repository
git clone https://github.com/Graveside2022/Argos.git
cd Argos

# Install everything
bash scripts/install/install-from-git.sh

# System will prompt for OpenCellID API key during installation
```

That's it! Your complete Argos system will be ready to use.

## 🎯 What Gets Installed

### Automatic Installation:
- ✅ **System Dependencies** (Node.js 20, Docker, build tools)
- ✅ **SDR Tools** (HackRF, GNU Radio - leverages Dragon OS preinstalled tools)
- ✅ **Hardware Permissions** (HackRF, GPS, WiFi adapters, Coral TPU)
- ✅ **Project Dependencies** (npm packages, native modules)
- ✅ **Native Compilation** (kalibrate-hackrf rebuilt for your system)
- ✅ **Systemd Services** (auto-start on boot)
- ✅ **Firewall Configuration** (UFW rules for all ports)
- ✅ **Environment Setup** (auto-configured for your user)

### Interactive Setup:
- 🔑 **OpenCellID API Key** (setup wizard during installation)
- 🐳 **Docker Image** (download options provided)

### Manual Setup (Optional):
- 📊 **Cell Tower CSV** (for offline cell tower data)

## 🔧 Installation Process

The installation script will:

1. **Detect your system** (Dragon OS, Ubuntu, Debian)
2. **Check prerequisites** (sudo access, internet, disk space)
3. **Install system dependencies** (respects existing Dragon OS tools)
4. **Configure hardware permissions** (udev rules for all devices)
5. **Build native components** (architecture-specific compilation)
6. **Setup services** (systemd integration)
7. **Configure networking** (firewall rules)
8. **Handle missing assets** (Docker image download options)
9. **Run setup wizard** (OpenCellID API key)
10. **Verify installation** (comprehensive testing)

## 📋 Prerequisites

### System Requirements:
- **Dragon OS** (recommended) or **Debian/Ubuntu**
- **3GB+ free disk space**
- **2GB+ RAM** (4GB+ recommended)
- **Internet connection** (for downloading dependencies)
- **sudo privileges**

### Hardware (Optional):
- **HackRF One** (for SDR operations)
- **GPS dongle** (for location services)
- **WiFi adapter** (for wireless analysis)
- **Coral TPU** (for AI features)

## 🎮 After Installation

### Access Your System:
- **Main Console**: http://localhost:5173
- **OpenWebRX**: http://localhost:8073 (if Docker image available)

### Service Management:
```bash
# Check status
sudo systemctl status argos

# View logs
sudo journalctl -u argos -f

# Restart service
sudo systemctl restart argos
```

### Hardware Testing:
```bash
# Test HackRF
hackrf_info

# Check GPS
ls -la /dev/gps*

# Check WiFi
iwconfig
```

## 🔑 OpenCellID Setup

The installation includes an interactive setup wizard for OpenCellID API key:

1. **Get API Key**: Visit https://opencellid.org/register
2. **During Installation**: Enter your API key when prompted
3. **Later Setup**: Run `bash scripts/install/setup-opencellid.sh` anytime

### Features Enabled:
- Cell tower location lookup
- Enhanced GSM analysis
- Geographic mapping of cell towers
- Real-time tower identification

## 🐳 Docker Image Options

If the Docker image isn't available locally, you'll see options:

### Option 1: Download from Releases
```bash
wget https://github.com/Graveside2022/Argos/releases/download/v1.0/openwebrx-hackrf-only-v2.tar
mkdir -p docker-images
mv openwebrx-hackrf-only-v2.tar docker-images/
```

### Option 2: Build from Source
```bash
sudo docker build -t openwebrx-hackrf:latest docker/
```

### Option 3: Skip (Manual Setup Later)
OpenWebRX features will be disabled until Docker image is available.

## 🛠️ Troubleshooting

### Installation Fails:
1. **Check logs**: `tail -f install-from-git.log`
2. **Verify prerequisites**: Ensure sudo access and internet
3. **Check disk space**: Need 3GB+ free space
4. **Retry installation**: Script is idempotent (safe to re-run)

### Service Issues:
1. **Check service status**: `sudo systemctl status argos`
2. **View service logs**: `sudo journalctl -u argos -f`
3. **Restart service**: `sudo systemctl restart argos`

### Hardware Issues:
1. **Check permissions**: `groups $(whoami)` (should include plugdev)
2. **Test HackRF**: `hackrf_info`
3. **Check udev rules**: `ls -la /etc/udev/rules.d/`

### Network Issues:
1. **Check firewall**: `sudo ufw status`
2. **Test ports**: `netstat -ln | grep 5173`
3. **Check binding**: `curl http://localhost:5173`

## 🔄 Updates and Maintenance

### Update Argos:
```bash
cd Argos
git pull origin main
npm run build
sudo systemctl restart argos
```

### Update OpenCellID Config:
```bash
bash scripts/install/setup-opencellid.sh
```

### System Updates:
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # If kernel updated
```

## 📝 Development Mode

For development work:

```bash
# Install in development mode
NODE_ENV=development bash scripts/install/install-from-git.sh

# Start development server
npm run dev
```

## 🎉 Success Indicators

After successful installation:
- ✅ Argos web interface loads at http://localhost:5173
- ✅ Service shows "active (running)": `sudo systemctl status argos`
- ✅ Hardware permissions configured: `groups $(whoami)`
- ✅ OpenCellID configured: `cat config/opencellid.json`
- ✅ No critical errors in logs: `sudo journalctl -u argos --no-pager`

## 🚨 Important Notes

- **Group Permissions**: You may need to logout/login for group changes to take effect
- **Hardware Connection**: Connect your SDR hardware after installation
- **Firewall**: Installation configures UFW firewall rules
- **Auto-Start**: Argos service starts automatically on boot

## 🎯 Next Steps

1. **Connect Hardware**: Plug in HackRF, GPS, WiFi adapters
2. **Test Features**: Try GSM Evil, spectrum analysis, mapping
3. **Configure Advanced Features**: Kismet, WigleToTAK, etc.
4. **Backup Configuration**: Save your OpenCellID config and any customizations

Your Argos system is now ready for professional SDR operations! 🎉