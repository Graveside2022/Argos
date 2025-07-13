# Argos - Professional SDR & Network Analysis Console

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

Argos is a comprehensive web-based control center for Software Defined Radio (SDR) operations, WiFi network scanning, and GPS tracking with Team Awareness Kit (TAK) integration. Built for professional defense and research applications.

## 🚀 Key Features

- **Real-time Spectrum Analysis** - Live RF monitoring with HackRF integration
- **WiFi Network Intelligence** - Kismet-based wireless reconnaissance  
- **GPS Tracking & TAK Integration** - Tactical awareness and mapping
- **WebSocket Real-time Streaming** - Live data feeds
- **Responsive Professional Interface** - Desktop and mobile ready
- **Full TypeScript Implementation** - Enterprise-grade reliability

## ⚡ One-Click Professional Installation

**For Raspberry Pi or Debian/Ubuntu systems:**

```bash
cd && curl -sSL https://raw.githubusercontent.com/Graveside2022/Argos/main/quick-install.sh | bash
```

This single command provides a **complete professional installation**:

✅ **Automatic Setup**: Creates `/projects/Argos` directory structure  
✅ **Full Dependencies**: Installs Node.js, Docker, Git, and system tools  
✅ **HackRF Integration**: Downloads and configures HackRF Docker container  
✅ **Service Management**: Configures systemd services for auto-startup  
✅ **Security Configuration**: Sets up firewall and access controls  
✅ **Professional Monitoring**: Installs CPU protection and process management  
✅ **Network Resilience**: Configures WiFi reconnection for mobile deployments  

**System Requirements:**
- Raspberry Pi 4+ (2GB+ RAM) or Debian/Ubuntu system  
- 4GB+ free disk space  
- Internet connection for initial setup  
- HackRF One hardware (for SDR spectrum analysis)

**Installation takes 5-10 minutes and requires no technical knowledge.**

## 🔧 Manual Installation

If you prefer manual installation:

```bash
# 1. Clone repository
git clone https://github.com/Graveside2022/Argos.git
cd Argos

# 2. Run setup script
./scripts/install-system.sh

# 3. Start services
./scripts/start-all.sh
```

## 💻 Access

After installation, access Argos at:
- **Main Console**: http://localhost:5173
- **Spectrum Analyzer**: http://localhost:8073 (admin/hackrf)
- **API Documentation**: http://localhost:5173/api/docs

## 🛠️ System Management (Optional)

Argos includes professional system management tools:

```bash
# Install system management scripts
curl -sSL https://raw.githubusercontent.com/Graveside2022/Argos/main/scripts/install-management.sh | bash
```

**Management Features:**
- Automatic process monitoring and restart
- CPU protection (kills runaway processes >140%)
- Network reconnection for wireless systems
- Memory optimization and cleanup
- Comprehensive logging and alerts

## 🧪 Testing

Verify your installation:

```bash
# Run system tests
npm run test:system

# Test all management scripts
npm run test:management

# Full integration test
npm run test:all
```

## 📁 Architecture

```
/projects/
└── Argos/
    ├── src/           # Core application
    ├── scripts/       # System management
    ├── docker/        # Container configs
    ├── tests/         # Test suites
    └── docs/          # Documentation
```

## 🔌 API Integration

**Core Services:**
- Spectrum Analysis API (port 8092)
- HackRF Control API (port 3002)  
- Kismet Integration (port 2501)
- TAK Server Bridge (port 8000)

## 🤝 Contributing

Professional contributions welcome. See [CONTRIBUTING.md](docs/project/CONTRIBUTING.md) for enterprise development standards.

## 📄 License

MIT License - see [LICENSE.md](docs/project/LICENSE.md) for details.

## 📞 Support

For technical support, open an issue on GitHub or contact the maintainers.

---

**Built for professional SDR and network analysis applications**