-- Database Cleanup and Optimization Strategy for Argos RF Signal Database
-- Version: 1.0
-- Database: SQLite with better-sqlite3

-- ============================================
-- 1. AUTOMATIC CLEANUP TRIGGERS
-- ============================================

-- Trigger to update device statistics when signals are inserted
DROP TRIGGER IF EXISTS update_device_stats;
CREATE TRIGGER update_device_stats
AFTER INSERT ON signals
BEGIN
    UPDATE devices 
    SET 
        last_seen = NEW.timestamp,
        avg_power = CASE 
            WHEN avg_power IS NULL THEN NEW.power
            ELSE (avg_power * (
                SELECT COUNT(*) FROM signals WHERE device_id = NEW.device_id
            ) - 1 + NEW.power) / (
                SELECT COUNT(*) FROM signals WHERE device_id = NEW.device_id
            )
        END,
        freq_min = CASE 
            WHEN freq_min IS NULL OR NEW.frequency < freq_min THEN NEW.frequency 
            ELSE freq_min 
        END,
        freq_max = CASE 
            WHEN freq_max IS NULL OR NEW.frequency > freq_max THEN NEW.frequency 
            ELSE freq_max 
        END
    WHERE device_id = NEW.device_id;
END;

-- Trigger to clean up orphaned relationships when devices are deleted
DROP TRIGGER IF EXISTS cleanup_orphaned_relationships;
CREATE TRIGGER cleanup_orphaned_relationships
AFTER DELETE ON devices
BEGIN
    DELETE FROM relationships 
    WHERE source_device_id = OLD.device_id 
       OR target_device_id = OLD.device_id;
END;

-- Trigger to cleanup pattern associations when signals are deleted
DROP TRIGGER IF EXISTS cleanup_pattern_signals;
CREATE TRIGGER cleanup_pattern_signals
AFTER DELETE ON signals
BEGIN
    DELETE FROM pattern_signals WHERE signal_id = OLD.signal_id;
    
    -- Remove patterns that no longer have any signals
    DELETE FROM patterns 
    WHERE pattern_id IN (
        SELECT p.pattern_id 
        FROM patterns p
        LEFT JOIN pattern_signals ps ON p.pattern_id = ps.pattern_id
        WHERE ps.pattern_id IS NULL
    );
END;

-- ============================================
-- 2. DATA RETENTION POLICIES
-- ============================================

-- View for identifying stale data based on retention policies
CREATE VIEW IF NOT EXISTS retention_policy_violations AS
SELECT 
    'signals' as table_name,
    signal_id as record_id,
    timestamp,
    CASE 
        -- High-frequency scanning data: keep 24 hours
        WHEN source = 'hackrf' AND frequency > 2400 THEN timestamp + 86400000
        -- Normal WiFi/Bluetooth signals: keep 7 days
        WHEN source IN ('kismet', 'wifi') THEN timestamp + 604800000
        -- Unknown/other signals: keep 3 days
        ELSE timestamp + 259200000
    END as expires_at,
    strftime('%s', 'now') * 1000 as current_time
FROM signals
WHERE timestamp < (strftime('%s', 'now') * 1000 - 
    CASE 
        WHEN source = 'hackrf' AND frequency > 2400 THEN 86400000
        WHEN source IN ('kismet', 'wifi') THEN 604800000
        ELSE 259200000
    END
);

-- View for devices that haven't been seen recently
CREATE VIEW IF NOT EXISTS inactive_devices AS
SELECT 
    device_id,
    type,
    last_seen,
    (strftime('%s', 'now') * 1000 - last_seen) / 86400000.0 as days_inactive
FROM devices
WHERE last_seen < (strftime('%s', 'now') * 1000 - 604800000); -- 7 days

-- View for expired patterns
CREATE VIEW IF NOT EXISTS expired_patterns AS
SELECT * FROM patterns
WHERE expires_at IS NOT NULL 
  AND expires_at < strftime('%s', 'now') * 1000;

-- ============================================
-- 3. AGGREGATION TABLES SCHEMA
-- ============================================

-- Hourly signal statistics
CREATE TABLE IF NOT EXISTS signal_stats_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour_timestamp INTEGER NOT NULL, -- Start of hour
    total_signals INTEGER NOT NULL,
    unique_devices INTEGER NOT NULL,
    avg_power REAL,
    min_power REAL,
    max_power REAL,
    dominant_frequency REAL,
    coverage_area REAL, -- Approximate area in km²
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(hour_timestamp)
);

