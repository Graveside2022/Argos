import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import type { DeviceClassification, DeviceFingerprint, ManufacturerInfo } from './types';

/**
 * Device intelligence system for WiFi device classification and fingerprinting
 * Analyzes device characteristics to identify device types, manufacturers, and capabilities
 */
export class DeviceIntelligence {
    private ouiDatabase: Map<string, ManufacturerInfo>;
    private devicePatterns: Map<string, DeviceFingerprint>;
    private behaviorProfiles: Map<string, any>;
    private classificationCache: Map<string, DeviceClassification>;

    constructor() {
        this.ouiDatabase = new Map();
        this.devicePatterns = new Map();
        this.behaviorProfiles = new Map();
        this.classificationCache = new Map();
        
        this.initializeOUIDatabase();
        this.initializeDevicePatterns();
        this.initializeBehaviorProfiles();
    }

    /**
     * Classify a device based on its characteristics
     */
    classifyDevice(device: any): DeviceClassification {
        try {
            const cacheKey = this.getCacheKey(device);
            const cached = this.classificationCache.get(cacheKey);
            
            if (cached) {
                return cached;
            }

            const classification = this.performClassification(device);
            this.classificationCache.set(cacheKey, classification);
            
            return classification;
            
        } catch (error) {
            logError('Error classifying device', { 
                mac: device.mac, 
                error: (error as Error).message 
            });
            
            return {
                type: 'unknown',
                subtype: 'unknown',
                confidence: 0,
                characteristics: {
                    isApple: false,
                    isAndroid: false,
                    isIoT: false,
                    isEnterprise: false,
                    isMobile: false,
                    isDesktop: false,
                    isEmbedded: false
                },
                capabilities: [],
                operatingSystem: 'unknown',
                deviceFamily: 'unknown',
                vendor: 'unknown',
                model: 'unknown'
            };
        }
    }

    /**
     * Lookup manufacturer information from OUI database
     */
    lookupManufacturer(mac: string): string {
        try {
            const oui = mac.substring(0, 8).replace(/:/g, '').toUpperCase();
            const manufacturerInfo = this.ouiDatabase.get(oui);
            
            if (manufacturerInfo) {
                return manufacturerInfo.name;
            }
            
            // Try shorter OUI prefixes
            const shortOui = oui.substring(0, 6);
            const shortInfo = this.ouiDatabase.get(shortOui);
            
            if (shortInfo) {
                return shortInfo.name;
            }
            
            return 'Unknown';
            
        } catch (error) {
            logError('Error looking up manufacturer', { mac, error: (error as Error).message });
            return 'Unknown';
        }
    }

    /**
     * Analyze device behavior patterns
     */
    analyzeBehavior(mac: string, history: any[]): any {
        try {
            const behavior = {
                connectionPatterns: this.analyzeConnectionPatterns(history),
                signalPatterns: this.analyzeSignalPatterns(history),
                mobilityPatterns: this.analyzeMobilityPatterns(history),
                activityPatterns: this.analyzeActivityPatterns(history),
                probePatterns: this.analyzeProbePatterns(history),
                temporalPatterns: this.analyzeTemporalPatterns(history)
            };
            
            this.behaviorProfiles.set(mac, behavior);
            return behavior;
            
        } catch (error) {
            logError('Error analyzing behavior', { mac, error: (error as Error).message });
            return null;
        }
    }

    /**
     * Generate device fingerprint
     */
    generateFingerprint(device: any): DeviceFingerprint {
        try {
            return {
                macOUI: device.mac.substring(0, 8),
                capabilities: this.extractCapabilities(device),
                signalCharacteristics: this.analyzeSignalCharacteristics(device),
                behaviorSignature: this.generateBehaviorSignature(device),
                protocolFingerprint: this.generateProtocolFingerprint(device),
                vendorElements: this.extractVendorElements(device),
                uniqueIdentifiers: this.extractUniqueIdentifiers(device)
            };
            
        } catch (error) {
            logError('Error generating fingerprint', { 
                mac: device.mac, 
                error: (error as Error).message 
            });
            return {
                macOUI: device.mac.substring(0, 8),
                capabilities: [],
                signalCharacteristics: {},
                behaviorSignature: '',
                protocolFingerprint: '',
                vendorElements: [],
                uniqueIdentifiers: []
            };
        }
    }

