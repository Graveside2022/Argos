# ✅ USRP B205 Mini + OpenWebRX - FIXED & READY

## 🎯 Mission Card Integration - WORKING

Your USRP B205 Mini is now properly configured and working exactly like the original HackRF setup:

### ✅ **Correct Mission Card URL**
```
http://100.79.154.94:5173/viewspectrum
```

### ✅ **Immediate Operation**
- **Click mission card** → **Starts listening immediately**
- **No configuration required**
- **Auto-configured for 100.3 MHz FM**

### ✅ **Admin Credentials**
- **Username**: `admin`
- **Password**: `admin`
- **Access**: http://localhost:8073/admin

## 🔧 What Was Fixed

### 1. URL Path Correction
- ❌ **Before**: `/spectrum`
- ✅ **After**: `/viewspectrum` (matches mission card)

### 2. Admin Password Fix
- ❌ **Before**: `admin/argos123`
- ✅ **After**: `admin/admin`

### 3. Auto-Start Configuration
- ✅ USRP B205 Mini auto-configured in OpenWebRX
- ✅ Default frequency: 100.3 MHz (FM broadcast)
- ✅ Wide FM mode enabled
- ✅ 10 MS/s sample rate for immediate operation

### 4. Clean Setup
- ✅ Removed conflicting configuration files
- ✅ Fresh Docker volumes
- ✅ Proper USRP device detection

## 🚀 How It Works Now

1. **Operator clicks mission card** at `http://100.79.154.94:5173/viewspectrum`
2. **Argos loads spectrum viewer** with embedded OpenWebRX
3. **USRP B205 Mini starts immediately** - no setup needed
4. **Spectrum display appears** showing live RF data

## 🛠️ Service Management

### Current Status
```bash
docker ps | grep openwebrx-usrp
# Should show: Up X minutes (healthy)
```

### Manual Control (if needed)
```bash
# Restart OpenWebRX
docker restart openwebrx-usrp

# View logs
docker logs -f openwebrx-usrp

# Stop/Start via systemd
sudo systemctl restart openwebrx-usrp
```

## 📡 Hardware Configuration

### USRP B205 Mini Details
- **Device**: Serial 32B0765, Type b200
- **Status**: Connected and operational
- **Interface**: USB 3.0 (Bus 004, Device 004)
- **Frequency Range**: 70 MHz - 6 GHz
- **Sample Rate**: 10 MS/s (optimized for Pi)

### OpenWebRX Settings
- **Container**: `openwebrx-usrp`
- **Image**: `jketterl/openwebrx-uhd:stable`
- **Port**: 8073
- **Auto-start**: Enabled via systemd

## ✅ Final Verification

### Test Mission Card URL
```bash
curl -s http://100.79.154.94:5173/viewspectrum | head -3
# Should return: HTML with Argos spectrum viewer
```

### Check OpenWebRX Direct Access
```bash
curl -s http://localhost:8073 | grep OpenWebRX
# Should return: OpenWebRX title line
```

### Verify USRP Detection
```bash
uhd_find_devices | grep B205
# Should show: USRP B205-mini detected
```

---

## 🎉 **READY FOR OPERATIONS**

Your USRP B205 Mini setup now works **exactly like the original HackRF**:

- ✅ Same mission card URL
- ✅ Same admin credentials  
- ✅ Same immediate start behavior
- ✅ Same embedded interface in Argos
- ✅ **Better hardware** (70MHz-6GHz vs 1MHz-6GHz)

**Click the mission card and start monitoring!**