// Test for VideoFrame.duration property (W3C WebCodecs spec compliance)
const assert = require('assert');
const { VideoFrame } = require('../dist');

console.log('Testing VideoFrame duration property...');

// Test 1: VideoFrame with duration specified
{
    const buf = Buffer.alloc(10 * 10 * 4); // 10x10 RGBA
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 1000,
        duration: 33333  // ~30fps frame duration in microseconds
    });

    assert.strictEqual(frame.duration, 33333, 'duration should be 33333');
    assert.strictEqual(frame.timestamp, 1000, 'timestamp should be preserved');
    assert.strictEqual(frame.codedWidth, 10, 'codedWidth should be preserved');
    assert.strictEqual(frame.codedHeight, 10, 'codedHeight should be preserved');

    frame.close();
    console.log('  ✓ VideoFrame with duration works');
}

// Test 2: VideoFrame without duration (should be undefined)
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 2000
    });

    // Per W3C spec, duration is optional and should be undefined if not provided
    assert.strictEqual(frame.duration, undefined, 'duration should be undefined when not provided');

    frame.close();
    console.log('  ✓ VideoFrame without duration returns undefined');
}

// Test 3: Clone preserves duration
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 3000,
        duration: 40000
    });

    const cloned = frame.clone();

    assert.strictEqual(cloned.duration, 40000, 'cloned frame should preserve duration');
    assert.strictEqual(cloned.timestamp, 3000, 'cloned frame should preserve timestamp');

    frame.close();
    cloned.close();
    console.log('  ✓ Clone preserves duration');
}

// Test 4: Duration with zero value
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 0,
        duration: 0
    });

    assert.strictEqual(frame.duration, 0, 'duration of 0 should be valid');

    frame.close();
    console.log('  ✓ Zero duration works');
}

// Test 5: Large duration value
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const largeDuration = 1000000000; // 1000 seconds in microseconds
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 0,
        duration: largeDuration
    });

    assert.strictEqual(frame.duration, largeDuration, 'large duration should be preserved');

    frame.close();
    console.log('  ✓ Large duration value works');
}

console.log('\n✓ All VideoFrame duration tests passed!\n');
