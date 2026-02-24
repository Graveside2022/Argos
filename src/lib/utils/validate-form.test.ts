import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validateForm } from './validate-form';

const TestSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	age: z.number().int().min(0, 'Age must be non-negative'),
	email: z.string().email('Invalid email').optional()
});

describe('validateForm', () => {
	it('returns typed data on valid input', () => {
		const result = validateForm(TestSchema, { name: 'Alice', age: 30 });
		expect(result.isValid).toBe(true);
		expect(result.data).toEqual({ name: 'Alice', age: 30 });
		expect(result.errors).toEqual({});
	});

	it('returns field-keyed errors on invalid input', () => {
		const result = validateForm(TestSchema, { name: '', age: -1 });
		expect(result.isValid).toBe(false);
		expect(result.data).toBeNull();
		expect(result.errors.name).toBe('Name is required');
		expect(result.errors.age).toBe('Age must be non-negative');
	});

	it('uses _root key for root-level validation errors', () => {
		const RootSchema = z.string().min(1, 'Cannot be empty');
		const result = validateForm(RootSchema, '');
		expect(result.isValid).toBe(false);
		expect(result.errors._root).toBe('Cannot be empty');
	});

	it('keeps only first error per field', () => {
		const StrictSchema = z.object({
			value: z
				.string()
				.min(3, 'Too short')
				.max(5, 'Too long')
				.regex(/^[a-z]+$/, 'Lowercase only')
		});
		const result = validateForm(StrictSchema, { value: '' });
		expect(result.isValid).toBe(false);
		// Empty string triggers min(3) first — only that error should appear
		expect(result.errors.value).toBe('Too short');
	});

	it('handles optional fields correctly', () => {
		const result = validateForm(TestSchema, { name: 'Bob', age: 25, email: 'not-an-email' });
		expect(result.isValid).toBe(false);
		expect(result.errors.email).toBe('Invalid email');
	});

	it('returns valid for optional fields when omitted', () => {
		const result = validateForm(TestSchema, { name: 'Bob', age: 25 });
		expect(result.isValid).toBe(true);
		expect(result.data).toEqual({ name: 'Bob', age: 25 });
	});
});
