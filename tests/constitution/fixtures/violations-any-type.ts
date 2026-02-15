// Test fixture: Article II §2.1 violations (any types)

// Violation: any type usage
export function parseData(input: any) {
	return JSON.parse(input);
}

// Violation: any in array
export function processItems(items: any[]) {
	return items.map((item) => item.value);
}

// Violation: any in object
export const config: { [key: string]: any } = {
	timeout: 5000,
	retries: 3
};

// Violation: @ts-expect-error without issue reference
export function unsafeOperation() {
	// @ts-expect-error - Test fixture: intentional type error
	return window.unsafeAPI();
}

// Violation: Type assertion without justification
export function getConfig() {
	// @ts-expect-error - Test fixture: intentional invalid cast
	return localStorage.getItem('config') as Config;
}

interface Config {
	apiKey: string;
}
