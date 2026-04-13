const F: Record<string, string[]> = {
	' ': ['000', '000', '000', '000', '000'],
	'.': ['000', '000', '000', '000', '010'],
	'-': ['000', '000', '111', '000', '000'],
	'–': ['000', '000', '111', '000', '000'],
	':': ['000', '010', '000', '010', '000'],
	'/': ['001', '001', '010', '100', '100'],
	'(': ['010', '100', '100', '100', '010'],
	')': ['010', '001', '001', '001', '010'],
	'·': ['000', '000', '010', '000', '000'],
	'0': ['111', '101', '101', '101', '111'],
	'1': ['010', '110', '010', '010', '111'],
	'2': ['111', '001', '111', '100', '111'],
	'3': ['111', '001', '111', '001', '111'],
	'4': ['101', '101', '111', '001', '001'],
	'5': ['111', '100', '111', '001', '111'],
	'6': ['111', '100', '111', '101', '111'],
	'7': ['111', '001', '010', '100', '100'],
	'8': ['111', '101', '111', '101', '111'],
	'9': ['111', '101', '111', '001', '111'],
	A: ['111', '101', '111', '101', '101'],
	B: ['110', '101', '110', '101', '110'],
	C: ['111', '100', '100', '100', '111'],
	D: ['110', '101', '101', '101', '110'],
	E: ['111', '100', '110', '100', '111'],
	F: ['111', '100', '110', '100', '100'],
	G: ['111', '100', '101', '101', '111'],
	H: ['101', '101', '111', '101', '101'],
	I: ['111', '010', '010', '010', '111'],
	J: ['001', '001', '001', '101', '111'],
	K: ['101', '101', '110', '101', '101'],
	L: ['100', '100', '100', '100', '111'],
	M: ['101', '111', '111', '101', '101'],
	N: ['101', '111', '111', '111', '101'],
	O: ['111', '101', '101', '101', '111'],
	P: ['111', '101', '111', '100', '100'],
	Q: ['111', '101', '101', '111', '011'],
	R: ['111', '101', '110', '101', '101'],
	S: ['111', '100', '111', '001', '111'],
	T: ['111', '010', '010', '010', '010'],
	U: ['101', '101', '101', '101', '111'],
	V: ['101', '101', '101', '101', '010'],
	W: ['101', '101', '111', '111', '101'],
	X: ['101', '101', '010', '101', '101'],
	Y: ['101', '101', '010', '010', '010'],
	Z: ['111', '001', '010', '100', '111']
};

const GLYPH_W = 3;
const GLYPH_H = 5;
const SPACING = 1;

function drawGlyphRow(
	buf: Buffer,
	width: number,
	x: number,
	y: number,
	row: string,
	rgb: [number, number, number]
): void {
	for (let gx = 0; gx < GLYPH_W; gx++) {
		if (row[gx] === '1') putPixel(buf, width, x + gx, y, rgb);
	}
}

function drawGlyph(
	buf: Buffer,
	width: number,
	x: number,
	y: number,
	glyph: string[],
	rgb: [number, number, number]
): void {
	for (let gy = 0; gy < GLYPH_H; gy++) {
		drawGlyphRow(buf, width, x, y + gy, glyph[gy], rgb);
	}
}

function glyphFor(ch: string): string[] {
	return F[ch] ?? F[' '];
}

export function drawText(
	buf: Buffer,
	width: number,
	x: number,
	y: number,
	text: string,
	rgb: [number, number, number]
): void {
	const upper = text.toUpperCase();
	const step = GLYPH_W + SPACING;
	for (let i = 0; i < upper.length; i++) {
		drawGlyph(buf, width, x + i * step, y, glyphFor(upper[i]), rgb);
	}
}

function putPixel(
	buf: Buffer,
	width: number,
	x: number,
	y: number,
	rgb: [number, number, number]
): void {
	if (x < 0 || y < 0 || x >= width) return;
	const idx = (width * y + x) << 2;
	if (idx + 3 >= buf.length) return;
	buf[idx] = rgb[0];
	buf[idx + 1] = rgb[1];
	buf[idx + 2] = rgb[2];
	buf[idx + 3] = 0xff;
}

export { GLYPH_H, GLYPH_W, SPACING };