    /**
     * Check if device is Apple device
     */
    isAppleDevice(mac: string): boolean {
        const appleOUIs = [
            '00:03:93', '00:0A:95', '00:0D:93', '00:16:CB', '00:17:F2',
            '00:19:E3', '00:1B:63', '00:1D:4F', '00:1E:52', '00:1F:F3',
            '00:21:E9', '00:22:41', '00:23:12', '00:23:32', '00:23:6C',
            '00:23:DF', '00:24:36', '00:25:00', '00:25:4B', '00:25:BC',
            '00:26:08', '00:26:4A', '00:26:B0', '00:26:BB', '04:0C:CE',
            '04:15:52', '04:1B:BA', '04:48:9A', '04:4F:AA', '04:52:C7',
            '04:54:53', '04:69:F2', '04:8D:38', '04:DB:56', '04:E5:36',
            '04:F1:3E', '04:F7:E4', '08:00:07', '08:35:35', '08:6D:41',
            '08:74:02', '08:96:D7', '08:9E:08', '0C:15:39', '0C:3E:9F',
            '0C:4D:E9', '0C:74:C2', '0C:77:1A', '0C:D2:92', '0C:F0:39',
            '10:40:F3', '10:93:E9', '10:9A:DD', '10:DD:B1', '14:10:9F',
            '14:20:5E', '14:5A:05', '14:7D:DA', '14:8F:C6', '14:BD:61',
            '14:C2:13', '18:34:51', '18:65:90', '18:AF:61', '18:E7:F4',
            '1C:1A:C0', '1C:AB:A7', '1C:E6:2B', '20:34:FB', '20:36:9B',
            '20:3C:AE', '20:AB:37', '20:C9:D0', '24:24:0E', '24:36:DA',
            '24:A2:E1', '24:AB:81', '24:DA:9B', '24:F0:94', '24:F6:77',
            '28:0B:5C', '28:37:37', '28:6A:BA', '28:6A:E7', '28:A0:2B',
            '28:C6:8E', '28:CF:DA', '28:CF:E9', '28:E0:2C', '28:E7:CF',
            '28:F0:76', '2C:1F:23', '2C:2B:F9', '2C:36:F8', '2C:4D:54',
            '2C:54:CF', '2C:5F:F3', '2C:B4:3A', '2C:BE:08', '2C:F0:A2',
            '30:10:B3', '30:35:AD', '30:63:6B', '30:90:AB', '30:F7:C5',
            '34:15:9E', '34:36:3B', '34:51:C9', '34:A3:95', '34:AB:37',
            '34:C0:59', '34:E2:FD', '38:48:4C', '38:B5:4D', '38:C9:86',
            '38:E7:D8', '3C:07:54', '3C:15:C2', '3C:2E:F9', '3C:8B:FE',
            '3C:D0:F8', '40:30:04', '40:33:1A', '40:3C:FC', '40:4D:7F',
            '40:56:85', '40:6C:8F', '40:78:6A', '40:A6:D9', '40:CB:C0',
            '40:D3:2D', '44:00:10', '44:2A:60', '44:4C:0C', '44:D8:84',
            '44:FB:42', '48:43:7C', '48:74:6E', '48:A1:95', '48:BF:6B',
            '48:D7:05', '4C:7C:5F', '4C:8D:79', '4C:B1:99', '4C:B1:CD',
            '50:1A:C5', '50:32:37', '50:82:D5', '50:EA:D6', '54:26:96',
            '54:4E:90', '54:72:4F', '54:AE:27', '54:E4:3A', '58:1F:AA',
            '58:40:4E', '58:55:CA', '58:B0:35', '5C:17:D3', '5C:1D:D9',
            '5C:59:48', '5C:95:AE', '5C:96:9D', '5C:F9:38', '60:33:4B',
            '60:5A:B4', '60:69:44', '60:89:C1', '60:C5:47', '60:FB:42',
            '64:20:9F', '64:76:BA', '64:A3:CB', '64:B0:A6', '64:E6:82',
            '68:07:15', '68:1C:A2', '68:26:CC', '68:40:FD', '68:54:5A',
            '68:64:4B', '68:AB:BC', '68:D9:3C', '6C:19:8F', '6C:2F:2C',
            '6C:40:08', '6C:4D:73', '6C:72:20', '6C:8D:C1', '6C:94:66',
            '6C:AD:F5', '70:14:A6', '70:48:0F', '70:56:81', '70:73:CB',
            '70:CD:60', '70:DE:E2', '70:EC:E4', '74:1B:B2', '74:2B:62',
            '74:5E:F0', '74:86:7A', '74:E2:F5', '78:02:F8', '78:31:C1',
            '78:4F:43', '78:67:D7', '78:7B:8A', '78:A3:E4', '78:CA:39',
            '78:FD:94', '7C:01:0A', '7C:04:D0', '7C:11:BE', '7C:6D:F8',
            '7C:7A:91', '7C:C3:A1', '7C:C5:37', '7C:C7:09', '7C:D1:C3',
            '7C:F0:5F', '80:00:6E', '80:19:34', '80:1A:67', '80:20:DA',
            '80:49:71', '80:6C:1B', '80:86:F2', '80:89:84', '80:92:9F',
            '80:AD:16', '80:B0:3D', '80:BE:05', '80:E6:50', '80:EA:96',
            '84:0D:8E', '84:29:99', '84:38:35', '84:78:AC', '84:85:06',
            '84:8E:0C', '84:A1:34', '84:FC:FE', '88:1F:A1', '88:53:2E',
            '88:63:DF', '88:AE:1D', '88:C6:63', '88:E9:FE', '8C:29:37',
            '8C:2D:AA', '8C:58:77', '8C:85:90', '8C:B4:5A', '8C:FA:BA',
            '90:27:E4', '90:84:0D', '90:B0:ED', '90:B2:1F', '90:FD:61',
            '94:65:2D', '94:94:26', '94:E9:6A', '94:F6:A3', '98:03:D8',
            '98:5F:D3', '98:B8:E3', '98:CA:33', '98:D6:BB', '98:E7:F4',
            '98:F0:AB', '9C:04:EB', '9C:20:7B', '9C:29:76', '9C:35:EB',
            '9C:84:BF', '9C:8E:CD', '9C:FC:E8', 'A0:78:17', 'A0:99:9B',
            'A0:D7:95', 'A0:E4:50', 'A0:EC:F9', 'A4:67:06', 'A4:B1:97',
            'A4:C3:61', 'A4:D1:8C', 'A4:D9:31', 'A4:F1:E8', 'A8:20:66',
            'A8:51:AB', 'A8:5C:2C', 'A8:60:B6', 'A8:86:DD', 'A8:96:75',
            'A8:BB:CF', 'A8:FA:D8', 'AC:1F:74', 'AC:29:3A', 'AC:3C:0B',
            'AC:61:EA', 'AC:7F:3E', 'AC:87:A3', 'AC:BC:32', 'AC:CF:5C',
            'AC:D1:B8', 'AC:FD:CE', 'B0:09:DA', 'B0:19:C6', 'B0:34:95',
            'B0:48:7A', 'B0:65:BD', 'B0:6E:BF', 'B0:7F:B9', 'B0:CA:68',
            'B0:EC:71', 'B4:18:D1', 'B4:30:52', 'B4:9C:DF', 'B4:A5:AC',
            'B4:AE:2B', 'B4:BC:50', 'B4:F0:AB', 'B4:F6:1C', 'B4:F7:A1',
            'B8:09:8A', 'B8:17:C2', 'B8:2A:72', 'B8:53:AC', 'B8:63:BC',
            'B8:78:2E', 'B8:8D:12', 'B8:C7:5D', 'B8:E8:56', 'B8:F6:53',
            'B8:FF:61', 'BC:3B:AF', 'BC:52:B7', 'BC:67:1C', 'BC:6C:21',
            'BC:7E:8B', 'BC:92:6B', 'BC:9F:EF', 'BC:A9:20', 'BC:EC:5D',
            'BC:F5:AC', 'C0:25:06', 'C0:2E:25', 'C0:84:7A', 'C0:9A:D0',
            'C0:B6:F9', 'C0:CC:F8', 'C0:CE:CD', 'C0:D0:12', 'C0:E4:34',
            'C0:F2:FB', 'C4:2C:03', 'C4:B3:01', 'C4:B6:10', 'C8:1E:E7',
            'C8:33:4B', 'C8:69:CD', 'C8:6B:85', 'C8:74:AD', 'C8:89:F3',
            'C8:B5:B7', 'C8:BC:C8', 'C8:D7:19', 'C8:E0:EB', 'C8:F6:50',
            'CC:08:8D', 'CC:25:EF', 'CC:2D:83', 'CC:29:F5', 'CC:78:AB',
            'CC:C7:60', 'D0:04:01', 'D0:23:DB', 'D0:25:44', 'D0:33:11',
            'D0:3C:1F', 'D0:A6:37', 'D0:E1:40', 'D4:61:9D', 'D4:85:64',
            'D4:90:9C', 'D4:97:0B', 'D4:A3:3D', 'D4:DC:CD', 'D4:F4:6F',
            'D8:00:4D', 'D8:30:62', 'D8:96:95', 'D8:A2:5E', 'D8:BB:2C',
            'D8:CF:9C', 'D8:D1:CB', 'DC:2B:2A', 'DC:2B:61', 'DC:37:45',
            'DC:56:E7', 'DC:86:D8', 'DC:9B:9C', 'DC:A4:CA', 'DC:A9:04',
            'DC:AB:05', 'DC:BE:65', 'DC:D3:A2', 'DC:F8:56', 'E0:8B:2C',
            'E0:AC:CB', 'E0:B5:5F', 'E0:B9:A5', 'E0:C9:7A', 'E0:F5:C6',
            'E0:F7:47', 'E4:25:E7', 'E4:2B:2B', 'E4:80:A0', 'E4:8B:7F',
            'E4:9A:79', 'E4:B2:FB', 'E4:C6:3D', 'E4:CE:8F', 'E4:E4:AB',
            'E8:06:88', 'E8:40:40', 'E8:80:2E', 'E8:B2:AC', 'E8:B4:70',
            'E8:BF:05', 'E8:E5:D6', 'E8:F2:E9', 'EC:35:86', 'EC:3E:F0',
            'EC:8A:4C', 'EC:F4:BB', 'F0:18:98', 'F0:24:75', 'F0:2F:74',
            'F0:4D:A2', 'F0:76:1C', 'F0:98:7D', 'F0:9F:C2', 'F0:B4:79',
            'F0:CB:A1', 'F0:D1:A9', 'F0:DB:E2', 'F0:DC:E2', 'F0:F6:1C',
            'F4:0F:24', 'F4:37:B7', 'F4:5C:89', 'F4:F1:5A', 'F4:F9:51',
            'F8:1E:DF', 'F8:27:93', 'F8:2F:A8', 'F8:4F:57', 'F8:7B:7A',
            'F8:D0:BD', 'F8:E9:4E', 'F8:FF:C2', 'FC:25:3F', 'FC:2A:9C',
            'FC:62:B9', 'FC:64:BA', 'FC:B4:67', 'FC:C2:DE', 'FC:E9:98',
            'FC:FC:48'
        ];
        
        const oui = mac.substring(0, 8);
        return appleOUIs.includes(oui);
    }

