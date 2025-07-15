#!/bin/bash

# Create sample cell tower database for testing
DB_DIR="/home/ubuntu/projects/Argos/data/celltowers"
cd "$DB_DIR"

echo "Creating sample cell tower database..."

# Remove old files
rm -f towers.db cell_towers.csv.gz

# Create SQLite database with sample data
sqlite3 towers.db << 'EOF'
CREATE TABLE IF NOT EXISTS cell_towers (
    radio TEXT,
    mcc INTEGER,
    mnc INTEGER,
    area INTEGER,  -- LAC
    cell INTEGER,  -- CI
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

-- Create indexes
CREATE INDEX idx_mcc_mnc_area_cell ON cell_towers(mcc, mnc, area, cell);
CREATE INDEX idx_coordinates ON cell_towers(lat, lon);

-- Insert sample towers from various countries
-- USA - AT&T
INSERT INTO cell_towers VALUES ('GSM', 310, 410, 12345, 6789, 0, -122.4194, 37.7749, 1000, 50, 1, 1700000000, 1700000000, -65);
INSERT INTO cell_towers VALUES ('GSM', 310, 410, 12345, 6790, 0, -122.4094, 37.7849, 1000, 45, 1, 1700000000, 1700000000, -68);
INSERT INTO cell_towers VALUES ('GSM', 310, 410, 12346, 6791, 0, -122.4294, 37.7649, 1200, 60, 1, 1700000000, 1700000000, -70);

-- USA - Verizon
INSERT INTO cell_towers VALUES ('GSM', 311, 480, 23456, 7890, 0, -118.2437, 34.0522, 1500, 80, 1, 1700000000, 1700000000, -72);
INSERT INTO cell_towers VALUES ('GSM', 311, 480, 23456, 7891, 0, -118.2537, 34.0422, 1500, 75, 1, 1700000000, 1700000000, -74);

-- Germany - T-Mobile
INSERT INTO cell_towers VALUES ('GSM', 262, 1, 23456, 7890, 0, 13.4050, 52.5200, 1500, 100, 1, 1700000000, 1700000000, -70);
INSERT INTO cell_towers VALUES ('GSM', 262, 1, 23456, 7891, 0, 13.4150, 52.5100, 1500, 95, 1, 1700000000, 1700000000, -72);
INSERT INTO cell_towers VALUES ('GSM', 262, 1, 23457, 7892, 0, 13.3950, 52.5300, 1800, 110, 1, 1700000000, 1700000000, -68);

-- Germany - Vodafone
INSERT INTO cell_towers VALUES ('GSM', 262, 2, 34567, 8901, 0, 9.1829, 48.7758, 2000, 120, 1, 1700000000, 1700000000, -75);
INSERT INTO cell_towers VALUES ('GSM', 262, 2, 34567, 8902, 0, 9.1929, 48.7658, 2000, 115, 1, 1700000000, 1700000000, -77);

-- Iran - MCI/Hamrah-e Avval
INSERT INTO cell_towers VALUES ('GSM', 432, 11, 34567, 8901, 0, 51.3890, 35.6892, 2000, 75, 1, 1700000000, 1700000000, -75);
INSERT INTO cell_towers VALUES ('GSM', 432, 11, 34567, 8902, 0, 51.3990, 35.6792, 2000, 70, 1, 1700000000, 1700000000, -77);
INSERT INTO cell_towers VALUES ('GSM', 432, 11, 34568, 8903, 0, 51.3790, 35.6992, 1800, 80, 1, 1700000000, 1700000000, -73);

-- Iran - Irancell
INSERT INTO cell_towers VALUES ('GSM', 432, 35, 45678, 9012, 0, 51.4213, 35.6944, 2500, 90, 1, 1700000000, 1700000000, -78);

-- UK - O2
INSERT INTO cell_towers VALUES ('GSM', 234, 10, 45678, 9012, 0, -0.1276, 51.5074, 1200, 120, 1, 1700000000, 1700000000, -69);
INSERT INTO cell_towers VALUES ('GSM', 234, 10, 45678, 9013, 0, -0.1376, 51.4974, 1200, 115, 1, 1700000000, 1700000000, -71);

-- UK - EE
INSERT INTO cell_towers VALUES ('GSM', 234, 30, 56789, 1234, 0, -0.1180, 51.5099, 1000, 130, 1, 1700000000, 1700000000, -67);

-- Poland - T-Mobile
INSERT INTO cell_towers VALUES ('GSM', 260, 2, 56789, 1234, 0, 21.0122, 52.2297, 1800, 85, 1, 1700000000, 1700000000, -71);
INSERT INTO cell_towers VALUES ('GSM', 260, 2, 56789, 1235, 0, 21.0222, 52.2197, 1800, 82, 1, 1700000000, 1700000000, -73);

-- France - Orange
INSERT INTO cell_towers VALUES ('GSM', 208, 1, 67890, 2345, 0, 2.3522, 48.8566, 1300, 140, 1, 1700000000, 1700000000, -66);
INSERT INTO cell_towers VALUES ('GSM', 208, 1, 67890, 2346, 0, 2.3622, 48.8466, 1300, 135, 1, 1700000000, 1700000000, -68);

-- Italy - TIM
INSERT INTO cell_towers VALUES ('GSM', 222, 1, 78901, 3456, 0, 12.4964, 41.9028, 1100, 110, 1, 1700000000, 1700000000, -70);

-- Spain - Movistar
INSERT INTO cell_towers VALUES ('GSM', 214, 7, 89012, 4567, 0, -3.7038, 40.4168, 1400, 125, 1, 1700000000, 1700000000, -72);

-- Canada - Rogers
INSERT INTO cell_towers VALUES ('GSM', 302, 720, 90123, 5678, 0, -79.3832, 43.6532, 1600, 95, 1, 1700000000, 1700000000, -74);

-- Australia - Telstra
INSERT INTO cell_towers VALUES ('GSM', 505, 1, 12340, 6789, 0, 151.2093, -33.8688, 2000, 105, 1, 1700000000, 1700000000, -76);

-- Japan - NTT DoCoMo
INSERT INTO cell_towers VALUES ('GSM', 440, 10, 23450, 7890, 0, 139.6503, 35.6762, 900, 150, 1, 1700000000, 1700000000, -65);

-- Brazil - Claro
INSERT INTO cell_towers VALUES ('GSM', 724, 5, 34560, 8901, 0, -46.6333, -23.5505, 1700, 88, 1, 1700000000, 1700000000, -78);

-- India - Airtel
INSERT INTO cell_towers VALUES ('GSM', 404, 10, 45670, 9012, 0, 77.2090, 28.6139, 2200, 92, 1, 1700000000, 1700000000, -80);

-- Russia - MTS
INSERT INTO cell_towers VALUES ('GSM', 250, 1, 56780, 1234, 0, 37.6173, 55.7558, 1900, 78, 1, 1700000000, 1700000000, -82);

-- China - China Mobile
INSERT INTO cell_towers VALUES ('GSM', 460, 0, 67890, 2345, 0, 116.4074, 39.9042, 2500, 160, 1, 1700000000, 1700000000, -64);

-- Fake/Test towers for security testing
INSERT INTO cell_towers VALUES ('GSM', 001, 1, 99999, 9999, 0, -122.4194, 37.7749, 500, 5, 1, 1700000000, 1700000000, -90);
INSERT INTO cell_towers VALUES ('GSM', 999, 99, 88888, 8888, 0, 13.4050, 52.5200, 300, 3, 1, 1700000000, 1700000000, -95);

-- Show statistics
SELECT 'Total towers: ' || COUNT(*) FROM cell_towers;
SELECT 'Countries: ' || COUNT(DISTINCT mcc) FROM cell_towers;
SELECT 'Networks: ' || COUNT(DISTINCT mcc || '-' || mnc) FROM cell_towers;

VACUUM;
EOF

# Check result
DB_SIZE=$(du -h towers.db | cut -f1)

echo ""
echo "=========================================="
echo "Sample cell tower database created!"
echo "Database: $DB_DIR/towers.db"
echo "Size: $DB_SIZE"
echo ""
echo "Contains sample towers from:"
echo "- USA, Germany, Iran, UK, Poland"
echo "- France, Italy, Spain, Canada"
echo "- Australia, Japan, Brazil, India"  
echo "- Russia, China"
echo "- Plus fake towers for testing"
echo ""
echo "Note: This is sample data for testing."
echo "For real data, download from OpenCellID"
echo "when not rate limited (2 downloads/day)."
echo "=========================================="