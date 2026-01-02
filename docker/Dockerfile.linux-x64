# FFmpeg Static Build Dockerfile for Linux x64
# Uses Alpine Linux with musl libc for truly static binaries
#
# Build: docker build -f Dockerfile.linux-x64 -t ffmpeg-builder:linux-x64 .
# Extract: docker create --name tmp ffmpeg-builder:linux-x64 && docker cp tmp:/build/bin .
#
# Library versions updated: January 2026

FROM alpine:3.21 AS builder

# Build arguments for version pinning (updated Jan 2026)
ARG X264_VERSION=stable
ARG X265_VERSION=3.6
ARG LIBVPX_VERSION=v1.15.2
ARG LIBAOM_VERSION=v3.12.1
ARG OPUS_VERSION=1.5.2
ARG LAME_VERSION=3.100
ARG FFMPEG_VERSION=n8.0

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    git \
    cmake \
    nasm \
    yasm \
    pkgconfig \
    autoconf \
    automake \
    libtool \
    linux-headers \
    perl \
    diffutils \
    coreutils \
    bash \
    wget \
    curl \
    zlib-dev \
    zlib-static

# Set up build environment
ENV PREFIX=/build
ENV PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig
ENV PATH=$PREFIX/bin:$PATH
ENV MAKEFLAGS="-j$(nproc)"

WORKDIR /src

# ============================================================================
# Build x264 (GPL - required for H.264 encoding)
# ============================================================================
RUN git clone --depth 1 --branch ${X264_VERSION} https://code.videolan.org/videolan/x264.git && \
    cd x264 && \
    ./configure \
        --prefix=$PREFIX \
        --enable-static \
        --disable-shared \
        --enable-pic \
        --disable-cli \
        --disable-opencl && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf x264

# ============================================================================
# Build x265 (GPL - required for H.265/HEVC encoding)
# Note: x265 cmake doesn't always install .pc file, so we create it manually
# ============================================================================
RUN git clone --depth 1 https://bitbucket.org/multicoreware/x265_git.git && \
    mkdir -p x265_git/build/linux && \
    cd x265_git/build/linux && \
    cmake -G "Unix Makefiles" \
        -DCMAKE_INSTALL_PREFIX=$PREFIX \
        -DLIB_INSTALL_DIR=$PREFIX/lib \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        -DENABLE_SHARED=OFF \
        -DENABLE_CLI=OFF \
        -DSTATIC_LINK_CRT=ON \
        -DHIGH_BIT_DEPTH=ON \
        ../../source && \
    make -j$(nproc) && \
    make install && \
    mkdir -p $PREFIX/lib/pkgconfig && \
    printf '%s\n' \
        "prefix=/build" \
        "exec_prefix=\${prefix}" \
        "libdir=\${prefix}/lib" \
        "includedir=\${prefix}/include" \
        "" \
        "Name: x265" \
        "Description: H.265/HEVC video encoder" \
        "Version: 3.6" \
        "Libs: -L\${libdir} -lx265" \
        "Libs.private: -lstdc++ -lm -lpthread" \
        "Cflags: -I\${includedir}" \
        > $PREFIX/lib/pkgconfig/x265.pc && \
    cd /src && rm -rf x265_git

# ============================================================================
# Build libvpx (BSD - VP8/VP9 codec)
# ============================================================================
RUN git clone --depth 1 --branch ${LIBVPX_VERSION} https://chromium.googlesource.com/webm/libvpx.git && \
    cd libvpx && \
    ./configure \
        --prefix=$PREFIX \
        --disable-examples \
        --disable-unit-tests \
        --disable-docs \
        --enable-vp9-highbitdepth \
        --enable-static \
        --disable-shared \
        --enable-pic \
        --as=yasm && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf libvpx

# ============================================================================
# Build libaom (BSD - AV1 codec)
# ============================================================================
RUN git clone --depth 1 --branch ${LIBAOM_VERSION} https://aomedia.googlesource.com/aom && \
    mkdir aom_build && \
    cd aom_build && \
    cmake -G "Unix Makefiles" \
        -DCMAKE_INSTALL_PREFIX=$PREFIX \
        -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
        -DBUILD_SHARED_LIBS=OFF \
        -DENABLE_NASM=ON \
        -DENABLE_DOCS=OFF \
        -DENABLE_EXAMPLES=OFF \
        -DENABLE_TESTS=OFF \
        -DCONFIG_AV1_ENCODER=1 \
        -DCONFIG_AV1_DECODER=1 \
        ../aom && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf aom aom_build

