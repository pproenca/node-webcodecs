const assert = require('assert');
const { AudioDecoder } = require('../dist/index.js');

console.log('Testing AudioDecoder description support...');

async function runTests() {
    // Test isConfigSupported with description
    const aacExtradata = new Uint8Array([0x11, 0x90]); // Example AAC config

    const aacSupport = await AudioDecoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 2,
        description: aacExtradata.buffer
    });

    console.log('AAC with description support:', aacSupport.supported);
    assert.strictEqual(typeof aacSupport.supported, 'boolean');

    // Opus decoder (no description needed)
    const opusSupport = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2
    });

    assert.strictEqual(opusSupport.supported, true, 'Opus should be supported');

    console.log('AudioDecoder description tests passed!');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
