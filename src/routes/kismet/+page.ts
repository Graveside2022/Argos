// Disable automatic navigation for this page
export const ssr = false;
export const csr = true;

// Prevent any navigation
export async function load() {
    return {
        // Return empty data
    };
}