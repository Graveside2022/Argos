# Scripts Directory Context

This file documents the extensive script collection for hardware management and system operations.

## Directory Purpose

System management, hardware diagnostics, and deployment scripts for Argos platform.

## Script Categories

### Hardware Diagnostics
- `diagnose-*.sh` - Various hardware diagnostic scripts
- `emergency-*.sh` - Emergency recovery and repair scripts
- `usrp-*.sh` - USRP hardware specific scripts

### GSM Evil Architecture
- `fix-gsm-*.sh` - GSM Evil pipeline repair scripts
- `gsm-evil-*.sh` - GSM service management
- `setup-gsm-evil-architecture.sh` - Complete architecture setup

### Service Management  
- `*-service.sh` - SystemD service installation and management
- `install-*.sh` - Various component installation scripts

### Recovery & Backup
- `restore-backup.sh` - System restore functionality
- `emergency-recovery-now.sh` - Emergency system recovery

## Critical Success Patterns

- Scripts handle missing hardware gracefully
- Comprehensive logging and error reporting
- Automated recovery mechanisms
- Service health monitoring

## AI Agent Guidelines

- Always test script changes in safe environment first
- Maintain comprehensive error handling
- Document hardware dependencies clearly
- Preserve existing logging patterns