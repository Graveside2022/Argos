/**
 * Resolves a CSS custom property to its computed hex value.
 * Returns fallback if SSR context (no DOM) or variable not found.
 */
/** Normalize CSS var name to include -- prefix. */
function normalizeVarName(varName: string): string {
	return varName.startsWith('--') ? varName : `--${varName}`;
}

export function resolveThemeColor(varName: string, fallback = '#000000'): string {
	if (typeof document === 'undefined') return fallback;
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(normalizeVarName(varName))
		.trim();
	return (value && cssColorToHex(value)) || fallback;
}

/**
 * Converts a CSS color value (hsl, rgb, hex) to a hex string.
 */
function cssColorToHex(color: string): string | null {
	// Already hex
	if (color.startsWith('#')) {
		return color;
	}

	// Use a temporary element to resolve any CSS color format to rgb
	const el = document.createElement('div');
	el.style.color = color;
	document.body.appendChild(el);
	const computed = getComputedStyle(el).color;
	document.body.removeChild(el);

	// Parse rgb(r, g, b) or rgba(r, g, b, a)
	const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (!match) {
		return null;
	}

	const r = parseInt(match[1], 10);
	const g = parseInt(match[2], 10);
	const b = parseInt(match[3], 10);

	return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
