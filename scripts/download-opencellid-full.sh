#!/bin/bash

# Download full OpenCellID database
# Note: Only 2 downloads per day are allowed

API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
DB_DIR="/home/ubuntu/projects/Argos/data/celltowers"

echo "OpenCellID Database Downloader"
echo "=============================="
echo "Note: OpenCellID limits downloads to 2 per day"
echo ""

cd "$DB_DIR"

# Check if we already have the full database
if [ -f "towers.db" ]; then
    TOWER_COUNT=$(sqlite3 towers.db "SELECT COUNT(*) FROM cell_towers;" 2>/dev/null || echo "0")
    if [ "$TOWER_COUNT" -gt "1000" ]; then
        echo "Full database already exists with $TOWER_COUNT towers"
        echo "To re-download, delete towers.db first"
        exit 0
    fi
fi

echo "Attempting to download full OpenCellID database..."
echo "This is a ~100MB compressed file that expands to ~600MB"

# Download with progress
curl -L -f --progress-bar \
    -o cell_towers.csv.gz \
    "https://opencellid.org/ocid/downloads?token=${API_KEY}&type=full&file=cell_towers.csv.gz"

# Check if download was successful
if [ $? -ne 0 ] || [ ! -f "cell_towers.csv.gz" ]; then
    echo "Download failed! Possible reasons:"
    echo "- Rate limited (2 downloads per day)"
    echo "- Invalid API key"
    echo "- Network error"
    exit 1
fi

# Check if it's actually a gzip file
if ! file cell_towers.csv.gz | grep -q "gzip compressed"; then
    echo "Downloaded file is not a valid gzip archive"
    echo "Possibly hit rate limit. Response:"
    head -1 cell_towers.csv.gz
    rm -f cell_towers.csv.gz
    exit 1
fi

echo "Download successful! Extracting..."
gunzip -f cell_towers.csv.gz

if [ ! -f "cell_towers.csv" ]; then
    echo "Extraction failed!"
    exit 1
fi

CSV_SIZE=$(du -h cell_towers.csv | cut -f1)
echo "CSV extracted: $CSV_SIZE"

echo "Importing into SQLite database..."
echo "This will take 5-15 minutes..."

# Remove old database
rm -f towers.db

# Import with progress indicator
sqlite3 towers.db << 'EOF'
.timer on

-- Create table
CREATE TABLE IF NOT EXISTS cell_towers (
    radio TEXT,
    mcc INTEGER,
    mnc INTEGER,
    area INTEGER,
    cell INTEGER,
    unit INTEGER,
    lon REAL,
    lat REAL,
    range INTEGER,
    samples INTEGER,
    changeable INTEGER,
    created INTEGER,
    updated INTEGER,
    averageSignal INTEGER
);

-- Import CSV
.mode csv
.headers on
PRAGMA synchronous = OFF;
PRAGMA journal_mode = MEMORY;

-- Create temp table for import
CREATE TABLE temp_import (
    radio TEXT,
    mcc INTEGER,
    net INTEGER,
    area INTEGER,
    cell INTEGER,
    unit INTEGER,
    lon REAL,
    lat REAL,
    range INTEGER,
    samples INTEGER,
    changeable INTEGER,
    created INTEGER,
    updated INTEGER,
    averageSignal INTEGER
);

.import cell_towers.csv temp_import

-- Copy with column rename
INSERT INTO cell_towers 
SELECT radio, mcc, net as mnc, area, cell, unit, lon, lat, range, samples, changeable, created, updated, averageSignal
FROM temp_import
WHERE radio IS NOT NULL;

DROP TABLE temp_import;

-- Create indexes
CREATE INDEX idx_mcc_mnc_area_cell ON cell_towers(mcc, mnc, area, cell);
CREATE INDEX idx_coordinates ON cell_towers(lat, lon);
CREATE INDEX idx_mcc ON cell_towers(mcc);

-- Statistics
SELECT 'Total towers imported: ' || COUNT(*) FROM cell_towers;
SELECT 'Countries: ' || COUNT(DISTINCT mcc) FROM cell_towers;
SELECT 'Networks: ' || COUNT(DISTINCT mcc || '-' || mnc) FROM cell_towers;

-- Optimize
VACUUM;
EOF

# Clean up
echo "Cleaning up..."
rm -f cell_towers.csv

# Final stats
DB_SIZE=$(du -h towers.db | cut -f1)
TOWER_COUNT=$(sqlite3 towers.db "SELECT COUNT(*) FROM cell_towers;")

echo ""
echo "=========================================="
echo "OpenCellID import complete!"
echo "Database: $DB_DIR/towers.db"
echo "Size: $DB_SIZE"
echo "Towers: $TOWER_COUNT"
echo ""
echo "The database is ready for offline lookups!"
echo "=========================================="