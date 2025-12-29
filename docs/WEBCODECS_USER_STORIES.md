# Feature Specification: WebCodecs API for Node.js

**Feature Branch**: `main`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "Implement the WebCodecs API by forwarding all the calls to the respective calls to ffmpeg via C bindings. Extract the WebCodecs implementation from one of the browsers that currently implement it in such a way that it can be used standalone. Implement a slow but functional JavaScript version of the WebCodecs API."

---

## User Scenarios and Tests *(Required)*

<!--
  User stories are written as prioritized user journeys in order of importance.
  Each user story/journey is independently testable - implementing just one
  should result in a minimum viable product (MVP) that delivers value.
-->

---

# Section A: FFmpeg Native Bindings Implementation

## User Story A1 - Encode Video Frames to H.264 File (Priority: P1)

As a **Node.js developer building a video processing application**, I want to **encode raw video frames into H.264 format** so that I can **create video files server-side without browser dependencies**.

**Reason for this priority**: This is the most fundamental use case for WebCodecs - encoding video. H.264 is the most widely supported codec. Server-side video encoding is the primary value proposition for a Node.js WebCodecs implementation.

**Independent testing**: Can be fully tested by encoding 30 frames of solid color to an H.264 file and playing it back with ffplay/VLC. Provides immediate value for any video generation workflow.

**Acceptance Scenarios**:

1. **Given** a newly created VideoEncoder instance with output and error callbacks, **When** I call `configure()` with codec "avc1.42001E", width 1280, height 720, bitrate 2000000, **Then** the encoder state changes to "configured" and no error is thrown.

2. **Given** a configured VideoEncoder, **When** I create a VideoFrame from an RGBA Buffer (1280×720×4 bytes) with timestamp 0 and call `encode(frame)`, **Then** the output callback receives an EncodedVideoChunk with type "key" within 100ms.

3. **Given** a configured VideoEncoder that has encoded 30 frames, **When** I call `flush()`, **Then** the returned Promise resolves and all remaining encoded chunks are delivered via the output callback.

4. **Given** a configured VideoEncoder, **When** I call `close()`, **Then** the encoder state changes to "closed" and all FFmpeg resources are freed (no memory leaks).

5. **Given** an EncodedVideoChunk received from the output callback, **When** I access its properties, **Then** `type` is "key" or "delta", `timestamp` matches the input frame, `byteLength` is greater than 0, and `data` contains valid H.264 NAL units.

**Test File**: `test/stories/a1-encode-h264.js`

```javascript
// Example test implementation
const { VideoEncoder, VideoFrame } = require('node-webcodecs');
const fs = require('fs');

async function testEncodeH264() {
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
            console.log(`Chunk: type=${chunk.type} size=${chunk.byteLength} ts=${chunk.timestamp}`);
        },
        error: (e) => { throw e; }
    });

    // Scenario 1: Configure encoder
    encoder.configure({
        codec: 'avc1.42001E',
        width: 1280,
        height: 720,
        bitrate: 2000000,
        framerate: 30
    });
    assert.strictEqual(encoder.state, 'configured');

    // Scenario 2: Encode frames
    for (let i = 0; i < 30; i++) {
        const buffer = Buffer.alloc(1280 * 720 * 4);
        // Fill with gradient
        for (let p = 0; p < buffer.length; p += 4) {
            buffer[p] = (i * 8) % 256;     // R
            buffer[p+1] = 128;              // G
            buffer[p+2] = 255 - (i * 8);    // B
            buffer[p+3] = 255;              // A
        }

        const frame = new VideoFrame(buffer, {
            codedWidth: 1280,
            codedHeight: 720,
            timestamp: i * 33333, // microseconds
            format: 'RGBA'
        });

        encoder.encode(frame);
        frame.close();
    }

    // Scenario 3: Flush
    await encoder.flush();

    // Scenario 4: Close
    encoder.close();
    assert.strictEqual(encoder.state, 'closed');

    // Scenario 5: Verify chunks
    assert.ok(chunks.length > 0, 'Should have received chunks');
    assert.strictEqual(chunks[0].type, 'key', 'First chunk should be keyframe');

    // Write to file
    const output = fs.createWriteStream('test-output.h264');
    for (const chunk of chunks) {
        output.write(chunk.data);
    }
    output.end();

    console.log(`✅ PASS: Encoded ${chunks.length} chunks to test-output.h264`);
}

testEncodeH264().catch(console.error);
```

