# What to Keep and What to Delete - Simple Guide

## The Real Story

Looking at your code, here's what's actually happening:

### GSM Evil Scripts (You have 13 versions!)
You have these GSM Evil scripts:
- gsm-evil-dragonos.sh
- gsm-evil-final.sh
- gsm-evil-fix-and-start.sh
- gsm-evil-fixed.sh
- gsm-evil-production.sh
- gsm-evil-public.sh
- gsm-evil-simple.sh (18 lines)
- gsm-evil-start-wrapper.sh
- gsm-evil-start.sh
- gsm-evil-stop.sh
- gsm-evil-with-auto-imsi.sh ← **THIS IS THE ONE ACTUALLY USED**
- gsm-evil-with-imsi.sh
- gsm-evil-working.sh

**What's actually used:** Your app only uses 2 scripts:
- `gsm-evil-with-auto-imsi.sh` (for starting)
- `gsm-evil-stop.sh` (for stopping)

**What to do:**
- KEEP: `gsm-evil-with-auto-imsi.sh`, `gsm-evil-stop.sh`
- DELETE: All the other gsm-evil-*.sh files (they're old versions)

### Your Active Pages (What users see)
These are your actual features:
1. `/` - Home page
2. `/hackrf` - HackRF control
3. `/hackrfsweep` - HackRF sweep interface
4. `/gsm-evil` - GSM monitoring
5. `/kismet` - WiFi monitoring
6. `/kismet-dashboard` - Kismet dashboard
7. `/droneid` - Drone detection
8. `/rtl-433` - RTL-433 interface
9. `/tactical-map-simple` - Map view
10. `/fusion` - Combined view
11. `/usrpsweep` - USRP interface
12. `/wigletotak` - Wigle integration

### Test Pages (Can probably delete)
These look like experiments:
- `/test`
- `/test-simple`
- `/test-map`
- `/test-time-filter`
- `/test-hackrf-stop`
- `/test-db-client`
- `/redesign`
- `/viewspectrum`

## Simple Rules for Cleanup

### KEEP these types of files:
1. **Scripts that are directly called** in your src/routes/api folders
2. **Scripts in systemd services** (deployment/\*.service files)
3. **Main entry scripts** like start-services.sh
4. **Anything modified in the last 30 days**

### DELETE these types of files:
1. **Multiple versions** of the same script (keep only the one that's used)
2. **Test scripts** older than 3 months
3. **Files with "old", "backup", "temp" in the name**
4. **Scripts that grep shows are never called**

## Quick Check Method

For any script you're unsure about:

```bash
# See if it's used anywhere
grep -r "name-of-script.sh" . --include="*.ts" --include="*.js" --include="*.service"

# If grep returns nothing, it's probably safe to delete
```

## The Big Offenders

1. **GSM Evil variants** - You only need 2, not 13
2. **Test pages** - 8 test pages that users never see
3. **Debug scripts** - Old debugging scripts from development

## What I'd Delete Right Now

### Definitely Delete:
- gsm-evil-simple.sh
- gsm-evil-fixed.sh
- gsm-evil-working.sh
- gsm-evil-final.sh
- gsm-evil-production.sh
- All the test-*.sh files older than 3 months
- Any *.bak or *.old files

### Keep for Now:
- gsm-evil-with-auto-imsi.sh (actively used)
- gsm-evil-stop.sh (actively used)
- Any script referenced in a .service file
- Scripts you're not sure about

## Next Steps

1. **Make a backup first:**
   ```bash
   tar -czf backup-before-cleanup.tar.gz scripts/
   ```

2. **Move files to a "to-delete" folder:**
   ```bash
   mkdir -p archive/to-delete
   mv scripts/gsm-evil-simple.sh archive/to-delete/
   # ... move other files
   ```

3. **Wait a week** - if nothing breaks, delete the archive

4. **Document what's left:**
   Create a README in the scripts folder explaining what each remaining script does

## The Bottom Line

You have about 150+ scripts you don't need. Start with the obvious duplicates (like the 11 extra GSM Evil scripts) and work from there. Most of your complexity comes from keeping old versions of things that were replaced by newer versions.