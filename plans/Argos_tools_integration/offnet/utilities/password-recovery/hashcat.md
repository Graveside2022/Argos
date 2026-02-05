# Hashcat

> **RISK CLASSIFICATION**: MODERATE RISK - PASSWORD RECOVERY TOOL
> World's fastest password recovery utility supporting 350+ hash types including WPA/WPA2/WPA3 handshakes, PMKID captures, NTLM, Kerberos, and enterprise authentication hashes. GPU-accelerated on supported platforms. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: PARTIAL** — Runs on ARM64 in CPU-only mode; no GPU acceleration (VideoCore VII lacks OpenCL/CUDA); WPA2 cracking is slow

| Method               | Supported | Notes                                                                                             |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | No privileged access needed for CPU cracking; mount hash files and wordlists via volumes          |
| **Native Install**   | YES       | `apt install hashcat` on Kali ARM64; recommended; CPU-only, offload heavy cracking to GPU machine |

---

## Tool Description

Hashcat is the world's fastest and most advanced password recovery utility. It supports five attack modes (dictionary, combinator, brute-force/mask, hybrid dictionary+mask, hybrid mask+dictionary) against over 350 hash types. For WiFi operations, hashcat cracks WPA/WPA2 handshakes (hash mode 22000/22001) and PMKID captures extracted by hcxdumptool/hcxtools. It also supports WPA3-SAE (hash mode 32000). Hashcat is primarily designed for GPU acceleration using OpenCL, CUDA, or HIP backends, achieving billions of hash operations per second on modern GPUs. On CPU-only platforms (such as the RPi5), hashcat falls back to CPU-based cracking which is orders of magnitude slower but still functional for targeted attacks with small wordlists or known password patterns. Key features include: rule-based attack engine, Markov chain password candidate generation, distributed cracking support, session pause/resume, automatic performance tuning, and thermal monitoring. Output integrates with the hcxtools pipeline (hcxdumptool -> hcxpcapngtool -> hashcat) for end-to-end WiFi password recovery.

## Category

Password Recovery / Hash Cracking / WPA/WPA2/WPA3 Key Recovery

## Repository

- **GitHub**: https://github.com/hashcat/hashcat
- **Language**: C (core), OpenCL/CUDA (GPU kernels)
- **License**: MIT
- **Stars**: ~25,300

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** -- Hashcat runs well in Docker. The official repository includes Docker build and runtime documentation. On RPi5, hashcat will run in CPU-only mode since there is no GPU available. GPU passthrough (NVIDIA/AMD) is supported on x86_64 hosts with appropriate container runtimes but is not applicable to RPi5 deployment.

### Host OS-Level Requirements

- No `--privileged` required for CPU-only cracking (no hardware access needed)
- No `--net=host` required (hashcat operates on local files, not network interfaces)
- For GPU-accelerated cracking (not applicable on RPi5):
    - NVIDIA: `--gpus=all` with nvidia-container-toolkit installed
    - AMD: `--device /dev/kfd --device /dev/dri/renderD128`
- Volume mounts for hash files, wordlists, and rule files

### Docker-to-Host Communication

- Hash files (`.22000`, `.hccapx`) mounted via volume: `-v /host/hashes:/hashes`
- Wordlists mounted via volume: `-v /host/wordlists:/wordlists`
- Rule files mounted via volume: `-v /host/rules:/rules`
- Cracked results (potfile) via volume: `-v /host/output:/output`
- No network ports required

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y hashcat hashcat-utils hcxtools

# Verify installation
hashcat --version
hashcat -I  # Show available compute devices (CPU on RPi5)

# Example: Crack WPA2 handshake (hash mode 22000)
hashcat -m 22000 -a 0 capture.22000 /usr/share/wordlists/rockyou.txt

# Example: Crack WPA2 with rules
hashcat -m 22000 -a 0 capture.22000 /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# Example: Crack PMKID
hashcat -m 22000 -a 0 pmkid.22000 /usr/share/wordlists/rockyou.txt
```

### Option B: Docker (CPU-only for RPi5)

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    hashcat \
    hashcat-utils \
    hcxtools \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create working directories
RUN mkdir -p /hashes /wordlists /rules /output

# Copy default rules
RUN cp -r /usr/share/hashcat/rules/* /rules/ 2>/dev/null; true

WORKDIR /hashes
ENTRYPOINT ["hashcat"]
```

