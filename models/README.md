# RSSI Prediction Models

Place your compiled Edge TPU models here with .tflite extension.

To create a model:
1. Train a TensorFlow model for RSSI heatmap prediction
2. Convert to TFLite with quantization
3. Compile for Edge TPU using edgetpu_compiler

For testing, the system will use the mock predictor if no model is found.
