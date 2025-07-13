import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Signal } from '$lib/server/database/schema';
import type { MockDatabaseStatement } from '../../../types/test-helpers';

// Mock the database module
vi.mock('$lib/server/database/index', () => ({
	db: {
		prepare: vi.fn()
	}
}));

// Import after mocking
import { signalsRepository } from '$lib/server/database/signals.repository';
import { db } from '$lib/server/database/index';

describe('SignalsRepository', () => {
	// Sample test data
	const mockSignal: Signal = {
		id: 1,
		signal_id: 'test-signal-123',
		device_id: 'device-456',
		timestamp: Date.now(),
		latitude: 34.0522,
		longitude: -118.2437,
		altitude: 100.5,
		power: -75.5,
		frequency: 2440000000,
		bandwidth: 20000000,
		modulation: 'OFDM',
		source: 'HackRF',
		metadata: JSON.stringify({ test: true })
	};

	const mockSignals: Signal[] = [
		mockSignal,
		{
			...mockSignal,
			id: 2,
			signal_id: 'test-signal-124',
			timestamp: Date.now() - 1000
		},
		{
			...mockSignal,
			id: 3,
			signal_id: 'test-signal-125',
			timestamp: Date.now() - 2000
		}
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('findById', () => {
		it('should return a signal when found', () => {
			// Arrange
			const mockGet = vi.fn().mockReturnValue(mockSignal);
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findById('test-signal-123');

			// Assert
			expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM signals WHERE signal_id = ?');
			expect(mockGet).toHaveBeenCalledWith('test-signal-123');
			expect(result).toEqual(mockSignal);
		});

		it('should return null when signal not found', () => {
			// Arrange
			const mockGet = vi.fn().mockReturnValue(null);
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findById('non-existent-id');

			// Assert
			expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM signals WHERE signal_id = ?');
			expect(mockGet).toHaveBeenCalledWith('non-existent-id');
			expect(result).toBeNull();
		});

		it('should handle database errors gracefully', () => {
			// Arrange
			const mockGet = vi.fn().mockImplementation(() => {
				throw new Error('Database connection failed');
			});
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act & Assert
			expect(() => signalsRepository.findById('test-id')).toThrow(
				'Database connection failed'
			);
			expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM signals WHERE signal_id = ?');
			expect(mockGet).toHaveBeenCalledWith('test-id');
		});

		it('should handle prepare statement errors', () => {
			// Arrange
			vi.mocked(db.prepare).mockImplementation(() => {
				throw new Error('Invalid SQL statement');
			});

			// Act & Assert
			expect(() => signalsRepository.findById('test-id')).toThrow('Invalid SQL statement');
			expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM signals WHERE signal_id = ?');
		});

		it('should handle empty string id', () => {
			// Arrange
			const mockGet = vi.fn().mockReturnValue(null);
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findById('');

			// Assert
			expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM signals WHERE signal_id = ?');
			expect(mockGet).toHaveBeenCalledWith('');
			expect(result).toBeNull();
		});

		it('should handle special characters in id', () => {
			// Arrange
			const specialId = "test'; DROP TABLE signals; --";
			const mockGet = vi.fn().mockReturnValue(null);
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findById(specialId);

			// Assert
			expect(mockGet).toHaveBeenCalledWith(specialId);
			expect(result).toBeNull();
			// The prepared statement should handle SQL injection attempts safely
		});
	});

	describe('findRecent', () => {
		it('should return recent signals with default limit', () => {
			// Arrange
			const mockAll = vi.fn().mockReturnValue(mockSignals);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent();

			// Assert
			expect(db.prepare).toHaveBeenCalledWith(
				'SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?'
			);
			expect(mockAll).toHaveBeenCalledWith(100); // Default limit
			expect(result).toEqual(mockSignals);
			expect(result).toHaveLength(3);
		});

		it('should return recent signals with custom limit', () => {
			// Arrange
			const customLimit = 50;
			const limitedSignals = mockSignals.slice(0, 2);
			const mockAll = vi.fn().mockReturnValue(limitedSignals);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(customLimit);

			// Assert
			expect(db.prepare).toHaveBeenCalledWith(
				'SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?'
			);
			expect(mockAll).toHaveBeenCalledWith(customLimit);
			expect(result).toEqual(limitedSignals);
			expect(result).toHaveLength(2);
		});

		it('should return empty array when no signals found', () => {
			// Arrange
			const mockAll = vi.fn().mockReturnValue([]);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(10);

			// Assert
			expect(mockAll).toHaveBeenCalledWith(10);
			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});

		it('should handle database errors', () => {
			// Arrange
			const mockAll = vi.fn().mockImplementation(() => {
				throw new Error('Database read error');
			});
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act & Assert
			expect(() => signalsRepository.findRecent()).toThrow('Database read error');
			expect(mockAll).toHaveBeenCalledWith(100);
		});

		it('should handle prepare statement errors', () => {
			// Arrange
			vi.mocked(db.prepare).mockImplementation(() => {
				throw new Error('Statement preparation failed');
			});

			// Act & Assert
			expect(() => signalsRepository.findRecent()).toThrow('Statement preparation failed');
		});

		it('should handle zero limit', () => {
			// Arrange
			const mockAll = vi.fn().mockReturnValue([]);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(0);

			// Assert
			expect(mockAll).toHaveBeenCalledWith(0);
			expect(result).toEqual([]);
		});

		it('should handle negative limit', () => {
			// Arrange
			const mockAll = vi.fn().mockReturnValue([]);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(-10);

			// Assert
			expect(mockAll).toHaveBeenCalledWith(-10);
			expect(result).toEqual([]);
		});

		it('should handle very large limit', () => {
			// Arrange
			const largeLimit = 1000000;
			const mockAll = vi.fn().mockReturnValue(mockSignals);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(largeLimit);

			// Assert
			expect(mockAll).toHaveBeenCalledWith(largeLimit);
			expect(result).toEqual(mockSignals);
		});

		it('should return signals ordered by timestamp descending', () => {
			// Arrange
			const orderedSignals = [
				{ ...mockSignal, id: 2, timestamp: 3000 },
				{ ...mockSignal, id: 3, timestamp: 2000 },
				{ ...mockSignal, id: 1, timestamp: 1000 }
			];
			const mockAll = vi.fn().mockReturnValue(orderedSignals);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent();

			// Assert
			expect(result[0].timestamp).toBeGreaterThan(result[1].timestamp);
			expect(result[1].timestamp).toBeGreaterThan(result[2].timestamp);
		});

		it('should handle signals with missing optional fields', () => {
			// Arrange
			const signalsWithMissingFields: Signal[] = [
				{
					id: 1,
					signal_id: 'test-1',
					device_id: null,
					timestamp: Date.now(),
					latitude: 34.0522,
					longitude: -118.2437,
					// altitude is optional
					power: -80,
					frequency: 2400000000,
					bandwidth: null,
					modulation: null,
					source: 'Unknown',
					metadata: null
				}
			];
			const mockAll = vi.fn().mockReturnValue(signalsWithMissingFields);
			const mockStatement: MockDatabaseStatement = {
				get: vi.fn(),
				all: mockAll,
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findRecent(1);

			// Assert
			expect(result).toEqual(signalsWithMissingFields);
			expect(result[0].device_id).toBeNull();
			expect(result[0].altitude).toBeUndefined();
			expect(result[0].bandwidth).toBeNull();
		});
	});

	describe('Edge cases and boundary conditions', () => {
		it('should handle concurrent calls to findById', async () => {
			// Arrange
			const mockGet = vi.fn().mockImplementation((_id) => {
				// Simulate async delay
				return mockSignal;
			});
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const results = await Promise.all([
				Promise.resolve(signalsRepository.findById('test-1')),
				Promise.resolve(signalsRepository.findById('test-2')),
				Promise.resolve(signalsRepository.findById('test-3'))
			]);

			// Assert
			expect(mockGet).toHaveBeenCalledTimes(3);
			expect(results).toHaveLength(3);
		});

		it('should handle database connection closed error', () => {
			// Arrange
			vi.mocked(db.prepare).mockImplementation(() => {
				throw new Error('Database connection closed');
			});

			// Act & Assert
			expect(() => signalsRepository.findById('test')).toThrow('Database connection closed');
			expect(() => signalsRepository.findRecent()).toThrow('Database connection closed');
		});

		it('should handle malformed signal data from database', () => {
			// Arrange
			const malformedData = {
				id: 'not-a-number', // Should be number
				signal_id: 123, // Should be string
				timestamp: 'not-a-timestamp'
			};
			const mockGet = vi.fn().mockReturnValue(malformedData);
			const mockStatement: MockDatabaseStatement = {
				get: mockGet,
				all: vi.fn(),
				run: vi.fn()
			};
			vi.mocked(db.prepare).mockReturnValue(
				mockStatement as unknown as ReturnType<typeof db.prepare>
			);

			// Act
			const result = signalsRepository.findById('test');

			// Assert - Type casting would still return the malformed data
			expect(result).toEqual(malformedData);
		});

		it('should handle undefined or null database instance', () => {
			// Arrange
			const originalPrepare = vi.mocked(db).prepare;
			// @ts-expect-error - Testing edge case
			vi.mocked(db).prepare = undefined;

			// Act & Assert
			expect(() => signalsRepository.findById('test')).toThrow();

			// Restore
			vi.mocked(db).prepare = originalPrepare;
		});
	});
});
