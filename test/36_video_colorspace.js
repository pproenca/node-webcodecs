// Test for VideoColorSpace class (W3C WebCodecs spec)
const assert = require('assert');
const { VideoColorSpace, VideoFrame } = require('../dist');

console.log('Testing VideoColorSpace class...');

// Test 1: VideoColorSpace constructor with full init
{
    const colorSpace = new VideoColorSpace({
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709',
        fullRange: false
    });

    assert.strictEqual(colorSpace.primaries, 'bt709');
    assert.strictEqual(colorSpace.transfer, 'bt709');
    assert.strictEqual(colorSpace.matrix, 'bt709');
    assert.strictEqual(colorSpace.fullRange, false);

    console.log('  ✓ VideoColorSpace with full init works');
}

// Test 2: VideoColorSpace constructor with no init (all null)
{
    const colorSpace = new VideoColorSpace();

    assert.strictEqual(colorSpace.primaries, null);
    assert.strictEqual(colorSpace.transfer, null);
    assert.strictEqual(colorSpace.matrix, null);
    assert.strictEqual(colorSpace.fullRange, null);

    console.log('  ✓ VideoColorSpace with no init returns nulls');
}

// Test 3: VideoColorSpace constructor with partial init
{
    const colorSpace = new VideoColorSpace({
        primaries: 'bt2020',
        fullRange: true
    });

    assert.strictEqual(colorSpace.primaries, 'bt2020');
    assert.strictEqual(colorSpace.transfer, null);
    assert.strictEqual(colorSpace.matrix, null);
    assert.strictEqual(colorSpace.fullRange, true);

    console.log('  ✓ VideoColorSpace with partial init works');
}

// Test 4: VideoColorSpace.toJSON()
{
    const colorSpace = new VideoColorSpace({
        primaries: 'smpte432',
        transfer: 'pq',
        matrix: 'bt2020-ncl',
        fullRange: false
    });

    const json = colorSpace.toJSON();

    assert.strictEqual(json.primaries, 'smpte432');
    assert.strictEqual(json.transfer, 'pq');
    assert.strictEqual(json.matrix, 'bt2020-ncl');
    assert.strictEqual(json.fullRange, false);

    console.log('  ✓ VideoColorSpace.toJSON() works');
}

// Test 5: VideoFrame.colorSpace
{
    const buf = Buffer.alloc(10 * 10 * 4);
    const frame = new VideoFrame(buf, {
        codedWidth: 10,
        codedHeight: 10,
        timestamp: 0
    });

    const colorSpace = frame.colorSpace;

    // Default color space should have null values
    assert.ok(colorSpace instanceof VideoColorSpace, 'colorSpace should be VideoColorSpace instance');
    // Values can be null if not specified
    assert.strictEqual(typeof colorSpace.primaries === 'string' || colorSpace.primaries === null, true);

    frame.close();
    console.log('  ✓ VideoFrame.colorSpace returns VideoColorSpace');
}

// Test 6: VideoColorSpace with various valid values
{
    // HDR color space
    const hdrColorSpace = new VideoColorSpace({
        primaries: 'bt2020',
        transfer: 'pq',
        matrix: 'bt2020-ncl',
        fullRange: false
    });

    assert.strictEqual(hdrColorSpace.primaries, 'bt2020');
    assert.strictEqual(hdrColorSpace.transfer, 'pq');

    // sRGB color space
    const srgbColorSpace = new VideoColorSpace({
        primaries: 'bt709',
        transfer: 'srgb',
        matrix: 'rgb',
        fullRange: true
    });

    assert.strictEqual(srgbColorSpace.primaries, 'bt709');
    assert.strictEqual(srgbColorSpace.transfer, 'srgb');

    console.log('  ✓ VideoColorSpace with various values works');
}

console.log('\n✓ All VideoColorSpace tests passed!\n');
