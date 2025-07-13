/**
 * Service Initializer
 * Manages initialization and shutdown of all services
 */

import { hackrfService } from './hackrf';
import { kismetService } from './kismet';
import { systemHealthMonitor } from './monitoring/systemHealth';
import { dataStreamManager } from './streaming/dataStreamManager';
import { errorRecoveryService } from './recovery/errorRecovery';
import { logInfo, logError, logWarn } from '$lib/utils/logger';

interface InitializationOptions {
  enableHackRF?: boolean;
  enableKismet?: boolean;
  enableMonitoring?: boolean;
  enableStreaming?: boolean;
  enableRecovery?: boolean;
}

let servicesInitialized = false;

/**
 * Initialize all services
 */
export async function initializeServices(options: InitializationOptions = {}): Promise<void> {
  if (servicesInitialized) {
    logWarn('Services already initialized', {}, 'services-already-initialized');
    return;
  }
  
  const {
    enableHackRF = true,
    enableKismet = true,
    enableMonitoring = true,
    enableStreaming = true,
    enableRecovery = true
  } = options;
  
  // 🚀 Initializing services...
  
  try {
    // Initialize error recovery first
    if (enableRecovery) {
      // • Initializing error recovery service...
      errorRecoveryService.initialize();
    }
    
    // Initialize monitoring
    if (enableMonitoring) {
      logInfo('Initializing system health monitor', {}, 'system-health-monitor-init');
      await systemHealthMonitor.initialize();
    }
    
    // Initialize data streaming
    if (enableStreaming) {
      logInfo('Initializing data stream manager', {}, 'data-stream-manager-init');
      dataStreamManager.initialize();
    }
    
    // Initialize HackRF service
    if (enableHackRF) {
      logInfo('Initializing HackRF service', {}, 'hackrf-service-init');
      await hackrfService.initialize();
    }
    
    // Initialize Kismet service
    if (enableKismet) {
      logInfo('Initializing Kismet service', {}, 'kismet-service-init');
      await kismetService.initialize();
    }
    
    servicesInitialized = true;
    logInfo('All services initialized successfully', {}, 'services-initialized');
    
  } catch (error) {
    logError('Service initialization failed', { error }, 'service-init-failed');
    
    // Attempt cleanup on failure
    shutdownServices();
    
    throw error;
  }
}

/**
 * Shutdown all services
 */
export function shutdownServices(): void {
  logInfo('Shutting down services', {}, 'services-shutdown-start');
  
  try {
    // Shutdown in reverse order
    
    // Shutdown main services
    logInfo('Shutting down Kismet service', {}, 'kismet-service-shutdown');
    kismetService.destroy();
    
    logInfo('Shutting down HackRF service', {}, 'hackrf-service-shutdown');
    hackrfService.destroy();
    
    // Shutdown supporting services
    logInfo('Shutting down data stream manager', {}, 'data-stream-manager-shutdown');
    dataStreamManager.destroy();
    
    logInfo('Shutting down system health monitor', {}, 'system-health-monitor-shutdown');
    systemHealthMonitor.destroy();
    
    logInfo('Shutting down error recovery service', {}, 'error-recovery-service-shutdown');
    errorRecoveryService.destroy();
    
    servicesInitialized = false;
    logInfo('All services shut down successfully', {}, 'services-shutdown-success');
    
  } catch (error) {
    logError('Error during service shutdown', { error }, 'service-shutdown-error');
    // Continue shutdown even if some services fail
  }
}

/**
 * Check if services are initialized
 */
export function areServicesInitialized(): boolean {
  return servicesInitialized;
}