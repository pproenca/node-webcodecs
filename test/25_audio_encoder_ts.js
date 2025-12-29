const { AudioEncoder, AudioData } = require('../dist');
const assert = require('assert');

async function main() {
    console.log('Testing AudioEncoder TypeScript wrapper...');

    // Test 1: Constructor and initial state
    const chunks = [];
    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
            console.log('Got chunk:', chunk.type, chunk.byteLength, 'bytes');
        },
        error: (e) => console.error('Encoder error:', e)
    });
    assert.strictEqual(encoder.state, 'unconfigured');
    console.log('✓ Initial state is unconfigured');

    // Test 2: Configure (using AAC which supports fltp sample format)
    encoder.configure({
        codec: 'mp4a.40.2',  // AAC-LC codec
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });
    assert.strictEqual(encoder.state, 'configured');
    console.log('✓ State after configure is configured');

    // Test 3: Encode AudioData
    const samples = new Float32Array(48000 * 2); // 1 second stereo
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(i * 0.01) * 0.5;
    }
    const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 48000,
        numberOfChannels: 2,
        timestamp: 0,
        data: samples
    });
    encoder.encode(audioData);
    console.log('✓ Encode called successfully');

    // Test 4: Flush
    await encoder.flush();
    console.log('✓ Flush completed, got', chunks.length, 'chunks');

    // Test 5: Close
    encoder.close();
    assert.strictEqual(encoder.state, 'closed');
    console.log('✓ State after close is closed');

    // Test 6: isConfigSupported (AAC)
    const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(typeof support.supported, 'boolean');
    console.log('✓ isConfigSupported returned:', support);

    // Test 7: isConfigSupported (Opus)
    const opusSupport = await AudioEncoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(typeof opusSupport.supported, 'boolean');
    console.log('✓ isConfigSupported (opus) returned:', opusSupport);

    console.log('\nAll AudioEncoder TypeScript wrapper tests passed!');
}

main().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
