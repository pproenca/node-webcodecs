#!/bin/bash
# ==============================================================================
# FFmpeg Static Build Script for node-webcodecs
#
# Usage: ./build.sh [platform]
# Platforms: linux-x64, linux-x64-musl, darwin-arm64, darwin-x64
#
# This script builds FFmpeg with static linking for use as development
# libraries when building the native Node.js addon.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# macOS deployment target - must match binding.gyp MACOSX_DEPLOYMENT_TARGET
# This ensures ABI compatibility between FFmpeg libs and the native addon.
MACOS_DEPLOYMENT_TARGET="${MACOS_DEPLOYMENT_TARGET:-11.0}"

# Load versions from JSON (jq is required)
if ! command -v jq &> /dev/null; then
    echo "ERROR: jq is required for reading versions.json"
    echo "Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
fi

if [ ! -f "$SCRIPT_DIR/versions.json" ]; then
    echo "ERROR: versions.json not found at $SCRIPT_DIR/versions.json"
    exit 1
fi

VERSIONS=$(cat "$SCRIPT_DIR/versions.json") || {
    echo "ERROR: Failed to read versions.json"
    exit 1
}

# Parse and validate all required version fields
FFMPEG_VERSION=$(echo "$VERSIONS" | jq -r '.ffmpeg // empty')
X264_VERSION=$(echo "$VERSIONS" | jq -r '.x264 // empty')
X265_VERSION=$(echo "$VERSIONS" | jq -r '.x265 // empty')
LIBVPX_VERSION=$(echo "$VERSIONS" | jq -r '.libvpx // empty')
LIBAOM_VERSION=$(echo "$VERSIONS" | jq -r '.libaom // empty')
OPUS_VERSION=$(echo "$VERSIONS" | jq -r '.opus // empty')
LAME_VERSION=$(echo "$VERSIONS" | jq -r '.lame // empty')

# Validate required fields are present
for var in FFMPEG_VERSION X264_VERSION X265_VERSION LIBVPX_VERSION LIBAOM_VERSION OPUS_VERSION LAME_VERSION; do
    if [ -z "${!var}" ]; then
        echo "ERROR: versions.json is missing required field: $(echo $var | tr '_' '.' | tr '[:upper:]' '[:lower:]' | sed 's/\.version//')"
        echo "Ensure versions.json contains all required codec versions."
        exit 1
    fi
done

# Detect platform
detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)

    # Normalize architecture
    case "$arch" in
        x86_64) arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
    esac

    # Check for musl on Linux
    if [ "$os" = "linux" ]; then
        if ldd --version 2>&1 | grep -qi musl; then
            echo "linux-${arch}-musl"
        else
            echo "linux-${arch}"
        fi
    else
        echo "${os}-${arch}"
    fi
}

PLATFORM="${1:-$(detect_platform)}"
BUILD_DIR="$SCRIPT_DIR/build/$PLATFORM"
PREFIX="$BUILD_DIR/install"
SOURCES_DIR="$BUILD_DIR/sources"
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "=============================================="
echo "FFmpeg Static Build"
echo "=============================================="
echo "Platform:     $PLATFORM"
echo "FFmpeg:       $FFMPEG_VERSION"
echo "Build dir:    $BUILD_DIR"
echo "Install dir:  $PREFIX"
echo "Parallel:     $NPROC jobs"
echo "=============================================="

mkdir -p "$BUILD_DIR" "$PREFIX"/{include,lib,bin} "$SOURCES_DIR"
cd "$SOURCES_DIR"

export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export PATH="$PREFIX/bin:$PATH"

# ==============================================================================
# Build codec dependencies
# ==============================================================================

build_x264() {
    echo ">>> Building x264 ($X264_VERSION)"
    if [ ! -d x264 ]; then
        git clone --depth 1 --branch "$X264_VERSION" https://code.videolan.org/videolan/x264.git
    fi
    cd x264

    local extra_flags=""
    case "$PLATFORM" in
        darwin-arm64)
            extra_flags="--extra-cflags='-arch arm64' --extra-ldflags='-arch arm64'"
            ;;
        darwin-x64)
            extra_flags="--extra-cflags='-arch x86_64' --extra-ldflags='-arch x86_64'"
            ;;
    esac

    ./configure \
        --prefix="$PREFIX" \
        --enable-static \
        --disable-shared \
        --enable-pic \
        --disable-cli \
        $extra_flags

    make -j"$NPROC"
    make install
    cd ..
}