---

## User Story A2 - Decode H.264 Video to Raw Frames (Priority: P2)

As a **Node.js developer building a video analysis application**, I want to **decode H.264 video into raw video frames** so that I can **process video content server-side for computer vision, thumbnailing, or transcoding**.

**Reason for this priority**: Decoding is the complementary operation to encoding. Together they enable transcoding workflows. Many applications need to read existing video files.

**Independent testing**: Can be fully tested by decoding an H.264 file and verifying frame dimensions and pixel data. Enables video analysis pipelines.

**Acceptance Scenarios**:

1. **Given** a newly created VideoDecoder instance with output and error callbacks, **When** I call `configure()` with codec "avc1.42001E" and optional description (SPS/PPS), **Then** the decoder state changes to "configured".

2. **Given** a configured VideoDecoder, **When** I create an EncodedVideoChunk with type "key" containing valid H.264 keyframe data and call `decode(chunk)`, **Then** the output callback receives a VideoFrame within 100ms.

3. **Given** a VideoFrame received from the decoder output, **When** I access its properties, **Then** `codedWidth` and `codedHeight` match the encoded dimensions, `format` is a valid pixel format, and `timestamp` matches the input chunk.

4. **Given** a VideoFrame from the decoder, **When** I call `copyTo(buffer, {format: 'RGBA'})`, **Then** the buffer is filled with valid RGBA pixel data that can be verified visually or programmatically.

5. **Given** a decoder that has decoded several frames, **When** I call `flush()`, **Then** any buffered frames are delivered and the Promise resolves.

**Test File**: `test/stories/a2-decode-h264.js`

```javascript
// Example test implementation
const { VideoDecoder, EncodedVideoChunk } = require('node-webcodecs');
const fs = require('fs');

async function testDecodeH264() {
    const frames = [];

    const decoder = new VideoDecoder({
        output: (frame) => {
            frames.push(frame);
            console.log(`Frame: ${frame.codedWidth}x${frame.codedHeight} ts=${frame.timestamp}`);
        },
        error: (e) => { throw e; }
    });

    // Scenario 1: Configure decoder
    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 1280,
        codedHeight: 720
    });
    assert.strictEqual(decoder.state, 'configured');

    // Scenario 2: Decode chunks (read from previously encoded file)
    const h264Data = fs.readFileSync('test-output.h264');
    // Parse NAL units and feed as chunks
    // (simplified - real implementation needs NAL unit parsing)
    const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: h264Data.slice(0, 10000) // First keyframe
    });

    decoder.decode(chunk);

    // Scenario 5: Flush
    await decoder.flush();

    // Scenario 3 & 4: Verify frames
    assert.ok(frames.length > 0, 'Should have received frames');
    const frame = frames[0];
    assert.strictEqual(frame.codedWidth, 1280);
    assert.strictEqual(frame.codedHeight, 720);

    // Copy to RGBA buffer
    const rgbaSize = frame.codedWidth * frame.codedHeight * 4;
    const rgbaBuffer = new Uint8Array(rgbaSize);
    await frame.copyTo(rgbaBuffer, { format: 'RGBA' });

    // Cleanup
    frames.forEach(f => f.close());
    decoder.close();

    console.log(`✅ PASS: Decoded ${frames.length} frames`);
}

testDecodeH264().catch(console.error);
```

---

## User Story A3 - Transcode Video from One Format to Another (Priority: P3)

