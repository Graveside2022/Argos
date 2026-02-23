export interface SymbolOptions {
	size?: number;
	uniqueDesignation?: string;
	additionalInformation?: string;
}

export type Affiliation = 'friendly' | 'hostile' | 'neutral' | 'unknown';

const AFFILIATION_CODES: Record<Affiliation, string> = {
	friendly: 'F',
	hostile: 'H',
	neutral: 'N',
	unknown: 'U'
};

/**
 * MIL-STD-2525C Function ID mappings for Argos device types.
 * SIDC structure (15 chars): S {Aff} {BattleDim} {Status} {FuncID x6} {Mod x4}
 * Each entry: [battleDimension, functionId]
 */
const DEVICE_TYPE_SIDC: Record<string, [string, string]> = {
	wifi: ['G', 'EVSR--'],
	ap: ['G', 'EVSR--'],
	'Wi-Fi AP': ['G', 'EVSR--'],
	client: ['G', 'EVSC--'],
	'Wi-Fi Client': ['G', 'EVSC--'],
	bridge: ['G', 'EVSR--'],
	'Wi-Fi Bridged': ['G', 'EVSR--'],
	bluetooth: ['G', 'EVSDF-'],
	ble: ['G', 'EVSDF-'],
	btle: ['G', 'EVSDF-'],
	BTLE: ['G', 'EVSDF-'],
	Bluetooth: ['G', 'EVSDF-'],
	cell_tower: ['G', 'IPC---'],
	cellular: ['G', 'IPC---'],
	drone: ['A', 'MFQ---'],
	uav: ['A', 'MFQ---'],
	self: ['G', 'UCFEW-'],
	argos: ['G', 'UCFEW-']
};

const DEFAULT_SIDC_PARTS: [string, string] = ['G', 'U-----'];

/** Lazily loaded mil-sym-ts-web module */
let milSymModule: typeof import('@armyc2.c5isr.renderer/mil-sym-ts-web') | null = null;

async function getMilSymModule() {
	if (!milSymModule) {
		milSymModule = await import('@armyc2.c5isr.renderer/mil-sym-ts-web');
	}
	return milSymModule;
}

export class SymbolFactory {
	private static readonly DEFAULT_SIZE = 24;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private static renderer: any = null;

	private static async getRenderer() {
		const mod = await getMilSymModule();
		if (!this.renderer) {
			this.renderer = mod.MilStdIconRenderer.getInstance();
		}
		return { renderer: this.renderer, mod };
	}

	/** Build modifiers and attributes maps from SymbolOptions */
	private static buildRenderMaps(
		mod: Awaited<ReturnType<typeof getMilSymModule>>,
		options: SymbolOptions
	): { modifiers: Map<string, string>; attributes: Map<string, string> } {
		const modifiers = new Map<string, string>();
		const attributes = new Map<string, string>();

		attributes.set(mod.MilStdAttributes.PixelSize, String(options.size ?? this.DEFAULT_SIZE));

		if (options.uniqueDesignation) {
			modifiers.set(mod.Modifiers.T_UNIQUE_DESIGNATION_1, options.uniqueDesignation);
		}
		if (options.additionalInformation) {
			modifiers.set(mod.Modifiers.H_ADDITIONAL_INFO_1, options.additionalInformation);
		}

		return { modifiers, attributes };
	}

	static async createSymbolSVG(sidc: string, options: SymbolOptions = {}): Promise<string> {
		const { renderer, mod } = await this.getRenderer();
		const { modifiers, attributes } = this.buildRenderMaps(mod, options);
		const result = renderer.RenderSVG(sidc, modifiers, attributes);
		return result?.getSVG() ?? '';
	}

	static async createSymbolDataUrl(sidc: string, options: SymbolOptions = {}): Promise<string> {
		const { renderer, mod } = await this.getRenderer();
		const { modifiers, attributes } = this.buildRenderMaps(mod, options);
		const result = renderer.RenderSVG(sidc, modifiers, attributes);
		return result?.getSVGDataURI() ?? '';
	}

	static getSidcForDevice(type: string, affiliation: Affiliation = 'unknown'): string {
		const aff = AFFILIATION_CODES[affiliation];
		const normalized = type.toLowerCase().trim();
		const parts = DEVICE_TYPE_SIDC[type] ?? DEVICE_TYPE_SIDC[normalized] ?? DEFAULT_SIDC_PARTS;
		const [battleDim, funcId] = parts;
		return `S${aff}${battleDim}P${funcId}-----`;
	}

	static cotTypeToSidc(cotType: string): string {
		if (!cotType || !cotType.startsWith('a-')) {
			return `SUGPU-----`;
		}

		const parts = cotType.split('-');
		const cotAff = (parts[1] || 'u').toUpperCase();
		const cotDim = (parts[2] || 'G').toUpperCase();
		const funcParts = parts.slice(3).map((p) => p.charAt(0).toUpperCase());
		const funcId = funcParts.join('').padEnd(6, '-').substring(0, 6);

		return `S${cotAff}${cotDim}P${funcId}--`;
	}
}
