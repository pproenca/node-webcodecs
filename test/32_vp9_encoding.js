// Test for VP9 encoding support (W3C WebCodecs spec)
const assert = require('assert');
const { VideoEncoder, VideoFrame } = require('../dist');

console.log('Testing VP9 encoding support...');

// Test 1: VP9 config is supported
(async () => {
    {
        const result = await VideoEncoder.isConfigSupported({
            codec: 'vp09.00.10.08',
            width: 640,
            height: 480
        });

        assert.strictEqual(result.supported, true, 'VP9 should be supported');
        console.log('  ✓ VP9 isConfigSupported returns true');
    }

    // Test 2: VP9 encoding works
    {
        const chunks = [];
        const encoder = new VideoEncoder({
            output: (chunk, metadata) => {
                chunks.push(chunk);
            },
            error: (e) => {
                throw e;
            }
        });

        encoder.configure({
            codec: 'vp09.00.10.08',
            width: 100,
            height: 100,
            bitrate: 500000
        });

        assert.strictEqual(encoder.state, 'configured', 'encoder should be configured');

        // Create and encode a test frame
        const buf = Buffer.alloc(100 * 100 * 4);
        // Fill with a gradient pattern
        for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
                const offset = (y * 100 + x) * 4;
                buf[offset] = x * 2;       // R
                buf[offset + 1] = y * 2;   // G
                buf[offset + 2] = 128;     // B
                buf[offset + 3] = 255;     // A
            }
        }

        const frame = new VideoFrame(buf, {
            codedWidth: 100,
            codedHeight: 100,
            timestamp: 0
        });

        encoder.encode(frame, { keyFrame: true });
        frame.close();

        await encoder.flush();

        assert(chunks.length > 0, 'Should have encoded at least one chunk');
        assert.strictEqual(chunks[0].type, 'key', 'First chunk should be a keyframe');

        encoder.close();
        console.log('  ✓ VP9 encoding produces chunks');
    }

    // Test 3: VP9 simple codec string
    {
        const result = await VideoEncoder.isConfigSupported({
            codec: 'vp9',
            width: 320,
            height: 240
        });

        assert.strictEqual(result.supported, true, 'vp9 simple string should be supported');
        console.log('  ✓ VP9 simple codec string supported');
    }

    // Test 4: Multiple VP9 frames
    {
        const chunks = [];
        const encoder = new VideoEncoder({
            output: (chunk) => chunks.push(chunk),
            error: (e) => { throw e; }
        });

        encoder.configure({
            codec: 'vp9',
            width: 64,
            height: 64,
            bitrate: 250000
        });

        // Encode multiple frames
        for (let i = 0; i < 5; i++) {
            const buf = Buffer.alloc(64 * 64 * 4);
            buf.fill((i * 50) % 256);

            const frame = new VideoFrame(buf, {
                codedWidth: 64,
                codedHeight: 64,
                timestamp: i * 33333
            });

            encoder.encode(frame, { keyFrame: i === 0 });
            frame.close();
        }

        await encoder.flush();

        assert(chunks.length >= 1, 'Should have encoded multiple chunks');
        console.log(`  ✓ VP9 encoded ${chunks.length} chunks from 5 frames`);

        encoder.close();
    }

    console.log('\n✓ All VP9 encoding tests passed!\n');
})().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