build_x265() {
    echo ">>> Building x265 ($X265_VERSION)"
    if [ ! -d x265_git ]; then
        git clone --depth 1 https://bitbucket.org/multicoreware/x265_git.git
    fi
    mkdir -p x265_git/build/cmake && cd x265_git/build/cmake

    local cmake_flags=""
    case "$PLATFORM" in
        darwin-arm64)
            cmake_flags="-DCMAKE_OSX_ARCHITECTURES=arm64"
            ;;
        darwin-x64)
            cmake_flags="-DCMAKE_OSX_ARCHITECTURES=x86_64"
            ;;
    esac

    cmake \
        -DCMAKE_INSTALL_PREFIX="$PREFIX" \
        -DLIB_INSTALL_DIR="$PREFIX/lib" \
        -DENABLE_SHARED=OFF \
        -DENABLE_CLI=OFF \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        $cmake_flags \
        ../../source

    make -j"$NPROC"
    make install

    # Ensure pkgconfig file exists
    mkdir -p "$PREFIX/lib/pkgconfig"
    cat > "$PREFIX/lib/pkgconfig/x265.pc" << EOF
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include

Name: x265
Description: H.265/HEVC video encoder
Version: $X265_VERSION
Libs: -L\${libdir} -lx265
Libs.private: -lc++ -lm -lpthread
Cflags: -I\${includedir}
EOF
    cd ../../..
}

build_libvpx() {
    echo ">>> Building libvpx ($LIBVPX_VERSION)"
    if [ ! -d libvpx ]; then
        git clone --depth 1 --branch "$LIBVPX_VERSION" https://chromium.googlesource.com/webm/libvpx.git
    fi
    cd libvpx

    local target=""
    case "$PLATFORM" in
        linux-x64|linux-x64-musl)
            target="x86_64-linux-gcc"
            ;;
        darwin-arm64)
            target="arm64-darwin-gcc"
            ;;
        darwin-x64)
            target="x86_64-darwin-gcc"
            ;;
    esac

    ./configure \
        --prefix="$PREFIX" \
        --target="$target" \
        --enable-vp8 \
        --enable-vp9 \
        --enable-vp9-highbitdepth \
        --enable-static \
        --disable-shared \
        --disable-examples \
        --disable-tools \
        --disable-unit-tests \
        --disable-docs

    make -j"$NPROC"
    make install
    cd ..
}

build_libaom() {
    echo ">>> Building libaom ($LIBAOM_VERSION)"
    if [ ! -d aom ]; then
        git clone --depth 1 --branch "$LIBAOM_VERSION" https://aomedia.googlesource.com/aom
    fi
    mkdir -p aom_build && cd aom_build

    local cmake_flags=""
    case "$PLATFORM" in
        darwin-arm64)
            cmake_flags="-DCMAKE_OSX_ARCHITECTURES=arm64"
            ;;
        darwin-x64)
            cmake_flags="-DCMAKE_OSX_ARCHITECTURES=x86_64"
            ;;
    esac

    cmake \
        -DCMAKE_INSTALL_PREFIX="$PREFIX" \
        -DBUILD_SHARED_LIBS=OFF \
        -DENABLE_DOCS=OFF \
        -DENABLE_EXAMPLES=OFF \
        -DENABLE_TESTS=OFF \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        $cmake_flags \
        ../aom

    make -j"$NPROC"
    make install
    cd ..
}

build_opus() {
    echo ">>> Building opus ($OPUS_VERSION)"
    local opus_tarball="opus-$OPUS_VERSION.tar.gz"
    if [ ! -d "opus-$OPUS_VERSION" ]; then
        curl -fSL "https://downloads.xiph.org/releases/opus/opus-$OPUS_VERSION.tar.gz" -o "$opus_tarball"
        tar xzf "$opus_tarball"
    fi
    cd "opus-$OPUS_VERSION"

    local extra_flags=""
    case "$PLATFORM" in
        darwin-arm64)
            extra_flags="CFLAGS='-arch arm64' LDFLAGS='-arch arm64'"
            ;;
        darwin-x64)
            extra_flags="CFLAGS='-arch x86_64' LDFLAGS='-arch x86_64'"
            ;;
    esac

    ./configure \
        --prefix="$PREFIX" \
        --enable-static \
        --disable-shared \
        --with-pic \
        $extra_flags

    make -j"$NPROC"
    make install
    cd ..
}

