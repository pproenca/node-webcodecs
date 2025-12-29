const { VideoFrame, VideoFilter } = require('../dist');

console.log('[TEST] VideoFilter Basic Tests');

// Test 1: Construction
console.log('[TEST] 1. Constructor...');
const filter = new VideoFilter();
if (filter.state !== 'unconfigured') {
    throw new Error(`Expected unconfigured, got ${filter.state}`);
}
console.log('[PASS] Constructor works');

// Test 2: Configure
console.log('[TEST] 2. Configure...');
filter.configure({ width: 640, height: 480 });
if (filter.state !== 'configured') {
    throw new Error(`Expected configured, got ${filter.state}`);
}
console.log('[PASS] Configure works');

// Test 3: Apply blur with no regions (passthrough)
console.log('[TEST] 3. Apply blur (no regions)...');
const buf = Buffer.alloc(640 * 480 * 4, 128); // Gray frame
const frame = new VideoFrame(buf, { codedWidth: 640, codedHeight: 480, timestamp: 0 });

const result = filter.applyBlur(frame, []);
if (result.codedWidth !== 640 || result.codedHeight !== 480) {
    throw new Error('Dimensions mismatch');
}
console.log('[PASS] No-region blur works');

// Test 4: Apply blur with regions
console.log('[TEST] 4. Apply blur (with regions)...');
const regions = [
    { x: 100, y: 100, width: 200, height: 150 }
];
const blurred = filter.applyBlur(frame, regions, 30);
if (blurred.codedWidth !== 640 || blurred.codedHeight !== 480) {
    throw new Error('Dimensions mismatch after blur');
}
console.log('[PASS] Region blur works');

// Test 5: Close
console.log('[TEST] 5. Close...');
filter.close();
if (filter.state !== 'closed') {
    throw new Error(`Expected closed, got ${filter.state}`);
}
console.log('[PASS] Close works');

// Cleanup
frame.close();
result.close();
blurred.close();

console.log('[PASS] All VideoFilter tests passed!');
