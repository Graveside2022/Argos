// Canonical type barrel — shared type definitions for the Argos application
// Usage: import type { SpectrumData, KismetDevice } from '$lib/types';
//
// All re-exports are explicit to avoid ambiguity between files that define
// identically-named types for different layers (raw API vs domain model).

// enums.ts — compile-time const enums
export {
	CircuitBreakerState,
	KismetEvent,
	SignalSource,
	SystemStatus,
	WebSocketEvent,
	WebSocketState,
} from "./enums";

// errors.ts — error interfaces and runtime type guards/factories
export {
	createApiError,
	createDatabaseError,
	createValidationError,
	createWebSocketError,
	getErrorProperty,
	isApiError,
	isDatabaseError,
	isValidationError,
	isWebSocketError,
	toError,
} from "./errors";
export type {
	ApiError,
	BaseError,
	DatabaseError,
	ValidationError,
	WebSocketError,
} from "./errors";

// gsm.ts — GSM scanning types
export type { FrequencyTestResult, ScanProgress, ScanResult } from "./gsm";

// kismet.ts — domain-level Kismet types
export type {
	KismetAlert,
	KismetDevice,
	KismetGPS,
	KismetNetwork,
	KismetStatus,
	KismetStore,
} from "./kismet";

// shared.ts — cross-cutting domain types
// Note: SignalSource and WebSocketState from shared.ts are intentionally excluded
// because they duplicate/conflict with enums.ts definitions. Use the enum versions.
export type {
	AppError,
	Device,
	DeviceRecord,
	SweepManagerState,
} from "./shared";

// signals.ts — signal data structures and raw Kismet wire format
// Note: KismetDevice from signals.ts is the RAW Kismet dot-notation format.
// Aliased to RawKismetDevice to avoid conflict with the domain KismetDevice from kismet.ts.
export type {
	HackRFData,
	HackRFMessage,
	KismetDevice as RawKismetDevice,
	KismetMessage,
	Position,
	SignalAggregator,
	SignalCluster,
	SignalData,
	SignalFilter,
	SignalMarker as SignalMarkerType,
	SignalMessage,
	SignalMetadata,
	SignalProcessor,
	SignalStats,
	WSMessage,
} from "./signals";

// terminal.ts — terminal session and WebSocket message types
export type {
	ShellInfo,
	ShellsResponse,
	SplitPaneConfig,
	TerminalInitMessage,
	TerminalInputMessage,
	TerminalMessage,
	TerminalPanelState,
	TerminalReattachedMessage,
	TerminalReadyMessage,
	TerminalResizeMessage,
	TerminalSession,
	TerminalSessionsMessage,
} from "./terminal";

// tools.ts — tool hierarchy types and runtime type guard
export { isCategory } from "./tools";
export type {
	DeploymentType,
	ToolCategory,
	ToolDefinition,
	ToolHierarchy,
	ToolStatus,
} from "./tools";

// validation.ts — runtime type guards and validation utilities
export {
	assertDefined,
	getProperty,
	hasErrorProperty,
	hasProperties,
	hasProperty,
	isBoolean,
	isDeviceInfo,
	isErrorWithCode,
	isNumber,
	isObject,
	isStatusMessage,
	isString,
	isSweepData,
	isValidMessage,
} from "./validation";
export type {
	DeviceInfoValidation,
	StatusMessage,
	SweepDataValidation,
	ValidatedMessage,
} from "./validation";
