import {AudioDecoder, EncodedAudioChunk} from '@pproenca/node-webcodecs';
import * as assert from 'node:assert';

const tests: Array<{name: string; fn: () => void | Promise<void>}> = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({name, fn});
}

const audioConfig = {
  codec: 'mp4a.40.2',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000,
};

// Helper to create decoder with default callbacks
function createDecoder() {
  return new AudioDecoder({
    output: () => {},
    error: () => {},
  });
}

// Helper to create a test chunk (minimal encoded data)
function createTestChunk() {
  // Minimal encoded data buffer (not valid AAC, but sufficient for state testing)
  const data = Buffer.alloc(64);
  return new EncodedAudioChunk({
    type: 'key',
    timestamp: 0,
    data: data,
  });
}

// Test 1: Initial state is unconfigured
test('initial state is unconfigured', () => {
  const decoder = createDecoder();
  assert.strictEqual(decoder.state, 'unconfigured');
  decoder.close();
});

// Test 2: configure() transitions unconfigured -> configured
test('configure() transitions unconfigured -> configured', () => {
  const decoder = createDecoder();
  assert.strictEqual(decoder.state, 'unconfigured');
  decoder.configure(audioConfig);
  assert.strictEqual(decoder.state, 'configured');
  decoder.close();
});

// Test 3: reset() transitions configured -> unconfigured
test('reset() transitions configured -> unconfigured', () => {
  const decoder = createDecoder();
  decoder.configure(audioConfig);
  assert.strictEqual(decoder.state, 'configured');
  decoder.reset();
  assert.strictEqual(decoder.state, 'unconfigured');
  decoder.close();
});

// Test 4: close() from configured transitions to closed
test('close() from configured transitions to closed', () => {
  const decoder = createDecoder();
  decoder.configure(audioConfig);
  assert.strictEqual(decoder.state, 'configured');
  decoder.close();
  assert.strictEqual(decoder.state, 'closed');
});

// Test 5: close() from unconfigured transitions to closed
test('close() from unconfigured transitions to closed', () => {
  const decoder = createDecoder();
  assert.strictEqual(decoder.state, 'unconfigured');
  decoder.close();
  assert.strictEqual(decoder.state, 'closed');
});

// Test 6: decode() on unconfigured throws
test('decode() on unconfigured throws', () => {
  const decoder = createDecoder();
  const chunk = createTestChunk();
  try {
    decoder.decode(chunk);
    assert.fail('Should have thrown an error');
  } catch (e) {
    assert.ok(
      e.message.includes('InvalidStateError') ||
        e.message.includes('unconfigured'),
      `Expected InvalidStateError, got: ${e.message}`,
    );
  } finally {
    decoder.close();
  }
});

// Test 7: configure() on closed throws
test('configure() on closed throws', () => {
  const decoder = createDecoder();
  decoder.close();
  assert.strictEqual(decoder.state, 'closed');
  try {
    decoder.configure(audioConfig);
    assert.fail('Should have thrown an error');
  } catch (e) {
    assert.ok(
      e.message.includes('InvalidStateError') || e.message.includes('closed'),
      `Expected InvalidStateError, got: ${e.message}`,
    );
  }
});

// Test 8: can reconfigure after reset
test('can reconfigure after reset', () => {
  const decoder = createDecoder();

  // First configuration
  decoder.configure(audioConfig);
  assert.strictEqual(decoder.state, 'configured');

  // Reset
  decoder.reset();
  assert.strictEqual(decoder.state, 'unconfigured');

  // Reconfigure with different settings
  const newConfig = {
    codec: 'mp4a.40.2',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitrate: 96000,
  };
  decoder.configure(newConfig);
  assert.strictEqual(decoder.state, 'configured');

  decoder.close();
});

// Test runner
async function run() {
  console.log('Contract: AudioDecoder State Machine\n');
  let passed = 0,
    failed = 0;
  for (const {name, fn} of tests) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
