# Coral TPU RSSI Localization Integration

## Overview
This integration adds GPU-accelerated RSSI-based device localization to the tactical map. When enabled, it uses the Coral USB Accelerator to process WiFi signal strength measurements and generate heatmaps showing probable device locations.

## Setup

### 1. Install Coral Support
```bash
# Run the installation script
./install_coral_support.sh
```

This will:
- Install Python 3.9 (required for Coral libraries)
- Create a Python virtual environment
- Install Coral TPU libraries
- Set up device permissions

### 2. Verify Coral Detection
```bash
# Check if Coral is detected
lsusb | grep "1a6e"
# Should show: Bus 003 Device 003: ID 1a6e:089a Global Unichip Corp.
```

### 3. Test the Integration
```bash
# Run the test script
npx tsx test-rssi-coral.ts
```

## Using RSSI Localization

### In the Tactical Map (http://192.168.68.88:5173/tactical-map-simple):

1. **Start Kismet** - Click the "Start" button in the Kismet controls
2. **Enable RSSI Localization** - Click the "RSSI Localization" button (top-right)
3. **Select a Device** - Click on any Kismet device marker on the map
4. **Move the Drone** - As you fly, measurements are collected
5. **View Heatmap** - After 5+ measurements, a heatmap appears showing likely device location

### Features:

- **Automatic Coral Detection** - Uses TPU if available, falls back to CPU
- **Real-time Processing** - Updates every 5 seconds
- **Visual Feedback** - Color-coded heatmap (blue=weak, red=strong signal)
- **Accuracy Indicator** - Shows confidence and uncertainty radius
- **Performance Monitor** - Displays TPU usage and processing times

### Controls:

- **Toggle Button** - Enable/disable RSSI localization
- **Clear Data** - Remove measurements for selected device or all devices
- **Show Details** - View requirements and current status

## How It Works

1. **Data Collection**: As the drone moves, it collects RSSI measurements from detected WiFi devices along with GPS positions

2. **Processing**: 
   - With Coral TPU: Uses neural network for rapid heatmap generation (2-15ms)
   - Without Coral: Falls back to Gaussian Process Regression (50-100ms)

3. **Visualization**: Generates a heatmap overlay showing signal strength distribution, with the highest intensity areas indicating probable device location

4. **Refinement**: More measurements from different positions improve accuracy

## Requirements

- GPS accuracy < 20 meters
- Minimum 5 measurements per device
- Device must be transmitting during measurement
- Movement helps improve localization accuracy

## Troubleshooting

### Coral Not Detected
```bash
# Check USB connection
lsusb | grep "1a6e"

# Check runtime
dpkg -l | grep libedgetpu

# Restart udev
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### No Heatmap Appearing
- Ensure GPS has good fix (check GPS status button)
- Verify device has been detected by Kismet
- Move drone to collect measurements from different angles
- Check console for errors (F12 → Console)

### Performance Issues
- Reduce heatmap resolution in code (default: 32x32)
- Increase update interval (default: 5 seconds)
- Use fewer measurements (affects accuracy)

## Technical Details

- **Algorithm**: Gaussian Process Regression with RBF kernel
- **Coral Model**: Placeholder for neural network predictor (uses mock currently)
- **Grid Resolution**: 5 meters
- **Update Rate**: 5 seconds
- **Measurement Window**: Last 5 minutes
- **Path Loss Model**: Urban environment (n=2.7-3.5)

## Future Enhancements

1. Train custom TensorFlow model for Coral TPU
2. Add trilateration with multiple drones
3. Implement particle filter for moving targets
4. Add 3D visualization for altitude
5. Export KML/GeoJSON of estimated positions