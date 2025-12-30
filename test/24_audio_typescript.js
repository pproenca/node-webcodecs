const {
  AudioEncoder,
  AudioDecoder,
  AudioData,
  EncodedAudioChunk,
} = require('../dist');
const assert = require('assert');

console.log('Test 24: Audio TypeScript wrappers');

async function runTest() {
  // Test AudioData
  const samples = new Float32Array(1024 * 2);
  for (let i = 0; i < 1024; i++) {
    const t = i / 48000;
    samples[i * 2] = Math.sin(2 * Math.PI * 440 * t);
    samples[i * 2 + 1] = Math.sin(2 * Math.PI * 440 * t);
  }

  const audioData = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: 1024,
    numberOfChannels: 2,
    timestamp: 0,
    data: samples.buffer,
  });

  assert.strictEqual(audioData.sampleRate, 48000);
  assert.strictEqual(audioData.numberOfChannels, 2);
  assert.strictEqual(audioData.numberOfFrames, 1024);

  // Test AudioEncoder
  const chunks = [];
  const encoder = new AudioEncoder({
    output: chunk => chunks.push(chunk),
    error: e => console.error(e),
  });

  assert.strictEqual(encoder.state, 'unconfigured');

  const support = await AudioEncoder.isConfigSupported({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });
  assert.strictEqual(support.supported, true);

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });

  assert.strictEqual(encoder.state, 'configured');

  encoder.encode(audioData);
  audioData.close();

  await encoder.flush();
  encoder.close();

  console.log(`Encoded ${chunks.length} chunks`);

  // Test AudioDecoder
  let decodedCount = 0;
  const decoder = new AudioDecoder({
    output: data => {
      decodedCount++;
      data.close();
    },
    error: e => console.error(e),
  });

  decoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
  });

  for (const chunk of chunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  console.log(`Decoded ${decodedCount} frames`);

  console.log('PASS');
}

runTest().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
