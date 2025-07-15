#!/bin/bash

# This script is deprecated - OpenCellID database has been imported locally
# The database is now available at: /home/ubuntu/projects/Argos/data/celltowers/towers.db

echo "==================================================================="
echo "NOTICE: OpenCellID database is already set up!"
echo "==================================================================="
echo ""
echo "The cell tower database is available at:"
echo "  /home/ubuntu/projects/Argos/data/celltowers/towers.db"
echo ""

# Check database status
DB_PATH="/home/ubuntu/projects/Argos/data/celltowers/towers.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    TOWER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers" 2>/dev/null || echo "unknown")
    
    echo "Database Status:"
    echo "  - Size: $DB_SIZE"
    echo "  - Total towers: $TOWER_COUNT"
    echo ""
    echo "Sample towers by radio type:"
    sqlite3 "$DB_PATH" "SELECT radio, COUNT(*) as count FROM towers GROUP BY radio ORDER BY count DESC LIMIT 5" 2>/dev/null || echo "  Unable to query database"
    echo ""
else
    echo "WARNING: Database not found at expected location!"
    echo "Please run the import script: /home/ubuntu/projects/Argos/scripts/import_celltowers.py"
fi

echo "==================================================================="