-- Daily device summary
CREATE TABLE IF NOT EXISTS device_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_timestamp INTEGER NOT NULL, -- Start of day
    device_id TEXT NOT NULL,
    signal_count INTEGER NOT NULL,
    avg_power REAL,
    freq_min REAL,
    freq_max REAL,
    first_seen_hour INTEGER,
    last_seen_hour INTEGER,
    active_hours INTEGER, -- Number of hours device was active
    avg_lat REAL,
    avg_lon REAL,
    movement_distance REAL, -- Total distance moved in meters
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(day_timestamp, device_id)
);

-- Network activity summary
CREATE TABLE IF NOT EXISTS network_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_timestamp INTEGER NOT NULL,
    network_id TEXT NOT NULL,
    device_count INTEGER NOT NULL,
    connection_count INTEGER NOT NULL,
    avg_signal_strength REAL,
    peak_hour INTEGER, -- Hour with most activity
    total_data_points INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(day_timestamp, network_id)
);

-- Spatial heatmap aggregation
CREATE TABLE IF NOT EXISTS spatial_heatmap_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour_timestamp INTEGER NOT NULL,
    grid_lat INTEGER NOT NULL, -- Grid cell latitude
    grid_lon INTEGER NOT NULL, -- Grid cell longitude
    signal_count INTEGER NOT NULL,
    unique_devices INTEGER NOT NULL,
    avg_power REAL,
    dominant_source TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(hour_timestamp, grid_lat, grid_lon)
);

-- Create indexes for aggregation tables
CREATE INDEX IF NOT EXISTS idx_signal_stats_hourly_timestamp ON signal_stats_hourly(hour_timestamp);
CREATE INDEX IF NOT EXISTS idx_device_stats_daily_timestamp ON device_stats_daily(day_timestamp);
CREATE INDEX IF NOT EXISTS idx_device_stats_daily_device ON device_stats_daily(device_id);
CREATE INDEX IF NOT EXISTS idx_network_stats_daily_timestamp ON network_stats_daily(day_timestamp);
CREATE INDEX IF NOT EXISTS idx_spatial_heatmap_grid ON spatial_heatmap_hourly(grid_lat, grid_lon);

-- ============================================
-- 4. CLEANUP PROCEDURES (as Views for SQLite)
-- ============================================

-- View to identify signals to delete based on retention policy
CREATE VIEW IF NOT EXISTS signals_to_delete AS
SELECT signal_id
FROM retention_policy_violations
WHERE table_name = 'signals';

-- View to identify devices with no recent signals
CREATE VIEW IF NOT EXISTS devices_to_delete AS
SELECT d.device_id
FROM devices d
WHERE NOT EXISTS (
    SELECT 1 FROM signals s 
    WHERE s.device_id = d.device_id 
    AND s.timestamp > (strftime('%s', 'now') * 1000 - 604800000)
);

-- View to identify orphaned relationships
CREATE VIEW IF NOT EXISTS relationships_to_delete AS
SELECT r.id
FROM relationships r
WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.source_device_id)
   OR NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.target_device_id);

-- ============================================
-- 5. MAINTENANCE VIEWS
-- ============================================

-- Database size analysis
CREATE VIEW IF NOT EXISTS table_sizes AS
SELECT 
    name as table_name,
    (SELECT COUNT(*) FROM devices WHERE name = 'devices') as row_count
FROM sqlite_master 
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
UNION ALL
SELECT 'signals', COUNT(*) FROM signals
UNION ALL
SELECT 'relationships', COUNT(*) FROM relationships
UNION ALL
SELECT 'patterns', COUNT(*) FROM patterns
UNION ALL
SELECT 'networks', COUNT(*) FROM networks;

-- Index usage statistics (approximation)
CREATE VIEW IF NOT EXISTS index_statistics AS
SELECT 
    name as index_name,
    tbl_name as table_name,
    CASE 
        WHEN name LIKE 'idx_signals_timestamp' THEN 'High'
        WHEN name LIKE 'idx_signals_spatial_grid' THEN 'High'
        WHEN name LIKE 'idx_devices_last_seen' THEN 'Medium'
        ELSE 'Low'
    END as usage_frequency
FROM sqlite_master 
WHERE type = 'index' AND name NOT LIKE 'sqlite_%';

-- Data growth trends
CREATE VIEW IF NOT EXISTS data_growth_hourly AS
SELECT 
    strftime('%Y-%m-%d %H:00:00', timestamp/1000, 'unixepoch') as hour,
    COUNT(*) as signal_count,
    COUNT(DISTINCT device_id) as unique_devices
FROM signals
WHERE timestamp > (strftime('%s', 'now') * 1000 - 86400000) -- Last 24 hours
GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp/1000, 'unixepoch')
ORDER BY hour DESC;