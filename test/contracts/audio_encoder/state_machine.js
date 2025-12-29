const { AudioEncoder, AudioData } = require('../../../dist');
const assert = require('assert');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const audioConfig = {
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000
};

// Helper to create encoder with default callbacks
function createEncoder() {
    return new AudioEncoder({
        output: () => {},
        error: () => {}
    });
}

// Helper to create test audio data
function createTestAudioData() {
    // Create 1024 frames of stereo f32 audio (1024 * 2 * 4 = 8192 bytes)
    const numberOfFrames = 1024;
    const numberOfChannels = 2;
    const bytesPerSample = 4; // f32
    const data = Buffer.alloc(numberOfFrames * numberOfChannels * bytesPerSample);

    return new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: numberOfFrames,
        numberOfChannels: numberOfChannels,
        timestamp: 0,
        data: data
    });
}

// Test 1: Initial state is unconfigured
test('initial state is unconfigured', () => {
    const encoder = createEncoder();
    assert.strictEqual(encoder.state, 'unconfigured');
    encoder.close();
});

// Test 2: configure() transitions unconfigured -> configured
test('configure() transitions unconfigured -> configured', () => {
    const encoder = createEncoder();
    assert.strictEqual(encoder.state, 'unconfigured');
    encoder.configure(audioConfig);
    assert.strictEqual(encoder.state, 'configured');
    encoder.close();
});

// Test 3: reset() transitions configured -> unconfigured
test('reset() transitions configured -> unconfigured', () => {
    const encoder = createEncoder();
    encoder.configure(audioConfig);
    assert.strictEqual(encoder.state, 'configured');
    encoder.reset();
    assert.strictEqual(encoder.state, 'unconfigured');
    encoder.close();
});

// Test 4: close() from configured transitions to closed
test('close() from configured transitions to closed', () => {
    const encoder = createEncoder();
    encoder.configure(audioConfig);
    assert.strictEqual(encoder.state, 'configured');
    encoder.close();
    assert.strictEqual(encoder.state, 'closed');
});

// Test 5: close() from unconfigured transitions to closed
test('close() from unconfigured transitions to closed', () => {
    const encoder = createEncoder();
    assert.strictEqual(encoder.state, 'unconfigured');
    encoder.close();
    assert.strictEqual(encoder.state, 'closed');
});

// Test 6: encode() on unconfigured throws
test('encode() on unconfigured throws', () => {
    const encoder = createEncoder();
    const audioData = createTestAudioData();
    try {
        encoder.encode(audioData);
        assert.fail('Should have thrown an error');
    } catch (e) {
        assert.ok(e.message.includes('InvalidStateError') || e.message.includes('unconfigured'),
            `Expected InvalidStateError, got: ${e.message}`);
    } finally {
        audioData.close();
        encoder.close();
    }
});

// Test 7: configure() on closed throws
test('configure() on closed throws', () => {
    const encoder = createEncoder();
    encoder.close();
    assert.strictEqual(encoder.state, 'closed');
    try {
        encoder.configure(audioConfig);
        assert.fail('Should have thrown an error');
    } catch (e) {
        assert.ok(e.message.includes('InvalidStateError') || e.message.includes('closed'),
            `Expected InvalidStateError, got: ${e.message}`);
    }
});

// Test 8: can reconfigure after reset
test('can reconfigure after reset', () => {
    const encoder = createEncoder();

    // First configuration
    encoder.configure(audioConfig);
    assert.strictEqual(encoder.state, 'configured');

    // Reset
    encoder.reset();
    assert.strictEqual(encoder.state, 'unconfigured');

    // Reconfigure with different settings
    const newConfig = {
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitrate: 96000
    };
    encoder.configure(newConfig);
    assert.strictEqual(encoder.state, 'configured');

    encoder.close();
});

// Test runner
async function run() {
    console.log('Contract: AudioEncoder State Machine\n');
    let passed = 0, failed = 0;
    for (const { name, fn } of tests) {
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
