/**
 * Services Module -- Top-Level Barrel
 *
 * Central export point for the Argos service layer. Re-exports the core
 * service singletons and system lifecycle functions. Subdirectory modules
 * with potential name collisions (map, tactical-map, localization, usrp,
 * hackrfsweep, db, gsm-evil, wigletotak) are intentionally NOT re-exported
 * here -- import them directly from their own barrels to avoid ambiguity
 * (e.g., `import { ... } from '$lib/services/map'`).
 */

// ---------------------------------------------------------------------------
// API services (config, clients, types)
// ---------------------------------------------------------------------------
export {
	API_BASE_URL,
	API_ENDPOINTS,
	APIError,
	WS_ENDPOINTS,
	buildQueryString,
	defaultRequestOptions,
	hackrfAPI,
	hackrfExample,
	handleResponse,
	kismetAPI,
	kismetExample,
	retryRequest,
	systemAPI,
	systemExample,
	withTimeout,
} from "./api";
export type {
	DeviceFilter,
	HackRFConfig,
	HackRFStatus,
	KismetConfig,
	KismetDevice,
	KismetScript,
	KismetStats,
	KismetStatus,
	LogEntry,
	NetworkInterface,
	RetryConfig,
	ServiceStatus,
	SignalDetection,
	SpectrumData,
	SweepResult,
	SystemHealth,
	SystemInfo,
} from "./api";

// ---------------------------------------------------------------------------
// WebSocket services (clients, manager, data-stream)
// ---------------------------------------------------------------------------
export {
	BaseWebSocket,
	HackRFWebSocketClient,
	KismetWebSocketClient,
	WebSocketManager,
	dataStreamManager,
	destroyHackRFWebSocketClient,
	destroyKismetWebSocketClient,
	destroyWebSocketManager,
	getHackRFWebSocketClient,
	getKismetWebSocketClient,
	getWebSocketManager,
	testWebSocketConnections,
} from "./websocket";
export type {
	BaseWebSocketConfig,
	HackRFMessage,
	HackRFWebSocketConfig,
	KismetMessage,
	KismetWebSocketConfig,
	WebSocketEvent,
	WebSocketEventListener,
	WebSocketEventType,
	WebSocketManagerConfig,
} from "./websocket";

// ---------------------------------------------------------------------------
// HackRF core services (service, analyzer, processor, filter)
// ---------------------------------------------------------------------------
export {
	HackRFAPI,
	HackRFService,
	USRPAPI,
	formatAge,
	getAgeColor,
	getRelevanceIcon,
	hackrfService,
	signalProcessor,
	sweepAnalyzer,
	timeWindowFilter,
	usrpAPI,
} from "./hackrf";
export type {
	TimedSignal,
	TimeWindowConfig,
	TimeWindowState,
	TimeWindowStats,
} from "./hackrf";

// ---------------------------------------------------------------------------
// Kismet core services (service, device manager)
// ---------------------------------------------------------------------------
export { deviceManager, kismetService } from "./kismet";

// ---------------------------------------------------------------------------
// System services (health, recovery, lifecycle)
// ---------------------------------------------------------------------------
export {
	areServicesInitialized,
	errorRecoveryService,
	initializeServices,
	shutdownServices,
	systemHealthMonitor,
} from "./system";
