import { describe, expect, it } from 'vitest';

import { errMsg } from './error-utils';

describe('errMsg', () => {
	it('extracts message from Error instance', () => {
		expect(errMsg(new Error('something broke'))).toBe('something broke');
	});

	it('extracts message from TypeError', () => {
		expect(errMsg(new TypeError('cannot read property'))).toBe('cannot read property');
	});

	it('returns string values directly', () => {
		expect(errMsg('plain string error')).toBe('plain string error');
	});

	it('extracts message from object with message property', () => {
		expect(errMsg({ message: 'object error' })).toBe('object error');
	});

	it('stringifies null', () => {
		expect(errMsg(null)).toBe('null');
	});

	it('stringifies undefined', () => {
		expect(errMsg(undefined)).toBe('undefined');
	});

	it('stringifies numbers', () => {
		expect(errMsg(42)).toBe('42');
	});

	it('stringifies boolean', () => {
		expect(errMsg(false)).toBe('false');
	});

	it('stringifies objects without message property', () => {
		expect(errMsg({ code: 'ERR_TIMEOUT' })).toBe('[object Object]');
	});

	it('ignores non-string message properties', () => {
		expect(errMsg({ message: 123 })).toBe('[object Object]');
	});

	it('handles empty string', () => {
		expect(errMsg('')).toBe('');
	});
});
