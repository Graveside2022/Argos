# HackRF Emitter Project

A professional RF signal generation platform with a web interface for controlling HackRF devices. This system provides access to RF signal generation capabilities across the full HackRF frequency range for RF research, testing, and educational purposes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 16+](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)

## 🚀 Key Features

### Core Capabilities
- **Web Interface**: React-based UI with real-time control and monitoring
- **Full Control**: Parameter control without limitations
- **Multi-Protocol Support**: Library of RF protocols and modulations
- **Instant Transmission**: Universal signal cache for zero-delay RF transmission
- **Precision Control**: Parameter adjustment for all signal types
- **Visual Feedback**: Real-time status monitoring and signal visualization
- **Signal Caching**: Pre-generated signals for instant HackRF activation

### Supported RF Protocols & Modulations

#### **Basic Modulations**
- **Analog**: AM, FM, PM, SSB modulation
- **Digital**: ASK, FSK, PSK, QAM variants
- **Custom**: Arbitrary waveform generation

#### **Drone & RC Protocols**
- **ExpressLRS**: 433MHz, 915MHz, 2.4GHz with realistic packet generation
- **Enhanced ELRS**: Multi-channel hopping, flight mode simulation
- **RC Control**: PWM, PPM, SBUS signal generation

#### **Navigation & GNSS**
- **GPS Constellation**: L1, L2, L5 band simulation
- **Multi-Satellite**: Realistic satellite constellation with Doppler effects
- **Navigation Data**: Authentic ephemeris and almanac data

#### **Aviation & Marine**
- **ADS-B**: Mode S Extended Squitter simulation
- **AIS**: Marine vessel tracking signals
- **Airspace Simulation**: Multi-aircraft dynamic scenarios

#### **Advanced Protocols**
- **Frequency Hopping**: Configurable patterns and timings
- **Radar Simulation**: Various radar types with realistic parameters
- **Raw Energy**: Wideband noise generation for testing
- **Custom Digital**: User-defined protocols and data patterns

### Instant Transmission Technology
With the **Universal Signal Cache**, signals are pre-generated and ready for instant transmission:
- **Zero Generation Delay**: No waiting for signal computation
- **Instant HackRF Activation**: LED turns RED immediately
- **Consistent Performance**: Same response for all protocols
- **Background Initialization**: Cache builds automatically on first run

