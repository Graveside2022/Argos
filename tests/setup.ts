import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	readyState: 1,
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3
})) as unknown as typeof WebSocket;

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock canvas with complete CanvasRenderingContext2D interface
HTMLCanvasElement.prototype.getContext = vi
	.fn()
	.mockImplementation((contextId: string, _options?: unknown) => {
		if (contextId === '2d') {
			return {
				// Drawing rectangles
				fillStyle: '',
				fillRect: vi.fn(),
				strokeStyle: '',
				strokeRect: vi.fn(),
				clearRect: vi.fn(),

				// Drawing text
				font: '10px sans-serif',
				textAlign: 'start',
				textBaseline: 'alphabetic',
				direction: 'ltr',
				fillText: vi.fn(),
				strokeText: vi.fn(),
				measureText: vi.fn(() => ({
					width: 0,
					actualBoundingBoxLeft: 0,
					actualBoundingBoxRight: 0,
					actualBoundingBoxAscent: 0,
					actualBoundingBoxDescent: 0,
					fontBoundingBoxAscent: 0,
					fontBoundingBoxDescent: 0,
					emHeightAscent: 0,
					emHeightDescent: 0,
					hangingBaseline: 0,
					alphabeticBaseline: 0,
					ideographicBaseline: 0
				})),

				// Drawing paths
				beginPath: vi.fn(),
				closePath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				arc: vi.fn(),
				arcTo: vi.fn(),
				bezierCurveTo: vi.fn(),
				quadraticCurveTo: vi.fn(),
				ellipse: vi.fn(),
				rect: vi.fn(),
				fill: vi.fn(),
				stroke: vi.fn(),
				clip: vi.fn(),

				// Transformations
				scale: vi.fn(),
				rotate: vi.fn(),
				translate: vi.fn(),
				transform: vi.fn(),
				setTransform: vi.fn(),
				resetTransform: vi.fn(),
				save: vi.fn(),
				restore: vi.fn(),

				// Compositing
				globalAlpha: 1,
				globalCompositeOperation: 'source-over',

				// Line styles
				lineWidth: 1,
				lineCap: 'butt',
				lineJoin: 'miter',
				miterLimit: 10,
				setLineDash: vi.fn(),
				getLineDash: vi.fn(() => []),
				lineDashOffset: 0,

				// Shadows
				shadowBlur: 0,
				shadowColor: 'rgba(0, 0, 0, 0)',
				shadowOffsetX: 0,
				shadowOffsetY: 0,

				// Gradients and patterns
				createLinearGradient: vi.fn(),
				createRadialGradient: vi.fn(),
				createPattern: vi.fn(),

				// Image drawing
				drawImage: vi.fn(),

				// Image data
				createImageData: vi.fn(() => ({
					data: new Uint8ClampedArray(4),
					width: 1,
					height: 1,
					colorSpace: 'srgb'
				})),
				getImageData: vi.fn(() => ({
					data: new Uint8ClampedArray(4),
					width: 1,
					height: 1,
					colorSpace: 'srgb'
				})),
				putImageData: vi.fn(),

				// Canvas state
				canvas: document.createElement('canvas'),

				// Path2D support
				isPointInPath: vi.fn(() => false),
				isPointInStroke: vi.fn(() => false),

				// Additional properties for modern canvas
				filter: 'none',
				imageSmoothingEnabled: true,
				imageSmoothingQuality: 'low'
			} as unknown as CanvasRenderingContext2D;
		}
		return null;
	});

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
})) as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
})) as unknown as typeof IntersectionObserver;
