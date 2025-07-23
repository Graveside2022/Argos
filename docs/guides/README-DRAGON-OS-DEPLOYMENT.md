# 🐉 Argos Dragon OS Deployment Guide

## Quick Start - Copy and Deploy

Your Argos project is now **100% portable** and ready for Dragon OS deployment. Here's how to make it "just work" on any new Dragon OS Raspberry Pi:

## 🚀 Step 1: Copy Project to New Pi

```bash
# Copy entire project folder to new Dragon OS Pi
scp -r /home/ubuntu/projects/Argos pi@dragon-pi-ip:/home/pi/projects/
```

## 🔧 Step 2: Fix Paths for New User

```bash
# On the new Dragon OS Pi
cd /home/pi/projects/Argos

# Fix all hardcoded paths for current user
bash fix-hardcoded-paths.sh

# This automatically detects current user and fixes all references
```

## 📦 Step 3: Deploy Everything

```bash
# Run the universal deployment script
bash deploy-dragon-os.sh

# This script automatically:
# - Detects Dragon OS and current user
# - Installs all dependencies
# - Configures hardware permissions
# - Builds native components
# - Sets up services
# - Configures firewall
# - Starts everything
```

## ✅ Step 4: Verify Deployment

```bash
# Run comprehensive verification
bash verify-deployment.sh

# This tests:
# - System compatibility
# - Dependencies
# - Hardware access
# - Services
# - Web interfaces
# - Performance
```

## 🎯 Access Your Deployment

After successful deployment:

- **Main Console**: http://localhost:5173
- **OpenWebRX**: http://localhost:8073
- **Service Logs**: `sudo journalctl -u argos -f`

## 🔑 Key Features

### Universal Compatibility
- ✅ **Auto-detects Dragon OS** vs standard Linux
- ✅ **Any user** (pi, ubuntu, dragon, etc.)
- ✅ **Any home directory** structure
- ✅ **Preserves existing SDR tools** on Dragon OS

### Hardware Support
- ✅ **HackRF One** with proper permissions
- ✅ **GPS dongles** with device symlinks
- ✅ **WiFi adapters** (MediaTek, etc.)
- ✅ **Coral TPU** support

### Robust Installation
- ✅ **Dependency management** (Node.js, Docker, etc.)
- ✅ **Native compilation** (kalibrate-hackrf, etc.)
- ✅ **Service management** (systemd)
- ✅ **Firewall configuration**

## 🛠️ Troubleshooting

### If Deployment Fails
1. Check logs: `tail -f /home/$(whoami)/projects/argos-dragon-deploy.log`
2. Run verification: `bash verify-deployment.sh`
3. Check service status: `sudo systemctl status argos`

### Hardware Issues
1. Check HackRF: `hackrf_info`
2. Check permissions: `groups $(whoami)`
3. Check USB rules: `ls -la /etc/udev/rules.d/`

### Service Issues
1. Restart services: `sudo systemctl restart argos`
2. Check Docker: `sudo docker ps`
3. Check ports: `netstat -ln | grep 5173`

## 📋 Pre-Deployment Checklist

Before copying to new Pi, ensure:
- [ ] All hardware is connected (HackRF, GPS, WiFi adapter)
- [ ] Dragon OS is fully booted and updated
- [ ] SSH access is working
- [ ] User has sudo privileges
- [ ] Internet connection is available

## 🔄 Updates and Maintenance

### Update Argos
```bash
cd /home/$(whoami)/projects/Argos
git pull origin main
npm run build
sudo systemctl restart argos
```

### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### Backup Configuration
```bash
# Backup your deployment
tar -czf argos-backup-$(date +%Y%m%d).tar.gz /home/$(whoami)/projects/Argos
```

## 🎉 Success!

Your Argos deployment is now:
- **Portable** across any Dragon OS system
- **Self-configuring** for any user
- **Hardware-optimized** for SDR operations
- **Production-ready** with monitoring and logging

The deployment scripts handle all the complexity - just copy, run, and go! 🚀