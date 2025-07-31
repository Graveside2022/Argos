# Comprehensive Argos Cleanup Report - What to Keep vs Delete

## Executive Summary
- **Total Scripts**: ~207 shell scripts
- **Actually Used**: 9 scripts
- **Can Delete**: ~198 scripts
- **Test/Debug Code**: 6 test routes, multiple debug files
- **Separate Projects**: hackrf_emitter (not integrated)

---

## 1. GSM Evil Service

### NECESSARY FILES (Keep These)
**Primary Scripts:**
- `scripts/gsm-evil-with-auto-imsi.sh` - Called by API when user clicks start
- `scripts/gsm-evil-stop.sh` - Called by API when user clicks stop

**Secondary Scripts:**
- `scripts/patch-gsmevil-socketio.sh` - Called before starting GSM Evil
- `scripts/check-usrp-busy.sh` - Checks if USRP is available

**Code Files:**
- `src/routes/gsm-evil/+page.svelte` - User interface
- `src/routes/api/gsm-evil/control/+server.ts` - API endpoint
- `src/routes/api/gsm-evil/scan/+server.ts` - Scanning API
- `src/routes/api/gsm-evil/intelligent-scan/+server.ts` - Smart scanning
- `src/lib/stores/gsmEvilStore.ts` - Frontend state management

### UNNECESSARY FILES (Delete These)
**Redundant Scripts (11 versions!):**
- `scripts/gsm-evil-simple.sh` - Old version (18 lines)
- `scripts/gsm-evil-fixed.sh` - Old version (35 lines)
- `scripts/gsm-evil-working.sh` - Old version
- `scripts/gsm-evil-final.sh` - Old version (61 lines)
- `scripts/gsm-evil-production.sh` - Old version (74 lines)
- `scripts/gsm-evil-public.sh` - Old version
- `scripts/gsm-evil-dragonos.sh` - Platform-specific old version
- `scripts/gsm-evil-fix-and-start.sh` - Old debugging version
- `scripts/gsm-evil-start.sh` - Replaced by with-auto-imsi version
- `scripts/gsm-evil-start-wrapper.sh` - Old wrapper
- `scripts/gsm-evil-with-imsi.sh` - Replaced by auto version

**Legacy Scripts:**
- `scripts/gsmevil2-patch.py` - Old patch
- `scripts/start-gsmevil2.sh` - Version 2 attempt
- `scripts/stop-gsmevil2.sh` - Version 2 attempt
- `scripts/start-gsmevil2-fixed.sh` - Version 2 fix attempt
- `scripts/stop-gsmevil2-fixed.sh` - Version 2 fix attempt
- `scripts/nuclear-stop-gsmevil.sh` - Emergency stop (replaced)

---

## 2. HackRF Service

### NECESSARY FILES (Keep These)
**Primary Scripts:**
- `scripts/start-droneid.sh` - Actually starts HackRF for drone detection
- `scripts/stop-droneid.sh` - Stops HackRF drone detection

**Code Files:**
- `src/routes/hackrf/+page.svelte` - Main HackRF UI
- `src/routes/api/hackrf/+server.ts` - API proxy
- `src/routes/api/hackrf/[...path]/+server.ts` - Dynamic API routing
- `src/lib/services/hackrf/` - All service files
- `src/lib/components/hackrf/` - All UI components

### UNNECESSARY FILES (Delete These)
**Test/Debug Scripts:**
- `scripts/debug-hackrf.js` - Old debug script
- `scripts/debug-usrp-sweep.js` - Wrong device debug
- `scripts/monitoring/monitor-hackrf.sh` - Old monitoring
- `scripts/monitoring/restart-hackrf.sh` - Old restart
- `scripts/monitoring/diagnose-hackrf-crash.sh` - Old diagnostic
- `scripts/monitoring/check-hackrf-status.sh` - Old status check

**Test Routes:**
- `src/routes/test-hackrf-stop/+page.svelte` - Test page
- `src/routes/hackrfsweep/+page.svelte` - Duplicate implementation

---

## 3. Kismet Service

### NECESSARY FILES (Keep These)
**Primary Scripts:**
- `scripts/start-kismet.sh` - Main startup
- `scripts/stop-kismet-safe.sh` - Safe shutdown
- `scripts/configure-kismet-gps.sh` - GPS configuration

**Code Files:**
- `src/routes/kismet/+page.svelte` - Main UI
- `src/routes/kismet-dashboard/+page.svelte` - Dashboard view
- `src/routes/api/kismet/+server.ts` - API proxy
- `src/lib/server/kismet/` - All server code
- `src/lib/services/kismet/` - All service code

