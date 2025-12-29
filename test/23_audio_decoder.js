const native = require('../build/Release/node_webcodecs.node');
const assert = require('assert');

console.log('Test 23: AudioDecoder');

// First encode some audio to get valid AAC data
const encodedChunks = [];

const encoder = new native.AudioEncoder({
    output: (chunk) => encodedChunks.push(chunk),
    error: (e) => console.error('Encoder error:', e)
});

encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000
});

// Encode 5 frames
const sampleRate = 48000;
const numberOfChannels = 2;
const frameSize = 1024;

for (let i = 0; i < 5; i++) {
    const samples = new Float32Array(frameSize * numberOfChannels);
    for (let j = 0; j < frameSize; j++) {
        const t = (i * frameSize + j) / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
        samples[j * 2] = sample;
        samples[j * 2 + 1] = sample;
    }

    const audioData = new native.AudioData({
        format: 'f32',
        sampleRate: sampleRate,
        numberOfFrames: frameSize,
        numberOfChannels: numberOfChannels,
        timestamp: i * Math.floor(frameSize / sampleRate * 1000000),
        data: samples.buffer
    });

    encoder.encode(audioData);
    audioData.close();
}

encoder.flush();
encoder.close();

console.log(`Encoded ${encodedChunks.length} chunks`);

// Now decode
let decodedCount = 0;

const decoder = new native.AudioDecoder({
    output: (audioData) => {
        decodedCount++;
        console.log(`Decoded: sampleRate=${audioData.sampleRate}, channels=${audioData.numberOfChannels}, frames=${audioData.numberOfFrames}`);
        audioData.close();
    },
    error: (e) => {
        console.error('Decoder error:', e);
    }
});

assert.strictEqual(decoder.state, 'unconfigured');

decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2
});

assert.strictEqual(decoder.state, 'configured');

// Decode chunks
for (const chunk of encodedChunks) {
    decoder.decode(chunk);
}

decoder.flush();
decoder.close();

console.log(`Decoded ${decodedCount} audio data objects`);
assert.ok(decodedCount > 0, 'Should have decoded audio');

console.log('PASS');
