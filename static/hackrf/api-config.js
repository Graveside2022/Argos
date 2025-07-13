// API Configuration for HackRF Sweep
const API_CONFIG = {
    // Base URL for the HackRF API endpoints
    baseUrl: '/api/hackrf',
    
    // WebSocket configuration
    websocket: {
        enabled: false,
        url: null // WebSocket functionality not implemented yet
    },
    
    // API endpoints
    endpoints: {
        startSweep: '/start-sweep',
        stopSweep: '/stop-sweep',
        status: '/status',
        frequencies: '/frequencies',
        spectrum: '/spectrum'
    },
    
    // Request configuration
    requestConfig: {
        headers: {
            'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'same-origin'
    },
    
    // Polling intervals (in milliseconds)
    polling: {
        status: 1000,      // Status updates every 1 second
        spectrum: 500,     // Spectrum data every 500ms when active
        frequencies: 5000  // Frequency list every 5 seconds
    },
    
    // Retry configuration
    retry: {
        maxAttempts: 3,
        delay: 1000,
        backoffMultiplier: 1.5
    }
};

// Helper function to build full API URLs
function getApiUrl(endpoint) {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, getApiUrl };
}