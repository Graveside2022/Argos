import { db } from './index';
import type { Signal } from './schema';

export const signalsRepository = {
  findById(id: string): Signal | null {
    const stmt = db.prepare('SELECT * FROM signals WHERE signal_id = ?');
    return stmt.get(id) as Signal | null;
  },
  findRecent(limit = 100): Signal[] {
    const stmt = db.prepare('SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as Signal[];
  }
};