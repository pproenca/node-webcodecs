const assert = require('assert');
const { VideoEncoder, VideoFrame } = require('../dist/index.js');

console.log('Testing codec-specific quantizer options...');

let chunkCount = 0;

const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
        chunkCount++;
        console.log(`Received chunk ${chunkCount}, type: ${chunk.type}, size: ${chunk.byteLength}`);
    },
    error: (e) => {
        console.error('Encoder error:', e);
        process.exit(1);
    }
});

// Configure with quantizer mode
encoder.configure({
    codec: 'avc1.42001f',
    width: 320,
    height: 240,
    bitrateMode: 'quantizer'
});

// Create and encode frame with quantizer option
const frameData = Buffer.alloc(320 * 240 * 4);
const frame = new VideoFrame(frameData, {
    format: 'RGBA',
    codedWidth: 320,
    codedHeight: 240,
    timestamp: 0
});

// Encode with AVC quantizer option (per W3C spec, avc.quantizer: 0-51)
encoder.encode(frame, {
    keyFrame: true,
    avc: { quantizer: 30 }
});

frame.close();

encoder.flush().then(() => {
    assert(chunkCount > 0, 'Should have received encoded chunks');
    encoder.close();
    console.log('Quantizer options test passed!');
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
