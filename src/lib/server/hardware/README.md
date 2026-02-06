# Hardware Auto-Detection System

Comprehensive hardware detection system for Argos that automatically discovers and tracks SDRs, WiFi/Bluetooth adapters, GPS modules, cellular modems, and other devices.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Server Startup                           │
│              Hardware detection begins                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardware Detection System                      │
│   • USB Detector (SDRs, WiFi, Bluetooth)                   │
│   • Serial Detector (GPS, Cellular)                         │
│   • Network Detector (Networked SDRs, APIs)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardware Registry                              │
│   • Stores detected hardware                                │
│   • Tracks connection status                                │
│   • Provides query interface                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Tool-Hardware Compatibility Mapping                 │
│   • Tools declare hardware requirements                     │
│   • Framework filters available tools                       │
│   • Automatic dependency checking                           │
└─────────────────────────────────────────────────────────────┘
```

## Supported Hardware Categories

### SDR Devices

- **HackRF One** - 1MHz to 6GHz, 20Msps, TX/RX
- **USRP B200/B210** - 70MHz to 6GHz, 61.44Msps, Full duplex
- **RTL-SDR** - 24MHz to 1.7GHz, 2.4Msps, RX only

### WiFi Adapters

- **Atheros AR9271** - Monitor mode, packet injection
- **Ralink RT5370** - 2.4GHz/5GHz, monitor mode
- **Realtek RTL8812AU** - Dual band, high power

### Bluetooth Adapters

- **CSR Bluetooth** - BLE + Classic
- **Qualcomm Atheros** - BLE support
- **Intel Bluetooth** - Modern BLE

### GPS Modules

- **Generic NMEA GPS** - Serial/USB GPS modules
- **GPSD Integration** - Virtual GPS via GPSD daemon

### Cellular Modems

- **GSM/LTE/5G Modems** - ModemManager compatible

## Hardware Detection Methods

### USB Detection

```typescript
detectUSBDevices()
  ↓
• lsusb - List all USB devices
• hackrf_info - Detect HackRF devices
• uhd_find_devices - Detect USRP devices
• rtl_test - Detect RTL-SDR devices
• iw dev - Detect WiFi adapters
• hciconfig - Detect Bluetooth adapters
  ↓
Returns: DetectedHardware[]
```

### Serial Detection

```typescript
detectSerialDevices()
  ↓
• /dev/ttyUSB* - Enumerate serial devices
• Read NMEA data - Identify GPS modules
• mmcli - Detect cellular modems
• sysfs - Read device metadata
  ↓
Returns: DetectedHardware[]
```

### Network Detection

```typescript
detectNetworkDevices()
  ↓
• uhd_find_devices - Network USRP
• HTTP probes - Kismet, HackRF API, OpenWebRX
• Service availability checks
  ↓
Returns: DetectedHardware[]
```

## API Endpoints

### `GET /api/hardware/scan`

Scan system and return all detected hardware.

**Response:**

```json
{
  "success": true,
  "stats": {
    "total": 5,
    "connected": 4,
    "byCategory": {
      "sdr": 1,
      "wifi": 1,
      "bluetooth": 1,
      "gps": 1,
      "network": 1
    },
    "byConnectionType": {
      "usb": 3,
      "serial": 1,
      "network": 1
    }
  },
  "hardware": {
    "sdr": [
      {
        "id": "hackrf-0000000000000000a06063c824f0b557",
        "name": "HackRF One",
        "status": "connected",
        "capabilities": {
          "minFrequency": 1000000,
          "maxFrequency": 6000000000,
          "sampleRate": 20000000,
          "txCapable": true,
          "rxCapable": true
        },
        "compatibleTools": [
          "spectrum.analysis.hackrf",
          "wifi.analysis.hackrf"
        ]
      }
    ],
    "wifi": [...],
    "bluetooth": [...]
  }
}
```

### `GET /api/hardware/status/:hardwareId`

Check status of specific hardware device.

**Response:**

```json
{
  "success": true,
  "hardware": {
    "id": "hackrf-abc123",
    "name": "HackRF One",
    "category": "sdr",
    "status": "connected",
    "capabilities": {...}
  },
  "available": true
}
```

## Usage Examples

### Scan for All Hardware

```typescript
import { scanAllHardware } from '$lib/server/hardware';

const result = await scanAllHardware();

console.log(`Found ${result.stats.total} hardware devices`);
console.log(`SDRs: ${result.stats.byCategory.sdr}`);
```

### Check Hardware Availability

```typescript
import { isHardwareAvailable } from '$lib/server/hardware';

const hasHackRF = await isHardwareAvailable('hackrf-abc123');

if (hasHackRF) {
	console.log('HackRF is connected and ready');
}
```

### Query Hardware by Category

```typescript
import { globalHardwareRegistry } from '$lib/server/hardware';

const sdrs = globalHardwareRegistry.query({ category: 'sdr' });
const wifiAdapters = globalHardwareRegistry.getWiFiAdapters();
const gpss = globalHardwareRegistry.getGPSModules();
```

### Get Hardware Compatible with Tool

```typescript
import { getCompatibleHardware } from '$lib/server/hardware';

const hardware = getCompatibleHardware('wifi.scan.kismet');

