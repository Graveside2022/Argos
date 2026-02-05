# Wireshark TAK Protocol Dissector

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. The Wireshark TAK dissector provides passive protocol analysis capabilities only. It enables deep packet inspection of TAK/CoT network traffic for security auditing, protocol debugging, and traffic analysis. No active injection, modification, or disruption capabilities. Standard network capture authorization requirements apply.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Lua plugin is arch-independent; Wireshark/tshark available in Kali ARM64 repos

| Method               | Supported | Notes                                                                                  |
| -------------------- | --------- | -------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | tshark headless works well; GUI mode requires X11 forwarding/VNC                       |
| **Native Install**   | YES       | `apt install wireshark tshark` + copy Lua plugin; tshark recommended over GUI on RPi 5 |

---

## Tool Description

The Wireshark TAK Protocol Dissector is a Lua-based plugin for Wireshark that adds native dissection support for TAK (Team Awareness Kit) and Cursor-on-Target (CoT) protocol traffic. It parses both CoT XML messages and TAK Protocol Version 1 (protobuf-encoded) frames, displaying decoded fields directly in the Wireshark packet detail pane. The dissector identifies CoT event types, extracts position data (latitude, longitude, altitude), decodes contact callsigns, parses timestamps, and reveals TAK-specific protocol headers. It supports both TCP stream reassembly and UDP datagram analysis for CoT traffic. For Argos operations, this dissector enables passive reconnaissance of TAK network communications -- identifying active TAK users, mapping their positions from captured PLI messages, fingerprinting TAK client versions, and analyzing TAK network architecture without generating any network traffic.

## Category

TAK Protocol / Passive Analysis / Packet Inspection / Network Forensics

## Repository

- **Source**: https://github.com/jmkeyes/wireshark-tak-plugin
- **Language**: Lua
- **License**: MIT

---

## Docker Compatibility

### Can it run in Docker?

PARTIAL

### Docker Requirements

- Wireshark/tshark installation (headless mode with tshark for Docker)
- Lua plugin directory accessible for dissector installation
- Network capture capability (--cap-add NET_RAW, --cap-add NET_ADMIN)
- For GUI mode: X11 forwarding or VNC (not recommended in Docker)
- Host network mode for live capture scenarios
- PCAP file volume mount for offline analysis

### Dockerfile

```dockerfile
FROM kalilinux/kali-rolling

LABEL maintainer="Argos Project"
LABEL description="Wireshark TAK Protocol Dissector - CoT packet analysis"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        tshark \
        wireshark-common \
        git \
        lua5.4 && \
    rm -rf /var/lib/apt/lists/*

# Install TAK dissector plugin
RUN git clone https://github.com/jmkeyes/wireshark-tak-plugin.git /tmp/tak-plugin && \
    mkdir -p /root/.local/lib/wireshark/plugins && \
    cp /tmp/tak-plugin/*.lua /root/.local/lib/wireshark/plugins/ && \
    rm -rf /tmp/tak-plugin

WORKDIR /captures

# Default: run tshark in headless mode
CMD ["tshark", "-h"]
```

### Docker Run Command

```bash
# Analyze a PCAP file containing TAK/CoT traffic
docker run -it --rm \
    --name argos-tak-dissector \
    -v $(pwd)/captures:/captures:ro \
    argos-tak-dissector \
    tshark -r /captures/tak_traffic.pcap -V -Y "cot"

# Live capture of TAK traffic on a network interface
docker run -it --rm \
    --name argos-tak-dissector \
    --network host \
    --cap-add NET_RAW \
    --cap-add NET_ADMIN \
    argos-tak-dissector \
    tshark -i eth0 -f "port 8087 or port 8089 or port 6969" -V

# Extract CoT position data from PCAP
docker run -it --rm \
    --name argos-tak-dissector \
    -v $(pwd)/captures:/captures:ro \
    argos-tak-dissector \
    tshark -r /captures/tak_traffic.pcap \
        -Y "cot" \
        -T fields \
        -e cot.uid -e cot.type -e cot.lat -e cot.lon -e cot.callsign

# Save filtered TAK traffic to a new PCAP
docker run -it --rm \
    --name argos-tak-dissector \
    -v $(pwd)/captures:/captures \
    argos-tak-dissector \
    tshark -r /captures/full_capture.pcap \
        -Y "tcp.port == 8087 || udp.port == 6969" \
        -w /captures/tak_only.pcap
```

