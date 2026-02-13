# Property-Based Testing with fast-check

## Overview

Argos uses **property-based testing** to validate input sanitizers and security-critical functions. Instead of hand-crafted test cases, property-based tests generate **thousands of random inputs** to verify that functions behave correctly for ALL inputs, not just anticipated edge cases.

## Why Property-Based Testing for Security?

Traditional unit testing checks **examples**. Property-based testing verifies **universal properties**.

### Traditional Testing (Example-Based)

```typescript
test('validateInterfaceName accepts eth0', () => {
	expect(validateInterfaceName('eth0')).toBe('eth0');
});

test('validateInterfaceName rejects shell injection', () => {
	expect(() => validateInterfaceName('eth0; rm -rf /')).toThrow();
});
```

✅ Tests pass
❓ But what about: `eth0\x00malicious`, `../etc/passwd`, `日本語`, `\uFFFD`, ...?

### Property-Based Testing (Universal Properties)

```typescript
test('validateInterfaceName rejects ALL strings with path traversal', () => {
	fc.assert(
		fc.property(
			fc.string().filter((s) => s.includes('..') || s.includes('/')),
			(s) => {
				expect(() => validateInterfaceName(s)).toThrow(InputValidationError);
			}
		),
		{ numRuns: 500 } // Tests 500 random strings matching the filter
	);
});
```

✅ Tests 500 random strings with `.` or `/`
✅ Catches Unicode, control chars, null bytes, ...
✅ Verifies invariant holds for ALL inputs

## Security Benefits

| Attack Vector          | Example-Based Testing                                    | Property-Based Testing                   |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------- |
| **Unicode Exploits**   | Requires manual test cases for each Unicode range        | Auto-tests 1000s of Unicode strings      |
| **Control Characters** | Might miss `\x00`, `\x0D`, `\x1F`                        | Tests all control chars (`\x00-\x1F`)    |
| **Regex Backtracking** | Hard to craft worst-case input                           | Auto-generates 10,000-char strings       |
| **Numeric Edge Cases** | Might miss `NaN`, `-0`, `Infinity`, `MAX_SAFE_INTEGER+1` | Tests all IEEE 754 edge cases            |
| **Path Traversal**     | Tests `../../../etc/passwd`                              | Tests 500 variations with `.`, `/`, `\0` |

## Fast-Check Library

