/**
 * Promise-based delay utility.
 * Placed in utils/ (not server/) because some consumers are client-side stores.
 */
export const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));
