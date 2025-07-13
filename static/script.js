// HackRF Monitor Frontend JavaScript

/* global logInfo, logWarn */

// API Configuration
// Use the current hostname to allow access from different devices on the network
const API_BASE_URL = `http://${window.location.hostname}:3002`;

const MAX_FREQUENCIES = 10;

let eventSource = null;
let isScanning = false;
let isCycling = false;
let currentFrequencyIndex = 0;
let __cycleCountdown = null;
let __cycleInterval = null;
let cycleTimer = null;
let connectionRetryCount = 0;
let maxRetryAttempts = 3;
let startupTimeout = null;
let connectionStatus = 'disconnected';
let isSynchronizing = false;  // Prevent sync loops
let sseConnectionActive = false;  // Track SSE connection state
let globalCycleTime = 30;  // Store cycle time globally for timer sync
let globalFrequencies = [];   // Store frequencies globally for next frequency calculation
let isRestoringState = false;  // Flag to prevent operations during state restoration
let performanceMode = true;   // Reduce verbose tracking for better performance
let syncInProgress = false;  // Guard flag to prevent startSweep during sync
let activeCyclingOperation = false;  // Flag to track active cycling operations
let reducedSyncMode = false;  // Flag to reduce sync frequency during cycling
let lastSyncTime = 0;  // Track sync timing for frequency reduction
let signalResetInProgress = false;  // Flag to coordinate signal indicator reset timing

// Function to reset all blocking sync flags - emergency recovery
function resetSyncFlags() {
    logInfo('🔄 Resetting all synchronization flags');
    isSynchronizing = false;
    syncInProgress = false;
    isRestoringState = false;
    signalResetInProgress = false;
    logInfo('✅ All sync flags cleared');
}

// Enhanced error tracking and operation logging system
window.recentOperations = [];
window.startSweepTracker = {
    attempts: [],
    lastUserInitiated: null,
    lastSystemInitiated: null
};

// Enhanced operation tracking with call source detection
function trackOperation(operation, context = {}) {
    // Skip non-critical tracking in performance mode
    if (performanceMode && context.source && context.source.includes('cycling')) {
        return; // Skip verbose cycling operations
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const stackTrace = performanceMode ? [] : getCallStack(); // Skip stack traces in performance mode
    
    const operationEntry = {
        timestamp,
        operation,
        context,
        callSource: context.source || 'unknown',
        stackTrace: performanceMode ? [] : stackTrace.slice(0, 3)
    };
    
    window.recentOperations.unshift(`[${timestamp}] ${operation} (${context.source || 'unknown'})`);
    if (window.recentOperations.length > (performanceMode ? 15 : 30)) { // Reduced buffer in performance mode
        window.recentOperations.pop();
    }
    
    // Store detailed operation for debugging (reduced in performance mode)
    if (!performanceMode) {
        if (!window.detailedOperations) window.detailedOperations = [];
        window.detailedOperations.unshift(operationEntry);
        if (window.detailedOperations.length > 25) { // Reduced from 50
            window.detailedOperations.pop();
        }
    }
}

// Get simplified call stack for tracking
function getCallStack() {
    try {
        throw new Error();
    } catch (e) {
        return e.stack.split('\n')
            .slice(2) // Remove getCallStack and Error lines
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Reset all sync flags on page load to prevent stuck states
        resetSyncFlags();
        
        trackOperation('Application initialized', { source: 'page_load' });
        setupEventHandlers();
        
        updateButtonStates();
        updateAddButtonState();
        // updateRemoveButtons(); // Commented out to prevent duplicate remove buttons
        updateConnectionStatus();
        
        // Initialize cycle status display with defaults (always visible)
        initializeCycleStatus();
        
        // Add validation listener for the initial frequency input
        const initialInput = document.getElementById('frequencyInput1');
        if (initialInput) {
            initialInput.addEventListener('input', function() {
                validateFrequencyInputById(this.id);
            });
        }
        
        // Perform startup health check
        performStartupHealthCheck();
        
        // Perform initial health check
        performHealthCheck();
        
        // Synchronize with server state on page load - critical for split brain fix
        setTimeout(() => {
            synchronizeWithServerState('initialization');
        }, 1000);
        
        // Start proactive state validation monitoring
        startProactiveStateValidation();
        
        // Also sync state every 30 seconds to catch any drift
        // Reduced frequency during active cycling to prevent interference
        setInterval(() => {
            if (connectionStatus === 'connected') {
                // Skip periodic sync if cycling and recent sync occurred
                if (reducedSyncMode && activeCyclingOperation) {
                    const timeSinceLastSync = Date.now() - lastSyncTime;
                    if (timeSinceLastSync < 60000) { // Skip if synced within last minute
                        trackOperation('Periodic sync skipped - cycling mode active', {
                            source: 'sync_reduction',
                            timeSinceLastSync
                        });
                        return;
                    }
                }
                synchronizeWithServerState('periodic');
            }
        }, 30000);
        
        showStatus('Application initialized successfully', 'success');
    } catch (error) {
        logError('initialization', error, { source: 'page_load' });
        showStatus('Application initialization failed: ' + error.message, 'error');
    }
});

// Setup event handlers
function setupEventHandlers() {
    document.getElementById('startButton').addEventListener('click', () => {
        trackOperation('Start button clicked', { source: 'user_click' });
        startSweep('user_initiated');
    });
    document.getElementById('stopButton').addEventListener('click', () => {
        trackOperation('Stop button clicked', { source: 'user_click' });
        stopSweep();
    });
    
    // Add frequency button
    const addFreqBtn = document.getElementById('addFrequencyButton');
    if (addFreqBtn) {
        addFreqBtn.addEventListener('click', () => {
            trackOperation('Add frequency button clicked', { source: 'user_click' });
            addFrequencyInput();
        });
    }
    
    // Cycle time input validation
    const cycleTimeInput = document.getElementById('cycleTimeInput');
    if (cycleTimeInput) {
        cycleTimeInput.addEventListener('input', validateCycleTime);
    }
}

// Enhanced frequency validation with real-time feedback
function validateFrequencyInputById(inputId) {
    const frequencyInput = document.getElementById(inputId);
    if (!frequencyInput) return false;
    
    const frequencyItem = frequencyInput.closest('.frequency-item');
    const unitSelect = frequencyInput.nextElementSibling;
    const unit = unitSelect ? unitSelect.value : 'MHz';
    const value = parseFloat(frequencyInput.value);
    
    // Remove existing validation messages
    removeValidationMessage(frequencyItem);
    
    // Clear visual indicators
    frequencyItem.classList.remove('invalid', 'valid');
    
    // Empty input validation
    if (!frequencyInput.value.trim()) {
        showValidationMessage(frequencyItem, 'Please enter a frequency value', 'error');
        frequencyInput.setCustomValidity('Please enter a frequency value');
        frequencyItem.classList.add('invalid');
        return false;
    }
    
    // Numeric validation
    if (isNaN(value) || value <= 0) {
        showValidationMessage(frequencyItem, 'Please enter a valid positive number', 'error');
        frequencyInput.setCustomValidity('Please enter a valid positive number');
        frequencyItem.classList.add('invalid');
        return false;
    }
    
    // Convert to MHz for validation
    let freqMHz = value;
    if (unit === 'GHz') {
        freqMHz = value * 1000;
    } else if (unit === 'kHz') {
        freqMHz = value / 1000;
    }
    
    // Range validation with specific guidance
    if (freqMHz < 1) {
        showValidationMessage(frequencyItem, 
            `Frequency too low. Minimum: 1 MHz (you entered ${freqMHz.toFixed(3)} MHz)`, 'error');
        frequencyInput.setCustomValidity('Frequency too low - minimum 1 MHz');
        frequencyItem.classList.add('invalid');
        return false;
    }
    
    if (freqMHz > 6000) {
        showValidationMessage(frequencyItem, 
            `Frequency too high. Maximum: 6 GHz (you entered ${freqMHz.toFixed(3)} MHz)`, 'error');
        frequencyInput.setCustomValidity('Frequency too high - maximum 6 GHz');
        frequencyItem.classList.add('invalid');
        return false;
    }
    
    // All validations passed
    frequencyInput.setCustomValidity('');
    frequencyItem.classList.add('valid');
    
    return true;
}

// Show validation message with styling - only for errors
function showValidationMessage(frequencyItem, message, type) {
    if (type === 'error') {
        removeValidationMessage(frequencyItem);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `validation-message validation-${type}`;
        messageDiv.textContent = message;
        
        frequencyItem.appendChild(messageDiv);
    }
}

