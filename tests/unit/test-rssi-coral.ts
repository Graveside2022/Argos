/**
 * Test script for RSSI Coral integration
 * Run with: npx tsx test-rssi-coral.ts
 */

import { HybridRSSILocalizer } from '../../src/lib/services/localization/hybrid-rssi-localizer';

async function testCoralIntegration() {
  console.log('🧪 Testing RSSI Coral Integration...\n');
  
  try {
    // Test 1: Initialize localizer
    console.log('1️⃣ Initializing Hybrid RSSI Localizer...');
    const localizer = new HybridRSSILocalizer();
    await localizer.initialize();
    console.log('✅ Localizer initialized successfully\n');
    
    // Test 2: Add mock measurements
    console.log('2️⃣ Adding mock RSSI measurements...');
    const mockDevice = 'AA:BB:CC:DD:EE:FF';
    const basePosition = { lat: 37.7749, lon: -122.4194 }; // San Francisco
    
    // Simulate drone moving in a circle
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * 2 * Math.PI;
      const radius = 0.001; // ~100m radius
      
      localizer.addMeasurement({
        id: `test-${i}`,
        timestamp: Date.now() + i * 1000,
        position: {
          lat: basePosition.lat + radius * Math.sin(angle),
          lon: basePosition.lon + radius * Math.cos(angle),
          altitude: 50,
          accuracy: 5
        },
        deviceId: mockDevice,
        rssi: -60 - Math.random() * 20, // -60 to -80 dBm
        frequency: 2437
      });
    }
    console.log('✅ Added 20 mock measurements\n');
    
    // Test 3: Generate prediction
    console.log('3️⃣ Generating RSSI prediction...');
    const bounds = {
      north: basePosition.lat + 0.002,
      south: basePosition.lat - 0.002,
      east: basePosition.lon + 0.002,
      west: basePosition.lon - 0.002
    };
    
    const startTime = Date.now();
    const prediction = await localizer.predictForDevice(mockDevice, bounds);
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Prediction generated in ${processingTime}ms`);
    console.log(`   Grid size: ${Math.sqrt(prediction.mean.length)}x${Math.sqrt(prediction.mean.length)}`);
    console.log(`   Mean RSSI range: ${Math.min(...prediction.mean).toFixed(1)} to ${Math.max(...prediction.mean).toFixed(1)} dBm\n`);
    
    // Test 4: Estimate device location
    console.log('4️⃣ Estimating device location...');
    const location = await localizer.estimateSourceLocation(mockDevice);
    console.log('✅ Estimated location:', {
      lat: location.position.lat.toFixed(6),
      lon: location.position.lon.toFixed(6),
      confidence: (location.confidence * 100).toFixed(1) + '%',
      uncertaintyRadius: location.uncertaintyRadius.toFixed(1) + 'm'
    });
    console.log('\n');
    
    // Test 5: Check performance stats
    console.log('5️⃣ Performance Statistics:');
    const stats = localizer.getStats();
    console.log(`   Coral TPU usage: ${(stats.coralUsage * 100).toFixed(1)}%`);
    console.log(`   Average processing time: ${stats.avgProcessingTime}ms`);
    
    // Cleanup
    await localizer.shutdown();
    console.log('\n✅ All tests passed! RSSI Coral integration is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCoralIntegration().catch(console.error);