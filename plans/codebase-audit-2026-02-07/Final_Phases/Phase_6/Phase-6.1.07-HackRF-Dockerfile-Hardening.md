# Phase 6.1.07: HackRF Backend Dockerfile Optimization

**Document ID**: ARGOS-AUDIT-P6.1.07
**Parent Document**: Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md
**Original Task ID**: 6.1.7
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM -- Python native extensions require exact library compatibility between build and runtime stages.
**Review Standard**: CIS Docker Benchmark v1.6, DISA STIG Docker Enterprise V2R1, NIST SP 800-190

---

## 1. Objective

Remove build-essential (297 MB) from the final hackrf-backend image and add a multi-stage build to the hackrf-backend Dockerfile. Currently the 730 MB image includes C compilers that are only needed to build the python-hackrf wheel. A multi-stage build compiles native extensions in a builder stage and copies only the compiled wheels to a slim runtime stage, reducing the final image to under 500 MB and eliminating the attack surface of a full C toolchain.

---

## 2. Prerequisites

| Prerequisite                        | Verification Command                                                         | Expected Output                          |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| Docker Engine 27.x                  | `docker --version`                                                           | Docker version 27.5.1 or later           |
| Docker Compose v2                   | `docker compose version`                                                     | Docker Compose version 2.32.4-3 or later |
| hackrf-backend Dockerfile exists    | `ls hackrf_emitter/backend/Dockerfile`                                       | File exists                              |
| requirements.txt exists             | `ls hackrf_emitter/backend/requirements.txt`                                 | File exists                              |
| Backup of hackrf Dockerfile         | `cp hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/Dockerfile.bak` | File exists                              |
| HackRF hardware connected (opt)     | `lsusb \| grep -i hackrf`                                                    | HackRF One listed (optional)             |
| Git working tree clean (or stashed) | `git status --porcelain \| wc -l`                                            | 0 (or known untracked-only count)        |

---

## 3. Dependencies

| Dependency                   | Direction                | Description                                                                                                                |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Phase-6.1.04 (.dockerignore) | Recommended              | Updated .dockerignore reduces build context but is not strictly required for hackrf-backend (it has its own build context) |
| None                         | **BLOCKS THIS TASK**     | This task is independent of the main Dockerfile restructuring (6.1.1)                                                      |
| Phase-6.1.02 Subtask 6.1.2.4 | **BLOCKED BY THIS TASK** | hackrf-backend privilege reduction requires the rebuilt image                                                              |

---

## 4. Rollback Strategy

```bash
# Restore backed-up hackrf Dockerfile
cp hackrf_emitter/backend/Dockerfile.bak hackrf_emitter/backend/Dockerfile

# Rebuild image from restored Dockerfile
docker build -t argos-hackrf-backend:dev -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/

# Recreate container
docker compose -f docker/docker-compose.portainer-dev.yml up -d hackrf-backend

# Verify container is healthy
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 5. Subtask Details

### Subtask 6.1.7.1: Convert to Multi-Stage Build

**Description**: The current single-stage Dockerfile installs `build-essential` (L15) for compiling Cython and python-hackrf, then leaves these build tools in the final image. A multi-stage build compiles in a builder stage and copies only the compiled wheels to a slim runtime stage.

**Files affected**:

- `hackrf_emitter/backend/Dockerfile` -- Complete rewrite

**Changes**: Replace the entire Dockerfile with:

```dockerfile
# Stage 1: Build native extensions
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libhackrf-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir Cython>=3.1.0
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    hackrf \
    libhackrf-dev \
    libusb-1.0-0-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r hackrf && useradd -r -g hackrf hackrf

WORKDIR /app

# Copy compiled Python packages from builder
COPY --from=builder /install /usr/local

COPY . .
RUN chown -R hackrf:hackrf /app

USER hackrf

EXPOSE 8092

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8092/api/health')" || exit 1

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:8092", "app:app"]
```

**Verification commands**:

```bash
# Build the new multi-stage image
docker build -t argos-hackrf-backend:optimized -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/

# Compare sizes
docker image inspect argos-hackrf-backend:dev --format '{{.Size}}' 2>/dev/null | awk '{printf "Old: %.0f MB\n", $1/1024/1024}'
docker image inspect argos-hackrf-backend:optimized --format '{{.Size}}' | awk '{printf "New: %.0f MB\n", $1/1024/1024}'
# Expected: New < 500 MB (down from 730 MB)

# Verify Python imports work
docker run --rm argos-hackrf-backend:optimized python -c "import flask; import numpy; print('OK')"
# Expected: OK