---

## Install Instructions (Native)

```bash
# Step 1: Install Wireshark and tshark (Kali Linux)
sudo apt update
sudo apt install -y wireshark tshark

# Step 2: Clone the TAK dissector plugin
git clone https://github.com/jmkeyes/wireshark-tak-plugin.git
cd wireshark-tak-plugin

# Step 3: Install the Lua plugin
# User-level installation
mkdir -p ~/.local/lib/wireshark/plugins
cp *.lua ~/.local/lib/wireshark/plugins/

# Or system-wide installation
# sudo cp *.lua /usr/lib/wireshark/plugins/

# Step 4: Verify plugin is loaded
tshark -G plugins | grep -i tak

# Step 5: Test with a capture
# Capture TAK traffic on common ports
sudo tshark -i eth0 -f "port 8087 or port 8089 or port 6969" -w /tmp/tak_capture.pcap

# Analyze captured traffic with TAK dissector
tshark -r /tmp/tak_capture.pcap -V -Y "cot"
```

### Usage Examples

```bash
# Live capture and decode TAK traffic
sudo tshark -i wlan0 -f "port 8087" -V -Y "cot"

# Extract all callsigns and positions from a capture
tshark -r tak_traffic.pcap \
    -Y "cot.type contains \"a-f\"" \
    -T fields \
    -e frame.time \
    -e cot.uid \
    -e cot.lat \
    -e cot.lon \
    -e cot.callsign \
    -E separator=,

# Count CoT messages by type
tshark -r tak_traffic.pcap \
    -Y "cot" \
    -T fields \
    -e cot.type | sort | uniq -c | sort -rn

# Filter for emergency/alert CoT events
tshark -r tak_traffic.pcap -V -Y "cot.type contains \"b-a\""

# GUI mode (if display available)
wireshark -r tak_traffic.pcap -Y "cot"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| ARM64 Support         | ✅ Lua plugin is architecture-independent; Wireshark/tshark available for ARM64 |
| Kali Repo Available   | ✅ Wireshark and tshark available in Kali ARM64 repositories                    |
| Hardware Requirements | Network interface for capture; sufficient storage for PCAP files                |
| Performance on RPi5   | Good -- tshark headless analysis is efficient; GUI mode usable but heavier      |

### Platform Details

- **Tested Architecture**: aarch64 (ARM64)
- **Wireshark Version**: 4.x (Kali repos)
- **Plugin Language**: Lua 5.x (bundled with Wireshark)
- **Memory Footprint**: ~100-200MB RAM for tshark analysis; 300-500MB for Wireshark GUI
- **CPU Impact**: Moderate during live capture with dissection; low for offline PCAP analysis
- **Storage**: PCAP files can grow large -- plan for sufficient SD card or external storage
- **Capture Requirements**: Root privileges or dumpcap group membership for live capture

### Platform-Specific Notes

- tshark (headless) is recommended over Wireshark GUI on RPi5 for performance
- For long-duration captures, use ring buffer mode: `tshark -b filesize:100000 -b files:10`
- WiFi monitor mode capture of TAK traffic requires compatible wireless adapter
- USB Ethernet adapters work well for wired TAK network tap scenarios

### Verdict

**COMPATIBLE** -- The Lua dissector plugin is fully architecture-independent and runs on any platform with Wireshark/tshark. Both Wireshark and tshark are available in Kali ARM64 repositories and install cleanly on Raspberry Pi 5. tshark headless mode provides efficient TAK traffic analysis well within RPi5 capabilities. GUI mode is functional but heavier on resources. Ideal for portable TAK network reconnaissance and protocol analysis from a field-deployable platform.