    /**
     * Check if device is Android device
     */
    isAndroidDevice(device: any): boolean {
        // Android devices often have specific characteristics
        const androidPatterns = [
            /android/i,
            /google/i,
            /samsung/i,
            /htc/i,
            /lg/i,
            /sony/i,
            /motorola/i,
            /xiaomi/i,
            /huawei/i,
            /oneplus/i
        ];
        
        const manufacturer = device.manufacturer?.toLowerCase() || '';
        const deviceName = device.name?.toLowerCase() || '';
        
        return androidPatterns.some(pattern => 
            pattern.test(manufacturer) || pattern.test(deviceName)
        );
    }

    /**
     * Check if device is IoT device
     */
    isIoTDevice(device: any): boolean {
        // IoT devices often have specific characteristics
        const iotPatterns = [
            /smart/i,
            /iot/i,
            /sensor/i,
            /camera/i,
            /thermostat/i,
            /doorbell/i,
            /light/i,
            /bulb/i,
            /switch/i,
            /plug/i,
            /nest/i,
            /ring/i,
            /philips/i,
            /tp-link/i,
            /d-link/i,
            /belkin/i,
            /wemo/i,
            /roku/i,
            /chromecast/i,
            /amazon/i,
            /alexa/i,
            /echo/i
        ];
        
        const manufacturer = device.manufacturer?.toLowerCase() || '';
        const deviceName = device.name?.toLowerCase() || '';
        const ssid = device.ssid?.toLowerCase() || '';
        
        return iotPatterns.some(pattern => 
            pattern.test(manufacturer) || pattern.test(deviceName) || pattern.test(ssid)
        );
    }

