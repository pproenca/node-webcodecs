const {VideoEncoder, VideoFrame} = require('../../dist');

console.log('Input Robustness Fuzzer');

const encoder = new VideoEncoder({
  output: () => {},
  error: e => console.error('Encoder error:', e.message),
});
encoder.configure({codec: 'avc1.42001E', width: 100, height: 100});

// Vectors that MUST be rejected (invalid inputs that could cause crashes)
const mustRejectVectors = [
  {name: 'Zero Buffer', buf: Buffer.alloc(0), w: 100, h: 100, ts: 0},
  {name: 'Tiny Buffer', buf: Buffer.alloc(10), w: 100, h: 100, ts: 0},
  {name: 'Huge Dimensions', buf: Buffer.alloc(100), w: 10000, h: 10000, ts: 0},
  {name: 'Zero Width', buf: Buffer.alloc(400), w: 0, h: 100, ts: 0},
  {name: 'Zero Height', buf: Buffer.alloc(400), w: 100, h: 0, ts: 0},
  {name: 'Negative Width', buf: Buffer.alloc(400), w: -10, h: 100, ts: 0},
];

// Vectors that may be accepted (valid per WebCodecs spec but edge cases)
// Negative timestamps are valid in WebCodecs (microseconds, can be negative for relative timing)
const edgeCaseVectors = [
  {
    name: 'Negative Timestamp',
    buf: Buffer.alloc(15000),
    w: 100,
    h: 100,
    ts: -1,
  },
];

let failed = false;
let passed = 0;

console.log('\n--- Must Reject (Invalid Inputs) ---');
mustRejectVectors.forEach(v => {
  try {
    const frame = new VideoFrame(v.buf, {
      codedWidth: v.w,
      codedHeight: v.h,
      timestamp: v.ts,
    });
    encoder.encode(frame);
    frame.close();

    // If we reach here, bad data was accepted
    console.error(`  FAIL: Accepted "${v.name}" without error!`);
    failed = true;
  } catch (e) {
    console.log(
      `  PASS: Caught error for "${v.name}": ${e.message.slice(0, 50)}`,
    );
    passed++;
  }
});

console.log('\n--- Edge Cases (May Accept Per Spec) ---');
edgeCaseVectors.forEach(v => {
  try {
    const frame = new VideoFrame(v.buf, {
      codedWidth: v.w,
      codedHeight: v.h,
      timestamp: v.ts,
    });
    encoder.encode(frame);
    frame.close();
    console.log(`  INFO: Accepted "${v.name}" (valid per WebCodecs spec)`);
  } catch (e) {
    console.log(`  INFO: Rejected "${v.name}": ${e.message.slice(0, 50)}`);
  }
});

console.log(
  `\nResults: ${passed}/${mustRejectVectors.length} invalid inputs rejected`,
);

if (failed) {
  console.error('FAILURE: Some malformed inputs were accepted!');
  process.exit(1);
}

// Note: If we got here without segfault, that's also a pass
console.log('SUCCESS: All malformed inputs rejected safely (no segfaults).');
