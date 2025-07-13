/**
 * Error Recovery Service
 * Handles error detection, recovery strategies, and system resilience
 */

import { writable, derived, type Readable } from 'svelte/store';
import { logWarn, logInfo, logError } from '$lib/utils/logger';
import { CircuitBreakerState } from '$lib/types/enums';

interface ErrorEvent {
  id: string;
  service: string;
  error: Error | string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: unknown;
  stackTrace?: string;
}

interface RecoveryStrategy {
  name: string;
  description: string;
  applicable: (error: ErrorEvent) => boolean;
  execute: (error: ErrorEvent) => Promise<boolean>;
  maxAttempts: number;
  cooldownMs: number;
}

interface RecoveryAttempt {
  errorId: string;
  strategy: string;
  attempt: number;
  timestamp: number;
  success: boolean;
  result?: unknown;
}

interface RecoveryState {
  errors: ErrorEvent[];
  recoveryAttempts: RecoveryAttempt[];
  activeRecoveries: Map<string, boolean>;
  errorCounts: Map<string, number>;
  lastRecovery: Map<string, number>;
  circuitBreakers: Map<string, CircuitBreaker>;
}

interface CircuitBreaker {
  state: CircuitBreakerState;
  failures: number;
  lastFailure: number;
  nextRetry: number;
}

interface RecoveryOptions {
  maxErrorHistory: number;
  errorThreshold: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  recoveryTimeout: number;
}

class ErrorRecoveryService {
  private state = writable<RecoveryState>({
    errors: [],
    recoveryAttempts: [],
    activeRecoveries: new Map(),
    errorCounts: new Map(),
    lastRecovery: new Map(),
    circuitBreakers: new Map()
  });
  
  private options: RecoveryOptions = {
    maxErrorHistory: 100,
    errorThreshold: 5,
    circuitBreakerThreshold: 3,
    circuitBreakerTimeout: 60000, // 1 minute
    recoveryTimeout: 30000 // 30 seconds
  };
  
  private strategies: RecoveryStrategy[] = [];
  private errorHandlers: Map<string, (error: ErrorEvent) => void> = new Map();
  
  // Public readable stores
  public readonly errors: Readable<ErrorEvent[]>;
  public readonly activeRecoveries: Readable<number>;
  public readonly errorRate: Readable<number>;
  public readonly circuitBreakers: Readable<Map<string, CircuitBreaker>>;
  
  constructor() {
    this.errors = derived(this.state, $state => $state.errors);
    this.activeRecoveries = derived(this.state, $state => $state.activeRecoveries.size);
    this.errorRate = derived(this.state, $state => {
      const now = Date.now();
      const recentErrors = $state.errors.filter(e => 
        now - e.timestamp < 60000 // Last minute
      );
      return recentErrors.length;
    });
    this.circuitBreakers = derived(this.state, $state => $state.circuitBreakers);
    
    // Register default strategies
    this.registerDefaultStrategies();
  }
  
