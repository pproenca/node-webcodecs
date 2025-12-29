const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 2: Configuration Validation');

const encoder = new native.VideoEncoder({
    output: () => {},
    error: (e) => console.error(e)
});

// Case A: Valid Config (should not throw)
try {
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        bitrate: 1000000,
        framerate: 30
    });
    console.log('Valid config accepted');
} catch (e) {
    console.error('Valid config threw:', e);
    process.exit(1);
}

encoder.close();
console.log('✅ PASS');