// Remove existing validation message
function removeValidationMessage(frequencyItem) {
    const existingMessage = frequencyItem.querySelector('.validation-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Validate all frequency inputs
function validateAllFrequencyInputs() {
    const frequencyItems = document.querySelectorAll('.frequency-item');
    let allValid = true;
    
    frequencyItems.forEach((item) => {
        const input = item.querySelector('input[type="text"]');
        if (input && !validateFrequencyInputById(input.id)) {
            allValid = false;
        }
    });
    
    return allValid;
}

// Enhanced cycle time validation with helpful feedback
function validateCycleTime() {
    const cycleTimeInput = document.getElementById('cycleTimeInput');
    if (!cycleTimeInput) return true;
    
    const value = parseInt(cycleTimeInput.value);
    const container = cycleTimeInput.parentElement;
    
    // Remove existing validation messages
    removeCycleTimeValidationMessage(container);
    
    // Clear visual indicators
    cycleTimeInput.classList.remove('invalid', 'valid');
    
    // Empty input
    if (!cycleTimeInput.value.trim()) {
        showCycleTimeValidationMessage(container, 'Please enter a cycle time', 'error');
        cycleTimeInput.setCustomValidity('Please enter a cycle time');
        cycleTimeInput.classList.add('invalid');
        return false;
    }
    
    // Numeric validation
    if (isNaN(value) || value <= 0) {
        showCycleTimeValidationMessage(container, 'Please enter a valid positive number', 'error');
        cycleTimeInput.setCustomValidity('Please enter a valid positive number');
        cycleTimeInput.classList.add('invalid');
        return false;
    }
    
    // Range validation with guidance
    if (value < 1) {
        showCycleTimeValidationMessage(container, 'Minimum cycle time is 1 second', 'error');
        cycleTimeInput.setCustomValidity('Minimum cycle time is 1 second');
        cycleTimeInput.classList.add('invalid');
        return false;
    }
    
    if (value > 300) {
        showCycleTimeValidationMessage(container, 'Maximum cycle time is 300 seconds (5 minutes)', 'error');
        cycleTimeInput.setCustomValidity('Maximum cycle time is 300 seconds');
        cycleTimeInput.classList.add('invalid');
        return false;
    }
    
    // Success validation
    cycleTimeInput.setCustomValidity('');
    cycleTimeInput.classList.add('valid');
    
    return true;
}

// Show cycle time validation message - only for errors
function showCycleTimeValidationMessage(container, message, type) {
    if (type === 'error') {
        removeCycleTimeValidationMessage(container);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `cycle-validation-message validation-${type}`;
        messageDiv.textContent = message;
        
        container.appendChild(messageDiv);
    }
}

// Remove cycle time validation message
function removeCycleTimeValidationMessage(container) {
    const existingMessage = container.querySelector('.cycle-validation-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Add frequency input
function addFrequencyInput() {
    const currentCount = document.getElementsByClassName('frequency-item').length;
    
    if (currentCount >= MAX_FREQUENCIES) {
        showStatus(`Maximum ${MAX_FREQUENCIES} frequencies allowed`, 'warning');
        return;
    }
    
    const container = document.getElementById('frequencyList');
    const newItem = document.createElement('div');
    const newIndex = currentCount + 1;
    
    newItem.className = 'frequency-item saasfly-interactive-card flex items-center gap-3 p-4 bg-gradient-to-r from-bg-card/40 to-bg-card/20 rounded-xl border border-border-primary/40 hover:border-neon-cyan/40 hover:bg-gradient-to-r hover:from-bg-card/60 hover:to-bg-card/40 hover:shadow-md transition-all duration-300';
    newItem.id = `frequencyItem${newIndex}`;
    
    newItem.innerHTML = `
        <span class="font-mono text-sm text-text-muted font-semibold min-w-[24px] text-center bg-neon-cyan/10 rounded-lg px-2 py-1">${newIndex}</span>
        <div class="flex-1 relative">
            <input type="text" id="frequencyInput${newIndex}" placeholder="Target" value="" class="font-mono w-full pl-3 pr-12 py-2 bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary outline-none focus:border-neon-cyan focus:bg-bg-input focus:shadow-neon-cyan-sm transition-all duration-300 placeholder:text-text-muted/50">
            <span class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-secondary font-medium pointer-events-none">MHz</span>
        </div>
        ${newIndex > 1 ? `<button type="button" onclick="removeFrequencyInput('frequencyItem${newIndex}')" style="padding: 6px 12px !important; background-color: #ef4444 !important; color: white !important; border: none !important; border-radius: 6px !important; font-size: 14px !important; font-weight: 500 !important; cursor: pointer !important; box-shadow: none !important; text-shadow: none !important; outline: none !important; transition: box-shadow 0.3s ease !important;" onmouseover="this.style.boxShadow='0 0 10px rgba(255, 255, 255, 0.4)'" onmouseout="this.style.boxShadow='none'">Remove</button>` : ''}
    `;
    
    container.appendChild(newItem);
    
    // Add validation listener (skip during state restoration to prevent race conditions)
    if (!isRestoringState) {
        document.getElementById(`frequencyInput${newIndex}`).addEventListener('input', function() {
            validateFrequencyInputById(this.id);
        });
        
        // Add remove button event listener if it exists
        const removeBtn = newItem.querySelector('.remove-frequency-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                const itemId = this.getAttribute('data-item-id');
                removeFrequencyInput(itemId);
            });
        }
    }
    
    updateAddButtonState();
    updateNumbering();
}

// Add event listeners to frequency inputs after state restoration
function addEventListenersToFrequencyInputs() {
    const frequencyItems = document.querySelectorAll('.frequency-item');
    frequencyItems.forEach((item, index) => {
        const input = item.querySelector('input[type="text"]');
        const removeBtn = item.querySelector('.remove-frequency-btn');
        
        if (input) {
            // Remove existing listeners by cloning
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            // Add validation listener
            newInput.addEventListener('input', function() {
                validateFrequencyInputById(this.id);
            });
        }
        
        if (removeBtn && index > 0) { // Only add to non-first items
            // Remove existing listeners by cloning
            const newRemoveBtn = removeBtn.cloneNode(true);
            removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
            
            // Add remove button event listener
            newRemoveBtn.addEventListener('click', function() {
                const itemId = this.getAttribute('data-item-id');
                removeFrequencyInput(itemId);
            });
        }
    });
}

// Remove frequency input
function removeFrequencyInput(itemId) {
    // Don't allow removing the last frequency
    const frequencyItems = document.querySelectorAll('.frequency-item');
    if (frequencyItems.length <= 1) {
        showStatus('At least one frequency is required', 'warning');
        return;
    }
    
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
        updateAddButtonState();
        updateNumbering();
        // updateRemoveButtons(); // Commented out to prevent duplicate remove buttons
    }
}

// Update numbering of frequency items
function updateNumbering() {
    const frequencyItems = document.querySelectorAll('.frequency-item');
    frequencyItems.forEach((item, index) => {
        const numberSpan = item.querySelector('.frequency-number');
        if (numberSpan) {
            numberSpan.textContent = index + 1;
        }
    });
}

// Update remove buttons (ensure first frequency item doesn't have remove button)
function __updateRemoveButtons() {
    const frequencyItems = document.querySelectorAll('.frequency-item');
    frequencyItems.forEach((item, index) => {
        const removeBtn = item.querySelector('.remove-frequency-btn');
        
        if (index === 0) {
            // First item should not have remove button
            if (removeBtn) {
                removeBtn.remove();
            }
        } else {
            // Other items should have remove button
            if (!removeBtn) {
                const newRemoveBtn = document.createElement('button');
                newRemoveBtn.type = 'button';
                newRemoveBtn.className = 'remove-frequency-btn';
                newRemoveBtn.textContent = 'Remove';
                newRemoveBtn.setAttribute('data-item-id', item.id);
                
                newRemoveBtn.addEventListener('click', function() {
                    const itemId = this.getAttribute('data-item-id');
                    removeFrequencyInput(itemId);
                });
                
                item.appendChild(newRemoveBtn);
            } else {
                // Update existing button's data-item-id and event listener
                removeBtn.setAttribute('data-item-id', item.id);
                
                // Remove old event listeners by cloning the element
                const newRemoveBtn = removeBtn.cloneNode(true);
                newRemoveBtn.addEventListener('click', function() {
                    const itemId = this.getAttribute('data-item-id');
                    removeFrequencyInput(itemId);
                });
                
                removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
            }
        }
    });
}

// Update add button state
function updateAddButtonState() {
    const addBtn = document.getElementById('addFrequencyButton');
    if (addBtn) {
        const currentCount = document.getElementsByClassName('frequency-item').length;
        addBtn.disabled = currentCount >= MAX_FREQUENCIES || isScanning;
        if (currentCount >= MAX_FREQUENCIES) {
            addBtn.textContent = `Maximum Reached (${MAX_FREQUENCIES})`;
        } else {
            addBtn.textContent = '+ Add Frequency';
        }
    }
}

// Collect all frequencies
function collectFrequencies() {
    const frequencies = [];
    const frequencyItems = document.querySelectorAll('.frequency-item');
    
    frequencyItems.forEach((item) => {
        const input = item.querySelector('input[type="text"]');
        
        if (input && input.value) {
            frequencies.push({
                value: parseFloat(input.value),
                unit: 'MHz'  // Always use MHz since dropdown is removed
            });
        }
    });
    
    return frequencies;
}

// Enhanced startSweep with detailed tracking and error recovery
async function startSweep(initiationType = 'unknown') {
    const attemptId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Track start attempt with detailed context
    const attemptContext = {
        attemptId,
        type: initiationType,
        timestamp: new Date().toISOString(),
        source: initiationType === 'user_initiated' ? 'user_click' : 'system_call',
        callStack: getCallStack().slice(0, 5),
        currentState: {
            isScanning,
            isCycling,
            connectionStatus,
            sseConnectionActive
        }
    };
    
    window.startSweepTracker.attempts.push(attemptContext);
    if (window.startSweepTracker.attempts.length > 10) {
        window.startSweepTracker.attempts.shift();
    }
    
    if (initiationType === 'user_initiated') {
        window.startSweepTracker.lastUserInitiated = attemptContext;
    } else {
        window.startSweepTracker.lastSystemInitiated = attemptContext;
    }
    
    trackOperation(`Start sweep initiated (${initiationType})`, {
        source: attemptContext.source,
        attemptId,
        stateCheck: `scanning=${isScanning}, cycling=${isCycling}`
    });
    
    // Synchronization guard flags - prevent start operations during sync or restoration
    // CYCLING EXCEPTION: Allow cycling operations to bypass certain sync blocks
    const isCyclingBypass = (initiationType === 'cycling' || activeCyclingOperation);
    
    if ((isSynchronizing || syncInProgress || isRestoringState) && !isCyclingBypass) {
        // Emergency fallback: If sync flags have been stuck for too long, reset them
        const now = Date.now();
        if (!window.lastSyncBlockTime) {
            window.lastSyncBlockTime = now;
        } else if (now - window.lastSyncBlockTime > 10000) { // 10 seconds
            console.warn('⚠️ Sync flags stuck for >10s - force resetting');
            resetSyncFlags();
            window.lastSyncBlockTime = null;
            // Continue with startSweep after reset
        } else {
            trackOperation('Start sweep blocked: synchronization in progress', { 
                source: attemptContext.source,
                attemptId,
                recovery: 'Wait for synchronization to complete',
                cyclingBypass: isCyclingBypass
            });
            logWarn('Start sweep blocked due to synchronization/restoration in progress');
            showEnhancedError('Operation blocked while synchronizing with server', 'startSweep', {
                recovery: 'Please wait a moment for synchronization to complete and try again.',
                context: attemptContext
            });
            return;
        }
    } else {
        // Reset the block time when flags are clear
        window.lastSyncBlockTime = null;
    }
    
    // Pre-flight state check with recovery suggestions
    if (isScanning) {
        const errorMsg = 'Sweep is already running. Please stop the current sweep first.';
        trackOperation('Start sweep blocked: already scanning', { 
            source: attemptContext.source,
            attemptId,
            recovery: 'Click Stop button first'
        });
        showEnhancedError(errorMsg, 'startSweep', {
            recovery: 'Click the "Stop Sweep" button to stop the current operation before starting a new one.',
            context: attemptContext
        });
        return;
    }
    
    // Validate all frequencies
    if (!validateAllFrequencyInputs()) {
        const errorMsg = 'Please fix invalid frequency inputs before starting';
        trackOperation('Start sweep failed: invalid frequency inputs', { 
            source: attemptContext.source,
            attemptId,
            recovery: 'Fix frequency validation errors'
        });
        showEnhancedError(errorMsg, 'startSweep', {
            recovery: 'Check the frequency inputs for red validation messages and correct any errors.',
            context: attemptContext
        });
        return;
    }
    
    const frequencies = collectFrequencies();
    if (frequencies.length === 0) {
        const errorMsg = 'Please enter at least one frequency';
        trackOperation('Start sweep failed: no frequencies entered', { 
            source: attemptContext.source,
            attemptId,
            recovery: 'Enter at least one frequency'
        });
        showEnhancedError(errorMsg, 'startSweep', {
            recovery: 'Enter a valid frequency value in at least one frequency input field.',
            context: attemptContext
        });
        return;
    }
    
    // Validate cycle time if multiple frequencies
    let cycleTime = 10; // Default cycle time
    
    if (frequencies.length > 1) {
        if (!validateCycleTime()) {
            const errorMsg = 'Invalid cycle time for multi-frequency operation';
            trackOperation('Start sweep failed: invalid cycle time', { 
                source: attemptContext.source,
                attemptId,
                recovery: 'Set valid cycle time (1-300 seconds)'
            });
            showEnhancedError(errorMsg, 'startSweep', {
                recovery: 'Enter a cycle time between 1 and 300 seconds for multi-frequency scanning.',
                context: attemptContext
            });
            return;
        }
        const cycleTimeInput = document.getElementById('cycleTimeInput');
        if (cycleTimeInput) {
            cycleTime = parseInt(cycleTimeInput.value) || 10;
        }
    }
    
    // Show loading state
    showStatus('Starting sweep...', 'info', true);
    setLoadingState(true);
    
    trackOperation(`Starting sweep request for ${frequencies.length} frequencies`, {
        source: attemptContext.source,
        attemptId,
        frequencies: frequencies.map(f => `${f.value}${f.unit}`).join(', '),
        cycleTime
    });
    
    // Set timeout for startup process with enhanced tracking
    startupTimeout = setTimeout(() => {
        if (!isScanning) {
            const timeoutError = 'Startup timeout. Please check HackRF connection and try again.';
            trackOperation('Start sweep timeout', {
                source: attemptContext.source,
                attemptId,
                recovery: 'Check HackRF hardware connection'
            });
            showEnhancedError(timeoutError, 'startSweep', {
                recovery: 'Check that your HackRF device is properly connected and powered on. Try unplugging and reconnecting the USB cable.',
                context: attemptContext
            });
            setLoadingState(false);
        }
    }, 30000); // 30 second timeout
    
    try {
        const requestBody = {
            frequencies: frequencies,
            cycleTime: cycleTime
        };
        
        // For backward compatibility, if single frequency, also send old format
        if (frequencies.length === 1) {
            requestBody.frequency = frequencies[0].value;
            requestBody.unit = frequencies[0].unit;
        }
        
        trackOperation('Sending start-sweep request to server', {
            source: attemptContext.source,
            attemptId,
            requestBody: JSON.stringify(requestBody)
        });
        
        const response = await fetch(`${API_BASE_URL}/start-sweep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            clearTimeout(startupTimeout);
            isScanning = true;
            isCycling = frequencies.length > 1;
            currentFrequencyIndex = 0;
            connectionRetryCount = 0;
            connectionStatus = 'connected';
            globalCycleTime = cycleTime;  // Store cycle time globally for timer sync
            
            // Set cycling mode flags for guard bypass and reduced sync
            if (isCycling) {
                activeCyclingOperation = true;
                reducedSyncMode = true;
                trackOperation('Cycling mode activated - reduced sync enabled', {
                    source: attemptContext.source,
                    frequencies: frequencies.length,
                    cycleTime
                });
            }
            
            setLoadingState(false);
            updateButtonStates();
            updateConnectionStatus();
            
            trackOperation(`Start sweep successful (${initiationType})`, {
                source: attemptContext.source,
                attemptId,
                frequencies: frequencies.length,
                cycleTime,
                cycling: isCycling
            });
            
            if (isCycling) {
                showCycleStatus(true);
                startCycleDisplay(frequencies, cycleTime);
                showStatus(`Started cycling ${frequencies.length} frequencies`, 'success');
                trackOperation(`Sweep started: cycling ${frequencies.length} frequencies every ${cycleTime}s`, {
                    source: attemptContext.source,
                    attemptId
                });
            } else {
                showStatus('Started monitoring single frequency', 'success');
                trackOperation(`Sweep started: single frequency ${frequencies[0].value} ${frequencies[0].unit}`, {
                    source: attemptContext.source,
                    attemptId
                });
            }
            
            connectSSE();
            updateFrequencyHighlight(0);
        } else {
            clearTimeout(startupTimeout);
            setLoadingState(false);
            
            // Enhanced server error handling with detailed tracking
            const errorMessage = data.error || 'Failed to start sweep';
            trackOperation(`Start sweep server error: ${errorMessage}`, {
                source: attemptContext.source,
                attemptId,
                serverResponse: data,
                statusCode: response.status,
                recovery: 'Check server logs and HackRF connection'
            });
            
            let recoveryMessage = 'Try restarting the application or checking the server logs.';
            if (errorMessage.toLowerCase().includes('hackrf')) {
                recoveryMessage = 'Check that your HackRF device is properly connected and not in use by another application.';
            } else if (errorMessage.toLowerCase().includes('frequency')) {
                recoveryMessage = 'Verify that your frequency values are within the HackRF\'s supported range (1 MHz to 6 GHz).';
            }
            
            showEnhancedError(errorMessage, 'startSweep', {
                recovery: recoveryMessage,
                context: attemptContext
            });
        }
    } catch (error) {
        clearTimeout(startupTimeout);
        setLoadingState(false);
        
        // Enhanced error tracking for network/connection issues
        trackOperation(`Start sweep network error: ${error.message}`, {
            source: attemptContext.source,
            attemptId,
            errorType: error.name,
            recovery: 'Check network connection and server status'
        });
        
        logError('startSweep', error, { 
            frequencies, 
            cycleTime,
            attemptContext,
            networkError: true
        });
        
        // Update connection status if it's a network error
        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            connectionStatus = 'disconnected';
            updateConnectionStatus();
        }
        
        // Provide specific recovery suggestions based on error type
        let recoveryMessage = 'Check your network connection and try again.';
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            recoveryMessage = 'Cannot connect to the server. Check that the server is running and your network connection is working.';
        } else if (error.name === 'AbortError') {
            recoveryMessage = 'The request was cancelled. This may happen if you clicked start multiple times quickly.';
        }
        
        showEnhancedError(error, 'startSweep', {
            recovery: recoveryMessage,
            context: attemptContext
        });
        
        // Reset button states on error
        isScanning = false;
        isCycling = false;
        updateButtonStates();
    }
}

// Stop sweep with enhanced resilience and complete state synchronization
async function stopSweep() {
    trackOperation('Stop sweep initiated', {
        source: 'user_action',
        currentState: { isScanning, isCycling, connectionStatus }
    });
    const endpoint = '/stop-sweep';
    const timeoutMs = 15000; // Increased to 15 second timeout for complete cleanup
    
    try {
        showStatus('Stopping sweep and verifying cleanup...', 'info', true);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (response.ok) {
            // Wait for complete backend stop before showing success
            showStatus('Stopping sweep...', 'info', true);
            
            // Add 500ms delay before verification to allow backend processes to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify the stop with server state check (tolerant of transitional states)
            await verifyStopCompletion();
            
            resetScanningState();
            showStatus('Sweep stopped successfully', 'success');
        } else {
            // Handle specific backend error messages for split brain scenarios
            if (data.error && data.error.includes('No sweep is running')) {
                // Backend says no sweep running, so just reset UI state
                resetScanningState();
                showStatus('No sweep was running on server - UI state reset', 'info');
            } else {
                throw new Error(data.error || 'Failed to stop sweep');
            }
        }
    } catch (error) {
        logError('stopSweep', error, { endpoint });
        
        let errorMessage = '';
        
        if (error.name === 'AbortError') {
            errorMessage = `Stop request timed out after ${timeoutMs/1000} seconds`;
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to server for stop request';
        } else {
            errorMessage = `Error stopping sweep: ${error.message}`;
        }
        
        showStatus(errorMessage, 'error');
        
        // Always reset states even if stop failed
        resetScanningState();
    }
}

// Reset all scanning-related states
function resetScanningState() {
    isScanning = false;
    isCycling = false;
    currentFrequencyIndex = 0;
    connectionStatus = 'disconnected';
    
    // Clear cycling operation flags
    activeCyclingOperation = false;
    reducedSyncMode = false;
    
    clearTimeout(startupTimeout);
    setLoadingState(false);
    clearCycleDisplay();
    updateButtonStates();
    updateConnectionStatus();
    
    disconnectSSE();
    resetDisplay();
    clearFrequencyHighlights();
    showCycleStatus(false);
    
    trackOperation('Cycling mode deactivated - normal sync restored', {
        source: 'state_reset'
    });
}


// Initialize cycle status with default values
function initializeCycleStatus() {
    const cycleStatus = document.getElementById('cycleStatus');
    if (cycleStatus) {
        // Ensure cycle status is always visible
        cycleStatus.classList.remove('hidden');
        cycleStatus.classList.remove('active');
        
        // Set default values
        updateCurrentFrequencyDisplay(null); // Will show '--'
        const timerDisplay = document.getElementById('switchTimer');
        if (timerDisplay) {
            timerDisplay.textContent = '--';
        }
    }
}

// Show/hide cycle status display - Modified to always show
function showCycleStatus(show) {
    const cycleStatus = document.getElementById('cycleStatus');
    if (cycleStatus) {
        // Always keep cycle status visible, just change active state
        cycleStatus.classList.remove('hidden');
        if (show) {
            cycleStatus.classList.add('active');
        } else {
            cycleStatus.classList.remove('active');
        }
    }
}

// Start cycle display
function startCycleDisplay(frequencies, cycleTime) {
    // Store frequencies globally for next frequency calculations
    globalFrequencies = frequencies || [];
    
    // Show the next frequency that will be scanned, not the current one
    updateNextFrequencyDisplay(frequencies, currentFrequencyIndex);
    startTimer(cycleTime);
}

// Update current frequency display
function updateCurrentFrequencyDisplay(frequency) {
    const currentFreqElement = document.getElementById('currentFrequencyDisplay');
    if (currentFreqElement) {
        if (frequency && frequency.value && frequency.unit) {
            currentFreqElement.textContent = `${frequency.value} ${frequency.unit}`;
        } else {
            currentFreqElement.textContent = '--';
        }
    }
}

// Update next frequency display (what frequency will be scanned next)
function updateNextFrequencyDisplay(frequencies, currentIndex) {
    const currentFreqElement = document.getElementById('currentFrequencyDisplay');
    
    // Use provided frequencies or global frequencies
    const freqList = frequencies || globalFrequencies;
    
    if (!currentFreqElement || !freqList || freqList.length === 0) {
        if (currentFreqElement) {
            currentFreqElement.textContent = '--';
        }
        return;
    }
    
    // Calculate next frequency index (wrap around if at end)
    const nextIndex = (currentIndex + 1) % freqList.length;
    const nextFrequency = freqList[nextIndex];
    
    if (nextFrequency && nextFrequency.value && nextFrequency.unit) {
        currentFreqElement.textContent = `${nextFrequency.value} ${nextFrequency.unit}`;
    } else {
        currentFreqElement.textContent = '--';
    }
}

// Start countdown timer with signal indicator synchronization
function startTimer(cycleTime) {
    // Clear any existing timer first to prevent multiple timers
    if (cycleTimer) {
        clearInterval(cycleTimer);
        cycleTimer = null;
    }
    
    // Convert milliseconds to seconds
    const cycleTimeSeconds = Math.round(cycleTime / 1000);
    let remaining = cycleTimeSeconds;
    const timerDisplay = document.getElementById('switchTimer');
    const progressBar = document.getElementById('timerProgressBar');
    const signalFill = document.getElementById('signalIndicatorFill');
    const dbIndicator = document.getElementById('dbCurrentIndicator');
    
    // Reset signal indicator position to sync with timer restart
    signalResetInProgress = true;
    
    if (signalFill && dbIndicator) {
        signalFill.style.width = '0%';
        dbIndicator.style.left = '0%';
        // Reset to weak signal class
        signalFill.classList.remove('gradient-weak', 'gradient-moderate', 'gradient-strong', 'gradient-very-strong');
        signalFill.classList.add('gradient-weak');
        // Reset dB value display
        document.getElementById('dbCurrentValue').textContent = '-90 dB';
    }
    
    // Allow signal updates after brief delay to prevent immediate override
    setTimeout(() => {
        signalResetInProgress = false;
    }, 100); // 100ms delay to prevent race condition
    
    const updateTimer = () => {
        if (timerDisplay) {
            timerDisplay.textContent = `${remaining}s`;
        }
        
        if (progressBar) {
            const percentage = ((cycleTimeSeconds - remaining) / cycleTimeSeconds) * 100;
            progressBar.style.width = `${percentage}%`;
        }
        
        remaining--;
        
        if (remaining < 0) {
            remaining = cycleTimeSeconds; // Reset for next cycle
            
            // Coordinate signal indicator reset with cycle restart
            signalResetInProgress = true;
            
            if (signalFill && dbIndicator) {
                signalFill.style.width = '0%';
                dbIndicator.style.left = '0%';
                // Reset to weak signal class
                signalFill.classList.remove('gradient-weak', 'gradient-moderate', 'gradient-strong', 'gradient-very-strong');
                signalFill.classList.add('gradient-weak');
                // Reset dB value display
                document.getElementById('dbCurrentValue').textContent = '-90 dB';
            }
            
            // Allow signal updates after brief delay to prevent immediate override
            setTimeout(() => {
                signalResetInProgress = false;
            }, 100); // 100ms delay to prevent race condition
        }
    };
    
    updateTimer(); // Initial update
    cycleTimer = setInterval(updateTimer, 1000);
}

// Clear cycle display
function clearCycleDisplay() {
    if (cycleTimer) {
        clearInterval(cycleTimer);
        cycleTimer = null;
    }
    
    const timerDisplay = document.getElementById('timerDisplay');
    const progressBar = document.getElementById('timerProgressBar');
    const currentFreq = document.getElementById('currentFrequency');
    
    if (timerDisplay) timerDisplay.textContent = '--';
    if (progressBar) progressBar.style.width = '0%';
    if (currentFreq) currentFreq.textContent = '--';
}

// Connect to SSE
function connectSSE() {
    // Prevent duplicate connections
    if (sseConnectionActive && eventSource && eventSource.readyState !== EventSource.CLOSED) {
        return;
    }
    
    if (eventSource) {
        eventSource.close();
    }
    
    sseConnectionActive = true;
    eventSource = new EventSource(`${API_BASE_URL}/data-stream`);
    
    eventSource.onopen = () => {
        logInfo('SSE connection established');
        connectionStatus = 'connected';
        connectionRetryCount = 0;
        updateConnectionStatus();
        
        // Reset sync flags when SSE connects to clear any stuck states
        resetSyncFlags();
        
        if (connectionRetryCount > 0) {
            showStatus('Connection restored', 'success');
        }
        
        // Don't call synchronizeWithServerState here - it causes a loop
        // The periodic sync (every 30 seconds) will handle state updates
    };
    
    // Comment out generic message handler to avoid duplicate processing
    // eventSource.onmessage = (event) => {
    //     try {
    //         const data = JSON.parse(event.data);
    //         updateDisplay(data);
    //         
    //         // Update heartbeat and connection status on successful data
    //         if (connectionStatus !== 'connected') {
    //             connectionStatus = 'connected';
    //             connectionRetryCount = 0;
    //             updateConnectionStatus();
    //         }
    //     } catch (error) {
    //         logError('SSE data parsing', error, { eventData: event.data });
    //         showStatus('Error parsing data from server', 'warning');
    //     }
    // };
    
    // Handle sweep_data events (signal strength updates) - SIGNAL DATA ONLY
    eventSource.addEventListener('sweep_data', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            
            updateDisplay(data); // Signal data processing - no cycle state management
            
            // Update connection status on successful data
            if (connectionStatus !== 'connected') {
                connectionStatus = 'connected';
                connectionRetryCount = 0;
                updateConnectionStatus();
            }
        } catch (error) {
            logError('SSE sweep_data parsing', error, { eventData: event.data });
            showStatus('Error parsing sweep data from server', 'warning');
        }
    });
    
    // Handle status_change events - CYCLE STATE MANAGEMENT ONLY
    eventSource.addEventListener('status_change', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleStatusChange(data); // Cycle state changes and frequency display updates
        } catch (error) {
            console.error('Error parsing status change:', error);
        }
    });
    
    // Handle cycle_config events - CYCLE CONFIGURATION ONLY
    eventSource.addEventListener('cycle_config', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleCycleConfig(data); // Initial cycle setup and configuration
        } catch (error) {
            console.error('Error parsing cycle config:', error);
        }
    });
    
    eventSource.addEventListener('error', (event) => {
        try {
            const data = JSON.parse(event.data);
            const errorMessage = data.message || 'Error occurred';
            
            // Use enhanced error display for better user feedback
            const errorType = data.errorType || 'general_error';
            const recoveryMessage = getGeneralErrorRecovery(errorType, data);
            
            showEnhancedError(errorMessage, 'general_error', {
                recovery: recoveryMessage,
                context: { 
                    errorType: errorType,
                    severity: data.severity || 'medium',
                    retryable: isRetryableError(errorType)
                }
            });
            
            trackOperation(`General error: ${errorMessage}`, { 
                source: 'sse_error',
                errorType: errorType,
                severity: data.severity
            });
            
        } catch (error) {
            console.error('Error parsing error event:', error);
            showStatus('An unknown error occurred', 'error');
        }
    });
    
    // Handle emergency stop events
    eventSource.addEventListener('emergency_stop', (event) => {
        try {
            const __data = JSON.parse(event.data);
            logWarn('🚨 Emergency stop event received from server');
            
            // Force reset UI state immediately
            resetScanningState();
            showStatus('🚨 Emergency stop executed by server - all processes terminated', 'warning');
            trackOperation('Emergency stop executed by server');
            
        } catch (error) {
            console.error('Error parsing emergency_stop event:', error);
        }
    });
    
    // Handle server reset events
    eventSource.addEventListener('server_reset', (event) => {
        try {
            const __data = JSON.parse(event.data);
            logInfo('🔧 Server reset event received');
            
            showStatus('🔧 Server reset in progress - page will reload automatically', 'warning');
            
            // Force reset UI state
            resetScanningState();
            
            // Disconnect from SSE
            disconnectSSE();
            
            // Reload page after brief delay to allow server to complete reset
            setTimeout(() => {
                window.location.reload();
            }, 3000);
            
        } catch (error) {
            console.error('Error parsing server_reset event:', error);
        }
    });
    
    // Handle state sync events
    eventSource.addEventListener('state_sync', (event) => {
        try {
            const data = JSON.parse(event.data);
            logInfo('🔄 State sync event received from server');
            
            showStatus('🔄 Server state synchronized', 'info');
            
            // Update UI with the latest state
            if (data.afterState) {
                restoreUIStateFromServer(data.afterState);
            }
            
        } catch (error) {
            console.error('Error parsing state_sync event:', error);
        }
    });



    // Handle stuck recovery events
    eventSource.addEventListener('stuck_recovery_attempted', (event) => {
        try {
            const data = JSON.parse(event.data);
            showStatus(`🔧 Attempting stuck recovery (${data.attempt}/${data.maxAttempts})`, 'warning');
        } catch (error) {
            console.error('Error parsing stuck_recovery_attempted event:', error);
        }
    });

    eventSource.addEventListener('stuck_recovery_successful', (event) => {
        try {
            const __data = JSON.parse(event.data);
            showStatus('✅ Stuck recovery successful', 'success');
        } catch (error) {
            console.error('Error parsing stuck_recovery_successful event:', error);
        }
    });

    eventSource.addEventListener('stuck_recovery_failed', (event) => {
        try {
            const data = JSON.parse(event.data);
            showEnhancedError(`🚨 Stuck recovery failed: ${data.message}`, 'stuck_recovery', {
                recovery: 'Check HackRF connection and try restarting the sweep operation.',
                context: { errorType: 'stuck_recovery_failure', attempts: data.attempts }
            });
        } catch (error) {
            console.error('Error parsing stuck_recovery_failed event:', error);
        }
    });

    // Handle cycling-specific error events
    eventSource.addEventListener('cycling_error', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleCyclingError(data);
        } catch (error) {
            console.error('Error parsing cycling_error event:', error);
        }
    });

    eventSource.addEventListener('frequency_error', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleFrequencyError(data);
        } catch (error) {
            console.error('Error parsing frequency_error event:', error);
        }
    });

    eventSource.addEventListener('graceful_stop', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleGracefulStop(data);
        } catch (error) {
            console.error('Error parsing graceful_stop event:', error);
        }
    });

    eventSource.addEventListener('stuck_recovery_error', (event) => {
        try {
            const data = JSON.parse(event.data);
            showEnhancedError(`🔧 Recovery attempt failed: ${data.error}`, 'recovery_error', {
                recovery: 'Try restarting the scanning operation or check HackRF connection.',
                context: { errorType: 'recovery_error', attempt: data.attempt }
            });
        } catch (error) {
            console.error('Error parsing stuck_recovery_error event:', error);
        }
    });
    
    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        connectionStatus = 'error';
        sseConnectionActive = false;  // Mark connection as inactive
        updateConnectionStatus();
        
        if (eventSource.readyState === EventSource.CLOSED) {
            connectionRetryCount++;
            
            if (connectionRetryCount <= maxRetryAttempts) {
                showStatus(`Connection lost. Attempting to reconnect... (${connectionRetryCount}/${maxRetryAttempts})`, 'warning');
                
                // Reset states on connection loss (but preserve cycling flags for reconnection)
                if (isScanning) {
                    isScanning = false;
                    isCycling = false;
                    // Don't immediately clear cycling flags - may reconnect during cycling
                    updateButtonStates();
                }
                
                // Try to reconnect with exponential backoff
                const retryDelay = Math.min(5000 * Math.pow(2, connectionRetryCount - 1), 30000);
                setTimeout(() => {
                    if (connectionRetryCount <= maxRetryAttempts) {
                        logInfo(`Attempting to reconnect (attempt ${connectionRetryCount})...`);
                        connectSSE();
                    }
                }, retryDelay);
            } else {
                showStatus('Connection failed after multiple attempts. Server may be down or HackRF disconnected.', 'error');
                // Connection error
                
                // Reset states on final failure
                isScanning = false;
                isCycling = false;
                // Clear cycling flags on final connection failure
                activeCyclingOperation = false;
                reducedSyncMode = false;
                updateButtonStates();
            }
        }
    };
}

// Disconnect SSE
function disconnectSSE() {
    sseConnectionActive = false;  // Mark connection as inactive
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

// Enhanced synchronization with detailed tracking
async function synchronizeWithServerState(syncReason = 'manual') {
    // Prevent recursive synchronization calls
    if (isSynchronizing) {
        trackOperation('Sync blocked: already synchronizing', { source: 'sync_guard', reason: syncReason });
        return;
    }
    
    // CYCLING PRIORITY: Reduce sync blocking during active cycling
    const isCyclingSync = (syncReason === 'cycling_frequency_switch' || activeCyclingOperation);
    
    isSynchronizing = true;
    syncInProgress = !isCyclingSync;  // Don't block startSweep during cycling sync
    lastSyncTime = Date.now();  // Track sync timing
    const syncId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    trackOperation(`State synchronization started (${syncReason})`, { 
        source: 'state_sync',
        syncId,
        currentState: { isScanning, isCycling, connectionStatus }
    });
    
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 5000);
        
        const response = await fetch(`${API_BASE_URL}/cycle-status`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const serverState = await response.json();
            
            trackOperation('Server state received', {
                source: 'state_sync',
                syncId,
                serverRunning: Boolean(serverState.isRunning || serverState.isActive),
                frequencies: serverState.frequencies?.length || 0
            });
            
            // Validate server state structure
            if (typeof serverState === 'object' && serverState !== null) {
                // Check for state coherence issues on the server
                if (serverState.stateCoherent === false) {
                    console.warn('⚠️ Server state incoherent detected - process and running state mismatch');
                    trackOperation('Server state incoherent detected', {
                        source: 'state_sync',
                        syncId,
                        recovery: 'Server auto-fixing state coherence'
                    });
                    showStatus('Server state synchronization in progress...', 'warning');
                }
                
                // Check if server state differs from UI state
                const stateChanged = restoreUIStateFromServer(serverState);
                
                
                // Always ensure button states match reality after synchronization
                const serverIsActive = Boolean(serverState.isRunning || serverState.isActive);
                verifyButtonStatesMatchReality(serverIsActive);
                
                // Track last sync time
                window.lastStateSyncTime = new Date().toLocaleTimeString();
                
                if (stateChanged) {
                    trackOperation('UI state synchronized with server', {
                        source: 'state_sync',
                        syncId,
                        changes: 'State differences resolved'
                    });
                    showStatus('UI state synchronized with server state', 'info');
                } else {
                    trackOperation('States already synchronized', {
                        source: 'state_sync',
                        syncId
                    });
                }
            }
        } else {
            trackOperation(`Sync failed: HTTP ${response.status}`, {
                source: 'state_sync',
                syncId,
                statusCode: response.status
            });
        }
    } catch (error) {
        // Track sync errors for debugging but don't show to user
        trackOperation(`Sync error: ${error.message}`, {
            source: 'state_sync',
            syncId,
            errorType: error.name,
            reason: syncReason
        });
        
        if (error.name === 'AbortError') {
            logInfo('State sync timed out - this is normal during server operations');
        } else {
            logError('State sync failed:', error.message);
        }
    } finally {
        isSynchronizing = false;
        syncInProgress = false;  // Clear guard flag
        
        trackOperation(`State synchronization completed (${syncReason})`, {
            source: 'state_sync',
            syncId,
            cyclingMode: activeCyclingOperation,
            reducedSync: reducedSyncMode
        });
    }
}

// Verify that the stop operation has completed on the server
async function verifyStopCompletion() {
    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 3000); // 3 second timeout for verification
        
        const response = await fetch(`${API_BASE_URL}/cycle-status`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const serverState = await response.json();
            
            // Check if server is truly stopped
            const serverIsActive = Boolean(serverState.isRunning || serverState.isActive);
            
            if (serverIsActive) {
                // Server still shows running - this is expected due to race condition timing
                console.warn('⚠️ Timing issue detected: server may still be shutting down');
                // Don't throw error - force stop will handle this automatically if needed
                logInfo('ℹ️ This is normal - the stop operation may still be completing');
            } else {
                logInfo('✅ Stop completion verified - server shows stopped state');
            }
        } else {
            // If status endpoint fails, assume stop worked (for backward compatibility)
            logInfo('ℹ️ Could not verify stop completion (status endpoint unavailable)');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('⚠️ Stop verification timed out - this is normal during shutdown');
            // Don't throw error - this is expected during stop operations
        } else if (error.message.includes('Failed to fetch')) {
            // Network error - can't verify, but don't fail the stop operation
            logInfo('ℹ️ Cannot verify stop completion due to network error');
        } else {
            // Log other errors but don't throw - let stop operation complete
            console.warn('ℹ️ Stop verification error (non-critical):', error.message);
        }
    }
}

// Restore UI state based on server response
function restoreUIStateFromServer(serverState) {
    let stateChanged = false;
    
    // CYCLING EXCEPTION: Skip restoration if actively cycling to prevent interference
    if (activeCyclingOperation && isCycling) {
        trackOperation('State restoration skipped - active cycling in progress', {
            source: 'cycling_protection',
            serverIsActive: Boolean(serverState.isRunning || serverState.isActive)
        });
        return false; // No state change during active cycling
    }
    
    // Set restoration mode flag to prevent event handlers from triggering operations
    isRestoringState = true;
    
    // Server returns 'isRunning', not 'isActive' - fix the key mismatch
    const serverIsActive = Boolean(serverState.isRunning || serverState.isActive);
    
    // Check if server is running but UI thinks it's not (split brain state)
    if (serverIsActive && !isScanning) {
        isScanning = true;
        stateChanged = true;
        
        // Show clear user feedback about state sync
        showStatus('🔄 Server is running a sweep - UI synchronized', 'warning');
        
        // Update connection status since we found server is active
        connectionStatus = 'connected';
        
    }
    
    // Check if server is not running but UI thinks it is
    if (!serverIsActive && isScanning) {
        isScanning = false;
        isCycling = false;
        stateChanged = true;
        
        // Show user feedback about state reset
        showStatus('🔄 Server not running - UI state reset', 'info');
        
        // Update connection status
        connectionStatus = 'disconnected';
        
    }
    
    // Enhanced button state management for split-brain recovery
    if (stateChanged) {
        // Force update button states to reflect corrected server state
        updateButtonStates();
    }
    
    // Update cycling state and frequency information only if server is active
    if (serverIsActive) {
        // Handle frequency information if available
        if (Array.isArray(serverState.frequencies) && serverState.frequencies.length > 0) {
            // Restore frequency inputs to match server state
            const frequencyList = document.getElementById('frequencyList');
            if (frequencyList) {
                // Clear existing frequency inputs
                frequencyList.innerHTML = '';
                
                // Recreate frequency inputs based on server state (direct HTML manipulation during restoration)
                serverState.frequencies.forEach((freq, index) => {
                    const newIndex = index + 1;
                    const newItem = document.createElement('div');
                    newItem.className = 'frequency-item saasfly-interactive-card flex items-center gap-3 p-4 bg-gradient-to-r from-bg-card/40 to-bg-card/20 rounded-xl border border-border-primary/40 hover:border-neon-cyan/40 hover:bg-gradient-to-r hover:from-bg-card/60 hover:to-bg-card/40 hover:shadow-md transition-all duration-300';
                    newItem.id = `frequencyItem${newIndex}`;
                    
                    newItem.innerHTML = `
                        <span class="font-mono text-sm text-text-muted font-semibold min-w-[24px] text-center bg-neon-cyan/10 rounded-lg px-2 py-1">${newIndex}</span>
                        <div class="flex-1 relative">
                            <input type="text" id="frequencyInput${newIndex}" placeholder="Target" value="${freq.value || ''}" class="font-mono w-full pl-3 pr-12 py-2 bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary outline-none focus:border-neon-cyan focus:bg-bg-input focus:shadow-neon-cyan-sm transition-all duration-300 placeholder:text-text-muted/50">
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-secondary font-medium pointer-events-none">MHz</span>
                        </div>
                        ${newIndex > 1 ? `<button type="button" onclick="removeFrequencyInput('frequencyItem${newIndex}')" style="padding: 6px 12px !important; background-color: #ef4444 !important; color: white !important; border: none !important; border-radius: 6px !important; font-size: 14px !important; font-weight: 500 !important; cursor: pointer !important; box-shadow: none !important; text-shadow: none !important; outline: none !important; transition: box-shadow 0.3s ease !important;" onmouseover="this.style.boxShadow='0 0 10px rgba(255, 255, 255, 0.4)'" onmouseout="this.style.boxShadow='none'">Remove</button>` : ''}
                    `;
                    
                    frequencyList.appendChild(newItem);
                });
                
                // Update button states
                updateAddButtonState();
                
            }
            
            const wasCycling = isCycling;
            isCycling = serverState.frequencies.length > 1;
            
            if (wasCycling !== isCycling) {
                stateChanged = true;
            }
            
            // Update current frequency index if provided
            if (typeof serverState.currentIndex === 'number' && 
                serverState.currentIndex >= 0 && 
                serverState.currentIndex < serverState.frequencies.length) {
                const oldIndex = currentFrequencyIndex;
                currentFrequencyIndex = serverState.currentIndex;
                
                if (oldIndex !== currentFrequencyIndex) {
                    stateChanged = true;
                    updateFrequencyHighlight(currentFrequencyIndex);
                }
            }
            
            // Update current frequency display - handle both frequency formats
            if (serverState.currentFrequency) {
                const freqValue = serverState.currentFrequency.value || serverState.currentFrequency.frequency;
                const freqUnit = serverState.currentFrequency.unit || 'MHz';
                if (freqValue && freqUnit) {
                    updateCurrentFrequencyDisplay({ value: freqValue, unit: freqUnit });
                }
            }
            
            // Show cycle status if cycling
            if (isCycling) {
                showCycleStatus(true);
                
                // Start cycle display if we have timing information
                if (typeof serverState.cycleTime === 'number' && serverState.cycleTime > 0) {
                    globalCycleTime = serverState.cycleTime;  // Store cycle time globally
                    startCycleDisplay(serverState.frequencies, serverState.cycleTime);
                }
            } else {
                showCycleStatus(false);
            }
            
        } else if (serverState.currentFrequency) {
            // Single frequency operation - handle both frequency formats
            isCycling = false;
            showCycleStatus(false);
            
            const freqValue = serverState.currentFrequency.value || serverState.currentFrequency.frequency;
            const freqUnit = serverState.currentFrequency.unit || 'MHz';
            if (freqValue && freqUnit) {
                updateCurrentFrequencyDisplay({ value: freqValue, unit: freqUnit });
            }
            
        }
    }
    
    // Update button states and UI elements if state changed
    if (stateChanged) {
        updateButtonStates();
        
        // Clear any previous highlights if not scanning
        if (!isScanning) {
            clearFrequencyHighlights();
            clearCycleDisplay();
            resetDisplay();
        }
        
        // If server is running but UI wasn't aware, connect to SSE stream
        if (serverIsActive && !sseConnectionActive) {
            connectSSE();
        }
        
    }
    
    // Clear restoration mode flag and restore event listeners
    isRestoringState = false;
    
    // Add event listeners to all frequency inputs after restoration is complete
    addEventListenersToFrequencyInputs();
    
    return stateChanged;
}

// Update display with new data - SIGNAL DATA PROCESSING ONLY
// This function handles signal strength data display and frequency accuracy
// Cycle frequency display updates are handled by handleStatusChange() for clean separation
function updateDisplay(data) {
    if (!data || typeof data.db === 'undefined') {
        return;
    }
    
    // Skip signal indicator updates during reset to maintain synchronization
    if (signalResetInProgress) {
        return;
    }
    
    const db = data.db;
    const frequency = data.frequency;
    const unit = data.unit || 'MHz';
    
    // Update dB level display
    document.getElementById('dbLevelValue').textContent = db.toFixed(1);
    
    // Update signal strength text and class
    const { strength, className } = getSignalStrength(db);
    const signalStrengthElement = document.getElementById('signalStrengthText');
    signalStrengthElement.textContent = strength;
    signalStrengthElement.className = `value ${className}`;
    
    // Update signal indicator bar
    const percentage = Math.max(0, Math.min(100, (db + 100) * 1.25)); // Map -100 to 0, -20 to 100
    const fillElement = document.getElementById('signalIndicatorFill');
    fillElement.style.width = percentage + '%';
    
    // Apply gradient class based on signal strength
    // Remove any existing gradient classes
    fillElement.classList.remove('gradient-weak', 'gradient-moderate', 'gradient-strong', 'gradient-very-strong');
    
    if (db >= -50) {
        fillElement.classList.add('gradient-very-strong');
    } else if (db >= -60) {
        fillElement.classList.add('gradient-strong');
    } else if (db >= -70) {
        fillElement.classList.add('gradient-moderate');
    } else if (db >= -90) {
        fillElement.classList.add('gradient-weak');
    }
    
    // Update current dB indicator position
    const indicatorPosition = Math.max(0, Math.min(100, (db + 100) * 1.25));
    const dbIndicator = document.getElementById('dbCurrentIndicator');
    dbIndicator.style.left = indicatorPosition + '%';
    
    // Update current dB value
    document.getElementById('dbCurrentValue').textContent = db.toFixed(1) + ' dB';
    
    // Enhanced frequency accuracy display
    if (data.targetFrequency && data.frequencyAccuracy) {
        // Update target frequency
        const targetFreqText = `${data.targetFrequency.value.toFixed(3)} ${data.targetFrequency.unit}`;
        document.getElementById('targetFrequency').textContent = targetFreqText;
        
        // Update detected frequency with precision
        const detectedFreqText = `${frequency.toFixed(3)} ${unit}`;
        document.getElementById('detectedFrequency').textContent = detectedFreqText;
        
        // Update frequency offset with color coding
        const offsetMHz = data.frequencyAccuracy.offsetFromTargetMHz;
        const offsetElement = document.getElementById('frequencyOffset');
        const offsetText = offsetMHz >= 0 ? `+${offsetMHz.toFixed(3)}` : `${offsetMHz.toFixed(3)}`;
        offsetElement.textContent = `${offsetText} MHz`;
        
        // Color code the offset based on accuracy
        offsetElement.className = 'value';
        if (Math.abs(offsetMHz) <= 0.05) {
            offsetElement.classList.add('accurate'); // Green for very accurate (within 50kHz)
        } else if (Math.abs(offsetMHz) <= 0.1) {
            offsetElement.classList.add('moderate'); // Yellow for moderate (within 100kHz)
        } else {
            offsetElement.classList.add('inaccurate'); // Red for inaccurate (over 100kHz)
        }
        
    } else {
        // Fallback for backward compatibility
        document.getElementById('targetFrequency').textContent = '--';
        document.getElementById('detectedFrequency').textContent = frequency ? `${frequency.toFixed(3)} ${unit}` : '--';
        document.getElementById('frequencyOffset').textContent = '--';
        
    }
    
    // Note: Frequency display updates for cycling are handled by status_change events
    // This ensures clean separation between signal data processing and cycle state management
}

// Get signal strength classification
function getSignalStrength(db) {
    if (db < -90) {
        return { strength: 'No Signal', className: 'signal-no-signal' };
    } else if (db < -80) {
        return { strength: 'Very Weak', className: 'signal-very-weak' };
    } else if (db < -70) {
        return { strength: 'Weak', className: 'signal-weak' };
    } else if (db < -60) {
        return { strength: 'Moderate', className: 'signal-moderate' };
    } else if (db < -50) {
        return { strength: 'Strong', className: 'signal-strong' };
    } else {
        return { strength: 'Very Strong', className: 'signal-very-strong' };
    }
}

// Reset display to default state
function resetDisplay() {
    // Coordinate reset to prevent conflicts with timer synchronization
    signalResetInProgress = true;
    
    document.getElementById('dbLevelValue').textContent = '--';
    const signalElement = document.getElementById('signalStrengthText');
    signalElement.textContent = 'No Signal';
    signalElement.className = 'value signal-no-signal';
    const signalFill = document.getElementById('signalIndicatorFill');
    signalFill.style.width = '0%';
    signalFill.classList.remove('gradient-weak', 'gradient-moderate', 'gradient-strong', 'gradient-very-strong');
    document.getElementById('dbCurrentIndicator').style.left = '0%';
    document.getElementById('dbCurrentValue').textContent = '-90 dB';
    
    // Allow signal updates after brief delay
    setTimeout(() => {
        signalResetInProgress = false;
    }, 50); // Shorter delay since this is a one-time reset
    
    // Reset frequency accuracy display
    document.getElementById('targetFrequency').textContent = '--';
    document.getElementById('detectedFrequency').textContent = '--';
    const offsetElement = document.getElementById('frequencyOffset');
    offsetElement.textContent = '--';
    offsetElement.className = 'value'; // Reset color coding
}

// Update button states - Enhanced with server state awareness
function updateButtonStates() {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    
    // Primary button logic based on frontend state
    startButton.disabled = isScanning;
    stopButton.disabled = !isScanning;
    
    // Update button text to reflect current state
    if (isScanning) {
        startButton.textContent = 'Sweep Running';
        stopButton.textContent = 'Stop Sweep';
    } else {
        startButton.textContent = 'Start Cycling';
        stopButton.textContent = 'Stop';
    }
    
    // Enable/disable cycling state on container
    const container = document.querySelector('.container');
    if (container) {
        if (isScanning) {
            container.classList.add('cycling-disabled');
        } else {
            container.classList.remove('cycling-disabled');
        }
    }
    
    // Update add button
    updateAddButtonState();
    
    // Disable cycle time input during scanning
    const cycleTimeInput = document.getElementById('cycleTimeInput');
    if (cycleTimeInput) {
        cycleTimeInput.disabled = isScanning;
    }
}

// Update button states based on actual server state (for split-brain recovery)
function __updateButtonStatesFromServerState(serverIsActive) {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    
    if (serverIsActive) {
        // Server is running - ensure stop button is enabled, start button disabled
        startButton.disabled = true;
        startButton.textContent = 'Sweep Running';
        stopButton.disabled = false;
        stopButton.textContent = 'Stop Sweep';
        stopButton.style.background = '#ef4444';
        stopButton.style.borderColor = '#dc2626';
        stopButton.style.color = 'white';
        stopButton.style.cursor = 'pointer';
        
        showStatus('🔄 Buttons updated to reflect server state: RUNNING', 'info');
    } else {
        // Server is not running - ensure start button is enabled, stop button disabled
        startButton.disabled = false;
        startButton.textContent = 'Start Cycling';
        stopButton.disabled = true;
        stopButton.textContent = 'Stop';
        stopButton.style.background = '';
        stopButton.style.borderColor = '';
        stopButton.style.color = '';
        stopButton.style.cursor = '';
        
        showStatus('🔄 Buttons updated to reflect server state: STOPPED', 'info');
    }
    
    // Update container cycling state
    const container = document.querySelector('.container');
    if (container) {
        if (serverIsActive) {
            container.classList.add('cycling-disabled');
        } else {
            container.classList.remove('cycling-disabled');
        }
    }
    
    // Update other UI elements
    updateAddButtonState();
    const cycleTimeInput = document.getElementById('cycleTimeInput');
    if (cycleTimeInput) {
        cycleTimeInput.disabled = serverIsActive;
    }
}

// Verify button states match reality (final safety check for split-brain scenarios)
function verifyButtonStatesMatchReality(serverIsActive) {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    
    let buttonStateIssues = [];
    
    // Check for button state mismatches
    if (serverIsActive) {
        // Server is running - start should be disabled, stop should be enabled
        if (!startButton.disabled) {
            buttonStateIssues.push('Start button should be disabled (server running)');
            startButton.disabled = true;
            startButton.textContent = 'Sweep Running';
        }
        if (stopButton.disabled) {
            buttonStateIssues.push('Stop button should be enabled (server running)');
            stopButton.disabled = false;
            stopButton.textContent = 'Stop Sweep';
            stopButton.style.background = '#ef4444';
            stopButton.style.borderColor = '#dc2626';
            stopButton.style.color = 'white';
            stopButton.style.cursor = 'pointer';
        }
    } else {
        // Server is not running - start should be enabled, stop should be disabled
        if (startButton.disabled && !isScanning) {
            buttonStateIssues.push('Start button should be enabled (server stopped)');
            startButton.disabled = false;
            startButton.textContent = 'Start Cycling';
        }
        if (!stopButton.disabled && !isScanning) {
            buttonStateIssues.push('Stop button should be disabled (server stopped)');
            stopButton.disabled = true;
            stopButton.textContent = 'Stop';
            stopButton.style.background = '';
            stopButton.style.borderColor = '';
            stopButton.style.color = '';
            stopButton.style.cursor = '';
        }
    }
    
    
    // Log any fixes made
    if (buttonStateIssues.length > 0) {
        console.warn('🔧 Button state issues fixed:', buttonStateIssues);
        showStatus(`🔧 Fixed ${buttonStateIssues.length} button state issue(s)`, 'info');
    }
}

// Handle status change events - SINGLE SOURCE OF TRUTH for cycle frequency display
// This function manages cycle state changes and frequency display updates
// Signal data processing (updateDisplay) is kept separate from cycle state management
function handleStatusChange(data) {
    if (data.status === 'switching') {
        // Mark active cycling operation to bypass certain guard flags
        activeCyclingOperation = true;
        reducedSyncMode = true;
        
        // DO NOT update currentFrequencyIndex during switching - only during 'active' status
        
        // Handle both frequency formats during transition
        const nextFreq = data.nextFrequency;
        if (nextFreq) {
            const freqValue = nextFreq.value || nextFreq.frequency;
            const freqUnit = nextFreq.unit || 'MHz';
            showStatus(`Switching to ${freqValue} ${freqUnit}...`, 'info');
            updateCurrentFrequencyDisplay({ value: freqValue, unit: freqUnit });
            
            trackOperation('Frequency switch in progress', {
                source: 'cycling_operation',
                fromIndex: currentFrequencyIndex,
                toFrequency: `${freqValue} ${freqUnit}`,
                cyclingActive: true
            });
        }
        updateFrequencyHighlight(currentFrequencyIndex);
        
    } else if (data.status === 'active') {
        currentFrequencyIndex = data.currentIndex || 0;
        updateFrequencyHighlight(currentFrequencyIndex);
        
        // Handle both frequency formats during transition
        if (data.currentFrequency) {
            // Since the label says "Next Frequency", show the next frequency in cycle
            updateNextFrequencyDisplay(null, currentFrequencyIndex);
        }
        
        // CRITICAL FIX: Restart timer when frequency becomes active during cycling
        // This ensures timer stays synchronized with actual frequency switches
        if (isCycling) {
            // Maintain cycling operation flags during active cycling
            activeCyclingOperation = true;
            reducedSyncMode = true;
            
            // Use provided cycleTime or fall back to global cycle time
            const cycleTime = data.cycleTime || globalCycleTime;
            startTimer(cycleTime);
            
            trackOperation('Timer restarted for active frequency', {
                source: 'cycling_timer_sync',
                currentIndex: currentFrequencyIndex,
                cycleTime,
                cyclingFlags: { activeCyclingOperation, reducedSyncMode }
            });
        }
    }
}

// Handle cycle configuration
function handleCycleConfig(data) {
    if (data.frequencies && data.cycleTime) {
        isCycling = data.frequencies.length > 1;
        globalCycleTime = data.cycleTime;  // Store cycle time globally
        
        if (isCycling) {
            // Activate cycling mode flags for guard bypass
            activeCyclingOperation = true;
            reducedSyncMode = true;
            
            showStatus(`Cycling ${data.frequencies.length} frequencies every ${data.cycleTime / 1000}s`, 'info');
            startCycleDisplay(data.frequencies, data.cycleTime);
            
            trackOperation('Cycle configuration activated', {
                source: 'cycle_config',
                frequencyCount: data.frequencies.length,
                cycleTime: data.cycleTime,
                cyclingFlags: { activeCyclingOperation, reducedSyncMode }
            });
        } else {
            // Single frequency mode - disable cycling flags
            activeCyclingOperation = false;
            reducedSyncMode = false;
        }
    }
}

// Cycling-aware state management functions
function __setCyclingPriority(enabled, reason = 'unknown') {
    const wasEnabled = activeCyclingOperation;
    activeCyclingOperation = enabled;
    reducedSyncMode = enabled;
    
    if (wasEnabled !== enabled) {
        trackOperation(`Cycling priority ${enabled ? 'enabled' : 'disabled'}`, {
            source: 'cycling_priority',
            reason,
            previousState: wasEnabled,
            newState: enabled
        });
    }
}

function __isCyclingActive() {
    return activeCyclingOperation && isCycling;
}

function __shouldBypassSyncGuards(operationType = 'unknown') {
    const bypass = activeCyclingOperation || (operationType === 'cycling');
    if (bypass) {
        trackOperation('Sync guard bypass activated', {
            source: 'guard_bypass',
            operationType,
            activeCycling: activeCyclingOperation,
            reason: activeCyclingOperation ? 'active_cycling' : 'cycling_operation'
        });
    }
    return bypass;
}

// Update frequency highlight
function updateFrequencyHighlight(index) {
    clearFrequencyHighlights();
    
    const frequencyItems = document.querySelectorAll('.frequency-item');
    if (frequencyItems[index]) {
        // Don't add any class that changes appearance
        // Just track internally which one is active
        frequencyItems[index].setAttribute('data-current', 'true');
    }
}

// Clear all frequency highlights
function clearFrequencyHighlights() {
    document.querySelectorAll('.frequency-item[data-current="true"]').forEach(elem => {
        elem.removeAttribute('data-current');
    });
}

// Show status message with enhanced formatting
function showStatus(message, type = 'info', showSpinner = false) {
    const statusElement = document.getElementById('statusMessage');
    const timestamp = new Date().toLocaleTimeString();
    
    // Create message with timestamp
    let displayMessage = `[${timestamp}] ${message}`;
    
    // Add spinner if requested
    if (showSpinner) {
        displayMessage += ' <span class="loading"></span>';
        statusElement.innerHTML = displayMessage;
    } else {
        statusElement.textContent = displayMessage;
    }
    
    // Reset classes and apply new ones
    statusElement.className = 'status-message';
    
    // Apply type-specific styling
    switch (type) {
        case 'error':
            statusElement.classList.add('error');
            break;
        case 'warning':
            statusElement.classList.add('warning');
            break;
        case 'success':
            statusElement.classList.add('success');
            break;
        case 'info':
        default:
            statusElement.classList.add('info');
            break;
    }
    
    // Clear status after timeout for non-error messages
    if (type !== 'error') {
        const timeout = type === 'success' ? 3000 : 5000;
        setTimeout(() => {
            if (!statusElement.classList.contains('error')) {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }
        }, timeout);
    }
}

// Set loading state for buttons and inputs
function setLoadingState(loading) {
    const startButton = document.getElementById('startButton');
    const __stopButton = document.getElementById('stopButton');
    const addButton = document.getElementById('addFrequencyButton');
    const cycleTimeInput = document.getElementById('cycleTimeInput');
    const frequencyInputs = document.querySelectorAll('.frequency-item input, .frequency-item select');
    
    if (loading) {
        startButton.disabled = true;
        startButton.textContent = 'Starting...';
        
        // Disable all inputs during loading
        if (addButton) addButton.disabled = true;
        if (cycleTimeInput) cycleTimeInput.disabled = true;
        frequencyInputs.forEach(input => input.disabled = true);
    } else {
        startButton.textContent = 'Start Cycling';
        
        // Re-enable inputs based on current state
        if (addButton) addButton.disabled = isScanning;
        if (cycleTimeInput) cycleTimeInput.disabled = isScanning;
        frequencyInputs.forEach(input => input.disabled = isScanning);
    }
}

// Update connection status indicator
function updateConnectionStatus() {
    // Connection status indicator removed
}

// Basic error message extraction
function getErrorMessage(error) {
    if (typeof error === 'string') return error;
    return error.message || error.toString() || 'Unknown error occurred';
}


// Enhanced error display system with recovery suggestions
function showEnhancedError(error, context = '', options = {}) {
    const errorMessage = getErrorMessage(error);
    showStatus(errorMessage, 'error');
    
    // Enhanced error tracking
    trackOperation(`Error displayed: ${errorMessage}`, {
        source: 'error_display',
        context,
        recovery: options.recovery || 'No recovery suggestion available',
        errorType: typeof error === 'object' ? error.name : 'string_error'
    });
    
    // Show Copy Error Details button and recovery suggestions after error
    setTimeout(() => {
        createEnhancedErrorPanel(error, context, options);
    }, 500);
}

// Create enhanced error panel with recovery suggestions
function createEnhancedErrorPanel(error, context = '', options = {}) {
    // Remove existing error panel if present
    const existingPanel = document.getElementById('errorPanel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'errorPanel';
    panel.className = 'error-panel';
    
    // Determine if this is a retryable cycling error
    const isRetryable = options.context?.retryable || 
                       (context === 'cycling_error' && options.context?.errorType !== 'failure_loop_prevention') ||
                       (context === 'frequency_error' && !options.context?.blacklisted);
    
    const isCyclingError = context === 'cycling_error' || context === 'frequency_error';
    
    panel.innerHTML = `
        <div class="error-panel-content">
            ${options.recovery ? `
                <div class="recovery-suggestion">
                    <strong>💡 Recovery Suggestion:</strong>
                    <p>${options.recovery}</p>
                </div>
            ` : ''}
            ${isCyclingError ? `
                <div class="cycling-error-details">
                    ${options.context?.frequency ? `<p><strong>Frequency:</strong> ${options.context.frequency} MHz</p>` : ''}
                    ${options.context?.retryCount ? `<p><strong>Retry Count:</strong> ${options.context.retryCount}/${options.context.maxRetries || 'unlimited'}</p>` : ''}
                    ${options.context?.errorType ? `<p><strong>Error Type:</strong> ${options.context.errorType}</p>` : ''}
                </div>
            ` : ''}
            <div class="error-actions">
                <button id="copyErrorButton" class="copy-error-btn">📋 Copy Error Details</button>
                ${options.context && options.context.attemptId ? `
                    <button id="viewCallStackButton" class="view-stack-btn">🔍 View Call Stack</button>
                ` : ''}
                ${isRetryable ? `
                    <button id="retryOperationButton" class="retry-btn">🔄 Retry Operation</button>
                ` : ''}
                ${isCyclingError && !isScanning ? `
                    <button id="restartSweepButton" class="restart-btn">🚀 Restart Sweep</button>
                ` : ''}
                <button id="dismissErrorButton" class="dismiss-error-btn">✕ Dismiss</button>
            </div>
        </div>
    `;
    
    // Insert after the status message
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.parentNode.insertBefore(panel, statusMessage.nextSibling);
    
    // Add event listeners
    document.getElementById('copyErrorButton').onclick = () => copyErrorDetails(error, context, options);
    document.getElementById('dismissErrorButton').onclick = () => panel.remove();
    
    if (options.context && options.context.attemptId) {
        document.getElementById('viewCallStackButton').onclick = () => showCallStackModal(options.context);
    }
    
    // Add retry button listeners for cycling errors
    const retryButton = document.getElementById('retryOperationButton');
    if (retryButton) {
        retryButton.onclick = () => {
            panel.remove();
            handleRetryOperation(context, options.context);
        };
    }
    
    const restartButton = document.getElementById('restartSweepButton');
    if (restartButton) {
        restartButton.onclick = () => {
            panel.remove();
            handleRestartSweep(options.context);
        };
    }
    
    // Auto-hide after 60 seconds
    setTimeout(() => {
        if (panel.parentNode) {
            panel.remove();
        }
    }, 60000);
}

// Create simple Copy Error Details button
function __createCopyErrorButton(error, context = '') {
    // Remove existing button if present
    const existingButton = document.getElementById('copyErrorButton');
    if (existingButton) {
        existingButton.remove();
    }
    
    const button = document.createElement('button');
    button.id = 'copyErrorButton';
    button.className = 'copy-error-btn';
    button.textContent = '📋 Copy Error Details';
    button.onclick = () => copyErrorDetails(error, context);
    
    // Insert after the status message
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.parentNode.insertBefore(button, statusMessage.nextSibling);
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (button.parentNode) {
            button.remove();
        }
    }, 30000);
}

// Enhanced error details copy with comprehensive context
function copyErrorDetails(error, context = '', options = {}) {
    const errorInfo = {
        timestamp: new Date().toISOString(),
        context: context,
        error: typeof error === 'string' ? error : error.message || error.toString(),
        errorStack: typeof error === 'object' ? error.stack : 'N/A',
        userAgent: navigator.userAgent,
        url: window.location.href,
        applicationState: {
            isScanning,
            isCycling,
            connectionStatus,
            sseConnectionActive,
            currentFrequencyIndex
        },
        recentOperations: window.recentOperations?.slice(0, 10) || [],
        startSweepAttempts: window.startSweepTracker?.attempts?.slice(-3) || [],
        lastSyncTime: window.lastStateSyncTime || 'Never',
        recovery: options.recovery || 'No recovery suggestion provided'
    };
    
    // Add attempt context if available
    if (options.context && options.context.attemptId) {
        errorInfo.attemptContext = {
            attemptId: options.context.attemptId,
            type: options.context.type,
            source: options.context.source,
            callStack: options.context.callStack || []
        };
    }
    
    const errorText = `HackRF Monitor Enhanced Error Report
========================================
Timestamp: ${errorInfo.timestamp}
Context: ${errorInfo.context}
Error: ${errorInfo.error}
Recovery Suggestion: ${errorInfo.recovery}

Application State:
- Scanning: ${errorInfo.applicationState.isScanning}
- Cycling: ${errorInfo.applicationState.isCycling}
- Connection: ${errorInfo.applicationState.connectionStatus}
- SSE Active: ${errorInfo.applicationState.sseConnectionActive}
- Current Frequency Index: ${errorInfo.applicationState.currentFrequencyIndex}
- Last Sync: ${errorInfo.lastSyncTime}

Recent Operations (last 10):
${errorInfo.recentOperations.map((op, i) => `${i + 1}. ${op}`).join('\n')}

Start Sweep Attempts (last 3):
${errorInfo.startSweepAttempts.map((attempt, i) => `${i + 1}. [${attempt.timestamp}] ${attempt.type} (${attempt.source})`).join('\n')}

${errorInfo.attemptContext ? `
Attempt Context:
- ID: ${errorInfo.attemptContext.attemptId}
- Type: ${errorInfo.attemptContext.type}
- Source: ${errorInfo.attemptContext.source}
- Call Stack: ${errorInfo.attemptContext.callStack.slice(0, 5).join(' → ')}
` : ''}

Error Stack:
${errorInfo.errorStack}

Browser: ${errorInfo.userAgent}
URL: ${errorInfo.url}`;
    
    // Create enhanced modal with the error text
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; width: 90%; max-width: 800px; max-height: 80vh; overflow: auto;">
            <h3 style="color: #fff; margin-top: 0;">Enhanced Error Details - Press Ctrl+C to copy</h3>
            <textarea readonly style="width: 100%; height: 400px; background: #2a2a2a; color: #fff; border: 1px solid #444; padding: 10px; font-family: monospace; font-size: 12px;">${errorText}</textarea>
            <div style="margin-top: 10px;">
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Close</button>
                <button onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.value).then(() => alert('Copied to clipboard!'))" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy to Clipboard</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-select the text
    const textarea = modal.querySelector('textarea');
    textarea.focus();
    textarea.select();
}

// Show call stack modal for debugging
function showCallStackModal(attemptContext) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const callStackText = attemptContext.callStack ? 
        attemptContext.callStack.map((frame, i) => `${i + 1}. ${frame}`).join('\n') :
        'Call stack not available';
    
    modal.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; width: 80%; max-width: 600px;">
            <h3 style="color: #fff; margin-top: 0;">Call Stack for Attempt: ${attemptContext.attemptId}</h3>
            <div style="background: #2a2a2a; color: #fff; padding: 10px; border-radius: 4px; margin: 10px 0;">
                <strong>Type:</strong> ${attemptContext.type}<br>
                <strong>Source:</strong> ${attemptContext.source}<br>
                <strong>Timestamp:</strong> ${attemptContext.timestamp}
            </div>
            <textarea readonly style="width: 100%; height: 200px; background: #2a2a2a; color: #fff; border: 1px solid #444; padding: 10px; font-family: monospace;">${callStackText}</textarea>
            <button onclick="this.closest('div').parentElement.remove()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
}











// Clear error states - removed
function __clearErrorStates() {
    // Clear error states removed
}

// Perform initial health check
async function performHealthCheck() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            const __data = await response.json();
            connectionStatus = 'connected';
            updateConnectionStatus();
            
        } else {
            connectionStatus = 'error';
            updateConnectionStatus();
            showStatus('Server health check failed', 'warning');
        }
    } catch {
        connectionStatus = 'disconnected';
        updateConnectionStatus();
        
    }
}

// Add debug panel for troubleshooting - removed
function __addDebugPanel() {
    // Debug panel removed
}

// Update debug information - removed
function __updateDebugInfo() {
    // Debug info update removed
}

// Copy debug information to clipboard - removed
function __copyDebugInfo() {
    // Debug info copy removed
}

// Test connection manually - removed
async function __testConnection() {
    // Connection test removed
}

// Get error history (simplified implementation)
function __getErrorHistory() {
    // In a real implementation, you might store error history
    return ['Error history not implemented yet'];
}

// Cycling-specific error handling functions
function handleCyclingError(data) {
    const errorMessage = data.message || 'Cycling operation failed';
    const errorType = data.errorType || 'general_cycling_error';
    
    trackOperation(`Cycling error: ${errorMessage}`, { 
        source: 'cycling_error',
        errorType: errorType,
        frequency: data.frequency,
        severity: data.severity
    });

    // Create enhanced error display with cycling-specific recovery
    const recoveryActions = getCyclingRecoveryActions(errorType, data);
    
    showEnhancedError(errorMessage, 'cycling_error', {
        recovery: recoveryActions.message,
        context: { 
            errorType: errorType,
            frequency: data.frequency,
            severity: data.severity,
            retryable: recoveryActions.retryable
        }
    });

    // Add cycling error indicator to UI
    updateCyclingErrorIndicator(data);
}

function handleFrequencyError(data) {
    const frequency = data.frequency || 'unknown';
    const errorMessage = data.message || `Frequency ${frequency} failed`;
    
    trackOperation(`Frequency error: ${errorMessage}`, { 
        source: 'frequency_error',
        frequency: frequency,
        errorType: data.errorType,
        retryCount: data.retryCount
    });

    // Show frequency-specific error with transition state
    const recoveryMessage = getFrequencyRecoveryMessage(data);
    
    showEnhancedError(errorMessage, 'frequency_error', {
        recovery: recoveryMessage,
        context: { 
            frequency: frequency,
            errorType: data.errorType,
            retryCount: data.retryCount,
            maxRetries: data.maxRetries,
            blacklisted: data.blacklisted
        }
    });

    // Update frequency transition display
    updateFrequencyErrorDisplay(data);
}

function handleGracefulStop(data) {
    const stopReason = data.consecutiveErrors >= data.maxErrors ? 
        'Too many consecutive errors' : 'System protection activated';
    
    trackOperation(`Graceful stop: ${stopReason}`, { 
        source: 'graceful_stop',
        consecutiveErrors: data.consecutiveErrors,
        maxErrors: data.maxErrors,
        frequencyErrors: data.frequencyErrors
    });

    // Reset UI state
    resetScanningState();
    
    // Show comprehensive stop information
    showEnhancedError(`🛑 Cycling stopped: ${stopReason}`, 'graceful_stop', {
        recovery: 'Review error details and check frequency settings. Consider removing problematic frequencies.',
        context: {
            errorType: 'graceful_stop',
            consecutiveErrors: data.consecutiveErrors,
            maxErrors: data.maxErrors,
            blacklistedFrequencies: data.blacklistedFrequencies,
            hasBlacklistedFreqs: data.blacklistedFrequencies && data.blacklistedFrequencies.length > 0
        }
    });

    // Show detailed error summary
    if (data.frequencyErrors && Object.keys(data.frequencyErrors).length > 0) {
        createFrequencyErrorSummary(data.frequencyErrors, data.blacklistedFrequencies);
    }
}

function getCyclingRecoveryActions(errorType, __data) {
    switch (errorType) {
        case 'frequency_startup':
            return {
                message: 'Check HackRF connection and verify frequency is within valid range (1 MHz - 6 GHz).',
                retryable: true
            };
        case 'failure_loop_prevention':
            return {
                message: 'Too many failures detected. Check HackRF connection and frequency settings.',
                retryable: false
            };
        case 'hackrf_device_error':
            return {
                message: 'HackRF device error. Try disconnecting and reconnecting the device.',
                retryable: true
            };
        default:
            return {
                message: 'Check system status and try restarting the operation.',
                retryable: true
            };
    }
}

function getFrequencyRecoveryMessage(data) {
    if (data.blacklisted) {
        return `Frequency ${data.frequency} has been blacklisted due to repeated errors. Consider removing it from your frequency list.`;
    }
    
    if (data.retryCount >= data.maxRetries) {
        return `Frequency ${data.frequency} failed after ${data.retryCount} attempts. It may be incompatible or require different settings.`;
    }
    
    return `Frequency ${data.frequency} failed. The system will retry automatically.`;
}

function updateCyclingErrorIndicator(data) {
    // Add visual indicator for cycling errors
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
        statusElement.classList.add('cycling-error');
        
        // Add severity indicator
        statusElement.setAttribute('data-error-severity', data.severity || 'medium');
        
        // Auto-remove after delay
        setTimeout(() => {
            statusElement.classList.remove('cycling-error');
            statusElement.removeAttribute('data-error-severity');
        }, 10000);
    }
}

function updateFrequencyErrorDisplay(data) {
    
    // Highlight problematic frequency in UI if visible
    highlightFrequencyError(data.frequency);
}

function highlightFrequencyError(frequency) {
    // Find and highlight the frequency input that matches the error
    const frequencyInputs = document.querySelectorAll('input[id^="frequencyInput"]');
    frequencyInputs.forEach(input => {
        const value = parseFloat(input.value);
        const unit = input.parentElement?.querySelector('select')?.value || 'MHz';
        
        let valueInMHz = value;
        if (unit === 'GHz') valueInMHz = value * 1000;
        if (unit === 'kHz') valueInMHz = value / 1000;
        
        // Convert frequency to MHz for comparison
        const errorFreqMHz = parseFloat(frequency);
        
        if (Math.abs(valueInMHz - errorFreqMHz) < 0.001) { // Allow small floating point differences
            const container = input.closest('.frequency-item');
            if (container) {
                container.classList.add('frequency-error');
                
                // Auto-remove highlighting after 15 seconds
                setTimeout(() => {
                    container.classList.remove('frequency-error');
                }, 15000);
            }
        }
    });
}

function createFrequencyErrorSummary(frequencyErrors, blacklistedFrequencies) {
    // Remove existing summary if present
    const existingSummary = document.getElementById('frequencyErrorSummary');
    if (existingSummary) {
        existingSummary.remove();
    }
    
    const summaryPanel = document.createElement('div');
    summaryPanel.id = 'frequencyErrorSummary';
    summaryPanel.className = 'frequency-error-summary';
    
    let summaryHTML = '<div class="error-summary-header"><h3>📊 Frequency Error Summary</h3></div>';
    summaryHTML += '<div class="error-summary-content">';
    
    // Show blacklisted frequencies
    if (blacklistedFrequencies && blacklistedFrequencies.length > 0) {
        summaryHTML += '<div class="blacklisted-frequencies">';
        summaryHTML += '<h4>🚫 Blacklisted Frequencies:</h4>';
        summaryHTML += '<ul>';
        blacklistedFrequencies.forEach(freq => {
            summaryHTML += `<li>${freq} MHz (removed from cycling)</li>`;
        });
        summaryHTML += '</ul>';
        summaryHTML += '</div>';
    }
    
    // Show frequency error details
    if (Object.keys(frequencyErrors).length > 0) {
        summaryHTML += '<div class="frequency-error-details">';
        summaryHTML += '<h4>⚠️ Frequency Errors:</h4>';
        summaryHTML += '<ul>';
        Object.entries(frequencyErrors).forEach(([freq, errors]) => {
            if (errors && errors.length > 0) {
                const latestError = errors[errors.length - 1];
                summaryHTML += `<li>${freq} MHz: ${errors.length} error(s) - ${latestError.error}</li>`;
            }
        });
        summaryHTML += '</ul>';
        summaryHTML += '</div>';
    }
    
    summaryHTML += '<div class="error-summary-actions">';
    summaryHTML += '<button id="clearErrorSummary" class="dismiss-error-btn">✕ Dismiss</button>';
    summaryHTML += '<button id="restartWithoutErrors" class="retry-btn">🔄 Restart Without Problem Frequencies</button>';
    summaryHTML += '</div>';
    summaryHTML += '</div>';
    
    summaryPanel.innerHTML = summaryHTML;
    
    // Insert after the status message
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.parentNode.insertBefore(summaryPanel, statusMessage.nextSibling);
    
    // Add event listeners
    document.getElementById('clearErrorSummary').onclick = () => summaryPanel.remove();
    document.getElementById('restartWithoutErrors').onclick = () => {
        removeBlacklistedFrequencies(blacklistedFrequencies);
        summaryPanel.remove();
    };
    
    // Auto-remove after 2 minutes
    setTimeout(() => {
        if (summaryPanel.parentNode) {
            summaryPanel.remove();
        }
    }, 120000);
}

function removeBlacklistedFrequencies(blacklistedFrequencies) {
    if (!blacklistedFrequencies || blacklistedFrequencies.length === 0) return;
    
    blacklistedFrequencies.forEach(freqStr => {
        const freqMHz = parseFloat(freqStr);
        removeFrequencyFromInputs(freqMHz);
    });
    
    showStatus(`Removed ${blacklistedFrequencies.length} problematic frequencies from the list`, 'success');
}

function removeFrequencyFromInputs(targetFreqMHz) {
    const frequencyInputs = document.querySelectorAll('input[id^="frequencyInput"]');
    frequencyInputs.forEach(input => {
        const value = parseFloat(input.value);
        const unit = input.parentElement?.querySelector('select')?.value || 'MHz';
        
        let valueInMHz = value;
        if (unit === 'GHz') valueInMHz = value * 1000;
        if (unit === 'kHz') valueInMHz = value / 1000;
        
        if (Math.abs(valueInMHz - targetFreqMHz) < 0.001) {
            const container = input.closest('.frequency-item');
            if (container && container.id !== 'frequencyItem1') {
                // Don't remove the first frequency input, just clear it
                container.remove();
                // updateRemoveButtons(); // Commented out to prevent duplicate remove buttons
                updateAddButtonState();
            } else if (container && container.id === 'frequencyItem1') {
                // Clear the first input but keep the container
                input.value = '';
                const unitSelect = container.querySelector('select');
                if (unitSelect) unitSelect.value = 'MHz';
            }
        }
    });
}

// Retry operation handlers for cycling errors
function handleRetryOperation(errorContext, contextData) {
    trackOperation('User initiated retry operation', { 
        source: 'error_retry',
        errorContext: errorContext,
        frequency: contextData?.frequency,
        errorType: contextData?.errorType
    });
    
    showStatus('🔄 Retrying operation...', 'info');
    
    // Wait a moment for system to stabilize, then retry
    setTimeout(() => {
        if (errorContext === 'cycling_error' || errorContext === 'frequency_error') {
            // For cycling errors, attempt to restart the sweep
            startSweep({ source: 'error_retry' });
        } else if (errorContext === 'stuck_recovery') {
            // For stuck recovery, try to force a clean restart
            stopSweep().then(() => {
                setTimeout(() => {
                    startSweep({ source: 'stuck_recovery_retry' });
                }, 2000);
            });
        } else {
            // Generic retry - attempt to restart sweep
            startSweep({ source: 'generic_retry' });
        }
    }, 1000);
}

function handleRestartSweep(contextData) {
    trackOperation('User initiated sweep restart from error', { 
        source: 'error_restart',
        frequency: contextData?.frequency,
        errorType: contextData?.errorType
    });
    
    showStatus('🚀 Restarting sweep operation...', 'info');
    
    // Ensure clean state before restart
    if (isScanning) {
        stopSweep().then(() => {
            setTimeout(() => {
                startSweep({ source: 'error_restart' });
            }, 2000);
        });
    } else {
        startSweep({ source: 'error_restart' });
    }
}

// General error recovery message generator
function getGeneralErrorRecovery(errorType, __data) {
    switch (errorType) {
        case 'hackrf_not_found':
            return 'Check that your HackRF device is connected via USB and not being used by another application.';
        case 'hackrf_device_error':
        case 'device_error':
            return 'Try disconnecting and reconnecting your HackRF device. Make sure it has adequate power supply.';
        case 'invalid_frequency':
            return 'Verify that all frequencies are within the valid range (1 MHz - 6 GHz) and properly formatted.';
        case 'sweep_startup_failed':
            return 'Check HackRF connection and frequency settings. Try restarting the sweep operation.';
        case 'connection_error':
            return 'Server connection lost. Check that the backend service is running and try refreshing the page.';
        default:
            return 'Try restarting the operation. If the problem persists, check the HackRF connection and frequency settings.';
    }
}

// Determine if an error is retryable
function isRetryableError(errorType) {
    const nonRetryableErrors = [
        'hackrf_not_found',
        'invalid_frequency',
        'configuration_error'
    ];
    return !nonRetryableErrors.includes(errorType);
}

// Enhanced error logging with comprehensive context tracking
function logError(context, error, additionalInfo = {}) {
    const callStack = getCallStack();
    const errorInfo = {
        timestamp: new Date().toISOString(),
        context: context,
        error: {
            message: error.message,
            name: error.name,
            stack: error.stack
        },
        applicationState: {
            isScanning,
            isCycling,
            connectionStatus,
            sseConnectionActive,
            currentFrequencyIndex
        },
        callStack: callStack.slice(0, 10),
        recentOperations: window.recentOperations?.slice(0, 5) || [],
        lastSyncTime: window.lastStateSyncTime || 'Never',
        ...additionalInfo
    };
    
    console.error('Enhanced error log:', errorInfo);
    
    // Track error in recent operations with enhanced context
    trackOperation(`ERROR in ${context}: ${error.message}`, {
        source: 'error_log',
        errorType: error.name,
        callStack: callStack.slice(0, 3),
        recovery: additionalInfo.recovery || 'No recovery info provided'
    });
    
    // Store last error context for debugging
    window.lastErrorContext = {
        context,
        timestamp: new Date().toISOString(),
        errorInfo
    };
    
    // Store error history for debugging
    if (!window.errorHistory) window.errorHistory = [];
    window.errorHistory.unshift({
        timestamp: new Date().toISOString(),
        context,
        error: error.message,
        stack: callStack.slice(0, 5)
    });
    if (window.errorHistory.length > 20) {
        window.errorHistory.pop();
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (isScanning) {
        stopSweep();
    }
});

// Handle online/offline events
window.addEventListener('online', () => {
    showStatus('Internet connection restored', 'success');
    if (!isScanning) {
        performHealthCheck();
    }
});

window.addEventListener('offline', () => {
    showStatus('Internet connection lost', 'warning');
    connectionStatus = 'disconnected';
    updateConnectionStatus();
});


// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Escape key to stop sweep (regular stop)
    if (event.key === 'Escape' && isScanning) {
        event.preventDefault();
        stopSweep(false);
    }
});

// Toggle debug mode - removed
function __toggleDebugMode() {
    // Debug mode toggle removed
}

// Proactive State Validation and Health Check Functions

/**
 * Perform startup health check to verify clean initial state
 */
async function performStartupHealthCheck() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/startup-health`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.startupCheck.cleanState) {
                logInfo('✅ Startup health check passed - clean state verified');
            } else {
                console.warn('⚠️ Startup health check detected issues:', data.startupCheck.issues);
                showStatus('Startup health check detected issues - see console for details', 'warning');
            }
            
            return data.startupCheck;
        } else {
            console.warn('⚠️ Startup health check endpoint failed');
            return { cleanState: false, issues: ['Health check endpoint failed'] };
        }
    } catch (error) {
        console.warn('⚠️ Startup health check error:', error.message);
        return { cleanState: false, issues: [`Health check error: ${error.message}`] };
    }
}

