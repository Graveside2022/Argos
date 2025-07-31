# Cleanup Action Plan - Start Here!

## Quick Wins (Do Today)

### 1. Run the Analysis
```bash
./analyze-codebase.sh
```
This will create an `analysis/` folder with detailed reports.

### 2. Find Obviously Unused Files
```bash
# Find backup files
find . -name "*.bak" -o -name "*.old" -o -name "*~" | grep -v node_modules

# Find test scripts older than 6 months
find scripts -name "test-*.sh" -mtime +180

# Find TODO/deprecated markers
grep -r "DEPRECATED\|DO NOT USE\|OBSOLETE" . --include="*.sh" --include="*.js"
```

### 3. Check Specific Files
For any file you're unsure about:
```bash
./can-i-delete-this.sh scripts/some-old-script.sh
```

## Week 1: Safe Cleanup

### Day 1-2: Document What You Have
Create a `SCRIPT_INVENTORY.md`:
```markdown
# Script Inventory

## Critical Scripts (DO NOT DELETE)
- `scripts/start-services.sh` - Main startup
- `scripts/deploy.sh` - Production deployment

## Active Scripts
- `scripts/argos-process-manager.sh` - Process management
- [List others you know are used]

## Unknown/To Review
- [List scripts you're unsure about]

## Marked for Deletion
- [Scripts confirmed as unused]
```

### Day 3-4: Handle Duplicates
Look for patterns like:
- `gsm-evil-simple.sh`, `gsm-evil-fixed.sh`, `gsm-evil-final.sh`
- `start-hackrf.sh`, `start-hackrf-old.sh`, `start-hackrf-new.sh`

Strategy:
1. Identify which one is actually used
2. Diff them to see differences
3. Consolidate into one script with parameters
4. Keep old ones with `.deprecated-YYYYMMDD` suffix for 30 days

### Day 5: Clean Test Files
```bash
# Move old test files to archive
mkdir -p archive/old-tests
find . -name "test-*.sh" -mtime +90 -exec mv {} archive/old-tests/ \;
find . -name "debug-*.js" -mtime +90 -exec mv {} archive/old-tests/ \;
```

## Week 2: Script Consolidation

### Create Script Categories
```bash
mkdir -p scripts/{core,hardware,deployment,testing,utilities,deprecated}

# Move scripts to appropriate directories
mv scripts/start-*.sh scripts/stop-*.sh scripts/core/
mv scripts/*-usrp-*.sh scripts/*-hackrf-*.sh scripts/hardware/
mv scripts/deploy*.sh scripts/install*.sh scripts/deployment/
```

### Replace Multiple Versions
Instead of:
```
gsm-evil-simple.sh
gsm-evil-fixed.sh
gsm-evil-working.sh
gsm-evil-final.sh
```

Create:
```bash
# scripts/core/gsm-evil.sh
#!/bin/bash
MODE=${1:-production}  # simple, debug, production
# Consolidated logic here
```

## Week 3: Code Organization

### Frontend Consolidation
```bash
# Identify duplicate UI code
find src -name "*.svelte" -exec grep -l "hackrf" {} \; | \
  xargs -I {} sh -c 'echo "=== {} ==="; head -20 {}'
```

### Service Cleanup
1. Map all services and their dependencies
2. Remove unused service files
3. Consolidate similar services

## The "Do Not Touch" List

Until you're 100% sure, DO NOT delete:
1. Anything referenced in systemd services
2. Scripts modified in the last 30 days  
3. Anything with "production" in the name
4. Database migration scripts
5. Deployment scripts

## Tracking Progress

Create a `CLEANUP_LOG.md`:
```markdown
# Cleanup Log

## 2024-01-15
- Deleted: `test-old-api.sh` (unused for 8 months)
- Archived: `debug-*.js` files to `/archive/old-debug/`
- Consolidated: 5 gsm-evil scripts into 1

## 2024-01-16
- [Continue logging changes]
```

## Safety Rules

1. **Never delete without checking:**
   ```bash
   ./can-i-delete-this.sh <file>
   ```

2. **Always backup before deleting:**
   ```bash
   cp file.sh archive/deleted-$(date +%Y%m%d)/file.sh
   ```

3. **Wait period:** Mark for deletion, wait 1 week, then delete

4. **Git safety:**
   ```bash
   git add -A
   git commit -m "Pre-cleanup backup"
   git tag pre-cleanup-$(date +%Y%m%d)
   ```

## Expected Results

After cleanup, you should have:
- ~50 well-organized scripts (from 207)
- Clear directory structure
- No duplicate functionality
- Documentation for everything kept

## Remember

- Working messy code > Broken clean code
- You can always recover from git
- When in doubt, keep it
- Document why you kept something

Start with the analysis script and see what it finds!