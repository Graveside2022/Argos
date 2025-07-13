# ArgosFinal Backup Log

This log tracks all backups created for the ArgosFinal project.

## Backup Format

Each backup contains:

- **source/**: Complete source code (excluding node_modules and build artifacts)
- **git/**: Git repository data and bundle for easy restoration
- **config/**: Configuration files (package.json, svelte.config.js, etc.)
- **docs/**: All documentation files

## Backup History

### ArgosFinal_backup_20250625_102004

- **Date**: Wed 25 Jun 10:20:05 CEST 2025
- **Location**: /home/pi/backups/ArgosFinal/ArgosFinal_backup_20250625_102004
- **Archive**: /home/pi/backups/ArgosFinal/ArgosFinal_backup_20250625_102004.tar.gz
- **Size**: 208K
- **SHA256**: 33afd45d61228830f8fea3b6fa78c953889edcc6e13c38394f697ee7e0d5ec19
- **Files**: 94 files backed up

### Critical Backup (Always Available)

- **Location**: `/home/pi/ArgosFinal_backup_critical/`
- **Contents**: All documentation, source code, and configuration files
- **Files**: 88 critical files
- **Size**: 944K
- **Purpose**: Quick access to essential project files without extraction

## How to Restore

### From Full Backup:

```bash
cd /home/pi/backups/ArgosFinal
tar xzf ArgosFinal_backup_YYYYMMDD_HHMMSS.tar.gz
cp -r ArgosFinal_backup_YYYYMMDD_HHMMSS/source/* /destination/path/
```

### From Critical Backup:

```bash
cp -r /home/pi/ArgosFinal_backup_critical/* /destination/path/
cd /destination/path && npm install
```
