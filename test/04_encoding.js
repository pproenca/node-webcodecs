const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 4: End-to-End Encoding');

let chunksReceived = 0;
let firstChunkIsKey = false;

const encoder = new native.VideoEncoder({
    output: (chunk, metadata) => {
        chunksReceived++;
        if (chunksReceived === 1) {
            firstChunkIsKey = chunk.type === 'key';
        }
        console.log(`Chunk ${chunksReceived}: type=${chunk.type} size=${chunk.data.length} ts=${chunk.timestamp}`);
    },
    error: (e) => {
        console.error('Encoder error:', e);
        process.exit(1);
    }
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 640,
    height: 480,
    bitrate: 1000000,
    framerate: 30
});

const w = 640, h = 480;
const frameSize = w * h * 4;

// Encode 30 frames
for (let i = 0; i < 30; i++) {
    const buf = Buffer.alloc(frameSize);
    // Fill with pattern
    for (let j = 0; j < frameSize; j += 4) {
        buf[j] = i * 8;     // R
        buf[j+1] = 128;     // G
        buf[j+2] = 255 - i * 8; // B
        buf[j+3] = 255;     // A
    }

    const frame = new native.VideoFrame(buf, {
        codedWidth: w,
        codedHeight: h,
        timestamp: i * 33333
    });

    encoder.encode(frame);
    frame.close();
}

// Flush to get remaining frames
encoder.flush();
encoder.close();

console.log(`Total chunks received: ${chunksReceived}`);
assert.ok(chunksReceived > 0, 'Should have received encoded chunks');
assert.ok(firstChunkIsKey, 'First chunk must be a keyframe');
console.log('✅ PASS');
