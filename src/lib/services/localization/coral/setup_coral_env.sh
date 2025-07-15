#!/bin/bash
# Setup script for Coral TPU Python environment

echo "Setting up Coral TPU Python 3.9 environment..."

# Install Python 3.9 if not present
if ! command -v python3.9 &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y python3.9 python3.9-venv python3.9-dev
fi

# Create virtual environment
python3.9 -m venv /home/ubuntu/projects/Argos/.coral_env

# Activate and install packages
source /home/ubuntu/projects/Argos/.coral_env/bin/activate
pip install --upgrade pip
pip install --extra-index-url https://google-coral.github.io/py-repo/ tflite_runtime
pip install pycoral numpy pillow

echo "Coral environment setup complete!"
echo "Activate with: source /home/ubuntu/projects/Argos/.coral_env/bin/activate"