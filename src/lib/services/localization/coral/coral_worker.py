#!/usr/bin/env python3
"""
Coral TPU Worker Process
Handles RSSI prediction requests using a pre-trained TFLite model
"""

import sys
import json
import time
import numpy as np
from typing import Dict, List, Tuple

# Note: These imports will work in the Python 3.9 environment
# For now, we'll create a mock version that can be replaced

try:
    from pycoral.utils import edgetpu
    from pycoral.adapters import common
    import tflite_runtime.interpreter as tflite
    CORAL_AVAILABLE = True
except ImportError:
    CORAL_AVAILABLE = False
    print(json.dumps({"type": "error", "error": "Coral libraries not available"}))

class MockCoralPredictor:
    """Mock predictor for testing without Coral libraries"""
    def __init__(self, model_path: str):
        self.model_path = model_path
        
    def predict(self, measurements: List[Dict], bounds: Dict, resolution: int) -> Dict:
        """Generate mock heatmap data"""
        # Create grid
        lat_range = bounds['north'] - bounds['south']
        lon_range = bounds['east'] - bounds['west']
        
        # Generate mock heatmap (normally this would use the TPU)
        heatmap = np.random.rand(resolution, resolution) * 100 - 100  # -100 to 0 dBm
        confidence = np.random.rand(resolution, resolution)
        
        # Simulate some structure based on measurements
        for m in measurements:
            # Convert lat/lon to grid coordinates
            y = int((m['lat'] - bounds['south']) / lat_range * resolution)
            x = int((m['lon'] - bounds['west']) / lon_range * resolution)
            
            if 0 <= y < resolution and 0 <= x < resolution:
                # Create a gaussian-like pattern around measurement
                for dy in range(-5, 6):
                    for dx in range(-5, 6):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < resolution and 0 <= nx < resolution:
                            dist = np.sqrt(dy**2 + dx**2)
                            if dist < 5:
                                heatmap[ny, nx] = max(heatmap[ny, nx], 
                                                     m['rssi'] - dist * 10)
                                confidence[ny, nx] = max(confidence[ny, nx], 
                                                       1.0 - dist / 5)
        
        return {
            'heatMap': heatmap.tolist(),
            'confidence': confidence.tolist(),
            'processingTime': 50  # Mock 50ms processing
        }

class CoralRSSIPredictor:
    """Real Coral TPU predictor"""
    def __init__(self, model_path: str):
        # Load model with Edge TPU delegate
        self.interpreter = edgetpu.make_interpreter(model_path)
        self.interpreter.allocate_tensors()
        
        # Get input/output details
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        
    def predict(self, measurements: List[Dict], bounds: Dict, resolution: int) -> Dict:
        """Run inference on Coral TPU"""
        start_time = time.time()
        
        # Prepare input tensor
        input_data = self._prepare_input(measurements, bounds, resolution)
        
        # Run inference
        self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
        self.interpreter.invoke()
        
        # Get output
        heatmap = self.interpreter.get_tensor(self.output_details[0]['index'])
        confidence = self.interpreter.get_tensor(self.output_details[1]['index'])
        
        processing_time = (time.time() - start_time) * 1000  # ms
        
        return {
            'heatMap': heatmap.squeeze().tolist(),
            'confidence': confidence.squeeze().tolist(),
            'processingTime': processing_time
        }
    
    def _prepare_input(self, measurements: List[Dict], bounds: Dict, 
                      resolution: int) -> np.ndarray:
        """Prepare input tensor from measurements"""
        # This is a simplified version - real implementation would
        # encode measurements into a fixed-size tensor
        # For now, create a tensor with measurement positions and RSSI values
        
        max_measurements = 100  # Model expects fixed size
        input_tensor = np.zeros((1, max_measurements, 4), dtype=np.float32)
        
        for i, m in enumerate(measurements[:max_measurements]):
            # Normalize coordinates to [0, 1]
            norm_lat = (m['lat'] - bounds['south']) / (bounds['north'] - bounds['south'])
            norm_lon = (m['lon'] - bounds['west']) / (bounds['east'] - bounds['west'])
            
            input_tensor[0, i, 0] = norm_lat
            input_tensor[0, i, 1] = norm_lon
            input_tensor[0, i, 2] = m['rssi'] / 100.0  # Normalize RSSI
            input_tensor[0, i, 3] = 1.0  # Valid measurement flag
        
        return input_tensor

def main():
    """Main worker loop"""
    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "error": "Model path required"}))
        sys.exit(1)
    
    model_path = sys.argv[1]
    
    # Check if model file exists
    import os
    if not os.path.exists(model_path):
        print(json.dumps({"type": "error", "error": f"Model file not found: {model_path}", "info": "Using mock predictor"}))
        # Continue with mock predictor instead of exiting
    
    # Initialize predictor (use mock if Coral not available)
    try:
        if CORAL_AVAILABLE:
            predictor = CoralRSSIPredictor(model_path)
        else:
            predictor = MockCoralPredictor(model_path)
        
        # Signal ready
        print(json.dumps({"type": "ready"}))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"type": "error", "error": str(e)}))
        sys.exit(1)
    
    # Process commands
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            command = json.loads(line.strip())
            
            if command['type'] == 'predict':
                try:
                    result = predictor.predict(
                        command['data']['measurements'],
                        command['data']['bounds'],
                        command['data'].get('resolution', 32)
                    )
                    
                    response = {
                        "type": "result",
                        "id": command['id'],
                        "data": result
                    }
                    print(json.dumps(response))
                    sys.stdout.flush()
                    
                except Exception as e:
                    error_response = {
                        "type": "error",
                        "id": command['id'],
                        "error": str(e)
                    }
                    print(json.dumps(error_response))
                    sys.stdout.flush()
                    
        except Exception as e:
            print(json.dumps({"type": "error", "error": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    main()