# Verify health check
docker run -d --name hackrf-test argos-hackrf-backend:optimized
sleep 15
docker inspect hackrf-test --format '{{.State.Health.Status}}'
# Expected: healthy
docker rm -f hackrf-test

# Verify build-essential is NOT in the final image
docker run --rm argos-hackrf-backend:optimized dpkg -l build-essential 2>&1 | grep -c "^ii"
# Expected: 0

# Verify gcc is NOT in the final image
docker run --rm argos-hackrf-backend:optimized which gcc 2>&1
# Expected: error (gcc not found)

# Verify non-root user is effective
docker run --rm argos-hackrf-backend:optimized whoami
# Expected: hackrf

docker run --rm argos-hackrf-backend:optimized id
# Expected: uid=NNN(hackrf) gid=NNN(hackrf) groups=NNN(hackrf)

# Verify API can start and respond
docker run -d --name hackrf-api-test -p 18092:8092 argos-hackrf-backend:optimized
sleep 10
curl -sf http://localhost:18092/api/health
# Expected: JSON health response
docker rm -f hackrf-api-test
```

**Acceptance criteria**:

- Final image size under 500 MB.
- `build-essential` not present in final image.
- `gcc` not present in final image.
- All Python imports succeed (flask, numpy, hackrf-related).
- Health check passes.
- Non-root user `hackrf` is effective.
- API responds on port 8092.
- Gunicorn starts with eventlet worker.

---

## 6. Verification Commands

All verification commands are embedded within the subtask above. Summary of key verification steps:

```bash
# V1: Image size under 500 MB
docker image inspect argos-hackrf-backend:optimized --format '{{.Size}}' | awk '{printf "%.0f MB\n", $1/1024/1024}'
# Expected: under 500 MB

# V2: build-essential absent
docker run --rm argos-hackrf-backend:optimized dpkg -l build-essential 2>&1 | grep -c "^ii"
# Expected: 0

# V3: Python imports succeed
docker run --rm argos-hackrf-backend:optimized python -c "import flask; import numpy; print('OK')"
# Expected: OK

# V4: Non-root user
docker run --rm argos-hackrf-backend:optimized whoami
# Expected: hackrf

# V5: Health check passes
docker run -d --name hackrf-hc-test argos-hackrf-backend:optimized
sleep 15
docker inspect hackrf-hc-test --format '{{.State.Health.Status}}'
# Expected: healthy
docker rm -f hackrf-hc-test
```

---

## 7. Acceptance Criteria

1. Final hackrf-backend image size under 500 MB (down from 730 MB).
2. `build-essential` not present in final image (297 MB savings).
3. `gcc`, `g++`, `make` not present in final image (attack surface reduction).
4. All Python imports succeed: flask, numpy, Cython-compiled extensions.
5. Health check embedded in Dockerfile and passes within 15 seconds.
6. Non-root user `hackrf` is effective (verified by `whoami` and `id`).
7. API health endpoint responds correctly on port 8092.
8. Gunicorn starts successfully with eventlet worker class.
9. USB device access works with docker device passthrough (when HackRF connected).

---

## 8. Traceability

| Finding | Description                                                     | Severity    | Subtask |
| ------- | --------------------------------------------------------------- | ----------- | ------- |
| F19     | hackrf-backend includes build-essential (297 MB) in final image | HIGH (perf) | 6.1.7.1 |

---

## 9. Execution Order Notes

This task is in **Phase 2** of the execution order:

```
Phase 0 (IMMEDIATE): 6.1.2.6 (Flask debug -- RCE remediation)
Phase 1 (Parallel): 6.1.4, 6.1.5, 6.1.9, 6.1.10, 6.1.11
Phase 2 (Sequential): 6.1.1, >>> 6.1.7 (THIS TASK) <<<
Phase 3 (Sequential): 6.1.6
Phase 4 (Sequential): 6.1.2, 6.1.3, 6.1.8
```

**Requires**: Phase-6.1.04 (.dockerignore update) is recommended but not strictly required since hackrf-backend uses its own build context (`hackrf_emitter/backend/`).
**Blocks**: Phase-6.1.02 Subtask 6.1.2.4 (hackrf-backend privilege reduction) requires the rebuilt image.
**Parallel with**: Phase-6.1.01 (main Dockerfile stages) is independent and can execute concurrently.

Total estimated execution time: 20-30 minutes (including ARM image rebuild with native extension compilation).

**END OF DOCUMENT**
