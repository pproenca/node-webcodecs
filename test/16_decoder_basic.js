const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 16: VideoDecoder basic structure');

let frameCount = 0;

const decoder = new native.VideoDecoder({
    output: (frame) => {
        frameCount++;
        console.log(`Decoded frame: ${frame.codedWidth}x${frame.codedHeight}`);
        frame.close();
    },
    error: (e) => {
        console.error('Decoder error:', e);
    }
});

assert.strictEqual(decoder.state, 'unconfigured', 'Initial state should be unconfigured');

decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: 640,
    codedHeight: 480
});

assert.strictEqual(decoder.state, 'configured', 'State should be configured after configure()');

decoder.close();
assert.strictEqual(decoder.state, 'closed', 'State should be closed after close()');

console.log('PASS');
