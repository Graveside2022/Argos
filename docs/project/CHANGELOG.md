# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Professional repository structure with organized directories
- Comprehensive GitHub integration (workflows, templates)
- Enhanced documentation structure
- Python orchestrator for parallel task execution
- HackRF sweep stability improvements
- Kismet API integration with proxy
- Tactical map with real-time signal visualization
- WebSocket architecture for real-time updates
- Signal aggregation and grid-based analysis
- Memory monitoring and diagnostics tools

### Changed
- Reorganized scripts into categorized subdirectories
- Moved technical documentation to docs/technical/
- Updated .gitignore with Python and database patterns
- Improved error handling in HackRF integration
- Enhanced WebSocket message handling

### Fixed
- Orchestrator AttributeError in parallel_engine.py
- HackRF memory leak issues
- WebSocket connection stability
- Database connection pooling

### Security
- Added SECURITY.md for vulnerability reporting
- Enhanced WebSocket authentication
- Improved API endpoint validation

## [1.0.0] - TBD

Initial release of ArgosFinal - Software Defined Radio and Network Analysis Console.

### Features
- HackRF SDR hardware integration
- Kismet WiFi/Bluetooth scanning
- GPS tracking with MAVLink/GPSD support
- Team Awareness Kit (TAK) integration
- Real-time spectrum analysis
- Interactive tactical mapping
- Signal strength visualization
- Database persistence for signal history
- Multi-source data aggregation