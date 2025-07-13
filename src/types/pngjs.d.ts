declare module 'pngjs' {
	export interface PNGOptions {
		width?: number;
		height?: number;
		bitDepth?: 8 | 16;
		colorType?: 0 | 2 | 4 | 6;
		fill?: boolean;
		filterType?: number;
	}

	export interface PNGMetadata {
		width: number;
		height: number;
		depth: number;
		interlace: boolean;
		palette: boolean;
		color: boolean;
		alpha: boolean;
		bpp: number;
		colorType: number;
		bitDepth: number;
	}

	export class PNG {
		constructor(options?: PNGOptions);

		width: number;
		height: number;
		data: Buffer;
		gamma: number;

		// Methods
		pack(): PNG;
		parse(data: Buffer | string, callback?: (error: Error | null, data: this) => void): PNG;
		write(data: Buffer): boolean;
		end(data?: Buffer): void;

		// Static methods
		static sync: {
			read(buffer: Buffer, options?: PNGOptions): PNG;
			write(png: PNG, options?: PNGOptions): Buffer;
		};

		// Events
		on(event: 'metadata', listener: (metadata: PNGMetadata) => void): this;
		on(event: 'parsed', listener: (data: Buffer) => void): this;
		on(event: 'error', listener: (error: Error) => void): this;
		on(event: 'close', listener: () => void): this;
		on(event: 'end', listener: () => void): this;
		on(event: 'data', listener: (data: Buffer) => void): this;

		// Stream methods
		pipe<T>(destination: T, options?: { end?: boolean }): T;
	}
}
