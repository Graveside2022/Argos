-- Migration 002: Fix Cleanup Views
-- This migration fixes the signals_to_delete view that had incorrect column reference

-- Fix the signals_to_delete view
DROP VIEW IF EXISTS signals_to_delete;
CREATE VIEW IF NOT EXISTS signals_to_delete AS
SELECT record_id as signal_id
FROM retention_policy_violations
WHERE table_name = 'signals';