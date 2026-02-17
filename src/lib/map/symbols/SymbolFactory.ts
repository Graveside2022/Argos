import ms from 'milsymbol';

export interface SymbolOptions {
	size?: number;
	uniqueDesignation?: string; // T (Text modifier)
	additionalInformation?: string; // H (Text modifier)
	fill?: boolean;
	frame?: boolean;
	icon?: boolean;
}

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
			icon: options.icon ?? true,
			// Force strict SIDC parsing if valid
			standard: '2525d'
		});

		// Ensure we return a canvas
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
	 * Helper to map Argos device types to loose SIDC equivalents
	 * @param type Argos device type (wifi, cell, etc)
	 * @param affiliation friendly, hostile, neutral, unknown
	 */
	static getSidcForDevice(
		type: string,
		affiliation: 'friendly' | 'hostile' | 'neutral' | 'unknown' = 'unknown'
	): string {
		// Version (10) + Standard (0) + Affiliation + Battle Dim + Status + Func ID ...

		// 10 0 X 90 00 00 00 00 00 0000 (Symbol Code structure for 2525D is complex)
		// 2525C SIDC: S F Z P ------ (15 chars)
		// S = Affiliation
		// F = Battle Dimension

		// Simplified mapping for MVP using 2525C Legacy format often supported by libraries or 2525D
		// milsymbol supports letter codes:
		// S - Warfighting
		// U - Unknown affiliation
		// P - Space? G - Ground?

		// Let's use simple letter-based SIDC construction for readability if library supports it,
		// OR construct 2525D number codes.
		// milsymbol prefers letter codes for 2525C or number codes for 2525D.

		// Let's use 2525C char codes as they are easier to debug manually.
		// Affiliation: F (Friendly), H (Hostile), N (Neutral), U (Unknown)
		// Battle Dim: G (Ground), A (Air), S (Sea), U (Subsurface), S (Space)
		// Function ID needs lookup.

		let sAff = 'U';
		switch (affiliation) {
			case 'friendly':
				sAff = 'F';
				break;
			case 'hostile':
				sAff = 'H';
				break;
			case 'neutral':
				sAff = 'N';
				break;
			case 'unknown':
				sAff = 'U';
				break;
		}

		// Default to Ground Unit for now? Or Signal?
		// S{AFF}G*U-----****
		// Device Types:
		// - wifi: Sensor?
		// - cell: Tower?

		// Example: Unidentified Ground Track -> S U G P - - - - - - - - - - -

		if (type === 'cell_tower') {
			// Fixed Infrastructure?
			return `S${sAff}GP-----****`; // Generic Ground
		}

		return `S${sAff}GP-----****`;
	}
}