### User Experience
- **Design**: Modern, responsive interface with dark/light themes
- **Search**: Filtering and categorization of workflows
- **Mobile Friendly**: Responsive design works on all devices
- **Parameter Validation**: Input validation with helpful hints
- **Emergency Controls**: Instant transmission stop capabilities
- **Progress Tracking**: Real-time transmission status and timing

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    WebSocket    ┌─────────────────┐    USB/SPI    ┌─────────────────┐
│   React Frontend│◄──────────────► │  Flask Backend  │◄─────────────►│   HackRF Device │
│                 │    REST API     │                 │               │                 │
│  • Workflows UI │                 │ • RF Workflows  │               │ • Signal Output │
│  • Real-time    │                 │ • Device Control│               │ • 1MHz - 6GHz   │
│    Monitoring   │                 │ • Signal Gen    │               │ • Up to 20 MS/s │
│  • Parameter    │                 │ • Safety Mgmt   │               │                 │
│    Control      │                 │                 │               │                 │
└─────────────────┘                 └─────────────────┘               └─────────────────┘
```

### Universal Signal Cache System

The HackRF Emitter features a **Universal Signal Cache** system that pre-generates RF signals on first startup, enabling instant transmission with zero generation delay.

#### Key Benefits
- **Instant LED Response**: HackRF LED turns RED immediately upon transmission start
- **Zero Latency**: Pre-cached signals eliminate computation delays
- **Smart Storage**: ~500+ pre-generated signals covering all protocols
- **Automatic Management**: Cache initializes in background on first run
- **Efficient Retrieval**: < 0.1 second signal loading time

#### How It Works
1. **First Launch**: System pre-generates all possible signal configurations
2. **Smart Caching**: Signals stored in optimized binary format
3. **Instant Access**: When you trigger any workflow, the pre-generated signal loads instantly
4. **Memory Efficient**: Only active signals are loaded into memory

#### Cache Contents
- **ELRS Protocols**: All bands (433/868/915/2400 MHz) with all packet rates
- **GPS Signals**: L1, L2, L5 bands with multi-satellite constellations  
- **ADS-B**: Multiple aircraft scenarios
- **Jamming Signals**: Wideband noise for all supported frequencies
- **Raw Energy**: Pre-generated for all frequency/bandwidth combinations
- **Basic Modulations**: Sine waves, FM, AM signals

### Project Structure
```
hackrf_emitter/
├── 📁 backend/                    # Python Flask API Server
│   ├── 🐍 app.py                 # Main Flask application & WebSocket handlers
│   ├── 📁 rf_workflows/          # RF signal generation modules
│   │   ├── hackrf_controller.py  # HackRF device interface
│   │   ├── modulation_workflows.py # Basic modulation workflows
│   │   ├── enhanced_workflows.py # Advanced protocol implementations
│   │   ├── universal_signal_cache.py # Universal signal caching system
│   │   └── protocols/            # Protocol-specific implementations
│   │       ├── elrs_protocol.py  # ExpressLRS implementation
│   │       ├── gps_protocol.py   # GPS/GNSS simulation
│   │       ├── adsb_protocol.py  # ADS-B Mode S implementation
│   │       └── raw_energy.py     # Raw signal generation
│   ├── 📁 utils/                 # Utility modules
│   │   ├── config_manager.py     # Configuration management
│   │   ├── safety_manager.py     # Safety validation (disabled)
│   │   └── signal_processing.py  # DSP utilities
│   ├── 📁 config/               # Configuration files
│   │   └── settings.json        # System configuration
│   ├── 📁 signal_cache/         # Pre-generated RF signals (auto-created)
│   ├── 🔧 initialize_cache.py   # Cache initialization script
│   ├── 🔧 run_cache_init.sh     # Helper script for cache initialization
│   └── 📄 requirements.txt      # Python dependencies
├── 📁 frontend/                  # React TypeScript UI
│   ├── 📁 src/
│   │   ├── 📁 components/       # Reusable React components
│   │   │   ├── WorkflowForm.tsx # Parameter configuration form
│   │   │   ├── DeviceStatus.tsx # HackRF device status display
│   │   │   └── SignalMonitor.tsx # Real-time signal monitoring
│   │   ├── 📁 pages/           # Main application pages
│   │   │   ├── Dashboard.tsx    # Main control dashboard
│   │   │   ├── Workflows.tsx    # Workflow selection & management
│   │   │   ├── DeviceInfo.tsx   # Device information & diagnostics
│   │   │   └── Settings.tsx     # System configuration
│   │   ├── 📁 services/        # API communication
│   │   │   └── api.ts          # REST API & WebSocket client
│   │   ├── 📁 contexts/        # React contexts
│   │   │   └── SocketContext.tsx # WebSocket state management
│   │   └── 📁 types/           # TypeScript type definitions
│   ├── 📄 package.json         # Node.js dependencies
│   └── 📄 tailwind.config.js   # Styling configuration
├── 📁 docs/                     # Documentation
│   ├── API.md                  # API documentation
│   ├── PROTOCOLS.md            # Protocol implementation details
│   └── TROUBLESHOOTING.md      # Common issues & solutions
├── 🔧 start.sh                 # Quick start script
├── 🧪 test_universal_cache.py  # Cache testing script
├── ⚙️ docker-compose.yml       # Docker deployment configuration
└── 📄 README.md               # This file
```

## 🔧 Installation & Setup

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, Windows with WSL2
- **Python**: 3.8 or higher
- **Node.js**: 16.0 or higher
- **Hardware**: HackRF One device (optional for simulation mode)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 4GB free space (2GB for cache, 2GB for application)

### Quick Start (Recommended)
```bash
# Clone the repository
git clone https://jaw1999/hackrf_emitter.git
cd hackrf_emitter

# Make start script executable and run
chmod +x start.sh
./start.sh
```

The start script will automatically:
- Check system dependencies
- Set up Python virtual environment
- Install backend dependencies
- Install frontend dependencies
- Initialize universal signal cache (first run only)
- Start both services
- Open the web interface

### Manual Installation

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Optional: Install HackRF tools for hardware support
sudo apt-get install hackrf  # On Ubuntu/Debian
# or
brew install hackrf         # On macOS with Homebrew
```

#### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Optional: Install additional development tools
npm install -g typescript @types/node
```

#### 3. Initialize Signal Cache (Recommended)
```bash
# Navigate to backend directory
cd backend

# Option 1: Using the helper script (Recommended)
./run_cache_init.sh

# Option 2: Manual activation
source venv/bin/activate
python3 initialize_cache.py

# This pre-generates all signals (takes 3-5 minutes)
# Progress will be displayed during generation
```

#### 4. HackRF Device Setup (Optional)
```bash
# Test HackRF connection
hackrf_info

# Update firmware if needed
hackrf_spiflash -w hackrf_one_usb.bin

# Set up udev rules for non-root access (Linux)
sudo usermod -a -G plugdev $USER
```

## 🚀 Usage

### Starting the System

#### Option 1: Quick Start Script
```bash
./start.sh
```

#### Option 2: Manual Start
```bash
# Terminal 1: Start Backend
cd backend
source venv/bin/activate
python app.py

# Terminal 2: Start Frontend
cd frontend
npm start
```

### Accessing the Interface
- **Web UI**: http://localhost:3000
- **API Endpoint**: http://localhost:5000
- **WebSocket**: ws://localhost:5000

### Basic Workflow
1. **Connect Hardware**: Ensure HackRF is connected (or use simulation mode)
2. **Open Web Interface**: Navigate to http://localhost:3000
3. **Select Workflow**: Choose from the categorized workflow library
4. **Configure Parameters**: Set frequency, power, duration, and protocol-specific settings
5. **Start Transmission**: Click "Configure & Launch" to begin instant signal generation
6. **Monitor Status**: Watch real-time status and use emergency stop if needed

### Cache Management

#### Check Cache Status
```bash
cd backend
python -c "from rf_workflows.universal_signal_cache import get_universal_cache; cache = get_universal_cache(); print(cache.get_cache_status())"
```

#### Regenerate All Signals
```bash
cd backend

# Option 1: Using the helper script (Recommended)
./run_cache_init.sh --force

# Option 2: Manual activation
source venv/bin/activate
python3 initialize_cache.py --force
```

#### Test Cache Performance
```bash
python test_universal_cache.py
```

#### Clear Cache (if needed)
```bash
rm -rf backend/signal_cache/
```

### Example Workflows

#### Basic FM Transmission
```
Workflow: FM Modulation
Frequency: 100.0 MHz
Modulation Frequency: 1000 Hz
Modulation Depth: 1.0 kHz
Duration: 30 seconds
```

#### ExpressLRS Simulation
```
Workflow: ELRS 2.4GHz Enhanced
Frequency: 2400.0 MHz
Channel: 5
Packet Rate: 150 Hz
Flight Mode: Manual
Duration: 60 seconds
```

#### GPS L1 Constellation
```
Workflow: GPS L1 Constellation
Frequency: 1575.42 MHz
Satellite Count: 8
Navigation Data: Enabled
Duration: 300 seconds
```

## ⚙️ Configuration

### Backend Configuration
The system uses `backend/config/settings.json` for configuration:

```json
{
  "device_settings": {
    "default_sample_rate": 2000000,
    "default_gain": 10,
    "max_gain": 100,
    "min_gain": -100
  },
  "safety_settings": {
    "max_power_dbm": 100,
    "restricted_frequencies": []
  }
}
```

### Cache Configuration
The universal signal cache stores pre-generated signals in:
- **Location**: `backend/signal_cache/`
- **Size**: ~1-2 GB (depending on configurations)
- **Files**: 500+ pre-generated RF signals
- **Format**: Optimized 8-bit I/Q binary format

### Environment Variables
```bash
# Optional environment variables
export HACKRF_DEVICE_INDEX=0        # HackRF device index
export RF_EMITTER_DEBUG=1           # Enable debug logging
export RF_EMITTER_SIMULATION=1      # Force simulation mode
export RF_EMITTER_PORT=5000         # Backend port
export RF_EMITTER_FRONTEND_PORT=3000 # Frontend port
export RF_EMITTER_CACHE_DIR=/path/to/cache # Custom cache directory
```

## 🔌 API Reference

### REST Endpoints

#### System Status
```http
GET /api/status
```
Returns current system and device status.

#### Available Workflows
```http
GET /api/workflows
```
Returns list of all available RF workflows with parameters.

#### Start Workflow
```http
POST /api/start_workflow
Content-Type: application/json

