#!/bin/bash
# Build all codec dependencies as static libraries with -fPIC
# Usage: ./build-static-codecs.sh <prefix> [jobs]
#
# Builds: x264, x265, libvpx, opus, libaom, dav1d, svt-av1, lame, ogg, vorbis
# All outputs go to $PREFIX with static .a libraries

set -e

PREFIX="${1:?Usage: $0 <prefix> [jobs]}"
JOBS="${2:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

# Ensure absolute path
PREFIX="$(cd "$(dirname "$PREFIX")" 2>/dev/null && pwd)/$(basename "$PREFIX")" || PREFIX="$(pwd)/$PREFIX"
mkdir -p "$PREFIX"

export CFLAGS="-fPIC -O2"
export CXXFLAGS="-fPIC -O2"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$PKG_CONFIG_PATH"

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

echo "=== Building static codecs to $PREFIX (jobs: $JOBS) ==="
echo "=== Working directory: $WORKDIR ==="

# Detect OS
OS="$(uname -s)"

# -----------------------------------------------------------------------------
# x264 - H.264 encoder (no dependencies)
# -----------------------------------------------------------------------------
build_x264() {
  echo "=== Building x264 ==="
  git clone --depth 1 https://code.videolan.org/videolan/x264.git
  cd x264
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --enable-pic \
    --disable-cli \
    --disable-lavf \
    --disable-swscale
  make -j"$JOBS"
  make install
  cd ..
  echo "=== x264 complete ==="
}

# -----------------------------------------------------------------------------
# x265 - H.265/HEVC encoder (CMake-based)
# -----------------------------------------------------------------------------
build_x265() {
  echo "=== Building x265 ==="
  git clone --depth 1 https://bitbucket.org/multicoreware/x265_git.git
  cd x265_git/build/linux
  cmake -G "Unix Makefiles" \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" \
    -DENABLE_SHARED=OFF \
    -DENABLE_CLI=OFF \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_C_FLAGS="$CFLAGS" \
    -DCMAKE_CXX_FLAGS="$CXXFLAGS" \
    ../../source
  make -j"$JOBS"
  make install

  # Create pkg-config file if not present
  if [ ! -f "$PREFIX/lib/pkgconfig/x265.pc" ]; then
    mkdir -p "$PREFIX/lib/pkgconfig"
    cat > "$PREFIX/lib/pkgconfig/x265.pc" << EOF
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include

Name: x265
Description: H.265/HEVC video encoder
Version: 0.0
Libs: -L\${libdir} -lx265
Libs.private: -lstdc++ -lm -lpthread
Cflags: -I\${includedir}
EOF
  fi
  cd ../../..
  echo "=== x265 complete ==="
}

# -----------------------------------------------------------------------------
# libvpx - VP8/VP9 codec
# -----------------------------------------------------------------------------
build_libvpx() {
  echo "=== Building libvpx ==="
  git clone --depth 1 https://chromium.googlesource.com/webm/libvpx.git
  cd libvpx
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --disable-shared \
    --enable-pic \
    --disable-examples \
    --disable-unit-tests \
    --disable-docs \
    --enable-vp8 \
    --enable-vp9 \
    --enable-postproc \
    --enable-vp9-postproc \
    --enable-vp9-highbitdepth
  make -j"$JOBS"
  make install
  cd ..
  echo "=== libvpx complete ==="
}

# -----------------------------------------------------------------------------
# opus - Audio codec
# -----------------------------------------------------------------------------
build_opus() {
  echo "=== Building opus ==="
  git clone --depth 1 https://github.com/xiph/opus.git
  cd opus
  ./autogen.sh
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --disable-shared \
    --with-pic \
    --disable-doc \
    --disable-extra-programs
  make -j"$JOBS"
  make install
  cd ..
  echo "=== opus complete ==="
}

# -----------------------------------------------------------------------------
# libaom - AV1 encoder/decoder
# -----------------------------------------------------------------------------
build_libaom() {
  echo "=== Building libaom ==="
  git clone --depth 1 https://aomedia.googlesource.com/aom
  mkdir -p aom_build && cd aom_build
  cmake ../aom \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" \
    -DBUILD_SHARED_LIBS=OFF \
    -DENABLE_TESTS=OFF \
    -DENABLE_EXAMPLES=OFF \
    -DENABLE_DOCS=OFF \
    -DENABLE_TOOLS=OFF \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_C_FLAGS="$CFLAGS" \
    -DCMAKE_CXX_FLAGS="$CXXFLAGS"
  make -j"$JOBS"
  make install
  cd ..
  echo "=== libaom complete ==="
}

