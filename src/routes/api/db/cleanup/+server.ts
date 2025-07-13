import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';
import { DatabaseCleanupService } from '$lib/server/db/cleanupService';
import { DatabaseOptimizer } from '$lib/server/db/dbOptimizer';

let optimizer: DatabaseOptimizer | null = null;

// Get cleanup service from database instance
function getCleanupService(): DatabaseCleanupService {
  const db = getRFDatabase();
  let cleanupService = db.getCleanupService();
  
  if (!cleanupService) {
    throw new Error('Cleanup service not initialized');
  }
  
  return cleanupService;
}

// Initialize optimizer
function initializeOptimizer() {
  if (!optimizer) {
    const db = getRFDatabase();
    optimizer = new DatabaseOptimizer(db['db'], {
      cacheSize: -2000,                          // 2MB cache for Pi
      walMode: true,
      synchronous: 'NORMAL',
      mmapSize: 30000000,                        // 30MB memory map
      memoryLimit: 50 * 1024 * 1024             // 50MB memory limit
    });
  }
}

export const GET: RequestHandler = ({ url }) => {
  try {
    initializeOptimizer();
    const cleanupService = getCleanupService();
    
    const action = url.searchParams.get('action') || 'status';
    
    switch (action) {
      case 'status': {
        // Get cleanup statistics
        const stats = cleanupService.getStats();
        const growth = cleanupService.getGrowthTrends(24);
        const health = optimizer?.getHealthReport();
        
        return json({
          success: true,
          stats,
          growth,
          health,
          timestamp: Date.now()
        });
      }
        
      case 'manual': {
        // Run manual cleanup
        const cleanupStats = cleanupService.runCleanup();
        
        return json({
          success: true,
          message: 'Manual cleanup completed',
          stats: cleanupStats,
          timestamp: Date.now()
        });
      }
        
      case 'vacuum': {
        // Run VACUUM
        const vacuumResult = cleanupService.vacuum();
        
        return json({
          success: true,
          message: 'VACUUM completed',
          result: vacuumResult,
          timestamp: Date.now()
        });
      }
        
      case 'analyze': {
        // Update statistics
        cleanupService.analyze();
        optimizer?.analyze();
        
        return json({
          success: true,
          message: 'Database statistics updated',
          timestamp: Date.now()
        });
      }
        
      case 'optimize': {
        // Get optimization suggestions
        const indexAnalysis = optimizer?.getIndexAnalysis();
        const slowQueries = optimizer?.getSlowQueries();
        const pragmas = optimizer?.getPragmaSettings();
        
        return json({
          success: true,
          indexAnalysis,
          slowQueries,
          pragmas,
          timestamp: Date.now()
        });
      }
        
      case 'aggregate': {
        // Run aggregation manually
        cleanupService.runAggregation();
        
        return json({
          success: true,
          message: 'Aggregation completed',
          timestamp: Date.now()
        });
      }
        
      case 'export': {
        // Export aggregated data
        const days = parseInt(url.searchParams.get('days') || '7');
        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);
        
        const exportData = cleanupService.exportAggregatedData(startTime, endTime);
        
        return json({
          success: true,
          data: exportData,
          period: { startTime, endTime, days },
          timestamp: Date.now()
        });
      }
        
      default:
        return json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Database cleanup error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Database cleanup failed'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    initializeOptimizer();
    const cleanupService = getCleanupService();
    
    const body = await request.json() as Record<string, unknown>;
    const { action, config } = body;
    
    switch (action) {
      case 'configure':
        // Update cleanup configuration
        if (config) {
          // Note: Configuration update not supported through API
          // Cleanup service is initialized with database instance
          return json({
            success: false,
            message: 'Configuration must be updated in database initialization',
            timestamp: Date.now()
          });
        }
        
        return json({
          success: true,
          message: 'Configuration updated',
          timestamp: Date.now()
        });
        
      case 'optimize-workload': {
        // Optimize for specific workload
        const workload = body.workload as 'read_heavy' | 'write_heavy' | 'mixed';
        optimizer?.optimizeForWorkload(workload);
        
        return json({
          success: true,
          message: `Optimized for ${workload} workload`,
          timestamp: Date.now()
        });
      }
        
      case 'cleanup-aggregated': {
        // Cleanup old aggregated data
        const daysToKeep = (body.daysToKeep as number) || 30;
        cleanupService.cleanupAggregatedData(daysToKeep);
        
        return json({
          success: true,
          message: `Cleaned up aggregated data older than ${daysToKeep} days`,
          timestamp: Date.now()
        });
      }
        
      default:
        return json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Database cleanup error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Database cleanup failed'
    }, { status: 500 });
  }
};

// Note: Cleanup service lifecycle is managed by the database instance