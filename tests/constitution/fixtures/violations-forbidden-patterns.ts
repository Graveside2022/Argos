// Test fixture: Article II §2.7 forbidden patterns

// Violation: Hardcoded hex color (not from Tailwind theme)
export const primaryColor = '#3B82F6';
export const dangerColor = '#EF4444';

// Violation: Browser alert usage
export function showWarning(message: string) {
	alert(message);
}

// Violation: window.confirm
export function confirmDelete() {
	return window.confirm('Are you sure?');
}

// Violation: window.prompt
export function getUserInput() {
	return window.prompt('Enter your name:');
}

// Article IX §9.4 violations (security)

// Violation: eval() usage
export function executeDynamicCode(code: string) {
	return eval(code);
}

// Violation: new Function()
export function createFunction(body: string) {
	return new Function('x', body);
}

// Violation: innerHTML
export function renderHTML(html: string) {
	document.body.innerHTML = html;
}

// Article IX §9.1 violations (secrets)

// Violation: Hardcoded API key
export const API_KEY = 'sk-1234567890abcdef';

// Violation: Hardcoded password
const _DATABASE_PASSWORD = 'supersecret123';
