-- Migration 004: Add Tactical Kill Chain Tables
-- Campaign tracking, engagement steps, and module execution audit log.
-- Used by the tactical/ execution layer (Claude Code + PentAGI/Artemis modules).

-- Top-level engagement tracking
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
    target_description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at);

-- Individual attack/scan steps within a campaign
CREATE TABLE IF NOT EXISTS engagements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    module_name TEXT NOT NULL,
    target TEXT,
    parameters TEXT,  -- JSON
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'success', 'failure', 'aborted')),
    result TEXT,      -- JSON
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_engagements_campaign ON engagements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);
CREATE INDEX IF NOT EXISTS idx_engagements_module ON engagements(module_name);

-- Execution audit log — every module invocation
CREATE TABLE IF NOT EXISTS module_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engagement_id INTEGER,  -- nullable for standalone runs
    module_name TEXT NOT NULL,
    args TEXT,      -- JSON
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    duration_ms INTEGER,
    ran_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_module_runs_engagement ON module_runs(engagement_id);
CREATE INDEX IF NOT EXISTS idx_module_runs_module ON module_runs(module_name);
CREATE INDEX IF NOT EXISTS idx_module_runs_ran_at ON module_runs(ran_at);
