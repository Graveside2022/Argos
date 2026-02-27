#!/usr/bin/env bash
# Download ML models for the Argos media-service.
# Whisper base (~142 MB), YOLOX nano ONNX (~4 MB), optionally Demucs (~80 MB).
# Skips downloads if files already exist with correct checksums.
#
# Usage:
#   ./media-service/scripts/download-models.sh [--with-demucs]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_DIR="${SCRIPT_DIR}/../models"

mkdir -p "$MODEL_DIR"

# ── Whisper base model ────────────────────────────────────
WHISPER_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
WHISPER_FILE="${MODEL_DIR}/whisper-base.bin"
WHISPER_SHA256="60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"

# ── YOLOX nano ONNX ──────────────────────────────────────
YOLOX_URL="https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx"
YOLOX_FILE="${MODEL_DIR}/yolox-nano.onnx"
YOLOX_SHA256=""  # Checksum not pinned — verify manually after download

# ── Demucs (optional) ────────────────────────────────────
DEMUCS_URL="https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/htdemucs_ft.onnx"
DEMUCS_FILE="${MODEL_DIR}/demucs-htdemucs_ft.onnx"

download_if_missing() {
    local url="$1"
    local file="$2"
    local expected_sha="${3:-}"
    local name
    name="$(basename "$file")"

    if [[ -f "$file" ]]; then
        if [[ -n "$expected_sha" ]]; then
            local actual_sha
            actual_sha="$(sha256sum "$file" | awk '{print $1}')"
            if [[ "$actual_sha" == "$expected_sha" ]]; then
                echo "  [SKIP] ${name} — already present, checksum OK"
                return 0
            else
                echo "  [WARN] ${name} — checksum mismatch, re-downloading"
            fi
        else
            echo "  [SKIP] ${name} — already present"
            return 0
        fi
    fi

    echo "  [DOWN] ${name} — downloading from $(echo "$url" | cut -d'/' -f3)..."
    if ! curl -fSL --progress-bar -o "$file" "$url"; then
        echo "  [FAIL] ${name} — download failed"
        rm -f "$file"
        return 1
    fi

    if [[ -n "$expected_sha" ]]; then
        local actual_sha
        actual_sha="$(sha256sum "$file" | awk '{print $1}')"
        if [[ "$actual_sha" != "$expected_sha" ]]; then
            echo "  [FAIL] ${name} — checksum mismatch after download"
            rm -f "$file"
            return 1
        fi
    fi

    echo "  [OK]   ${name} — $(du -h "$file" | awk '{print $1}')"
}

echo "=== Argos Media Service — Model Download ==="
echo "Target: ${MODEL_DIR}"
echo ""

echo "── Required Models ──"
download_if_missing "$WHISPER_URL" "$WHISPER_FILE" "$WHISPER_SHA256"
download_if_missing "$YOLOX_URL" "$YOLOX_FILE"

if [[ "${1:-}" == "--with-demucs" ]]; then
    echo ""
    echo "── Optional Models ──"
    download_if_missing "$DEMUCS_URL" "$DEMUCS_FILE"
fi

echo ""
echo "=== Model download complete ==="
ls -lh "$MODEL_DIR"/ 2>/dev/null || true
