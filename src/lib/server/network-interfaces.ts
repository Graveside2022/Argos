import { networkInterfaces } from "node:os";
import { execSync } from "node:child_process";

export interface NetworkInterface {
	name: string;
	addresses: string[];
	isUp: boolean;
	isWireless: boolean;
	supportsMonitor?: boolean;
}

export function getNetworkInterfaces(): NetworkInterface[] {
	const interfaces = networkInterfaces();
	const result: NetworkInterface[] = [];

	for (const [name, addresses] of Object.entries(interfaces)) {
		if (!addresses) continue;

		const ipv4Addresses = addresses
			.filter((addr) => addr.family === "IPv4" && !addr.internal)
			.map((addr) => addr.address);

		// Skip if no addresses or only loopback
		if (name === "lo" || ipv4Addresses.length === 0) continue;

		const iface: NetworkInterface = {
			name,
			addresses: ipv4Addresses,
			isUp: true,
			isWireless:
				name.startsWith("wlan") ||
				name.startsWith("wlp") ||
				name.includes("wifi"),
		};

		// Check if interface supports monitor mode (for wireless)
		if (iface.isWireless) {
			try {
				const iwconfig = execSync(`iwconfig ${name} 2>&1`).toString();
				iface.supportsMonitor =
					iwconfig.includes("Mode:") &&
					!iwconfig.includes("no wireless");
			} catch (_e) {
				iface.supportsMonitor = false;
			}
		}

		result.push(iface);
	}

	return result;
}

export function getAvailableInterface(): string {
	const interfaces = getNetworkInterfaces();

	// Prefer ethernet interfaces
	const ethernet = interfaces.find((i) => !i.isWireless);
	if (ethernet) return ethernet.name;

	// Otherwise use first available
	return interfaces[0]?.name || "eth0";
}
