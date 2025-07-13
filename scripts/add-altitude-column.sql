-- Manual migration script to add altitude column to existing databases
-- Run this script if you have an existing database without the altitude column

-- First, check if the column already exists
-- SQLite doesn't have a direct way to check column existence, so we use a workaround
BEGIN TRANSACTION;

-- Create a temporary table with the new schema
CREATE TABLE IF NOT EXISTS signals_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id TEXT UNIQUE NOT NULL,
    device_id TEXT,
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL DEFAULT 0,
    power REAL NOT NULL,
    frequency REAL NOT NULL,
    bandwidth REAL,
    modulation TEXT,
    source TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Copy data from the old table (if it exists and doesn't have altitude)
INSERT OR IGNORE INTO signals_new 
SELECT 
    id,
    signal_id,
    device_id,
    timestamp,
    latitude,
    longitude,
    0 as altitude,  -- Default altitude to 0 for existing records
    power,
    frequency,
    bandwidth,
    modulation,
    source,
    metadata
FROM signals;

-- Drop the old table
DROP TABLE IF EXISTS signals;

-- Rename the new table
ALTER TABLE signals_new RENAME TO signals;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_location ON signals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_signals_frequency ON signals(frequency);
CREATE INDEX IF NOT EXISTS idx_signals_power ON signals(power);
CREATE INDEX IF NOT EXISTS idx_signals_altitude ON signals(altitude);
CREATE INDEX IF NOT EXISTS idx_signals_device ON signals(device_id);
CREATE INDEX IF NOT EXISTS idx_signals_spatial_grid ON signals(
    CAST(latitude * 10000 AS INTEGER), 
    CAST(longitude * 10000 AS INTEGER)
);

COMMIT;

-- Verify the schema
.schema signals