As a **Node.js developer building a media transcoding service**, I want to **decode video in one format and re-encode to another** so that I can **convert user-uploaded videos to a standard format**.

**Reason for this priority**: Transcoding combines decode + encode and is a very common workflow. Requires both A1 and A2 to be complete.

**Independent testing**: Can be tested by transcoding a VP8 WebM file to H.264 MP4 and verifying playback. Enables media conversion services.

**Acceptance Scenarios**:

1. **Given** a VP8-encoded video file, **When** I configure a VideoDecoder with codec "vp8" and decode all chunks, **Then** I receive VideoFrame objects for each decoded frame.

2. **Given** decoded VideoFrames from a VP8 source, **When** I pass each frame to a VideoEncoder configured for H.264, **Then** I receive EncodedVideoChunks in H.264 format.

3. **Given** a transcoding pipeline (decoder → encoder), **When** I process a 10-second video, **Then** the output duration matches the input duration and all frames are transcoded.

4. **Given** a transcoding pipeline, **When** both decoder and encoder are flushed and closed, **Then** no resources are leaked (verified by memory profiling).

**Test File**: `test/stories/a3-transcode.js`

---

## User Story A4 - Encode Audio to AAC (Priority: P4)

As a **Node.js developer building a podcast processing application**, I want to **encode raw audio samples into AAC format** so that I can **create compressed audio files server-side**.

**Reason for this priority**: Audio encoding is essential for complete media workflows. AAC is the most common web audio format.

**Independent testing**: Can be tested by encoding PCM audio data to AAC and verifying playback.

**Acceptance Scenarios**:

1. **Given** a newly created AudioEncoder with output and error callbacks, **When** I call `configure()` with codec "mp4a.40.2", sampleRate 48000, numberOfChannels 2, bitrate 128000, **Then** the encoder state changes to "configured".

2. **Given** a configured AudioEncoder, **When** I create AudioData from Float32 samples (1024 frames, stereo) and call `encode(audioData)`, **Then** the output callback eventually receives an EncodedAudioChunk.

3. **Given** an EncodedAudioChunk from the encoder, **When** I access its properties, **Then** `type` is "key", `timestamp` is correct, and `data` contains valid AAC frames.

**Test File**: `test/stories/a4-encode-aac.js`

---

## User Story A5 - Decode Audio from Various Formats (Priority: P5)

As a **Node.js developer building an audio processing application**, I want to **decode audio from various compressed formats** so that I can **analyze, mix, or transcode audio content**.

**Reason for this priority**: Audio decoding complements audio encoding and enables audio transcoding workflows.

**Independent testing**: Can be tested by decoding an AAC or MP3 file and verifying sample values.

**Acceptance Scenarios**:

1. **Given** a configured AudioDecoder for "mp4a.40.2", **When** I decode EncodedAudioChunks containing AAC data, **Then** the output callback receives AudioData objects with the correct sampleRate and numberOfChannels.

2. **Given** a configured AudioDecoder for "opus", **When** I decode Opus audio data, **Then** I receive decoded AudioData that can be re-encoded or played back.

**Test File**: `test/stories/a5-decode-audio.js`

---

## User Story A6 - Check Codec Support Before Processing (Priority: P6)

As a **Node.js developer**, I want to **check if a specific codec configuration is supported before attempting to use it** so that I can **provide appropriate error messages to users or fall back to alternatives**.

**Reason for this priority**: Essential for graceful degradation and user experience, but requires basic encode/decode to be working first.

**Independent testing**: Can be tested by calling isConfigSupported with various codec strings.

**Acceptance Scenarios**:

1. **Given** a valid H.264 configuration, **When** I call `VideoEncoder.isConfigSupported(config)`, **Then** the returned Promise resolves with `{supported: true, config: {...}}`.

2. **Given** an invalid or unsupported codec string like "xyz123", **When** I call `VideoEncoder.isConfigSupported(config)`, **Then** the returned Promise resolves with `{supported: false}`.

