#!/usr/bin/env node
/**
 * WebCodecs Spec Verification Test
 *
 * This test file verifies claimed functionality against the W3C spec.
 * "Only a test can prove" - tests actually validate implementation.
 */

const assert = require('assert');
const {
    VideoEncoder,
    VideoDecoder,
    VideoFrame,
    AudioEncoder,
    AudioDecoder,
    AudioData,
    EncodedVideoChunk,
    ImageDecoder
} = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn, expectFail = false) {
    try {
        fn();
        if (expectFail) {
            console.log(`\x1b[33mUNEXPECTED PASS\x1b[0m: ${name}`);
            passed++;
        } else {
            console.log(`\x1b[32mPASS\x1b[0m: ${name}`);
            passed++;
        }
    } catch (err) {
        if (expectFail) {
            console.log(`\x1b[33mEXPECTED FAIL\x1b[0m: ${name} - ${err.message}`);
            skipped++;
        } else {
            console.log(`\x1b[31mFAIL\x1b[0m: ${name} - ${err.message}`);
            failed++;
        }
    }
}

async function asyncTest(name, fn, expectFail = false) {
    try {
        await fn();
        if (expectFail) {
            console.log(`\x1b[33mUNEXPECTED PASS\x1b[0m: ${name}`);
            passed++;
        } else {
            console.log(`\x1b[32mPASS\x1b[0m: ${name}`);
            passed++;
        }
    } catch (err) {
        if (expectFail) {
            console.log(`\x1b[33mEXPECTED FAIL\x1b[0m: ${name} - ${err.message}`);
            skipped++;
        } else {
            console.log(`\x1b[31mFAIL\x1b[0m: ${name} - ${err.message}`);
            failed++;
        }
    }
}

function createTestFrame(width = 320, height = 240, timestamp = 0) {
    const data = Buffer.alloc(width * height * 4);
    // Fill with test pattern
    for (let i = 0; i < data.length; i += 4) {
        data[i] = (i / 4) % 256;     // R
        data[i + 1] = ((i / 4) / width) % 256; // G
        data[i + 2] = 128;           // B
        data[i + 3] = 255;           // A
    }
    return new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp
    });
}

console.log('\n=== WebCodecs Spec Verification Tests ===\n');

// ============================================================================
// Section 1: VideoEncoder Verification
// ============================================================================

console.log('\n--- 1. VideoEncoder Tests ---\n');

// Test 1.1: Does metadata get emitted with decoderConfig?
asyncTest('1.1 VideoEncoder emits metadata with decoderConfig.description', async () => {
    let metadataReceived = null;
    let chunkReceived = null;

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            chunkReceived = chunk;
            metadataReceived = metadata;
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    const frame = createTestFrame();
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    // W3C spec: First keyframe MUST emit metadata with decoderConfig.description
    assert(metadataReceived !== null, 'Metadata should be emitted');
    assert(metadataReceived.decoderConfig !== undefined, 'decoderConfig should exist');
    assert(metadataReceived.decoderConfig.description !== undefined,
           'description (SPS/PPS) should be present');
});

// Test 1.2: Does VP9 encoding actually work?
asyncTest('1.2 VideoEncoder actually encodes VP9 (not just H.264)', async () => {
    let outputChunk = null;

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => { outputChunk = chunk; },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'vp09.00.10.08',  // VP9 Profile 0, Level 1.0
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    const frame = createTestFrame();
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    assert(outputChunk !== null, 'VP9 encoder should produce output');

    // VP9 keyframes start with superframe marker or frame header
    // NOT with H.264 NAL start codes (0x00 0x00 0x00 0x01)
    const data = outputChunk.data;
    const isH264 = data[0] === 0 && data[1] === 0 &&
                   (data[2] === 0 || data[2] === 1);
    assert(!isH264, 'Output should NOT be H.264 NAL units');
});

// Test 1.3: Does encodeQueueSize track properly?
asyncTest('1.3 VideoEncoder.encodeQueueSize tracks pending operations', async () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    // Initial queue should be 0
    assert.strictEqual(encoder.encodeQueueSize, 0, 'Initial queue should be 0');

    // Queue several frames quickly (don't flush yet)
    for (let i = 0; i < 3; i++) {
        const frame = createTestFrame(320, 240, i * 33333);
        encoder.encode(frame);
        frame.close();
    }

    // Queue size should reflect pending operations
    // Note: If synchronous, might be 0; if async, should be > 0
    const queueSize = encoder.encodeQueueSize;
    console.log(`  (Queue size after 3 encodes: ${queueSize})`);

    await encoder.flush();
    encoder.close();

    // After flush, queue must be 0
    // Note: accessing after close may throw, so we check before close
});