Argos uses [fast-check](https://github.com/dubzzz/fast-check) v4.5.3 for property-based testing.

### Installation

```bash
npm install --save-dev fast-check
```

### Basic Usage

```typescript
import fc from 'fast-check';
import { expect, test } from 'vitest';

test('property holds for all inputs', () => {
	fc.assert(
		fc.property(
			fc.integer(), // Arbitrary generator
			(n) => {
				// Property to verify
				expect(Math.abs(n)).toBeGreaterThanOrEqual(0);
			}
		),
		{ numRuns: 1000 } // Run 1000 times with random inputs
	);
});
```

## Argos Test Suite

**Location**: `tests/security/property-based.test.ts` (479 lines)

### Test Coverage

#### 1. Numeric Validation (`validateNumericParam`)

- ✅ Accepts all finite numbers within range (1000 runs)
- ✅ Rejects non-numeric strings (500 runs)
- ✅ Rejects numbers below minimum (500 runs)
- ✅ Rejects numbers above maximum (500 runs)
- ✅ Rejects `NaN`, `Infinity`, `-Infinity`
- ✅ Handles boundary values correctly (exactly at min/max)
- ✅ Handles negative ranges (500 runs)

#### 2. Allowlist Validation (`validateAllowlist`)

- ✅ Accepts all values in allowlist
- ✅ Rejects all strings NOT in allowlist (500 runs)
- ✅ Case-sensitive (rejects `START` when allowlist has `start`)
- ✅ Rejects non-string types

#### 3. MAC Address Validation (`validateMacAddress`)

- ✅ Accepts valid MAC formats `XX:XX:XX:XX:XX:XX` (500 runs)
- ✅ Rejects strings with shell metacharacters (`;`, `&`, `|`, `` ` ``, etc.) (500 runs)
- ✅ Rejects invalid formats (wrong delimiter, too short, SQL injection)
- ✅ Accepts both uppercase and lowercase hex

#### 4. Interface Name Validation (`validateInterfaceName`)

- ✅ Accepts valid Linux interface names (`eth0`, `wlan0`, `mon0`, etc.)
- ✅ Rejects path traversal attempts (500 runs)
- ✅ Rejects names exceeding IFNAMSIZ (15 chars) (200 runs)
- ✅ Rejects empty string
- ✅ Rejects special characters (`@`, `#`, `$`, etc.)
- ✅ Rejects shell injection attempts
- ✅ Handles boundary length (exactly 15 chars)

#### 5. Path Validation (`validatePathWithinDir`)

- ✅ Accepts paths within allowed directory
- ✅ Rejects path traversal (`../../etc/passwd`, etc.)
- ✅ Rejects absolute paths outside allowed directory
- ✅ Rejects null bytes in path
- ✅ Rejects non-string types
- ✅ Handles symbolic link paths safely

#### 6. Security Invariants (All Validators)

- ✅ Never return `undefined`
- ✅ Never return `null`
- ✅ Always throw `InputValidationError` on invalid input
- ✅ Never silently coerce invalid input

#### 7. Performance (Catastrophic Backtracking Prevention)

- ✅ MAC address validation handles 10,000-char strings in <100ms
- ✅ Interface name validation handles 10,000-char strings in <100ms

#### 8. Unicode and Control Characters

- ✅ Handles Unicode safely (Japanese, Greek, Arabic, Hebrew, emoji)
- ✅ Rejects control characters that could be exploited

## Arbitrary Generators

Fast-check provides generators for creating random test inputs:

### Numeric Generators

```typescript
fc.integer(); // Random integer
fc.integer({ min: 0, max: 100 }); // Range-constrained
fc.double(); // IEEE 754 double
fc.double({ noNaN: true }); // Exclude NaN
fc.float(); // 32-bit float
```

### String Generators

```typescript
fc.string(); // Any string
fc.string({ minLength: 5 }); // Min length
fc.string({ maxLength: 100 }); // Max length
fc.asciiString(); // ASCII only
fc.hexaString(); // Hex characters
fc.unicodeString(); // Full Unicode
```

### Filtering Generators

```typescript
fc.string().filter((s) => s.includes('..')); // Only strings with '..'
fc.string().filter((s) => isNaN(Number(s))); // Non-numeric strings
fc.integer().filter((n) => n < 0); // Negative integers
```

### Composite Generators

```typescript
fc.tuple(fc.string(), fc.integer()); // [string, number] pair
fc.array(fc.integer()); // Array of integers
fc.record({ name: fc.string(), age: fc.integer() }); // Object
```

### Custom Generators

```typescript
// Generate valid MAC addresses
const hexByte = fc
	.integer({ min: 0, max: 255 })
	.map((n) => n.toString(16).padStart(2, '0').toUpperCase());

fc.property(
	fc.tuple(hexByte, hexByte, hexByte, hexByte, hexByte, hexByte),
	([a, b, c, d, e, f]) => {
		const mac = `${a}:${b}:${c}:${d}:${e}:${f}`;
		expect(validateMacAddress(mac)).toBe(mac);
	}
);
```

## Best Practices

### 1. Test Properties, Not Examples

❌ **Bad**: "Function returns 6 for input 3"

```typescript
test('double returns correct value', () => {
	expect(double(3)).toBe(6);
});
```

✅ **Good**: "Function always returns 2x input"

```typescript
test('double always returns 2x input', () => {
	fc.assert(
		fc.property(fc.integer(), (n) => {
			expect(double(n)).toBe(n * 2);
		})
	);
});
```

### 2. Use Appropriate `numRuns`

- **Security validators**: 500-1000 runs (high confidence)
- **Performance tests**: 100-200 runs (balance speed vs coverage)
- **Complex generators**: 200-500 runs (avoid long test times)

```typescript
fc.assert(property, { numRuns: 1000 }); // High security confidence
fc.assert(property, { numRuns: 200 }); // Balanced
fc.assert(property, { numRuns: 50 }); // Quick smoke test
```

### 3. Filter Generators, Don't Discard

❌ **Bad**: Filter inside property (wastes generated inputs)

```typescript
fc.property(fc.string(), (s) => {
	if (!s.includes('..')) return; // Discards most inputs
	expect(() => validate(s)).toThrow();
});
```

✅ **Good**: Filter generator upfront

```typescript
fc.property(
	fc.string().filter((s) => s.includes('..')), // Only generates valid inputs
	(s) => {
		expect(() => validate(s)).toThrow();
	}
);
```

### 4. Test Invariants, Not Implementation

❌ **Bad**: Tests implementation detail

```typescript
test('validator uses regex /^[a-z]+$/', () => {
	expect(validator.toString()).toContain('/^[a-z]+$/');
});
```

✅ **Good**: Tests behavioral invariant

```typescript
test('validator accepts all lowercase ASCII strings', () => {
	fc.assert(
		fc.property(fc.stringMatching(/^[a-z]+$/), (s) => {
			expect(validator(s)).toBe(s);
		})
	);
});
```

### 5. Separate Valid and Invalid Input Tests

```typescript
describe('validateInterfaceName', () => {
	test('accepts all valid interface names', () => {
		fc.assert(
			fc.property(fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/), (name) => {
				expect(validateInterfaceName(name)).toBe(name);
			})
		);
	});

	test('rejects all invalid interface names', () => {
		fc.assert(
			fc.property(
				fc.string().filter((s) => !/^[a-zA-Z0-9_-]{1,15}$/.test(s)),
				(name) => {
					expect(() => validateInterfaceName(name)).toThrow();
				}
			)
		);
	});
});
```

## Running Property-Based Tests

```bash
# Run all security tests (includes property-based)
npm run test:security

# Run specific property test file
npx vitest run tests/security/property-based.test.ts

# Run with coverage
npx vitest run --coverage tests/security/property-based.test.ts

# Watch mode (re-runs on file changes)
npx vitest tests/security/property-based.test.ts
```

## Interpreting Test Failures

When a property test fails, fast-check provides **shrunk counterexamples** (minimal failing inputs):

### Example Failure

```
Error: Property failed after 247 tests with seed=42
Counterexample: ["-0"]
Shrunk 5 times
```

**Interpretation**:

- Test ran 247 times before finding a bug
- Failing input: `"-0"` (negative zero as string)
- Fast-check shrunk the input 5 times to find the minimal case
- Seed `42` allows reproducing the exact test run

### Reproducing Failures

```typescript
fc.assert(property, {
	seed: 42, // Use seed from failure output
	path: '247:5', // Path to shrunk counterexample
	numRuns: 1 // Run just the failing case
});
```

## Debugging Property Tests

### 1. Add Logging

```typescript
fc.property(fc.integer(), (n) => {
	console.log('Testing with:', n); // See what inputs are generated
	expect(myFunction(n)).toBeGreaterThan(0);
});
```

### 2. Use Smaller `numRuns` During Development

```typescript
fc.assert(property, { numRuns: 10 }); // Fast feedback loop
```

### 3. Use `fc.sample()` to Inspect Generated Values

```typescript
// See 20 sample inputs from generator
const samples = fc.sample(
	fc.string().filter((s) => s.includes('..')),
	20
);
console.log(samples);
```

### 4. Narrow Generator with `.filter()`

```typescript
// Isolate specific case
fc.string().filter((s) => s.length > 1000 && s.includes('\x00'));
```

## Security Standards Compliance

Property-based testing in Argos aligns with:

- **NIST SP 800-53 SI-10**: Input Validation
- **CWE-20**: Improper Input Validation
- **OWASP A03:2021**: Injection
- **CERT MSC17-C**: Complete Input Validation

## Performance Considerations

- **1000 runs × 5 validators** = 5000 test executions in ~2 seconds
- **No network I/O**: Tests are pure function calls
- **Parallel Execution**: Vitest runs test files in parallel

## Adding New Property Tests

### Template

```typescript
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { myValidator } from '$lib/server/security/input-sanitizer';

describe('myValidator (Property-Based)', () => {
	test('accepts all valid inputs', () => {
		fc.assert(
			fc.property(fc.string().filter(/* valid input pattern */), (input) => {
				const result = myValidator(input);
				expect(result).toBe(input); // Or other assertion
			}),
			{ numRuns: 500 }
		);
	});

	test('rejects all invalid inputs', () => {
		fc.assert(
			fc.property(fc.string().filter(/* invalid input pattern */), (input) => {
				expect(() => myValidator(input)).toThrow(InputValidationError);
			}),
			{ numRuns: 500 }
		);
	});

	test('security invariant holds', () => {
		fc.assert(
			fc.property(fc.anything(), (input) => {
				// Either validates or throws, never returns undefined/null
				try {
					const result = myValidator(input);
					expect(result).not.toBeUndefined();
					expect(result).not.toBeNull();
				} catch (error) {
					expect(error).toBeInstanceOf(InputValidationError);
				}
			}),
			{ numRuns: 1000 }
		);
	});
});
```

## Related Files

- **Test Suite**: `tests/security/property-based.test.ts`
- **Input Sanitizers**: `src/lib/server/security/input-sanitizer.ts`
- **Security Architecture**: `docs/security-architecture.md`
- **Testing Guide**: `docs/testing-guide.md`

## Further Reading

- [fast-check Documentation](https://github.com/dubzzz/fast-check/blob/main/documentation/README.md)
- [Property-Based Testing with fast-check (Tutorial)](https://dev.to/dubzzz/introduction-to-property-based-testing-2cj8)
- [QuickCheck Paper (Original PBT)](https://www.cs.tufts.edu/~nr/cs257/archive/john-hughes/quick.pdf)
- [Hypothesis (Python PBT)](https://hypothesis.readthedocs.io/en/latest/)
- [NIST SP 800-53 SI-10](https://csrc.nist.gov/Projects/risk-management/sp800-53-controls/release-search#!/control?version=5.1&number=SI-10)