/**
 * Start proactive state validation monitoring
 */
function startProactiveStateValidation() {
    // Run state validation every 2 minutes for proactive monitoring
    setInterval(async () => {
        if (connectionStatus === 'connected') {
            await performProactiveStateValidation();
        }
    }, 120000); // 2 minutes
    
    // Run a quick validation check every 30 seconds during active operations
    setInterval(async () => {
        if (connectionStatus === 'connected' && isScanning) {
            await performQuickStateValidation();
        }
    }, 30000); // 30 seconds
}

/**
 * Perform comprehensive proactive state validation
 */
async function performProactiveStateValidation() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/state-validation`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Check validation results
            if (!data.validation.valid) {
                console.warn('⚠️ Proactive state validation detected issues:', data.validation.issues);
                
                // Show user-friendly warning for serious issues
                const seriousIssues = data.validation.issues.filter(issue => 
                    issue.includes('State incoherence') || 
                    issue.includes('orphaned') ||
                    issue.includes('stale')
                );
                
                if (seriousIssues.length > 0) {
                    showStatus('System health check detected issues - automatic cleanup in progress', 'warning');
                }
            }
            
            // Check split-brain detection
            if (data.splitBrainCheck.detected) {
                console.warn('⚠️ Split-brain condition detected:', data.splitBrainCheck.issues);
                showStatus('Split-brain condition detected - attempting automatic resolution', 'warning');
                
                // Trigger synchronization to help resolve split-brain
                setTimeout(() => {
                    synchronizeWithServerState('split_brain_resolution');
                }, 2000);
            }
            
            return data;
        } else {
            console.warn('⚠️ State validation endpoint failed');
            return null;
        }
    } catch (error) {
        // Don't show errors to user for proactive checks - they're background operations
        console.debug('State validation check failed (non-critical):', error.message);
        return null;
    }
}

/**
 * Perform quick state validation during active operations
 */
async function performQuickStateValidation() {
    try {
        // Quick check: verify current server state matches UI state
        const response = await fetch(`${API_BASE_URL}/cycle-status`, {
            method: 'GET',
            timeout: 3000
        });
        
        if (response.ok) {
            const serverState = await response.json();
            
            // Check for obvious mismatches
            const serverIsActive = Boolean(serverState.isRunning || serverState.isActive);
            
            if (serverIsActive !== isScanning) {
                console.warn('⚠️ Quick validation detected state mismatch - triggering sync');
                
                // Trigger immediate synchronization
                synchronizeWithServerState('quick_validation_mismatch');
            }
        }
    } catch (error) {
        // Silent failure for quick checks - don't disturb user experience
        console.debug('Quick state validation failed (non-critical):', error.message);
    }
}

/**
 * Enhanced health check with validation reporting
 */
async function __performEnhancedHealthCheck() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update connection status based on health check
            connectionStatus = data.status === 'ok' ? 'connected' : 'warning';
            updateConnectionStatus();
            
            // Report any state validation issues
            if (data.stateValidation && !data.stateValidation.valid) {
                console.warn('🔍 Health check detected state validation issues:', data.stateValidation.issues);
            }
            
            // Report split-brain detection
            if (data.splitBrainCheck && data.splitBrainCheck.detected) {
                console.warn('🔍 Health check detected split-brain conditions:', data.splitBrainCheck.issues);
            }
            
            // Report hardware issues
            if (data.hardware && data.hardware.hackrfError) {
                console.warn('🔍 Hardware issue detected:', data.hardware.hackrfError);
            }
            
            return data;
        } else {
            connectionStatus = 'error';
            updateConnectionStatus();
            return null;
        }
    } catch {
        connectionStatus = 'disconnected';
        updateConnectionStatus();
        return null;
    }
}

// Note: performHealthCheck function is defined earlier in the file



/**
 * Format duration in milliseconds to a human-readable string
 */
function __formatDuration(ms) {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    } else {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
}

/**
 * Format frequency object to display string
 */
function __formatFrequency(frequency) {
    if (!frequency) return '--';
    
    if (typeof frequency === 'object') {
        return `${frequency.frequency} ${frequency.unit || 'MHz'}`;
    } else {
        return `${frequency} MHz`;
    }
}

/**
 * Capitalize first letter of a string
 */
function __capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

