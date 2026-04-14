-- Migration 20260412: Reports & Missions feature
-- Adds mission tracking, capture snapshots, generated reports, and a
-- capture_emitters snapshot table that the EMCON diff engine reads from.
-- Replaces the plan's invalid `ALTER TABLE emitters` step (no such table exists).

CREATE TABLE IF NOT EXISTS missions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('sitrep-loop', 'emcon-survey')),
  unit        TEXT,
  ao_mgrs     TEXT,
  created_at  INTEGER NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_missions_active ON missions(active);
CREATE INDEX IF NOT EXISTS idx_missions_created ON missions(created_at DESC);

CREATE TABLE IF NOT EXISTS captures (
  id            TEXT PRIMARY KEY,
  mission_id    TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK(role IN ('baseline', 'posture', 'tick')),
  start_dtg     INTEGER NOT NULL,
  end_dtg       INTEGER,
  loadout_hash  TEXT NOT NULL,
  loadout_json  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK(status IN ('running', 'complete', 'aborted'))
);
CREATE INDEX IF NOT EXISTS idx_captures_mission ON captures(mission_id);
CREATE INDEX IF NOT EXISTS idx_captures_role ON captures(mission_id, role);

-- Snapshot of emitter-like rows captured at the moment a capture stops.
-- Sourced from devices/networks/signals/relationships at end_dtg time.
-- This is what the EMCON diff engine reads — the live tables can churn freely
-- after a capture is complete without affecting prior reports.
CREATE TABLE IF NOT EXISTS capture_emitters (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id      TEXT NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  source_table    TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  signal_type     TEXT NOT NULL,
  identifier      TEXT,
  fingerprint_key TEXT NOT NULL,
  freq_hz         INTEGER,
  power_dbm       REAL,
  modulation      TEXT,
  mgrs            TEXT,
  classification  TEXT,
  sensor_tool     TEXT,
  raw_json        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cap_emit_capture ON capture_emitters(capture_id);
CREATE INDEX IF NOT EXISTS idx_cap_emit_fingerprint ON capture_emitters(capture_id, fingerprint_key);

CREATE TABLE IF NOT EXISTS reports (
  id               TEXT PRIMARY KEY,
  mission_id       TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK(type IN ('sitrep', 'emcon-survey')),
  title            TEXT NOT NULL,
  generated_at     INTEGER NOT NULL,
  capture_ids      TEXT NOT NULL,
  flagged_hostile  INTEGER NOT NULL DEFAULT 0,
  flagged_suspect  INTEGER NOT NULL DEFAULT 0,
  emitter_count    INTEGER NOT NULL DEFAULT 0,
  source_qmd_path  TEXT NOT NULL,
  html_path        TEXT NOT NULL,
  pdf_path         TEXT,
  slides_html_path TEXT,
  slides_pdf_path  TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_mission ON reports(mission_id);
CREATE INDEX IF NOT EXISTS idx_reports_generated ON reports(generated_at DESC);
