#!/usr/bin/env bash
# Memory leak detection using Valgrind
# Follows the sharp pattern for comprehensive native memory validation
#
# Usage: ./test/leak/leak.sh
# Requires: valgrind installed on system (Linux only)

set -e

SUPP_DIR="$(dirname "$0")"
ROOT_DIR="$(dirname "$SUPP_DIR")/.."

# Check if valgrind is available
if ! command -v valgrind &> /dev/null; then
    echo "Valgrind not found. Skipping memory leak tests."
    echo "Install with: apt-get install valgrind (Linux) or brew install valgrind (macOS)"
    exit 0
fi

echo "Running Valgrind memory leak checks..."
echo "================================================"

# Tests to run through Valgrind
# Note: We run the guardrails memory test which is designed for leak detection
TESTS=(
    "test/guardrails/memory_sentinel.js"
)

FAILED=0

for test in "${TESTS[@]}"; do
    echo ""
    echo "Checking: $test"
    echo "------------------------------------------------"

    # Set environment variables for memory debugging
    # G_SLICE=always-malloc: Disable GLib memory pooling
    # G_DEBUG=gc-friendly: Make garbage collection more aggressive
    # VIPS_LEAK=1: Enable leak detection in libvips (if used)
    if G_SLICE=always-malloc G_DEBUG=gc-friendly \
       valgrind \
         --suppressions="$SUPP_DIR/ffmpeg.supp" \
         --leak-check=full \
         --show-leak-kinds=definite,indirect \
         --num-callers=20 \
         --error-exitcode=1 \
         --track-origins=yes \
         node --expose-gc "$ROOT_DIR/$test" 2>&1; then
        echo "[PASS] $test"
    else
        echo "[FAIL] $test - memory leaks detected"
        FAILED=1
    fi
done

echo ""
echo "================================================"
if [ $FAILED -eq 0 ]; then
    echo "All memory leak checks passed!"
    exit 0
else
    echo "Memory leak checks failed!"
    exit 1
fi
