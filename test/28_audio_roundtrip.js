const {
  AudioData,
  AudioEncoder,
  AudioDecoder,
  EncodedAudioChunk,
} = require('../dist');
const assert = require('assert');

async function main() {
  console.log('Testing Audio Roundtrip (encode → decode)...\n');

  // Configuration
  const sampleRate = 48000;
  const numberOfChannels = 2;
  const durationSeconds = 0.5;
  const numberOfFrames = sampleRate * durationSeconds;

  try {
    // Test 1: Generate test audio (sine wave)
    console.log('Test 1: Generating test audio...');
    const samples = new Float32Array(numberOfFrames * numberOfChannels);
    for (let frame = 0; frame < numberOfFrames; frame++) {
      const t = frame / sampleRate;
      const leftSample = Math.sin(2 * Math.PI * 440 * t) * 0.5; // 440Hz on left
      const rightSample = Math.sin(2 * Math.PI * 880 * t) * 0.5; // 880Hz on right
      samples[frame * 2] = leftSample;
      samples[frame * 2 + 1] = rightSample;
    }

    const inputAudio = new AudioData({
      format: 'f32',
      sampleRate: sampleRate,
      numberOfFrames: numberOfFrames,
      numberOfChannels: numberOfChannels,
      timestamp: 0,
      data: samples,
    });
    console.log(
      `✓ Created AudioData: ${inputAudio.numberOfFrames} frames, ${inputAudio.sampleRate}Hz, ${inputAudio.numberOfChannels}ch\n`,
    );

    // Test 2: Encode audio
    console.log('Test 2: Encoding audio with AAC...');
    const encodedChunks = [];
    const encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        console.log(
          `  Got encoded chunk: ${chunk.type}, ${chunk.byteLength} bytes`,
        );
      },
      error: e => {
        console.error('Encoder error:', e);
        throw e;
      },
    });

    try {
      encoder.configure({
        codec: 'mp4a.40.2', // AAC-LC
        sampleRate: sampleRate,
        numberOfChannels: numberOfChannels,
        bitrate: 128000,
      });

      encoder.encode(inputAudio);
      await encoder.flush();
    } finally {
      encoder.close();
      inputAudio.close();
    }

    console.log(`✓ Encoded to ${encodedChunks.length} chunks\n`);
    assert(encodedChunks.length > 0, 'Should have encoded at least one chunk');

    // Test 3: Decode audio
    console.log('Test 3: Decoding audio...');
    const decodedAudioData = [];
    const decoder = new AudioDecoder({
      output: audio => {
        decodedAudioData.push(audio);
        console.log(
          `  Got decoded AudioData: ${audio.numberOfFrames} frames, format: ${audio.format}`,
        );
      },
      error: e => {
        console.error('Decoder error:', e);
        throw e;
      },
    });

    try {
      decoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: sampleRate,
        numberOfChannels: numberOfChannels,
      });

      for (const chunk of encodedChunks) {
        decoder.decode(chunk);
      }
      await decoder.flush();
    } finally {
      decoder.close();
    }

    console.log(`✓ Decoded to ${decodedAudioData.length} AudioData objects\n`);
    assert(
      decodedAudioData.length > 0,
      'Should have decoded at least one AudioData',
    );

    // Test 4: Verify decoded audio properties
    console.log('Test 4: Verifying decoded audio...');
    let totalDecodedFrames = 0;
    for (const audio of decodedAudioData) {
      assert.strictEqual(audio.format, 'f32', 'Format should be f32');
      assert.strictEqual(
        audio.sampleRate,
        sampleRate,
        'Sample rate should match',
      );
      assert.strictEqual(
        audio.numberOfChannels,
        numberOfChannels,
        'Channel count should match',
      );
      totalDecodedFrames += audio.numberOfFrames;
      audio.close();
    }

    // Allow some variance due to codec latency/padding
    const tolerance = sampleRate * 0.1; // 10% tolerance
    console.log(
      `  Total decoded frames: ${totalDecodedFrames} (input was ${numberOfFrames})`,
    );
    assert(
      Math.abs(totalDecodedFrames - numberOfFrames) < tolerance,
      `Decoded frame count should be close to input (got ${totalDecodedFrames}, expected ~${numberOfFrames})`,
    );

    console.log('✓ Decoded audio properties verified\n');

    // Test 5: Roundtrip with Opus
    console.log('Test 5: Opus roundtrip...');
    const opusChunks = [];
    const opusEncoder = new AudioEncoder({
      output: chunk => opusChunks.push(chunk),
      error: e => {
        throw e;
      },
    });

    const opusInput = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 48000, // 1 second
      numberOfChannels: 2,
      timestamp: 0,
      data: new Float32Array(48000 * 2).fill(0.1),
    });

    try {
      opusEncoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 64000,
      });

      opusEncoder.encode(opusInput);
      await opusEncoder.flush();
    } finally {
      opusEncoder.close();
      opusInput.close();
    }

    console.log(`  Opus encoded: ${opusChunks.length} chunks`);
    assert(opusChunks.length > 0, 'Should have Opus chunks');

    const opusDecoded = [];
    const opusDecoder = new AudioDecoder({
      output: audio => opusDecoded.push(audio),
      error: e => {
        throw e;
      },
    });

    try {
      opusDecoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });

      for (const chunk of opusChunks) {
        opusDecoder.decode(chunk);
      }
      await opusDecoder.flush();
    } finally {
      opusDecoder.close();
    }

    let totalOpusFrames = 0;
    for (const audio of opusDecoded) {
      totalOpusFrames += audio.numberOfFrames;
      audio.close();
    }

    // Allow some variance due to codec latency/padding
    const opusTolerance = 48000 * 0.1; // 10% tolerance
    console.log(
      `  Opus decoded: ${opusDecoded.length} AudioData objects, ${totalOpusFrames} total frames`,
    );
    assert(
      Math.abs(totalOpusFrames - 48000) < opusTolerance,
      `Opus frame count should be close to input (got ${totalOpusFrames}, expected ~48000)`,
    );
    console.log('✓ Opus roundtrip successful\n');

    console.log('='.repeat(50));
    console.log('All audio roundtrip tests passed!');
    console.log('='.repeat(50));
  } catch (e) {
    console.error('Test failed:', e);
    throw e;
  }
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
