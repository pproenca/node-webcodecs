const assert = require('assert');
const {AudioEncoder, AudioData} = require('../dist/index.js');

console.log('Testing OpusEncoderConfig options...');

let chunkCount = 0;

const encoder = new AudioEncoder({
  output: (chunk, metadata) => {
    chunkCount++;
    console.log(`Chunk ${chunkCount}: ${chunk.byteLength} bytes`);
  },
  error: e => {
    console.error('Encoder error:', e);
    process.exit(1);
  },
});

// Configure with Opus-specific options
encoder.configure({
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000,
  opus: {
    application: 'audio', // 'audio' | 'lowdelay' | 'voip'
    complexity: 10, // 0-10
    frameDuration: 20000, // 20ms in microseconds
    signal: 'music', // 'auto' | 'music' | 'voice'
    usedtx: false,
    useinbandfec: true,
  },
});

// Create and encode audio data
const sampleRate = 48000;
const channels = 2;
const frames = 960; // 20ms at 48kHz
const samples = new Float32Array(frames * channels);

// Generate simple sine wave
for (let i = 0; i < frames; i++) {
  const t = i / sampleRate;
  const value = Math.sin(2 * Math.PI * 440 * t);
  samples[i * channels] = value;
  samples[i * channels + 1] = value;
}

const audioData = new AudioData({
  format: 'f32-planar',
  sampleRate: sampleRate,
  numberOfChannels: channels,
  numberOfFrames: frames,
  timestamp: 0,
  data: samples.buffer,
});

encoder.encode(audioData);
audioData.close();

encoder
  .flush()
  .then(async () => {
    assert(chunkCount > 0, 'Should have encoded audio chunks');
    encoder.close();
    console.log('Encoding test passed!');

    // Test isConfigSupported with opus options
    console.log('Testing isConfigSupported with opus options...');
    const result = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
      opus: {
        application: 'voip',
        complexity: 5,
        frameDuration: 10000,
        packetlossperc: 10,
        usedtx: true,
        useinbandfec: true,
      },
    });

    assert(result.supported === true, 'Opus with options should be supported');
    assert(result.config.codec === 'opus', 'Config should have codec');
    assert(result.config.opus !== undefined, 'Config should have opus options');
    assert(
      result.config.opus.application === 'voip',
      'Should preserve application',
    );
    assert(result.config.opus.complexity === 5, 'Should preserve complexity');
    assert(
      result.config.opus.useinbandfec === true,
      'Should preserve useinbandfec',
    );
    console.log('isConfigSupported test passed!');

    // Test different application modes
    console.log('Testing different Opus application modes...');

    // Test voip mode
    const voipEncoder = new AudioEncoder({
      output: () => {},
      error: e => {
        console.error('Encoder error:', e);
      },
    });
    voipEncoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      opus: {application: 'voip'},
    });
    assert(voipEncoder.state === 'configured', 'VoIP mode should configure');
    voipEncoder.close();

    // Test lowdelay mode
    const lowdelayEncoder = new AudioEncoder({
      output: () => {},
      error: e => {
        console.error('Encoder error:', e);
      },
    });
    lowdelayEncoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      opus: {application: 'lowdelay', complexity: 0},
    });
    assert(
      lowdelayEncoder.state === 'configured',
      'Lowdelay mode should configure',
    );
    lowdelayEncoder.close();

    console.log('OpusEncoderConfig test passed!');
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