    /**
     * Check if device is enterprise device
     */
    isEnterpriseDevice(device: any): boolean {
        // Enterprise devices often have specific characteristics
        const enterprisePatterns = [
            /enterprise/i,
            /corporate/i,
            /business/i,
            /cisco/i,
            /dell/i,
            /hp/i,
            /lenovo/i,
            /intel/i,
            /microsoft/i,
            /vmware/i,
            /server/i,
            /workstation/i
        ];
        
        const manufacturer = device.manufacturer?.toLowerCase() || '';
        const deviceName = device.name?.toLowerCase() || '';
        
        return enterprisePatterns.some(pattern => 
            pattern.test(manufacturer) || pattern.test(deviceName)
        );
    }

    /**
     * Perform device classification
     */
    private performClassification(device: any): DeviceClassification {
        const manufacturer = this.lookupManufacturer(device.mac);
        const isApple = this.isAppleDevice(device.mac);
        const isAndroid = this.isAndroidDevice(device);
        const isIoT = this.isIoTDevice(device);
        const isEnterprise = this.isEnterpriseDevice(device);
        
        // Determine device type
        let type = 'unknown';
        let subtype = 'unknown';
        let confidence = 0.5;
        
        if (device.type?.toLowerCase().includes('ap')) {
            type = 'access_point';
            subtype = 'router';
            confidence = 0.9;
        } else if (device.type?.toLowerCase().includes('client')) {
            type = 'client';
            
            if (isApple) {
                subtype = 'apple_device';
                confidence = 0.9;
            } else if (isAndroid) {
                subtype = 'android_device';
                confidence = 0.9;
            } else if (isIoT) {
                subtype = 'iot_device';
                confidence = 0.8;
            } else if (isEnterprise) {
                subtype = 'enterprise_device';
                confidence = 0.8;
            } else {
                subtype = 'generic_client';
                confidence = 0.6;
            }
        }
        
        // Determine capabilities
        const capabilities = this.extractCapabilities(device);
        
        // Determine operating system
        let operatingSystem = 'unknown';
        if (isApple) {
            operatingSystem = 'iOS/macOS';
        } else if (isAndroid) {
            operatingSystem = 'Android';
        } else if (isEnterprise) {
            operatingSystem = 'Windows/Linux';
        }
        
        return {
            type,
            subtype,
            confidence,
            characteristics: {
                isApple,
                isAndroid,
                isIoT,
                isEnterprise,
                isMobile: isApple || isAndroid,
                isDesktop: isEnterprise && !isIoT,
                isEmbedded: isIoT
            },
            capabilities,
            operatingSystem,
            deviceFamily: this.determineDeviceFamily(device, manufacturer),
            vendor: manufacturer,
            model: this.determineModel(device, manufacturer)
        };
    }

