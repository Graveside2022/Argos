// Hardware auto-detection, resource management, and device control for SDR and network adapters

// alfa-manager
export {
	detectAdapter as detectAlfaAdapter,
	getBlockingProcesses as getAlfaBlockingProcesses,
	getMode as getAlfaMode,
	killBlockingProcesses as killAlfaBlockingProcesses,
} from "./alfa-manager";

// detection (individual detectors)
export { detectNetworkDevices } from "./detection/network-detector";
export { detectSerialDevices } from "./detection/serial-detector";
export { detectUSBDevices } from "./detection/usb-detector";

// detection (hardware-detector)
export {
	HardwareMonitor,
	detectHardwareById,
	getCompatibleHardware,
	globalHardwareMonitor,
	isCategoryAvailable,
	isHardwareAvailable,
	scanAllHardware,
} from "./detection/hardware-detector";

// detection-types
export type {
	BluetoothCapabilities,
	CellularCapabilities,
	ConnectionType,
	DetectedHardware,
	GPSCapabilities,
	HardwareCapabilities,
	HardwareCategory,
	HardwareQueryOptions,
	HardwareRequirement,
	HardwareScanResult,
	HardwareStatus,
	SDRCapabilities,
	WiFiCapabilities,
} from "./detection-types";

// hackrf-manager
export {
	detectHackRF,
	getBlockingProcesses as getHackRFBlockingProcesses,
	getContainerStatus,
	killBlockingProcesses as killHackRFBlockingProcesses,
	stopContainers,
} from "./hackrf-manager";

// hardware-registry
export { HardwareRegistry, globalHardwareRegistry } from "./hardware-registry";

// resource-manager
export { getResourceManager, resourceManager } from "./resource-manager";

// types (HardwareStatus aliased to avoid conflict with detection-types.HardwareStatus)
export {
	HardwareDevice,
	type HardwareStatus as ResourceHardwareStatus,
	type ResourceRequest,
	type ResourceState,
	type ToolRegistration,
} from "./types";
