# Database Schema

## SQLite Schema with R-tree Spatial Index

```sql
-- Enable R-tree module for spatial indexing
-- This is built into SQLite by default

-- Main signals table
CREATE TABLE signals (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    frequency REAL NOT NULL,
    rssi REAL NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    drone_id TEXT,
    mission_id TEXT,
    modulation TEXT,
    bandwidth REAL,
    metadata TEXT, -- JSON
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (drone_id) REFERENCES drones(id),
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- R-tree spatial index for fast geographic queries
CREATE VIRTUAL TABLE signals_spatial USING rtree(
    id,              -- Integer primary key
    min_lat, max_lat,
    min_lon, max_lon
);

-- Trigger to maintain spatial index
CREATE TRIGGER signals_spatial_insert AFTER INSERT ON signals
BEGIN
    INSERT INTO signals_spatial (id, min_lat, max_lat, min_lon, max_lon)
    VALUES (
        new.rowid,
        new.latitude, new.latitude,
        new.longitude, new.longitude
    );
END;

-- Indexes for common queries
CREATE INDEX idx_signals_timestamp ON signals(timestamp);
CREATE INDEX idx_signals_frequency ON signals(frequency);
CREATE INDEX idx_signals_drone_mission ON signals(drone_id, mission_id);

-- Missions table
CREATE TABLE missions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('sweep', 'track', 'patrol')) NOT NULL,
    status TEXT CHECK(status IN ('planned', 'active', 'completed', 'aborted')) DEFAULT 'planned',
    start_time INTEGER,
    end_time INTEGER,
    area TEXT NOT NULL, -- GeoJSON
    parameters TEXT, -- JSON
    drone_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (drone_id) REFERENCES drones(id)
);

-- Drones table
CREATE TABLE drones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    status TEXT CHECK(status IN ('offline', 'ready', 'flying', 'error')) DEFAULT 'offline',
    last_telemetry TEXT, -- JSON
    capabilities TEXT, -- JSON array
    home_location TEXT, -- JSON point
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Sweep sessions table
CREATE TABLE sweep_sessions (
    id TEXT PRIMARY KEY,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    frequency_start REAL NOT NULL,
    frequency_end REAL NOT NULL,
    step_size REAL NOT NULL,
    antenna_gain REAL DEFAULT 0,
    signal_count INTEGER DEFAULT 0,
    drone_id TEXT,
    mission_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (drone_id) REFERENCES drones(id),
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);

-- Cell towers table
CREATE TABLE cell_towers (
    id TEXT PRIMARY KEY,
    mcc TEXT NOT NULL,
    mnc TEXT NOT NULL,
    lac INTEGER NOT NULL,
    cell_id INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    signal_strength REAL,
    last_seen INTEGER NOT NULL,
    technology TEXT CHECK(technology IN ('2G', '3G', '4G', '5G')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(mcc, mnc, lac, cell_id)
);

-- Signal classifications
CREATE TABLE signal_classifications (
    id TEXT PRIMARY KEY,
    signal_id TEXT NOT NULL,
    classification TEXT NOT NULL,
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
    classifier_version TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (signal_id) REFERENCES signals(id)
);

-- Hardware devices
CREATE TABLE hardware_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    serial_number TEXT,
    firmware_version TEXT,
    capabilities TEXT, -- JSON
    last_seen INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Views for common queries
CREATE VIEW active_missions AS
SELECT m.*, d.name as drone_name, d.status as drone_status
FROM missions m
LEFT JOIN drones d ON m.drone_id = d.id
WHERE m.status = 'active';

CREATE VIEW recent_signals AS
SELECT s.*, d.name as drone_name
FROM signals s
LEFT JOIN drones d ON s.drone_id = d.id
WHERE s.timestamp > strftime('%s', 'now', '-1 hour')
ORDER BY s.timestamp DESC;

-- Function to find signals within radius (using R-tree)
-- Usage: SELECT * FROM signals WHERE id IN (
--   SELECT id FROM signals_spatial 
--   WHERE min_lat >= :lat - :radius_deg 
--   AND max_lat <= :lat + :radius_deg
--   AND min_lon >= :lon - :radius_deg 
--   AND max_lon <= :lon + :radius_deg
-- );
```
