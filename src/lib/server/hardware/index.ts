/**
 * Hardware Auto-Detection System
 *
 * Comprehensive hardware detection for SDRs, WiFi/Bluetooth adapters,
 * GPS modules, and other devices
 */

// Core types
export type {
	HardwareCategory,
	ConnectionType,
	HardwareStatus,
	SDRCapabilities,
	WiFiCapabilities,
	BluetoothCapabilities,
	GPSCapabilities,
	CellularCapabilities,
	HardwareCapabilities,
	DetectedHardware,
	HardwareScanResult,
	HardwareQueryOptions,
	HardwareRequirement
} from './detection-types';

// Registry
export { HardwareRegistry, globalHardwareRegistry } from './hardware-registry';

// Detection
export {
	scanAllHardware,
	detectHardwareById,
	isHardwareAvailable,
	isCategoryAvailable,
	getCompatibleHardware,
	HardwareMonitor,
	globalHardwareMonitor
} from './detection/hardware-detector';

// Individual detectors (for advanced usage)
export { detectUSBDevices } from './detection/usb-detector';
export { detectSerialDevices } from './detection/serial-detector';
export { detectNetworkDevices } from './detection/network-detector';
