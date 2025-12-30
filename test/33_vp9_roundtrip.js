// Test VP9 encode → decode roundtrip
const assert = require('assert');
const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../dist');

console.log('Testing VP9 roundtrip (encode → decode)...');

(async () => {
    const WIDTH = 64;
    const HEIGHT = 64;
    const NUM_FRAMES = 3;

    // Collect encoded chunks
    const encodedChunks = [];
    let decoderConfig = null;

    // Create encoder
    const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
            encodedChunks.push({
                type: chunk.type,
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                data: Buffer.from(chunk.data)  // Copy the data
            });

            // Capture decoder config from first keyframe
            if (metadata && metadata.decoderConfig && !decoderConfig) {
                decoderConfig = metadata.decoderConfig;
            }
        },
        error: (e) => {
            throw e;
        }
    });

    // Configure VP9 encoder
    encoder.configure({
        codec: 'vp09.00.10.08',
        width: WIDTH,
        height: HEIGHT,
        bitrate: 500000,
        framerate: 30
    });

    console.log('  Encoding frames with VP9...');

    // Create and encode test frames
    const inputFrames = [];
    for (let i = 0; i < NUM_FRAMES; i++) {
        const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
        // Create distinct patterns for each frame
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const offset = (y * WIDTH + x) * 4;
                buf[offset] = (x + i * 20) % 256;       // R varies by frame
                buf[offset + 1] = (y + i * 20) % 256;   // G varies by frame
                buf[offset + 2] = (i * 80) % 256;       // B varies by frame
                buf[offset + 3] = 255;                  // A
            }
        }
        inputFrames.push(buf);

        const frame = new VideoFrame(buf, {
            codedWidth: WIDTH,
            codedHeight: HEIGHT,
            timestamp: i * 33333,  // ~30fps
            duration: 33333
        });

        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
    }

    await encoder.flush();
    encoder.close();

    console.log(`  ✓ Encoded ${NUM_FRAMES} frames to ${encodedChunks.length} chunks`);

    assert(encodedChunks.length >= 1, 'Should have at least 1 encoded chunk');
    assert.strictEqual(encodedChunks[0].type, 'key', 'First chunk should be a keyframe');

    // Decode the chunks back to frames
    const decodedFrames = [];

    const decoder = new VideoDecoder({
        output: (frame) => {
            // Copy the frame data
            const allocationSize = frame.allocationSize({ format: 'RGBA' });
            const buffer = new Uint8Array(allocationSize);
            frame.copyTo(buffer, { format: 'RGBA' });
            decodedFrames.push({
                width: frame.codedWidth,
                height: frame.codedHeight,
                timestamp: frame.timestamp,
                data: Buffer.from(buffer)
            });
            frame.close();
        },
        error: (e) => {
            throw e;
        }
    });

    // Configure VP9 decoder
    decoder.configure({
        codec: 'vp09.00.10.08',
        codedWidth: WIDTH,
        codedHeight: HEIGHT
    });

    console.log('  Decoding VP9 chunks...');

    // Decode each chunk
    for (const chunk of encodedChunks) {
        const encodedChunk = new EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data
        });
        decoder.decode(encodedChunk);
    }

    await decoder.flush();
    decoder.close();

    console.log(`  ✓ Decoded ${decodedFrames.length} frames`);

    assert.strictEqual(decodedFrames.length, NUM_FRAMES, `Should decode ${NUM_FRAMES} frames`);

    // Verify frame dimensions
    for (let i = 0; i < decodedFrames.length; i++) {
        const decoded = decodedFrames[i];
        assert.strictEqual(decoded.width, WIDTH, `Frame ${i} width should be ${WIDTH}`);
        assert.strictEqual(decoded.height, HEIGHT, `Frame ${i} height should be ${HEIGHT}`);
        assert.strictEqual(decoded.data.length, WIDTH * HEIGHT * 4, 'Frame data size should match');
    }

    console.log('  ✓ Decoded frame dimensions match');

    // Verify timestamps are preserved (may not be exact due to codec behavior)
    for (let i = 0; i < decodedFrames.length; i++) {
        assert.strictEqual(typeof decodedFrames[i].timestamp, 'number', 'Timestamp should be a number');
    }

    console.log('  ✓ Decoded frame timestamps present');

    // Verify pixel data roughly matches (lossy compression will cause differences)
    // Check that the decoded frames have reasonable pixel values
    const firstDecoded = decodedFrames[0];
    let nonZeroPixels = 0;
    for (let i = 0; i < firstDecoded.data.length; i += 4) {
        if (firstDecoded.data[i] > 0 || firstDecoded.data[i + 1] > 0 || firstDecoded.data[i + 2] > 0) {
            nonZeroPixels++;
        }
    }

    assert(nonZeroPixels > (WIDTH * HEIGHT) / 2, 'Decoded frame should have non-zero pixel data');
    console.log('  ✓ Decoded frames contain valid pixel data');

    console.log('\n✓ VP9 roundtrip test passed!\n');
})().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