### UNNECESSARY FILES (Delete These)
**Redundant Scripts:**
- `scripts/start-kismet-safe.sh` - Duplicate of start-kismet.sh
- `scripts/start-kismet-with-alfa.sh` - Hardware-specific duplicate
- `scripts/start-kismet-skip-adapter.sh` - Debug version
- `scripts/kismet-graceful-stop.sh` - Replaced by stop-kismet-safe.sh
- `scripts/safe-stop-kismet.sh` - Another duplicate stop script

**Old Configs:**
- `scripts/kismet-gps-only.conf` - Unused config
- `scripts/kismet-no-auto-source.conf` - Unused config
- `scripts/kismet-site-simple.conf` - Unused config

---

## 4. USRP Service

### NECESSARY FILES (Keep These)
**Primary Scripts:**
- `scripts/check-usrp-busy.sh` - Used by GSM Evil to check availability

**Code Files:**
- `src/routes/usrpsweep/+page.svelte` - USRP sweep UI
- `src/lib/server/usrp/sweepManager.ts` - USRP management

### UNNECESSARY FILES (Delete These)
**Many Test/Debug Scripts:**
- `scripts/usrp_gsm_scanner.py` - Old scanner
- `scripts/usrp_simple_scanner.py` - Test scanner
- `scripts/usrp_working_scanner.py` - Another test
- `scripts/usrp_power_scan.py` - Power test
- `scripts/usrp_spectrum_scan.py` - Spectrum test
- `scripts/usrp_sweep_gsm.sh` - Old sweep
- `scripts/usrp_simple_power.sh` - Power test
- `scripts/usrp_power_measure.sh` - Measure test
- `scripts/usrp_power_measure_real.py` - Real measure test
- `scripts/diagnose-usrp-hardware.sh` - Hardware diagnostic
- `scripts/diagnose-usrp-gsm.sh` - GSM diagnostic
- `scripts/verify-usrp-working.sh` - Verification script
- `scripts/final-usrp-setup.sh` - Setup script
- `scripts/fix-usrp-drivers.sh` - Driver fix
- `scripts/configure-usrp-immediate.sh` - Config script
- All scripts starting with `grgsm_livemon_`

---

## 5. Tactical Map Service

### NECESSARY FILES (Keep These)
**Code Files:**
- `src/routes/tactical-map-simple/+page.svelte` - Main map view
- `src/lib/services/tactical-map/` - All service files
- `src/lib/components/tactical-map/` - All components

### UNNECESSARY FILES (Delete These)
**Test Routes:**
- `src/routes/test-map/+page.svelte` - Test implementation

---

## 6. DroneID Service

### NECESSARY FILES (Keep These)
**Primary Scripts:**
- `scripts/start-droneid.sh` - Start drone detection
- `scripts/stop-droneid.sh` - Stop drone detection

**Code Files:**
- `src/routes/droneid/+page.svelte` - DroneID UI
- `src/routes/api/droneid/+server.ts` - API endpoint

### UNNECESSARY FILES (Delete These)
- None identified (this service is clean)

---

## 7. RTL-433 Service

### NECESSARY FILES (Keep These)
**Code Files:**
- `src/routes/rtl-433/+page.svelte` - RTL-433 UI
- `src/lib/stores/rtl433Store.ts` - State management

### UNNECESSARY FILES (Delete These)
**Scripts:**
- `scripts/development/emergency_rtl433.sh` - Emergency script
- `scripts/maintenance/emergency_rtl433.sh` - Duplicate
- `scripts/dev/emergency_rtl433.sh` - Another duplicate

---

## 8. Test/Debug Routes (ALL UNNECESSARY - Delete These)

**Test Pages to Delete:**
- `src/routes/test/+page.svelte`
- `src/routes/test-simple/+page.svelte`
- `src/routes/test-map/+page.svelte`
- `src/routes/test-time-filter/+page.svelte`
- `src/routes/test-hackrf-stop/+page.svelte`
- `src/routes/test-db-client/+page.svelte`
- `src/routes/redesign/+page.svelte` - Abandoned redesign
- `src/routes/viewspectrum/+page.svelte` - Old spectrum view

---

## 9. Script Categories (What to Delete)

### Database Scripts (KEEP only these):
- `scripts/setup-celltower-db.sh` - Creates celltower database
- `scripts/add-altitude-column.sql` - Migration script

