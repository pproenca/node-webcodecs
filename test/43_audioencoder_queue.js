'use strict';

const assert = require('assert');
const { AudioEncoder, AudioData } = require('../dist');

async function testAudioEncoderQueue() {
    console.log('[TEST] AudioEncoder control queue + ondequeue');

    let dequeueCount = 0;
    let maxQueueSize = 0;
    const chunks = [];

    const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
            chunks.push(chunk);
        },
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.ondequeue = () => {
        dequeueCount++;
    };

    // Configure with AAC codec
    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    // Create audio samples (stereo, 1024 frames each)
    const audioDataList = [];
    for (let i = 0; i < 5; i++) {
        const samples = new Float32Array(1024 * 2);
        for (let j = 0; j < samples.length; j++) {
            samples[j] = Math.sin((i * 1024 + j) * 0.01) * 0.5;
        }

        const audioData = new AudioData({
            format: 'f32',
            sampleRate: 48000,
            numberOfFrames: 1024,
            numberOfChannels: 2,
            timestamp: i * (1024 * 1000000 / 48000),
            data: samples
        });
        audioDataList.push(audioData);
        encoder.encode(audioData);

        if (encoder.encodeQueueSize > maxQueueSize) {
            maxQueueSize = encoder.encodeQueueSize;
        }
    }

    await encoder.flush();

    // Clean up audio data
    audioDataList.forEach(d => d.close());
    encoder.close();

    console.log(`Results: dequeueCount=${dequeueCount}, maxQueue=${maxQueueSize}, chunks=${chunks.length}`);

    assert.ok(dequeueCount >= 1, `ondequeue should fire at least once, got ${dequeueCount}`);
    assert.ok(chunks.length >= 1, `Should produce chunks, got ${chunks.length}`);

    console.log('[PASS] AudioEncoder control queue + ondequeue works');
}

async function testEncodeQueueSizeTracking() {
    console.log('[TEST] AudioEncoder encodeQueueSize tracking');

    const encoder = new AudioEncoder({
        output: () => {},
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    assert.strictEqual(encoder.encodeQueueSize, 0, 'Initial queue size should be 0');

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    // Encode a sample
    const samples = new Float32Array(1024 * 2);
    const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: samples
    });

    encoder.encode(audioData);
    assert.ok(encoder.encodeQueueSize >= 1, 'Queue size should increase after encode');

    await encoder.flush();
    assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue size should be 0 after flush');

    audioData.close();
    encoder.close();

    console.log('[PASS] AudioEncoder encodeQueueSize tracking works');
}

async function testResetClearsQueue() {
    console.log('[TEST] AudioEncoder reset clears queue');

    const encoder = new AudioEncoder({
        output: () => {},
        error: (e) => console.error(`[ERR] ${e.message}`)
    });

    encoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000
    });

    const samples = new Float32Array(1024 * 2);
    const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 0,
        data: samples
    });

    encoder.encode(audioData);
    encoder.reset();

    assert.strictEqual(encoder.encodeQueueSize, 0, 'Queue size should be 0 after reset');

    audioData.close();
    encoder.close();

    console.log('[PASS] AudioEncoder reset clears queue');
}

(async () => {
    await testAudioEncoderQueue();
    await testEncodeQueueSizeTracking();
    await testResetClearsQueue();
    console.log('[PASS] All AudioEncoder queue tests passed');
})().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
