#!/bin/bash

# This script is deprecated - OpenCellID database has been imported locally
# The database is now available at: /home/ubuntu/projects/Argos/data/celltowers/towers.db

echo "==================================================================="
echo "NOTICE: OpenCellID database has been imported locally"
echo "==================================================================="
echo ""
echo "The OpenCellID database is now available at:"
echo "  /home/ubuntu/projects/Argos/data/celltowers/towers.db"
echo ""
echo "No need to download from API anymore - we have real data!"
echo ""
echo "Database contains cell tower locations with columns:"
echo "  - radio, mcc, net (mnc), area (lac), cell (ci)"
echo "  - lat, lon, range, samples, updated"
echo ""
echo "To query the database:"
echo "  sqlite3 /home/ubuntu/projects/Argos/data/celltowers/towers.db"
echo ""
echo "==================================================================="