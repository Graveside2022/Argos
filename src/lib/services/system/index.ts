/**
 * System Services Module
 *
 * System health monitoring, error recovery with circuit breaker pattern,
 * and coordinated service lifecycle management.
 */

// --- error-recovery ---
export { errorRecoveryService } from "./error-recovery";

// --- service-initializer ---
export {
	areServicesInitialized,
	initializeServices,
	shutdownServices,
} from "./service-initializer";

// --- system-health ---
export { systemHealthMonitor } from "./system-health";