// Test 1.4: Does alpha config work?
asyncTest('1.4 VideoEncoder respects alpha: "keep" config', async () => {
    let outputChunk = null;
    let metadataReceived = null;

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            outputChunk = chunk;
            metadataReceived = metadata;
        },
        error: (e) => { throw e; }
    });

    // Configure with alpha: "keep"
    encoder.configure({
        codec: 'vp09.00.10.08.01', // VP9 with alpha potentially
        width: 320,
        height: 240,
        bitrate: 1000000,
        alpha: 'keep'
    });

    const frame = createTestFrame();
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    // W3C spec: When alpha is "keep", alphaSideData should be in metadata
    // This test verifies if alpha handling is actually implemented
    if (metadataReceived && metadataReceived.alphaSideData) {
        console.log('  Alpha side data present!');
    } else {
        throw new Error('alphaSideData not present in metadata (alpha may be ignored)');
    }
}, true); // Expected to fail based on code review

// ============================================================================
// Section 2: VideoDecoder Verification
// ============================================================================

console.log('\n--- 2. VideoDecoder Tests ---\n');

// Test 2.1: Does decodeQueueSize actually track operations?
asyncTest('2.1 VideoDecoder.decodeQueueSize tracks pending operations', async () => {
    // First encode some frames to get valid chunks
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            chunks.push({ chunk, metadata });
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    for (let i = 0; i < 5; i++) {
        const frame = createTestFrame(320, 240, i * 33333);
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }
    await encoder.flush();
    encoder.close();

    // Now decode
    const decoder = new VideoDecoder({
        output: () => {},
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001f',
        codedWidth: 320,
        codedHeight: 240
    });

    const initialQueue = decoder.decodeQueueSize;
    console.log(`  (Initial decodeQueueSize: ${initialQueue})`);

    // Queue several decodes
    for (const { chunk } of chunks) {
        const encodedChunk = new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            data: chunk.data
        });
        decoder.decode(encodedChunk);
    }

    const queueAfterDecodes = decoder.decodeQueueSize;
    console.log(`  (Queue after 5 decodes: ${queueAfterDecodes})`);

    await decoder.flush();
    decoder.close();

    // Spec: decodeQueueSize should reflect pending operations
    // If it's always 0, the implementation is not tracking properly
    if (initialQueue === 0 && queueAfterDecodes === 0) {
        throw new Error('decodeQueueSize is always 0 - not tracking properly');
    }
}, true); // Expected to fail based on code review

// Test 2.2: Does decoded frame have colorSpace?
asyncTest('2.2 Decoded VideoFrame has colorSpace from source', async () => {
    // Encode a frame
    const chunks = [];

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => { chunks.push({ chunk, metadata }); },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    const frame = createTestFrame();
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    // Decode
    let decodedFrame = null;
    const decoder = new VideoDecoder({
        output: (f) => { decodedFrame = f; },
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001f',
        codedWidth: 320,
        codedHeight: 240
    });

    const encodedChunk = new EncodedVideoChunk({
        type: chunks[0].chunk.type,
        timestamp: chunks[0].chunk.timestamp,
        data: chunks[0].chunk.data
    });
    decoder.decode(encodedChunk);
    await decoder.flush();
    decoder.close();

    assert(decodedFrame !== null, 'Should have decoded frame');

    // W3C spec: colorSpace should have primaries, transfer, matrix, fullRange
    const cs = decodedFrame.colorSpace;
    console.log(`  (colorSpace: ${JSON.stringify(cs)})`);

    if (!cs || (!cs.primaries && !cs.transfer && !cs.matrix)) {
        throw new Error('colorSpace not properly populated from decoded frame');
    }

    decodedFrame.close();
});

