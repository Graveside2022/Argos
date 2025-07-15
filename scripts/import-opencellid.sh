#!/bin/bash

# Import OpenCellID CSV into SQLite database
DB_DIR="/home/ubuntu/projects/Argos/data/celltowers"

echo "Importing OpenCellID data into SQLite..."
echo "This may take 10-20 minutes..."

cd "$DB_DIR"

# Create the database and import CSV
sqlite3 towers.db << 'EOF'
-- Create table with proper schema
CREATE TABLE IF NOT EXISTS cell_towers (
    radio TEXT,
    mcc INTEGER,
    net INTEGER,  -- This is MNC
    area INTEGER,  -- This is LAC  
    cell INTEGER,  -- This is CI
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

-- Import CSV (skip header)
.mode csv
.import --skip 1 cell_towers.csv cell_towers

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_mcc_net_area_cell ON cell_towers(mcc, net, area, cell);
CREATE INDEX IF NOT EXISTS idx_coordinates ON cell_towers(lat, lon);
CREATE INDEX IF NOT EXISTS idx_mcc ON cell_towers(mcc);

-- Show statistics
SELECT COUNT(*) as total_towers FROM cell_towers;
SELECT COUNT(DISTINCT mcc) as countries FROM cell_towers;
SELECT COUNT(DISTINCT mcc || '-' || net) as networks FROM cell_towers;

-- Rename 'net' column to 'mnc' for consistency with our API
ALTER TABLE cell_towers RENAME COLUMN net TO mnc;

-- Optimize database
VACUUM;
EOF

# Clean up CSV file
echo "Cleaning up..."
rm -f cell_towers.csv

# Check final database
DB_SIZE=$(du -h towers.db | cut -f1)
echo ""
echo "=========================================="
echo "Database import complete!"
echo "Database location: $DB_DIR/towers.db"
echo "Database size: $DB_SIZE"
echo "=========================================="