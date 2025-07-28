// Debug script to test AirSignal component data flow

// Open browser console and run:
// 1. Check if spectrum data is being received
import { spectrumData } from '/src/lib/stores/usrp.js';
spectrumData.subscribe(data => {
    console.log('Spectrum data received in store:', data);
});

// 2. Click 2.4GHz filter button
document.querySelector('button[class*="freq-button"]').click();

// 3. Click RF Detection button  
document.querySelector('button[class*="rf-toggle-button"]').click();

// Look for console logs to see if data is reaching the component