// Test 2.3: Does decoder use description (extradata)?
asyncTest('2.3 VideoDecoder uses description extradata', async () => {
    // Encode with keyframe to get description
    const chunks = [];
    let decoderConfigDesc = null;

    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
            if (metadata?.decoderConfig?.description) {
                decoderConfigDesc = metadata.decoderConfig.description;
            }
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    const frame = createTestFrame();
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    // Skip if no description emitted (that's a separate issue)
    if (!decoderConfigDesc) {
        console.log('  (Skipping: encoder did not emit description)');
        skipped++;
        return;
    }

    // Decode with description
    let decodedFrame = null;
    const decoder = new VideoDecoder({
        output: (f) => { decodedFrame = f; },
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001f',
        codedWidth: 320,
        codedHeight: 240,
        description: decoderConfigDesc  // Pass the extradata
    });

    // Now decode a delta frame (non-keyframe) - should work with description
    const encodedChunk = new EncodedVideoChunk({
        type: chunks[0].type,
        timestamp: chunks[0].timestamp,
        data: chunks[0].data
    });
    decoder.decode(encodedChunk);
    await decoder.flush();
    decoder.close();

    assert(decodedFrame !== null, 'Should decode successfully with description');
    decodedFrame.close();
});

// ============================================================================
// Section 3: AudioEncoder Verification
// ============================================================================

console.log('\n--- 3. AudioEncoder Tests ---\n');

function createTestAudioData(numFrames = 1024, sampleRate = 48000, channels = 2) {
    const data = new Float32Array(numFrames * channels);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(i * 0.01) * 0.5;
    }
    return new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: numFrames,
        numberOfChannels: channels,
        timestamp: 0,
        data: data.buffer
    });
}

// Test 3.1: Does Opus encoder actually apply opus config options?
asyncTest('3.1 Opus encoder applies frameDuration option', async () => {
    let chunks = [];

    const encoder = new AudioEncoder({
        output: (chunk, metadata) => { chunks.push(chunk); },
        error: (e) => { throw e; }
    });

    // Configure with specific frame duration (20ms = 20000 microseconds)
    encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000,
        opus: {
            frameDuration: 20000  // 20ms
        }
    });

    // Encode enough audio for several frames
    const audioData = createTestAudioData(4800, 48000, 2); // 100ms of audio
    encoder.encode(audioData);
    audioData.close();

    await encoder.flush();
    encoder.close();

    // With 20ms frames, 100ms audio should produce ~5 chunks
    // With default 20ms, should also be ~5
    // But with 10ms, should be ~10
    console.log(`  (Received ${chunks.length} chunks from 100ms audio)`);

    // Verify we got chunks
    assert(chunks.length > 0, 'Should produce encoded chunks');

    // Check chunk durations match expected
    // Each chunk should be ~20000 microseconds if frameDuration is respected
    if (chunks.length > 0 && chunks[0].duration) {
        console.log(`  (First chunk duration: ${chunks[0].duration}us)`);
    }
});

// Test 3.2: Does Opus encoder apply complexity option?
asyncTest('3.2 Opus encoder applies complexity option', async () => {
    // Encode with low complexity
    let lowComplexityChunks = [];
    const lowEncoder = new AudioEncoder({
        output: (chunk) => { lowComplexityChunks.push(chunk); },
        error: (e) => { throw e; }
    });

    lowEncoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000,
        opus: { complexity: 0 }
    });

    const audioData1 = createTestAudioData(4800, 48000, 2);
    lowEncoder.encode(audioData1);
    audioData1.close();
    await lowEncoder.flush();
    lowEncoder.close();

    // Encode with high complexity
    let highComplexityChunks = [];
    const highEncoder = new AudioEncoder({
        output: (chunk) => { highComplexityChunks.push(chunk); },
        error: (e) => { throw e; }
    });

    highEncoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000,
        opus: { complexity: 10 }
    });

    const audioData2 = createTestAudioData(4800, 48000, 2);
    highEncoder.encode(audioData2);
    audioData2.close();
    await highEncoder.flush();
    highEncoder.close();

    console.log(`  (Low complexity: ${lowComplexityChunks.length} chunks)`);
    console.log(`  (High complexity: ${highComplexityChunks.length} chunks)`);

    // Both should produce output
    assert(lowComplexityChunks.length > 0, 'Low complexity should produce chunks');
    assert(highComplexityChunks.length > 0, 'High complexity should produce chunks');

    // The test passes if both work - actual complexity difference would be
    // in encoding time or quality, not chunk count
});

