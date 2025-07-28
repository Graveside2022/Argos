import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { logInfo, logWarn, logError } from '$lib/utils/logger';

const execAsync = promisify(exec);

/**
 * Alfa adapter detection utilities
 */
export class AlfaDetector {
    // Common Alfa adapter USB IDs
    private static readonly ALFA_USB_IDS = {
        '0bda:8187': 'Alfa AWUS036H (RTL8187)',
        '148f:3070': 'Alfa AWUS036NH (RT3070)',
        '148f:5370': 'Alfa AWUS036NEH (RT5370)',
        '0bda:8812': 'Alfa AWUS036AC/ACH (RTL8812AU)',
        '0bda:8813': 'Alfa AWUS036ACS (RTL8813AU)',
        '2357:010c': 'Alfa AWUS036ACM (MT7612U)',
        '0e8d:7612': 'Generic MT7612U (Various brands)',
        '148f:7601': 'Alfa AWUS036N (MT7601U)',
        '148f:5572': 'Alfa AWUS052NHS (RT5572)',
        '0cf3:9271': 'Alfa AWUS036NHA (AR9271)'
    };

    /**
     * Detect connected Alfa WiFi adapters
     */
    static async detectAlfaAdapters(): Promise<{ usbId: string; description: string; interface?: string }[]> {
        const detectedAdapters: { usbId: string; description: string; interface?: string }[] = [];

        try {
            // Try using lsusb first
            try {
                const { stdout } = await execAsync('lsusb');
                for (const [usbId, description] of Object.entries(this.ALFA_USB_IDS)) {
                    if (stdout.includes(usbId)) {
                        logInfo(`Detected Alfa adapter: ${description} (${usbId})`);
                        detectedAdapters.push({ usbId, description });
                    }
                }
            } catch (lsusbError) {
                logWarn('lsusb not available, trying sysfs method');
                
                // Fallback to reading from sysfs
                const usbDevices = await readdir('/sys/bus/usb/devices/');
                for (const device of usbDevices) {
                    try {
                        const vendorPath = join('/sys/bus/usb/devices/', device, 'idVendor');
                        const productPath = join('/sys/bus/usb/devices/', device, 'idProduct');
                        
                        const vendor = (await readFile(vendorPath, 'utf-8')).trim();
                        const product = (await readFile(productPath, 'utf-8')).trim();
                        const usbId = `${vendor}:${product}`;
                        
                        const alfaDevice = this.ALFA_USB_IDS[usbId as keyof typeof this.ALFA_USB_IDS];
                        if (alfaDevice) {
                            logInfo(`Detected Alfa adapter via sysfs: ${alfaDevice} (${usbId})`);
                            detectedAdapters.push({ 
                                usbId, 
                                description: alfaDevice 
                            });
                        }
                    } catch (readError) {
                        // Skip devices we can't read
                    }
                }
            }

            // Now find corresponding network interfaces
            for (const adapter of detectedAdapters) {
                const iface = await this.findInterfaceForAdapter(adapter.usbId);
                if (iface) {
                    adapter.interface = iface;
                }
            }

        } catch (error) {
            logError('Error detecting Alfa adapters:', error as Record<string, unknown>);
        }

        return detectedAdapters;
    }

    /**
     * Find network interface for a USB adapter
     */
    private static async findInterfaceForAdapter(usbId: string): Promise<string | null> {
        try {
            const interfaces = await readdir('/sys/class/net/');
            
            for (const iface of interfaces) {
                // Skip non-wireless interfaces and wlan0
                if (['lo', 'eth0', 'wlan0'].includes(iface)) {
                    continue;
                }

                try {
                    // Check if it's a wireless interface
                    const wirelessPath = join('/sys/class/net/', iface, 'wireless');
                    const phy80211Path = join('/sys/class/net/', iface, 'phy80211');
                    
                    const isWireless = await Promise.any([
                        readdir(wirelessPath).then(() => true),
                        readdir(phy80211Path).then(() => true)
                    ]).catch(() => false);

                    if (isWireless) {
                        logInfo(`Found wireless interface: ${iface}`);
                        return iface;
                    }
                } catch (error) {
                    // Not a wireless interface
                }
            }
        } catch (error) {
            logError('Error finding network interfaces:', error as Record<string, unknown>);
        }

        return null;
    }

    /**
     * Get the first available Alfa interface
     */
    static async getAlfaInterface(): Promise<string | null> {
        const adapters = await this.detectAlfaAdapters();
        
        if (adapters.length === 0) {
            logWarn('No Alfa adapters detected');
            return null;
        }

        // Return the first adapter with an interface
        for (const adapter of adapters) {
            if (adapter.interface) {
                logInfo(`Selected Alfa interface: ${adapter.interface} (${adapter.description})`);
                return adapter.interface;
            }
        }

        logWarn('Alfa adapter detected but no interface found');
        return null;
    }

    /**
     * Check if a specific interface is an Alfa adapter
     */
    static async isAlfaInterface(iface: string): Promise<boolean> {
        const adapters = await this.detectAlfaAdapters();
        return adapters.some(adapter => adapter.interface === iface);
    }
}