import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import path from 'path';

export const GET: RequestHandler = async () => {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'celltowers', 'towers.db');
    const db = new Database(dbPath, { readonly: true });
    
    // Test queries
    const results: any = {};
    
    // 1. Count total towers
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM towers');
    results.totalTowers = totalStmt.get();
    
    // 2. Count AT&T towers
    const attStmt = db.prepare('SELECT COUNT(*) as count FROM towers WHERE mcc = 310 AND net = 410');
    results.attTowers = attStmt.get();
    
    // 3. Get sample towers
    const sampleStmt = db.prepare(`
      SELECT mcc, net, area, cell, lat, lon, range 
      FROM towers 
      WHERE mcc = 310 AND net = 410 
      LIMIT 5
    `);
    results.sampleTowers = sampleStmt.all();
    
    // 4. Test a specific lookup
    const lookupStmt = db.prepare(`
      SELECT lat, lon, range, created, updated, samples
      FROM towers 
      WHERE mcc = ? AND net = ? AND area = ? AND cell = ?
    `);
    
    // Use first sample tower for lookup test if available
    if (results.sampleTowers.length > 0) {
      const sample = results.sampleTowers[0];
      results.lookupTest = {
        query: { mcc: sample.mcc, net: sample.net, area: sample.area, cell: sample.cell },
        result: lookupStmt.get(sample.mcc, sample.net, sample.area, sample.cell)
      };
    }
    
    db.close();
    
    return json({
      success: true,
      dbPath: dbPath,
      results: results
    });
    
  } catch (error: unknown) {
    return json({
      success: false,
      message: 'Database test failed',
      error: (error as Error).message
    }, { status: 500 });
  }
};