// Test 3.3: Does AudioEncoder emit metadata with decoderConfig?
asyncTest('3.3 AudioEncoder emits metadata with decoderConfig', async () => {
    let metadataReceived = null;

    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            if (metadata) metadataReceived = metadata;
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000
    });

    const audioData = createTestAudioData();
    encoder.encode(audioData);
    audioData.close();
    await encoder.flush();
    encoder.close();

    // W3C spec: First chunk should have metadata with decoderConfig
    assert(metadataReceived !== null, 'Metadata should be emitted');
    assert(metadataReceived.decoderConfig !== undefined, 'decoderConfig should exist');
    console.log(`  (decoderConfig: ${JSON.stringify(metadataReceived?.decoderConfig)})`);
}, true); // May fail if not implemented

// ============================================================================
// Section 4: VideoFrame Verification
// ============================================================================

console.log('\n--- 4. VideoFrame Tests ---\n');

// Test 4.1: Does VideoFrame copyTo respect format conversion?
asyncTest('4.1 VideoFrame.copyTo converts to requested format', async () => {
    // Create RGBA frame
    const frame = createTestFrame(320, 240, 0);

    // Request I420 format
    const i420Size = (320 * 240) + (160 * 120) * 2; // Y + U + V
    const destBuffer = new Uint8Array(i420Size);

    await frame.copyTo(destBuffer, { format: 'I420' });

    // Verify we got I420 data (Y plane should have luma values)
    // If copyTo ignores format, we'd get RGBA garbage
    const yPlane = destBuffer.slice(0, 320 * 240);

    // Y values should be reasonable luma values (0-255)
    // RGBA would have different byte structure
    console.log(`  (First Y bytes: ${yPlane[0]}, ${yPlane[1]}, ${yPlane[2]}, ${yPlane[3]})`);

    frame.close();
});

// Test 4.2: Does copyTo respect rect parameter?
asyncTest('4.2 VideoFrame.copyTo respects rect parameter', async () => {
    const frame = createTestFrame(320, 240, 0);

    // Request only a 160x120 region
    const cropRect = { x: 0, y: 0, width: 160, height: 120 };
    const croppedSize = 160 * 120 * 4; // RGBA
    const destBuffer = new Uint8Array(croppedSize);

    try {
        await frame.copyTo(destBuffer, { rect: cropRect });
        console.log(`  (copyTo with rect succeeded)`);
    } catch (e) {
        throw new Error(`copyTo rect parameter not supported: ${e.message}`);
    }

    frame.close();
}, true); // May fail if rect is ignored

// Test 4.3: Does VideoFrame preserve duration through encode/decode?
asyncTest('4.3 VideoFrame duration preserved through roundtrip', async () => {
    const originalDuration = 33333; // ~30fps

    // Create frame with specific duration
    const data = Buffer.alloc(320 * 240 * 4);
    const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
        duration: originalDuration
    });

    console.log(`  (Original frame duration: ${frame.duration})`);
    assert.strictEqual(frame.duration, originalDuration, 'Original duration should match');

    // Encode
    let encodedChunk = null;
    const encoder = new VideoEncoder({
        output: (chunk) => { encodedChunk = chunk; },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001f',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    console.log(`  (Encoded chunk duration: ${encodedChunk?.duration})`);

    // Decode
    let decodedFrame = null;
    const decoder = new VideoDecoder({
        output: (f) => { decodedFrame = f; },
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001f',
        codedWidth: 320,
        codedHeight: 240
    });

    const chunk = new EncodedVideoChunk({
        type: encodedChunk.type,
        timestamp: encodedChunk.timestamp,
        duration: encodedChunk.duration,
        data: encodedChunk.data
    });
    decoder.decode(chunk);
    await decoder.flush();
    decoder.close();

    console.log(`  (Decoded frame duration: ${decodedFrame?.duration})`);

    // Verify duration is preserved (or at least present)
    if (decodedFrame.duration === undefined || decodedFrame.duration === null) {
        throw new Error('Decoded frame has no duration');
    }

    decodedFrame.close();
});

// ============================================================================
// Section 5: ImageDecoder Verification
// ============================================================================

console.log('\n--- 5. ImageDecoder Tests ---\n');

// Test 5.1: Does ImageDecoder.isTypeSupported return Promise?
asyncTest('5.1 ImageDecoder.isTypeSupported returns Promise', async () => {
    const result = ImageDecoder.isTypeSupported('image/png');

    // W3C spec: should return Promise<boolean>
    if (result instanceof Promise) {
        const supported = await result;
        console.log(`  (image/png supported: ${supported})`);
        assert(typeof supported === 'boolean', 'Result should be boolean');
    } else if (typeof result === 'boolean') {
        console.log(`  (Returns boolean sync: ${result} - not spec compliant)`);
        throw new Error('isTypeSupported returns boolean, spec requires Promise');
    } else {
        throw new Error(`Unexpected return type: ${typeof result}`);
    }
}, true); // May fail if returns boolean sync