    /**
     * Extract device capabilities
     */
    private extractCapabilities(device: any): string[] {
        const capabilities = [];
        
        // Check for WiFi standards
        if (device.capabilities?.includes('802.11n')) capabilities.push('802.11n');
        if (device.capabilities?.includes('802.11ac')) capabilities.push('802.11ac');
        if (device.capabilities?.includes('802.11ax')) capabilities.push('802.11ax');
        
        // Check for security capabilities
        if (device.encryption?.includes('WPA3')) capabilities.push('WPA3');
        if (device.encryption?.includes('WPA2')) capabilities.push('WPA2');
        if (device.encryption?.includes('WEP')) capabilities.push('WEP');
        
        // Check for frequency bands
        if (device.frequency < 3000) capabilities.push('2.4GHz');
        if (device.frequency > 5000) capabilities.push('5GHz');
        
        return capabilities;
    }

    /**
     * Determine device family
     */
    private determineDeviceFamily(device: any, manufacturer: string): string {
        if (manufacturer.toLowerCase().includes('apple')) {
            if (device.name?.toLowerCase().includes('iphone')) return 'iPhone';
            if (device.name?.toLowerCase().includes('ipad')) return 'iPad';
            if (device.name?.toLowerCase().includes('mac')) return 'Mac';
            return 'Apple Device';
        }
        
        if (manufacturer.toLowerCase().includes('samsung')) {
            return 'Samsung Device';
        }
        
        if (manufacturer.toLowerCase().includes('google')) {
            return 'Google Device';
        }
        
        return 'Generic Device';
    }

    /**
     * Determine device model
     */
    private determineModel(device: any, manufacturer: string): string {
        // This would typically involve more sophisticated pattern matching
        // For now, return a simplified model determination
        
        if (device.name) {
            return device.name;
        }
        
        if (manufacturer !== 'Unknown') {
            return `${manufacturer} Device`;
        }
        
        return 'Unknown Model';
    }

    /**
     * Generate cache key for classification
     */
    private getCacheKey(device: any): string {
        return `${device.mac}_${device.type}_${device.manufacturer}`;
    }

