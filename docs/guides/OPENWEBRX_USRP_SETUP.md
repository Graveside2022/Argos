# OpenWebRX USRP B205 Mini Setup Guide

This guide documents the setup of OpenWebRX Plus with USRP B205 Mini support, including automatic startup and admin authentication.

## Overview

The setup provides a web-based SDR interface for the USRP B205 Mini that:
- Auto-starts without requiring login for viewing
- Supports admin login for configuration
- Uses JSON configuration files (similar to HackRF setup)
- Accessible at http://100.79.154.94:5173/viewspectrum

## Components

### 1. Docker Compose Configuration
File: `docker-compose-usrp-final.yml`
- Uses slechev/openwebrxplus:latest image (has UHD support)
- Mounts configuration directory and startup script
- Exposes port 8073

### 2. Startup Script
File: `openwebrx-startup.py`
- Converts JSON configuration to OpenWebRX Python format
- Enables auto-start functionality without login requirement

### 3. Configuration Files
Directory: `openwebrx-usrp-working/`
- `settings.json` - Receiver settings (name, location, waterfall)
- `sdrs.json` - USRP configuration with frequency profiles
- `users.json` - Admin user authentication

## Quick Start

1. Start the container:
```bash
docker compose -f docker-compose-usrp-final.yml up -d
```

2. Access the interface:
- Viewer: http://100.79.154.94:8073/ (no login required)
- Admin: http://100.79.154.94:8073/login (admin/admin)

## Configuration

### SDR Settings (sdrs.json)
- Device: USRP B205 Mini (serial: 32B0765)
- Profiles: FM Broadcast, 2m Band, 70cm Band
- Sample rate: 2 MSPS (optimized for B205 Mini)

### Admin Access
- Username: admin
- Password: admin
- Settings URL: http://100.79.154.94:8073/settings/general

## Troubleshooting

### "No SDR Devices available" Error
1. Check for stale processes: `ps aux | grep grgsm`
2. Kill any processes holding the USRP
3. Verify USRP is detected: `uhd_find_devices`
4. Restart container: `docker restart openwebrx-usrp-final`

### Login Issues
1. Check users.json is not empty/corrupted
2. Recreate admin user if needed:
```bash
docker exec openwebrx-usrp-final openwebrx admin adduser admin
```

## Integration with Argos

The OpenWebRX interface integrates with the Argos tactical map at:
http://100.79.154.94:5173/viewspectrum

This provides spectrum visualization alongside other RF analysis tools.