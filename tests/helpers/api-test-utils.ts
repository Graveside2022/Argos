/** Shared mock response factory for API integration and performance tests. */

/** Create a mock fetch Response-like object for unit/performance tests. */
export const createMockResponse = (data: unknown, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	statusText: status === 200 ? 'OK' : 'Error',
	json: async () => data,
	text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
	headers: new Headers({ 'content-type': 'application/json' })
});