3. **Given** FFmpeg compiled without a specific codec, **When** I call `isConfigSupported` for that codec, **Then** the result correctly indicates it's not supported.

**Test File**: `test/stories/a6-codec-support.js`

---

## User Story A7 - Process Images with ImageDecoder (Priority: P7)

As a **Node.js developer building an image processing service**, I want to **decode images (JPEG, PNG, GIF, WebP) into VideoFrames** so that I can **manipulate images using a consistent API**.

**Reason for this priority**: ImageDecoder is part of the WebCodecs spec but less critical than video/audio codecs for the primary use case.

**Independent testing**: Can be tested by decoding a JPEG image and verifying pixel data.

**Acceptance Scenarios**:

1. **Given** a JPEG image buffer, **When** I create an ImageDecoder with type "image/jpeg" and call `decode()`, **Then** I receive an ImageDecodeResult with a VideoFrame containing the decoded pixels.

2. **Given** an animated GIF, **When** I access `decoder.tracks.selectedTrack.frameCount`, **Then** I get the correct number of frames, and I can decode each frame individually.

**Test File**: `test/stories/a7-image-decoder.js`

---

## User Story A8 - Handle Hardware Acceleration (Priority: P8)

As a **Node.js developer on a system with GPU encoding**, I want to **utilize hardware acceleration** so that I can **encode/decode video faster with lower CPU usage**.

**Reason for this priority**: Hardware acceleration is a performance optimization, not a functional requirement. Requires all basic functionality first.

**Independent testing**: Can be tested by encoding with hardwareAcceleration: "prefer-hardware" and checking if GPU is used via system monitoring.

**Acceptance Scenarios**:

1. **Given** a system with NVIDIA GPU and NVENC, **When** I configure VideoEncoder with hardwareAcceleration "prefer-hardware", **Then** the encoding uses GPU acceleration (verifiable via nvidia-smi).

2. **Given** a system without hardware acceleration, **When** I configure with hardwareAcceleration "prefer-hardware", **Then** the encoder gracefully falls back to software encoding without error.

**Test File**: `test/stories/a8-hardware-acceleration.js`

---

# Section B: Browser Extraction Implementation

## User Story B1 - Use Extracted Chromium WebCodecs (Priority: P1)

As a **Node.js developer who needs browser-compatible behavior**, I want to **use the actual Chromium WebCodecs implementation** so that I can **ensure identical behavior between my Node.js server and Chrome browsers**.

**Reason for this priority**: Browser parity is the primary reason to extract browser code. Using the same implementation guarantees identical codec behavior.

**Independent testing**: Can be tested by running the same encoding test in Node.js and Chrome and comparing output byte-for-byte.

**Acceptance Scenarios**:

1. **Given** the extracted Chromium WebCodecs library is installed, **When** I import `VideoEncoder` from the package, **Then** I get the same class interface as the browser.

2. **Given** the same input frames and configuration, **When** I encode using extracted Chromium WebCodecs and using browser WebCodecs, **Then** the output EncodedVideoChunks are byte-identical.

3. **Given** a codec supported in Chrome, **When** I call `isConfigSupported` with the same config in Node.js, **Then** I get the same supported/unsupported result.

**Test File**: `test/stories/b1-chromium-extract.js`

---

## User Story B2 - Cross-Platform Browser Extraction Build (Priority: P2)

As a **developer distributing a Node.js package**, I want the **extracted browser WebCodecs to build on Windows, macOS, and Linux** so that **users on any platform can install and use the package**.

**Reason for this priority**: Platform support is essential for npm package distribution.

**Independent testing**: Can be tested by building on each platform in CI and running the basic test suite.

**Acceptance Scenarios**:

1. **Given** the source code, **When** I run `npm install` on macOS, **Then** the native addon builds successfully using VideoToolbox.