build_lame() {
    echo ">>> Building lame ($LAME_VERSION)"
    local lame_tarball="lame-$LAME_VERSION.tar.gz"
    if [ ! -d "lame-$LAME_VERSION" ]; then
        curl -fSL "https://downloads.sourceforge.net/project/lame/lame/$LAME_VERSION/lame-$LAME_VERSION.tar.gz" -o "$lame_tarball"
        tar xzf "$lame_tarball"
    fi
    cd "lame-$LAME_VERSION"

    local extra_flags=""
    case "$PLATFORM" in
        darwin-arm64)
            extra_flags="CFLAGS='-arch arm64' LDFLAGS='-arch arm64'"
            ;;
        darwin-x64)
            extra_flags="CFLAGS='-arch x86_64' LDFLAGS='-arch x86_64'"
            ;;
    esac

    ./configure \
        --prefix="$PREFIX" \
        --enable-static \
        --disable-shared \
        --enable-nasm \
        $extra_flags

    make -j"$NPROC"
    make install
    cd ..
}

# ==============================================================================
# Build FFmpeg
# ==============================================================================

build_ffmpeg() {
    echo ">>> Building FFmpeg ($FFMPEG_VERSION)"
    if [ ! -d ffmpeg ]; then
        git clone --depth 1 --branch "$FFMPEG_VERSION" https://github.com/FFmpeg/FFmpeg.git ffmpeg
    fi
    cd ffmpeg

    # Clean previous builds (only if Makefile exists from prior configure)
    if [ -f Makefile ]; then
        echo "Cleaning previous build..."
        make distclean || echo "Warning: distclean failed, continuing with potentially stale files"
    fi

    local extra_cflags="-I$PREFIX/include -fPIC"
    local extra_ldflags="-L$PREFIX/lib"
    local platform_flags=""

    case "$PLATFORM" in
        darwin-arm64)
            extra_cflags="$extra_cflags -arch arm64 -mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET"
            extra_ldflags="$extra_ldflags -arch arm64 -mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET"
            platform_flags="--enable-videotoolbox --enable-audiotoolbox"
            ;;
        darwin-x64)
            extra_cflags="$extra_cflags -arch x86_64 -mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET"
            extra_ldflags="$extra_ldflags -arch x86_64 -mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET"
            platform_flags="--enable-videotoolbox --enable-audiotoolbox"
            ;;
        linux-x64-musl)
            extra_ldflags="$extra_ldflags -static"
            ;;
    esac

    ./configure \
        --prefix="$PREFIX" \
        --extra-cflags="$extra_cflags" \
        --extra-ldflags="$extra_ldflags" \
        --pkg-config-flags="--static" \
        --enable-static \
        --disable-shared \
        --enable-gpl \
        --enable-version3 \
        --enable-pthreads \
        --enable-runtime-cpudetect \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libvpx \
        --enable-libaom \
        --enable-libopus \
        --enable-libmp3lame \
        --disable-ffplay \
        --disable-ffprobe \
        --disable-doc \
        --disable-debug \
        --disable-network \
        $platform_flags

    make -j"$NPROC"
    make install
    cd ..
}

# ==============================================================================
# Make pkg-config files relocatable
# ==============================================================================

make_relocatable() {
    echo ">>> Making pkg-config files relocatable"
    for pc_file in "$PREFIX/lib/pkgconfig/"*.pc; do
        if [ -f "$pc_file" ]; then
            # Get the original prefix
            original_prefix=$(grep "^prefix=" "$pc_file" | cut -d= -f2)
            if [ -n "$original_prefix" ]; then
                # Replace hardcoded paths with ${prefix} variables
                # Use portable sed pattern: create temp file and move
                local temp_file="${pc_file}.tmp"
                sed \
                    -e "s|^libdir=${original_prefix}/lib|libdir=\${prefix}/lib|" \
                    -e "s|^includedir=${original_prefix}/include|includedir=\${prefix}/include|" \
                    "$pc_file" > "$temp_file" && mv "$temp_file" "$pc_file"
            fi
        fi
    done
}

# ==============================================================================
# Main build sequence
# ==============================================================================

build_x264
build_x265
build_libvpx
build_libaom
build_opus
build_lame
build_ffmpeg
make_relocatable

echo "=============================================="
echo "FFmpeg build complete!"
echo "=============================================="
echo "Headers:   $PREFIX/include"
echo "Libraries: $PREFIX/lib"
echo "Binaries:  $PREFIX/bin"
echo ""
echo "To use for node-webcodecs build:"
echo "  export FFMPEG_ROOT=$PREFIX"
echo "=============================================="
