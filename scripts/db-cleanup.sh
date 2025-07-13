#!/bin/bash
# Database cleanup script for Argos RF Signal Database
# Can be run manually or via cron

set -e

# Configuration
DB_PATH="/home/pi/projects/Argos/rf_signals.db"
LOG_DIR="/var/log/argos"
LOG_FILE="$LOG_DIR/db-cleanup.log"
BACKUP_DIR="/home/pi/projects/Argos/backups"
MAX_BACKUPS=7

# Create directories if they don't exist
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    log "ERROR: Database not found at $DB_PATH"
    exit 1
fi

log "Starting database cleanup..."

# Get database size before cleanup
SIZE_BEFORE=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null)
log "Database size before cleanup: $(numfmt --to=iec-i --suffix=B $SIZE_BEFORE)"

# Create backup before cleanup
if [ "$1" != "--no-backup" ]; then
    BACKUP_FILE="$BACKUP_DIR/rf_signals_$(date +%Y%m%d_%H%M%S).db"
    log "Creating backup: $BACKUP_FILE"
    cp "$DB_PATH" "$BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    log "Backup compressed: ${BACKUP_FILE}.gz"
    
    # Remove old backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "rf_signals_*.db.gz" | wc -l)
    if [ $BACKUP_COUNT -gt $MAX_BACKUPS ]; then
        log "Removing old backups (keeping last $MAX_BACKUPS)"
        find "$BACKUP_DIR" -name "rf_signals_*.db.gz" | sort | head -n -$MAX_BACKUPS | xargs rm -f
    fi
fi

# Run cleanup SQL
log "Running cleanup queries..."

sqlite3 "$DB_PATH" <<EOF
-- Start transaction
BEGIN TRANSACTION;

-- Log current statistics
SELECT 'Signals to delete: ' || COUNT(*) FROM signals_to_delete;
SELECT 'Devices to delete: ' || COUNT(*) FROM devices_to_delete;
SELECT 'Relationships to delete: ' || COUNT(*) FROM relationships_to_delete;
SELECT 'Expired patterns: ' || COUNT(*) FROM expired_patterns;

-- Delete old signals based on retention policy
DELETE FROM signals 
WHERE signal_id IN (
    SELECT signal_id FROM signals_to_delete LIMIT 10000
);

-- Delete inactive devices
DELETE FROM devices 
WHERE device_id IN (
    SELECT device_id FROM devices_to_delete
);

-- Delete orphaned relationships
DELETE FROM relationships 
WHERE id IN (
    SELECT id FROM relationships_to_delete
);

-- Delete expired patterns
DELETE FROM patterns 
WHERE pattern_id IN (
    SELECT pattern_id FROM expired_patterns
);

-- Update aggregation tables
-- Aggregate hourly stats for the last complete hour
INSERT OR REPLACE INTO signal_stats_hourly (
    hour_timestamp, total_signals, unique_devices, 
    avg_power, min_power, max_power, dominant_frequency, coverage_area
)
SELECT 
    CAST(timestamp / 3600000 AS INTEGER) * 3600000 as hour_timestamp,
    COUNT(*) as total_signals,
    COUNT(DISTINCT device_id) as unique_devices,
    AVG(power) as avg_power,
    MIN(power) as min_power,
    MAX(power) as max_power,
    frequency as dominant_frequency,
    (MAX(latitude) - MIN(latitude)) * (MAX(longitude) - MIN(longitude)) * 111 * 111 as coverage_area
FROM signals
WHERE timestamp >= (CAST(strftime('%s', 'now') * 1000 / 3600000 AS INTEGER) - 1) * 3600000
  AND timestamp < CAST(strftime('%s', 'now') * 1000 / 3600000 AS INTEGER) * 3600000
GROUP BY CAST(timestamp / 3600000 AS INTEGER) * 3600000;

-- Commit transaction
COMMIT;

-- Show final statistics
SELECT 'Total signals: ' || COUNT(*) FROM signals;
SELECT 'Total devices: ' || COUNT(*) FROM devices;
SELECT 'Total relationships: ' || COUNT(*) FROM relationships;
SELECT 'Total patterns: ' || COUNT(*) FROM patterns;
EOF

# Run ANALYZE to update statistics
log "Updating database statistics..."
sqlite3 "$DB_PATH" "ANALYZE;"

# Check if VACUUM is needed (if more than 10% of space can be reclaimed)
FREELIST_COUNT=$(sqlite3 "$DB_PATH" "PRAGMA freelist_count;" 2>/dev/null || echo "0")
PAGE_COUNT=$(sqlite3 "$DB_PATH" "PRAGMA page_count;" 2>/dev/null || echo "1")
FRAGMENTATION=$(echo "scale=2; $FREELIST_COUNT * 100 / $PAGE_COUNT" | bc)

log "Database fragmentation: ${FRAGMENTATION}%"

if (( $(echo "$FRAGMENTATION > 10" | bc -l) )); then
    log "Running VACUUM to reclaim space..."
    sqlite3 "$DB_PATH" "VACUUM;"
else
    log "VACUUM not needed (fragmentation < 10%)"
fi

# Get database size after cleanup
SIZE_AFTER=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null)
log "Database size after cleanup: $(numfmt --to=iec-i --suffix=B $SIZE_AFTER)"

# Calculate space saved
SAVED=$((SIZE_BEFORE - SIZE_AFTER))
if [ $SAVED -gt 0 ]; then
    log "Space saved: $(numfmt --to=iec-i --suffix=B $SAVED)"
else
    log "No space saved (database may have grown due to new data)"
fi

# Check database integrity
log "Running integrity check..."
INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" = "ok" ]; then
    log "Database integrity check: PASSED"
else
    log "ERROR: Database integrity check failed!"
    log "$INTEGRITY"
    exit 1
fi

log "Database cleanup completed successfully"

# Rotate log file if it's too large
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null)
    if [ $LOG_SIZE -gt 10485760 ]; then # 10MB
        mv "$LOG_FILE" "${LOG_FILE}.old"
        gzip "${LOG_FILE}.old"
        log "Log file rotated"
    fi
fi