2. **Given** the source code, **When** I run `npm install` on Linux, **Then** the native addon builds successfully using VAAPI (if available) or software codecs.

3. **Given** the source code, **When** I run `npm install` on Windows, **Then** the native addon builds successfully using Media Foundation.

**Test File**: `test/stories/b2-cross-platform.js` (run in CI matrix)

---

# Section C: Pure JavaScript Implementation

## User Story C1 - Encode Video in Pure JavaScript (Priority: P1)

As a **developer in a restricted environment without native compilation**, I want to **encode video using pure JavaScript/WASM** so that I can **use WebCodecs without requiring a C++ toolchain**.

**Reason for this priority**: Enables use in environments where native addons can't be built (e.g., some serverless platforms, restricted CI systems).

**Independent testing**: Can be tested by encoding frames using only JavaScript/WASM and producing a valid H.264 file.

**Acceptance Scenarios**:

1. **Given** the pure-JS WebCodecs package is installed (no native dependencies), **When** I import VideoEncoder, **Then** I get a working encoder class.

2. **Given** a VideoEncoder configured for H.264, **When** I encode 30 frames, **Then** I receive valid EncodedVideoChunks (may be 10-100x slower than native).

3. **Given** a pure-JS VideoFrame, **When** I call `copyTo()` with format conversion, **Then** the conversion happens correctly (verified by pixel value comparison).

**Test File**: `test/stories/c1-pure-js-encode.js`

```javascript
// Example test implementation
const { VideoEncoder, VideoFrame } = require('node-webcodecs-pure');

async function testPureJSEncode() {
    console.log('Testing Pure JavaScript H.264 encoding...');
    console.log('Note: This will be slower than native implementation');

    const startTime = Date.now();
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk) => {
            chunks.push(chunk);
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240, // Smaller for performance
        bitrate: 500000,
        framerate: 15
    });

    // Encode 15 frames (1 second)
    for (let i = 0; i < 15; i++) {
        const buffer = Buffer.alloc(320 * 240 * 4);
        const frame = new VideoFrame(buffer, {
            codedWidth: 320,
            codedHeight: 240,
            timestamp: i * 66667,
            format: 'RGBA'
        });

        encoder.encode(frame);
        frame.close();

        console.log(`Encoded frame ${i + 1}/15`);
    }

    await encoder.flush();
    encoder.close();

    const elapsed = Date.now() - startTime;
    console.log(`Encoded ${chunks.length} chunks in ${elapsed}ms`);
    console.log(`✅ PASS: Pure JS encoding works (${(elapsed/15).toFixed(0)}ms per frame)`);
}

testPureJSEncode().catch(console.error);
```

---

## User Story C2 - Decode Video in Pure JavaScript (Priority: P2)

As a **developer analyzing video in a serverless function**, I want to **decode video frames using pure JavaScript/WASM** so that I can **extract frames without native dependencies**.

**Reason for this priority**: Decoding is needed for video analysis use cases in restricted environments.

**Independent testing**: Can be tested by decoding an H.264 file and extracting a frame as PNG.

**Acceptance Scenarios**:

1. **Given** the pure-JS VideoDecoder, **When** I configure for H.264 and decode a keyframe, **Then** I receive a valid VideoFrame.

2. **Given** decoded VideoFrames, **When** I call `copyTo()` to get RGBA data, **Then** I can verify the pixel values match expected content.

**Test File**: `test/stories/c2-pure-js-decode.js`

---

## User Story C3 - Zero Native Dependency Installation (Priority: P3)

As a **developer deploying to AWS Lambda or similar serverless platforms**, I want to **install the WebCodecs package without any native compilation step** so that I can **deploy without custom build images**.

**Reason for this priority**: Pure JS value proposition is zero native dependencies.

**Independent testing**: Can be tested by installing in a clean environment without build tools.

**Acceptance Scenarios**:

1. **Given** a clean Node.js environment without gcc/cmake/python, **When** I run `npm install node-webcodecs-pure`, **Then** installation succeeds without errors.

2. **Given** an AWS Lambda Node.js runtime, **When** I deploy a function using the pure-JS package, **Then** it runs without native module errors.

**Test File**: `test/stories/c3-no-native-install.sh`

---

# Section D: Cross-Cutting User Stories

## User Story D1 - Complete Encoding/Decoding Pipeline (Priority: P1)

As a **developer building a video processing pipeline**, I want to **combine VideoEncoder, VideoDecoder, AudioEncoder, and AudioDecoder** so that I can **build a complete media processing workflow**.

**Reason for this priority**: Real applications need all components working together.

**Independent testing**: Can be tested with an end-to-end transcoding workflow.

**Acceptance Scenarios**:

1. **Given** an input video file (H.264+AAC), **When** I decode video, decode audio, re-encode video (VP9), re-encode audio (Opus), **Then** I produce a valid WebM file.

2. **Given** a transcoding pipeline running on large files, **When** memory usage is monitored, **Then** memory remains stable (no leaks from unclosed frames/chunks).

**Test File**: `test/stories/d1-full-pipeline.js`

---

## User Story D2 - Error Handling and Recovery (Priority: P2)

As a **developer building a robust application**, I want **clear error messages and the ability to recover from errors** so that I can **handle edge cases gracefully**.

**Reason for this priority**: Production applications need proper error handling.

**Independent testing**: Can be tested by intentionally triggering errors and verifying behavior.

**Acceptance Scenarios**:

1. **Given** a VideoEncoder in "unconfigured" state, **When** I call `encode()` without configuring, **Then** the error callback receives an InvalidStateError DOMException.

2. **Given** invalid encoded data, **When** I call `decode()`, **Then** the error callback receives a DataError and the decoder can continue with valid data after `reset()`.

3. **Given** an encoder that encounters an error, **When** I call `reset()`, **Then** it returns to "unconfigured" state and can be reconfigured.

**Test File**: `test/stories/d2-error-handling.js`

---

## User Story D3 - Memory Management and Resource Cleanup (Priority: P3)

As a **developer running long-lived video processing servers**, I want **proper memory management with explicit resource cleanup** so that I can **avoid memory leaks in production**.

**Reason for this priority**: Memory leaks in native code can crash servers.

**Independent testing**: Can be tested by processing many frames and monitoring memory usage.

**Acceptance Scenarios**:

1. **Given** a VideoFrame, **When** I call `close()`, **Then** the underlying memory is freed immediately (not waiting for GC).

2. **Given** a VideoEncoder processing 1000 frames, **When** each frame is closed after encoding, **Then** memory usage remains stable.

3. **Given** forgetting to call `close()` on frames, **When** frames go out of scope, **Then** the garbage collector eventually frees them (with console warning in debug mode).

**Test File**: `test/stories/d3-memory-management.js`

---

## User Story D4 - TypeScript Type Definitions (Priority: P4)

As a **TypeScript developer**, I want **accurate type definitions for all WebCodecs classes** so that I can **use the API with full type safety**.

**Reason for this priority**: TypeScript is widely used and types improve developer experience.

**Independent testing**: Can be tested by compiling TypeScript code using the WebCodecs API.

**Acceptance Scenarios**:

1. **Given** the package installed, **When** I import types in TypeScript, **Then** all types are available and match the WebCodecs spec.

2. **Given** incorrect usage (wrong parameter type), **When** I compile TypeScript, **Then** I get a compile-time error.

3. **Given** VideoEncoderConfig, **When** I use it in TypeScript, **Then** autocomplete shows all properties with correct types.

**Test File**: `test/stories/d4-typescript-types.ts`

---

## User Story D5 - Performance Benchmarking (Priority: P5)

As a **developer choosing a WebCodecs implementation**, I want to **benchmark performance** so that I can **make informed decisions about which implementation to use**.

