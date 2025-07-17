# HackRF Emitter Backend

This directory contains the backend server and RF signal processing components for the HackRF Emitter system.

## Quick Start

### Using the Main Start Script (Recommended)
From the project root directory:
```bash
./start.sh
```

This will automatically:
- Set up the virtual environment
- Install all dependencies
- Start both backend and frontend services

### Manual Setup

1. **Activate Virtual Environment**
   ```bash
   source venv/bin/activate
   ```

2. **Install Dependencies** (if not already installed)
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Backend Server**
   ```bash
   python3 app.py
   ```

## Cache Initialization

The system uses a universal signal cache to pre-generate RF signals for instant transmission. You can initialize the cache using:

### Option 1: Using the Helper Script (Recommended)
```bash
./run_cache_init.sh
```

### Option 2: Manual Activation
```bash
source venv/bin/activate
python3 initialize_cache.py
```

### Force Regeneration
To regenerate all cached signals (useful after updates):
```bash
./run_cache_init.sh --force
```

## Directory Structure

- `app.py` - Main Flask application server
- `initialize_cache.py` - Cache initialization script
- `run_cache_init.sh` - Helper script for cache initialization
- `requirements.txt` - Python dependencies
- `rf_workflows/` - RF signal generation and processing modules
- `config/` - Configuration files
- `utils/` - Utility functions
- `signal_cache/` - Generated signal cache files
- `venv/` - Python virtual environment

## Troubleshooting

### Module Not Found Errors
If you encounter module import errors:
1. Make sure you're in the virtual environment: `source venv/bin/activate`
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Use the helper script: `./run_cache_init.sh`

Note: CRC16 is now implemented in pure Python (`rf_workflows/crc16_python.py`) - no external dependencies required.

### Virtual Environment Issues
If the virtual environment is corrupted:
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Development

The backend uses Flask with SocketIO for real-time communication and includes comprehensive RF signal generation capabilities for various protocols including ELRS, drone video jamming, and custom signal patterns. 