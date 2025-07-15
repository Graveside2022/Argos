#!/bin/bash

# Complete OpenCellID setup script
API_KEY="pk.d6291c07a2907c915cd8994fb22bc189"
DB_DIR="/home/ubuntu/projects/Argos/data/celltowers"

echo "Setting up OpenCellID database..."
cd "$DB_DIR"

# Remove existing database
rm -f towers.db

# Download if CSV doesn't exist
if [ ! -f "cell_towers.csv" ]; then
    echo "Downloading OpenCellID database..."
    curl -L -o cell_towers.csv.gz "https://opencellid.org/ocid/downloads?token=${API_KEY}&type=full&file=cell_towers.csv.gz"
    
    echo "Extracting database..."
    gunzip cell_towers.csv.gz
fi

# Check if CSV exists
if [ ! -f "cell_towers.csv" ]; then
    echo "Error: cell_towers.csv not found!"
    exit 1
fi

echo "CSV file size: $(du -h cell_towers.csv | cut -f1)"
echo "Creating SQLite database..."
echo "This may take 5-10 minutes..."

# Create and import in one go
sqlite3 towers.db << 'EOF'
-- Create table
CREATE TABLE IF NOT EXISTS cell_towers (
    radio TEXT,
    mcc INTEGER,
    mnc INTEGER,  -- renamed from 'net'
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

-- Import CSV
.mode csv
.headers on
.import cell_towers.csv temp_import

-- Copy data with column rename
INSERT INTO cell_towers 
SELECT radio, mcc, net as mnc, area, cell, unit, lon, lat, range, samples, changeable, created, updated, averageSignal
FROM temp_import
WHERE radio IS NOT NULL;

-- Drop temp table
DROP TABLE temp_import;

-- Create indexes
CREATE INDEX idx_mcc_mnc_area_cell ON cell_towers(mcc, mnc, area, cell);
CREATE INDEX idx_coordinates ON cell_towers(lat, lon);
CREATE INDEX idx_mcc ON cell_towers(mcc);

-- Show statistics
SELECT 'Total towers: ' || COUNT(*) FROM cell_towers;
SELECT 'Countries: ' || COUNT(DISTINCT mcc) FROM cell_towers;
SELECT 'Networks: ' || COUNT(DISTINCT mcc || '-' || mnc) FROM cell_towers;

-- Sample data
SELECT 'Sample towers:';
SELECT mcc, mnc, area, cell, lat, lon FROM cell_towers LIMIT 5;

-- Optimize
VACUUM;
EOF

# Clean up
echo "Cleaning up CSV file..."
rm -f cell_towers.csv

# Final size
DB_SIZE=$(du -h towers.db | cut -f1)
echo ""
echo "=========================================="
echo "OpenCellID database setup complete!"
echo "Database: $DB_DIR/towers.db"
echo "Size: $DB_SIZE"
echo "Ready for offline tower lookups!"
echo "=========================================="