**Reason for this priority**: Performance is important for choosing between FFmpeg/Browser/Pure-JS implementations.

**Independent testing**: Can be run as a benchmark suite.

**Acceptance Scenarios**:

1. **Given** the benchmark suite, **When** I run `npm run benchmark`, **Then** I see FPS, encoding time, and memory usage for each implementation.

2. **Given** FFmpeg native implementation, **When** encoding 1080p at 30fps, **Then** real-time encoding is achievable (30+ fps throughput).

3. **Given** Pure-JS implementation, **When** compared to FFmpeg native, **Then** the performance difference is documented (expected 10-100x slower).

**Test File**: `test/stories/d5-benchmark.js`

---

### Edge Cases

- **What happens when encoding dimensions are not divisible by 2?** The encoder should either pad automatically or throw a clear error for I420 format.
- **What happens when the encoder output callback throws an error?** The encoder should not crash but may stop encoding and call the error callback.
- **What happens when memory runs out during encoding?** The error callback should receive an appropriate error.
- **How does the system handle very large frames (8K video)?** Should work if memory is available, or fail gracefully.
- **What happens when timestamps are out of order?** Encoder behavior is codec-dependent; should document expected behavior.
- **How does the system handle invalid NAL unit data during decoding?** Should call error callback with DataError, allow recovery.
- **What happens when close() is called multiple times?** Should be idempotent (no error on second call).
- **How does the system handle zero-duration chunks?** Should accept or reject with clear documentation.
- **What happens when encoder is configured twice without reset?** Should throw InvalidStateError.
- **How does the system behave under memory pressure?** Should fail gracefully rather than crash.

---

## Requirements *(Required)*

### Functional Requirements

#### Core Codec Requirements

- **FR-001**: The system must implement VideoEncoder class matching the W3C WebCodecs specification
- **FR-002**: The system must implement VideoDecoder class matching the W3C WebCodecs specification
- **FR-003**: The system must implement AudioEncoder class matching the W3C WebCodecs specification
- **FR-004**: The system must implement AudioDecoder class matching the W3C WebCodecs specification
- **FR-005**: The system must implement VideoFrame class with all specified properties and methods
- **FR-006**: The system must implement AudioData class with all specified properties and methods
- **FR-007**: The system must implement EncodedVideoChunk class with all specified properties
- **FR-008**: The system must implement EncodedAudioChunk class with all specified properties
- **FR-009**: The system must implement VideoColorSpace class
- **FR-010**: The system must implement ImageDecoder class

#### Video Codec Support

- **FR-011**: The system must support H.264/AVC encoding and decoding (codec strings: avc1.*)
- **FR-012**: The system must support VP8 encoding and decoding (codec string: vp8)
- **FR-013**: The system must support VP9 encoding and decoding (codec strings: vp09.*)
- **FR-014**: The system should support AV1 encoding and decoding (codec strings: av01.*)
- **FR-015**: The system should support HEVC/H.265 where platform supports it (codec strings: hev1.*, hvc1.*)

#### Audio Codec Support

- **FR-016**: The system must support AAC encoding and decoding (codec strings: mp4a.40.*)
- **FR-017**: The system must support Opus encoding and decoding (codec string: opus)
- **FR-018**: The system should support MP3 decoding (codec string: mp3)
- **FR-019**: The system should support FLAC decoding (codec string: flac)

#### Pixel Format Support

- **FR-020**: The system must support I420 (YUV 4:2:0) pixel format
- **FR-021**: The system must support NV12 pixel format
- **FR-022**: The system must support RGBA pixel format
- **FR-023**: The system must support BGRA pixel format
- **FR-024**: The system must support format conversion between all supported formats

#### Audio Sample Format Support

- **FR-025**: The system must support f32 (32-bit float) sample format
- **FR-026**: The system must support s16 (16-bit signed integer) sample format
- **FR-027**: The system must support both interleaved and planar audio layouts

#### State Management

