const {VideoEncoder} = require('../dist');
const assert = require('assert');

console.log('Test 11: VideoEncoder.isConfigSupported()');

async function runTest() {
  // Test valid H.264 config
  const result1 = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42001E',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    framerate: 30,
  });

  assert.strictEqual(result1.supported, true, 'H.264 should be supported');
  assert.strictEqual(result1.config.codec, 'avc1.42001E');
  assert.strictEqual(result1.config.width, 1280);
  assert.strictEqual(result1.config.height, 720);

  // Test unsupported codec
  const result2 = await VideoEncoder.isConfigSupported({
    codec: 'unsupported-codec',
    width: 1280,
    height: 720,
  });

  assert.strictEqual(
    result2.supported,
    false,
    'Unknown codec should not be supported',
  );

  // Test invalid dimensions
  const result3 = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42001E',
    width: -100,
    height: 720,
  });

  assert.strictEqual(
    result3.supported,
    false,
    'Negative dimensions should not be supported',
  );

  console.log('PASS');
}

runTest().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