{
  "workflow": "fm_modulation",
  "parameters": {
    "carrier_freq": 100000000,
    "mod_freq": 1000,
    "mod_depth": 1.0,
    "duration": 10
  }
}
```

#### Stop Transmission
```http
POST /api/stop_workflow
```
Immediately stops current transmission.

#### Safety Limits
```http
GET /api/safety_limits
```
Returns current safety limits and restrictions (informational).

### WebSocket Events

#### Connection
```javascript
const socket = io('http://localhost:5000');
```

#### Status Updates
```javascript
socket.on('workflow_status', (data) => {
  console.log('Status:', data.status);
  console.log('Workflow:', data.workflow);
});
```

#### Error Handling
```javascript
socket.on('workflow_error', (data) => {
  console.error('Error:', data.error);
});
```

## 🐳 Docker Deployment

### Using Docker Compose
```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build
```bash
# Build backend image
docker build -t hackrf-emitter-backend ./backend

# Build frontend image
docker build -t hackrf-emitter-frontend ./frontend

# Run with docker run
docker run -d -p 5000:5000 --device=/dev/bus/usb hackrf-emitter-backend
docker run -d -p 3000:3000 hackrf-emitter-frontend
```

## 🔍 Troubleshooting

### Common Issues

#### HackRF Not Detected
```bash
# Check USB connection
lsusb | grep HackRF

# Check permissions
ls -l /dev/bus/usb/

# Reset device
hackrf_transfer -r /dev/null -s 1000000 -n 1000
```

#### Permission Denied
```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Logout and login again
```

#### Module Import Errors
```bash
# Ensure virtual environment is activated
source backend/venv/bin/activate

# Reinstall dependencies
pip install -r backend/requirements.txt

# If you encounter "No module named 'crc16'" or similar errors:
# Use the helper script which automatically activates the virtual environment
cd backend
./run_cache_init.sh
```

#### Frontend Build Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf frontend/node_modules
cd frontend && npm install
```

### Performance Optimization

#### High CPU Usage
- Reduce sample rate for less demanding applications
- Use simulation mode for development
- Close unnecessary browser tabs

#### Memory Issues
- Limit transmission duration for long-running workflows
- Monitor system resources during operation
- Use appropriate buffer sizes

#### Slow Transmission Start
- Ensure signal cache is initialized: `cd backend && ./run_cache_init.sh`
- Check cache status: `python test_universal_cache.py`
- Verify cache directory has sufficient space (needs ~2GB)
- Cache regeneration may be needed if signals were deleted

#### Cache Issues
```bash
# If cache is corrupted or incomplete
cd backend
rm -rf signal_cache/
./run_cache_init.sh

# If disk space is limited, remove unused signals
# Cache will regenerate them on demand
```

## 🛡️ Safety & Legal Information

### Important Disclaimers
⚠️ **CRITICAL**: This software provides unrestricted access to RF signal generation capabilities. Users are **entirely responsible** for:

- **Legal Compliance**: Ensuring all transmissions comply with local and international RF regulations
- **Frequency Authorization**: Verifying you have legal authority to transmit on chosen frequencies
- **Power Limitations**: Adhering to regional power limits and exposure standards
- **Interference Prevention**: Avoiding interference with critical services and other users
- **Equipment Safety**: Using appropriate antennas and RF safety practices

### Best Practices
- **Always** verify regulatory compliance before transmission
- **Never** transmit on emergency, aviation, or marine safety frequencies
- **Use appropriate RF safety measures** including proper antennas and power levels
- **Test in RF-shielded environments** when possible
- **Document all testing activities** for regulatory purposes
- **Keep transmission durations reasonable** to minimize spectrum impact

### Educational Use
This project is designed for:
- **RF Education**: Learning RF principles and signal processing
- **Research**: Academic and commercial RF research projects
- **Testing**: Equipment testing in controlled environments
- **Development**: Creating and testing new RF protocols

