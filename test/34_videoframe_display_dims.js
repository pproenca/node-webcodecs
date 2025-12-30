// Test for VideoFrame.displayWidth and displayHeight properties (W3C WebCodecs spec)
const assert = require('assert');
const { VideoFrame } = require('../dist');

console.log('Testing VideoFrame displayWidth/displayHeight properties...');

// Test 1: Explicit displayWidth/displayHeight
{
    const buf = Buffer.alloc(1920 * 1080 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: 0,
        displayWidth: 1920,
        displayHeight: 1080
    });

    assert.strictEqual(frame.displayWidth, 1920, 'displayWidth should be 1920');
    assert.strictEqual(frame.displayHeight, 1080, 'displayHeight should be 1080');
    assert.strictEqual(frame.codedWidth, 1920, 'codedWidth should be preserved');
    assert.strictEqual(frame.codedHeight, 1080, 'codedHeight should be preserved');

    frame.close();
    console.log('  ✓ Explicit displayWidth/displayHeight work');
}

// Test 2: Default displayWidth/displayHeight (should match coded dimensions)
{
    const buf = Buffer.alloc(640 * 480 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 640,
        codedHeight: 480,
        timestamp: 0
    });

    // Per W3C spec: if not specified, displayWidth/Height default to codedWidth/Height
    assert.strictEqual(frame.displayWidth, 640, 'displayWidth should default to codedWidth');
    assert.strictEqual(frame.displayHeight, 480, 'displayHeight should default to codedHeight');

    frame.close();
    console.log('  ✓ Default displayWidth/displayHeight equal coded dimensions');
}

// Test 3: Different display and coded dimensions (aspect ratio correction)
{
    const buf = Buffer.alloc(720 * 480 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 720,
        codedHeight: 480,
        timestamp: 0,
        displayWidth: 854,  // 16:9 display aspect ratio
        displayHeight: 480
    });

    assert.strictEqual(frame.displayWidth, 854, 'displayWidth should be 854');
    assert.strictEqual(frame.displayHeight, 480, 'displayHeight should be 480');
    assert.strictEqual(frame.codedWidth, 720, 'codedWidth should still be 720');

    frame.close();
    console.log('  ✓ Different display and coded dimensions work');
}

// Test 4: Clone preserves display dimensions
{
    const buf = Buffer.alloc(100 * 100 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 100,
        codedHeight: 100,
        timestamp: 0,
        displayWidth: 200,
        displayHeight: 150
    });

    const cloned = frame.clone();

    assert.strictEqual(cloned.displayWidth, 200, 'cloned frame should preserve displayWidth');
    assert.strictEqual(cloned.displayHeight, 150, 'cloned frame should preserve displayHeight');

    frame.close();
    cloned.close();
    console.log('  ✓ Clone preserves display dimensions');
}

// Test 5: Very large display dimensions
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 0,
        displayWidth: 8192,
        displayHeight: 4320
    });

    assert.strictEqual(frame.displayWidth, 8192, 'large displayWidth should work');
    assert.strictEqual(frame.displayHeight, 4320, 'large displayHeight should work');

    frame.close();
    console.log('  ✓ Large display dimensions work');
}

console.log('\n✓ All VideoFrame displayWidth/displayHeight tests passed!\n');
