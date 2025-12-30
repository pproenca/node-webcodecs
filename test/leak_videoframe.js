// TDD: This test should FAIL before the fix
const {VideoFrame} = require('../dist');

const FRAMES = 1000;
const WIDTH = 320,
  HEIGHT = 240;
const LIMIT_MB = 5; // Should use <5MB for 1000 closed frames

console.log('VideoFrame Memory Release Test');
console.log('================================');

if (global.gc) global.gc();
const baseline = process.memoryUsage().rss;

const buf = Buffer.alloc(WIDTH * HEIGHT * 4);

for (let i = 0; i < FRAMES; i++) {
  const frame = new VideoFrame(buf, {
    codedWidth: WIDTH,
    codedHeight: HEIGHT,
    timestamp: i,
  });
  frame.close(); // Should release memory!
}

if (global.gc) global.gc();

const growth = (process.memoryUsage().rss - baseline) / 1024 / 1024;
console.log('Created and closed ' + FRAMES + ' frames');
console.log(
  'Memory growth: ' + growth.toFixed(2) + ' MB (limit: ' + LIMIT_MB + ' MB)',
);

if (growth > LIMIT_MB) {
  console.error('FAIL: Memory not released after close()');
  process.exit(1);
}

console.log('PASS: Memory properly released');