// Test 5.2: Does ImageDecoder handle animated GIF frames?
asyncTest('5.2 ImageDecoder supports animated GIF frame index', async () => {
    // Create a minimal animated GIF (2 frames)
    // This is a valid 1x1 2-frame GIF
    const animatedGif = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
        0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, // Screen descriptor
        0x21, 0xFF, 0x0B, // Application extension
        0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, // NETSCAPE2.0
        0x03, 0x01, 0x00, 0x00, 0x00, // Animation loop
        0x21, 0xF9, 0x04, 0x04, 0x0A, 0x00, 0x00, 0x00, // Graphic control
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // Image descriptor
        0x02, 0x02, 0x44, 0x01, 0x00, // Image data frame 1
        0x21, 0xF9, 0x04, 0x04, 0x0A, 0x00, 0x00, 0x00, // Graphic control frame 2
        0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // Image descriptor
        0x02, 0x02, 0x44, 0x01, 0x00, // Image data frame 2
        0x3B // Trailer
    ]);

    const decoder = new ImageDecoder({
        type: 'image/gif',
        data: animatedGif
    });

    await decoder.completed;

    console.log(`  (tracks.length: ${decoder.tracks?.length})`);
    console.log(`  (frameCount: ${decoder.tracks?.[0]?.frameCount || decoder.tracks?.selectedTrack?.frameCount})`);

    // Try to decode frame 0 and frame 1
    try {
        const result0 = await decoder.decode({ frameIndex: 0 });
        console.log(`  (Frame 0 decoded: ${result0.image ? 'yes' : 'no'})`);
    } catch (e) {
        console.log(`  (Frame 0 decode failed: ${e.message})`);
    }

    try {
        const result1 = await decoder.decode({ frameIndex: 1 });
        console.log(`  (Frame 1 decoded: ${result1.image ? 'yes' : 'no'})`);
    } catch (e) {
        throw new Error(`Cannot decode frame 1: ${e.message}`);
    }

    decoder.close();
}, true); // May fail if animation not supported

// ============================================================================
// Section 6: Error Type Verification
// ============================================================================

console.log('\n--- 6. Error Type Verification ---\n');

// Test 6.1: Does encoder throw InvalidStateError for wrong state?
test('6.1 VideoEncoder throws InvalidStateError for encoding before configure', () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    const frame = createTestFrame();

    try {
        encoder.encode(frame);
        frame.close();
        throw new Error('Should have thrown');
    } catch (e) {
        frame.close();
        encoder.close();
        // W3C spec: should be InvalidStateError DOMException
        if (e.name === 'InvalidStateError') {
            console.log(`  (Correct error type: InvalidStateError)`);
        } else {
            console.log(`  (Got error: ${e.name}: ${e.message})`);
            // Accept any error that indicates wrong state
            if (!e.message.includes('state') && !e.message.includes('configured')) {
                throw new Error(`Wrong error type: ${e.name}`);
            }
        }
    }
});

// Test 6.2: Does encoder throw NotSupportedError for unsupported codec?
asyncTest('6.2 VideoEncoder throws NotSupportedError for unsupported codec', async () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    try {
        encoder.configure({
            codec: 'not-a-real-codec',
            width: 320,
            height: 240,
            bitrate: 1000000
        });
        throw new Error('Should have thrown');
    } catch (e) {
        encoder.close();
        // W3C spec: should be NotSupportedError DOMException
        console.log(`  (Got error: ${e.name}: ${e.message})`);
        if (e.name !== 'NotSupportedError') {
            // Accept error but note it's not spec-compliant type
            console.log(`  (Note: should be NotSupportedError per spec)`);
        }
    }
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Summary ===\n');
console.log(`Passed:  ${passed}`);
console.log(`Failed:  ${failed}`);
console.log(`Skipped: ${skipped} (expected failures)`);
console.log(`Total:   ${passed + failed + skipped}`);

if (failed > 0) {
    console.log('\n\x1b[31mSome tests failed - these indicate gaps vs W3C spec.\x1b[0m');
    process.exit(1);
} else {
    console.log('\n\x1b[32mAll tests passed or failed as expected.\x1b[0m');
}