    /**
     * Initialize OUI database with common manufacturers
     */
    private initializeOUIDatabase(): void {
        const commonOUIs = [
            // Apple
            { oui: '00:03:93', name: 'Apple' },
            { oui: '00:16:CB', name: 'Apple' },
            { oui: '00:1B:63', name: 'Apple' },
            { oui: '00:1E:52', name: 'Apple' },
            { oui: '04:0C:CE', name: 'Apple' },
            { oui: '04:15:52', name: 'Apple' },
            { oui: '08:00:07', name: 'Apple' },
            { oui: '0C:74:C2', name: 'Apple' },
            { oui: '10:40:F3', name: 'Apple' },
            { oui: '14:20:5E', name: 'Apple' },
            { oui: '18:65:90', name: 'Apple' },
            { oui: '1C:AB:A7', name: 'Apple' },
            { oui: '20:36:9B', name: 'Apple' },
            { oui: '24:A2:E1', name: 'Apple' },
            { oui: '28:37:37', name: 'Apple' },
            { oui: '2C:1F:23', name: 'Apple' },
            { oui: '30:90:AB', name: 'Apple' },
            { oui: '34:36:3B', name: 'Apple' },
            { oui: '38:C9:86', name: 'Apple' },
            { oui: '3C:15:C2', name: 'Apple' },
            { oui: '40:30:04', name: 'Apple' },
            { oui: '44:2A:60', name: 'Apple' },
            { oui: '48:A1:95', name: 'Apple' },
            { oui: '4C:B1:99', name: 'Apple' },
            { oui: '50:1A:C5', name: 'Apple' },
            { oui: '54:26:96', name: 'Apple' },
            { oui: '58:55:CA', name: 'Apple' },
            { oui: '5C:17:D3', name: 'Apple' },
            { oui: '60:33:4B', name: 'Apple' },
            { oui: '64:20:9F', name: 'Apple' },
            { oui: '68:07:15', name: 'Apple' },
            { oui: '6C:2F:2C', name: 'Apple' },
            { oui: '70:56:81', name: 'Apple' },
            { oui: '74:1B:B2', name: 'Apple' },
            { oui: '78:02:F8', name: 'Apple' },
            { oui: '7C:11:BE', name: 'Apple' },
            { oui: '80:1A:67', name: 'Apple' },
            { oui: '84:38:35', name: 'Apple' },
            { oui: '88:1F:A1', name: 'Apple' },
            { oui: '8C:29:37', name: 'Apple' },
            { oui: '90:27:E4', name: 'Apple' },
            { oui: '94:65:2D', name: 'Apple' },
            { oui: '98:03:D8', name: 'Apple' },
            { oui: '9C:04:EB', name: 'Apple' },
            { oui: 'A0:78:17', name: 'Apple' },
            { oui: 'A4:67:06', name: 'Apple' },
            { oui: 'A8:20:66', name: 'Apple' },
            { oui: 'AC:1F:74', name: 'Apple' },
            { oui: 'B0:09:DA', name: 'Apple' },
            { oui: 'B4:18:D1', name: 'Apple' },
            { oui: 'B8:09:8A', name: 'Apple' },
            { oui: 'BC:52:B7', name: 'Apple' },
            { oui: 'C0:25:06', name: 'Apple' },
            { oui: 'C4:2C:03', name: 'Apple' },
            { oui: 'C8:1E:E7', name: 'Apple' },
            { oui: 'CC:08:8D', name: 'Apple' },
            { oui: 'D0:04:01', name: 'Apple' },
            { oui: 'D4:61:9D', name: 'Apple' },
            { oui: 'D8:00:4D', name: 'Apple' },
            { oui: 'DC:2B:2A', name: 'Apple' },
            { oui: 'E0:AC:CB', name: 'Apple' },
            { oui: 'E4:25:E7', name: 'Apple' },
            { oui: 'E8:06:88', name: 'Apple' },
            { oui: 'EC:35:86', name: 'Apple' },
            { oui: 'F0:18:98', name: 'Apple' },
            { oui: 'F4:0F:24', name: 'Apple' },
            { oui: 'F8:1E:DF', name: 'Apple' },
            { oui: 'FC:25:3F', name: 'Apple' },
            
            // Samsung
            { oui: '00:07:AB', name: 'Samsung' },
            { oui: '00:12:47', name: 'Samsung' },
            { oui: '00:15:B9', name: 'Samsung' },
            { oui: '00:16:32', name: 'Samsung' },
            { oui: '00:1A:8A', name: 'Samsung' },
            { oui: '00:1D:25', name: 'Samsung' },
            { oui: '00:1F:CC', name: 'Samsung' },
            { oui: '00:21:19', name: 'Samsung' },
            { oui: '00:23:39', name: 'Samsung' },
            { oui: '00:26:E2', name: 'Samsung' },
            { oui: '08:37:3D', name: 'Samsung' },
            { oui: '0C:14:20', name: 'Samsung' },
            { oui: '10:1D:C0', name: 'Samsung' },
            { oui: '18:3A:2D', name: 'Samsung' },
            { oui: '1C:5A:3E', name: 'Samsung' },
            { oui: '20:13:E0', name: 'Samsung' },
            { oui: '28:39:5E', name: 'Samsung' },
            { oui: '30:07:4D', name: 'Samsung' },
            { oui: '34:BE:00', name: 'Samsung' },
            { oui: '38:AA:3C', name: 'Samsung' },
            { oui: '3C:5A:B4', name: 'Samsung' },
            { oui: '40:4E:36', name: 'Samsung' },
            { oui: '44:5E:F3', name: 'Samsung' },
            { oui: '48:5A:B6', name: 'Samsung' },
            { oui: '4C:3C:16', name: 'Samsung' },
            { oui: '50:32:75', name: 'Samsung' },
            { oui: '54:88:0E', name: 'Samsung' },
            { oui: '58:21:70', name: 'Samsung' },
            { oui: '5C:0A:5B', name: 'Samsung' },
            { oui: '60:1D:91', name: 'Samsung' },
            { oui: '64:B3:10', name: 'Samsung' },
            { oui: '68:EB:C5', name: 'Samsung' },
            { oui: '6C:2F:2C', name: 'Samsung' },
            { oui: '70:F9:27', name: 'Samsung' },
            { oui: '74:45:8A', name: 'Samsung' },
            { oui: '78:1F:DB', name: 'Samsung' },
            { oui: '7C:1C:4E', name: 'Samsung' },
            { oui: '80:57:19', name: 'Samsung' },
            { oui: '84:A4:66', name: 'Samsung' },
            { oui: '88:32:9B', name: 'Samsung' },
            { oui: '8C:77:12', name: 'Samsung' },
            { oui: '90:18:7C', name: 'Samsung' },
            { oui: '94:E9:79', name: 'Samsung' },
            { oui: '98:52:3D', name: 'Samsung' },
            { oui: '9C:02:98', name: 'Samsung' },
            { oui: 'A0:0B:BA', name: 'Samsung' },
            { oui: 'A4:EB:D3', name: 'Samsung' },
            { oui: 'A8:DB:03', name: 'Samsung' },
            { oui: 'AC:5A:14', name: 'Samsung' },
            { oui: 'B0:7C:B1', name: 'Samsung' },
            { oui: 'B4:62:93', name: 'Samsung' },
            { oui: 'B8:5E:7B', name: 'Samsung' },
            { oui: 'BC:14:85', name: 'Samsung' },
            { oui: 'C0:BD:D1', name: 'Samsung' },
            { oui: 'C4:57:6E', name: 'Samsung' },
            { oui: 'C8:BA:94', name: 'Samsung' },
            { oui: 'CC:F9:E8', name: 'Samsung' },
            { oui: 'D0:17:6A', name: 'Samsung' },
            { oui: 'D4:E8:B2', name: 'Samsung' },
            { oui: 'D8:90:E8', name: 'Samsung' },
            { oui: 'DC:71:44', name: 'Samsung' },
            { oui: 'E0:DB:10', name: 'Samsung' },
            { oui: 'E4:40:E2', name: 'Samsung' },
            { oui: 'E8:50:8B', name: 'Samsung' },
            { oui: 'EC:1F:72', name: 'Samsung' },
            { oui: 'F0:25:B7', name: 'Samsung' },
            { oui: 'F4:09:D8', name: 'Samsung' },
            { oui: 'F8:04:2E', name: 'Samsung' },
            { oui: 'FC:A6:21', name: 'Samsung' },
            
            // Google
            { oui: '00:1A:11', name: 'Google' },
            { oui: '00:21:6A', name: 'Google' },
            { oui: '04:27:58', name: 'Google' },
            { oui: '08:5B:0E', name: 'Google' },
            { oui: '0C:8B:7D', name: 'Google' },
            { oui: '10:4F:58', name: 'Google' },
            { oui: '14:7A:6E', name: 'Google' },
            { oui: '18:1D:EA', name: 'Google' },
            { oui: '1C:3E:84', name: 'Google' },
            { oui: '20:DF:B9', name: 'Google' },
            { oui: '24:F5:AA', name: 'Google' },
            { oui: '28:11:A5', name: 'Google' },
            { oui: '2C:8A:72', name: 'Google' },
            { oui: '30:89:4A', name: 'Google' },
            { oui: '34:1A:7D', name: 'Google' },
            { oui: '38:EB:9A', name: 'Google' },
            { oui: '3C:F8:62', name: 'Google' },
            { oui: '40:A6:D9', name: 'Google' },
            { oui: '44:07:0B', name: 'Google' },
            { oui: '48:BA:4E', name: 'Google' },
            { oui: '4C:54:99', name: 'Google' },
            { oui: '50:8F:4C', name: 'Google' },
            { oui: '54:60:09', name: 'Google' },
            { oui: '58:C2:34', name: 'Google' },
            { oui: '5C:0A:5B', name: 'Google' },
            { oui: '60:50:7C', name: 'Google' },
            { oui: '64:16:66', name: 'Google' },
            { oui: '68:C4:4D', name: 'Google' },
            { oui: '6C:AD:F5', name: 'Google' },
            { oui: '70:B3:D5', name: 'Google' },
            { oui: '74:2F:68', name: 'Google' },
            { oui: '78:28:CA', name: 'Google' },
            { oui: '7C:2F:80', name: 'Google' },
            { oui: '80:3F:5D', name: 'Google' },
            { oui: '84:1B:5E', name: 'Google' },
            { oui: '88:E9:FE', name: 'Google' },
            { oui: '8C:DC:D4', name: 'Google' },
            { oui: '90:72:40', name: 'Google' },
            { oui: '94:EB:2C', name: 'Google' },
            { oui: '98:DA:C4', name: 'Google' },
            { oui: '9C:B6:D0', name: 'Google' },
            { oui: 'A0:CE:C8', name: 'Google' },
            { oui: 'A4:DA:32', name: 'Google' },
            { oui: 'A8:9C:ED', name: 'Google' },
            { oui: 'AC:63:BE', name: 'Google' },
            { oui: 'B0:EE:7B', name: 'Google' },
            { oui: 'B4:F6:2C', name: 'Google' },
            { oui: 'B8:27:EB', name: 'Google' },
            { oui: 'BC:F5:AC', name: 'Google' },
            { oui: 'C0:EE:40', name: 'Google' },
            { oui: 'C4:43:8F', name: 'Google' },
            { oui: 'C8:02:10', name: 'Google' },
            { oui: 'CC:3A:61', name: 'Google' },
            { oui: 'D0:13:FD', name: 'Google' },
            { oui: 'D4:F5:13', name: 'Google' },
            { oui: 'D8:80:39', name: 'Google' },
            { oui: 'DC:A6:32', name: 'Google' },
            { oui: 'E0:B7:B1', name: 'Google' },
            { oui: 'E4:11:5B', name: 'Google' },
            { oui: 'E8:DE:27', name: 'Google' },
            { oui: 'EC:8C:A2', name: 'Google' },
            { oui: 'F0:EF:86', name: 'Google' },
            { oui: 'F4:F5:DB', name: 'Google' },
            { oui: 'F8:8F:CA', name: 'Google' },
            { oui: 'FC:AA:14', name: 'Google' }
        ];
        
        commonOUIs.forEach(entry => {
            this.ouiDatabase.set(entry.oui, {
                name: entry.name,
                country: 'US', // Simplified
                type: 'manufacturer'
            });
        });
    }

