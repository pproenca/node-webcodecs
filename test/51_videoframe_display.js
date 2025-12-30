'use strict';

const assert = require('assert');
const { VideoFrame } = require('../dist');

async function testVideoFrameDisplayDimensions() {
    console.log('[TEST] VideoFrame displayWidth/displayHeight');

    // Test 1: Default behavior - displayWidth/displayHeight should default to codedWidth/codedHeight
    {
        const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
            codedWidth: 100,
            codedHeight: 100,
            timestamp: 0
        });

        assert.strictEqual(frame.displayWidth, 100, 'displayWidth should default to codedWidth');
        assert.strictEqual(frame.displayHeight, 100, 'displayHeight should default to codedHeight');
        console.log('[PASS] Default displayWidth/displayHeight');
        frame.close();
    }

    // Test 2: Explicit displayWidth/displayHeight
    {
        const frame = new VideoFrame(Buffer.alloc(200 * 100 * 4), {
            codedWidth: 200,
            codedHeight: 100,
            timestamp: 1000,
            displayWidth: 160,
            displayHeight: 120
        });

        assert.strictEqual(frame.codedWidth, 200, 'codedWidth should be 200');
        assert.strictEqual(frame.codedHeight, 100, 'codedHeight should be 100');
        assert.strictEqual(frame.displayWidth, 160, 'displayWidth should be 160');
        assert.strictEqual(frame.displayHeight, 120, 'displayHeight should be 120');
        console.log('[PASS] Explicit displayWidth/displayHeight');
        frame.close();
    }

    // Test 3: Clone should preserve displayWidth/displayHeight
    {
        const frame = new VideoFrame(Buffer.alloc(100 * 100 * 4), {
            codedWidth: 100,
            codedHeight: 100,
            timestamp: 2000,
            displayWidth: 80,
            displayHeight: 60
        });

        const cloned = frame.clone();
        assert.strictEqual(cloned.displayWidth, 80, 'Clone should preserve displayWidth');
        assert.strictEqual(cloned.displayHeight, 60, 'Clone should preserve displayHeight');
        console.log('[PASS] Clone preserves displayWidth/displayHeight');
        frame.close();
        cloned.close();
    }

    console.log('[PASS] All displayWidth/displayHeight tests passed');
}

testVideoFrameDisplayDimensions().catch(e => {
    console.error('[FAIL]', e.message);
    process.exit(1);
});
