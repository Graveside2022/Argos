// Debug script for USRP Sweep page
// Paste this into browser console while on the USRP Sweep page

console.log('=== USRP Sweep Debug Script ===');

// Check if measureUSRPPower function is being called
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    if (url && url.includes('/api/rf/usrp-power')) {
        console.log('[DEBUG] USRP Power API called:', {
            url: url,
            body: args[1]?.body ? JSON.parse(args[1].body) : null,
            timestamp: new Date().toISOString()
        });
    }
    return originalFetch.apply(this, args).then(response => {
        if (url && url.includes('/api/rf/usrp-power')) {
            const clonedResponse = response.clone();
            clonedResponse.json().then(data => {
                console.log('[DEBUG] USRP Power API response:', {
                    status: response.status,
                    data: data,
                    timestamp: new Date().toISOString()
                });
            }).catch(err => {
                console.error('[DEBUG] Failed to parse USRP Power response:', err);
            });
        }
        return response;
    });
};

// Monitor interval creation
const originalSetInterval = window.setInterval;
window.setInterval = function(fn, delay, ...args) {
    const stack = new Error().stack;
    if (stack && stack.includes('measureUSRPPower')) {
        console.log('[DEBUG] Power measurement interval created:', {
            delay: delay,
            stack: stack.substring(0, 500)
        });
    }
    return originalSetInterval.apply(this, [fn, delay, ...args]);
};

// Monitor spectrum data store updates
let lastSpectrumData = null;
setInterval(() => {
    // Try to access Svelte stores from the page context
    const app = document.querySelector('#app')?.__svelte__;
    if (app) {
        try {
            // This is a bit hacky but might work to access store values
            const storeElements = document.querySelectorAll('[data-store]');
            console.log('[DEBUG] Store elements found:', storeElements.length);
        } catch (e) {
            // Ignore errors
        }
    }
    
    // Check UI elements
    const dbLevel = document.querySelector('.saasfly-metric-card .text-orange-400')?.textContent;
    const signalStrength = document.querySelector('.saasfly-metric-card .text-signal-none')?.textContent;
    
    if (dbLevel !== lastSpectrumData) {
        console.log('[DEBUG] UI Update detected:', {
            dbLevel: dbLevel,
            signalStrength: signalStrength,
            timestamp: new Date().toISOString()
        });
        lastSpectrumData = dbLevel;
    }
}, 1000);

console.log('Debug script loaded. Press Start button to begin monitoring...');