  /**
   * Initialize the service
   */
  initialize(): void {
    // Set up periodic cleanup
    setInterval(() => {
      void this.cleanupOldData();
      void this.checkCircuitBreakers();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Configure recovery options
   */
  setOptions(options: Partial<RecoveryOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Report an error
   */
  async reportError(
    service: string,
    error: Error | string,
    severity: ErrorEvent['severity'] = 'medium',
    context?: unknown
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      id: `error-${Date.now()}-${Math.random()}`,
      service,
      error,
      timestamp: Date.now(),
      severity,
      context,
      stackTrace: error instanceof Error ? error.stack : undefined
    };
    
    // Check circuit breaker
    if (this.isCircuitOpen(service)) {
      logWarn(`Circuit breaker open for ${service}, skipping error handling`);
      return;
    }
    
    // Add to state
    this.state.update(state => {
      state.errors.push(errorEvent);
      
      // Trim error history
      if (state.errors.length > this.options.maxErrorHistory) {
        state.errors = state.errors.slice(-this.options.maxErrorHistory);
      }
      
      // Update error counts
      const count = (state.errorCounts.get(service) || 0) + 1;
      state.errorCounts.set(service, count);
      
      // Check if circuit breaker should open
      if (count >= this.options.circuitBreakerThreshold) {
        const breaker: CircuitBreaker = {
          state: CircuitBreakerState.Open,
          failures: count,
          lastFailure: Date.now(),
          nextRetry: Date.now() + this.options.circuitBreakerTimeout
        };
        state.circuitBreakers.set(service, breaker);
      }
      
      return state;
    });
    
    // Call error handlers
    const handler = this.errorHandlers.get(service);
    if (handler) {
      try {
        handler(errorEvent);
      } catch (e) {
        logError('Error handler failed:', { error: e });
      }
    }
    
    // Attempt recovery
    await this.attemptRecovery(errorEvent);
  }
  
  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    
    // Sort strategies by priority (could be added to strategy interface)
    this.strategies.sort((_a, _b) => {
      // For now, just maintain insertion order
      return 0;
    });
  }
  
  /**
   * Register an error handler for a service
   */
  registerErrorHandler(service: string, handler: (error: ErrorEvent) => void): void {
    this.errorHandlers.set(service, handler);
  }
  
  /**
   * Attempt recovery for an error
   */
  private async attemptRecovery(error: ErrorEvent): Promise<boolean> {
    // Check if already recovering
    if (this.isRecovering(error.service)) {
      logInfo(`Already recovering ${error.service}`);
      return false;
    }
    
    // Find applicable strategies
    const applicableStrategies = this.strategies.filter(s => s.applicable(error));
    
    if (applicableStrategies.length === 0) {
      logInfo(`No recovery strategies for ${error.service}`);
      return false;
    }
    
    // Mark as recovering
    this.state.update(state => {
      state.activeRecoveries.set(error.service, true);
      return state;
    });
    
    let recovered = false;
    
    // Try each strategy
    for (const strategy of applicableStrategies) {
      const attempts = this.getRecoveryAttempts(error.id, strategy.name);
      
      if (attempts >= strategy.maxAttempts) {
        continue;
      }
      
      // Check cooldown
      const lastAttempt = this.getLastRecoveryTime(error.service, strategy.name);
      if (lastAttempt && Date.now() - lastAttempt < strategy.cooldownMs) {
        continue;
      }
      
      try {
        logInfo(`Attempting recovery: ${strategy.name} for ${error.service}`);
        
        // Execute recovery with timeout
        const result = await this.executeWithTimeout(
          strategy.execute(error),
          this.options.recoveryTimeout
        );
        
        // Record attempt
        this.recordRecoveryAttempt(error.id, strategy.name, attempts + 1, result);
        
        if (result) {
          recovered = true;
          logInfo(`Recovery successful: ${strategy.name} for ${error.service}`);
          
          // Reset error count on successful recovery
          this.state.update(state => {
            state.errorCounts.set(error.service, 0);
            return state;
          });
          
          break;
        }
      } catch (e) {
        logError(`Recovery strategy ${strategy.name} failed:`, { error: e });
        this.recordRecoveryAttempt(error.id, strategy.name, attempts + 1, false);
      }
    }
    
    // Clear recovering flag
    this.state.update(state => {
      state.activeRecoveries.delete(error.service);
      return state;
    });
    
    return recovered;
  }
  
  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    // Service restart strategy
    this.registerStrategy({
      name: 'Service Restart',
      description: 'Restart the failed service',
      applicable: (error) => error.severity === 'high' || error.severity === 'critical',
      execute: async (error) => {
        try {
          if (error.service === 'HackRF') {
            const response = await fetch('/api/hackrf/force-cleanup', { method: 'POST' });
            return response.ok;
          } else if (error.service === 'Kismet') {
            const response = await fetch('/api/kismet/service/restart', { method: 'POST' });
            return response.ok;
          }
          return false;
        } catch {
          return false;
        }
      },
      maxAttempts: 3,
      cooldownMs: 30000
    });
    
    // Connection retry strategy
    this.registerStrategy({
      name: 'Connection Retry',
      description: 'Retry connection to service',
      applicable: (error) => {
        const errorStr = error.error.toString().toLowerCase();
        return errorStr.includes('connection') || 
               errorStr.includes('disconnected') ||
               errorStr.includes('websocket');
      },
      execute: (error) => {
        try {
          // Service-specific reconnection logic
          if (error.service.includes('WebSocket')) {
            // WebSocket reconnection is handled by the WebSocket classes
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        } catch {
          return Promise.resolve(false);
        }
      },
      maxAttempts: 5,
      cooldownMs: 5000
    });
    
    // Clear and reset strategy
    this.registerStrategy({
      name: 'Clear and Reset',
      description: 'Clear service state and reset',
      applicable: (error) => {
        const errorStr = error.error.toString().toLowerCase();
        return errorStr.includes('state') || 
               errorStr.includes('corrupt') ||
               errorStr.includes('invalid');
      },
      execute: async (error) => {
        try {
          // Clear service-specific state
          if (error.service === 'HackRF') {
            // Clear sweep data
            const response = await fetch('/api/hackrf/emergency-stop', { method: 'POST' });
            return response.ok;
          }
          return false;
        } catch {
          return false;
        }
      },
      maxAttempts: 2,
      cooldownMs: 10000
    });
    
    // Fallback strategy
    this.registerStrategy({
      name: 'Fallback Mode',
      description: 'Switch to fallback/degraded mode',
      applicable: (error) => error.severity === 'critical',
      execute: (_error) => {
        try {
          // Implement fallback logic
          logInfo(`Switching ${_error.service} to fallback mode`);
          // This would trigger UI changes to show degraded mode
          return Promise.resolve(true);
        } catch {
          return Promise.resolve(false);
        }
      },
      maxAttempts: 1,
      cooldownMs: 60000
    });
  }
  
  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Recovery timeout')), timeoutMs)
      )
    ]);
  }
  
  /**
   * Check if service is recovering
   */
  private isRecovering(service: string): boolean {
    let recovering = false;
    this.state.subscribe(state => {
      recovering = state.activeRecoveries.get(service) || false;
    })();
    return recovering;
  }
  
  /**
   * Check if circuit is open
   */
  private isCircuitOpen(service: string): boolean {
    let open = false;
    this.state.subscribe(state => {
      const breaker = state.circuitBreakers.get(service);
      open = breaker?.state === CircuitBreakerState.Open;
    })();
    return open;
  }
  
  /**
   * Get recovery attempts for an error
   */
  private getRecoveryAttempts(errorId: string, strategy: string): number {
    let attempts = 0;
    this.state.subscribe(state => {
      attempts = state.recoveryAttempts.filter(a => 
        a.errorId === errorId && a.strategy === strategy
      ).length;
    })();
    return attempts;
  }
  
  /**
   * Get last recovery time
   */
  private getLastRecoveryTime(service: string, strategy: string): number | null {
    let lastTime: number | null = null;
    this.state.subscribe(state => {
      const key = `${service}-${strategy}`;
      lastTime = state.lastRecovery.get(key) || null;
    })();
    return lastTime;
  }
  
  /**
   * Record recovery attempt
   */
  private recordRecoveryAttempt(
    errorId: string,
    strategy: string,
    attempt: number,
    success: boolean
  ): void {
    this.state.update(state => {
      state.recoveryAttempts.push({
        errorId,
        strategy,
        attempt,
        timestamp: Date.now(),
        success
      });
      
      // Update last recovery time
      const service = state.errors.find(e => e.id === errorId)?.service;
      if (service) {
        const key = `${service}-${strategy}`;
        state.lastRecovery.set(key, Date.now());
      }
      
      return state;
    });
  }
  
  /**
   * Check and update circuit breakers
   */
  private checkCircuitBreakers(): void {
    this.state.update(state => {
      const now = Date.now();
      
      state.circuitBreakers.forEach((breaker, service) => {
        if (breaker.state === CircuitBreakerState.Open && now >= breaker.nextRetry) {
          // Move to half-open state
          breaker.state = CircuitBreakerState.HalfOpen;
          
          // Reset error count to allow retry
          state.errorCounts.set(service, 0);
        } else if (breaker.state === CircuitBreakerState.HalfOpen) {
          // Check if service has recovered
          const errorCount = state.errorCounts.get(service) || 0;
          
          if (errorCount === 0) {
            // Close circuit breaker
            state.circuitBreakers.delete(service);
          } else if (errorCount >= this.options.circuitBreakerThreshold) {
            // Re-open circuit breaker
            breaker.state = CircuitBreakerState.Open;
            breaker.failures += errorCount;
            breaker.lastFailure = now;
            breaker.nextRetry = now + this.options.circuitBreakerTimeout;
          }
        }
      });
      
      return state;
    });
  }
  
  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - 3600000; // 1 hour
    
    this.state.update(state => {
      // Clean old errors
      state.errors = state.errors.filter(e => e.timestamp > cutoff);
      
      // Clean old recovery attempts
      state.recoveryAttempts = state.recoveryAttempts.filter(a => a.timestamp > cutoff);
      
      // Reset error counts for services with no recent errors
      const recentServices = new Set(state.errors.map(e => e.service));
      state.errorCounts.forEach((_, service) => {
        if (!recentServices.has(service)) {
          state.errorCounts.delete(service);
        }
      });
      
      return state;
    });
  }
  
  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byService: Map<string, number>;
    bySeverity: Map<string, number>;
    recoveryRate: number;
  } {
    let stats = {
      total: 0,
      byService: new Map<string, number>(),
      bySeverity: new Map<string, number>(),
      recoveryRate: 0
    };
    
    this.state.subscribe(state => {
      stats.total = state.errors.length;
      
      // Count by service
      state.errors.forEach(error => {
        const count = stats.byService.get(error.service) || 0;
        stats.byService.set(error.service, count + 1);
        
        const sevCount = stats.bySeverity.get(error.severity) || 0;
        stats.bySeverity.set(error.severity, sevCount + 1);
      });
      
      // Calculate recovery rate
      const totalAttempts = state.recoveryAttempts.length;
      const successfulAttempts = state.recoveryAttempts.filter(a => a.success).length;
      stats.recoveryRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
    })();
    
    return stats;
  }
  
  /**
   * Manual circuit breaker control
   */
  resetCircuitBreaker(service: string): void {
    this.state.update(state => {
      state.circuitBreakers.delete(service);
      state.errorCounts.set(service, 0);
      return state;
    });
  }
  
  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.state.update(state => ({
      ...state,
      errors: [],
      recoveryAttempts: [],
      errorCounts: new Map()
    }));
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all data
    this.state.set({
      errors: [],
      recoveryAttempts: [],
      activeRecoveries: new Map(),
      errorCounts: new Map(),
      lastRecovery: new Map(),
      circuitBreakers: new Map()
    });
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();