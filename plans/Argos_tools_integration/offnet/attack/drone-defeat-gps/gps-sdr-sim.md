# GPS-SDR-SIM

> **HIGH RISK - SENSITIVE SOFTWARE**
> Generates realistic GPS L1 C/A satellite signals that can be transmitted via SDR to spoof any GPS receiver within range. Capable of placing targets at arbitrary coordinates worldwide. Illegal to transmit without authorization under federal law. Can affect aviation GPS, vehicle navigation, and timing infrastructure.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                                |
| -------------------- | --------- | ---------------------------------------------------- |
| **Docker Container** | YES       | Pure C, compiles with `make`, HackRF USB passthrough |
| **Native Install**   | YES       | Recommended for real-time streaming performance      |

---

## Description

Software-defined GPS signal simulator that generates GPS L1 C/A baseband signal data streams from navigation ephemeris data and user-defined trajectories. The generated signals can be transmitted via SDR platforms (HackRF, bladeRF, USRP, ADALM-Pluto) to create a realistic GPS environment that receivers lock onto. Supports static positions, dynamic trajectories (CSV waypoints), and real-time streaming. The most mature and widely-used open-source GPS spoofing tool.

## Category

GPS Signal Simulation / GNSS Spoofing / SDR Signal Generation

## Source

- **Repository**: https://github.com/osqzss/gps-sdr-sim
- **Status**: MATURE (680+ forks, actively maintained)
- **Language**: C
- **Dependencies**: gcc, libm (standard math library). Zero external dependencies.
- **Build**: `make` (single C file, ~1000 lines)

## Docker Compatibility

| Attribute                | Value                                                     |
| ------------------------ | --------------------------------------------------------- |
| Docker Compatible        | Yes                                                       |
| ARM64 (aarch64) Support  | Yes                                                       |
| Base Image               | debian:bookworm-slim                                      |
| Privileged Mode Required | Yes (if streaming to SDR in real-time)                    |
| Host Network Required    | No                                                        |
| USB Device Passthrough   | HackRF One or other SDR (`/dev/bus/usb`) for transmission |
| Host Kernel Modules      | hackrf (for HackRF), uhd (for USRP)                       |

### Docker-to-Host Communication

- **Signal generation only** (no SDR): No host communication needed. Output is a binary file that can be transmitted later.
- **Real-time SDR streaming**: HackRF/USRP must be passed through via USB. Requires `--privileged` or `--device` flag plus HackRF udev rules on host.
- Generated `.bin` files can be exported via Docker volume mount for offline use.

## Install Instructions (Docker)

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    hackrf \
    libhackrf-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/osqzss/gps-sdr-sim.git /opt/gps-sdr-sim

WORKDIR /opt/gps-sdr-sim

RUN make

# Download sample ephemeris file
RUN cp brdc0010.22n /opt/gps-sdr-sim/brdc.n

ENV PATH="/opt/gps-sdr-sim:${PATH}"

CMD ["/bin/bash"]
```

```bash
# Build
docker build -t gps-sdr-sim .

# Run - generate signal file (no SDR needed)
docker run -it --rm \
  -v $(pwd)/output:/output \
  gps-sdr-sim \
  gps-sdr-sim -e brdc.n -l 38.8977,-77.0365,100 -b 8 -o /output/gpssim.bin

# Run - real-time HackRF streaming
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  gps-sdr-sim \
  /bin/bash -c "gps-sdr-sim -e brdc.n -l 38.8977,-77.0365,100 -b 8 -o gpssim.bin && \
    hackrf_transfer -t gpssim.bin -f 1575420000 -s 2600000 -a 1 -x 0 -R"
```

### Updating Ephemeris Data

GPS ephemeris files expire daily. For accurate signal generation, download current ephemeris:

```bash
# Inside container or on host
wget "https://cddis.nasa.gov/archive/gnss/data/daily/$(date +%Y)/brdc/brdc$(date +%j0.%yn).Z"
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runs on RPi5     | Yes                                                                                                                                                                                                                                                                                                    |
| Architecture     | aarch64 native (pure C, compiles with `make` using gcc-aarch64)                                                                                                                                                                                                                                        |
| RAM Requirement  | ~128MB (minimal - single C binary)                                                                                                                                                                                                                                                                     |
| Limiting Factors | Signal generation for long trajectories (>10 min at 2.6 Msps) produces large files (~3.7 GB/min at 8-bit). RPi5 SD card I/O may bottleneck real-time streaming. Use USB SSD for output. Real-time streaming to HackRF via `hackrf_transfer -R` works on RPi5 but with tighter timing margins than x86. |