# -----------------------------------------------------------------------------
# dav1d - AV1 decoder (meson-based)
# -----------------------------------------------------------------------------
build_dav1d() {
  echo "=== Building dav1d ==="
  git clone --depth 1 https://code.videolan.org/videolan/dav1d.git
  cd dav1d
  # Use --libdir to avoid platform-specific subdirectory
  meson setup build \
    --prefix="$PREFIX" \
    --libdir="$PREFIX/lib" \
    --default-library=static \
    --buildtype=release \
    -Denable_tests=false \
    -Denable_tools=false
  ninja -C build
  ninja -C build install
  cd ..
  echo "=== dav1d complete ==="
}

# -----------------------------------------------------------------------------
# SVT-AV1 - AV1 encoder
# -----------------------------------------------------------------------------
build_svtav1() {
  echo "=== Building SVT-AV1 ==="
  git clone --depth 1 https://gitlab.com/AOMediaCodec/SVT-AV1.git
  cd SVT-AV1
  mkdir -p Build && cd Build
  cmake .. -G "Unix Makefiles" \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" \
    -DBUILD_SHARED_LIBS=OFF \
    -DBUILD_TESTING=OFF \
    -DBUILD_APPS=OFF \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DCMAKE_C_FLAGS="$CFLAGS" \
    -DCMAKE_CXX_FLAGS="$CXXFLAGS"
  make -j"$JOBS"
  make install
  cd ../..
  echo "=== SVT-AV1 complete ==="
}

# -----------------------------------------------------------------------------
# lame - MP3 encoder
# -----------------------------------------------------------------------------
build_lame() {
  echo "=== Building lame ==="
  LAME_VERSION="3.100"
  curl -L "https://sourceforge.net/projects/lame/files/lame/${LAME_VERSION}/lame-${LAME_VERSION}.tar.gz/download" -o lame.tar.gz
  tar xzf lame.tar.gz
  cd "lame-${LAME_VERSION}"
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --disable-shared \
    --with-pic \
    --disable-frontend \
    --disable-decoder \
    --disable-analyzer-hooks
  make -j"$JOBS"
  make install

  # Create pkg-config file for libmp3lame (lame doesn't generate one)
  mkdir -p "$PREFIX/lib/pkgconfig"
  cat > "$PREFIX/lib/pkgconfig/libmp3lame.pc" << EOF
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include

Name: libmp3lame
Description: LAME MP3 encoder library
Version: ${LAME_VERSION}
Libs: -L\${libdir} -lmp3lame
Cflags: -I\${includedir}
EOF
  cd ..
  echo "=== lame complete ==="
}

# -----------------------------------------------------------------------------
# libogg - Required by libvorbis
# -----------------------------------------------------------------------------
build_ogg() {
  echo "=== Building libogg ==="
  git clone --depth 1 https://github.com/xiph/ogg.git
  cd ogg
  ./autogen.sh
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --disable-shared \
    --with-pic
  make -j"$JOBS"
  make install
  cd ..
  echo "=== libogg complete ==="
}

# -----------------------------------------------------------------------------
# libvorbis - Vorbis audio codec (depends on libogg)
# -----------------------------------------------------------------------------
build_vorbis() {
  echo "=== Building libvorbis ==="
  git clone --depth 1 https://github.com/xiph/vorbis.git
  cd vorbis
  ./autogen.sh
  ./configure \
    --prefix="$PREFIX" \
    --enable-static \
    --disable-shared \
    --with-pic \
    --with-ogg="$PREFIX"
  make -j"$JOBS"
  make install
  cd ..
  echo "=== libvorbis complete ==="
}

# -----------------------------------------------------------------------------
# Build all codecs in dependency order
# -----------------------------------------------------------------------------

# Independent codecs (can be built in any order)
build_x264
build_x265
build_libvpx
build_opus
build_libaom
build_dav1d
build_svtav1
build_lame

# Dependent codecs (ogg must come before vorbis)
build_ogg
build_vorbis

# Cleanup
cd /
rm -rf "$WORKDIR"

echo ""
echo "=== All codecs built successfully to $PREFIX ==="
echo "=== Libraries: ==="
ls -la "$PREFIX/lib/"*.a 2>/dev/null || echo "  (no .a files found)"
echo "=== pkg-config files: ==="
ls -la "$PREFIX/lib/pkgconfig/"*.pc 2>/dev/null || echo "  (no .pc files found)"