console.log(`Compatible hardware: ${hardware.map((h) => h.name).join(', ')}`);
```

### Start Hardware Monitoring

```typescript
import { globalHardwareMonitor } from '$lib/server/hardware';

// Scan every 30 seconds
globalHardwareMonitor.start(30000);

// Stop monitoring
globalHardwareMonitor.stop();
```

## Tool-Hardware Integration

### Declare Hardware Requirements in Tools

```typescript
import type { ToolDefinition, HardwareRequirement } from '$lib/server/agent/tool-execution';

const wifiScanTool: ToolDefinition = {
	name: 'wifi.scan.kismet',
	description: 'Scan for WiFi networks',
	backendType: 'http',
	// ...
	hardwareRequirements: [
		{
			category: 'wifi',
			required: true,
			capabilities: {
				monitorMode: true
			},
			message: 'Requires WiFi adapter with monitor mode support'
		}
	]
};
```

### Check Hardware Before Tool Execution

```typescript
import { globalExecutor } from '$lib/server/agent/tool-execution';
import { getCompatibleHardware } from '$lib/server/hardware';

// Before executing tool
const compatibleHw = getCompatibleHardware('wifi.scan.kismet');

if (compatibleHw.length === 0) {
  console.error('No compatible hardware found for wifi.scan.kismet');
  return;
}

// Execute tool
const result = await globalExecutor.execute('wifi.scan.kismet', {...});
```

## Hardware Capabilities

### SDR Capabilities

```typescript
interface SDRCapabilities {
	minFrequency: number; // Hz
	maxFrequency: number; // Hz
	sampleRate: number; // Samples per second
	bandwidth?: number; // Hz
	txCapable: boolean; // Can transmit
	rxCapable: boolean; // Can receive
	fullDuplex?: boolean; // Simultaneous TX/RX
}
```

### WiFi Capabilities

```typescript
interface WiFiCapabilities {
	interface: string; // e.g., wlan0
	monitorMode: boolean;
	injectionCapable: boolean;
	frequencyBands: string[]; // ['2.4GHz', '5GHz']
	channels: number[];
	maxTxPower?: number; // dBm
}
```

### Bluetooth Capabilities

```typescript
interface BluetoothCapabilities {
	interface: string; // e.g., hci0
	bleSupport: boolean;
	classicSupport: boolean;
	version?: string;
	manufacturer?: string;
}
```

## Hardware Detection Database

Known USB device signatures (VID:PID):

| Device            | VID:PID   | Category |
| ----------------- | --------- | -------- |
| HackRF One        | 1d50:604b | SDR      |
| USRP B200         | 2500:0020 | SDR      |
| RTL-SDR           | 0bda:2838 | SDR      |
| Atheros AR9271    | 0cf3:9271 | WiFi     |
| Realtek RTL8812AU | 0bda:8812 | WiFi     |

## Troubleshooting

### Hardware Not Detected

**Check permissions:**

```bash
# USB permissions
sudo usermod -a -G plugdev $USER

# Serial port permissions
sudo usermod -a -G dialout $USER
```

**Check device is visible:**

```bash
lsusb                    # List USB devices
ls /dev/ttyUSB*          # List serial devices
iw dev                   # List WiFi interfaces
hciconfig                # List Bluetooth interfaces
```

**Check detection tools installed:**

```bash
which hackrf_info        # HackRF detection
which uhd_find_devices   # USRP detection
which rtl_test           # RTL-SDR detection
which mmcli              # Cellular modem detection
```

### Re-scan Hardware

```bash
# Via API
curl http://localhost:5173/api/hardware/scan

# Via code
import { scanAllHardware } from '$lib/server/hardware';
await scanAllHardware();
```

## Integration with Tool Framework

### Automatic Tool Filtering

Tools that require hardware will automatically be filtered based on available hardware:

```typescript
// Tool requires HackRF
const hackrfTool = {
  name: 'spectrum.analysis.hackrf',
  hardwareRequirements: [{
    category: 'sdr',
    required: true,
    capabilities: { txCapable: true, rxCapable: true }
  }]
};

// Tool Executor checks hardware before execution
await globalExecutor.execute('spectrum.analysis.hackrf', {...});
// → Checks: isHardwareAvailable('hackrf-*')
// → If not found: Error with helpful message
```

### Hardware Status in Agent Prompt

The agent system prompt includes hardware status:

```
AVAILABLE HARDWARE:
- HackRF One (1 MHz - 6 GHz) - Connected
- WiFi Adapter wlan1 (Monitor Mode) - Connected
- GPS Module (NMEA) - Connected

Your available tools depend on this hardware. Tools requiring unavailable
hardware cannot be executed.
```

## Future Enhancements

### Planned Features

1. **Hot-plug Detection** - Detect hardware when plugged in
2. **Hardware Conflicts** - Prevent multiple tools from using same hardware
3. **Hardware Reservations** - Reserve hardware for specific workflows
4. **Firmware Management** - Check and update firmware
5. **Performance Monitoring** - Track hardware performance metrics
6. **Hardware Profiles** - Save/load hardware configurations

## Related Documentation

- [Tool Execution Framework](../agent/tool-execution/README.md)
- [Agent Integration](../agent/AGENT_INTEGRATION.md)
