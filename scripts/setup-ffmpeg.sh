#!/usr/bin/env bash
#
# Download pre-built FFmpeg libraries from CI releases for local development.
# This ensures local builds match CI exactly.
#
# Usage:
#   ./scripts/setup-ffmpeg.sh              # Auto-detect platform
#   ./scripts/setup-ffmpeg.sh darwin-arm64 # Specific platform
#   ./scripts/setup-ffmpeg.sh darwin-x64   # For Intel Mac testing
#   ./scripts/setup-ffmpeg.sh linux-x64    # For Linux testing (Docker)
#
# After running, rebuild with:
#   npm run build
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$ROOT_DIR/ffmpeg-install"

# Must match ci.yml DEPS_VERSION
DEPS_VERSION="v4"
REPO="pproenca/node-webcodecs"

# Detect platform if not specified
detect_platform() {
    local os=$(uname -s)
    local arch=$(uname -m)

    case "$os" in
        Darwin)
            case "$arch" in
                arm64) echo "darwin-arm64" ;;
                x86_64) echo "darwin-x64" ;;
                *) echo "unknown" ;;
            esac
            ;;
        Linux)
            case "$arch" in
                x86_64) echo "linux-x64" ;;
                *) echo "unknown" ;;
            esac
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

PLATFORM="${1:-$(detect_platform)}"

if [ "$PLATFORM" = "unknown" ]; then
    echo "Error: Could not detect platform. Specify one of:"
    echo "  darwin-arm64  (Apple Silicon Mac)"
    echo "  darwin-x64    (Intel Mac)"
    echo "  linux-x64     (Linux x86_64)"
    exit 1
fi

echo "========================================"
echo "FFmpeg Setup for node-webcodecs"
echo "========================================"
echo "Platform:     $PLATFORM"
echo "Deps version: deps-$DEPS_VERSION"
echo "Install dir:  $INSTALL_DIR"
echo ""

# Check for gh CLI
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is required."
    echo "Install with: brew install gh"
    exit 1
fi

# Check gh auth
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

# Download asset
ASSET_NAME="ffmpeg-$PLATFORM.tar.gz"
DOWNLOAD_PATH="$ROOT_DIR/$ASSET_NAME"

echo "Downloading $ASSET_NAME from deps-$DEPS_VERSION..."
gh release download "deps-$DEPS_VERSION" \
    --repo "$REPO" \
    --pattern "$ASSET_NAME" \
    --output "$DOWNLOAD_PATH" \
    --clobber

# Extract
echo "Extracting to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$DOWNLOAD_PATH" -C "$INSTALL_DIR"

# Cleanup download
rm -f "$DOWNLOAD_PATH"

# Verify extraction
if [ ! -d "$INSTALL_DIR/lib" ] || [ ! -d "$INSTALL_DIR/include" ]; then
    echo "Error: Extraction failed - lib/ or include/ not found"
    exit 1
fi

echo ""
echo "Installed libraries:"
ls -la "$INSTALL_DIR/lib/"*.a 2>/dev/null | head -5

# Run ABI check if on macOS
if [ "$(uname -s)" = "Darwin" ]; then
    echo ""
    echo "Running ABI compatibility check..."
    node "$SCRIPT_DIR/check-macos-abi.cjs" || true
fi

echo ""
echo "========================================"
echo "FFmpeg setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Set environment (optional, auto-detected):"
echo "     export FFMPEG_ROOT=$INSTALL_DIR"
echo ""
echo "  2. Rebuild:"
echo "     npm run build"
echo ""
echo "  3. Test:"
echo "     npm test"
echo ""

# Show cross-platform testing hint if not on native platform
NATIVE_PLATFORM=$(detect_platform)
if [ "$PLATFORM" != "$NATIVE_PLATFORM" ]; then
    echo "Note: You downloaded $PLATFORM but are on $NATIVE_PLATFORM."
    echo "To test $PLATFORM builds, use Docker or appropriate environment."
    echo ""
fi