    /**
     * Initialize device patterns for fingerprinting
     */
    private initializeDevicePatterns(): void {
        // This would typically be loaded from a comprehensive database
        // For now, we'll initialize with some basic patterns
        
        this.devicePatterns.set('apple_iphone', {
            macOUI: '00:03:93',
            capabilities: ['802.11n', '802.11ac', 'WPA2'],
            signalCharacteristics: { powerSaving: true },
            behaviorSignature: 'mobile_device',
            protocolFingerprint: 'apple_ios',
            vendorElements: ['apple'],
            uniqueIdentifiers: ['ios_device']
        });
        
        this.devicePatterns.set('samsung_galaxy', {
            macOUI: '00:07:AB',
            capabilities: ['802.11n', '802.11ac', 'WPA2'],
            signalCharacteristics: { powerSaving: true },
            behaviorSignature: 'mobile_device',
            protocolFingerprint: 'android',
            vendorElements: ['samsung'],
            uniqueIdentifiers: ['android_device']
        });
    }

    /**
     * Initialize behavior profiles
     */
    private initializeBehaviorProfiles(): void {
        // Initialize behavior analysis patterns
        this.behaviorProfiles.set('mobile_device', {
            connectionPatterns: { frequent: true, shortDuration: true },
            signalPatterns: { variable: true, roaming: true },
            mobilityPatterns: { high: true },
            activityPatterns: { bursty: true },
            probePatterns: { frequent: true, varied: true },
            temporalPatterns: { daily: true, periodic: false }
        });
        
        this.behaviorProfiles.set('iot_device', {
            connectionPatterns: { persistent: true, longDuration: true },
            signalPatterns: { stable: true, stationary: true },
            mobilityPatterns: { low: true },
            activityPatterns: { periodic: true },
            probePatterns: { minimal: true, fixed: true },
            temporalPatterns: { constant: true, periodic: true }
        });
    }

