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
	WebSocketState
} from './enums';

// errors.ts — error interfaces and runtime type guards/factories
export type { ApiError, BaseError, DatabaseError, ValidationError, WebSocketError } from './errors';
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
	toError
} from './errors';

// kismet.ts — domain-level Kismet types
export type {
	KismetAlert,
	KismetDevice,
	KismetGPS,
	KismetNetwork,
	KismetStatus,
	KismetStore
} from './kismet';

// shared.ts — cross-cutting domain types
// Note: SignalSource and WebSocketState from shared.ts are intentionally excluded
// because they duplicate/conflict with enums.ts definitions. Use the enum versions.
export type { AppError, Device, DeviceRecord, SweepManagerState } from './shared';

// signals.ts — signal data structures and raw Kismet wire format
// Note: KismetDevice from signals.ts is the RAW Kismet dot-notation format.
// Aliased to RawKismetDevice to avoid conflict with the domain KismetDevice from kismet.ts.
export type {
	HackRFData,
	HackRFMessage,
	KismetMessage,
	Position,
	KismetDevice as RawKismetDevice,
	SignalAggregator,
	SignalCluster,
	SignalData,
	SignalFilter,
	SignalMarker as SignalMarkerType,
	SignalMessage,
	SignalMetadata,
	SignalProcessor,
	SignalStats,
	WSMessage
} from './signals';

// terminal.ts — terminal session and WebSocket message types
export type {
	ShellInfo,
	ShellsResponse,
	SplitPaneConfig,
	TerminalInitMessage,
	TerminalInputMessage,
	TerminalMessage,
	TerminalPanelState,
	TerminalReadyMessage,
	TerminalReattachedMessage,
	TerminalResizeMessage,
	TerminalSession,
	TerminalSessionsMessage
} from './terminal';

// tools.ts — tool hierarchy types and runtime type guard
export type {
	DeploymentType,
	ToolCategory,
	ToolDefinition,
	ToolHierarchy,
	ToolStatus
} from './tools';
export { isCategory } from './tools';

// validation.ts — runtime type guards and validation utilities
export type {
	DeviceInfoValidation,
	StatusMessage,
	SweepDataValidation,
	ValidatedMessage
} from './validation';
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
	isValidMessage
} from './validation';

// gps.ts — GPS position and response types
export type { GPSApiResponse, GPSPositionData } from './gps';

// map.ts — Leaflet map interface types
export type {
	LeafletCircle,
	LeafletCircleMarker,
	LeafletEvent,
	LeafletIcon,
	LeafletLayer,
	LeafletLibrary,
	LeafletMap,
	LeafletMarker,
	LeafletPopup,
	LeafletTileLayer
} from './map';

// network.ts — network topology types
export type { NetworkEdge, NetworkNode } from './network';

// system.ts — system information types
export type { SystemInfo } from './system';
