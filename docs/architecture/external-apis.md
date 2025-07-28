# External APIs

## GSM Evil SocketIO API

- **Purpose:** Integration with GSM Evil for cellular signal analysis and IMSI detection
- **Documentation:** Local instance documentation at http://localhost:8080/docs
- **Base URL(s):** ws://localhost:8080/socket.io
- **Authentication:** None required for local instance
- **Rate Limits:** No limits on local deployment

**Key Endpoints Used:**
- `connect` - Establish SocketIO connection
- `scan_request` - Request GSM scan with parameters
- `imsi_detected` - Receive IMSI detection events
- `cell_info` - Receive cell tower information

**Integration Notes:** Requires GSM Evil service running locally. Handle disconnections gracefully as service may restart during hardware issues.

## GPS NMEA Serial API

- **Purpose:** Direct GPS module integration for high-precision location data
- **Documentation:** NMEA 0183 protocol standard
- **Base URL(s):** /dev/ttyUSB0 or /dev/ttyACM0 (serial port)
- **Authentication:** None - direct serial access
- **Rate Limits:** Hardware limited to 10Hz update rate

**Key Endpoints Used:**
- Serial port read at 9600 baud
- `$GPGGA` - GPS fix data
- `$GPRMC` - Recommended minimum data
- `$GPGSV` - Satellites in view

**Integration Notes:** Requires serial port permissions. Must handle incomplete NMEA sentences and checksum validation.

## DroneLink MAVLink API

- **Purpose:** Drone telemetry and control via MAVLink protocol
- **Documentation:** https://mavlink.io/en/messages/common.html
- **Base URL(s):** tcp://localhost:14550 or serial port
- **Authentication:** None for local connections
- **Rate Limits:** Telemetry at 10Hz, commands as needed

**Key Endpoints Used:**
- `HEARTBEAT` - Connection monitoring
- `GLOBAL_POSITION_INT` - Drone GPS position
- `ATTITUDE` - Drone orientation
- `MISSION_ITEM` - Waypoint management
- `COMMAND_LONG` - Send commands to drone

**Integration Notes:** Requires MAVLink 2.0 support. Must handle message fragmentation and implement proper heartbeat to maintain connection.
