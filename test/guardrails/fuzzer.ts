import {VideoEncoder, VideoFrame} from '@pproenca/node-webcodecs';

console.log('Input Robustness Fuzzer');

const encoder = new VideoEncoder({
  output: () => {},
  error: error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Encoder error:', message);
  },
});
encoder.configure({codec: 'avc1.42001E', width: 100, height: 100});

const mustRejectVectors = [
  {name: 'Zero Buffer', buf: Buffer.alloc(0), w: 100, h: 100, ts: 0},
  {name: 'Tiny Buffer', buf: Buffer.alloc(10), w: 100, h: 100, ts: 0},
  {name: 'Huge Dimensions', buf: Buffer.alloc(100), w: 10000, h: 10000, ts: 0},
  {name: 'Zero Width', buf: Buffer.alloc(400), w: 0, h: 100, ts: 0},
  {name: 'Zero Height', buf: Buffer.alloc(400), w: 100, h: 0, ts: 0},
  {name: 'Negative Width', buf: Buffer.alloc(400), w: -10, h: 100, ts: 0},
];

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
for (const vector of mustRejectVectors) {
  try {
    const frame = new VideoFrame(vector.buf, {
      codedWidth: vector.w,
      codedHeight: vector.h,
      timestamp: vector.ts,
    });
    encoder.encode(frame);
    frame.close();

    console.error(`  FAIL: Accepted "${vector.name}" without error!`);
    failed = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  PASS: Caught error for "${vector.name}": ${message.slice(0, 50)}`);
    passed++;
  }
}

console.log('\n--- Edge Cases (May Accept Per Spec) ---');
for (const vector of edgeCaseVectors) {
  try {
    const frame = new VideoFrame(vector.buf, {
      codedWidth: vector.w,
      codedHeight: vector.h,
      timestamp: vector.ts,
    });
    encoder.encode(frame);
    frame.close();
    console.log(`  INFO: Accepted "${vector.name}" (valid per WebCodecs spec)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  INFO: Rejected "${vector.name}": ${message.slice(0, 50)}`);
  }
}

console.log(`\nResults: ${passed}/${mustRejectVectors.length} invalid inputs rejected`);

if (failed) {
  console.error('FAILURE: Some malformed inputs were accepted!');
  encoder.close();
  process.exit(1);
}

console.log('SUCCESS: All malformed inputs rejected safely (no segfaults).');
encoder.close();
process.exit(0);
