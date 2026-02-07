#!/bin/bash
# Simplified Coral TPU setup for LAN deployment
# No security concerns, just get it working!

set -e

echo "[START] Installing Coral TPU Support for RSSI Localization"

# 1. Install Python 3.9 (required for Coral libraries)
echo "[PKG] Installing Python 3.9..."
sudo apt-get update
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.9 python3.9-venv python3.9-dev

# 2. Create Coral virtual environment
echo "[PYTHON] Creating Python environment for Coral..."
python3.9 -m venv /home/ubuntu/projects/Argos/.coral_env

# 3. Install Coral libraries
echo "[LIB] Installing Coral libraries..."
source /home/ubuntu/projects/Argos/.coral_env/bin/activate
pip install --upgrade pip wheel
pip install numpy pillow
pip install --extra-index-url https://google-coral.github.io/py-repo/ pycoral~=2.0 tflite-runtime~=2.5

# 4. Set up udev rules for non-root access
echo "[CONFIG] Setting up device permissions..."
sudo bash -c 'echo "SUBSYSTEM==\"usb\", ATTRS{idVendor}==\"1a6e\", MODE=\"0666\"" > /etc/udev/rules.d/99-coral.rules'
sudo udevadm control --reload-rules && sudo udevadm trigger

# 5. Create model directory
echo "[FILE] Creating model directory..."
mkdir -p /home/ubuntu/projects/Argos/models

# 6. Create a simple test model (placeholder)
echo "[AI] Creating placeholder model..."
cat > /home/ubuntu/projects/Argos/models/README.md << 'EOF'
# RSSI Prediction Models

Place your compiled Edge TPU models here with .tflite extension.

To create a model:
1. Train a TensorFlow model for RSSI heatmap prediction
2. Convert to TFLite with quantization
3. Compile for Edge TPU using edgetpu_compiler

For testing, the system will use the mock predictor if no model is found.
EOF

# 7. Test the installation
echo "[TEST] Testing Coral setup..."
source /home/ubuntu/projects/Argos/.coral_env/bin/activate
python3 -c "import pycoral; import tflite_runtime; print('[OK] Coral libraries installed successfully')"

# 8. Create systemd service (optional, for production)
echo "[INFO] Creating systemd service template..."
cat > /home/ubuntu/projects/Argos/coral-worker.service << 'EOF'
[Unit]
Description=Coral TPU Worker for RSSI Localization
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/projects/Argos
Environment="PATH=/home/ubuntu/projects/Argos/.coral_env/bin"
ExecStart=/home/ubuntu/projects/Argos/.coral_env/bin/python /home/ubuntu/projects/Argos/src/lib/services/localization/coral/coral_worker.py /home/ubuntu/projects/Argos/models/rssi_predictor.tflite
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "[OK] Coral TPU support installed!"
echo ""
echo "Next steps:"
echo "1. Plug in your Coral USB Accelerator"
echo "2. Run: lsusb | grep '1a6e' to verify detection"
echo "3. Place your .tflite model in /home/ubuntu/projects/Argos/models/"
echo "4. The system will automatically use Coral when available"
echo ""
echo "To use the systemd service:"
echo "sudo cp coral-worker.service /etc/systemd/system/"
echo "sudo systemctl enable coral-worker"
echo "sudo systemctl start coral-worker"