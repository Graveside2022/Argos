# USRP B205 Mini + OpenWebRX Integration - COMPLETE

## ✅ Installation Summary

The USRP B205 Mini has been successfully integrated with OpenWebRX and connected to the Argos tactical platform. The old HackRF container has been replaced with a new USRP-enabled OpenWebRX instance.

## 🔧 What Was Deployed

### 1. OpenWebRX Docker Container with USRP Support
- **Image**: `jketterl/openwebrx-uhd:stable`
- **Container Name**: `openwebrx-usrp`
- **Port**: 8073
- **Status**: Running and healthy

### 2. USRP B205 Mini Configuration
- **Device**: USRP B205-mini (Serial: 32B0765)
- **Driver**: UHD with SoapySDR bridge
- **Sample Rate**: 20 MS/s default
- **USB Interface**: USB 3.0 (Bus 004, Device 004)

### 3. Argos Integration
- **Spectrum Viewer Route**: `/spectrum`
- **Integration Port**: 5173 (Argos development server)
- **OpenWebRX Iframe**: Embedded at `http://localhost:8073`

## 🌐 Access Points

### Direct OpenWebRX Access
```
URL: http://localhost:8073
Admin: http://localhost:8073/admin
Credentials: admin / argos123
```

### Through Argos Platform
```
URL: http://localhost:5173/spectrum
Integration: OpenWebRX embedded in Argos interface
Navigation: Accessible via spectrum mission card
```

## 📁 Files Created

### Scripts
- `scripts/setup-openwebrx-usrp.sh` - Complete USRP setup automation
- `scripts/integrate-openwebrx-argos.sh` - Argos integration script
- `scripts/configure-openwebrx-b205.sh` - USRP device configuration

### Configuration
- `docker-compose-openwebrx-usrp.yml` - Docker deployment configuration
- `openwebrx-config.json` - USRP B205 Mini device profiles
- `src/routes/spectrum/+page.svelte` - Argos spectrum viewer page
- `src/lib/components/navigation/SpectrumLink.svelte` - Navigation component

### System Services
- `/etc/systemd/system/openwebrx-usrp.service` - Auto-start service
- `/etc/udev/rules.d/uhd-usrp.rules` - USB permissions for USRP

## 🚀 Service Management

### Start/Stop OpenWebRX
```bash
# Using Docker Compose
cd /home/ubuntu/projects/Argos
docker compose -f docker-compose-openwebrx-usrp.yml up -d
docker compose -f docker-compose-openwebrx-usrp.yml down

# Using systemd (auto-start enabled)
sudo systemctl start openwebrx-usrp
sudo systemctl stop openwebrx-usrp
sudo systemctl status openwebrx-usrp
```

### View Logs
```bash
docker logs -f openwebrx-usrp
```

## 📡 Device Profiles Configured

### 1. FM Broadcast (100 MHz)
- **Center Frequency**: 100 MHz
- **Sample Rate**: 2.4 MS/s
- **Modulation**: WFM (Wide FM)
- **Use Case**: Commercial FM radio

### 2. VHF Airband (127 MHz)
- **Center Frequency**: 127 MHz  
- **Sample Rate**: 2.4 MS/s
- **Modulation**: AM
- **Use Case**: Air traffic control communications

### 3. UHF (446 MHz)
- **Center Frequency**: 446 MHz
- **Sample Rate**: 2.4 MS/s
- **Modulation**: NFM (Narrow FM)
- **Use Case**: Amateur radio, PMR

## ⚙️ Technical Details

### Hardware Specifications
- **USRP Model**: B205-mini
- **RF Range**: 70 MHz - 6 GHz
- **Max Bandwidth**: 56 MHz
- **ADC/DAC**: 12-bit, up to 61.44 MS/s
- **Interface**: USB 3.0 (backward compatible with USB 2.0)

### Performance Settings
- **Recommended Sample Rate**: 6-20 MS/s (Raspberry Pi)
- **Maximum Sample Rate**: 56 MS/s (high-end systems)
- **USB Buffer**: Increased to 1000 MB
- **CPU Governor**: Performance mode enabled

### Container Resources
- **CPU**: Shared with host
- **Memory**: No limits set
- **USB Access**: Full bus passthrough
- **Storage**: Persistent volumes for settings and configuration

## 🔐 Security Configuration

### Authentication
- **Admin User**: admin
- **Password**: argos123
- **Interface**: Web-based admin panel

### Network Access
- **OpenWebRX**: Port 8073 (localhost only)
- **Argos Integration**: Port 5173 (development server)
- **Docker Network**: Isolated bridge network

### File Permissions
- **USRP udev rules**: Configured for `dialout` group access
- **Configuration files**: Read-only mounts where appropriate
- **Log files**: Container-managed with rotation

## 🔄 Auto-Start Configuration

The system is configured to automatically start OpenWebRX when the Pi boots:

1. **systemd service** enabled for boot-time startup
2. **Docker dependency** ensures Docker starts first
3. **USB permissions** applied automatically via udev
4. **Container restart policy** set to `unless-stopped`

## 🧪 Verification Steps

### 1. Check USRP Detection
```bash
uhd_find_devices
# Should show: USRP B205-mini (Serial: 32B0765)
```

### 2. Verify Container Status
```bash
docker ps | grep openwebrx-usrp
# Should show: Up X minutes, healthy
```

### 3. Test Web Interface
```bash
curl -s http://localhost:8073 | grep OpenWebRX
# Should return HTML with OpenWebRX title
```

### 4. Check Argos Integration
```bash
curl -s http://localhost:5173/spectrum
# Should return Argos spectrum viewer page
```

## 🎯 Mission Card Integration

When operators click on the **"5173/view spectrum"** mission card in Argos, they will now access:

1. **Embedded OpenWebRX Interface** - Full spectrum analysis capabilities
2. **USRP B205 Mini Control** - Real-time tuning and gain control  
3. **Pre-configured Profiles** - Quick access to common frequency bands
4. **Professional UI** - Integrated with Argos tactical theme

## 🚨 Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check USB permissions
ls -la /dev/bus/usb/004/004
# Check Docker logs
docker logs openwebrx-usrp
```

**USRP not detected:**
```bash
# Verify USB connection
lsusb | grep Ettus
# Check UHD installation
uhd_find_devices
```

**Web interface not accessible:**
```bash
# Check port binding
docker port openwebrx-usrp
# Verify firewall settings
sudo ufw status
```

## 📞 Support Information

- **OpenWebRX Documentation**: https://github.com/jketterl/openwebrx
- **UHD Documentation**: https://files.ettus.com/manual/
- **USRP B205 Mini Guide**: https://kb.ettus.com/B200/B210/B200mini/B205mini

---

**Status**: ✅ DEPLOYMENT COMPLETE  
**Date**: July 23, 2025  
**Platform**: Raspberry Pi 4 with Argos Tactical System  
**Integration**: Operational and Ready for Mission Use