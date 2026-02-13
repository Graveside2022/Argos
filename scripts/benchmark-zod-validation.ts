#!/usr/bin/env tsx
/**
 * Benchmark script for Zod validation overhead
 * Target: < 5ms per API response validation (NFR-001)
 *
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T006
 */

import { z } from 'zod';

// Common schemas used in Argos API responses
const SignalReadingSchema = z.object({
	frequency: z.number().min(0).max(6000), // MHz
	power: z.number().min(-120).max(0), // dBm
	timestamp: z.number().int().positive(),
	source: z.enum(['hackrf', 'usrp', 'kismet']),
	metadata: z.record(z.unknown()).optional()
});

const ApiResponseSchema = z.object({
	success: z.boolean(),
	data: z.array(SignalReadingSchema),
	timestamp: z.number()
});

// Test data
const sampleSignal = {
	frequency: 915.5,
	power: -45.2,
	timestamp: Date.now(),
	source: 'hackrf' as const,
	metadata: { gain: 20, bandwidth: 2000000 }
};

const sampleApiResponse = {
	success: true,
	data: Array(100).fill(sampleSignal),
	timestamp: Date.now()
};

// Benchmark configuration
const iterations = 1000;

console.log('='.repeat(60));
console.log('Zod Validation Performance Benchmark');
console.log('='.repeat(60));
console.log(`Iterations: ${iterations}`);
console.log(`Target: < 5ms per validation (NFR-001)\n`);

// Benchmark 1: Single signal validation
console.log('Test 1: Single SignalReading validation');
const start1 = performance.now();
for (let i = 0; i < iterations; i++) {
	SignalReadingSchema.parse(sampleSignal);
}
const end1 = performance.now();
const singleAvg = (end1 - start1) / iterations;
console.log(`  Total time: ${(end1 - start1).toFixed(2)}ms`);
console.log(`  Average per validation: ${singleAvg.toFixed(4)}ms`);
console.log(`  Status: ${singleAvg < 5 ? '✅ PASS' : '❌ FAIL'}`);

// Benchmark 2: API response with 100 signals
console.log('\nTest 2: API response with 100 signals');
const start2 = performance.now();
for (let i = 0; i < iterations; i++) {
	ApiResponseSchema.parse(sampleApiResponse);
}
const end2 = performance.now();
const apiAvg = (end2 - start2) / iterations;
console.log(`  Total time: ${(end2 - start2).toFixed(2)}ms`);
console.log(`  Average per validation: ${apiAvg.toFixed(4)}ms`);
console.log(`  Status: ${apiAvg < 5 ? '✅ PASS' : '❌ FAIL'}`);

// Benchmark 3: safeParse (graceful error handling)
const invalidSignal = { ...sampleSignal, frequency: -100 };
console.log('\nTest 3: safeParse with invalid data');
const start3 = performance.now();
for (let i = 0; i < iterations; i++) {
	SignalReadingSchema.safeParse(invalidSignal);
}
const end3 = performance.now();
const safeAvg = (end3 - start3) / iterations;
console.log(`  Total time: ${(end3 - start3).toFixed(2)}ms`);
console.log(`  Average per validation: ${safeAvg.toFixed(4)}ms`);
console.log(`  Status: ${safeAvg < 5 ? '✅ PASS' : '❌ FAIL'}`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));
const allPass = singleAvg < 5 && apiAvg < 5 && safeAvg < 5;
console.log(`Overall: ${allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAIL'}`);
console.log(`\nNote: If >5ms, document in plan.md and re-evaluate after P1 deployment`);

process.exit(allPass ? 0 : 1);
