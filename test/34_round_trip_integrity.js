// test/34_round_trip_integrity.js
const assert = require('assert');
const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log('[TEST] Round-Trip Data Integrity Test');

async function testRoundTrip() {
    const WIDTH = 320;
    const HEIGHT = 240;
    const FRAME_COUNT = 30;

    // Store original frame data for comparison
    const originalFrames = [];
    const encodedChunks = [];
    const decodedFrames = [];

    // Step 1: Generate test frames with distinct patterns
    console.log('[TEST] 1. Generating test frames...');
    for (let i = 0; i < FRAME_COUNT; i++) {
        const rgba = new Uint8Array(WIDTH * HEIGHT * 4);

        // Create a gradient pattern that varies per frame
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const idx = (y * WIDTH + x) * 4;
                rgba[idx] = (x + i * 8) % 256;       // R varies with x and frame
                rgba[idx + 1] = (y + i * 8) % 256;   // G varies with y and frame
                rgba[idx + 2] = ((x + y) + i * 4) % 256; // B varies diagonally
                rgba[idx + 3] = 255;                  // A
            }
        }

        originalFrames.push({
            timestamp: i * 33333,
            avgR: rgba.filter((_, idx) => idx % 4 === 0).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            avgG: rgba.filter((_, idx) => idx % 4 === 1).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            avgB: rgba.filter((_, idx) => idx % 4 === 2).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
            data: Buffer.from(rgba.buffer)
        });
    }
    console.log(`  Generated ${FRAME_COUNT} frames`);

    // Step 2: Encode all frames
    console.log('[TEST] 2. Encoding frames...');
    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            encodedChunks.push({
                type: chunk.type,
                timestamp: chunk.timestamp,
                byteLength: chunk.byteLength,
                data: (() => {
                    const buf = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(buf);
                    return Buffer.from(buf);
                })()
            });
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001e',
        width: WIDTH,
        height: HEIGHT,
        bitrate: 2_000_000,
        framerate: 30
    });

    for (let i = 0; i < FRAME_COUNT; i++) {
        const frame = new VideoFrame(originalFrames[i].data, {
            format: 'RGBA',
            codedWidth: WIDTH,
            codedHeight: HEIGHT,
            timestamp: originalFrames[i].timestamp
        });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }

    await encoder.flush();
    encoder.close();

    console.log(`  Encoded ${encodedChunks.length} chunks`);
    assert(encodedChunks.length >= FRAME_COUNT, `Expected at least ${FRAME_COUNT} chunks, got ${encodedChunks.length}`);

    // Step 3: Decode all chunks
    console.log('[TEST] 3. Decoding chunks...');
    const decoder = new VideoDecoder({
        output: (frame) => {
            // Calculate average color values for comparison
            const dest = new Uint8Array(WIDTH * HEIGHT * 4);
            frame.copyTo(dest);

            decodedFrames.push({
                timestamp: frame.timestamp,
                width: frame.codedWidth,
                height: frame.codedHeight,
                avgR: dest.filter((_, idx) => idx % 4 === 0).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
                avgG: dest.filter((_, idx) => idx % 4 === 1).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT),
                avgB: dest.filter((_, idx) => idx % 4 === 2).reduce((a, b) => a + b, 0) / (WIDTH * HEIGHT)
            });
            frame.close();
        },
        error: (e) => { throw e; }
    });

    decoder.configure({
        codec: 'avc1.42001e',
        codedWidth: WIDTH,
        codedHeight: HEIGHT
    });

    for (const chunk of encodedChunks) {
        const encodedChunk = new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            data: chunk.data
        });
        decoder.decode(encodedChunk);
    }

    await decoder.flush();
    decoder.close();

    console.log(`  Decoded ${decodedFrames.length} frames`);
    assert(decodedFrames.length >= FRAME_COUNT, `Expected at least ${FRAME_COUNT} decoded frames, got ${decodedFrames.length}`);

    // Step 4: Verify data integrity
    console.log('[TEST] 4. Verifying data integrity...');

    // Sort by timestamp for comparison
    decodedFrames.sort((a, b) => a.timestamp - b.timestamp);

    let matchCount = 0;
    const TOLERANCE = 30; // Allow for lossy compression differences

    for (let i = 0; i < Math.min(originalFrames.length, decodedFrames.length); i++) {
        const orig = originalFrames[i];
        const decoded = decodedFrames[i];

        // Check dimensions
        assert.strictEqual(decoded.width, WIDTH, `Frame ${i} width mismatch`);
        assert.strictEqual(decoded.height, HEIGHT, `Frame ${i} height mismatch`);

        // Check timestamp (decoded may use pts-based timing which differs from input)
        // Just verify timestamps are monotonically increasing across decoded frames
        if (i > 0) {
            assert(decoded.timestamp >= decodedFrames[i-1].timestamp,
                `Frame ${i} timestamp not monotonic: ${decoded.timestamp} < ${decodedFrames[i-1].timestamp}`);
        }

        // Check color averages are in reasonable range (lossy compression)
        const rDiff = Math.abs(orig.avgR - decoded.avgR);
        const gDiff = Math.abs(orig.avgG - decoded.avgG);
        const bDiff = Math.abs(orig.avgB - decoded.avgB);

        if (rDiff < TOLERANCE && gDiff < TOLERANCE && bDiff < TOLERANCE) {
            matchCount++;
        }
    }

    const matchRate = matchCount / FRAME_COUNT;
    console.log(`  Color match rate: ${(matchRate * 100).toFixed(1)}% (${matchCount}/${FRAME_COUNT})`);

    // At least 80% of frames should have similar colors after lossy compression
    assert(matchRate >= 0.8, `Expected at least 80% color match, got ${(matchRate * 100).toFixed(1)}%`);

    // Step 5: Verify keyframe presence
    console.log('[TEST] 5. Verifying keyframe structure...');
    const keyframes = encodedChunks.filter(c => c.type === 'key');
    assert(keyframes.length >= 1, 'Expected at least one keyframe');
    console.log(`  Found ${keyframes.length} keyframes`);

    console.log('[PASS] Round-trip integrity test passed!');
}

testRoundTrip().catch(e => {
    console.error('[FAIL]', e);
    process.exit(1);
});