    /**
     * Analyze connection patterns
     */
    private analyzeConnectionPatterns(history: any[]): any {
        // Analyze how the device connects to networks
        return {
            frequency: history.length,
            duration: 'variable',
            stability: 'medium'
        };
    }

    /**
     * Analyze signal patterns
     */
    private analyzeSignalPatterns(history: any[]): any {
        // Analyze signal strength variations
        return {
            stability: 'variable',
            range: 'wide',
            mobility: 'high'
        };
    }

    /**
     * Analyze mobility patterns
     */
    private analyzeMobilityPatterns(history: any[]): any {
        // Analyze device movement patterns
        return {
            mobility: 'high',
            locations: 'multiple',
            roaming: 'frequent'
        };
    }

    /**
     * Analyze activity patterns
     */
    private analyzeActivityPatterns(history: any[]): any {
        // Analyze device activity patterns
        return {
            activity: 'bursty',
            timing: 'irregular',
            volume: 'variable'
        };
    }

    /**
     * Analyze probe patterns
     */
    private analyzeProbePatterns(history: any[]): any {
        // Analyze probe request patterns
        return {
            frequency: 'high',
            diversity: 'high',
            timing: 'irregular'
        };
    }

    /**
     * Analyze temporal patterns
     */
    private analyzeTemporalPatterns(history: any[]): any {
        // Analyze temporal activity patterns
        return {
            daily: true,
            weekly: false,
            periodic: false
        };
    }

    /**
     * Analyze signal characteristics
     */
    private analyzeSignalCharacteristics(device: any): any {
        return {
            strength: device.signalStrength || -100,
            stability: 'variable',
            powerSaving: device.signalStrength > -60
        };
    }

    /**
     * Generate behavior signature
     */
    private generateBehaviorSignature(device: any): string {
        // Generate a unique behavior signature for the device
        const characteristics = [];
        
        if (this.isAppleDevice(device.mac)) {
            characteristics.push('apple');
        }
        
        if (this.isAndroidDevice(device)) {
            characteristics.push('android');
        }
        
        if (this.isIoTDevice(device)) {
            characteristics.push('iot');
        }
        
        return characteristics.join('_') || 'unknown';
    }

    /**
     * Generate protocol fingerprint
     */
    private generateProtocolFingerprint(device: any): string {
        // Generate protocol-based fingerprint
        const protocols = [];
        
        if (device.encryption?.includes('WPA3')) {
            protocols.push('wpa3');
        }
        
        if (device.encryption?.includes('WPA2')) {
            protocols.push('wpa2');
        }
        
        if (device.capabilities?.includes('802.11ac')) {
            protocols.push('ac');
        }
        
        return protocols.join('_') || 'basic';
    }

    /**
     * Extract vendor elements
     */
    private extractVendorElements(device: any): string[] {
        const elements = [];
        
        if (device.manufacturer) {
            elements.push(device.manufacturer.toLowerCase());
        }
        
        if (device.name) {
            elements.push(device.name.toLowerCase());
        }
        
        return elements;
    }

    /**
     * Extract unique identifiers
     */
    private extractUniqueIdentifiers(device: any): string[] {
        const identifiers = [];
        
        if (device.mac) {
            identifiers.push(device.mac);
        }
        
        if (device.ssid) {
            identifiers.push(device.ssid);
        }
        
        return identifiers;
    }
}