#!/bin/bash
# Setup cron jobs for database maintenance

# Add database cleanup cron jobs
CLEANUP_HOURLY="0 * * * * /home/pi/projects/Argos/scripts/db-cleanup.sh >/dev/null 2>&1"
CLEANUP_DAILY="0 3 * * * /home/pi/projects/Argos/scripts/db-cleanup.sh --vacuum >/dev/null 2>&1"
BACKUP_DAILY="0 2 * * * /home/pi/projects/Argos/scripts/db-backup.sh >/dev/null 2>&1"

echo "Setting up database maintenance cron jobs..."

# Function to add cron job if it doesn't exist
add_cron_job() {
    local job="$1"
    local description="$2"
    
    if crontab -l 2>/dev/null | grep -q "$description"; then
        echo "[PASS] $description already exists"
    else
        (crontab -l 2>/dev/null; echo "# $description"; echo "$job") | crontab -
        echo "[PASS] Added: $description"
    fi
}

# Add the cron jobs
add_cron_job "$CLEANUP_HOURLY" "Hourly database cleanup"
add_cron_job "$CLEANUP_DAILY" "Daily database vacuum"
add_cron_job "$BACKUP_DAILY" "Daily database backup"

echo ""
echo "Current cron jobs:"
crontab -l | grep -E "(db-cleanup|db-backup)"

echo ""
echo "Database maintenance cron jobs configured successfully!"
echo ""
echo "Schedule:"
echo "- Hourly: Basic cleanup (every hour)"
echo "- Daily:  VACUUM operation (3:00 AM)"
echo "- Daily:  Database backup (2:00 AM)"