- **FR-028**: The system must implement correct state machine transitions (unconfigured → configured → closed)
- **FR-029**: The system must throw InvalidStateError when methods are called in wrong state
- **FR-030**: The system must support reset() to return to unconfigured state

#### Callback Handling

- **FR-031**: The system must call output callback synchronously when encoded/decoded data is available
- **FR-032**: The system must call error callback when errors occur during encoding/decoding
- **FR-033**: The system must include metadata (decoderConfig) with relevant encoded chunks

#### Resource Management

- **FR-034**: The system must free native resources when close() is called
- **FR-035**: The system must prevent memory leaks from unclosed VideoFrame/AudioData objects
- **FR-036**: The system should warn in debug mode when objects are garbage collected without close()

### Key Entities

- **VideoEncoder**: Encodes VideoFrame objects into EncodedVideoChunk objects using a configured codec
- **VideoDecoder**: Decodes EncodedVideoChunk objects into VideoFrame objects
- **AudioEncoder**: Encodes AudioData objects into EncodedAudioChunk objects using a configured codec
- **AudioDecoder**: Decodes EncodedAudioChunk objects into AudioData objects
- **VideoFrame**: Represents a single video frame with pixel data, dimensions, timestamp, and color space
- **AudioData**: Represents audio samples with format, sample rate, channel count, and sample data
- **EncodedVideoChunk**: Represents a chunk of encoded video data with type (key/delta), timestamp, and data
- **EncodedAudioChunk**: Represents a chunk of encoded audio data with type, timestamp, and data
- **VideoColorSpace**: Represents color space parameters (primaries, transfer, matrix, full range)
- **ImageDecoder**: Decodes image formats (JPEG, PNG, GIF, WebP) into VideoFrame objects

---

## Success Criteria *(Required)*

### Measurable Outcomes

#### Functionality

- **SC-001**: All 10 core WebCodecs classes are implemented with spec-compliant interfaces
- **SC-002**: H.264 encoding produces output playable by VLC and browser video players
- **SC-003**: Round-trip encode→decode produces visually identical frames (PSNR > 30dB)
- **SC-004**: All tests in the test suite pass on macOS, Linux, and Windows

#### Performance (FFmpeg Native)

- **SC-005**: 1080p H.264 encoding achieves >= 30 fps throughput on modern hardware
- **SC-006**: 4K H.264 decoding achieves >= 30 fps throughput on modern hardware
- **SC-007**: Memory usage remains stable when processing 10,000+ frames
- **SC-008**: CPU usage is lower than pure-software approaches due to FFmpeg optimization

#### Performance (Pure JavaScript)

- **SC-009**: Pure-JS implementation encodes at >= 1 fps for 720p video (functional but slow)
- **SC-010**: Pure-JS implementation works in Node.js without any native dependencies
- **SC-011**: Pure-JS implementation passes all functional tests (same test suite)

#### Developer Experience

- **SC-012**: npm install completes successfully without manual steps (native deps auto-detected)
- **SC-013**: TypeScript types provide full autocomplete and type checking
- **SC-014**: Error messages include actionable information (codec not found, invalid parameter, etc.)
- **SC-015**: Documentation includes working examples for all common use cases

#### Browser Parity (Extracted Implementation)

- **SC-016**: Encoding with identical inputs produces byte-identical output to Chrome
- **SC-017**: isConfigSupported returns identical results to Chrome for all tested configs
- **SC-018**: All Chrome WebCodecs conformance tests pass

---

## Test Matrix

| Implementation | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | Status |
|---------------|----|----|----|----|----|----|----|----|--------|
| FFmpeg Native | 🔄 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | In Progress |
| Chromium Extract | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |
| Pure JavaScript | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Not Started |

Legend: ✅ Complete | 🔄 In Progress | ⬜ Not Started

---

*This specification was generated based on the W3C WebCodecs specification and the three implementation approaches defined in the project requirements.*
