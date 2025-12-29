const { AudioDecoder, AudioEncoder, AudioData, EncodedAudioChunk } = require('../dist');
const assert = require('assert');

console.log('Test 27: AudioDecoder TypeScript Wrapper');

async function main() {
    // ========================================================================
    // TEST 1: Constructor and initial state
    // ========================================================================
    console.log('\n1. Testing constructor and initial state...');
    let outputCallCount = 0;
    const decoder = new AudioDecoder({
        output: (data) => {
            outputCallCount++;
            console.log('Got AudioData:', data.numberOfFrames, 'frames,', data.numberOfChannels, 'channels');
            data.close();
        },
        error: (e) => console.error('Decoder error:', e)
    });
    assert.strictEqual(decoder.state, 'unconfigured', 'Initial state should be unconfigured');
    console.log('  Initial state:', decoder.state);
    console.log('  decodeQueueSize:', decoder.decodeQueueSize);
    console.log('PASS: constructor and initial state');

    // ========================================================================
    // TEST 2: Configure method
    // ========================================================================
    console.log('\n2. Testing configure method...');
    decoder.configure({
        codec: 'mp4a.40.2',  // AAC-LC codec
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(decoder.state, 'configured', 'State should be configured after configure()');
    console.log('  State after configure:', decoder.state);
    console.log('PASS: configure method');

    // ========================================================================
    // TEST 3: State transitions (configured -> unconfigured via reset)
    // ========================================================================
    console.log('\n3. Testing state transitions via reset...');
    decoder.reset();
    assert.strictEqual(decoder.state, 'unconfigured', 'State should be unconfigured after reset()');
    console.log('  State after reset:', decoder.state);

    // Re-configure for further tests
    decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(decoder.state, 'configured', 'State should be configured after re-configure');
    console.log('  State after re-configure:', decoder.state);
    console.log('PASS: state transitions');

    // ========================================================================
    // TEST 4: Encode audio and decode it (full round-trip)
    // ========================================================================
    console.log('\n4. Testing decode with EncodedAudioChunk...');

    // First encode some audio to get chunks
    const encodedChunks = [];
    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            encodedChunks.push(chunk);
            console.log('  Encoded chunk:', chunk.type, chunk.byteLength, 'bytes');
        },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    // Create and encode audio data
    const frameSize = 1024;
    const sampleRate = 48000;
    const numberOfChannels = 2;

    for (let i = 0; i < 3; i++) {
        const samples = new Float32Array(frameSize * numberOfChannels);
        for (let j = 0; j < frameSize; j++) {
            const t = (i * frameSize + j) / sampleRate;
            const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
            samples[j * 2] = sample;
            samples[j * 2 + 1] = sample;
        }

        const audioData = new AudioData({
            format: 'f32',
            sampleRate: sampleRate,
            numberOfFrames: frameSize,
            numberOfChannels: numberOfChannels,
            timestamp: i * Math.floor(frameSize / sampleRate * 1000000),
            data: samples
        });

        encoder.encode(audioData);
        audioData.close();
    }

    await encoder.flush();
    encoder.close();

    console.log('  Encoded', encodedChunks.length, 'chunks');
    assert.ok(encodedChunks.length > 0, 'Should have encoded chunks');

    // Now decode
    for (const chunk of encodedChunks) {
        decoder.decode(chunk);
    }

    await decoder.flush();
    console.log('  Decoded', outputCallCount, 'AudioData frames');
    assert.ok(outputCallCount > 0, 'Should have received decoded AudioData');
    console.log('PASS: decode with EncodedAudioChunk');

    // ========================================================================
    // TEST 5: isConfigSupported static method
    // ========================================================================
    console.log('\n5. Testing static isConfigSupported method...');

    // Test supported AAC config
    const aacSupport = await AudioDecoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(typeof aacSupport.supported, 'boolean', 'supported should be boolean');
    assert.ok(aacSupport.config, 'config should be defined');
    console.log('  AAC support:', aacSupport);

    // Test Opus config
    const opusSupport = await AudioDecoder.isConfigSupported({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(typeof opusSupport.supported, 'boolean', 'supported should be boolean');
    console.log('  Opus support:', opusSupport);

    // Test unsupported codec
    const unsupportedResult = await AudioDecoder.isConfigSupported({
        codec: 'unknown-codec-xyz',
        sampleRate: 48000,
        numberOfChannels: 2
    });
    assert.strictEqual(unsupportedResult.supported, false, 'Unknown codec should not be supported');
    console.log('  Unknown codec support:', unsupportedResult);
    console.log('PASS: isConfigSupported static method');

    // ========================================================================
    // TEST 6: Close method
    // ========================================================================
    console.log('\n6. Testing close method...');
    decoder.close();
    assert.strictEqual(decoder.state, 'closed', 'State should be closed after close()');
    console.log('  State after close:', decoder.state);
    console.log('PASS: close method');

    // ========================================================================
    // TEST 7: decodeQueueSize getter
    // ========================================================================
    console.log('\n7. Testing decodeQueueSize getter...');
    const decoder2 = new AudioDecoder({
        output: () => {},
        error: (e) => { throw e; }
    });
    const queueSize = decoder2.decodeQueueSize;
    assert.strictEqual(typeof queueSize, 'number', 'decodeQueueSize should be a number');
    assert.ok(queueSize >= 0, 'decodeQueueSize should be >= 0');
    console.log('  decodeQueueSize:', queueSize);
    decoder2.close();
    console.log('PASS: decodeQueueSize getter');

    // ========================================================================
    // ALL TESTS PASSED
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('ALL AUDIODECODER TYPESCRIPT WRAPPER TESTS PASSED');
    console.log('='.repeat(70));
    console.log('1. Constructor and initial state');
    console.log('2. Configure method');
    console.log('3. State transitions');
    console.log('4. Decode with EncodedAudioChunk');
    console.log('5. isConfigSupported static method');
    console.log('6. Close method');
    console.log('7. decodeQueueSize getter');
    console.log('='.repeat(70));
}

main().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
