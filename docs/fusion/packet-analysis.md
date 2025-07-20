# Fusion Packet Analysis System

## Overview

The Fusion Security Center includes a comprehensive packet analysis system that captures, analyzes, and visualizes network traffic in real-time. This system is designed to help security operators identify suspicious network activity and gain insights into network behavior.

## Architecture

### Components

1. **Wireshark Controller** (`/src/lib/server/wireshark.ts`)
   - Manages tshark subprocess for packet capture
   - Provides JSON formatted packet data
   - Handles continuous packet streaming with automatic restart
   - Supports interface selection and configuration

2. **Packet Analysis Store** (`/src/lib/stores/packetAnalysisStore.ts`)
   - Implements anomaly detection algorithms
   - Categorizes packets by threat level
   - Tracks protocol statistics and conversations
   - Generates security alerts for suspicious activity

3. **API Endpoints**
   - `/api/fusion/packets` - Packet retrieval with filtering
   - `/api/fusion/stats` - Network statistics and analytics
   - `/api/fusion/alerts` - Security alerts and threat detection

4. **UI Components**
   - PacketAnalysisDashboard - Main analysis interface
   - PacketList - Virtual scrolling packet viewer
   - PacketDetail - Detailed packet inspection
   - PacketStatistics - Real-time network metrics
   - AlertsPanel - Security threat monitoring
   - PacketFilters - Advanced filtering controls

## Features

### Real-time Packet Capture

- **Interface Selection**: Choose from available network interfaces
- **Protocol Filtering**: Focus on specific protocols (TCP, UDP, ICMP, etc.)
- **Continuous Streaming**: Automatic restart for uninterrupted capture
- **Permission Management**: Handles sudo requirements for packet capture

### Intelligent Analysis

The system automatically analyzes packets for:

#### Security Threats
- **Port Scanning**: Detects connection attempts to multiple ports
- **Suspicious Protocols**: Identifies uncommon or dangerous protocols
- **Large Packets**: Flags unusually large packets that might indicate attacks
- **High Frequency Traffic**: Detects rapid packet transmission patterns

#### Network Behavior
- **Protocol Distribution**: Tracks usage patterns across protocols
- **Top Talkers**: Identifies most active IP addresses
- **Conversation Tracking**: Maps communication patterns between hosts
- **Traffic Statistics**: Real-time metrics on packet volume and rates

### Alert System

Security alerts are generated with:
- **Severity Levels**: 1-10 scale (1=info, 10=critical)
- **Alert Types**: port_scan, suspicious_traffic, malware_traffic, anomaly
- **Contextual Information**: Source/destination IPs, protocols, packet details
- **Acknowledgment System**: Operators can acknowledge and dismiss alerts

## API Documentation

### GET /api/fusion/packets

Retrieve captured packets with optional filtering.

**Query Parameters:**
- `limit` (default: 100) - Maximum packets to return
- `offset` (default: 0) - Pagination offset
- `protocol` - Filter by protocol (TCP, UDP, etc.)
- `src_ip` - Filter by source IP address
- `dst_ip` - Filter by destination IP address

**Response:**
```json
{
  "packets": [
    {
      "id": "unique-packet-id",
      "timestamp": "2025-07-20T19:59:00.000Z",
      "src_ip": "192.168.1.100",
      "dst_ip": "192.168.1.1", 
      "protocol": "TCP",
      "length": 60,
      "info": "HTTP request"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0,
  "hasMore": false
}
```

### GET /api/fusion/stats

Get network traffic statistics.

**Query Parameters:**
- `detailed` (true/false) - Include detailed analytics

**Response:**
```json
{
  "wireshark": {
    "running": true,
    "interface": "eth0",
    "packets": 1000,
    "rate": 10.5,
    "uptime": 300
  },
  "capture": {
    "totalPackets": 1000,
    "totalBytes": 64000,
    "packetsPerSecond": 3.33,
    "bytesPerSecond": 213.33,
    "uptimeSeconds": 300,
    "startTime": "2025-07-20T19:54:00.000Z"
  },
  "protocols": {
    "TCP": 650,
    "UDP": 200,
    "ICMP": 150
  }
}
```

### GET /api/fusion/alerts

Retrieve security alerts.

**Query Parameters:**
- `limit` (default: 50) - Maximum alerts to return
- `offset` (default: 0) - Pagination offset
- `severity` - Minimum severity level (1-10)
- `type` - Filter by alert type
- `source` - Filter by source IP

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "timestamp": "2025-07-20T19:59:00.000Z",
      "severity": 7,
      "type": "port_scan",
      "source": "192.168.1.100",
      "destination": "192.168.1.1",
      "description": "Port scanning detected",
      "details": {
        "protocol": "TCP",
        "packetLength": 60,
        "suspicionReasons": ["Multiple port connections"],
        "tags": ["scanning", "recon"]
      }
    }
  ],
  "summary": {
    "total": 1,
    "high": 1,
    "medium": 0,
    "low": 0,
    "byType": {
      "port_scan": 1
    },
    "recentActivity": 1
  }
}
```

## Configuration

### Network Interface Selection

The system automatically detects available network interfaces and prefers:
1. Ethernet interfaces (eth0, ens*, enp*)
2. Wireless interfaces (wlan*, wlp*)
3. First available interface as fallback

### Packet Capture Settings

Default tshark configuration:
- JSON output format for structured parsing
- IP traffic filtering to focus on network layer
- Batch capture of 10 packets for streaming efficiency
- Line buffered output for real-time processing

### Analysis Thresholds

Suspicious activity detection uses these thresholds:
- **Port Scanning**: 5+ different destination ports in 30 seconds
- **Large Packets**: Packets > 1400 bytes
- **High Rate**: Same source > 100 packets/minute
- **Suspicious Ports**: Connections to ports 22, 23, 3389, 445, 135

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure tshark has packet capture permissions
   - Run with sudo or configure capabilities: `sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tshark`

2. **No Packets Captured**
   - Verify network interface is active and has traffic
   - Check interface selection in system status
   - Ensure capture filter is not too restrictive

3. **Missing Tools**
   - Install tshark: `sudo apt-get install tshark`
   - Alternative tools: tcpdump, dumpcap
   - Check system status for tool availability

4. **High Memory Usage**
   - Packet storage is limited to 1000 recent packets
   - Alert storage is limited to 500 recent alerts
   - Use pagination for large data sets

### Performance Optimization

- **Interface Selection**: Use dedicated capture interface when possible
- **Filtering**: Apply protocol filters to reduce processing overhead
- **Batch Processing**: System processes packets in batches of 10 for efficiency
- **Memory Management**: Automatic cleanup of old packets and alerts

## Security Considerations

1. **Privilege Escalation**: Packet capture requires elevated privileges
2. **Data Sensitivity**: Captured packets may contain sensitive information
3. **Storage Security**: No persistent storage of packet contents by default
4. **Access Control**: API endpoints should be protected in production

## Future Enhancements

- **PCAP Export**: Save packet captures to PCAP files
- **Custom Rules**: User-defined detection rules
- **Machine Learning**: Advanced anomaly detection algorithms
- **Distributed Capture**: Multi-interface and multi-host capture
- **Integration**: Export to SIEM systems and threat intelligence platforms