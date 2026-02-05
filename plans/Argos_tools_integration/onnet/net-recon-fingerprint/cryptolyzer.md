# CryptoLyzer

> **RISK CLASSIFICATION**: LOW RISK
> TLS/SSL analysis tool that identifies cipher suites, protocol versions, certificate details, and cryptographic vulnerabilities in network services. Passive analysis with no exploitation capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python package; no platform-specific dependencies

| Method               | Supported | Notes                                                                             |
| -------------------- | --------- | --------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; no privileges required; standard TCP networking |
| **Native Install**   | YES       | `pip3 install cryptolyzer`; simplest deployment of any tool in this category      |

---

## Tool Description

CryptoLyzer is a Python-based cryptographic protocol analyzer that evaluates TLS/SSL, SSH, and HTTP security configurations of network services. It identifies supported cipher suites, protocol versions (SSLv3 through TLS 1.3), certificate chain details, key exchange parameters, and known vulnerabilities (Heartbleed, POODLE, BEAST, CRIME, ROBOT, DROWN). CryptoLyzer provides machine-readable JSON output suitable for automated security assessments and can be used as both a CLI tool and a Python library for integration into scanning pipelines.

## Category

TLS/SSL Analysis / Cryptographic Assessment / Vulnerability Scanning

## Repository

https://github.com/c0r0n3r/cryptolyzer

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - CryptoLyzer runs cleanly in Docker with no special privileges required. It is a pure Python application that connects to target services over standard TCP sockets. No host-level access, USB devices, or privileged operations needed.

### Host OS-Level Requirements

- No `--privileged` required (uses standard TCP connections)
- No `--net=host` required (connects to targets via Docker default networking)
- No `--device` flags required (no hardware dependencies)
- No additional host kernel modules required
- Network connectivity to target services is the only requirement

### Docker-to-Host Communication

- Standard Docker networking is sufficient; CryptoLyzer connects to targets via TCP
- No host-level configuration needed
- Results can be exported via volume mount: `-v /host/results:/results`
- Can scan localhost services if `--net=host` is used, but not required for remote targets

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install

```bash
pip3 install cryptolyzer
```

### Option B: Docker

```dockerfile
FROM python:3.11-slim-bookworm

RUN pip install --no-cache-dir \
    cryptolyzer \
    cryptoparser

RUN mkdir -p /results

WORKDIR /results

ENTRYPOINT ["cryptolyze"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/cryptolyzer .

# Run - analyze TLS configuration of a target
docker run --rm -it \
  -v $(pwd)/results:/results \
  argos/cryptolyzer tls all --target example.com:443

# Run - check specific TLS version support
docker run --rm -it \
  argos/cryptolyzer tls versions --target example.com:443

# Run - enumerate cipher suites
docker run --rm -it \
  argos/cryptolyzer tls ciphers --target example.com:443

# Run - analyze SSH server
docker run --rm -it \
  argos/cryptolyzer ssh2 all --target 192.168.1.1:22

# Run - check for specific vulnerabilities
docker run --rm -it \
  argos/cryptolyzer tls vulns --target example.com:443

# Run - batch scan multiple targets with JSON output
docker run --rm -it \
  -v $(pwd)/results:/results \
  --entrypoint /bin/bash \
  argos/cryptolyzer -c '
    for host in target1.com target2.com target3.com; do
      cryptolyze tls all --target $host:443 > /results/${host}.json 2>&1
    done
  '
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - CryptoLyzer is a pure Python package installable via pip on any architecture. No compiled extensions or platform-specific binaries. Works identically on ARM64 and x86_64.

### Hardware Constraints

- CPU: Minimal CPU requirements; TLS handshake analysis is lightweight. Cortex-A76 is far more than sufficient
- RAM: Very low memory footprint (~50-100MB); negligible on 8GB system
- Hardware: No specialized hardware required. Only needs standard network connectivity to reach target services
- Storage: Minimal (<50MB for Python package and dependencies)

### Verdict

**COMPATIBLE** - CryptoLyzer runs natively on Kali RPi 5 ARM64 via simple pip install. No platform constraints, no special privileges, no hardware requirements. One of the simplest tools to deploy. Useful for field assessment of network service cryptographic posture before deeper engagement.
