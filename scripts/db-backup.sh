#!/bin/bash
# Database backup script for Argos RF Signal Database

set -e

# Configuration
DB_PATH="/home/pi/projects/Argos/rf_signals.db"
BACKUP_DIR="/home/pi/projects/Argos/backups"
REMOTE_BACKUP_DIR="" # Set this to enable remote backups (e.g., "/mnt/nas/argos-backups")
MAX_LOCAL_BACKUPS=7
MAX_REMOTE_BACKUPS=30
LOG_DIR="/var/log/argos"
LOG_FILE="$LOG_DIR/db-backup.log"

# Create directories
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    log "ERROR: Database not found at $DB_PATH"
    exit 1
fi

log "Starting database backup..."

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rf_signals_${TIMESTAMP}.db"

# Check if database is in use (basic check)
if lsof "$DB_PATH" >/dev/null 2>&1; then
    log "WARNING: Database is in use, backup may be inconsistent"
fi

# Create backup using SQLite's backup API for consistency
log "Creating backup: $BACKUP_FILE"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ ! -f "$BACKUP_FILE" ]; then
    log "ERROR: Backup creation failed"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
log "Backup size: $(numfmt --to=iec-i --suffix=B $BACKUP_SIZE)"

# Verify backup integrity
log "Verifying backup integrity..."
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" != "ok" ]; then
    log "ERROR: Backup integrity check failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi
log "Backup integrity: OK"

# Compress backup
log "Compressing backup..."
gzip -9 "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
COMPRESSED_SIZE=$(stat -c%s "$COMPRESSED_FILE" 2>/dev/null || stat -f%z "$COMPRESSED_FILE" 2>/dev/null)
COMPRESSION_RATIO=$(echo "scale=2; 100 - ($COMPRESSED_SIZE * 100 / $BACKUP_SIZE)" | bc)
log "Compressed size: $(numfmt --to=iec-i --suffix=B $COMPRESSED_SIZE) (${COMPRESSION_RATIO}% reduction)"

# Copy to remote location if configured
if [ -n "$REMOTE_BACKUP_DIR" ] && [ -d "$REMOTE_BACKUP_DIR" ]; then
    log "Copying to remote backup location..."
    cp "$COMPRESSED_FILE" "$REMOTE_BACKUP_DIR/"
    if [ $? -eq 0 ]; then
        log "Remote backup completed"
        
        # Clean up old remote backups
        REMOTE_COUNT=$(find "$REMOTE_BACKUP_DIR" -name "rf_signals_*.db.gz" | wc -l)
        if [ $REMOTE_COUNT -gt $MAX_REMOTE_BACKUPS ]; then
            log "Cleaning up old remote backups (keeping last $MAX_REMOTE_BACKUPS)"
            find "$REMOTE_BACKUP_DIR" -name "rf_signals_*.db.gz" | sort | head -n -$MAX_REMOTE_BACKUPS | xargs rm -f
        fi
    else
        log "WARNING: Remote backup failed"
    fi
fi

# Clean up old local backups
LOCAL_COUNT=$(find "$BACKUP_DIR" -name "rf_signals_*.db.gz" | wc -l)
if [ $LOCAL_COUNT -gt $MAX_LOCAL_BACKUPS ]; then
    log "Cleaning up old local backups (keeping last $MAX_LOCAL_BACKUPS)"
    find "$BACKUP_DIR" -name "rf_signals_*.db.gz" | sort | head -n -$MAX_LOCAL_BACKUPS | while read oldbackup; do
        log "Removing: $(basename "$oldbackup")"
        rm -f "$oldbackup"
    done
fi

# Create latest symlink
ln -sf "$COMPRESSED_FILE" "$BACKUP_DIR/rf_signals_latest.db.gz"

# Generate backup report
log "Generating backup report..."
cat > "$BACKUP_DIR/backup_status.json" <<EOF
{
  "last_backup": {
    "timestamp": "$TIMESTAMP",
    "file": "$(basename "$COMPRESSED_FILE")",
    "size": $COMPRESSED_SIZE,
    "compression_ratio": $COMPRESSION_RATIO,
    "status": "success"
  },
  "local_backups": $(find "$BACKUP_DIR" -name "rf_signals_*.db.gz" | wc -l),
  "remote_backups": $([ -n "$REMOTE_BACKUP_DIR" ] && find "$REMOTE_BACKUP_DIR" -name "rf_signals_*.db.gz" 2>/dev/null | wc -l || echo 0),
  "updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

log "Database backup completed successfully"

# Rotate log file if needed
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null)
    if [ $LOG_SIZE -gt 5242880 ]; then # 5MB
        mv "$LOG_FILE" "${LOG_FILE}.old"
        gzip "${LOG_FILE}.old"
        log "Log file rotated"
    fi
fi