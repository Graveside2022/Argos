import ms from 'milsymbol';

export interface SymbolOptions {
	size?: number;
	uniqueDesignation?: string; // T (Text modifier)
	additionalInformation?: string; // H (Text modifier)
	fill?: boolean;
	frame?: boolean;
	icon?: boolean;
}

export type Affiliation = 'friendly' | 'hostile' | 'neutral' | 'unknown';

/** MIL-STD-2525C affiliation character codes */
const AFFILIATION_CODES: Record<Affiliation, string> = {
	friendly: 'F',
	hostile: 'H',
	neutral: 'N',
	unknown: 'U'
};

/**
 * MIL-STD-2525C Function ID mappings for Argos device types.
 *
 * SIDC structure (15 chars): S {Aff} {BattleDim} {Status} {FuncID x6} {Mod x4}
 * - Position 1: S = Warfighting
 * - Position 2: Affiliation (F/H/N/U)
 * - Position 3: Battle Dimension (G=Ground, A=Air)
 * - Position 4: Status (P=Present)
 * - Positions 5-10: Function ID
 * - Positions 11-15: Symbol Modifier (usually -----)
 *
 * Each entry: [battleDimension, functionId]
 */
const DEVICE_TYPE_SIDC: Record<string, [string, string]> = {
	// WiFi Access Points → Ground Signal Intelligence / Electronic Warfare Sensor
	wifi: ['G', 'EVSR--'],
	ap: ['G', 'EVSR--'],
	'Wi-Fi AP': ['G', 'EVSR--'],

	// WiFi Clients → Ground Signal Intelligence / Intercept
	client: ['G', 'EVSC--'],
	'Wi-Fi Client': ['G', 'EVSC--'],

	// Bridged WiFi → Ground Signal Intelligence / Relay
	bridge: ['G', 'EVSR--'],
	'Wi-Fi Bridged': ['G', 'EVSR--'],

	// Bluetooth / BLE → Ground Signal Intelligence / Direction Finding
	bluetooth: ['G', 'EVSDF-'],
	ble: ['G', 'EVSDF-'],
	btle: ['G', 'EVSDF-'],
	BTLE: ['G', 'EVSDF-'],
	Bluetooth: ['G', 'EVSDF-'],

	// Cell Towers → Ground Infrastructure / Communications Tower
	cell_tower: ['G', 'IPC---'],
	cellular: ['G', 'IPC---'],

	// Drones / UAVs → Air Track
	drone: ['A', 'MFQ---'],
	uav: ['A', 'MFQ---'],

	// Self (Argos node) → Ground Cyber/EW Team Unit
	self: ['G', 'UCFEW-'],
	argos: ['G', 'UCFEW-']
};

/** Default: Ground Unknown present */
const DEFAULT_SIDC_PARTS: [string, string] = ['G', 'U-----'];

export class SymbolFactory {
	private static readonly DEFAULT_SIZE = 24;

	/**
	 * Generates a MIL-STD-2525 symbol as an HTMLCanvasElement
	 * @param sidc The 15-character Symbol ID Code
	 * @param options Customization options
	 */
	static createSymbol(sidc: string, options: SymbolOptions = {}): HTMLCanvasElement {
		const symbol = new ms.Symbol(sidc, {
			size: options.size || this.DEFAULT_SIZE,
			uniqueDesignation: options.uniqueDesignation,
			additionalInformation: options.additionalInformation,
			fill: options.fill ?? true,
			frame: options.frame ?? true,
			icon: options.icon ?? true
		});

		return symbol.asCanvas();
	}

	/**
	 * Generates a Data URL for the symbol (useful for MapLibre icon-image)
	 */
	static createSymbolDataUrl(sidc: string, options: SymbolOptions = {}): string {
		const canvas = this.createSymbol(sidc, options);
		return canvas.toDataURL('image/png');
	}

	/**
	 * Maps Argos device types to MIL-STD-2525C Symbol ID Codes.
	 *
	 * Supports Kismet types (AP, CLIENT, BRIDGE, Wi-Fi AP, etc.),
	 * agent types (wifi, bluetooth, cellular), and special types (self, drone).
	 */
	static getSidcForDevice(type: string, affiliation: Affiliation = 'unknown'): string {
		const aff = AFFILIATION_CODES[affiliation];
		const normalized = type.toLowerCase().trim();
		const parts = DEVICE_TYPE_SIDC[type] ?? DEVICE_TYPE_SIDC[normalized] ?? DEFAULT_SIDC_PARTS;
		const [battleDim, funcId] = parts;

		// S{Aff}{BattleDim}P{FuncId}----- = 15 chars
		return `S${aff}${battleDim}P${funcId}-----`;
	}

	/**
	 * Maps a CoT atom type string to a MIL-STD-2525C SIDC.
	 *
	 * CoT types follow the pattern: a-{aff}-{dim}-{funcId...}
	 * e.g., "a-f-G-U-C-I" = atom, friendly, ground, unit, combat, infantry
	 */
	static cotTypeToSidc(cotType: string): string {
		if (!cotType || !cotType.startsWith('a-')) {
			return `SUGPU-----`; // Unknown ground unit
		}

		const parts = cotType.split('-');
		// parts[0] = 'a' (atom)
		// parts[1] = affiliation: f(riend), h(ostile), n(eutral), u(nknown)
		// parts[2] = battle dimension: G(round), A(ir), S(ea), etc.
		// parts[3+] = function codes

		const cotAff = (parts[1] || 'u').toUpperCase();
		const cotDim = (parts[2] || 'G').toUpperCase();

		// Build function ID from remaining parts (pad to 6 chars)
		const funcParts = parts.slice(3).map((p) => p.charAt(0).toUpperCase());
		const funcId = funcParts.join('').padEnd(6, '-').substring(0, 6);

		return `S${cotAff}${cotDim}P${funcId}--`;
	}
}
