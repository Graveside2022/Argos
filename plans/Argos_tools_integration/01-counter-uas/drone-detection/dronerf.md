# DroneRF

> **RISK CLASSIFICATION: LOW RISK**

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Python ML pipeline only; MATLAB/LabVIEW require x86

| Method               | Supported | Notes                                                          |
| -------------------- | --------- | -------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Python classification pipeline only; MATLAB/LabVIEW cannot run |
| **Native Install**   | PARTIAL   | Same limitation — MATLAB Runtime unavailable on ARM64          |

---

## Description

Machine learning-based drone detection and identification system using RF signal features. Developed as a research project (Al-Sa'd et al., Future Generation Computer Systems, 2019), it includes LabVIEW programs for RF signal recording, MATLAB scripts for signal processing, and Python scripts for ML-based classification. Identifies drone type from RF signatures using deep learning approaches. The associated DroneRF dataset is published on Mendeley Data.

## Category

ML-Based Passive RF Drone Detection / Signal Classification Research

## Source

- **Repository**: https://github.com/Al-Sad/DroneRF
- **Status**: RESEARCH
- **Languages**: Python, MATLAB, LabVIEW
- **Dependencies**: Python ML libraries (numpy, scipy, TensorFlow/Keras or scikit-learn), MATLAB Runtime (optional)

## Docker Compatibility

| Attribute                | Value                                |
| ------------------------ | ------------------------------------ |
| Docker Compatible        | Partial                              |
| ARM64 (aarch64) Support  | Partial (Python components only)     |
| Base Image               | python:3.10-slim                     |
| Privileged Mode Required | No (works on pre-recorded data)      |
| Host Network Required    | No                                   |
| USB Device Passthrough   | None (uses pre-recorded RF datasets) |
| Host Kernel Modules      | None                                 |

### Docker-to-Host Communication

- No host communication required. This tool operates on pre-recorded RF datasets (DroneRF database from Mendeley Data).
- MATLAB and LabVIEW components **cannot** run in Docker on ARM64. Only the Python classification pipeline is Docker-compatible.
- Mount dataset files as Docker volumes.

## Install Instructions (Docker)

```dockerfile
FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    git \
    libhdf5-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Al-Sad/DroneRF.git /opt/dronerf

WORKDIR /opt/dronerf/Python

RUN pip install --no-cache-dir \
    numpy \
    scipy \
    matplotlib \
    scikit-learn \
    h5py \
    tensorflow-cpu

CMD ["python", "-c", "print('DroneRF Python environment ready. Mount dataset to /data.')"]
```

```bash
# Build
docker build -t dronerf .

# Run with dataset mounted
docker run -it --rm \
  -v /path/to/dronerf-dataset:/data \
  dronerf python /opt/dronerf/Python/Classification.py --data /data
```

**Note**: If TensorFlow is too heavy for RPi5, substitute with `tflite-runtime` for inference-only:

```bash
pip install tflite-runtime
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Partial                                                                                                                                                                                                                                                                                           |
| Architecture     | aarch64 for Python components; MATLAB/LabVIEW components are x86 only                                                                                                                                                                                                                             |
| RAM Requirement  | ~1-2GB (ML model loading + dataset processing)                                                                                                                                                                                                                                                    |
| Limiting Factors | MATLAB Runtime unavailable on ARM64. LabVIEW requires x86 NI hardware. Only the Python ML classification pipeline runs on RPi5. TensorFlow on ARM64 is supported but resource-intensive; use tflite-runtime for inference. Training new models on RPi5 is impractical due to CPU/RAM constraints. |