### DELETE these database scripts:
- `scripts/create-sample-celltower-db.sh` - Sample data

### WiFi/Network Scripts (KEEP only these):
- `scripts/create-ap-simple.sh` - Creates access point
- `scripts/detect-alfa-adapter.sh` - Detects Alfa WiFi adapter

### DELETE these WiFi scripts:
- `scripts/argos-ap-simple.sh` - Duplicate of create-ap-simple.sh
- `scripts/argos-wifi-resilience.sh` - Old resilience script
- `scripts/wifi-keepalive.sh` - Old keepalive
- `scripts/wifi-keepalive-robust.sh` - Another keepalive
- `scripts/fix-alfa-only.sh` - Hardware-specific fix
- `scripts/fix-mt76-adapter.sh` - Hardware-specific fix
- `scripts/fix-wifi-now.sh` - Emergency fix
- `scripts/reset-wifi-adapter.sh` - Reset script
- `scripts/safe-adapter-reset.sh` - Another reset
- `scripts/safe-fix-adapter.sh` - Another fix
- `scripts/detect-any-wifi-adapter.sh` - Generic detection
- `scripts/diagnose-wifi-adapter.sh` - Diagnostic

### Process Management (KEEP only these):
- `scripts/argos-process-manager.sh` - Main process manager

### DELETE these process scripts:
- `scripts/argos-keepalive.sh` - Old keepalive
- `scripts/argos-cpu-protector.sh` - CPU protection
- `scripts/cpu-guardian.sh` - Another CPU script
- `scripts/simple-keepalive.sh` - Simple version
- `scripts/keepalive.sh` - Generic keepalive
- `scripts/manage-keepalive.sh` - Management script
- `scripts/dev-server-keepalive.sh` - Dev keepalive

### USB/Hardware Scripts (DELETE ALL):
- `scripts/nuclear-usb-reset.sh` - Emergency USB reset
- `scripts/advanced-usb-reset.sh` - Advanced reset
- `scripts/configure-usb-persistence.sh` - USB config

---

## 10. Entire Directories to Delete

### DELETE these entire directories:
1. `/archive/` - All legacy files (legacy-config/, legacy-docs/, test-scripts/)
2. `/hackrf_emitter/` - Separate project not integrated with Argos
3. `/completed/` - Old completed work
4. `/utils/` - Duplicate debug scripts
5. `/models/` - Empty directory with just README
6. `/RemoteIDReceiver/` - Separate project
7. `/tools/kalibrate-hackrf/` - Unused tool

### DELETE these script subdirectories:
1. `scripts/development/` - Development scripts (keep start-all-services.sh)
2. `scripts/dev/` - Duplicate of development
3. `scripts/monitoring/` - Old monitoring scripts
4. `scripts/testing/` - Test scripts
5. `scripts/maintenance/` - Maintenance scripts

---

## 11. Configuration Files

### KEEP these configs:
- `config/docker/` - Docker configurations
- `config/eslint.config.js` - Linting config
- `config/openwebrx/` - OpenWebRX configs
- Root config files (svelte.config.js, vite.config.ts, etc.)

### DELETE these configs:
- Multiple docker-compose variants (keep only the main ones)

---

## 12. Summary Statistics

### What You'll Keep:
- **Scripts**: ~20 essential scripts (from 207)
- **Routes**: 12 active routes (from 20)
- **Services**: 9 core services
- **Config**: Essential configs only

### What You'll Delete:
- **Scripts**: ~187 unused/duplicate scripts
- **Test Routes**: 8 test pages
- **Directories**: 7 entire directories
- **Legacy Files**: All archive content
- **Debug Files**: All old debug/test files

### Impact:
- **Code Reduction**: ~60-70%
- **Clarity**: Each service has clear, minimal file set
- **Maintainability**: Dramatically improved
- **No Feature Loss**: All active features preserved

---

## Action Plan

1. **Backup First**:
   ```bash
   tar -czf argos-backup-$(date +%Y%m%d).tar.gz .
   ```

2. **Create Deletion Script**:
   ```bash
   mkdir -p /tmp/argos-cleanup
   # Move files listed above to cleanup directory
   ```

3. **Test for 1 Week**:
   - Run system normally
   - Check all features work
   - If issues, restore from backup

4. **Final Deletion**:
   ```bash
   rm -rf /tmp/argos-cleanup
   ```

This cleanup will transform Argos from a chaotic 207-script system to a focused ~20-script platform with clear service boundaries.