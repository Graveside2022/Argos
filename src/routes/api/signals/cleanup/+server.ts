import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Database from 'better-sqlite3';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { maxAge } = await request.json() as { maxAge?: number };
    
    // Open database directly for cleanup operation
    const db = new Database('./rf_signals.db');
    db.pragma('journal_mode = WAL');
    
    try {
      // Delete old signals
      const cutoff = Date.now() - (maxAge || 3600000); // Default 1 hour
      
      const result = db.prepare(`
        DELETE FROM signals 
        WHERE timestamp < ?
      `).run(cutoff);
      
      // Also clean up orphaned devices
      db.prepare(`
        DELETE FROM devices 
        WHERE device_id NOT IN (
          SELECT DISTINCT device_id FROM signals WHERE device_id IS NOT NULL
        )
      `).run();
      
      return json({ 
        success: true,
        deleted: result.changes 
      });
    } finally {
      db.close();
    }
  } catch (err: unknown) {
    console.error('Error cleaning up signals:', err);
    return error(500, 'Failed to clean up signals');
  }
};