```bash
# Build
docker build -t argos/hashcat .

# Run - crack WPA2 handshake with dictionary attack
docker run --rm -it \
  -v $(pwd)/hashes:/hashes \
  -v $(pwd)/wordlists:/wordlists \
  -v $(pwd)/output:/output \
  argos/hashcat \
  -m 22000 -a 0 /hashes/capture.22000 /wordlists/rockyou.txt \
  -o /output/cracked.txt

# Run - crack with rules-based attack
docker run --rm -it \
  -v $(pwd)/hashes:/hashes \
  -v $(pwd)/wordlists:/wordlists \
  -v $(pwd)/output:/output \
  argos/hashcat \
  -m 22000 -a 0 /hashes/capture.22000 /wordlists/rockyou.txt \
  -r /rules/best64.rule -o /output/cracked.txt

# Run - brute-force mask attack (8-char lowercase+digits)
docker run --rm -it \
  -v $(pwd)/hashes:/hashes \
  -v $(pwd)/output:/output \
  argos/hashcat \
  -m 22000 -a 3 /hashes/capture.22000 ?l?l?l?l?l?d?d?d \
  -o /output/cracked.txt

# Run - show benchmark (CPU performance on RPi5)
docker run --rm -it \
  argos/hashcat \
  -b -m 22000

# Run - interactive session with pause/resume
docker run --rm -it \
  -v $(pwd)/hashes:/hashes \
  -v $(pwd)/wordlists:/wordlists \
  -v $(pwd)/output:/output \
  -v $(pwd)/sessions:/root/.local/share/hashcat/sessions \
  argos/hashcat \
  -m 22000 -a 0 /hashes/capture.22000 /wordlists/rockyou.txt \
  --session=wpa2crack -o /output/cracked.txt
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** -- Hashcat is available as a pre-built package in the Kali Linux ARM64 repositories. The ARM64 build uses CPU-based OpenCL via pocl (Portable Computing Language) or runs in pure CPU mode. Installs directly via `apt install hashcat` with no compilation required.

### Hardware Constraints

- CPU: Hashcat will use all 4 Cortex-A76 cores for CPU-based cracking. Performance is dramatically lower than GPU-accelerated cracking. Expect ~2,000-5,000 H/s for WPA2 (hash mode 22000) on RPi5 CPU vs. ~500,000+ H/s on a mid-range GPU. CPU will run at sustained high load during cracking -- ensure adequate cooling
- RAM: Memory usage varies by attack mode. Dictionary attacks use minimal RAM (~100-200MB). Brute-force and large rule-based attacks can use more. 8GB is sufficient for all standard operations
- GPU: **No GPU available on RPi5**. The VideoCore VII GPU in the BCM2712 does not support OpenCL/CUDA/HIP compute workloads. All cracking runs on CPU only
- Storage: Wordlists can be large (rockyou.txt is ~130MB, larger lists are 10GB+). Ensure adequate SD card or USB storage
- Thermal: Extended cracking sessions will generate sustained CPU heat. Active cooling (fan) recommended for long runs

### Performance Expectations (RPi5 CPU-Only)

| Hash Type       | Mode  | Estimated Speed  |
| --------------- | ----- | ---------------- |
| WPA/WPA2 PBKDF2 | 22000 | ~2,000-5,000 H/s |
| NTLM            | 1000  | ~50-100 MH/s     |
| MD5             | 0     | ~100-200 MH/s    |
| SHA-256         | 1400  | ~20-50 MH/s      |
| bcrypt          | 3200  | ~50-100 H/s      |

_Note: These are rough estimates. Actual performance varies with workload optimization level._

### Practical Usage on RPi5

- **Small targeted wordlists** (1,000-100,000 entries): Feasible. Minutes to hours for WPA2
- **rockyou.txt** (~14 million entries): Feasible but slow. ~1-2 hours for WPA2 without rules
- **Large wordlists with rules**: Impractical. Days to weeks for WPA2. Offload to GPU-equipped machine
- **Brute-force**: Only practical for very short passwords (6 chars or less for WPA2)
- **Recommended workflow**: Capture PMKID/handshake on RPi5 with hcxdumptool, then transfer hash file to a GPU-equipped machine for cracking. Use RPi5 hashcat only for quick targeted attacks

### Verdict

**PARTIAL** -- Hashcat installs and runs correctly on RPi5 ARM64 via Kali repos. All features work in CPU-only mode. However, WPA2/WPA3 cracking on CPU is orders of magnitude slower than GPU-accelerated cracking, making the RPi5 impractical for large-scale password recovery. The recommended deployment model is to use the RPi5 as a capture platform (hcxdumptool, airodump-ng) and transfer captured hashes to a GPU-equipped machine running hashcat. For small targeted attacks (short wordlists, known password patterns), RPi5 CPU cracking is acceptable. Install hashcat on RPi5 for convenience, but plan for GPU offload in serious engagements.
