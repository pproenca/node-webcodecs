#!/usr/bin/env bash
# Memory leak detection using macOS leaks tool
# Usage: ./test/leak/leaks-macos.sh
# Requires: macOS with Xcode Command Line Tools

set -e

ROOT_DIR="$(dirname "$0")/../.."

# Platform check
if [[ "$(uname)" != "Darwin" ]]; then
    echo "This script is for macOS only. Use leak.sh on Linux."
    exit 0
fi

if ! command -v leaks &> /dev/null; then
    echo "leaks not found. Install: xcode-select --install"
    exit 0
fi

echo "Running macOS leaks memory check..."
echo "================================================"

# Exclusions for known library-lifetime allocations (not actual leaks)
EXCLUDE_FLAGS=(
    --exclude "avcodec"
    --exclude "avformat"
    --exclude "swscale"
    --exclude "av_log"
    --exclude "x264"
    --exclude "x265"
    --exclude "vpx"
    --exclude "aom"
    --exclude "opus"
    --exclude "videotoolbox"
    --exclude "v8::"
    --exclude "node::"
    --exclude "uv_"
    --exclude "pthread"
    --exclude "libsystem"
    --exclude "dyld"
    --exclude "OPENSSL"
)

TEST="test/guardrails/memory_sentinel.js"

echo "Checking: $TEST"
echo "------------------------------------------------"

# MallocStackLogging=1 enables stack traces for leak sources
if MallocStackLogging=1 \
   leaks \
     --atExit \
     "${EXCLUDE_FLAGS[@]}" \
     -- \
     node --expose-gc "$ROOT_DIR/$TEST" 2>&1; then
    echo "[PASS] No leaks detected"
    exit 0
else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 1 ]; then
        echo "[FAIL] Memory leaks detected"
        echo ""
        echo "For detailed investigation, run:"
        echo "  MallocStackLogging=1 leaks --atExit -- node --expose-gc $TEST"
        exit 1
    else
        echo "[ERROR] leaks tool error (exit code: $EXIT_CODE)"
        exit 1
    fi
fi
