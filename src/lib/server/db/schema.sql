-- RF Signal Database Schema
-- Using SQLite with spatial capabilities

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Devices table (unique RF emitters)
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL, -- Unique identifier (MAC or generated)
    type TEXT NOT NULL, -- 'ap', 'client', 'bluetooth', 'unknown'
    manufacturer TEXT,
    first_seen INTEGER NOT NULL, -- Unix timestamp
    last_seen INTEGER NOT NULL,
    avg_power REAL,
    freq_min REAL,
    freq_max REAL,
    metadata TEXT -- JSON field for additional data
);

-- Signals table (individual RF measurements)
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id TEXT UNIQUE NOT NULL,
    device_id TEXT,
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL DEFAULT 0, -- Altitude in meters (for drone/elevated signals)
    power REAL NOT NULL, -- dBm
    frequency REAL NOT NULL, -- MHz
    bandwidth REAL,
    modulation TEXT,
    source TEXT NOT NULL, -- 'hackrf', 'kismet', etc
    metadata TEXT, -- JSON field
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Networks table (WiFi networks, Bluetooth groups)
CREATE TABLE IF NOT EXISTS networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network_id TEXT UNIQUE NOT NULL,
    name TEXT, -- SSID or network name
    type TEXT NOT NULL, -- 'wifi', 'bluetooth', 'cellular'
    encryption TEXT,
    channel INTEGER,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    center_lat REAL,
    center_lon REAL,
    radius REAL -- Coverage radius in meters
);

-- Device relationships (connections between devices)
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_device_id TEXT NOT NULL,
    target_device_id TEXT NOT NULL,
    network_id TEXT,
    relationship_type TEXT NOT NULL, -- 'connected', 'associated', 'paired'
    strength REAL, -- 0-1 normalized
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    FOREIGN KEY (source_device_id) REFERENCES devices(device_id),
    FOREIGN KEY (target_device_id) REFERENCES devices(device_id),
    FOREIGN KEY (network_id) REFERENCES networks(network_id),
    UNIQUE(source_device_id, target_device_id, relationship_type)
);

-- Patterns table (AI-detected patterns)
CREATE TABLE IF NOT EXISTS patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'new_device', 'moving_signal', etc
    priority TEXT NOT NULL, -- 'high', 'medium', 'low'
    confidence REAL NOT NULL, -- 0-1
    description TEXT,
    timestamp INTEGER NOT NULL,
    expires_at INTEGER,
    metadata TEXT -- JSON with pattern-specific data
);

-- Pattern signals junction table
CREATE TABLE IF NOT EXISTS pattern_signals (
    pattern_id TEXT NOT NULL,
    signal_id TEXT NOT NULL,
    FOREIGN KEY (pattern_id) REFERENCES patterns(pattern_id),
    FOREIGN KEY (signal_id) REFERENCES signals(signal_id),
    PRIMARY KEY (pattern_id, signal_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_location ON signals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_signals_frequency ON signals(frequency);
CREATE INDEX IF NOT EXISTS idx_signals_power ON signals(power);
CREATE INDEX IF NOT EXISTS idx_signals_altitude ON signals(altitude);
CREATE INDEX IF NOT EXISTS idx_signals_device ON signals(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_relationships_devices ON relationships(source_device_id, target_device_id);
CREATE INDEX IF NOT EXISTS idx_patterns_timestamp ON patterns(timestamp);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type);

-- Spatial index (simulated with grid-based approach)
CREATE INDEX IF NOT EXISTS idx_signals_spatial_grid ON signals(
    CAST(latitude * 10000 AS INTEGER), 
    CAST(longitude * 10000 AS INTEGER)
);

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_devices AS
SELECT * FROM devices 
WHERE last_seen > (strftime('%s', 'now') - 300) * 1000; -- Active in last 5 minutes

CREATE VIEW IF NOT EXISTS recent_signals AS
SELECT * FROM signals 
WHERE timestamp > (strftime('%s', 'now') - 60) * 1000; -- Last minute

CREATE VIEW IF NOT EXISTS network_summary AS
SELECT 
    n.*,
    COUNT(DISTINCT r.source_device_id) + COUNT(DISTINCT r.target_device_id) as device_count
FROM networks n
LEFT JOIN relationships r ON n.network_id = r.network_id
GROUP BY n.network_id;