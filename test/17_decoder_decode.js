const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 17: VideoDecoder decode() and flush()');

// First, encode some frames using VideoEncoder
const encodedChunks = [];

const encoder = new native.VideoEncoder({
    output: (chunk, meta) => {
        // Create EncodedVideoChunk from the raw chunk data
        const encodedChunk = new native.EncodedVideoChunk({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
            data: chunk.data
        });
        encodedChunks.push(encodedChunk);
        console.log(`Encoded chunk: ${chunk.type} | TS: ${chunk.timestamp} | Size: ${chunk.byteLength} bytes`);
    },
    error: (e) => {
        console.error('Encoder error:', e);
    }
});

encoder.configure({
    codec: 'avc1.42001E',
    width: 320,
    height: 240,
    bitrate: 500_000,
    framerate: 30
});

// Create and encode 5 frames with different colors
const width = 320;
const height = 240;

for (let i = 0; i < 5; i++) {
    const buf = Buffer.alloc(width * height * 4);
    // Fill with different colors for each frame
    for (let j = 0; j < width * height; j++) {
        buf[j * 4] = (i * 50) % 256;     // R
        buf[j * 4 + 1] = (i * 30) % 256; // G
        buf[j * 4 + 2] = (i * 70) % 256; // B
        buf[j * 4 + 3] = 255;            // A
    }
    const frame = new native.VideoFrame(buf, {
        codedWidth: width,
        codedHeight: height,
        timestamp: i * 33333 // ~30fps
    });
    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
}

// Flush encoder to get all chunks (native flush is synchronous)
encoder.flush();
console.log(`Encoded ${encodedChunks.length} chunks`);

if (encodedChunks.length === 0) {
    throw new Error('No chunks encoded!');
}

// Now decode the encoded chunks
const decodedFrames = [];

const decoder = new native.VideoDecoder({
    output: (frame) => {
        console.log(`Decoded frame: ${frame.codedWidth}x${frame.codedHeight} @ ${frame.timestamp}`);
        decodedFrames.push({
            width: frame.codedWidth,
            height: frame.codedHeight,
            timestamp: frame.timestamp,
            format: frame.format
        });
        frame.close();
    },
    error: (e) => {
        console.error('Decoder error:', e);
    }
});

assert.strictEqual(decoder.state, 'unconfigured', 'Initial state should be unconfigured');

decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height
});

assert.strictEqual(decoder.state, 'configured', 'State should be configured');

// Decode all chunks
for (const chunk of encodedChunks) {
    decoder.decode(chunk);
}

// Flush decoder to get remaining frames (returns a Promise)
decoder.flush().then(() => {
    console.log(`Decoded ${decodedFrames.length} frames`);

    // Verify we got some decoded frames
    assert.ok(decodedFrames.length > 0, 'Should have decoded at least one frame');

    // Verify dimensions match
    for (const frame of decodedFrames) {
        assert.strictEqual(frame.width, width, 'Decoded frame width should match');
        assert.strictEqual(frame.height, height, 'Decoded frame height should match');
        assert.strictEqual(frame.format, 'RGBA', 'Decoded frame format should be RGBA');
    }

    decoder.close();
    assert.strictEqual(decoder.state, 'closed', 'State should be closed');

    console.log('PASS');
}).catch((e) => {
    console.error('Flush error:', e);
    process.exit(1);
});
