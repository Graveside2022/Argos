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

## 🚀 Installation Options

Choose the installation method that best fits your needs:

### **Option A: Git Clone Installation** (Recommended for most users)

Perfect for fresh Dragon OS installations or when you want the latest version:

```bash
# Clone and install in one process
git clone https://github.com/Graveside2022/Argos.git
cd Argos
bash install-from-git.sh
```

**✅ Best for:**
- Fresh Dragon OS installations
- Users who want latest updates
- Systems with internet connectivity
- First-time installations

[📖 **Detailed Git Installation Guide**](README-GIT-INSTALLATION.md)

### **Option B: Direct Copy Deployment** (For offline/field operations)

Perfect for offline deployments or when copying to multiple systems:

```bash
# 1. Copy entire project folder via SCP/CyberDuck to target system
# 2. Then run on target system:
cd /home/pi/projects/Argos
bash fix-hardcoded-paths.sh
bash deploy-dragon-os.sh
```

**✅ Best for:**
- Offline field operations
- Air-gapped systems
- Multiple system deployments
- When you have customized configurations

[📖 **Detailed Copy Deployment Guide**](README-DRAGON-OS-DEPLOYMENT.md)

---

## 📋 System Requirements

- **Dragon OS** (recommended) or **Debian/Ubuntu** system
- **3GB+ free disk space**
- **2GB+ RAM** (4GB+ recommended)
- **sudo privileges**
- **HackRF One** hardware (for SDR operations)

**Both installation methods provide:**

✅ **Complete System Setup**: Node.js, Docker, SDR tools, dependencies  
✅ **Hardware Configuration**: HackRF, GPS, WiFi adapter permissions  
✅ **Service Management**: Systemd auto-start services  
✅ **Security**: Firewall configuration and access controls  
✅ **Interactive Setup**: OpenCellID API key configuration  
✅ **Verification**: Comprehensive post-installation testing  

## 🔧 Legacy Installation (curl command)

For compatibility with older documentation:

```bash
cd && curl -sSL https://raw.githubusercontent.com/Graveside2022/Argos/main/quick-install.sh | bash
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