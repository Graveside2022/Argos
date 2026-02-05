# MouseJack / JackIt

> **NOTE:** Firmware flash paths documented here need verification against the actual repository. Paths may differ depending on the hardware revision and firmware version.

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> This tool is part of a controlled military/defense training toolkit. MouseJack enables keystroke injection and mouse spoofing attacks against non-Bluetooth wireless peripherals. Unauthorized use constitutes unauthorized access to computer systems and is illegal under the Computer Fraud and Abuse Act (CFAA) and equivalent laws. Use only in authorized training, research, and penetration testing environments with explicit written permission.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python; lightweight and ideal for portable RPi 5 field deployment

| Method               | Supported | Notes                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; USB passthrough for CrazyRadio PA dongle           |
| **Native Install**   | YES       | Pure Python with pip install; `sdcc` compiler available on ARM64 for firmware builds |

---

## Tool Description

MouseJack is a collection of vulnerabilities and attack tools targeting non-Bluetooth wireless keyboards and mice that use nRF24L-series transceivers. Discovered by Bastille Research, these vulnerabilities allow an attacker to inject keystrokes, spoof mouse movements, and take over wireless peripheral communications from distances up to 100 meters (with directional antenna). The JackIt tool (the primary attack script) uses a CrazyRadio PA USB dongle with custom firmware to scan for vulnerable devices, identify their protocols, and inject arbitrary keystrokes or mouse commands. Affected devices include products from Microsoft, Logitech, Dell, HP, Lenovo, and other manufacturers using unencrypted or weakly-encrypted wireless peripheral protocols. The attack is effective because many wireless keyboards transmit keystrokes in cleartext or with easily bypassed encryption, and most wireless mice accept unencrypted HID packets.

## Category

Keyboard & Mouse Attacks / Wireless HID Exploitation / Keystroke Injection

## Repository

- **GitHub**: https://github.com/BastilleResearch/mousejack (research and firmware) / https://github.com/insecurityofthings/jackit (JackIt attack tool)
- **Language**: Python, C (firmware)
- **License**: BSD-3-Clause (mousejack), MIT (JackIt)

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- CrazyRadio PA USB dongle passthrough to container
- Python 3 runtime environment
- `libusb` for USB device communication
- `--privileged` or `--device` flag for USB access
- Custom firmware must be flashed to CrazyRadio PA before use

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    libusb-1.0-0-dev \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

# Clone JackIt attack tool
RUN git clone https://github.com/insecurityofthings/jackit.git /opt/jackit

WORKDIR /opt/jackit

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Clone MouseJack research repo for firmware and tools
RUN git clone https://github.com/BastilleResearch/mousejack.git /opt/mousejack

# Install nrf-research-firmware tools
RUN cd /opt/mousejack && pip install --no-cache-dir -e .

# Set up udev rules for CrazyRadio PA
RUN echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="1915", ATTRS{idProduct}=="0102", MODE="0666"' > /etc/udev/rules.d/99-crazyradio.rules

WORKDIR /opt/jackit

ENTRYPOINT ["jackit"]
```

### Docker Run Command

```bash
# Run JackIt with CrazyRadio PA USB passthrough
docker run -it --rm \
    --privileged \
    -v /dev/bus/usb:/dev/bus/usb \
    --name mousejack \
    mousejack:latest

# Scan for vulnerable devices
docker run -it --rm \
    --privileged \
    -v /dev/bus/usb:/dev/bus/usb \
    --name mousejack \
    mousejack:latest --scan

# Inject keystrokes to a specific device address
docker run -it --rm \
    --privileged \
    -v /dev/bus/usb:/dev/bus/usb \
    --name mousejack \
    mousejack:latest --address AA:BB:CC:DD:EE --script /opt/jackit/scripts/payload.txt
```

---

## Install Instructions (Native)

```bash
# Install dependencies on Kali Linux
sudo apt-get update
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    libusb-1.0-0-dev \
    usbutils \
    sdcc

# Flash CrazyRadio PA with MouseJack firmware (required first step)
git clone https://github.com/BastilleResearch/mousejack.git
cd mousejack

# Build and flash custom firmware
cd nrf-research-firmware
make
# Put CrazyRadio PA into bootloader mode (hold button while inserting)
sudo python3 prog/usb-flasher/boot-nrf24lu1p.py
sudo python3 prog/usb-flasher/flash-nrf24lu1p.py bin/dongle.bin

# Install JackIt attack tool
cd /opt
git clone https://github.com/insecurityofthings/jackit.git
cd jackit
pip3 install -e .

# Set udev rules for CrazyRadio PA (non-root access)
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="1915", ATTRS{idProduct}=="0102", MODE="0666"' | \
    sudo tee /etc/udev/rules.d/99-crazyradio.rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Run JackIt
jackit --scan
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| ARM64 Support         | :white_check_mark: Pure Python, no architecture-specific binaries              |
| Kali Repo Available   | :x: Not in Kali repos, install from GitHub                                     |
| Hardware Requirements | CrazyRadio PA USB dongle (nRF24LU1+ based) with custom MouseJack firmware      |
| Performance on RPi5   | :white_check_mark: Excellent -- lightweight Python tool, minimal CPU/RAM usage |

### Additional Notes

- **CrazyRadio PA**: The CrazyRadio PA dongle (~$30 USD) must be flashed with custom nRF Research Firmware before use; this is a one-time operation
- **Effective Range**: ~10m with stock antenna, up to ~100m with directional antenna (Yagi or panel)
- **Affected Vendors**: Microsoft, Logitech, Dell, HP, Lenovo, Amazon Basics, Gigabyte, EagleTec, Anker -- any device using nRF24L01+/nRF24LE1/nRF24LU1+ without proper encryption
- **Attack Types**: Keystroke injection (type arbitrary commands), mouse spoofing (move cursor), forced pairing, encrypted keystroke injection (Logitech Unifying)
- **Ducky Script**: JackIt supports Ducky Script payloads for automated keystroke injection sequences
- **Detection**: Extremely difficult to detect as it operates at the RF layer below OS visibility
- **Firmware Flashing**: The sdcc compiler is needed to build the firmware; on ARM64 this works without issues

### Verdict

**COMPATIBLE** -- MouseJack/JackIt runs perfectly on RPi5. It is a lightweight Python application with no architecture-specific requirements. The CrazyRadio PA USB dongle provides all RF functionality, and the RPi5 simply sends commands over USB. The tool's minimal CPU and memory footprint makes it ideal for portable field deployment on Raspberry Pi hardware.