# ============================================================================
# Build libopus (BSD - Opus audio codec)
# ============================================================================
RUN wget -q https://downloads.xiph.org/releases/opus/opus-${OPUS_VERSION}.tar.gz && \
    tar xzf opus-${OPUS_VERSION}.tar.gz && \
    cd opus-${OPUS_VERSION} && \
    ./configure \
        --prefix=$PREFIX \
        --disable-shared \
        --enable-static \
        --with-pic \
        --disable-doc \
        --disable-extra-programs && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf opus-${OPUS_VERSION}*

# ============================================================================
# Build libmp3lame (LGPL - MP3 encoder)
# ============================================================================
RUN wget -q "https://downloads.sourceforge.net/project/lame/lame/${LAME_VERSION}/lame-${LAME_VERSION}.tar.gz" && \
    tar xzf lame-${LAME_VERSION}.tar.gz && \
    cd lame-${LAME_VERSION} && \
    ./configure \
        --prefix=$PREFIX \
        --disable-shared \
        --enable-static \
        --with-pic \
        --enable-nasm \
        --disable-frontend && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf lame-${LAME_VERSION}*

# ============================================================================
# Build libogg + libvorbis (BSD - Vorbis audio codec)
# ============================================================================
RUN wget -q https://ftp.osuosl.org/pub/xiph/releases/ogg/libogg-1.3.5.tar.gz && \
    tar xzf libogg-1.3.5.tar.gz && \
    cd libogg-1.3.5 && \
    ./configure \
        --prefix=$PREFIX \
        --disable-shared \
        --enable-static \
        --with-pic && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf libogg-1.3.5*

RUN wget -q https://ftp.osuosl.org/pub/xiph/releases/vorbis/libvorbis-1.3.7.tar.gz && \
    tar xzf libvorbis-1.3.7.tar.gz && \
    cd libvorbis-1.3.7 && \
    ./configure \
        --prefix=$PREFIX \
        --disable-shared \
        --enable-static \
        --with-pic \
        --with-ogg=$PREFIX && \
    make -j$(nproc) && \
    make install && \
    cd .. && rm -rf libvorbis-1.3.7*

# ============================================================================
# Build FFmpeg with all codecs (GPL due to x264/x265)
# ============================================================================
RUN git clone --depth 1 --branch ${FFMPEG_VERSION} https://git.ffmpeg.org/ffmpeg.git && \
    cd ffmpeg && \
    ./configure \
        --prefix=$PREFIX \
        --pkg-config-flags="--static" \
        --extra-cflags="-I$PREFIX/include -static" \
        --extra-ldflags="-L$PREFIX/lib -static" \
        --extra-libs="-lpthread -lm -lstdc++" \
        --enable-gpl \
        --enable-version3 \
        --enable-static \
        --disable-shared \
        --enable-pic \
        --disable-ffplay \
        --disable-doc \
        --disable-debug \
        --disable-network \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libvpx \
        --enable-libaom \
        --enable-libopus \
        --enable-libmp3lame \
        --enable-libvorbis && \
    make -j$(nproc) && \
    make install

# ============================================================================
# Strip debug symbols and verify static linking
# ============================================================================
RUN strip $PREFIX/bin/ffmpeg $PREFIX/bin/ffprobe && \
    echo "=== Verifying static binary ===" && \
    file $PREFIX/bin/ffmpeg && \
    # musl ldd says "Not a valid dynamic program" for static binaries
    # glibc ldd says "not a dynamic executable"
    if ldd $PREFIX/bin/ffmpeg 2>&1 | grep -qE "(not a dynamic executable|Not a valid dynamic program)"; then \
        echo "✓ Binary is fully static"; \
    else \
        echo "✗ Binary has dynamic dependencies:" && ldd $PREFIX/bin/ffmpeg && exit 1; \
    fi && \
    echo "=== Binary sizes ===" && \
    ls -lh $PREFIX/bin/ffmpeg $PREFIX/bin/ffprobe && \
    echo "=== FFmpeg version ===" && \
    $PREFIX/bin/ffmpeg -version

# ============================================================================
# Final stage - includes binaries AND dev files for native addon compilation
# ============================================================================
FROM scratch AS export

COPY --from=builder /build/bin/ffmpeg /build/bin/ffmpeg
COPY --from=builder /build/bin/ffprobe /build/bin/ffprobe

# For extraction via docker cp, we need a runnable container
FROM alpine:3.21 AS runtime

# Copy binaries
COPY --from=builder /build/bin/ffmpeg /build/bin/ffmpeg
COPY --from=builder /build/bin/ffprobe /build/bin/ffprobe

# Copy development files needed for native addon compilation
# These are required by build-prebuilds.yml to link against FFmpeg
COPY --from=builder /build/lib /build/lib
COPY --from=builder /build/include /build/include

# Verify binaries work in clean Alpine environment
RUN /build/bin/ffmpeg -version

CMD ["/build/bin/ffmpeg", "-version"]
