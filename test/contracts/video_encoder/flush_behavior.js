/**
 * Contract Test: VideoEncoder Flush Behavior
 *
 * Validates the CRITICAL FFmpeg flush behavior contract:
 * - flush() returns a Promise
 * - flush() causes all buffered frames to be emitted via output callback
 * - flush() can be called multiple times (idempotent)
 * - After flush(), codec remains in configured state
 */

const { VideoEncoder, VideoFrame } = require('../../../dist');
const assert = require('assert');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Test 1: flush() returns a Promise
test('flush() returns a Promise', async () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    });

    const result = encoder.flush();
    assert.ok(result instanceof Promise, 'flush() should return a Promise');
    await result;

    encoder.close();
});

// Test 2: flush() emits buffered chunks
test('flush() emits buffered chunks - encode 5 frames, count chunks before/after flush', async () => {
    const chunks = [];
    const encoder = new VideoEncoder({
        output: (chunk) => { chunks.push(chunk); },
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    });

    // Create and encode 5 frames
    const frames = [];
    for (let i = 0; i < 5; i++) {
        const frame = new VideoFrame(Buffer.alloc(320 * 240 * 4), {
            codedWidth: 320,
            codedHeight: 240,
            timestamp: i * 33333
        });
        frames.push(frame);
        encoder.encode(frame, { keyFrame: i === 0 });
    }

    const chunksBeforeFlush = chunks.length;

    // Flush to emit all buffered frames
    await encoder.flush();

    const chunksAfterFlush = chunks.length;

    // Should have emitted chunks after flush
    assert.ok(chunksAfterFlush > 0, 'Should have emitted at least one chunk after flush');
    assert.ok(chunksAfterFlush >= chunksBeforeFlush, 'Chunk count should not decrease after flush');

    // Clean up
    for (const frame of frames) {
        frame.close();
    }
    encoder.close();
});

// Test 3: flush() is idempotent
test('flush() is idempotent - calling twice does not error', async () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    });

    const frame = new VideoFrame(Buffer.alloc(320 * 240 * 4), {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0
    });
    encoder.encode(frame, { keyFrame: true });

    // Call flush twice - should not throw
    await encoder.flush();
    await encoder.flush();

    frame.close();
    encoder.close();
});

// Test 4: state remains configured after flush
test('state remains configured after flush', async () => {
    const encoder = new VideoEncoder({
        output: () => {},
        error: (e) => { throw e; }
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 320,
        height: 240,
        bitrate: 500_000,
        framerate: 30
    });

    assert.strictEqual(encoder.state, 'configured', 'State should be configured before flush');

    const frame = new VideoFrame(Buffer.alloc(320 * 240 * 4), {
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0
    });
    encoder.encode(frame, { keyFrame: true });

    await encoder.flush();

    assert.strictEqual(encoder.state, 'configured', 'State should remain configured after flush');

    frame.close();
    encoder.close();
});

async function run() {
    console.log('Contract: VideoEncoder Flush Behavior\n');
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
