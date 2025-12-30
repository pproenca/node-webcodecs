'use strict';

const assert = require('assert');
const { VideoEncoder, VideoFrame } = require('../dist');

async function testCodecSaturation() {
    console.log('[TEST] Codec saturation tracking');

    const chunks = [];
    let maxQueueSize = 0;

    const encoder = new VideoEncoder({
        output: (chunk) => {
            chunks.push(chunk);
        },
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 1000000
    });

    // Rapidly enqueue many frames to trigger saturation
    const frameData = Buffer.alloc(320 * 240 * 4);
    const frames = [];

    for (let i = 0; i < 30; i++) {
        const frame = new VideoFrame(frameData, {
            codedWidth: 320,
            codedHeight: 240,
            timestamp: i * 33333
        });
        frames.push(frame);
    }

    // Enqueue all frames rapidly
    for (let i = 0; i < frames.length; i++) {
        encoder.encode(frames[i], { keyFrame: i === 0 });
        // Track max queue size during encoding
        if (encoder.encodeQueueSize > maxQueueSize) {
            maxQueueSize = encoder.encodeQueueSize;
        }
    }

    console.log(`Max queue size during encoding: ${maxQueueSize}`);

    // Queue should have grown during rapid encoding
    assert.ok(maxQueueSize > 0, 'Queue size should increase during rapid encoding');

    await encoder.flush();

    // After flush, queue should be empty
    assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue should be empty after flush');

    // Close frames
    frames.forEach(f => f.close());
    encoder.close();

    console.log(`[PASS] Codec saturation: max queue=${maxQueueSize}, chunks=${chunks.length}`);
}

testCodecSaturation().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
